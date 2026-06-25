<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Module map — directory → responsibility → entry point

> **Index only.** Find the area here, then open the entry file directly. Don't crawl
> the tree. The directory list can be regenerated; **Responsibility** and **Stability**
> are judgement and must be audited by a human.
> Last verified: 2026-06-25 @ commit <set to the release commit sha when tagging>

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
| `/` (root) | CLI entry points for both runtimes — parse args, dispatch to `lib/` | `install.mjs` · `install.py` | ours | [verified] (25/06/2026 20:50 CEST) |
| `lib/` | Implementation modules, mirrored in Node (`.mjs`) and Python (`.py`): stack detection, template stamping, claim verification, drift detection, maturity assessment | `lib/util.mjs` · `lib/util.py` | ours | [verified] (25/06/2026 20:51 CEST) |
| `templates/` | The installable kit — copied/stamped into a target repo by the installer | `templates/README.md` | ours | [verified] (25/06/2026 20:52 CEST) |
| `templates/ai/` | Knowledge-layer templates (the `ai/` folder a target repo receives) | `templates/ai/INDEX.md.tmpl` | ours | [verified] (25/06/2026 20:52 CEST) |
| `templates/claude/` | Claude Code assets stamped to `.claude/`: slash commands, subagents, the add-feature skill | `templates/claude/commands/cold-start.md` | ours | [verified] (25/06/2026 20:52 CEST) |
| `test/` | Cross-runtime smoke tests for both installers | `test/run-tests.mjs` | ours | [verified] (25/06/2026 20:52 CEST) |
| `docs/` | Human-facing guides (audit guide, FAQ, release checklist) | `docs/README.md` | ours | [verified] (25/06/2026 20:52 CEST) |
| `examples/` | Sample target repos used to demonstrate/exercise the kit | `examples/README.md` | ours | [verified] (25/06/2026 20:52 CEST) |

Detected test locations (from orient): test/

## Audit protocol

1. /cold-start fills rows and tags them `[inferred]`.
2. A human sets Stability per row and flips confirmed rows to `[verified] (date)`.
3. Agents treat `?` rows as `frozen`. Agents never flip tags.

Field guide for the human audit (how to decide, evidence bar, worked rows):
<https://github.com/kunalsuri/ai-fication-kit/blob/main/docs/AUDIT-GUIDE.md>
