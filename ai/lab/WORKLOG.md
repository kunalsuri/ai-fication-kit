<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Work ledger — ai-fication-kit

The repo's **episodic memory of work**: one row per unit of work (feature added,
bug fixed, refactor, process change), linking the spec that authorized it, the
decisions behind it, the review that checked it, the evaluation that scored it,
and the commits that shipped it. The maps in `ai/guide/` say what the repo *is*;
this ledger says *what was done to it, when, and under which contract*.

## Rules

- **Append-only.** New work gets a new row with the next `W-<n>` ID. Never delete
  or renumber rows; a rolled-back change gets Status `rolled-back`, not removal.
- **One row per unit of work** — the same unit the spec describes. A row without
  a spec link is a process violation, not a shortcut.
- **Backtick every artifact path, written from the repo root** (e.g.
  ai/lab/specs/SPEC_x.md, backticked). `verify` checks backticked paths against
  the file tree, so a row whose artifacts vanished fails CI instead of rotting
  silently. Use `—` for artifacts that genuinely don't apply (e.g. no ADR was
  needed).
- **Agents append rows tagged `[inferred]`** like everything else in `ai/`;
  the human flips them to `[verified]` when auditing. Never flip it yourself.
- **Status vocabulary:** `specced` → `in-progress` → `in-review` → `shipped`
  (or `rolled-back` / `dropped`).
- **Type vocabulary:** `feature` · `bugfix` · `refactor` · `docs` · `process`.

## Ledger

<!-- Example row (copy, replace the angle-bracket fields, backtick real paths
     written from the repo root):
| W-001 | 2026-01-15 | feature | Short title | ai/lab/specs/SPEC_<name>.md | ai/lab/decisions/ADR_<n>-<t>.md | ai/lab/reviews/REVIEW_W-001.md | ai/lab/evaluations/EVAL_<name>.md | <commit/PR> | FEATURE_MAP row | shipped | [inferred] |
-->

| ID | Date | Type | Title | Spec | ADRs | Review | Eval | Commits / PR | Knowledge updated | Status | Provenance |
|---|---|---|---|---|---|---|---|---|---|---|---|
| W-001 | 2026-07-03 | process | Engineering loop: fix-bug + review-change workflows, work ledger, verify coverage | `ai/lab/specs/SPEC_engineering-loop.md` | — | — | — | (this branch) | `ai/lab/README.md`, `ai/INDEX.md` | in-review | [inferred] |
