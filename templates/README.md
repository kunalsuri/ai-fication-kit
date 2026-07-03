<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# templates/ — the installable kit

Everything in this folder is stamped into a target repo by `install.mjs`.

Rules:
- Files ending `.tmpl` have `{{PLACEHOLDERS}}` substituted and lose the `.tmpl` suffix.
- All other files are copied verbatim.
- `templates/claude/**` installs to `.claude/**` (kept visible here so the kit's own
  tree is browsable): Claude Code slash commands, subagents, the `add-feature` skill.
- `templates/github/**` installs to `.github/**`: the CI/CD workflow template, plus
  GitHub Copilot assets — `copilot-instructions.md` (repo-wide instructions),
  `prompts/*.prompt.md` (slash-command equivalents of the Claude commands), and
  `chatmodes/*.chatmode.md` (equivalents of the Claude subagents).
- `templates/agents/**` installs to `.agents/**`: Google Antigravity assets —
  `workflows/*.md` (slash-command equivalents of the Claude commands) and
  `skills/add-feature/` (the same Agent Skills-format skill Claude Code uses —
  Antigravity and Copilot both discover `SKILL.md` from `.agents/skills/` natively,
  so it is not duplicated per tool). Antigravity reads the tool-agnostic
  `AGENTS.md` at the repo root natively, so no separate rules files are shipped here.
- `templates/cursor/**` installs to `.cursor/**`: native Cursor rules —
  `rules/*.mdc` mirroring the 8 files in `templates/github/prompts/` (same
  content, MDC frontmatter, `alwaysApply: false`), plus one
  `alwaysApply: true` rule (`ai-knowledge-layer.mdc`) pointing at
  `ai/INDEX.md` and the provenance rule. Codex needs nothing new here — it
  reads `AGENTS.md` natively too.
- This README is documentation for kit developers and is **not** installed.

Placeholders (filled by the `orient` step; confirm them in your audit):

| Placeholder | Source |
|---|---|
| `{{PROJECT_NAME}}` | `--name` flag, else target folder name |
| `{{DESCRIPTION}}` | `--description` flag, else first prose line of README |
| `{{LANGUAGES}}` | detected from marker files |
| `{{BUILD_CMD}}` / `{{TEST_CMD}}` | flags, else detected defaults |
| `{{UPSTREAM}}` | `--upstream` flag, else git remote named `upstream` |
| `{{FORK_LINE}}` / `{{FORK_RULE}}` | computed from fork status |
| `{{TEST_DIRS}}` | detected test directories |
| `{{DATE}}` / `{{KIT_VERSION}}` | install time / kit version |
