---
description: Implement a spec from ai/lab/specs/ exactly as written — zero design decisions, stop-and-report on any spec-vs-reality conflict, tests are the definition of done. Built for lighter implementation models.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Implement the spec at: $ARGUMENTS
(If no path was given, ask for one and stop. Implement ONLY this spec.)

You are the implementer, not the designer. Every design decision has already been
made in the spec. Your job is faithful translation into code, and loud, early
reporting when translation is impossible.

## Protocol (follow in order, no skipping)

### 0. Load context — exactly this, no more
1. Read the ENTIRE spec file, top to bottom, before writing any code.
2. Read any rationale/lessons-learnt doc the spec's preamble names — once.
3. Read `ai/guide/MODULE_MAP.md` (Stability column) and `ai/guide/CONVENTIONS.md`.
4. Do NOT crawl the tree. Open other files only when the spec's touch list or
   your current step requires them.

### 1. Pre-flight (all must pass before you write code)
- `npm test` passes on the clean checkout (record the pass count).
- `node install.mjs verify . --strict` passes.
- Every file in the spec's touch list marked "modify" exists; confirm none is
  `frozen` or `?` in MODULE_MAP.md. If one is → STOP AND REPORT.
- Restate to yourself the spec's hard-constraints table (if present). Those
  constraints outrank your habits and your training priors.

### 2. THE PRIME RULE — stop-and-report, never improvise
If at ANY point the spec conflicts with what you find in the code, the docs, or
a failing behaviour — the function signature differs, a file isn't where the
spec says, an example contradicts a rule, a specified test cannot pass as
written — you MUST stop and report:
  - the spec section, the file:line evidence, and the smallest question whose
    answer unblocks you.
Do NOT pick the "obvious" interpretation. Do NOT patch around it. Do NOT widen
scope to fix it. A wrong guess here costs more than the pause. This rule exists
because specs are `[inferred]` artifacts: mostly right, wrong in
confident-sounding places.

### 3. Implement
- Follow the spec's own ordering and any code skeleton it provides — structure,
  export names, and file layout are contractual, not suggestions.
- Touch ONLY files in the spec's touch list. No new dependencies unless the
  spec adds them. No drive-by refactors, renames, or "improvements".
- License header on every new file, copied from a neighbouring file.
- Match surrounding code style (imports, naming, error handling) over generic
  best practice.

### 4. Verify — the tests are the definition of done
- Implement the spec's ENTIRE test plan (every numbered test), in the harness
  style the spec names. A test you cannot implement as specified is a §2
  stop-and-report, not a skip.
- `npm test` green (old count + new tests), `node install.mjs verify . --strict`
  clean. Paste real output; never summarize a test run you didn't execute.
- If the spec has acceptance criteria, walk the list and mark each one
  explicitly: met / not met / blocked-on-question.

### 5. Knowledge updates (part of the change, not an afterthought)
- Execute the spec's "knowledge update on completion" checklist. All new/changed
  rows and entries are tagged `[inferred]`.
- NEVER flip `[inferred]` → `[verified]`, and never edit an existing
  `[verified]` signature. That is the human's move alone.
- Append the WORKLOG entry linking spec, commits, and test evidence.

### 6. Final report (in this order)
1. Acceptance-criteria scorecard.
2. Verbatim tail of `npm test` and `verify --strict` output.
3. Deviations from the spec: list each one with its §2 report — the expected
   count is ZERO; anything else should already have stopped you.
4. Files changed vs. the spec's touch list (must match exactly).
