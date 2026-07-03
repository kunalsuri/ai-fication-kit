<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: Friendly CI feedback — plain English instead of a bare red ❌
> **Status:** implemented
> **Author:** Sonnet (implementing agent) · **Date:** 2026-07-03
> **Verification:** `npm test` (231/231), `node install.mjs verify . --strict`,
> `node install.mjs drift . --strict`, `npm run release-check` — all green.

## Goal
The stamped `ai-check.yml` workflow fails CI with raw `verify`/`drift` console
logs, which reads like a wall of text to a beginner. GitHub renders anything
appended to the file named by `$GITHUB_STEP_SUMMARY` as a nice summary panel
on the run page. `--github-summary` on `verify`/`drift` appends a short,
plain-English markdown summary there — a ✅/❌ headline, one line per problem
with the fix, and a confirmation line on success — with zero effect outside CI.

## Scope
**In:** `--github-summary` flag on `verify` and `drift`; a shared formatting
helper in `lib/util.mjs`; workflow template updated to pass the flag and run
with `if: always()` so the summary appears on failure too.
**Out (explicitly):** PR comments (needs a token), any network call, changing
exit codes / `--strict` semantics.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| backend | `lib/util.mjs` | add `writeGithubSummary(flags, lines)` helper |
| backend | `lib/verify.mjs` | build + write the summary after computing results |
| backend | `lib/drift.mjs` | build + write the summary after computing results |
| backend | `install.mjs` | add `--github-summary` to the flag parser |
| templates | `templates/github/workflows/ai-check.yml.tmpl` | pass `--github-summary`; `if: always()` on the verify/drift steps |
| tests | `test/run-tests.mjs` | point `GITHUB_STEP_SUMMARY` at a temp file for both commands |
| docs | `docs/CLI-REFERENCE.md` | flag documented on both commands |
| docs | `CHANGELOG.md` | `[Unreleased]` entry |

## Acceptance criteria
1. With `GITHUB_STEP_SUMMARY` pointed at a temp file and `--github-summary`:
   a failing run (unconfirmed claim / drift finding) appends a ❌ headline +
   one plain-English line per problem naming the fix; a clean run appends a
   ✅ headline + confirmation line.
2. Without the env var set, `--github-summary` is a silent no-op — nothing
   appended, no error, exit codes unchanged.
3. Without `--github-summary` at all, behavior is unchanged (no summary
   write attempted, even if the env var happens to be set).
4. `--strict` exit-code semantics are untouched by this feature.

## Verification
- Tests to add: `test/run-tests.mjs` — temp-file `GITHUB_STEP_SUMMARY` cases
  for `verify` (missing claim) and `drift` (unmapped dir), plus the no-flag
  and no-env-var no-op cases.
- Suites to run: `npm test`, `node install.mjs verify . --strict`,
  `node install.mjs drift . --strict`, `npm run release-check`.
- Stability check: only `ours`-stability files touched. No `frozen` files modified.

## Knowledge update on completion
- [x] FEATURE_MAP.md entries updated (verify/drift gotchas)
- [x] MODULE_MAP.md rows still accurate (no new directories)
- [ ] FEATURE_CATALOG.md regenerated — deferred to `/create-feature-catalog`
