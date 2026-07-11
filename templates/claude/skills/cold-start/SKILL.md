---
name: cold-start
description: Bootstrap the ai/ knowledge layer for a repo that has none — draft the MODULE_MAP, diagrams, and guide docs as [inferred] for a human to audit, touching no source code. Use when the maps are still placeholders or the user asks to cold-start, bootstrap, or onboard a repository.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

# Cold-start the knowledge layer

The contract: **read-and-write-docs-only — touch no source code, tag everything
`[inferred]`, and stop at an AUDIT TODO for the human. You draft the map; a human
verifies it before any feature is built.**

## 1. Load the facts
Read `ai/repo-profile.json` (deterministic output of the kit's orient step). Treat
its stack facts as given; VERIFY its build/test commands against the real config
files before writing them anywhere as confirmed. If the profile says this repo is a
fork, **separating OUR code from FROZEN upstream code is the single most important
output of this pass.** If a `humanContext` block is present, use it:
`developer.skillLevel`/`codebaseFamiliarity` calibrate how conservative your
Stability guesses are; `stack.kind` tells you whether to map a frontend/backend
split; record `branch`/`firstRunAt` in `PROJECT_OVERVIEW.md`.

## 2. Absorb prior config (Process 2 repos only)
If `repo-profile.json` → `maturity.process` is `2`, `CLAUDE_bkp_*.md` /
`AGENTS_bkp_*.md` exist at the repo root with the team's previous AI configuration.
Read them, extract KNOWLEDGE — not raw text — (build commands, conventions,
architecture notes, gotchas, module descriptions) and merge it into
`ai/guide/CONVENTIONS.md`, `ai/guide/ARCHITECTURE.md`, `ai/guide/MODULE_MAP.md`
(seed rows), and `ai/guide/PROJECT_OVERVIEW.md`. Tag every extract
`[inferred — from prior config]`.

## 3. Explore cheaply
Delegate broad reading to the `repo-explorer` subagent to protect this context
window: list the tree 2 levels deep, read build manifests (not source), scan the
last ~30 commit subjects for active areas. Prefer grep + line counts over
whole-file reads. Read only — modify nothing in this step.

## 4. Fill MODULE_MAP
`ai/guide/MODULE_MAP.md`: one row per module/package — directory, a one-line
responsibility, the entry-point file, and a Stability GUESS. Use the ACTUAL names
you found; do not assume names. Each row has FIVE cells — Directory,
Responsibility, Entry point, Stability guess, Status — and the Status cell is
where the `[inferred]` tag goes (the tooling reads provenance from the LAST
cell only).

## 5. Correct the stamped commands
If the build/test commands you verified in config files differ from the
Build/Test lines stamped into `CLAUDE.md` and `AGENTS.md`, correct exactly
those lines (and the Definition-of-done line in `ai/guide/CONVENTIONS.md`),
tag the correction `[inferred]`, and change nothing else in those files. This
is the sanctioned exception to the No-Churn rule.

## 6. Draft diagrams
Into `ai/analysis/diagrams/` as Mermaid `.mmd`: `package-deps.mmd` (dependency
graph), `domain-core.mmd` (core types), `seam.mmd` (the main boundary — note the
protocol as a question if unverified).

## 7. Note features, update the guides
Note candidate features in `ai/guide/FEATURE_MAP.md` using its template. Update
`ai/guide/ARCHITECTURE.md` and `ai/guide/PROJECT_OVERVIEW.md` only where you
VERIFIED something in code or config.

## 8. Hard rules for this pass
- Tag EVERYTHING you write `[inferred]`. You are guessing; say so.
- Separate OBSERVED facts (file A imports B) from INFERENCES (A is "the domain layer").
- On a fork: mark anything inherited as Stability `frozen` and FLAG it
  "UNSURE — needs human" rather than asserting it.
- Where you cannot tell, write `?` and "UNSURE — needs human". Never guess confidently.
- Do NOT modify any source file. Only write inside `ai/`.
- Re-run safety: leave rows already carrying `[verified]` unchanged; only populate
  rows still `?` or holding placeholder text like `<fill in>`.

## 9. Stop and report
Print an "AUDIT TODO" table (columns: # · Location · What to verify · Why uncertain)
covering every row still `?`, every `frozen` guess needing confirmation, and any
protocol/command assumption still `[inferred]`. The human sets Stability and flips
`[inferred]` → `[verified]`. Do NOT proceed to building features. Tell the user they
can run `/review-agent-config` (structural check of CLAUDE.md/AGENTS.md) and
`/post-cold-start-verification` (deep semantic audit) once their audit is done.
