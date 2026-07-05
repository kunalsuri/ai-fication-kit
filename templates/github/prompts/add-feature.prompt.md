---
mode: agent
description: Implement a feature using the knowledge layer — spec first, surgical diffs, tests before done, knowledge updated after.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Implement the requested feature following the `add-feature` skill contract (VS Code
auto-discovers it from `.claude/skills/add-feature/` or `.agents/skills/add-feature/`
in this repo). Summary of the contract:

1. **Spec first.** If no spec exists in `ai/lab/specs/`, draft one from the template
   and get the user's OK before writing code.
2. **Locate via the maps.** MODULE_MAP → FEATURE_MAP/CATALOG → WORKLOG history
   (was this area just changed?) → open only what's needed.
3. **Respect Stability.** Never modify `frozen` or `?` files without explicit human
   approval in this conversation.
4. **Build surgically.** Smallest diff that satisfies the spec; match conventions and
   license headers.
5. **Verify.** Run the suite(s) matching the change. Failing or unrun tests ⇒ not done.
6. **Update knowledge.** FEATURE_MAP entry, catalog amendment, MODULE_MAP if layout
   changed — all tagged `[inferred]` for the human to verify.
7. **Review & record.** Request `/review-change` on the diff (fresh context), then
   append the work's row to `ai/lab/WORKLOG.md` linking spec, review, and commits,
   and move the feature's `ai/lab/ROADMAP.md` row from Planned to Shipped —
   cross-linking the spec, the WORKLOG row, and the PR by feature ID.
