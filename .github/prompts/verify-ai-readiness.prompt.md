---
mode: agent
description: Holistic assessment of the AI knowledge layer on a 5-level maturity scale; flags agent-blocking gaps.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Assess how ready this repository is for agentic work. Read-only; output one report.

## The maturity scale
- **Level 0 — Opaque.** No agent entry files; agents crawl and guess.
- **Level 1 — Scaffolded.** Kit installed; maps exist but are placeholders.
- **Level 2 — Drafted.** /cold-start ran; maps populated but `[inferred]`.
- **Level 3 — Verified.** Human audit done: Stability set, core rows `[verified]`.
  *The minimum bar for letting an agent build features.*
- **Level 4 — Maintained.** Feature catalog exists; knowledge updated on merge;
  audits recur; evaluations recorded in ai/lab/.

## Method
Score each: entry files (CLAUDE.md/AGENTS.md), MODULE_MAP coverage & verification
ratio (% rows `[verified]`), FEATURE_MAP/CATALOG coverage, conventions, diagrams,
ai/lab/ activity. Evidence = file contents only; no speculation.

## Output
Write `ai/analysis/audit-reports/<YYYY-MM-DD>-readiness.md`: overall level, per-area
table (area · evidence · level), the SINGLE most valuable next action, and any
agent-blocking gaps (anything that would make a feature build unsafe today).
Tag the report `[inferred]`.
