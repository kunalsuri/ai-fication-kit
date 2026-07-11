<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
<!-- Always-on Claude Code rule: no `paths:` frontmatter, so it loads every
     session with the same priority as CLAUDE.md. The Claude Code twin of the
     Cursor always-on rule (.cursor/rules/ai-knowledge-layer.mdc), so both tools
     carry the same two invariants natively. -->

This repo has an AI knowledge layer under `ai/`. Read `ai/INDEX.md` first — it is
the role → path manifest for finding the right map for your task — then
`ai/guide/MODULE_MAP.md` to locate code by directory before you crawl the tree.

**Provenance.** Anything written into `ai/` is `[inferred]` until a human flips it
to `[verified]`. Never flip that tag yourself.

**Record work.** Every unit of work ends with a row appended to
`ai/lab/WORKLOG.md` — even work done outside the slash commands. Backtick every
artifact path in the row: `verify` checks backtick-quoted path claims against
the tree (plain-text links are not validated).

See `CLAUDE.md` (loaded every session, it imports `AGENTS.md`) for the full rule
set, and the `/cold-start`, `/add-feature`, `/fix-bug`, and `/review-change`
skills in `.claude/skills/` for the kit's workflows.
