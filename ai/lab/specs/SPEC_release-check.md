<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: release-check — deterministic release-readiness gate
> **Status:** approved
> **Author:** Claude (agent-drafted, `[inferred]`) · **Date:** 2026-07-02

## Goal
When a maintainer cuts a new version tag/release, a deterministic script verifies
that everything that changed since the *last* release is actually accounted for —
versions synchronized across every file that states one, a dated changelog section
present, the CLI surface fully documented, and changed areas cross-checked against
the release notes. This extends the kit's "mechanically honest" philosophy
(`verify` / `drift`) to the release process itself, and would have caught the real
drift found on 2026-07-02 (docs still claiming `KIT_VERSION "0.1.0"` two releases
later).

## Scope
**In:**
- `test/release-check.mjs` — zero-dependency Node script (matches the existing
  Node-only tooling in `test/`), runnable as `npm run release-check`.
- Two modes: **pre-tag** (local, default: checks against the version in
  `package.json`) and **tag mode** (CI: checks against the pushed tag, via
  `GITHUB_REF` or `--tag vX.Y.Z`).
- `.github/workflows/release-check.yml` — runs on `push: tags: v*` and
  `workflow_dispatch`; runs the script plus the existing gates
  (`npm test`, `node install.mjs verify . --strict`).
- `docs/RELEASE-CHECKLIST.md` — wire in as step 0 ("run `npm run release-check`").
- `CHANGELOG.md` — entry under `[Unreleased]`.

**Out (explicitly):**
- No Python mirror — this is repo-maintainer tooling, not shipped kit
  functionality (the dual-runtime guarantee covers `install.mjs`/`install.py`;
  `test/` is already Node-only).
- Not part of the `install.mjs` CLI and not stamped into target repos.
- No third-party GitHub Actions (zero-dependency ethos).
- No claim of *semantic* changelog completeness — the coverage check is a
  keyword heuristic whose findings are printed for human judgement, same trust
  model as the audit.

## The checks
| # | Check | Pre-tag mode | Tag mode |
|---|---|---|---|
| 1 | **version-sync** — `package.json` = `KIT_VERSION` in `lib/util.mjs` = `lib/util.py` = `CITATION.cff` = `.zenodo.json` (= tag) | hard fail | hard fail |
| 2 | **changelog-gate** — `## [X.Y.Z]` section exists with a date; version link ref present; `[Unreleased]` emptied | section may be absent while unreleased; `[Unreleased]` must exist | hard fail |
| 3 | **coverage report** — `git diff --name-only <lastTag>..HEAD` grouped by top-level area; areas with source changes keyword-matched against the changelog section | informational | informational |
| 4 | **cli-docs-sync** — commands and flags parsed from `install.mjs`'s own argv parser must each be mentioned in `docs/CLI-REFERENCE.md` and the usage help | hard fail | hard fail |
| 5 | **existing gates** — `npm test`, `verify --strict` | via `--full` flag | separate workflow steps |

Degradations are graceful and stated: no git / no previous tag ⇒ check 3 is
skipped with an explicit "skipped" line, never silently.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change | Stability note |
|---|---|---|---|
| tests/tooling | `test/release-check.mjs` | add | `test/` row is `ours` but `[inferred]` — **human OK required** |
| tests | `test/run-tests.mjs` | add scenarios (fixture repos exercising failure modes) | same row |
| root | `package.json` | add `"release-check"` script | `[verified]` ours |
| CI | `.github/workflows/release-check.yml` | add | repo `.github/` not a mapped code row |
| docs | `docs/RELEASE-CHECKLIST.md` | insert step 0 | `[verified]` ours |
| root | `CHANGELOG.md` | `[Unreleased]` entry | ours |
| knowledge | `ai/guide/FEATURE_MAP.md`, `ai/analysis/FEATURE_CATALOG.md`, `ai/guide/MODULE_MAP.md` (test/ responsibility line) | amend, all `[inferred]` | per provenance rules |

## Acceptance criteria
1. `npm run release-check` on the current repo passes version-sync (all five
   files agree on `0.1.2`) and prints the coverage report since the last tag.
2. Desynchronizing any one version source (e.g. bumping only `package.json`)
   makes the script exit 1 and name every out-of-sync file.
3. Removing any command or flag mention from `docs/CLI-REFERENCE.md` makes
   cli-docs-sync exit 1 naming the missing token.
4. Tag mode (`--tag v9.9.9`) with no `## [9.9.9]` changelog section exits 1.
5. A changed `lib/` file since the last tag with no matching changelog keyword
   appears in the coverage report as a warning (exit 0 — human judges).
6. The workflow file triggers on `v*` tag pushes and fails the run when the
   script fails.

## Verification
- Tests to add: fixture-repo scenarios in `test/run-tests.mjs` covering criteria
  2–4 (temp directory with minimal `package.json`/`lib/util.*`/`CHANGELOG.md`,
  script invoked with an explicit target root).
- Suites to run: `npm test` (full), then `node install.mjs verify . --strict`.
- Stability check: no `frozen` files modified; `test/` + `lib/`-adjacent rows are
  `[inferred]` — human approval to be recorded below before implementation.

**Human approval:** granted by the maintainer in-session on 2026-07-02 — scope:
add files under `test/` (whose MODULE_MAP row is `[inferred]`) and read (not
edit) `lib/util.mjs` / `lib/util.py`.

## Knowledge update on completion
- [ ] FEATURE_MAP.md entry added/updated
- [ ] FEATURE_CATALOG.md amended
- [ ] MODULE_MAP.md `test/` responsibility line still accurate (extend to mention the release gate)

## Sequencing note
Docs PR [#7](https://github.com/kunalsuri/ai-fication-kit/pull/7) must merge
first (user decision, 2026-07-02). This feature is then pushed on the restarted
designated branch as its own PR — its commits are held locally until #7 merges
so they don't enter the docs PR.
