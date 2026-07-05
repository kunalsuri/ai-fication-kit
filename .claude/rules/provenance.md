---
paths:
  - "ai/**"
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
<!-- Path-scoped Claude Code rule: the `paths:` frontmatter means it loads only
     when Claude reads or edits a file under ai/, reinforcing the provenance
     invariant at the moment knowledge is written rather than on every session. -->

You are working in the `ai/` knowledge layer — the shared source of truth every
agent and teammate reads. Writes here carry weight:

- **Provenance.** Anything you write into `ai/` is `[inferred]` until a human flips
  it to `[verified]`. Never flip that tag yourself — it is a human signature.
- **No churn.** Keep edits surgical; never rewrite or simplify a detailed guide into
  a stub (the "No Phantom Bugs & Configuration Churn" rule in `AGENTS.md`).
- **Backtick artifact paths**, written from the repo root — `verify` checks
  backtick-quoted paths against the tree, so a broken claim fails CI instead of
  rotting silently.
