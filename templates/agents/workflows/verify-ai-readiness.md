---
description: Holistic assessment of the AI knowledge layer on a 5-level maturity scale; flags agent-blocking gaps.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Assess how ready this repository is for agentic work. Read-only; output one report.

1. **Know the maturity scale:**
   - Level 0 — Opaque: no agent entry files; agents crawl and guess.
   - Level 1 — Scaffolded: kit installed; maps exist but are placeholders.
   - Level 2 — Drafted: /cold-start ran; maps populated but `[inferred]`.
   - Level 3 — Verified: human audit done, Stability set, core rows `[verified]`
     (the minimum bar for letting an agent build features).
   - Level 4 — Maintained: feature catalog exists; knowledge updated on merge;
     audits recur; evaluations recorded in ai/lab/.
2. **Score each area** from evidence only (file contents, no speculation): entry
   files (CLAUDE.md/AGENTS.md), MODULE_MAP coverage & verification ratio (% rows
   `[verified]`), FEATURE_MAP/CATALOG coverage, conventions, diagrams, ai/lab/
   activity.
3. **Write `ai/analysis/audit-reports/<YYYY-MM-DD>-readiness.md`:** overall level,
   a per-area table (area · evidence · level), the SINGLE most valuable next
   action, and any agent-blocking gaps (anything that would make a feature build
   unsafe today). Tag the report `[inferred]`.
