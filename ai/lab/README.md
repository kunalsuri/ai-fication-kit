<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# ai/lab/ — development intelligence for ai-fication-kit

The strategic layer: *how* we build and *what we learned* — not code, not navigation.
Loaded when planning or reviewing, not on every agent session.

## Why this folder matters `[inferred]`

`ai/lab/` holds the only knowledge in `ai/` that **cannot be regenerated**. The maps
(`ai/guide/`) and analyses (`ai/analysis/`) describe *what the repo is* — if they were
lost, `/cold-start` could rebuild them from the code and a human would re-verify.
`lab/` records *why the repo is the way it is and what was learned building it*:
decisions, trade-offs, failed approaches, retrospectives, and resolved design
questions. No amount of re-crawling the code recovers a *reason* — if this folder is
lost, that knowledge is gone forever.

This is also what agents need to work safely: the maps tell an agent *where* code is;
`lab/` tells it which "weird" code is deliberate and must not be "fixed", and which
plans are current. Without `lab/`, the `ai/` layer is a navigation tool; with it, it
is a knowledge base. In memory terms: `guide/` is the repo's semantic memory (facts),
`lab/` is its episodic memory (experience) — see
[docs/dev/lessons-learnt/knowledge-kinds-memory-context-and-harness.md](../../docs/dev/lessons-learnt/knowledge-kinds-memory-context-and-harness.md)
for the full rationale.

| Folder | Contains | Who writes it |
|---|---|---|
| `specs/` | One spec per planned/in-progress feature or bug fix | Human + AI draft |
| `decisions/` | Architecture Decision Records (ADRs) | Human |
| `reviews/` | Evidence-based change reviews, one per unit of work | AI (fresh session) + human |
| `evaluations/` | Post-implementation retrospectives | Human |
| `experiments/` | AI-agent approach trials: prompts, configs, outcomes | Human + AI |
| `WORKLOG.md` | The work ledger — one row per unit of work, linking all of the above | AI appends, human audits |

In the memory framing above: `WORKLOG.md` is the episodic *index* — the
timeline that makes the episodes findable and citable (`W-<n>`).

## The engineering loop — every unit of work (feature or bug) `[inferred]`
```
1. Spec      →  specs/SPEC_<name>.md            (feature — copy SPEC_TEMPLATE.md)
                specs/BUGFIX_<name>.md          (bug — copy BUGFIX_TEMPLATE.md)
2. Decide    →  decisions/ADR_<n>-<title>.md    (any non-obvious design choice)
3. Implement →  /add-feature or /fix-bug — the agent reads the spec
                (/implement-spec drives a pre-authored spec through steps 3–6)
4. Review    →  reviews/REVIEW_<id>.md via /review-change (fresh context,
                never the implementing session)
5. Evaluate  →  evaluations/EVAL_<name>.md      (human, after the work ships —
                copy EVALUATION_TEMPLATE.md)
6. Record    →  WORKLOG.md row linking spec ↔ review ↔ eval ↔ commits
7. Learn     →  experiments/EXP_<n>-<desc>.md   (optional — if the AI approach
                was novel or failed)
8. Archive   →  (optional) mark spec implemented; entry lands in
                ai/analysis/FEATURE_CATALOG.md
```
Steps 1–6 are the canonical loop — Spec → Decide → Implement → Review →
Evaluate → Record, as defined in `docs/METHODOLOGY.md` §7; steps 7–8 are
optional follow-ups. No code before step 1, no merge before step 4, no closed
row before step 6.
`verify` checks every backticked path in WORKLOG.md, so the ledger cannot
silently rot.
