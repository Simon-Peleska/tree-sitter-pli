// Copied into the zowe-pli-language-support checkout by test/zowe/run.sh.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    deps: { interopDefault: true },
    include: [
      "packages/language/test/parsing.test.ts",
      "packages/language/test/extracted-doc-cases.test.ts",
      "packages/language/test/zz-programs.test.ts",
    ],
    setupFiles: ["./capture.setup.ts"],
  },
});
