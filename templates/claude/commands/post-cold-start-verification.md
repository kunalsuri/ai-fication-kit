---
description: Audit every ai/ file for gaps, stale placeholders, and inconsistencies after cold-start. Produces a prioritized findings report.
---

Audit the AI knowledge layer. Read-only with one exception: you may write ONE report.

## Checks
1. **Placeholders:** find every `<fill in>`, `?` Stability, and `{{...}}` leftover
   across `ai/` and the entry files (CLAUDE.md, AGENTS.md).
2. **Internal consistency:** every path mentioned in `ai/guide/*` exists on disk;
   MODULE_MAP rows correspond to real directories; FEATURE_MAP entries point at real
   files; diagrams name real modules.
3. **Profile consistency:** build/test commands in CLAUDE.md/AGENTS.md match
   `ai/repo-profile.json`; flag divergence (don't silently fix).
4. **Provenance hygiene:** no `[verified]` tag lacking a date; nothing you can tell
   was agent-written carrying `[verified]`.

## Output
Write `ai/analysis/audit-reports/<YYYY-MM-DD>-post-cold-start.md`: findings grouped
P1 (agent-blocking) / P2 (misleading) / P3 (cosmetic), each with location and a
one-line suggested fix. Tag the report itself `[inferred]`. Do not modify the files
you are auditing.
