<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Feature map — feature → files, intent, gotchas

> [!NOTE]
> **This is a scaffolded template.** Run the `/cold-start` slash command in Claude Code (or see [docs/FAQ.md#cursor-copilot-codex](../../docs/FAQ.md#cursor-copilot-codex) for other tools) to have the agent explore your repository and automatically populate this file.

> Humans think in features; agents should too. This file holds the SHORT version —
> per-feature pointers and non-obvious notes. The full generated catalog lives in
> `ai/analysis/FEATURE_CATALOG.md` (via /create-feature-catalog).

## Template (copy per feature)

### <Feature name>  `[inferred]`
- **Business goal:** <one line>
- **Touches:** <dirs/files across layers — UI, backend, persistence, tests>
- **Verify with:** <the specific test command or suite>
- **Gotchas:** <the non-obvious thing that bites people>
- **Related:** <other features that share code paths>

## Candidate features (drafted by /cold-start, audit before trusting)

### orient  `[inferred]`
- **Business goal:** Perform deterministic, fast stack detection from target repository marker files.
- **Touches:** `install.mjs`, `install.py`, `lib/orient.mjs`, `lib/orient.py`, `lib/util.mjs`, `lib/util.py`
- **Verify with:** `node install.mjs orient . --dry-run` or `python install.py orient . --dry-run`
- **Gotchas:** Runs in ~200ms by strictly performing file-existence checks (no network, zero execution, no LLM).
- **Related:** `shazam`, `indepth`

### indepth  `[inferred]`
- **Business goal:** Perform extensive local analysis of dependencies, code metrics, git history, configuration, and architecture heuristics.
- **Touches:** `install.mjs`, `install.py`, `lib/indepth.mjs`, `lib/indepth.py`, `lib/util.mjs`, `lib/util.py`
- **Verify with:** `node install.mjs indepth . --dry-run` or `python install.py indepth . --dry-run`
- **Gotchas:** Requires local git CLI binary for history features (falls back gracefully if missing). Strictly offline and zero-network.
- **Related:** `orient`, `shazam`

### intake  `[inferred]`
- **Business goal:** Provide a user-friendly CLI wizard to guide new users through repo profile configuration.
- **Touches:** `install.mjs`, `install.py`, `lib/intake.mjs`, `lib/intake.py`, `lib/util.mjs`, `lib/util.py`
- **Verify with:** `node install.mjs shazam . --interactive` (interactive choose prompt)
- **Gotchas:** Automatically bypassed in non-TTY/non-interactive shells (e.g. CI environments) or if `--yes` / `--skip-prompt` is provided.
- **Related:** `shazam`

### install  `[inferred]`
- **Business goal:** Copy and stamp `templates/` into the target repo using detected profile facts.
- **Touches:** `install.mjs`, `install.py`, `lib/installer.mjs`, `lib/installer.py`, `templates/`
- **Verify with:** `node install.mjs install . --dry-run`
- **Gotchas:** Records every written path in `ai/install-manifest.json` for deterministic cleanup. Never overwrites files without `--force`.
- **Related:** `uninstall`, `shazam`

### verify  `[inferred]`
- **Business goal:** Mechanically extract and check every backtick-quoted path claim in the knowledge documents against the active directory tree.
- **Touches:** `install.mjs`, `install.py`, `lib/verify.mjs`, `lib/verify.py`
- **Verify with:** `node install.mjs verify . --strict`
- **Gotchas:** Requires exact file paths. Path checking is case-sensitive on Linux/macOS but case-insensitive on Windows by default.
- **Related:** `drift`, `deep-test`

### drift  `[inferred]`
- **Business goal:** Analyze codebase to identify unmapped active source directories, vanished map entries, and stale verified modules.
- **Touches:** `install.mjs`, `install.py`, `lib/drift.mjs`, `lib/drift.py`
- **Verify with:** `node install.mjs drift . --strict` (or `--git` for stale checks)
- **Gotchas:** The stale check runs a read-only git command to detect modified files; it requires a valid git history and will be skipped in shallow clones.
- **Related:** `verify`, `deep-test`

### maturity  `[inferred]`
- **Business goal:** Calculate repository readiness level and process maturity based on presence of standard developer guidelines and configuration files.
- **Touches:** `install.mjs`, `install.py`, `lib/maturity.mjs`, `lib/maturity.py`
- **Verify with:** `node install.mjs check-repo-maturity .`
- **Gotchas:** Outputs a JSON maturity report and does not perform any file writes.
- **Related:** `orient`, `indepth`

### deep-test  `[inferred]`
- **Business goal:** Validate repository standards compliance, including smoke tests, verification, drift, license headers, and placeholders.
- **Touches:** `test/run-deep-test.mjs`, `package.json`
- **Verify with:** `npm run deep-test`
- **Gotchas:** Enforces license headers (Apache-2.0) on all `.js`, `.mjs`, `.py`, `.md` source files and checks for leaked template placeholders (`{{...}}`).
- **Related:** `verify`, `drift`

### ci-checks  `[inferred]`
- **Business goal:** Provide a GitHub Actions workflow template that runs `verify --strict` and `drift --git --strict` automatically on push/PR for target repos.
- **Touches:** `templates/github/workflows/ai-check.yml.tmpl`, `.github/workflows/ai-check.yml`, `lib/installer.mjs`, `lib/installer.py`
- **Verify with:** `npm test` (integration test checks `.github/workflows/ai-check.yml` is installed)
- **Gotchas:** The template uses `npm install -g ai-fication-kit` to fetch the kit in CI; requires the package to be published to npm. The kit's own self-hosted workflow uses `node install.mjs` directly.
- **Related:** `verify`, `drift`, `install`

### check-drift (Claude command)  `[inferred]`
- **Business goal:** Provide a Claude Code slash command (`/check-drift`) for interactive verification and drift analysis of the `ai/` knowledge-base.
- **Touches:** `templates/claude/commands/check-drift.md`, `.claude/commands/check-drift.md`
- **Verify with:** `npm test` (integration test checks `.claude/commands/check-drift.md` is installed)
- **Gotchas:** Uses `--strict` flags matching CI for consistency. Instructs the agent to mark changes as `[inferred]`.
- **Related:** `verify`, `drift`, `ci-checks`

