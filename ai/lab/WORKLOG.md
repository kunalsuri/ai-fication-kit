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
     written from the repo root). The example ID W-000 is reserved for this
     comment — real rows start at W-001:
| W-000 | 2026-01-15 | feature | Short title | ai/lab/specs/SPEC_<name>.md | ai/lab/decisions/ADR_<n>-<t>.md | ai/lab/reviews/REVIEW_W-000.md | ai/lab/evaluations/EVAL_<name>.md | <commit/PR> | FEATURE_MAP row | shipped | [inferred] |
-->

| ID | Date | Type | Title | Spec | ADRs | Review | Eval | Commits / PR | Knowledge updated | Status | Provenance |
|---|---|---|---|---|---|---|---|---|---|---|---|
| W-001 | 2026-07-03 | process | Engineering loop: fix-bug + review-change workflows, work ledger, verify coverage | `ai/lab/specs/SPEC_engineering-loop.md` | — | — (waived: this work shipped the review process itself, so no fresh-context review existed to run — recorded per AUD-R3-08) | — | PR #23, merge bafa3d0 | `ai/lab/README.md`, `ai/INDEX.md` | shipped | [inferred] |
| W-002 | 2026-07-04 | bugfix | Fix audit R3 defects AUD-R3-01..11 + AUD-R2-11 (fail-first regression tests, 365/365) | `ai/lab/specs/BUGFIX_audit-R3-fixes.md` | — | `ai/lab/reviews/REVIEW_W-002.md` (approve) + Copilot PR #26 review (2 comments, addressed in 825b00f) | — | 206e24e, 2b5d0b6, 825b00f (branch claude/deep-codebase-audit-zmd328, PR #26) | `ai/analysis/audit-reports/DEFECT_TRACEABILITY.md` rows flipped; `ai/guide/MODULE_MAP.md` baseline re-anchored to 825b00f; `ai/guide/FEATURE_MAP.md` gotchas added for orient/indepth/install/audit + stale ci-checks fix (8ca033a, review addendum approve) | shipped | [inferred] |
| W-003 | 2026-07-04 | docs | MCP KB server spec authored and hardened (freshness model, 3 adversarial audit rounds) | `ai/lab/specs/SPEC_mcp-kb-server.md` | — | — (spec-stage work; hardened via `ai/analysis/audit-reports/ADVERSARIAL_AUDIT_2026-07-04_R3.md`) | — | PR #27 + spec-fix commits in PR #28 | — | specced | [inferred] |
| W-004 | 2026-07-04 | process | /implement-spec command + engineering-loop docs (kit-repo dogfood only; promotion into templates/ deferred — maintainer's product decision, see `docs/IMPLEMENT-SPEC.md`) | — (no spec — process gap found by the 2026-07-04 loop audit, recorded not retrofitted) | — | — (merged without fresh-context review — same audit finding) | — | PR #28 | `docs/IMPLEMENT-SPEC.md`, README engineering-loop section, `docs/METHODOLOGY.md` §7 | shipped | [inferred] |
| W-005 | 2026-07-04 | process | Engineering-loop audit + sync: ledger brought current, one canonical loop definition, always-on Record rule, add-feature WORKLOG lookup | `ai/lab/specs/SPEC_engineering-loop-sync.md` | — | — (review pending: /review-change in a fresh session) | — | branch claude/engineering-loop-audit-cmwfbd | `ai/lab/README.md`, `docs/METHODOLOGY.md`, `docs/GLOSSARY.md`, CLAUDE.md/AGENTS.md + template twins | in-progress | [inferred] |
| W-006 | 2026-07-04 | feature | Close the 2026-07-04 online template re-audit: native `.claude/rules/` for Claude Code (always-on `ai-knowledge-layer.md` twin of the Cursor rule + path-scoped `provenance.md` `ai/**` guard), auto-memory clarifier, README context/harness/loop framing | `ai/lab/specs/SPEC_claude-rules-parity.md` | — | — (review pending: /review-change in a fresh session) | — | branch claude/docs-templates-review-e3kzn3 | `templates/claude/rules/ai-knowledge-layer.md`, `templates/claude/rules/provenance.md`, `.claude/rules/ai-knowledge-layer.md`, `.claude/rules/provenance.md`, `CLAUDE.md`, `AGENTS.md`, `test/run-tests.mjs`, `templates/README.md`, `README.md`, `docs/MULTI-TOOL-SETUP.md`, `CHECKSUMS.txt`, `ai/install-manifest.json` | in-review | [inferred] |
| W-007 | 2026-07-05 | process | Commands & skills overlap audit (strict-judge pass over all 11 commands + 5 skill copies across 4 integrations): 6 findings — P1 `/check-drift` target-repo defect, P1 command/skill double registration, doc + Step-0 drift — nothing removable outright | — (audit, not a change; findings report is the deliverable) | — | — | — | PR #31 (branch claude/commands-skills-audit-81oda2) | `ai/analysis/audit-reports/2026-07-05-commands-skills-audit.md` | in-review | [inferred] |
| W-008 | 2026-07-05 | process | SPEC_TEMPLATE rewritten to the implementation-grade shape proven by the MCP KB spec (hard-constraints table, glossary-with-pitfalls, exact-behaviour section, Stability column in touch list, numbered test plan, definition-of-done) with scale-down guidance so small features stay lightweight; groundwork for the /write-spec → /implement-spec loop | — (template change; the consolidation spec will follow) | — | — | — | PR #31 (branch claude/commands-skills-audit-81oda2) | `templates/ai/lab/specs/SPEC_TEMPLATE.md`, `ai/lab/specs/SPEC_TEMPLATE.md` | in-review | [inferred] |
| W-009 | 2026-07-05 | docs | README + docs staleness sync: the workflow-command roster lagged the code (10 universal commands now, not 8 — `/fix-bug` and `/review-change` were missing) and only the `add-feature` skill was named where `fix-bug` also ships; `docs/README.md` hub said "all 8" CLI commands vs 12 in `docs/CLI-REFERENCE.md`; README "What You Get" tree was missing `ai/START-HERE.html`, `ai/lab/reviews/`, and `ai/lab/WORKLOG.md`; the `docs/reports/technical-report-draft.md` academic draft had zero coverage of the engineering loop — bumped to revision v6 (10-command roster, `fix-bug` skill, work ledger, new §9.5 on the loop + kit-only `/implement-spec`) | — (surgical doc drift fix, no code change) | — | — | — | branch claude/update-readme-docs-7glmi7 | `README.md`, `docs/README.md`, `docs/FAQ.md`, `docs/reports/technical-report-draft.md` | in-review | [inferred] |
| W-010 | 2026-07-05 | feature | New LOCAL-ONLY `/check-docs` command: a maintainer doc-drift audit that checks the README + docs/ against the real command/skill/CLI roster (source of truth: `templates/` + `install.mjs`), the stamped `ai/` tree, cross-doc count consistency, and backtick path-claims — read-only findings report, no auto-edits. Grew out of the W-009 session's staleness. Kept out of `templates/` (never distributed), following the `/implement-spec` precedent; made the mechanism explicit in `.claude/LOCAL-ONLY-COMMANDS.md` | — (small kit-local command; the LOCAL-ONLY-COMMANDS.md note is the design record) | — | — (review pending: /review-change in a fresh session) | — | branch claude/update-readme-docs-7glmi7 | `.claude/commands/check-docs.md`, `.claude/LOCAL-ONLY-COMMANDS.md` | in-review | [inferred] |
