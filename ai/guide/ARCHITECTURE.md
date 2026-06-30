<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Architecture — ai-fication-kit

> Status: drafted by an `[inferred]` cold-start pass on 2026-06-14 (the kit dogfooding
> itself). A human audits it; flip claims to `[verified] (date)` once confirmed.

## The big pieces  `[inferred]`
- **CLI shell** (`install.mjs` / `install.py`) — arg parsing and command dispatch only; no business logic.
- **`lib/util.mjs`** (and `lib/util.py`) — shared fs probes, prompts, constants (incl. `KIT_VERSION`).
- **`lib/orient.mjs`** (and `lib/orient.py`) — deterministic stack detection from marker files → `ai/repo-profile.json`.
- **`lib/indepth.mjs`** (and `lib/indepth.py`) — comprehensive Tier-2 analysis of dependencies, structure, code metrics, git history, configurations, and scalability → `ai/repo-indepth.json`.
- **`lib/installer.mjs`** (and `lib/installer.py`) — stamps `templates/` into the target, substitutes `{{PLACEHOLDERS}}`, writes `ai/install-manifest.json`; manifest-based `uninstall`.
- **`lib/verify.mjs`** (and `lib/verify.py`) — extracts backtick path claims from the knowledge docs and checks each against the real tree (no LLM).
- **`lib/drift.mjs`** (and `lib/drift.py`) — reverse mapping validation checking for unmapped, vanished, and stale verified modules.
- **`lib/maturity.mjs`** (and `lib/maturity.py`) — deterministic repository maturity assessment engine.
- **`lib/intake.mjs`** (and `lib/intake.py`) — interactive CLI wizard that guides target repository onboarding.
- **`templates/`** — the payload: root guides, the `ai/` knowledge layer, and `templates/claude/` (commands/subagents/skill).

## How they connect  `[inferred]`
The CLI parses argv, then handles command routing. When running `shazam` (or interactive `orient`), it invokes the `intake` wizard which prompts the user for the analysis level. Tier 1 (`orient`) writes `ai/repo-profile.json`. Tier 2 (`indepth`) builds on Tier 1 and generates `ai/repo-indepth.json` with structural and scalability heuristics. The `install` step then stamps templates from `templates/` into the target. Claims and drift checks (`verify` and `drift` commands) can be run on demand, writing audit reports to `ai/analysis/audit-reports/`. Both Node and Python runtimes remain behavior-identical and are verified by the same smoke test suite.

## Diagrams
Text-based (Mermaid) diagrams live in `ai/analysis/diagrams/`. Regenerate them via
/cold-start; do not hand-maintain. (Not yet drafted for this repo — see AUDIT TODO.)

## Invariants an agent must not break  `[verified] required`
<Only humans add rows here. Candidate invariants to confirm: "install.mjs and
install.py must stay behavior-identical", "the installer never writes outside the
target dir", "agents never flip [inferred] → [verified]".>
