<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/).

## [0.1.0] — 2026-06-12

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
