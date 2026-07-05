<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Repo-wide instructions for GitHub Copilot

This repo's coding rules live in `AGENTS.md` (repo root) — read it in full before
making changes. It points to the `ai/` knowledge layer: start at `ai/INDEX.md`,
then `ai/guide/MODULE_MAP.md` to find code by area before opening files.

Hard rules from `AGENTS.md` apply to every request in this workspace: respect
`ai/guide/MODULE_MAP.md` Stability (`frozen`/`?` = do not edit), keep diffs
surgical, match license headers, and never flip an `[inferred]` tag in `ai/` to
`[verified]` yourself — that is a human signature. Every unit of work ends with a
row appended to `ai/lab/WORKLOG.md`, even work done outside the prompt files
below.

## Slash commands available in Copilot Chat

This kit's workflows are available as prompt files under `.github/prompts/` —
type `/` in chat to see them:

- `/cold-start` — bootstrap the `ai/guide` maps and diagrams (draft-only, `[inferred]`)
- `/add-feature` — spec first, then implement using the knowledge layer
- `/fix-bug` — reproduce first, failing regression test, root cause, surgical fix
- `/review-change` — fresh-context review of a finished change against its spec
- `/check-drift` — run the mechanical verify + drift checks
- `/create-feature-catalog` — mine the code for a feature → files catalog
- `/perform-feature-add-simulation` — dry-run a feature add without writing code
- `/post-cold-start-verification` — deep audit of the drafted `ai/` docs
- `/review-agent-config` — structural check of `CLAUDE.md` / `AGENTS.md`
- `/verify-ai-readiness` — score this repo's AI-readiness maturity
- `/adversarial-audit` — judgement-based deep defect hunt (stale docs, unescaped interpolation, platform gaps, cross-module rot); run periodically, not in CI

Custom chat modes under `.github/chatmodes/` mirror the kit's subagents
(`repo-explorer`, `feature-builder`, `test-runner`) — switch to them from the
chat mode picker for read-only exploration, surgical implementation, or test
verification respectively.

## Agent Skills

VS Code discovers Agent Skills from `.claude/skills/` and `.agents/skills/` in
this repo automatically — the `add-feature` skill (spec → locate → gate →
implement → verify → review & record) and the `fix-bug` skill (reproduce →
failing test → locate → gate → root cause → fix → verify → review & record)
apply to Copilot too; nothing Copilot-specific needed here.
