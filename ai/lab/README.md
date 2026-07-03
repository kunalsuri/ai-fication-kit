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
`lessons-learnt/2026-07-03-knowledge-kinds-memory-context-harness.md` for the full
rationale.

| Folder | Contains | Who writes it |
|---|---|---|
| `specs/` | One spec per planned/in-progress feature | Human + AI draft |
| `decisions/` | Architecture Decision Records (ADRs) | Human |
| `evaluations/` | Post-implementation retrospectives | Human |
| `experiments/` | AI-agent approach trials: prompts, configs, outcomes | Human + AI |
| `lessons-learnt/` | Recurring design questions about the `ai/` layer, answered once (one dated file per lesson) | Human + AI |

## Lifecycle of a feature
```
1. Plan      →  specs/SPEC_<name>.md          (copy SPEC_TEMPLATE.md)
2. Decide    →  decisions/ADR_<n>-<title>.md  (any non-obvious design choice)
3. Implement →  /add-feature — the agent reads the spec
4. Evaluate  →  evaluations/EVAL_<name>.md    (after the feature ships)
5. Learn     →  experiments/EXP_<n>-<desc>.md (if the AI approach was novel or failed)
6. Archive   →  mark spec implemented; entry lands in ai/analysis/FEATURE_CATALOG.md
```
