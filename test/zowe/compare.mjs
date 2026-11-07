// Parses every PL/I text captured from Zowe's test suite with this grammar and compares the
// accept/reject verdicts of both parsers against test/zowe/baseline.tsv.
//
//   node test/zowe/compare.mjs <capture.jsonl> [--update]
//
// Exits non-zero when any verdict differs from the baseline; --update rewrites the baseline instead.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const baselinePath = join(here, "baseline.tsv");
const [capturePath, ...flags] = process.argv.slice(2);
const update = flags.includes("--update");

const records = readFileSync(capturePath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
console.log(`compare: ${records.length} texts captured from Zowe's test suite`);

const seenIds = new Map();
for (const record of records) {
  const baseId = `${record.file} > ${record.test}`.replace(/[\t\n]/g, " ");
  const n = (seenIds.get(baseId) ?? 0) + 1;
  seenIds.set(baseId, n);
  record.id = n === 1 ? baseId : `${baseId} #${n}`;
}

const textsDir = join(here, ".work", "texts");
rmSync(textsDir, { recursive: true, force: true });
mkdirSync(textsDir, { recursive: true });
records.forEach((record, i) => {
  record.path = join(textsDir, `${String(i).padStart(4, "0")}.pli`);
  writeFileSync(record.path, record.text);
});
const pathsFile = join(textsDir, "paths.txt");
writeFileSync(pathsFile, records.map((r) => r.path).join("\n") + "\n");

// tree-sitter exits 1 when any file has a parse error; that's an expected outcome here.
let output;
try {
  output = execFileSync("tree-sitter", ["parse", "--quiet", "--json-summary", "--paths", pathsFile], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch (error) {
  if (typeof error.stdout !== "string" || !error.stdout.includes("parse_summaries")) {
    console.error("compare: [ZC001] tree-sitter parse failed to run", error);
    process.exit(2);
  }
  output = error.stdout;
}
// --quiet still prints one line per file with errors before the JSON summary.
const summary = JSON.parse(output.slice(output.search(/^\{$/m)));
const treeSitterOk = new Map(summary.parse_summaries.map((s) => [s.file, s.successful]));

for (const record of records) {
  if (!treeSitterOk.has(record.path)) {
    console.error(`compare: [ZC002] tree-sitter reported nothing for ${record.path} (${record.id})`);
    process.exit(2);
  }
  // LSPIR* is Zowe failing to find an %INCLUDE/EXEC SQL INCLUDE member: no workspace is configured
  // here, and tree-sitter never resolves includes, so it says nothing about the syntax.
  record.zoweErrors = record.zoweErrors.filter((e) => !e.startsWith("LSPIR"));
  record.zowe = record.zoweErrors.length === 0 ? "ok" : "error";
  record.treeSitter = treeSitterOk.get(record.path) ? "ok" : "error";
}

const counts = {};
for (const r of records) {
  const key = r.zowe === r.treeSitter ? `both ${r.zowe}` : `only ${r.zowe === "error" ? "zowe" : "tree-sitter"} rejects`;
  counts[key] = (counts[key] ?? 0) + 1;
}
console.log("compare:", JSON.stringify(counts));

const header = "zowe\ttree-sitter\tid";
const lines = records.map((r) => `${r.zowe}\t${r.treeSitter}\t${r.id}`).sort();
const index = records.map((r) => `${r.path}\t${r.zowe}\t${r.treeSitter}\t${r.id}\t${r.zoweErrors[0] ?? ""}`);
writeFileSync(join(textsDir, "index.tsv"), index.join("\n") + "\n");

if (update) {
  writeFileSync(baselinePath, [header, ...lines].join("\n") + "\n");
  console.log(`compare: wrote ${lines.length} verdicts to ${baselinePath}`);
  process.exit(0);
}

let baseline = [];
try {
  baseline = readFileSync(baselinePath, "utf8").split("\n").filter(Boolean).slice(1);
} catch {
  console.error(`compare: [ZC003] no baseline at ${baselinePath}; run with --update to create it`);
  process.exit(1);
}

const baselineById = new Map(baseline.map((line) => [line.split("\t")[2], line]));
const currentById = new Map(lines.map((line) => [line.split("\t")[2], line]));
const changes = [];
for (const [id, line] of currentById) {
  const before = baselineById.get(id);
  if (before !== line) changes.push({ id, before, after: line });
}
for (const [id, line] of baselineById) {
  if (!currentById.has(id)) changes.push({ id, before: line, after: undefined });
}

if (changes.length === 0) {
  console.log("compare: all verdicts match the baseline");
  process.exit(0);
}

const byId = new Map(records.map((r) => [r.id, r]));
console.error(`compare: [ZC004] ${changes.length} verdict(s) differ from the baseline (zowe / tree-sitter):`);
for (const { id, before, after } of changes) {
  const show = (line) => (line ? line.split("\t").slice(0, 2).join(" / ") : "absent");
  const record = byId.get(id);
  console.error(`  ${show(before)} -> ${show(after)}  ${id}${record ? `\n      ${record.path}` : ""}`);
}
console.error("compare: inspect the texts above, then rerun with --update to accept the new verdicts");
process.exit(1);
