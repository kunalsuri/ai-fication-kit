---
mode: agent
description: Fix a bug using the knowledge layer — reproduce first, failing regression test, root cause, surgical fix, review and ledger entry after.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Fix the reported bug following the `fix-bug` skill contract (VS Code
auto-discovers it from `.claude/skills/fix-bug/` or `.agents/skills/fix-bug/`
in this repo). Summary of the contract:

1. **Reproduce first.** Draft `ai/lab/specs/BUGFIX_<name>.md` from the template
   (symptom, exact steps) and get the user's OK before touching code.
2. **Failing test before fix.** Turn the reproduction into a permanent regression
   test and watch it fail — that is the proof the bug is understood.
3. **Locate via the maps.** MODULE_MAP Stability → FEATURE_MAP gotchas →
   WORKLOG history (was this area just touched? is the behavior deliberate?).
4. **Respect Stability.** Root cause in `frozen` or `?` files ⇒ explicit human
   approval in this conversation, recorded in the bugfix doc.
5. **Root cause, then surgical fix.** Name the defect, not the symptom; smallest
   diff that turns the regression test green. No drive-by refactors.
6. **Verify.** Regression test green plus the suites covering the touched area.
   Failing or unrun tests ⇒ not fixed.
7. **Review & record.** Request `/review-change` on the diff; append the
   `bugfix` row to `ai/lab/WORKLOG.md` and the FEATURE_MAP gotcha — all tagged
   `[inferred]` for the human to verify.
