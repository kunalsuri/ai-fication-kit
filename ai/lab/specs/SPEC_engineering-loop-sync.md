<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: Engineering-loop sync — one canonical loop, a ledger that can't be skipped
> **Status:** implemented
> **Author:** agent draft `[inferred]` (from the maintainer's 2026-07-04 audit
> request: verify every loop stage is mechanism-backed before MCP work starts)
> · **Date:** 2026-07-04

## Goal
The 2026-07-04 loop audit found the loop structurally sound but out of sync in
four places: (1) the ledger missed the post-v0.2.0 work (W-002 stale, PRs #27
and #28 unrecorded); (2) two conflicting loop definitions coexist (6-stage
"Spec→…→Record" in METHODOLOGY/README/GLOSSARY vs 8-step "Plan→…→Archive" in
the lab READMEs); (3) the Record step exists only inside the slash-command
texts, so work done outside them is never ledgered and nothing can detect the
gap; (4) small drifts (Evaluate naming, `/add-feature` not consulting WORKLOG
history, `/implement-spec` absent from METHODOLOGY §7). This spec closes all
four without changing any CLI behavior.

## Scope
**In:**
- Ledger: W-002 → `shipped`; new rows W-003 (MCP KB spec, `specced`), W-004
  (`/implement-spec` process work, `shipped`, gaps recorded honestly), W-005
  (this work).
- One canonical loop: lab READMEs (live + template) rename step 1 Plan → Spec,
  mark steps 7–8 as optional follow-ups, name the Evaluate template.
- Always-on Record rule: one surgical line in `CLAUDE.md`, `AGENTS.md`, the
  Cursor `ai-knowledge-layer` rule, and Copilot instructions — template and
  dogfood copies alike.
- `/add-feature` Locate step consults `ai/lab/WORKLOG.md` (all 6 formats ×
  template + dogfood), mirroring `/fix-bug`.
- METHODOLOGY §7 Implement row and the GLOSSARY loop entry mention
  `/implement-spec`.

**Out (explicitly):** promoting `/implement-spec` into `templates/`
(maintainer's product decision, deferred in W-004); a mechanical
merged-commit-without-ledger-row detector (needs its own spec); renaming the
historical evaluation file; registering the `deep-test` skill for Claude Code;
the two pre-existing `npm run deep-test` failures — placeholder-check false
positives on prose examples in `ai/guide/FEATURE_MAP.md` and
`ai/lab/specs/SPEC_B5-progress-page.md` (checker fix = its own bugfix), and
the `docs/` stale row that only a human `audit --git` re-audit may re-anchor.

## Touch list
| Layer | Location | Change |
|---|---|---|
| ledger | `ai/lab/WORKLOG.md` | W-002 status; rows W-003..W-005 |
| lab docs | `ai/lab/README.md`, `templates/ai/lab/README.md.tmpl` | canonical stage names; optional steps marked; template named (`/implement-spec` mention in the live copy only — installed repos don't receive the command) |
| config | `CLAUDE.md`, `AGENTS.md`, `templates/CLAUDE.md.tmpl`, `templates/AGENTS.md.tmpl` | one Record-work rule line each |
| cursor | `.cursor/rules/ai-knowledge-layer.mdc`, `templates/cursor/rules/ai-knowledge-layer.mdc` | Record-work paragraph |
| copilot | `.github/copilot-instructions.md`, `templates/github/copilot-instructions.md` | Record-work rule line |
| add-feature | command/workflow/rule/prompt + 2 SKILL.md, template + dogfood (12 files) | WORKLOG lookup in Locate step |
| docs | `docs/METHODOLOGY.md`, `docs/GLOSSARY.md` | `/implement-spec` in Implement stage |
| spec | `ai/lab/specs/SPEC_engineering-loop-sync.md` | this file |

## Acceptance criteria
1. Exactly one loop definition: every stage list reads Spec → Decide →
   Implement → Review → Evaluate → Record; lab-README steps 7–8 are labeled
   optional.
2. Template and dogfood copies of every touched asset are byte-identical
   (except the documented `/implement-spec` mention, live lab README only).
3. `ai/lab/WORKLOG.md` reflects all merged work through PR #28, and every
   backticked path in it resolves.
4. `npm test`, `node install.mjs verify . --strict`, and `drift --strict`
   (without `--git`) all pass; `npm run deep-test` reports no findings beyond
   the two pre-existing failures named in the Out list; this change leaks no
   new template placeholders outside `templates/`.

## Verification
- Suites: `npm test` · `node install.mjs verify . --strict` ·
  `node install.mjs drift . --strict` · `npm run deep-test` (expectation per
  acceptance criterion 4: no findings beyond the pre-existing two)
- Sync check: `diff -r` between each template dir and its dogfood twin shows
  only the known, documented deltas (`implement-spec.md`, `deep-test`).
- Stability check: every touched area is `ours` in `ai/guide/MODULE_MAP.md`;
  no `frozen`/`?` files modified.

## Knowledge update on completion
- [x] WORKLOG row W-005 appended (`[inferred]`)
- [ ] Human audit: flip rows to `[verified]`, decide `/implement-spec`
      promotion (W-004 note)
