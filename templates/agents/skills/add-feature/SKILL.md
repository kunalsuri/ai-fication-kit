---
name: add-feature
description: Add a feature to this repository the safe way — spec, locate via maps, respect Stability, surgical implementation, verification, knowledge update. Use whenever the user asks to add, build, or implement functionality.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

# Add a feature

The contract: **no code before a spec, no edits to frozen code, no "done" without
green tests, no merge without a review and a knowledge update.**

## 1. Spec
If `ai/lab/specs/SPEC_<name>.md` doesn't exist, draft it from SPEC_TEMPLATE.md
(goal, scope, touch list, acceptance criteria, verification). Get the user's OK.

## 2. Locate
- `ai/guide/MODULE_MAP.md` → which modules; note Stability of every target.
- `ai/analysis/FEATURE_CATALOG.md` → the "where new code lives" decision tree and
  the 3-file rule for related features.
- `ai/lab/WORKLOG.md` → recent history: was this area just changed? is the
  behavior deliberate?
- Keep broad reading read-only and cheap (directory listings, manifests, search
  hits over whole-file reads) to protect context.

## 3. Gate
Any file in the touch list with Stability `frozen` or `?` ⇒ stop and ask the human.
Record their approval in the spec before proceeding.

## 4. Implement
Make the smallest diff that satisfies the spec. Conventions per
`ai/guide/CONVENTIONS.md` — see also `reference/checklist.md`. Match the license
headers of neighboring files. No drive-by refactors, no layout changes, no
dependency additions unless the plan says so.

## 5. Verify
Run the narrowest suite that covers the change first, then the suite(s) the spec
names. Report command run · exit status · failures verbatim. Red or unrun ⇒ not done.

## 6. Update knowledge
FEATURE_MAP entry; catalog amendment; MODULE_MAP if layout changed; all `[inferred]`.
Tell the user which tags await their `[verified]` flip.

## 7. Review & record
Request `/review-change` on the diff (fresh context — not this session). Append
the work's row to `ai/lab/WORKLOG.md` linking spec, review, and commits, and move the
feature's `ai/lab/ROADMAP.md` row from Planned to Shipped (cross-link spec, WORKLOG
row, and PR by feature ID).
