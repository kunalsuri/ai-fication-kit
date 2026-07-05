# Drift report

> Generated mechanically by ai-fication-kit `drift` on 2026-07-05.
> Drift is where the repository has moved away from the knowledge layer. The
> statuses are facts; closing the gap (re-map, fix the docs, re-audit) is your call.

| Drift | Count | Meaning |
|---|---|---|
| unmapped | 0 | code-bearing directory no MODULE_MAP row covers |
| vanished | 0 | directory / entry point the map quotes is gone |
| stale | 8 | `[verified]` row whose code changed since the verified commit |

## Stale verified rows (re-audit these)

| Row | MODULE_MAP line | Changed files since verified commit |
|---|---|---|
| `lib/` | 26 | `lib/verify.mjs` |
| `templates/` | 27 | `templates/agents/skills/add-feature/SKILL.md`, `templates/agents/workflows/add-feature.md`, `templates/ai/INDEX.md.tmpl`, `templates/ai/lab/README.md.tmpl`, `templates/ai/lab/ROADMAP.md.tmpl`, `templates/claude/commands/add-feature.md`, `templates/claude/skills/add-feature/SKILL.md`, `templates/cursor/rules/add-feature.mdc`, `templates/github/prompts/add-feature.prompt.md` |
| `templates/ai/` | 28 | `templates/ai/INDEX.md.tmpl`, `templates/ai/lab/README.md.tmpl`, `templates/ai/lab/ROADMAP.md.tmpl` |
| `templates/claude/` | 29 | `templates/claude/commands/add-feature.md`, `templates/claude/skills/add-feature/SKILL.md` |
| `templates/github/` | 30 | `templates/github/prompts/add-feature.prompt.md` |
| `templates/agents/` | 31 | `templates/agents/skills/add-feature/SKILL.md`, `templates/agents/workflows/add-feature.md` |
| `test/` | 32 | `test/run-deep-test.mjs`, `test/run-tests.mjs` |
| `docs/` | 33 | `docs/README.md`, `docs/dev/lessons-learnt/feature-planning-personas-and-simulation.md`, `docs/dev/lessons-learnt/model-tiering-plan-heavy-implement-light.md`, `docs/dev/upcoming-features.md` |
