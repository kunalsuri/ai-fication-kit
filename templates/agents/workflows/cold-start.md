---
description: Bootstrap the ai/guide maps and diagrams (the cold-start pass). Drafts everything as [inferred] for a human to audit.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

1. **Load the facts.** Read `ai/repo-profile.json` (deterministic output of the kit's
   orient step). Treat its stack facts as given; VERIFY its build/test commands
   against real config files before writing them anywhere as confirmed. If the
   profile says this repo is a fork, distinguishing OUR code from FROZEN upstream
   code is the single most important output of this pass.
   - If the profile has a `humanContext` block (from the first-run wizard), use it:
     `developer.skillLevel`/`codebaseFamiliarity` calibrates how conservative you are
     with Stability guesses; `stack.kind` tells you whether to map a frontend/backend
     split; record `branch`/`firstRunAt` in `PROJECT_OVERVIEW.md`.
2. **Absorb prior knowledge (Process 2 repos only).** Check `repo-profile.json` →
   `maturity.process`. If it is `2`, `CLAUDE_bkp_*.md` / `AGENTS_bkp_*.md` exist at
   the repo root with the team's previous AI configuration. Read them, extract build
   commands, conventions, architecture notes, gotchas, and module descriptions, and
   merge that KNOWLEDGE (not the raw text) into `ai/guide/CONVENTIONS.md`,
   `ARCHITECTURE.md`, `MODULE_MAP.md` (seed rows), and `PROJECT_OVERVIEW.md`. Tag
   everything extracted as `[inferred — from prior config]`.
3. **Explore cheaply and read-only.** List the tree 2 levels deep; read build
   manifests (not source); check the last ~30 commit subjects for active areas.
   Prefer grep + line counts over whole-file reads — do not modify anything in
   this step.
4. **Fill `ai/guide/MODULE_MAP.md`.** One row per module/package: directory, a
   one-line responsibility, the entry-point file, and a Stability GUESS. Use the
   ACTUAL names you found; do not assume names. Each row has FIVE cells —
   Directory, Responsibility, Entry point, Stability guess, Status — and the
   Status cell is where the `[inferred]` tag goes (the tooling reads provenance
   from the LAST cell only).
5. **Correct the stamped commands.** If the build/test commands you verified in
   config files differ from the Build/Test lines stamped into `CLAUDE.md` and
   `AGENTS.md`, correct exactly those lines (and the Definition-of-done line in
   `ai/guide/CONVENTIONS.md`), tag the correction `[inferred]`, and change
   nothing else in those files. This is the sanctioned exception to the
   No-Churn rule.
6. **Draft diagrams into `ai/analysis/diagrams/`** as Mermaid `.mmd`:
   `package-deps.mmd` (dependency graph), `domain-core.mmd` (core types), `seam.mmd`
   (the main boundary — note the protocol as a question if unverified).
7. **Note candidate features** in `ai/guide/FEATURE_MAP.md` using its template.
8. **Update `ai/guide/ARCHITECTURE.md` and `PROJECT_OVERVIEW.md`** only where you
   VERIFIED something in code or config.
9. **Apply the hard rules for this pass:**
   - Tag EVERYTHING you write `[inferred]`. You are guessing; say so.
   - Separate OBSERVED facts (file A imports B) from INFERENCES (A is "the domain layer").
   - On a fork: mark anything that looks inherited as Stability `frozen` and FLAG it
     "UNSURE — needs human", rather than asserting it.
   - Where you cannot tell, write `?` and "UNSURE — needs human". Never guess confidently.
   - Do NOT modify any source file. Only write inside `ai/`.
   - Re-run safety: if a row already carries `[verified]`, leave it unchanged; only
     populate rows still `?` or holding placeholder text like `<fill in>`.
10. **Stop and report.** Print an "AUDIT TODO" table (columns: # · Location · What to
   verify · Why uncertain) covering every row still `?`, every `frozen` guess needing
   confirmation, and any protocol/command assumption still `[inferred]`. The human
   sets Stability and flips `[inferred]` → `[verified]`. Do not proceed to building
   features. Tell the user they can run `/review-agent-config` (structural check of
   CLAUDE.md/AGENTS.md) and `/post-cold-start-verification` (deep semantic audit)
   once their audit is done.
