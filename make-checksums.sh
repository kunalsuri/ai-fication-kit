#!/usr/bin/env bash
# Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
# Regenerate CHECKSUMS.txt so users can verify the kit was not tampered with.
# Usage: ./make-checksums.sh   (run from the repo root)
set -euo pipefail
if command -v sha256sum >/dev/null 2>&1; then
  SHA=(sha256sum)
else
  SHA=(shasum -a 256)   # macOS ships shasum, not sha256sum
fi
{
  echo "# SHA-256 checksums for ai-fication-kit — regenerate with ./make-checksums.sh"
  find install.mjs install.py templates -type f | LC_ALL=C sort | xargs "${SHA[@]}"
} > CHECKSUMS.txt
echo "✓ CHECKSUMS.txt written ($(grep -c '^[0-9a-f]' CHECKSUMS.txt) files)"
