#!/usr/bin/env bash
# Compares this grammar's accept/reject verdicts with Zowe's PL/I parser
# (https://github.com/zowe/zowe-pli-language-support) over the PL/I texts in Zowe's test suite,
# Zowe's code_samples and this repo's examples. Zowe is EPL-2.0, so it's fetched at a pinned
# commit into test/zowe/.work instead of being vendored here.
#
#   bash test/zowe/run.sh            # compare against test/zowe/baseline.tsv
#   bash test/zowe/run.sh --update   # accept the current verdicts as the new baseline
#
# Needs network access on first run, node, git and the tree-sitter CLI (all in `nix develop`).
set -euo pipefail

ZOWE_REPO=https://github.com/zowe/zowe-pli-language-support.git
ZOWE_COMMIT=ff515e8baf23641cbcca81780b957a6eb69a7fee
PNPM=pnpm@11.8.0

here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
work=$here/.work
zowe=$work/zowe-$ZOWE_COMMIT

if [ ! -f "$zowe/.ready" ]; then
  echo "run.sh: fetching zowe-pli-language-support at $ZOWE_COMMIT"
  rm -rf "$zowe"
  git init -q "$zowe"
  git -C "$zowe" fetch -q --depth 1 "$ZOWE_REPO" "$ZOWE_COMMIT"
  git -C "$zowe" checkout -q FETCH_HEAD
  (cd "$zowe" && npx -y "$PNPM" install --frozen-lockfile && npx -y "$PNPM" generate && npx -y "$PNPM" tsc)
  touch "$zowe/.ready"
fi

cp "$here/capture.setup.ts" "$here/vitest.capture.config.ts" "$zowe/"
cp "$here/programs.test.ts" "$zowe/packages/language/test/zz-programs.test.ts"

# Zowe defaults to IBM's fixed-format MARGINS(2,72), which would cut off column 1 of this repo's
# free-form examples. The %PROCESS line goes into the text both parsers see.
rm -rf "$work/examples"
mkdir -p "$work/examples"
for f in "$root"/examples/*.pli; do
  { echo '%PROCESS MARGINS(1,100);'; cat "$f"; } > "$work/examples/$(basename "$f")"
done

capture=$work/capture.jsonl
rm -f "$capture"
echo "run.sh: capturing Zowe's verdicts"
(cd "$zowe" && ZOWE_CAPTURE_FILE="$capture" \
  ZOWE_PROGRAMS="$(ls "$zowe"/code_samples/*.pli "$work"/examples/*.pli)" \
  npx vitest run --config vitest.capture.config.ts --reporter=dot)

node "$here/compare.mjs" "$capture" "$@"
