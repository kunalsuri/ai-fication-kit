<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Feature map — feature → files, intent, gotchas

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
- **Touches:** `install.mjs`, `lib/orient.mjs`, `lib/util.mjs`
- **Verify with:** `node install.mjs orient . --dry-run`
- **Gotchas:** Runs in ~200ms by strictly performing file-existence checks (no network, zero execution, no LLM).
- **Related:** `shazam`, `indepth`

### indepth  `[inferred]`
- **Business goal:** Perform extensive local analysis of dependencies, code metrics, git history, configuration, and architecture heuristics.
- **Touches:** `install.mjs`, `lib/indepth.mjs`, `lib/util.mjs`
- **Verify with:** `node install.mjs indepth . --dry-run`
- **Gotchas:** Requires local git CLI binary for history features (falls back gracefully if missing). Strictly offline and zero-network.
- **Related:** `orient`, `shazam`

### intake  `[inferred]`
- **Business goal:** Provide a user-friendly CLI wizard to guide new users through repo profile configuration.
- **Touches:** `install.mjs`, `lib/intake.mjs`, `lib/util.mjs`
- **Verify with:** `node install.mjs shazam .` from a real terminal (wizard prompts appear before install)
- **Gotchas:** The first-run wizard skips itself in non-TTY shells (e.g. CI) or when `--yes` is passed; `--skip-prompt` bypasses only the analysis-level chooser, not the wizard. Answers land under `humanContext` in `ai/repo-profile.json`, and the wizard is skipped on re-runs once `humanContext` exists.
- **Related:** `shazam`

### install  `[inferred]`
- **Business goal:** Copy and stamp `templates/` into the target repo using detected profile facts.
- **Touches:** `install.mjs`, `lib/installer.mjs`, `templates/`
- **Verify with:** `node install.mjs install . --dry-run`
- **Gotchas:** Records every written path in `ai/install-manifest.json` for deterministic cleanup. Never overwrites files without `--force` — except files it just backed up in the Process-2 flow (see `shazam`), which are intentionally replaced. Re-installs merge into the existing manifest so no written path is ever forgotten.
- **Related:** `uninstall`, `shazam`

### shazam (one-shot onboarding)  `[inferred]`
- **Business goal:** Single command that takes a repo from unknown to AI-ready: maturity check → orient → optional indepth → first-run wizard → install → printed next steps.
- **Touches:** `install.mjs`, `lib/maturity.mjs`, `lib/orient.mjs`, `lib/intake.mjs`, `lib/installer.mjs`
- **Verify with:** `node install.mjs shazam . --dry-run --yes`
- **Gotchas:** On Process-2 repos (existing hand-written `CLAUDE.md`/`AGENTS.md` without the kit footer), the installer first backs them up as `CLAUDE_bkp_<timestamp>.md` / `AGENTS_bkp_<timestamp>.md` so `/cold-start` can mine the prior knowledge; backups are never deleted by `uninstall`. The analysis-level prompt defaults to "general" when non-interactive.
- **Related:** `orient`, `indepth`, `intake`, `install`

### uninstall  `[inferred]`
- **Business goal:** Remove exactly the files the installer recorded, and nothing else.
- **Touches:** `install.mjs`, `lib/installer.mjs`
- **Verify with:** `node install.mjs uninstall . --dry-run`
- **Gotchas:** Deletes only paths listed in `ai/install-manifest.json` and refuses any path that resolves outside the target directory. Now-empty directories are pruned best-effort (deepest first); `*_bkp_*.md` backup files are reported but deliberately left in place.
- **Related:** `install`, `shazam`

### verify  `[inferred]`
- **Business goal:** Mechanically extract and check every backtick-quoted path claim in the knowledge documents against the active directory tree.
- **Touches:** `install.mjs`, `lib/verify.mjs`
- **Verify with:** `node install.mjs verify . --strict`
- **Gotchas:** Claim matching is case-INSENSITIVE by design on every platform (both index and lookup are lowercased in `lib/verify.mjs`), so a claim can stay confirmed even if its casing no longer matches the file on disk. Claims containing whitespace, globs, or `<placeholders>` are ignored.
- **Related:** `drift`, `deep-test`

### drift  `[inferred]`
- **Business goal:** Analyze codebase to identify unmapped active source directories, vanished map entries, and stale verified modules.
- **Touches:** `install.mjs`, `lib/drift.mjs`
- **Verify with:** `node install.mjs drift . --strict` (or `--git` for stale checks)
- **Gotchas:** The stale check runs a read-only git command to detect modified files; it requires a valid git history and will be skipped in shallow clones. `--suggest` appends ready-to-paste MODULE_MAP rows/line pointers to the report and a `suggestions` array to the manifest — it never edits `MODULE_MAP.md` itself, and the entry-point guess is deterministic (`index.*`/`main.*`, else largest source file).
- **Related:** `verify`, `deep-test`

### maturity  `[inferred]`
- **Business goal:** Calculate repository readiness level and process maturity based on presence of standard developer guidelines and configuration files.
- **Touches:** `install.mjs`, `lib/maturity.mjs`
- **Verify with:** `node install.mjs check-repo-maturity .`
- **Gotchas:** Outputs a JSON maturity report and does not perform any file writes.
- **Related:** `orient`, `indepth`

### doctor  `[inferred]`
- **Business goal:** Tell a beginner exactly which of the 5 workflow stages they're on and what to run next, without them piecing it together from three other commands.
- **Touches:** `install.mjs`, `lib/doctor.mjs`, `lib/drift.mjs` (reuses the exported `parseModuleMap`)
- **Verify with:** `node install.mjs doctor .`
- **Gotchas:** Read-only by design — never writes a file, so it's always safe to run. Placeholder detection matches the exact `<fill in>` text from `templates/ai/guide/MODULE_MAP.md.tmpl`; step 4 treats missing verify/drift manifests the same as manifests recording failures.
- **Related:** `verify`, `drift`

### deep-test  `[inferred]`
- **Business goal:** Validate repository standards compliance, including smoke tests, verification, drift, license headers, and placeholders.
- **Touches:** `test/run-deep-test.mjs`, `package.json`, `.agents/skills/deep-test/SKILL.md`
- **Verify with:** `npm run deep-test`
- **Gotchas:** Enforces license headers (Apache-2.0) on all `.js`, `.mjs`, `.md` source files and checks for leaked template placeholders (`{{...}}`).
- **Related:** `verify`, `drift`

### release-check  `[inferred]`
- **Business goal:** Deterministic release-readiness gate: version-sync across every file stating a version, changelog gate, changed-files-vs-changelog coverage report, and CLI-docs sync (per `ai/lab/specs/SPEC_release-check.md`).
- **Touches:** `test/release-check.mjs`, `package.json`, `.github/workflows/release-check.yml`, `docs/RELEASE-CHECKLIST.md`
- **Verify with:** `npm run release-check`
- **Gotchas:** Maintainer tooling for the kit repo itself — not stamped into target repos. Tag mode is auto-detected from `GITHUB_REF` (or forced with `--tag vX.Y.Z`) and additionally requires the dated changelog section and an emptied `[Unreleased]`. The coverage check is an informational keyword heuristic (exit 0) — a human judges its warnings.
- **Related:** `deep-test`, `verify`

### ci-checks  `[inferred]`
- **Business goal:** Provide a GitHub Actions workflow template that runs `verify --strict` and `drift --git --strict` automatically on push/PR for target repos.
- **Touches:** `templates/github/workflows/ai-check.yml.tmpl`, `.github/workflows/ai-check.yml`, `lib/installer.mjs`
- **Verify with:** `npm test` (integration test checks `.github/workflows/ai-check.yml` is installed)
- **Gotchas:** The template uses `npm install -g ai-fication-kit` to fetch the kit in CI; requires the package to be published to npm. The kit's own self-hosted workflow uses `node install.mjs` directly.
- **Related:** `verify`, `drift`, `install`

### check-drift (Claude command)  `[inferred]`
- **Business goal:** Provide a Claude Code slash command (`/check-drift`) for interactive verification and drift analysis of the `ai/` knowledge-base.
- **Touches:** `templates/claude/commands/check-drift.md`, `.claude/commands/check-drift.md`
- **Verify with:** `npm test` (integration test checks `.claude/commands/check-drift.md` is installed)
- **Gotchas:** Uses `--strict` flags matching CI for consistency. Instructs the agent to mark changes as `[inferred]`.
- **Related:** `verify`, `drift`, `ci-checks`

