---
name: deep-test
description: Perform a deep test of the codebase, validating functional smoke tests, claim verification, drift checks, license headers, and placeholder checks. Trigger whenever the user asks to run deep tests, check code health, or perform strict verification.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

# Deep test the codebase

This skill performs a thorough and strict verification of the codebase to guarantee that changes are clean, functional, matches Conventions, contains proper license headers, and does not leak template placeholders.

## 1. Prerequisites
Ensure you have the required runtimes and node dependencies installed:
- Node.js (>= 18)
- Run `npm install` before running tests if dependencies are updated.

## 2. Run the Deep Test
Run the automated deep test script via npm:
```bash
npm run deep-test
```

## 3. Verify Output
The script automatically tests:
- Smoke tests: `node test/run-tests.mjs`
- Document Claim verification: `node install.mjs verify . --strict`
- Structural Drift verification: `node install.mjs drift . --strict --git` (falls back to `--strict` without `--git` if git is not available)
- License Headers check: Scans files for copyright markers.
- Unresolved template placeholders: Confirms template variables are not leaked outside of `templates/`.

If any of the checks fail, print the failures verbatim and address them before declaring success.

## 4. Manual Verification / Check Checklist
- If you introduced new files, check that their paths are added to the appropriate catalog or map (e.g., `ai/guide/MODULE_MAP.md`) and labeled as `[inferred]`.
- Verify the change adheres to all project rules in `AGENTS.md` and conventions in `ai/guide/CONVENTIONS.md`.
