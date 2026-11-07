// Copied into the zowe-pli-language-support checkout by test/zowe/run.sh. Feeds whole programs
// (Zowe's code_samples plus this grammar's own examples, listed in $ZOWE_PROGRAMS) through the
// captured `parse` so they land in the comparison next to Zowe's test snippets.
import { readFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { test } from "vitest";
import { parse } from "./utils";

for (const path of process.env.ZOWE_PROGRAMS!.split("\n").filter(Boolean)) {
  test(`${basename(dirname(path))}/${basename(path)}`, async () => {
    await parse(readFileSync(path, "utf8"));
  });
}
