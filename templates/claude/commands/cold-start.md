---
description: Bootstrap the ai/guide maps and diagrams (the cold-start pass). Drafts everything as [inferred] for a human to audit.
---

Run the **cold-start bootstrap**. This is a one-time, read-and-write-docs-only pass.
You will draft the AI metadata; a human will audit it afterward. Do NOT touch source code.

## Step 0 — load the facts
Read `ai/repo-profile.json` (deterministic output of the kit's orient step). Treat its
stack facts as given; VERIFY its build/test commands against real config files before
writing them anywhere as confirmed. If the profile says this repo is a fork,
**distinguishing OUR code from FROZEN upstream code is the single most important
output of this pass.**

## Steps
1. **Explore cheaply.** Prefer the `repo-explorer` subagent to protect this context
   window. List the tree 2 levels deep; read build manifests (not source); check the
   last ~30 commit subjects for active areas. Prefer grep + line counts over
   whole-file reads.
2. **Fill `ai/guide/MODULE_MAP.md`:** one row per module/package — directory, a
   one-line responsibility, the entry-point file, and a Stability GUESS. Use the
   ACTUAL names you found; do not assume names.
3. **Draft diagrams into `ai/analysis/diagrams/`** as Mermaid `.mmd`:
   `package-deps.mmd` (dependency graph), `domain-core.mmd` (core types),
   `seam.mmd` (the main boundary — note the protocol as a question if unverified).
4. **Note candidate features** in `ai/guide/FEATURE_MAP.md` using its template.
5. **Update `ai/guide/ARCHITECTURE.md` and `PROJECT_OVERVIEW.md`** only where you
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
