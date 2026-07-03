<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: `doctor` — state-aware next step
> **Status:** implemented
> **Author:** Sonnet (implementing agent) · **Date:** 2026-07-03
> **Verification:** `npm test` (209/209), `node install.mjs verify . --strict`,
> `node install.mjs drift . --strict`, `npm run release-check` — all green.

## Goal
A beginner running the kit against their repo loses track of which of the 5
workflow stages they're on. `node install.mjs doctor <path>` reads the repo's
current on-disk state (never writes anything) and prints the single next
command or action to take, in plain language, with no jargon beyond what
`docs/GLOSSARY.md` defines.

## Scope
**In:** read-only stage detector over 5 fixed conditions; plain-language
output; reuse of the MODULE_MAP parser.
**Out (explicitly):** auto-fixing, interactivity, git, prompting.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| backend | `lib/drift.mjs` | export `parseModuleMap`, `MODULE_MAP_REL`, `MODULE_MAP_PLACEHOLDER` |
| backend | `lib/doctor.mjs` | new — stage detection + printer |
| backend | `install.mjs` | add `doctor` to `COMMANDS`, dispatch branch, usage text |
| tests | `test/run-tests.mjs` | fixtures for the 4 detectable states + no-write assertion |
| docs | `docs/CLI-REFERENCE.md` | command index row + `doctor` section |
| docs | `CHANGELOG.md` | `[Unreleased]` entry |

## Acceptance criteria
1. Fresh repo (no `ai/repo-profile.json`) → step 1, "run shazam".
2. Post-shazam repo (profile exists, MODULE_MAP missing/template placeholder)
   → step 2, "run /cold-start".
3. Post-cold-start repo (MODULE_MAP has `[inferred]` rows) → step 3, human audit.
4. Repo with no verify/drift manifests, or manifests recording failures → step 4.
5. Fully verified repo (all rows `[verified]`, manifests clean) → step 5,
   "maintenance mode".
6. `doctor` never writes a file in any of the above (fixture tree hash unchanged).
7. Output uses no term absent from `docs/GLOSSARY.md`.

## Verification
- Tests to add: `test/run-tests.mjs` — one fixture per step, asserting the
  printed step number and that no file was written.
- Suites to run: `npm test`, `node install.mjs verify . --strict`,
  `node install.mjs drift . --strict`.
- Stability check: only `ours`-stability files touched (`lib/`, `install.mjs`,
  `test/`, `docs/`, `CHANGELOG.md`). No `frozen` files modified.

## Knowledge update on completion
- [x] FEATURE_MAP.md entry added/updated
- [x] MODULE_MAP.md rows still accurate (no new directories)
- [ ] FEATURE_CATALOG.md regenerated — deferred to `/create-feature-catalog` (not required per shared contract)
