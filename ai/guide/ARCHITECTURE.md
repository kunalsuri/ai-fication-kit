<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Architecture — ai-fication-kit

> Status: drafted by an `[inferred]` cold-start pass on 2026-06-14 (the kit dogfooding
> itself). A human audits it; flip claims to `[verified] (date)` once confirmed.

## The big pieces  `[inferred]`
- **CLI shell** (`install.mjs` / `install.py`) — arg parsing and command dispatch only; no business logic.
- **`lib/util.mjs`** (and `lib/util.py`) — shared fs probes, prompts, constants (incl. `KIT_VERSION`).
- **`lib/orient.mjs`** — deterministic stack detection from marker files → `ai/repo-profile.json`.
- **`lib/installer.mjs`** — stamps `templates/` into the target, substitutes `{{PLACEHOLDERS}}`, writes `ai/install-manifest.json`; manifest-based `uninstall`.
- **`lib/verify.mjs`** — extracts backtick path claims from the knowledge docs and checks each against the real tree (no LLM).
- **`templates/`** — the payload: root guides, the `ai/` knowledge layer, and `templates/claude/` (commands/subagents/skill).

## How they connect  `[inferred]`
The CLI parses argv, then calls `orient` → `install` (→ `verify`/`uninstall` on demand).
Two runtimes (Node, Python) are kept deliberately behavior-identical and are exercised
by the same smoke suite. The only "protocol" is the filesystem: `orient` writes a JSON
profile that `install` reads; `install` writes a manifest that `uninstall` reads.

## Diagrams
Text-based (Mermaid) diagrams live in `ai/analysis/diagrams/`. Regenerate them via
/cold-start; do not hand-maintain. (Not yet drafted for this repo — see AUDIT TODO.)

## Invariants an agent must not break  `[verified] required`
<Only humans add rows here. Candidate invariants to confirm: "install.mjs and
install.py must stay behavior-identical", "the installer never writes outside the
target dir", "agents never flip [inferred] → [verified]".>
