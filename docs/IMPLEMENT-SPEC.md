<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# /implement-spec — spec-faithful implementation for the engineering loop

`/implement-spec <path-to-spec>` drives an AI coding agent through the
**Implement → Review → Record** stages of the
[engineering loop](METHODOLOGY.md#7-the-engineering-loop--the-steady-state-after-the-map-is-trusted),
taking a finished spec from `ai/lab/specs/` as its single source of truth.
(The loop's **Evaluate** stage — the human's post-ship `ai/lab/evaluations/EVAL_*.md`
retrospective on how the work went — deliberately stays outside the command:
the implementer does not grade its own performance.) It is
the executable counterpart of the loop's front half (Spec → Decide): the heavy
thinking is already frozen in the spec, so the command's job is *faithful
translation into code* — and loud, early reporting the moment translation is
impossible.

```
/implement-spec ai/lab/specs/SPEC_mcp-kb-server.md
```

## Why it exists — the model-tiering pattern

The command codifies the pattern recorded in
[dev/lessons-learnt/model-tiering-plan-heavy-implement-light.md](dev/lessons-learnt/model-tiering-plan-heavy-implement-light.md):
plan with a heavy reasoning model, implement with a lighter one. Light models
rarely write *bad* code; they make **plausible-but-inconsistent decisions when a
task leaves room for judgement**. An implementation-grade spec removes that room
— and `/implement-spec` removes the remaining ways an implementer can drift:
context sprawl, silent improvisation, scope creep, untested "done", and
self-approved work.

Escalation guidance: run it with a Sonnet-class model by default. Switch to an
Opus-class model only when the same spec conflict or the same failing test
survives two honest attempts — that pattern means judgement, not diligence, is
the bottleneck.

## The protocol (what the command enforces, in order)

| Step | Enforces | Loop stage |
|---|---|---|
| **0. Load context** | Read the whole spec + its rationale doc + `MODULE_MAP.md` + `CONVENTIONS.md`; nothing else. No tree-crawling. | Spec |
| **1. Pre-flight** | Baseline `npm test` and `verify --strict` green; touch-list files exist; none `frozen`/`?`. | — |
| **2. Prime rule: stop-and-report** | Any spec-vs-reality conflict halts with section + file:line evidence and the smallest unblocking question. Never the "obvious interpretation", never a workaround. Specs are `[inferred]`: mostly right, wrong in confident-sounding places. | Decide (guarded) |
| **3. Implement** | Touch only the spec's touch list; skeletons and export names are contractual; license headers; no new dependencies; no drive-by changes. | Implement |
| **4. Verify** | The spec's *entire* test plan implemented; suites green with real output pasted; acceptance criteria scored one by one. Tests are the definition of done — part of Implement, not a separate loop stage. | Implement |
| **5. Review gate** | `/review-change` requested on the diff in a **fresh context** — the implementer never approves its own work. | Review |
| **6. Knowledge updates** | The spec's completion checklist executed; every new entry `[inferred]`; never self-flip to `[verified]`; `WORKLOG.md` row links spec ↔ review ↔ commits (paths mechanically checked by `verify`). | Record |
| **7. Final report** | Scorecard, verbatim test output, deviations (expected count: zero), files-changed vs touch list, review status. | — |

The loop's **Evaluate** stage (`ai/lab/evaluations/EVAL_*.md` — what the agent
did well/poorly, audit cost, what to change next time) happens after merge and
belongs to the human; the `WORKLOG.md` row from step 6 links to it once it
exists.

## What makes a spec "implementation-grade"

`/implement-spec` assumes the spec already answers every question an
implementer could ask. The bar, learned from
`ai/lab/specs/SPEC_mcp-kb-server.md` (the first spec written to it):

- **Hard constraints stated as a table** the reviewer can diff against.
- **Exact interfaces** — wire formats, schemas, function signatures, payload
  shapes with examples.
- **Known pitfalls named in place** (e.g. a helper that does *not* return the
  column you need), so the implementer doesn't rediscover them.
- **A numbered, executable test plan** — the definition of done is mechanical,
  not rhetorical.
- **An explicit out-of-scope list**, so restraint needs no judgement.
- **A complete touch list**, including the knowledge-layer files the Record
  step will edit.

A spec below this bar still works — the stop-and-report rule catches the gaps —
but every gap becomes a round-trip to the human. Specs are cheap to harden
*before* implementation: run them through an adversarial review (spec-vs-code
and spec-vs-protocol) first.

## Where it lives

Kit-repo dogfood for now: `.claude/commands/implement-spec.md` (Claude Code)
and `.agents/workflows/implement-spec.md` (Antigravity / tool-agnostic).
Promoting it into `templates/` — so every kit-installed repo receives it in all
four tool formats alongside `/add-feature` and `/fix-bug` — is a deliberate,
separate product decision for the maintainer.

## Relationship to the other commands

- `/add-feature` — use when the work *starts from an idea*: it drafts the spec
  first, then implements. `/implement-spec` is the second half alone, for specs
  authored and hardened separately (typically by a heavier model or a human).
- `/fix-bug` — reproduction-first defect workflow; same loop, different entry.
- `/review-change` — invoked *by* step 5; also usable standalone.
- `/check-drift` — the steady-state health check the loop's Record step keeps
  honest.
