// Parses every code example of IBM's Enterprise PL/I for z/OS Language Reference with this
// grammar and compares the verdicts against test/spec/baseline.tsv.
//
//   node test/spec/compare.mjs <lr.xml> [--update] [--show <id substring>]
//
// <lr.xml> is the manual converted by `pdftohtml -xml` (run.sh does that). An example is a run
// of lines set only in the manual's code font; the figures' callout numbers are in another font
// and dropped. Exits non-zero when a verdict differs from the baseline; --update rewrites it.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const baselinePath = join(here, "baseline.tsv");
const [xmlPath, ...flags] = process.argv.slice(2);
const update = flags.includes("--update");
const show = flags.includes("--show") ? flags[flags.indexOf("--show") + 1] : undefined;

const unescape = (s) => s.replace(/<[^>]*>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

const xml = readFileSync(xmlPath, "utf8");
const fonts = new Map([...xml.matchAll(/<fontspec id="(\d+)" size="(\d+)" family="([^"]*)"/g)].map((m) => [m[1], { size: Number(m[2]), family: m[3] }]));
const kind = (id) => {
  const { family, size } = fonts.get(id);
  if (family.includes("BookMasterReverse")) return "callout";
  if (family.includes("BookMaster") && !family.includes("Specials")) return "code";
  if (family.includes("Xyvision") || family.includes("Specials")) return "diagram";
  if (family === "Helvetica" && size >= 15) return "heading";
  return "prose";
};

// The header and footer repeat on every page; an example running over a page break goes on.
const BODY_TOP = 80, BODY_BOTTOM = 1100;
const blocks = [];
const headings = [];
let title = "";
let open = null;
for (const page of xml.split(/<page number="/).slice(1)) {
  const number = Number(page.slice(0, page.indexOf('"')));
  const rows = new Map();
  for (const m of page.matchAll(/<text top="(\d+)" left="(\d+)" width="(\d+)" height="\d+" font="(\d+)">([^]*?)<\/text>/g)) {
    const text = unescape(m[5]);
    const top = Number(m[1]);
    if (!text.trim() || top < BODY_TOP || top > BODY_BOTTOM) continue;
    // The manual draws the concatenation operator as a backslash of a symbol font, set a few
    // points below the line.
    const concatenation = text === "\\" && fonts.get(m[4]).family.includes("XyvisionPiThree");
    const k = concatenation ? "code" : kind(m[4]);
    if (k === "callout") continue;
    const key = [...rows.keys()].find((t) => Math.abs(t - top) <= 4) ?? top;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push({ left: Number(m[2]), width: Number(m[3]), kind: k, text: concatenation ? "||" : text });
  }
  let lastTop = null;
  for (const top of [...rows.keys()].sort((a, b) => a - b)) {
    const items = rows.get(top).sort((a, b) => a.left - b.left);
    const kinds = new Set(items.map((i) => i.kind));
    if (kinds.has("heading") && !kinds.has("code")) {
      title = items.map((i) => i.text).join(" ").replace(/\s+/g, " ").trim();
      headings.push({ page: number, title });
      open = null;
      continue;
    }
    if (kinds.has("diagram") && open) open.diagram = true;
    // "Figure 6. ... (Part 1 of 3)": the example goes on after the caption, often on the next page.
    const part = items.map((i) => i.text).join(" ").match(/\(Part (\d+) of (\d+)\)\s*$/);
    if (part && Number(part[1]) < Number(part[2])) {
      lastTop = null;
      continue;
    }
    if ([...kinds].some((k) => k !== "code")) {
      open = null;
      continue;
    }
    if (!open || (lastTop !== null && top - lastTop > 75)) {
      open = { page: number, title, rows: [], diagram: false };
      blocks.push(open);
    }
    open.rows.push(items);
    lastTop = top;
  }
}

// The code font is monospaced: place each piece at its column.
const examples = [];
const seenIds = new Map();
let syntaxDiagrams = 0;
for (const block of blocks) {
  if (block.diagram) continue;
  const widths = block.rows.flat().filter((i) => i.text.length >= 3).map((i) => i.width / i.text.length).sort((a, b) => a - b);
  if (!widths.length) continue;
  const charWidth = widths[Math.floor(widths.length / 2)];
  const left = Math.min(...block.rows.flat().map((i) => i.left));
  const lines = block.rows.map((items) => {
    let line = "";
    for (const item of items) {
      const column = Math.round((item.left - left) / charWidth);
      line = line.length < column ? line.padEnd(column) : line + (line && !line.endsWith(" ") && !/^[,;.)]/.test(item.text) ? " " : "");
      line += item.text;
    }
    return line.trimEnd();
  });
  // A column of dots stands for code left out.
  // The manual typesets '' as one ″ and minus as −.
  const text = lines.filter((l) => !/^\s*[.⋮]+\s*$/.test(l))
    .map((l) => l.replace(/[’‘]/g, "'").replace(/[“”″]/g, '"').replace(/−/g, "-"))
    .map((l) => (l.split('"').length % 2 === 0 ? l.replace(/"/g, "''") : l))
    .join("\n") + "\n";
  // Names, expressions and attribute lists in running text are not statements.
  if (!text.includes(";") && !text.trimStart().startsWith("%")) continue;
  // A syntax diagram drawn in the code font: boxes, a comma over a repeated item, or
  // placeholders like file-reference.
  const code = text.replace(/'[^']*'|\/\*[^]*?\*\//g, "");
  if (/[│┌└┐┘─├┤]/.test(text) || /^\s*,\s*$/m.test(text) || /\b[a-z]{2,}(-[a-z][a-z0-9]*)+\b|\b[a-z]{4,}-[0-9]\b/.test(code)) {
    syntaxDiagrams++;
    continue;
  }
  const baseId = `p${block.page} ${block.title}`.replace(/[\t\n]/g, " ");
  const n = (seenIds.get(baseId) ?? 0) + 1;
  seenIds.set(baseId, n);
  examples.push({ id: `${baseId} #${n}`, text });
}
console.log(`spec: ${examples.length} examples from ${blocks.length} code blocks (${syntaxDiagrams} syntax diagrams left out)`);

const textsDir = join(here, ".work", "texts");
rmSync(textsDir, { recursive: true, force: true });
mkdirSync(textsDir, { recursive: true });
// The manual often shows a DO, BEGIN or SELECT without its END; an example also counts as
// accepted when it parses with up to three ENDs added.
const ENDS = ["", "end;\n", "end;\nend;\n", "end;\nend;\nend;\n"];
examples.forEach((example, i) => {
  const base = join(textsDir, String(i).padStart(4, "0"));
  example.path = `${base}.pli`;
  example.variants = ENDS.map((_, n) => (n ? `${base}.end${n}.pli` : example.path));
  ENDS.forEach((ends, n) => writeFileSync(example.variants[n], example.text + ends));
});
const pathsFile = join(textsDir, "paths.txt");
writeFileSync(pathsFile, examples.flatMap((e) => e.variants).join("\n") + "\n");

// tree-sitter exits 1 when any file has a parse error; that's an expected outcome here.
// --quiet still prints one line per file with errors before the JSON summary.
let output;
try {
  output = execFileSync("tree-sitter", ["parse", "--quiet", "--json-summary", "--paths", pathsFile], {
    cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"],
  });
} catch (error) {
  if (typeof error.stdout !== "string" || !error.stdout.includes("parse_summaries")) {
    console.error("spec: [SC001] tree-sitter parse failed to run", error);
    process.exit(2);
  }
  output = error.stdout;
}
const summary = JSON.parse(output.slice(output.search(/^\{$/m)));
const ok = new Map(summary.parse_summaries.map((s) => [s.file, s.successful]));
for (const example of examples) {
  if (!ok.has(example.path)) {
    console.error(`spec: [SC002] tree-sitter reported nothing for ${example.path} (${example.id})`);
    process.exit(2);
  }
  example.verdict = example.variants.some((v) => ok.get(v)) ? "ok" : "error";
}

if (show !== undefined) {
  for (const e of examples.filter((e) => e.id.includes(show))) {
    console.log(`=== ${e.id} [${e.verdict}] ${e.path}\n${e.text}`);
  }
  process.exit(0);
}

// The baseline's third column says why an example is rejected: not PL/I (a fragment with
// placeholders, an example of an error), or a grammar gap still open.
const baseline = new Map();
if (existsSync(baselinePath)) {
  for (const line of readFileSync(baselinePath, "utf8").split("\n").slice(1).filter(Boolean)) {
    const [verdict, id, why = ""] = line.split("\t");
    baseline.set(id, { verdict, why });
  }
}
const counts = { ok: 0, error: 0 };
for (const e of examples) counts[e.verdict]++;
console.log("spec:", JSON.stringify(counts));

if (update) {
  const rows = examples.map((e) => `${e.verdict}\t${e.id}\t${e.verdict === "error" ? baseline.get(e.id)?.why ?? "" : ""}`);
  writeFileSync(baselinePath, ["verdict\tid\twhy", ...rows].join("\n") + "\n");
  console.log(`spec: wrote ${baselinePath}`);
  process.exit(0);
}

// The manual's inventory: every statement, directive, condition, built-in and attribute it
// has a section on must appear in a passing example or in a corpus test. The page ranges are
// the chapters each kind of section lives in.
const inventory = new Map();
const add = (kind, name, page) => {
  if (!inventory.has(name)) inventory.set(name, { kind, page });
};
for (const { page, title } of headings) {
  let m;
  if (page >= 199 && page <= 232 && (m = title.match(/^([%*]?[A-Z][A-Z ]*?) (statement|directive|Statement)$/))) add("statement", m[1], page);
  // RETURN and ANSWER stand inside a preprocessor procedure, without %.
  else if (page >= 509 && page <= 542 && (m = title.match(/^(?:Preprocessor )?(%?[A-Z][A-Z ]*?) Statement$/))) add("preprocessor statement", m[1], page);
  else if (page >= 519 && page <= 528 && /^[A-Z][A-Z0-9]+$/.test(title)) add("preprocessor built-in", title, page);
  else if (page >= 351 && page <= 370 && (m = title.match(/^([A-Z]+) condition$/))) add("condition", m[1], page);
  else if (page >= 380 && page <= 508 && /^[A-Z][A-Z0-9_]+$/.test(title)) add("built-in", title === "MESEARCHR" ? "MEMSEARCHR" : title, page);
  else if (page >= 33 && page <= 270 && /\battributes?$|option and attribute$/.test(title)) {
    for (const word of title.match(/\b[A-Z]{2,}\b/g) ?? []) add("attribute", word, page);
  }
}
const stripped = (text) => text.replace(/'(?:[^']|'')*'|"[^"]*"|\/\*[^]*?\*\//g, " ");
const corpus = readdirSync(join(root, "test", "corpus")).filter((f) => f.endsWith(".txt"))
  .flatMap((f) => readFileSync(join(root, "test", "corpus", f), "utf8").split(/^={3,}\n.*\n={3,}\n/m).slice(1).map((t) => t.split(/^-{3,}$/m)[0]));
const exercised = stripped([...examples.filter((e) => e.verdict === "ok").map((e) => e.text), ...corpus].join("\n"));
const missing = [...inventory].filter(([name]) => {
  // %L: ITERATE L; puts the label between % and the keyword.
  const pattern = name.replace(/\*/g, "\\*").replace(/^%/, "%\\s*(?:\\w+\\s*:\\s*)?").replace(/ +/g, "\\s*");
  return !new RegExp(`(^|[^A-Za-z0-9_#$@])${pattern}(?![A-Za-z0-9_#$@])`, "i").test(exercised);
});
console.log(`spec: ${inventory.size - missing.length} of the manual's ${inventory.size} statements, conditions, built-ins and attributes exercised`);
let differences = 0;
for (const [name, { kind, page }] of missing) {
  console.log(`spec: [SC007] ${kind} ${name} (p${page}) appears in no passing example or corpus test`);
  differences++;
}
for (const e of examples) {
  const was = baseline.get(e.id);
  if (!was) {
    console.log(`spec: [SC003] new example ${e.id}: ${e.verdict}`);
    differences++;
  } else if (was.verdict !== e.verdict) {
    console.log(`spec: [SC004] ${e.id}: baseline ${was.verdict}, now ${e.verdict} (${e.path})`);
    differences++;
  } else if (e.verdict === "error" && !was.why) {
    console.log(`spec: [SC008] ${e.id} is rejected and the baseline gives no reason (${e.path})`);
    differences++;
  }
}
const exampleIds = new Set(examples.map((e) => e.id));
for (const id of baseline.keys()) {
  if (!exampleIds.has(id)) {
    console.log(`spec: [SC005] example gone: ${id}`);
    differences++;
  }
}
console.log(differences ? `spec: ${differences} differences from the baseline` : "spec: all verdicts match the baseline");
process.exit(differences ? 1 : 0);
