<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: `status` — one-command health snapshot
> **Status:** implemented
> **Author:** Sonnet (implementing agent) · **Date:** 2026-07-03
> **Verification:** `npm test` (248/248), `node install.mjs verify . --strict`,
> `node install.mjs drift . --strict`, `npm run release-check` — all green.

## Goal
"How trustworthy is my `ai/` layer right now?" currently takes three commands
and three reports to answer. `node install.mjs status <path>` runs `verify`
and `drift`'s core scans in-process (structural only, never git), counts
`[verified]`/`[inferred]` MODULE_MAP rows and the newest audit date, and prints
one block ending in a single verdict: `TRUSTED`, `NEEDS AUDIT`, or `DRIFTING`.

## Scope
**In:** `lib/status.mjs`; exported pure `computeVerification`/`computeDrift`
functions in `lib/verify.mjs`/`lib/drift.mjs` (their CLI behavior stays
byte-identical); `--json` writes `ai/analysis/audit-reports/STATUS.json`
including a shields.io-schema `badge` object.
**Out (explicitly):** hosting the badge, the git-based stale check, fixing anything.

## Scoring thresholds (documented in code, `lib/status.mjs`)
- **DRIFTING** — any unconfirmed claim (verify) or any unmapped/vanished/stale
  item (drift, structural only). Trumps everything else.
- **NEEDS AUDIT** — no broken claims/drift, but MODULE_MAP.md is missing, has
  any non-`[verified]` row, or its newest audit date is more than 90 days old.
- **TRUSTED** — no broken claims/drift, every row `[verified]`, audit not stale.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| backend | `lib/verify.mjs` | extract pure `computeVerification(targetAbs)` |
| backend | `lib/drift.mjs` | extract pure `computeDrift(targetAbs, { git })` |
| backend | `lib/status.mjs` | new — combines both + MODULE_MAP row/date parsing, verdict, printer, `--json` writer |
| backend | `install.mjs` | add `status` to `COMMANDS`, dispatch branch, usage text |
| tests | `test/run-tests.mjs` | fixtures for each verdict; existing verify/drift tests must still pass unchanged |
| docs | `docs/CLI-REFERENCE.md` | command index row + `status` section |
| docs | `CHANGELOG.md` | `[Unreleased]` entry |

## Acceptance criteria
1. On this kit's own repo, `[verified]`/`[inferred]` row counts match a hand
   count of `ai/guide/MODULE_MAP.md`.
2. Existing `verify`/`drift` CLI tests pass unchanged (byte-identical behavior).
3. Without `--json`, `status` writes nothing.
4. With `--json`, `ai/analysis/audit-reports/STATUS.json` is written with a
   `badge` object matching `{schemaVersion:1, label:"ai-ready", message, color}`.
5. `status` never invokes git (drift's stale check is always skipped).

## Verification
- Tests to add: `test/run-tests.mjs` — one fixture per verdict, `--json` write
  check, own-repo row-count check.
- Suites to run: `npm test`, `node install.mjs verify . --strict`,
  `node install.mjs drift . --strict`, `npm run release-check`.
- Stability check: only `ours`-stability files touched. No `frozen` files modified.

## Knowledge update on completion
- [x] FEATURE_MAP.md entry added
- [x] MODULE_MAP.md rows still accurate (no new directories)
- [ ] FEATURE_CATALOG.md regenerated — deferred to `/create-feature-catalog`
