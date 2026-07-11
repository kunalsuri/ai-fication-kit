# Drift report

> Generated mechanically by ai-fication-kit `drift` on 2026-07-11.
> Drift is where the repository has moved away from the knowledge layer. The
> statuses are facts; closing the gap (re-map, fix the docs, re-audit) is your call.

| Drift | Count | Meaning |
|---|---|---|
| unmapped | 0 | code-bearing directory no MODULE_MAP row covers |
| vanished | 0 | directory / entry point the map quotes is gone |
| stale | 7 | `[verified]` row whose code changed since the verified commit |

## Stale verified rows (re-audit these)

| Row | MODULE_MAP line | Changed files since verified commit |
|---|---|---|
| `/` | 25 | `install.mjs` |
| `lib/` | 26 | `lib/doctor.mjs`, `lib/drift.mjs`, `lib/migrations.mjs`, `lib/util.mjs`, `lib/verify.mjs` |
| `templates/` | 27 | `templates/README.md`, `templates/agents/skills/cold-start/SKILL.md`, `templates/agents/skills/cold-start/reference/checklist.md`, `templates/agents/skills/review-change/SKILL.md`, `templates/agents/skills/review-change/reference/checklist.md`, `templates/agents/workflows/adversarial-audit.md`, `templates/ai/analysis/README.md.tmpl`, `templates/claude/commands/add-feature.md`, `templates/claude/commands/cold-start.md`, `templates/claude/commands/fix-bug.md`, `templates/claude/commands/review-change.md`, `templates/claude/rules/ai-knowledge-layer.md`, `templates/claude/skills/adversarial-audit/SKILL.md`, `templates/claude/skills/check-drift/SKILL.md`, `templates/claude/skills/cold-start/SKILL.md`, `templates/claude/skills/cold-start/reference/checklist.md`, `templates/claude/skills/create-feature-catalog/SKILL.md`, `templates/claude/skills/perform-feature-add-simulation/SKILL.md`, `templates/claude/skills/post-cold-start-verification/SKILL.md`, `templates/claude/skills/review-agent-config/SKILL.md`, `templates/claude/skills/review-change/SKILL.md`, `templates/claude/skills/review-change/reference/checklist.md`, `templates/claude/skills/verify-ai-readiness/SKILL.md`, `templates/cursor/rules/adversarial-audit.mdc`, `templates/cursor/rules/ai-knowledge-layer.mdc`, `templates/github/copilot-instructions.md`, `templates/github/prompts/adversarial-audit.prompt.md` |
| `templates/ai/` | 28 | `templates/ai/analysis/README.md.tmpl` |
| `templates/github/` | 30 | `templates/github/copilot-instructions.md`, `templates/github/prompts/adversarial-audit.prompt.md` |
| `test/` | 32 | `test/release-check.mjs`, `test/run-tests.mjs` |
| `docs/` | 33 | `docs/FAQ.md`, `docs/GETTING-STARTED.md`, `docs/IMPLEMENT-SPEC.md`, `docs/MULTI-TOOL-SETUP.md`, `docs/README.md`, `docs/dev/lessons-learnt/full-stack-simulation-session.md` |
