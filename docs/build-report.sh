#!/usr/bin/env bash
# Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
#
# Build the technical report PDF from its Markdown source via pandoc.
#
# Usage:   docs/build-report.sh
# Output:  docs/AI-fication-Kit-TR-2026-01.pdf
#
# Requirements: pandoc, plus a PDF engine. Any one of the following works;
# the script picks the first it finds:
#   - tectonic         (recommended: self-contained, no system TeX install)
#   - xelatex / pdflatex (a TeX Live / MiKTeX installation)
#   - weasyprint        (HTML/CSS engine, no LaTeX needed)
#
# This script does NOT run in the project's CI by default; the PDF is a release
# artifact, regenerated on demand and attached to the GitHub/Zenodo release.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$HERE/AI-fication-Kit-TR-2026-01.md"
OUT="$HERE/AI-fication-Kit-TR-2026-01.pdf"

if ! command -v pandoc >/dev/null 2>&1; then
  echo "error: pandoc not found. Install it from https://pandoc.org/installing.html" >&2
  exit 1
fi

# Pick the first available PDF engine.
ENGINE=""
for e in tectonic xelatex pdflatex weasyprint; do
  if command -v "$e" >/dev/null 2>&1; then ENGINE="$e"; break; fi
done
if [ -z "$ENGINE" ]; then
  echo "error: no PDF engine found (tried tectonic, xelatex, pdflatex, weasyprint)." >&2
  echo "       install one, e.g. 'tectonic', then re-run." >&2
  exit 1
fi

echo "Building $OUT  (pandoc + $ENGINE) ..."
pandoc "$SRC" \
  --from gfm+yaml_metadata_block \
  --pdf-engine="$ENGINE" \
  --toc --toc-depth=2 \
  --number-sections \
  -V papersize=a4 \
  -o "$OUT"

echo "Done: $OUT"
