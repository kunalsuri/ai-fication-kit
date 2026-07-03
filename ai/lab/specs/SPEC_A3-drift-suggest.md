<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: `drift --suggest` — turn the report into an action
> **Status:** implemented
> **Author:** Sonnet (implementing agent) · **Date:** 2026-07-03
> **Verification:** `npm test` (221/221), `node install.mjs verify . --strict`,
> `node install.mjs drift . --strict`, `npm run release-check` — all green.

## Goal
`drift` already names unmapped directories and vanished MODULE_MAP rows, but
fixing either still means the human writes the fix by hand. `--suggest` emits
deterministic, ready-to-paste fixes: a MODULE_MAP row for every unmapped
directory (with a sensible entry-point guess) and the exact line number to
delete or fix for every vanished row.

## Scope
**In:** `--suggest` flag on the existing `drift` command; appended report
section; mirrored `suggestions` array in the JSON manifest; deterministic
entry-point selection (`index.*` / `main.*` / largest source file).
**Out (explicitly):** editing `MODULE_MAP.md` itself — suggestions land in the
report only. Guessing a Stability value (always `?`).

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| backend | `lib/drift.mjs` | add `--suggest` handling: entry-point picker + report/manifest sections |
| backend | `install.mjs` | add `--suggest` to the flag parser |
| tests | `test/run-tests.mjs` | fixture with one unmapped dir + one vanished row |
| docs | `docs/CLI-REFERENCE.md` | `drift` section gains `--suggest` |
| docs | `CHANGELOG.md` | `[Unreleased]` entry |

## Acceptance criteria
1. Fixture with one unmapped directory + one vanished row: `--suggest`
   produces exactly one suggested MODULE_MAP row (correct entry-point choice)
   and one line-number pointer for the vanished row.
2. Without `--suggest`, report/manifest output is byte-identical to before
   this feature.
3. `--dry-run` still writes nothing, with or without `--suggest`.
4. Suggested rows always carry Stability `?` and `[inferred]` — never a guess.

## Verification
- Tests to add: `test/run-tests.mjs` — extend the existing drift fixture.
- Suites to run: `npm test`, `node install.mjs verify . --strict`,
  `node install.mjs drift . --strict`, `npm run release-check`.
- Stability check: only `ours`-stability files touched. No `frozen` files modified.

## Knowledge update on completion
- [x] FEATURE_MAP.md entry updated (drift gotchas)
- [x] MODULE_MAP.md rows still accurate (no new directories)
- [ ] FEATURE_CATALOG.md regenerated — deferred to `/create-feature-catalog`
