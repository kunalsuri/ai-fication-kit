# Drift report

> Generated mechanically by ai-fication-kit `drift` on 2026-07-06.
> Drift is where the repository has moved away from the knowledge layer. The
> statuses are facts; closing the gap (re-map, fix the docs, re-audit) is your call.

| Drift | Count | Meaning |
|---|---|---|
| unmapped | 0 | code-bearing directory no MODULE_MAP row covers |
| vanished | 0 | directory / entry point the map quotes is gone |
| stale | 9 | `[verified]` row whose code changed since the verified commit |

## Stale verified rows (re-audit these)

| Row | MODULE_MAP line | Changed files since verified commit |
|---|---|---|
| `/` | 25 | `install.mjs` |
| `lib/` | 26 | `lib/doctor.mjs`, `lib/drift.mjs`, `lib/util.mjs`, `lib/verify.mjs` |
| `templates/` | 27 | `templates/agents/workflows/adversarial-audit.md`, `templates/ai/analysis/README.md.tmpl`, `templates/claude/commands/adversarial-audit.md`, `templates/cursor/rules/adversarial-audit.mdc`, `templates/github/copilot-instructions.md`, `templates/github/prompts/adversarial-audit.prompt.md` |
| `templates/ai/` | 28 | `templates/ai/analysis/README.md.tmpl` |
| `templates/claude/` | 29 | `templates/claude/commands/adversarial-audit.md` |
| `templates/github/` | 30 | `templates/github/copilot-instructions.md`, `templates/github/prompts/adversarial-audit.prompt.md` |
| `templates/agents/` | 31 | `templates/agents/workflows/adversarial-audit.md` |
| `test/` | 32 | `test/release-check.mjs`, `test/run-tests.mjs` |
| `docs/` | 33 | `docs/GETTING-STARTED.md`, `docs/MULTI-TOOL-SETUP.md`, `docs/README.md`, `docs/dev/lessons-learnt/full-stack-simulation-session.md` |
