---
mode: agent
description: Bootstrap the ai/guide maps and diagrams (the cold-start pass). Drafts everything as [inferred] for a human to audit.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Run the **cold-start bootstrap**. This is a one-time, read-and-write-docs-only pass.
You will draft the AI metadata; a human will audit it afterward. Do NOT touch source code.

## Step 0 — load the facts
Read `ai/repo-profile.json` (deterministic output of the kit's orient step). Treat its
stack facts as given; VERIFY its build/test commands against real config files before
writing them anywhere as confirmed. If the profile says this repo is a fork,
**distinguishing OUR code from FROZEN upstream code is the single most important
output of this pass.**

If the profile contains a `humanContext` block (captured by the first-run wizard), use
it — these are the user's own answers, not detection:
- `developer.skillLevel` / `developer.codebaseFamiliarity` — calibrate your output. For
  a junior or someone new to this codebase, explain more, and lean MORE conservative on
  Stability (prefer `?`/`frozen` when unsure). For an expert who knows the repo, be terse.
- `stack` — if `kind` is `split`, expect distinct frontend/backend trees and map them
  separately; if `single`, don't invent a split; if `unknown`, flag the stack as a thing
  to resolve. The user's `description`/`frontend`/`backend` strings override loose guesses.
- `branch` / `firstRunAt` — provenance; record the first-run date in `PROJECT_OVERVIEW.md`.

## Step 0.5 — absorb prior knowledge (Process 2 repos only)

Check `repo-profile.json` → `maturity.process`. If it is `2`, backup files exist.

If `CLAUDE_bkp_*.md` or `AGENTS_bkp_*.md` exist at the repo root, they contain the
previous AI configuration written by the team or another tool. Extract and reuse:

1. **Read** the backup files (glob `*_bkp_*.md` at the repo root).
2. **Extract** any information that is USEFUL for the `ai/` knowledge layer:
   - Build/test commands (cross-reference with `repo-profile.json`)
   - Project description and purpose
   - Coding conventions and style rules
   - Architecture notes (layers, boundaries, patterns)
   - Known gotchas, forbidden patterns, or "never do X" rules
   - Module or directory descriptions
   - References to external systems or APIs
3. **Merge** extracted knowledge into the appropriate `ai/guide/` documents:
   - Conventions → `ai/guide/CONVENTIONS.md`
   - Architecture notes → `ai/guide/ARCHITECTURE.md`
   - Module info → `ai/guide/MODULE_MAP.md` (as seed rows)
   - Project purpose → `ai/guide/PROJECT_OVERVIEW.md`
4. **Enrich** the new `CLAUDE.md` and `AGENTS.md` with any project-specific
   hard rules from the backups that are NOT already covered by the kit's
   templates (e.g., "never use ORM X", "always use Y pattern").
5. Tag everything extracted as `[inferred — from prior config]` so the human
   auditor knows the provenance.

Do NOT blindly copy the backup content. Parse it for KNOWLEDGE. The structure
of the new files comes from the kit's templates; only the FACTS from the
backups are reused.

## Steps
1. **Explore cheaply.** If a `repo-explorer` chat mode is available, switch to it to
   protect this context window — it is read-only by design. Otherwise, explore
   read-only yourself: list the tree 2 levels deep; read build manifests (not source);
   check the last ~30 commit subjects for active areas. Prefer grep + line counts over
   whole-file reads.
2. **Fill `ai/guide/MODULE_MAP.md`:** one row per module/package — directory, a
   one-line responsibility, the entry-point file, and a Stability GUESS. Use the
   ACTUAL names you found; do not assume names. Each row has FIVE cells —
   Directory, Responsibility, Entry point, Stability guess, Status — and the
   Status cell is where the `[inferred]` tag goes (the tooling reads provenance
   from the LAST cell only).
3. **Correct the stamped commands.** If the build/test commands you verified in
   config files differ from the Build/Test lines stamped into `CLAUDE.md` and
   `AGENTS.md`, correct exactly those lines (and the Definition-of-done line in
   `ai/guide/CONVENTIONS.md`), tag the correction `[inferred]`, and change
   nothing else in those files. This is the sanctioned exception to the
   No-Churn rule.
4. **Draft diagrams into `ai/analysis/diagrams/`** as Mermaid `.mmd`:
   `package-deps.mmd` (dependency graph), `domain-core.mmd` (core types),
   `seam.mmd` (the main boundary — note the protocol as a question if unverified).
5. **Note candidate features** in `ai/guide/FEATURE_MAP.md` using its template.
6. **Update `ai/guide/ARCHITECTURE.md` and `PROJECT_OVERVIEW.md`** only where you
   VERIFIED something in code or config.

## Hard rules for this pass
- Tag EVERYTHING you write `[inferred]`. You are guessing; say so.
- Separate OBSERVED facts (file A imports B) from INFERENCES (A is "the domain layer").
- On a fork: mark anything that looks inherited as Stability `frozen` and FLAG it
  "UNSURE — needs human", rather than asserting it.
- Where you cannot tell, write `?` and "UNSURE — needs human". Never guess confidently.
- Do NOT modify any source file. Only write inside `ai/`.

## Re-run safety
If rows already carry `[verified]`, leave them unchanged. Only populate rows that are
still `?` or contain placeholder text like `<fill in>`.

## Stop condition
When the drafts are written, STOP and print an "AUDIT TODO" table:

| # | Location | What to verify | Why uncertain |
|---|---|---|---|
| 1 | `ai/guide/MODULE_MAP.md` row X | … | [inferred] / `?` stability |

Cover: all rows still `?`, all `frozen` guesses needing confirmation, and any protocol
or command assumptions still `[inferred]`. The human sets Stability and flips
`[inferred]` → `[verified]`. Do not proceed to building features.

Tell the user that after they complete their audit, they can run the following prompts
to check the configuration and knowledge layer:
- `/review-agent-config` — to perform a quick diagnostic check of `CLAUDE.md` and `AGENTS.md` structural completeness and consistency.
- `/post-cold-start-verification` — to perform a deep semantic audit of all drafted `ai/` files.
