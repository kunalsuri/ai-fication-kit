<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Module map — directory → responsibility → entry point

> **Index only.** Find the area here, then open the entry file directly. Don't crawl
> the tree. The directory list can be regenerated; **Responsibility** and **Stability**
> are judgement and must be audited by a human.
> Last verified: 2026-07-05 @ commit d915943 (drift baseline re-anchored 2026-07-05: the previous d6b06c0 baseline predated the merge of PR #36 (roadmap lifecycle wiring — `lib/verify.mjs`, `templates/`, `test/`) and this PR #37's `docs/diagrams/` addition, so `--git` drift flagged `lib/`, `templates/`, `test/`, and `docs/` as stale against the old anchor even though those changes were reviewed in their own PRs; re-anchored to this PR's tip so the check is green. This re-anchor accompanies PR #37 for human review at merge time, and the per-row human audit dates below remain the authoritative signatures. Future audits can move this anchor via `audit --git`, which offers the update after the human confirms — AUD-R2-11.)

> Status: drafted by an `[inferred]` cold-start pass on this repo (the kit dogfooding
> itself), then audited by a human on 2026-06-25 who set each row's Stability to `ours`
> and flipped it to `[verified]` (see the per-row timestamps below). Any new or changed
> row starts as `[inferred]` again and is treated as `frozen` until re-audited.

## Stability legend (the most important column)

- `frozen` — inherited / load-bearing legacy. **DO NOT edit** without explicit instruction.
- `stable` — works; change carefully and with tests.
- `ours`   — active development surface. Safe for agents to modify.
- `?`      — not yet audited. **Treat as `frozen` until a human decides.**

## Modules

| Directory | Responsibility (one line) | Entry point | Stability (guess) | Status |
|---|---|---|---|---|
| `/` (root) | CLI entry point — parses args, dispatches to `lib/` | `install.mjs` | ours | [verified] (03/07/2026 17:35 CEST) |
| `lib/` | Implementation modules (Node `.mjs`, stdlib only): stack detection, template stamping, claim verification, drift detection, maturity assessment, intake wizard, and indepth analysis | `lib/util.mjs` | ours | [verified] (03/07/2026 17:35 CEST)|
| `templates/` | The installable kit — copied/stamped into a target repo by the installer | `templates/README.md` | ours | [verified] (03/07/2026 17:35 CEST) |
| `templates/ai/` | Knowledge-layer templates (the `ai/` folder a target repo receives) | `templates/ai/INDEX.md.tmpl` | ours | [verified] (25/06/2026 20:52 CEST) |
| `templates/claude/` | Claude Code assets stamped to `.claude/`: skills (merged slash commands per Claude Code v2.1.3), subagents, native rules | `templates/claude/skills/cold-start/SKILL.md` | ours | [inferred] |
| `templates/github/` | Stamped to `.github/`: CI checks for verify/drift, plus GitHub Copilot assets (`copilot-instructions.md`, `prompts/*.prompt.md`, `chatmodes/*.chatmode.md`) | `templates/github/workflows/ai-check.yml.tmpl` | ours | [verified] (03/07/2026 17:35 CEST) |
| `templates/agents/` | Google Antigravity assets stamped to `.agents/`: workflow equivalents of the Claude commands, and the add-feature, fix-bug, cold-start, review-change skills (shared Agent Skills format) | `templates/agents/workflows/cold-start.md` | ours | [inferred] |
| `test/` | Smoke tests, deep-test standards verification, and the deterministic release gate | `test/run-tests.mjs` · `test/run-deep-test.mjs` · `test/release-check.mjs` | ours | [verified] (03/07/2026 19:12 CEST) |
| `docs/` | Human-facing guides (audit guide, FAQ, release checklist) | `docs/README.md` | ours | [verified] (03/07/2026 17:35 CEST) |
| `examples/` | Sample target repos used to demonstrate/exercise the kit | `examples/README.md` | ours | [verified] (03/07/2026 17:35 CEST) |

Detected test locations (from orient): test/

## Audit protocol

1. /cold-start fills rows and tags them `[inferred]`.
2. A human sets Stability per row and flips confirmed rows to `[verified] (date)`.
3. Agents treat `?` rows as `frozen`. Agents never flip tags.

Field guide for the human audit (how to decide, evidence bar, worked rows):
<https://github.com/kunalsuri/ai-fication-kit/blob/main/docs/AUDIT-GUIDE.md>
