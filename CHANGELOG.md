<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/).

## [0.1.0] — 2026-06-12
### Added
- `verify` — deterministic claim verification (ported from the Method v1 PowerShell
  verifiers, made stack-agnostic). Extracts every backtick-quoted path claim from
  CLAUDE.md, AGENTS.md, `ai/guide/*.md`, and `ai/analysis/FEATURE_CATALOG*.md`,
  cross-checks each against the real file tree, and writes
  `ai/analysis/audit-reports/VERIFICATION_MANIFEST.json` (machine-readable,
  confirmed/moved/missing per claim) plus `VERIFICATION_REPORT.md`. No LLM, no
  execution, no network. `--strict` exits 1 on unconfirmed claims (for CI);
  `--dry-run` prints without writing. Available in both installers.
- `/post-cold-start-verification` now consumes the verification manifest first and
  spends the agent pass only on semantic checks a script cannot judge.

### Changed
- Installers split for auditability: `install.mjs` / `install.py` are now thin CLIs
  over four small single-purpose modules in `lib/` (`util`, `orient`, `installer`,
  `verify`), mirrored 1:1 between Node and Python. Entry points, commands, flags,
  and behavior are unchanged; still zero dependencies.


**Method v2 reference implementation** — first public release.

### Added
- `orient` — deterministic repository detection (languages, build systems, build/test
  commands, fork status, test layout). Pure file inspection; no LLM, no network.
  Writes `ai/repo-profile.json`.
- `install` — stamps the generic templates (`templates/`) into a target repo,
  substituting detected facts. Writes `ai/install-manifest.json` for clean uninstall.
- `shazam` — the one-shot pipeline: orient → install → next-steps. *(Named in homage
  to this project's prototype, `ai-fication-shazam`. The command stops exactly where
  inference begins: it scaffolds and detects, then hands the audit to you.)*
- `uninstall` — removes exactly the files listed in the install manifest, nothing else.
- Two zero-dependency installers (`install.mjs`, Node ≥ 18; `install.py`, Python ≥ 3.8)
  with identical behavior, `--dry-run`, and `--force`.
- The `ai/` knowledge layer: `guide/` (navigation, loaded every session),
  `analysis/` (generated artifacts, on demand), `lab/` (specs, ADRs, evaluations,
  experiments), with `INDEX.md` as the role→path manifest.
- Claude Code command suite: `/cold-start`, `/post-cold-start-verification`,
  `/create-feature-catalog`, `/verify-ai-readiness`, `/perform-feature-add-simulation`,
  `/add-feature`; subagents `repo-explorer`, `feature-builder`, `test-runner`;
  `add-feature` skill.
- Provenance discipline baked into every template: agent output is `[inferred]`
  until a human flips it to `[verified]`.
- Cross-platform smoke tests (`test/run-tests.mjs`) and CI on Linux/macOS/Windows.

### Method lineage
- Method v1 was prototyped in `ai-fication-shazam` and exercised at industrial scale
  on a fork of Eclipse SysON. This release generalizes those results.

[0.1.0]: https://github.com/kunalsuri/ai-fication-kit/releases/tag/v0.1.0
