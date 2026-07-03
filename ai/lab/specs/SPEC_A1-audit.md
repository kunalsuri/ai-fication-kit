<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: `audit` — guided human audit (the human's signature, assisted)
> **Status:** implemented
> **Author:** Sonnet (implementing agent) · **Date:** 2026-07-03
> **Verification:** `npm test` (272/272), `node install.mjs verify . --strict`,
> `node install.mjs drift . --strict`, `npm run release-check` — all green.
> The interactive loop itself cannot be driven end-to-end in this sandbox (no
> TTY allocator, zero-dependency constraint rules out adding one), so the CLI
> refusal path is tested via spawn and every deterministic building block
> (evidence, row rewrite, edit application, backup+write) is unit-tested
> directly. The glue code between them (`audit()`'s interactive loop) is a
> thin, manually-reviewed call sequence over those tested primitives.

## Goal
The audit — flipping `[inferred]` MODULE_MAP rows to `[verified]` — is fully
manual today and is the method's bottleneck. `node install.mjs audit <path>`
does the drudgery (walking rows, gathering deterministic evidence) but the
**human makes every judgement**: this command never writes `[verified]`
without an explicit, per-row, interactive confirmation. That confirmation IS
the human's signature; the tool only assists.

## Scope
**In:** interactive-only per-row audit loop over `ai/guide/MODULE_MAP.md`;
deterministic evidence (file count, 3 largest, 3 newest files — fs stat only);
optional `--git` evidence (last commit touching the row's directory, local
read-only git); Stability selection; a single timestamped backup before the
first write; `--dry-run`.
**Out (explicitly):** auditing anything but `MODULE_MAP.md`; editing
Responsibility text; any batch/non-interactive verify mode (refused by
design — automation must never manufacture a human signature).

## Behavior
- No TTY, or `--yes` passed: refuse immediately with a friendly message
  ("audit is a human activity") and exit 0. Writes nothing. Unlike every
  other command, `--yes` does **not** unlock automation here — that would
  defeat the point of a human signature.
- Per `[verified]`/`[inferred]`/unknown MODULE_MAP row with a Status column:
  print the row's label, current Stability/Status, and evidence, then ask
  (1) whether to audit this row now — declining leaves it byte-identical;
  (2) if yes, choose a Stability (`frozen`/`stable`/`ours`); (3) a final
  confirm before writing — declining at either step skips the row untouched.
- On confirm: rewrites the row's Stability and Status cells in place (no line
  insertion/deletion, so line numbers stay valid across the whole run); the
  Status cell becomes `[verified] (DD/MM/YYYY HH:mm)`.
- Rows with no Status column (4-column scaffolded layout) are reported and
  skipped — nothing to flip yet; run `/cold-start` first.
- Before the *first* actual write, takes one timestamped backup of
  `MODULE_MAP.md` next to it (`lib/util.mjs`'s `backupName`, matching the
  `_bkp_` convention `lib/installer.mjs` already uses).
- `--dry-run`: runs the same interactive walk and prints the would-be new row
  text, but takes no backup and writes nothing.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| backend | `lib/drift.mjs` | export `DRIFT_IGNORED_DIRS` (evidence walk reuses it) |
| backend | `lib/audit.mjs` | new — evidence collection, interactive loop, row rewrite |
| backend | `install.mjs` | add `audit` to `COMMANDS`, dispatch branch, usage text |
| docs | `docs/AUDIT-GUIDE.md` | one-line pointer to the `audit` command (surgical) |
| docs | `docs/CLI-REFERENCE.md` | command index row + `audit` section |
| docs | `CHANGELOG.md` | `[Unreleased]` entry |
| tests | `test/run-tests.mjs` | non-TTY/`--yes` refusal; scripted-stdin confirm/skip flows; backup; `--dry-run` |

## Acceptance criteria
1. Non-TTY run (the test harness's default) and `--yes` both refuse with the
   friendly message, exit 0, and write nothing.
2. Skipped rows are byte-identical after the run.
3. A confirmed row carries the `[verified] (DD/MM/YYYY HH:mm)` tag and the
   chosen Stability; a single `MODULE_MAP_bkp_<timestamp>.md` backup exists
   with the pre-audit content.
4. `--dry-run` writes nothing (no backup, no edited file) even when rows are
   confirmed in the walk.
5. The rewritten table still parses: `verify`/`drift` run cleanly against it.

## Verification
- Tests to add: `test/run-tests.mjs` — feed scripted answers via stdin to
  drive the interactive prompts (matches the pattern any existing wizard test
  would use); assert file content and backup afterward.
- Suites to run: `npm test`, `node install.mjs verify . --strict`,
  `node install.mjs drift . --strict`, `npm run release-check`.
- Stability check: only `ours`-stability files touched. No `frozen` files modified.

## Knowledge update on completion
- [x] FEATURE_MAP.md entry added
- [x] MODULE_MAP.md rows still accurate (no new directories)
- [ ] FEATURE_CATALOG.md regenerated — deferred to `/create-feature-catalog`
