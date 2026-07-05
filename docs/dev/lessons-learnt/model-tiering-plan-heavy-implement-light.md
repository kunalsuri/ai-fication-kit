<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Model Tiering: Plan with a Heavy Model, Implement with a Light One

## Metadata

| Field | Value |
|---|---|
| **Timestamp** | 2026-07-03T00:00:00+02:00 |
| **Category** | Development Workflow / Token Economy / Model Tiering |

This document records the pattern adopted for developing the kit itself: use a
heavy reasoning model (Claude Fable / Opus class) for the expensive thinking, and a
lighter coding model (Claude Sonnet class) for the routine implementation — reducing
both token waste and inconsistent code.

## Context

While planning features for upcoming releases, the feature backlog was deliberately
authored twice. A first draft was a plain idea list; it was then rewritten by the
heavy model into an implementation-ready spec sheet —
[ai/lab/ROADMAP.md](../../../ai/lab/ROADMAP.md) — designed so a lighter
model can implement each feature in a later, separate session without re-deriving
project context.

## 1. Why split planning from implementation

- **Token economy.** Exploration is the expensive part: surveying the codebase,
  weighing alternatives, spotting traps. Doing that once with a heavy model and
  freezing the result into a spec means the implementing model starts warm — it
  reads one file instead of re-crawling the repo every session.
- **Failure-mode fit.** Light models rarely write *bad* code; they make
  *plausible-but-inconsistent decisions* when a task leaves room for judgement.
  Specs that pre-make every decision (files to touch, invariants, acceptance
  criteria, explicit out-of-scope lines) remove exactly that room.
- **Reviewability.** A human can audit a spec in minutes; auditing an unplanned
  implementation costs far more. The spec is the cheap checkpoint between the two
  model tiers.

## 2. What the spec sheet must contain (the pattern)

Learned while writing the feature backlog (now `ai/lab/ROADMAP.md`); reusable for any repo:

1. **An implementer protocol** — numbered steps the light model follows, including
   "implement only the one feature the human names" and a stop-and-ask escape
   hatch when spec and code conflict (prevents improvisation).
2. **A shared engineering contract** — the repo's invariants stated once
   (here: stdlib-only, no-execution/no-network, determinism, provenance,
   manifest-tracked writes), instead of vaguely per feature.
3. **A tracking table** the implementer updates itself — priority, effort,
   dependencies, status, implemented checkbox, dates, commit reference — so
   progress lives in the repo, not in anyone's chat history.
4. **Per-feature blocks:** Context · Behavior · Touchpoints (real file paths,
   read-before-writing) · Acceptance criteria · Out of scope.
5. **Named traps.** The heavy model's most valuable output is the non-obvious
   landmine, written where it will be tripped (e.g. `examples/` missing from the
   npm `files` allowlist would silently break a `demo` command under `npx`;
   `file://` fetch being browser-blocked forces inlined data in a generated page).
6. **Honest scoping.** Anything too large for a light model is *parked* with an
   explicit "do not implement from this paragraph — needs its own spec" marker,
   rather than left as an invitation to guess.

## 3. Relation to the kit's own method

This is the kit's philosophy applied to its own development: expensive
understanding is captured once into a trusted, human-reviewed document, and cheaper
executors work from that map instead of re-reading the world. The `ai/` knowledge
layer does it for agents working *on a target repo*; the spec sheet does it for
models working *on the kit*. Same economics, one level up.

## 4. Operating rules going forward

- Heavy model: codebase review, feature triage, spec writing, trap hunting.
- Light model: one feature per session, from the spec, on its own branch, updating
  the tracking table row when done.
- Human: names the feature to build, reviews the diff, stays the only one who
  flips `[inferred]` → `[verified]`.
