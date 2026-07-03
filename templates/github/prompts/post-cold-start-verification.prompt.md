---
mode: agent
description: Audit every ai/ file for gaps, stale placeholders, and inconsistencies after cold-start. Produces a prioritized findings report.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Audit the AI knowledge layer. Read-only with one exception: you may write ONE report.

## Step 0 — use the mechanical verifier's output, don't redo its job
If `ai/analysis/audit-reports/VERIFICATION_MANIFEST.json` exists, read its `summary`
and the non-`confirmed` claims first: path-existence checking is already done
deterministically by the kit's `verify` command (run from the kit checkout:
`node install.mjs verify <repo>` — no LLM
involved, so its statuses are facts). Spend your pass on what a script cannot
judge (checks 1, 3, 4 below, and the *semantic* half of check 2). If the manifest
is absent or older than the docs it covers, recommend regenerating it in your
report instead of re-deriving path checks by hand.

## Checks
1. **Placeholders:** find every `<fill in>`, `?` Stability, and `{{...}}` leftover
   across `ai/` and the entry files (CLAUDE.md, AGENTS.md).
2. **Internal consistency:** every path mentioned in `ai/guide/*` exists on disk
   (covered by the manifest when present — see Step 0); MODULE_MAP rows correspond
   to real directories; FEATURE_MAP entries point at real files; diagrams name
   real modules.
3. **Profile consistency:** build/test commands in CLAUDE.md/AGENTS.md match
   `ai/repo-profile.json`; flag divergence (don't silently fix).
4. **Provenance hygiene:** no `[verified]` tag lacking a date; nothing you can tell
   was agent-written carrying `[verified]`.

## Output
Write `ai/analysis/audit-reports/<YYYY-MM-DD>-post-cold-start.md`: findings grouped
P1 (agent-blocking) / P2 (misleading) / P3 (cosmetic), each with location and a
one-line suggested fix. Tag the report itself `[inferred]`. Do not modify the files
you are auditing.
