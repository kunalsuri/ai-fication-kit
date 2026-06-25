<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# ai-fication-kit — Claude Code project memory

# Imports tool-agnostic rules (Claude Code native directive)
@AGENTS.md
# Relative link for non-Claude agents: [AGENTS.md](AGENTS.md)

**A Toolkit to Give AI Coding Agents a Trusted Map of Any Existing/Legacy Repo**
Stack: JavaScript/TypeScript.

## Build & test — VERIFY in the cold-start pass before trusting
- Build: `npm install`
- Test:  `npm test`
- Test locations: test/
- Run the suite matching what you changed BEFORE claiming success.

## Hard rules (non-negotiable)
- **Respect existing boundaries.** Treat unfamiliar, load-bearing code as frozen until the module map says otherwise.
- Check `ai/guide/MODULE_MAP.md` Stability before editing any file. `frozen` = hands off.
- Anything you write into `ai/` is `[inferred]` until a human flips it to `[verified]`.
  Never flip that tag yourself.
- **No Phantom Bugs & Configuration Churn:** Do not rewrite, restructure, or simplify configuration or instruction files (`CLAUDE.md`, `AGENTS.md`, `package.json`, or anything in `ai/guide/`) based on quick searches or automated suggestions. Keep edits surgical. Never replace detailed guides with simplified stubs.
- **Verify claims:** Before declaring a task finished, run `node install.mjs verify . --strict` (or your repo's verify script) to ensure no file paths in the knowledge documents are broken.

## Where to look — read on demand, do NOT pre-load
- Role → path manifest:   ai/INDEX.md
- Machine-readable facts: ai/repo-profile.json   (orient output; deterministic)
- Find code by area:      ai/guide/MODULE_MAP.md   <- START HERE to locate anything
- What & why:             ai/guide/PROJECT_OVERVIEW.md
- System shape:           ai/guide/ARCHITECTURE.md
- Feature -> files:       ai/guide/FEATURE_MAP.md
- Conventions:            ai/guide/CONVENTIONS.md
- Generated analysis:     ai/analysis/   (feature catalog, diagrams, audit reports)
- Specs / ADRs / evals:   ai/lab/

## Token discipline
- Locate via MODULE_MAP.md, then open only needed files. Don't crawl the tree.
- Prefer grep and line counts over whole-file reads.
- Delegate isolated/heavy work to subagents: `repo-explorer` (read-only exploration),
  `feature-builder` (implements), `test-runner` (tests).

## Repo intelligence (the `ai/` knowledge-base)
The `ai/` folder is the single source of truth for repository intelligence. It is
tool-agnostic: any AI coding agent (Claude, Cursor, Copilot, Codex) reads the same
verified maps, architecture docs, and feature catalogs. New features, refactors, and
onboarding all start here.

If `CLAUDE_bkp_*.md` exists, it is the prior configuration. Knowledge was extracted
from it during /cold-start — do not re-read it; use `ai/guide/` instead.

## Cold start
If `ai/guide/MODULE_MAP.md` still has placeholder rows, run `/cold-start` once, then a
human audits (set Stability, flip [inferred] -> [verified]) before features are built.
If backup files (e.g. `CLAUDE_bkp_*.md`) exist, the agent will extract and reuse
knowledge from your prior configuration to seed the ai/guide/ documents.

<!-- Installed by ai-fication-kit 0.1.0 on 2026-06-17. -->
