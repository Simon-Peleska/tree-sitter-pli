// Copied into the zowe-pli-language-support checkout by test/zowe/run.sh and loaded as a vitest
// setupFile. It wraps Zowe's test helpers `parse`/`parseStmts` so every PL/I text their test
// suite parses is appended to $ZOWE_CAPTURE_FILE together with Zowe's own lexer/parser verdict.
import { appendFileSync } from "node:fs";
import { expect, vi } from "vitest";

vi.mock(import("./packages/language/test/utils"), async (importOriginal) => {
  const real: any = await importOriginal();

  async function parse(text: string, options?: any) {
    const unit = await real.parse(text, options);
    // Same check as Zowe's assertNoParseErrors: any Lexer (1) or Parser (2) diagnostic counts.
    const errors = [...unit.diagnostics.get(1), ...unit.diagnostics.get(2)];
    const state = expect.getState();
    appendFileSync(
      process.env.ZOWE_CAPTURE_FILE!,
      JSON.stringify({
        file: state.testPath ? state.testPath.split("/packages/language/test/")[1] : "",
        test: state.currentTestName ?? "",
        text,
        zoweErrors: errors.map((d: any) => `${d.code ?? ""} ${d.message}`.trim()),
      }) + "\n",
    );
    return unit;
  }

  // Mirrors Zowe's own parseStmts; theirs calls the unwrapped parse internally, so it can't be reused.
  function parseStmts(text: string, options?: any) {
    let prefix = "";
    while (text.startsWith("*PROCESS") || text.startsWith("%PROCESS")) {
      prefix += text.substring(0, text.indexOf("\n") + 1);
      text = text.substring(text.indexOf("\n") + 1);
    }
    if (prefix) {
      prefix += "\n";
    }
    return parse(
      `${prefix} STARTPR: PROCEDURE OPTIONS (MAIN);
${text}
 end STARTPR;`,
      options,
    );
  }

  return { ...real, parse, parseStmts };
});
