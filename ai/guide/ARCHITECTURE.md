<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Architecture — ai-fication-kit

> Status: drafted by an `[inferred]` cold-start pass on 2026-06-14 (the kit dogfooding
> itself). A human audits it; flip claims to `[verified] (date)` once confirmed.

## The big pieces  `[inferred]`
- **CLI shell** (`install.mjs`) — arg parsing and command dispatch only; no business logic.
- **`lib/util.mjs`** — shared fs probes, prompts, constants (incl. `KIT_VERSION`).
- **`lib/orient.mjs`** — deterministic stack detection from marker files → `ai/repo-profile.json`.
- **`lib/indepth.mjs`** — comprehensive Tier-2 analysis of dependencies, structure, code metrics, git history, configurations, and scalability → `ai/repo-indepth.json`.
- **`lib/installer.mjs`** — stamps `templates/` into the target, substitutes `{{PLACEHOLDERS}}`, writes `ai/install-manifest.json`; manifest-based `uninstall`.
- **`lib/verify.mjs`** — extracts backtick path claims from the knowledge docs and checks each against the real tree (no LLM).
- **`lib/drift.mjs`** — reverse mapping validation checking for unmapped, vanished, and stale verified modules.
- **`lib/maturity.mjs`** — deterministic repository maturity assessment engine.
- **`lib/intake.mjs`** — interactive CLI wizard that guides target repository onboarding.
- **`templates/`** — the payload: root guides, the `ai/` knowledge layer, and `templates/claude/` (commands/subagents/skill).

## How they connect  `[inferred]`
The CLI parses argv, then handles command routing. When running `shazam` (or interactive `orient`), it invokes the `intake` wizard which prompts the user for the analysis level. Tier 1 (`orient`) writes `ai/repo-profile.json`. Tier 2 (`indepth`) builds on Tier 1 and generates `ai/repo-indepth.json` with structural and scalability heuristics. The `install` step then stamps templates from `templates/` into the target. Claims and drift checks (`verify` and `drift` commands) can be run on demand, writing audit reports to `ai/analysis/audit-reports/`. The single Node.js runtime is verified by the smoke test suite. (The parallel Python implementation was removed in v0.2.)

## Diagrams
Text-based (Mermaid) diagrams live in `ai/analysis/diagrams/`. Regenerate them via
/cold-start; do not hand-maintain. Drafted `[inferred]` on 2026-07-02:
- `ai/analysis/diagrams/package-deps.mmd` — module dependency graph (Node runtime)
- `ai/analysis/diagrams/domain-core.mmd` — commands → artifacts they produce/consume
- `ai/analysis/diagrams/seam.mmd` — the deterministic-vs-inference seam and the human trust flip

## Invariants an agent must not break  `[verified] required`
<Only humans add rows here. Candidate invariants to confirm: "the installer never
writes outside the target dir", "agents never flip [inferred] → [verified]".>
