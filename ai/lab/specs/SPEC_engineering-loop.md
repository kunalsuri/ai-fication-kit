<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: The engineering loop — steady-state AI-powered development
> **Status:** implemented
> **Author:** agent draft `[inferred]` (from the maintainer's direction: enforce
> spec-, review-, and evaluation-driven development with a persistent memory of
> every unit of work) · **Date:** 2026-07-03

## Goal
Once a repo is AI-native (cold-start done, maps audited), the kit's method must
cover the *steady state*: every feature added and every bug fixed runs a
closed loop — Spec → Decide → Implement → Review → Evaluate → Record — and
leaves a durable trace. Today the method ends at `/add-feature`: there is no
bug-fixing workflow, no review gate, and no single map of what was done. This
spec closes those three gaps.

## Scope
**In:**
- `ai/lab/WORKLOG.md` — append-only work ledger (the repo's episodic memory of
  work), one row per unit of work, artifact links checked by `verify`.
- `ai/lab/reviews/` + REVIEW_TEMPLATE.md — structured, evidence-based reviews.
- BUGFIX_TEMPLATE.md — reproduction-first bug specs in `ai/lab/specs/`.
- `/fix-bug` workflow (skill + command/workflow/prompt/rule in all four tool
  integrations) — regression-test-first bug fixing.
- `/review-change` workflow (all four tool integrations) — fresh-context review.
- `/add-feature` gains the Review and Record steps.
- `verify` scans `ai/lab/WORKLOG.md` so ledger links are mechanically honest.

**Out (explicitly):** LLM calls in the CLI; auto-approval of reviews (the human
merge decision stays the real gate); retrofitting ledger rows for past work;
monorepo concerns (SPEC A4).

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| templates | `templates/ai/lab/` | add WORKLOG.md.tmpl, reviews/REVIEW_TEMPLATE.md, specs/BUGFIX_TEMPLATE.md |
| templates | `templates/claude/`, `templates/agents/`, `templates/github/prompts/`, `templates/cursor/rules/` | add fix-bug + review-change assets |
| templates | `templates/ai/INDEX.md.tmpl`, `templates/ai/lab/README.md.tmpl`, `templates/github/copilot-instructions.md` | register the new pieces |
| CLI | `lib/verify.mjs` | scan `ai/lab/WORKLOG.md` as a claim source |
| docs | `docs/METHODOLOGY.md`, `docs/MULTI-TOOL-SETUP.md`, `docs/CLI-REFERENCE.md` | document the loop and the new commands |
| tests | `test/run-tests.mjs` | stamped-file assertions + broken-ledger-link test |
| dogfood | `ai/lab/`, `.claude/`, `.agents/`, `.github/`, `.cursor/` | live copies of everything above |

## Acceptance criteria
1. A fresh install stamps WORKLOG.md, the reviews/ template, BUGFIX_TEMPLATE.md,
   and the fix-bug/review-change assets for all four tools.
2. `verify --strict` fails when a WORKLOG row links to a nonexistent artifact,
   and passes on a freshly stamped repo.
3. `/add-feature`, `/fix-bug`, and `/review-change` describe the same loop and
   all end in a WORKLOG row.
4. Existing tests pass unchanged; no CLI flag or exit-code behavior shifts.

## Verification
- Tests to add: `test/run-tests.mjs` — stamped-file list extension; WORKLOG
  claim-scan test (clean pass, broken link fails `--strict`).
- Suites to run: `npm test` · `node install.mjs verify . --strict`
- Stability check: no `frozen` files modified.

## Knowledge update on completion
- [x] WORKLOG.md row W-001 appended
- [x] `ai/INDEX.md` + `ai/lab/README.md` rows added
- [ ] FEATURE_MAP.md entry (kit-repo maps are maintainer-audited; human to place)
