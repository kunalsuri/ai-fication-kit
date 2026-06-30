<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Tests — `ai-fication-kit`

This directory contains the testing suites for the `ai-fication-kit` repository. 

## Test Suites

| File / Command | Target / Scope | Purpose | When to run |
|---|---|---|---|
| **`npm test`**<br>(`node test/run-tests.mjs`) | Installer Functionality | Runs cross-runtime smoke tests for the Node and Python installers against throwaway mock repositories (e.g. testing orient, install, shazam, and uninstall). | Run during active development of the installer code or stack detection modules. |
| **`npm run deep-test`**<br>(`node test/run-deep-test.mjs`) | Full Repo Health & Standards | Performs a complete audit of the repository, including running the installer smoke tests, document claim verification, structural drift detection, license header checking, and placeholder leakage detection. | Run before submitting a PR, tagging a release, or declaring a task complete. |

## Details of Deep Test Verification

The `npm run deep-test` runner checks:
1. **Smoke Tests:** Runs the standard installer smoke tests (`run-tests.mjs`).
2. **Claim Verification:** Runs `node install.mjs verify . --strict` to check that all file path claims mentioned in the documentation files (e.g., in `ai/guide/MODULE_MAP.md` or `AGENTS.md`) exist on disk.
3. **Drift Detection:** Runs `node install.mjs drift . --strict --git` to verify that there are no unmapped source directories or stale verified map entries.
4. **License Headers:** Scans `.js`, `.mjs`, `.py`, and `.md` files to ensure they contain the required copyright license header.
5. **Placeholder Verification:** Ensures that no template variables (like `{{ PROJECT_NAME }}`) are accidentally leaked outside the templates folder.
