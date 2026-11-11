#!/usr/bin/env bash
# Parses every code example of IBM's Enterprise PL/I for z/OS Language Reference (V3R2, SC27-1460)
# and compares the verdicts with test/spec/baseline.tsv. The manual is IBM's copyright, so it's
# fetched into test/spec/.work instead of being vendored here.
#
#   bash test/spec/run.sh                  # compare against test/spec/baseline.tsv
#   bash test/spec/run.sh --update         # accept the current verdicts as the new baseline
#   bash test/spec/run.sh --show 'DO'      # print the examples whose id contains DO
#
# Needs network access on first run, curl, pdftohtml (poppler), node and the tree-sitter CLI
# (all in `nix develop`).
set -euo pipefail

PDF_URL=https://web-docs.gsi.de/~kraemer/COLLECTION/AIX/ibm3lr20.pdf
PDF_SHA256=95305cdcbc1b56742fb233a158db020d313304d271255826af4f71c480f98b1f

here=$(cd "$(dirname "$0")" && pwd)
work=$here/.work
pdf=$work/ibm3lr20.pdf
xml=$work/ibm3lr20.xml
mkdir -p "$work"

if [ ! -f "$pdf" ]; then
  echo "run.sh: fetching $PDF_URL"
  curl -fsSL -o "$pdf.part" "$PDF_URL"
  mv "$pdf.part" "$pdf"
fi
if ! echo "$PDF_SHA256  $pdf" | sha256sum -c --quiet -; then
  echo "run.sh: [SC006] $pdf is not the manual this baseline was made from; delete it and rerun" >&2
  exit 2
fi
if [ ! -f "$xml" ] || [ "$pdf" -nt "$xml" ]; then
  pdftohtml -xml -i -q "$pdf" "${xml%.xml}"
fi

node "$here/compare.mjs" "$xml" "$@"
