---
name: fix-bug
description: Fix a bug in this repository the safe way — reproduce first, failing regression test, root cause via the maps, surgical fix, review, ledger entry. Use whenever the user reports broken, wrong, or crashing behavior.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

# Fix a bug

The contract: **no fix before a reproduction, no reproduction without a failing
test, no "fixed" without the regression test green, no closing without the
ledger row and the gotcha recorded.**

## 1. Reproduce
Draft `ai/lab/specs/BUGFIX_<name>.md` from BUGFIX_TEMPLATE.md: symptom
(observed vs expected), exact reproduction steps. Get the user's OK.

## 2. Prove
Turn the reproduction into a regression test and watch it **fail**. A bug you
cannot make a test fail for is a bug you do not understand yet. The test is
permanent — it outlives the fix.

## 3. Locate
- `ai/guide/MODULE_MAP.md` → which modules; note Stability of every suspect.
- `ai/guide/FEATURE_MAP.md` gotchas + `ai/lab/WORKLOG.md` → was this area
  recently touched, or is the "bug" deliberate behavior a past ADR explains?
- Keep broad reading read-only and cheap (directory listings, manifests, search
  hits over whole-file reads) to protect context.

## 4. Gate
Root cause in a file with Stability `frozen` or `?` ⇒ stop and ask the human.
Record their approval in the bugfix doc before proceeding.

## 5. Diagnose, then fix
Name the root cause in the bugfix doc — the defect, not the symptom. Then make
the smallest diff that turns the regression test green. Match the license
headers of neighboring files. No drive-by refactors, no layout changes, no
dependency additions while "in there".

## 6. Verify
Run the regression test (now green), then the suites covering the touched area.
Report command run · exit status · failures verbatim. Red or unrun ⇒ not fixed.

## 7. Review & record
Request `/review-change` on the diff (fresh context — not this session).
Append a `bugfix` row to `ai/lab/WORKLOG.md` linking the bugfix doc and review;
add the gotcha line to FEATURE_MAP so the next agent knows the trap. All
`[inferred]` — tell the user which tags await their `[verified]` flip.
