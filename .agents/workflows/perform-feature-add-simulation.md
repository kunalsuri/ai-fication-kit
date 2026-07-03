---
description: Dry-run the add-feature workflow for a proposed feature — friction report and per-phase readiness score, without writing code.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Simulate adding the feature the user names — WITHOUT writing a single line of code.
This is a pre-flight check of both the plan and the knowledge layer.

1. **Locate** — can MODULE_MAP + FEATURE_MAP/CATALOG identify the target modules
   without crawling? Name them. Score: smooth / friction / blocked.
2. **Plan** — draft the touch list per layer; note Stability of every file you'd
   change. Any `frozen` or `?` file ⇒ blocked pending human approval. Score it.
3. **Verify** — which suites would prove it works; do they exist and are commands
   confirmed? Score it.
4. **Knowledge update** — which ai/ files would need updating after the change?
   Score it.
5. **Report.** Produce a friction report (in chat, and saved to
   `ai/analysis/audit-reports/` if asked): per-phase score with the specific missing
   knowledge that caused friction, total estimated context cost, and a go / no-go
   recommendation. Knowledge gaps found here are the cheapest bugs you will ever fix
   — file each as an audit TODO.
