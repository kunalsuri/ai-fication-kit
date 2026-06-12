---
name: add-feature
description: Add a feature to this repository the safe way — spec, locate via maps, respect Stability, surgical implementation, verification, knowledge update. Use whenever the user asks to add, build, or implement functionality.
---

# Add a feature

The contract: **no code before a spec, no edits to frozen code, no "done" without
green tests, no merge without a knowledge update.**

## 1. Spec
If `ai/lab/specs/SPEC_<name>.md` doesn't exist, draft it from SPEC_TEMPLATE.md
(goal, scope, touch list, acceptance criteria, verification). Get the user's OK.

## 2. Locate
- `ai/guide/MODULE_MAP.md` → which modules; note Stability of every target.
- `ai/analysis/FEATURE_CATALOG.md` → the "where new code lives" decision tree and
  the 3-file rule for related features.
- Delegate broad reading to `repo-explorer`.

## 3. Gate
Any file in the touch list with Stability `frozen` or `?` ⇒ stop and ask the human.
Record their approval in the spec before proceeding.

## 4. Implement
Delegate to `feature-builder` with the exact touch list. Conventions per
`ai/guide/CONVENTIONS.md` — see also `reference/checklist.md`.

## 5. Verify
Delegate to `test-runner`: narrowest suite first, then the suites the spec names.
Red or unrun ⇒ not done.

## 6. Update knowledge
FEATURE_MAP entry; catalog amendment; MODULE_MAP if layout changed; all `[inferred]`.
Tell the user which tags await their `[verified]` flip.
