<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/).

## [0.1.0] — 2026-06-25

First public release of the `ai-fication-kit` — a tool to create a knowledge layer that gives AI coding agents a trusted map of any existing or legacy codebase.

### Added
- **Onboarding docs for new users**: A single linear [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md) (zero → trusted map in five steps, with a checkpoint after each) and a [`docs/GLOSSARY.md`](docs/GLOSSARY.md) defining every term the kit assumes (`[inferred]`/`[verified]`, Stability, slash commands, subagents, the command set). Surfaced from the top of the README and sequenced in the `docs/` index. The `legacy-calculator` example README is now a full before/after walkthrough.
- **Doc-link guard in the test suite**: `test/run-tests.mjs` now checks that every local link in the human-facing docs (README, `docs/**`, `examples/**`) resolves on disk — the honesty check `verify` applies to the knowledge layer, now extended to the prose docs so a dead relative link fails CI. Zero dependencies, no model.
- **Drift Detection (`drift`)**: The reverse of `verify` — reports where the code has outgrown the map. Detects `unmapped` (code-bearing directories no `MODULE_MAP.md` row covers), `vanished` (directories/entry points the map quotes that are gone), and, with the opt-in `--git` flag, `stale` (`[verified]` rows whose code changed since the verified commit). Structural checks stay execution-free; only `--git` runs a local, read-only `git`. Writes `DRIFT_MANIFEST.json` + `DRIFT_REPORT.md`; supports `--strict` (CI) and `--dry-run`. Mirrored in both runtimes (`lib/drift.mjs`, `lib/drift.py`).
- **Value Demo (`examples/value-demo/`)**: A deterministic, zero-dependency demonstration of what the `ai/` map is worth. `measure.mjs` compares the context an agent must read to do one fixed task with and without the map on a bundled multi-module `sample-app` (~3× less, ~68% saved). A companion case study lives in `ai/lab/evaluations/`.
- **Dual-Mode Support (Legacy + Modern repos)**: The kit now handles both legacy repos (no existing AI config) and modern repos (with existing `CLAUDE.md`/`AGENTS.md`). A new deterministic `check-repo-maturity` command runs 11 read-only checks to produce a scored AI readiness report and determines Process 1 vs Process 2 automatically.
  - **`check-repo-maturity` command** (`lib/maturity.mjs`, `lib/maturity.py`): Standalone read-only diagnostic — runs 11 file-existence checks (AI config, version control, build system, test infra, CI/CD, docs, locks, code structure, license, security, gitignore), scores 0–100, determines process, prints a rich console report, and writes `MATURITY_REPORT.json`. No LLM, no file writes beyond the report.
  - **Process 2 backup flow**: When user-authored `CLAUDE.md` or `AGENTS.md` exist (detected by absence of the kit footer marker), the installer creates timestamped backups (e.g. `CLAUDE_bkp_20260617_221847.md`) before overwriting with kit templates. Multiple runs create new backups without conflict.
  - **`/cold-start` Step 0.5 (knowledge extraction)**: For Process 2 repos, `/cold-start` reads `*_bkp_*.md` files and extracts useful knowledge (conventions, architecture, gotchas, module descriptions) into the appropriate `ai/guide/` documents, tagged `[inferred — from prior config]`.
  - **Process-aware intake wizard**: The first-run wizard now explains the backup flow for Process 2 repos and asks for confirmation.
  - **Process-aware uninstall**: `uninstall` reports backup file locations but does not remove them — the user's prior knowledge is preserved.
  - **`ai/` knowledge-base documentation**: Templates (`CLAUDE.md.tmpl`, `AGENTS.md.tmpl`, `ai/INDEX.md.tmpl`) updated to describe the `ai/` folder as the single source of truth for repository intelligence.
  - **30 new test scenarios** covering maturity check, Process 1/2 detection, backup creation, content preservation, kit-footer exclusion, partial backups, uninstall reporting, and verify-after-backup.
- **Multi-Runtime Zero-Dependency Installers**: Includes both Node.js (`install.mjs`) and Python (`install.py`) installers using only the standard library (no external packages to trust, no network access, and no arbitrary code execution).
- **Deterministic Stack Detection (`orient`)**: Deterministically detects repository language, build tools, build/test commands, test layout, and fork status. Writes `ai/repo-profile.json`.
- **Intake Wizard**: Friendly interactive wizard during `shazam` that captures developer maturity and stack details, plus warns against setup on master/main branch. Self-skips when run with `--yes` or in non-TTY environments.
- **Template Stamping (`install`)**: Stamps generic repo-intelligence maps and templates into the target repo, writing a manifest `ai/install-manifest.json` for clean uninstall.
- **One-Shot Scaffolding (`shazam`)**: Pipeline that runs `orient`, starts the intake wizard, stamps the intelligence layer templates, and prints clear next steps.
- **Strict Claim Verification (`verify`)**: Deterministically parses and cross-checks all backtick-quoted path claims within the `ai/` docs against the live codebase directory tree. Outputs `VERIFICATION_MANIFEST.json` and `VERIFICATION_REPORT.md` (no LLM). Supports `--strict` to fail on stale/missing claims (ideal for CI) and `--dry-run`.
- **Knowledge Layer Scaffolding (`ai/`)**: Scaffolds structured directories for guides, generated analysis, decisions (ADRs), specs, evaluations, and experiments.
- **Claude Code Integration**: Stamps custom slash commands (e.g. `/cold-start`, `/verify-ai-readiness`, `/add-feature`), subagents (`repo-explorer`, `feature-builder`, `test-runner`), and the `add-feature` agent skill.
- **Uninstall Command**: Removes exactly what the installer wrote using the manifest record without touching any other files.
- **Smoke Test Suite**: Cross-runtime test suite (`test/run-tests.mjs`) to verify Node and Python installers, stack detection, and verify operations.

[0.1.0]: https://github.com/kunalsuri/ai-fication-kit/releases/tag/v0.1.0
