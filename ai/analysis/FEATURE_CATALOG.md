<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Feature Catalog — ai-fication-kit Master Index

---

> ## Provenance & scope
>
> **Generated 2026-07-02** by a /create-feature-catalog pass (commit 3aea265 of main),
> after a full read of `install.mjs`, every `lib/` module, `templates/`,
> and both test runners. (Updated for v0.2: the parallel Python runtime was removed.) Every entry is `[inferred]` until a human audits it.
>
> **Confidence key used throughout (same scheme as `ai/INDEX.md`):**
> - `[inferred]` — written by an agent or tool; a guess until a human checks it
> - `[verified]` — a human confirmed it, with the date. Agents never set this tag.
> - `?` in Status column — requires a human decision/audit
>
> **What this file does NOT contain:** planned but unimplemented features ➔ see `ai/lab/specs/`

---

## How to use the catalog

ai-fication-kit is a single-runtime Node.js CLI, not a backend/frontend project,
so the whole catalog lives in this single file (Option A). The split files
(`FEATURE_CATALOG_BACKEND.md`, `FEATURE_CATALOG_FRONTEND.md`) are intentionally
not-applicable stubs — do not populate them.

The kit's layers, used in the touch lists below:
- **CLI** — `install.mjs` (arg parsing + dispatch only)
- **Core** — the `lib/<name>.mjs` modules
- **Payload** — `templates/` (what gets stamped into a target repo)
- **Tests** — `test/run-tests.mjs` (smoke) and `test/run-deep-test.mjs` (standards)

---

## §1 Feature Index

| ID | Feature | What it does | Entry point(s) | Status |
|---|---|---|---|---|
| F1 | **shazam (one-shot onboarding)** | maturity → orient → optional indepth → first-run wizard → install → next steps | `install.mjs` `[inferred]` | `?` |
| F2 | **orient (stack detection)** | deterministic marker-file detection → `ai/repo-profile.json` | `lib/orient.mjs` `[inferred]` | `?` |
| F3 | **indepth (Tier-2 analysis)** | deps, code metrics, git history, architecture heuristics → `ai/repo-indepth.json` | `lib/indepth.mjs` `[inferred]` | `?` |
| F4 | **check-repo-maturity** | read-only AI-readiness score; drives Process 1 vs 2 | `lib/maturity.mjs` `[inferred]` | `?` |
| F5 | **intake (first-run wizard)** | captures `humanContext` (skill, familiarity, branch safety) before install | `lib/intake.mjs` `[inferred]` | `?` |
| F6 | **install (template stamping)** | stamps `templates/` into the target; Process-2 backup of prior CLAUDE/AGENTS; writes `ai/install-manifest.json` | `lib/installer.mjs` `[inferred]` | `?` |
| F7 | **uninstall** | deletes exactly the manifest-recorded files; refuses paths outside target | `lib/installer.mjs` `[inferred]` | `?` |
| F8 | **verify (claim check)** | backtick path claims in knowledge docs vs. real tree → audit reports | `lib/verify.mjs` `[inferred]` | `?` |
| F9 | **drift (map decay check)** | unmapped / vanished; opt-in `--git` stale check vs. verified commit | `lib/drift.mjs` `[inferred]` | `?` |
| F10 | **Claude Code workflow assets** | slash commands, subagents, add-feature skill stamped to `.claude/` | `templates/claude/commands/cold-start.md` `[inferred]` | `?` |
| F11 | **CI knowledge-base check** | GitHub Actions template running `verify --strict` + `drift --git --strict` | `templates/github/workflows/ai-check.yml.tmpl` `[inferred]` | `?` |
| F12 | **deep-test (kit standards gate)** | smoke + verify + drift + license headers + placeholder leaks | `test/run-deep-test.mjs` `[inferred]` | `?` |

---

## §2 CLI Surface

| Command | Handler | Purpose |
|---|---|---|
| `shazam <repo>` | `install.mjs` dispatch | one-shot onboarding (F1) |
| `orient <repo>` | `lib/orient.mjs` `orient()` | write `ai/repo-profile.json` (F2) |
| `indepth <repo>` | `lib/indepth.mjs` `indepth()` | write `ai/repo-indepth.json` (F3) |
| `check-repo-maturity <repo>` | `lib/maturity.mjs` `checkMaturity()` | write `MATURITY_REPORT.json` (F4) |
| `install <repo>` | `lib/installer.mjs` `install()` | stamp templates (F6) |
| `uninstall <repo>` | `lib/installer.mjs` `uninstall()` | manifest-based removal (F7) |
| `verify <repo>` | `lib/verify.mjs` `verify()` | claim verification (F8) |
| `drift <repo>` | `lib/drift.mjs` `drift()` | drift detection (F9) |

Shared flags: `--dry-run --force --yes --strict --git --skip-prompt --interactive`
`--analysis-level general|indepth --indepth --name --description --build --test --upstream --version`

---

## §3 Touch Lists (per feature, across layers)

### F1 — shazam
| Layer | Files | Confidence |
|---|---|---|
| CLI | `install.mjs` (dispatch + next-steps text) | `[inferred]` |
| Core | `lib/maturity.mjs` `lib/orient.mjs` `lib/intake.mjs` `lib/installer.mjs` | `[inferred]` |
| Tests | `test/run-tests.mjs` (spawns the CLI end-to-end) | `[inferred]` |

### F2 — orient · F3 — indepth · F4 — maturity · F8 — verify · F9 — drift
Single module each: `lib/<feature>.mjs`, dispatched from the
CLI, asserted in `test/run-tests.mjs`. Outputs: F2 → `ai/repo-profile.json`,
F3 → `ai/repo-indepth.json`, F4 → `ai/analysis/audit-reports/MATURITY_REPORT.json`,
F8 → `ai/analysis/audit-reports/VERIFICATION_REPORT.md` (+ gitignored manifest),
F9 → `ai/analysis/audit-reports/DRIFT_REPORT.md` (+ gitignored manifest). `[inferred]`

### F5 — intake
| Layer | Files | Confidence |
|---|---|---|
| Core | `lib/intake.mjs` (branch check reads .git/HEAD as a plain file — never shells out) | `[inferred]` |
| Output | `humanContext` key inside `ai/repo-profile.json` | `[inferred]` |
| Tests | `test/run-tests.mjs` (non-TTY runs must bypass it) | `[inferred]` |

### F6/F7 — install / uninstall
| Layer | Files | Confidence |
|---|---|---|
| Core | `lib/installer.mjs` (`destinationFor` maps `templates/claude/**` → `.claude/**`, `templates/github/**` → `.github/**`, strips `.tmpl`) | `[inferred]` |
| Payload | everything under `templates/` except `templates/README.md` (not installed) | `[inferred]` |
| Output | `ai/install-manifest.json` (merged across re-installs) | `[inferred]` |
| Tests | `test/run-tests.mjs` (install/uninstall round-trip, backup flow) | `[inferred]` |

### F10 — Claude Code workflow assets
| Layer | Files | Confidence |
|---|---|---|
| Payload | `templates/claude/commands/` (8 commands) · `templates/claude/agents/` (3 subagents) · `templates/claude/skills/add-feature/SKILL.md` | `[inferred]` |
| Installed twin | `.claude/` (kit dogfoods its own templates — keep byte-identical) | `[inferred]` |
| Tests | `test/run-tests.mjs` (asserts installed paths) | `[inferred]` |

### F11 — CI knowledge-base check
| Layer | Files | Confidence |
|---|---|---|
| Payload | `templates/github/workflows/ai-check.yml.tmpl` (uses `npm install -g ai-fication-kit`; needs the npm package) | `[inferred]` |
| Installed twin | `.github/workflows/ai-check.yml` (self-hosted variant runs `node install.mjs` directly) | `[inferred]` |

### F12 — deep-test
| Layer | Files | Confidence |
|---|---|---|
| Tests | `test/run-deep-test.mjs` · trigger docs in `.agents/skills/deep-test/SKILL.md` · `package.json` script `deep-test` | `[inferred]` |

---

## §4 Where New Code Lives — decision tree

```
What kind of change?
├── New CLI command?          ➔ dispatch in install.mjs; behavior in a
│                               NEW lib/<name>.mjs module (never inline)
├── New detection heuristic?  ➔ lib/orient.* (marker files) or lib/indepth.* (deep analysis)
├── New installed artifact?   ➔ templates/ (use .tmpl + {{PLACEHOLDERS}} if it needs stamping);
│                               mirror to .claude// .github/ happens via destinationFor
├── New agent workflow?       ➔ templates/claude/commands/ or templates/claude/agents/
│                               (then reinstall so .claude/ stays identical)
└── New quality gate?         ➔ test/run-deep-test.mjs (kit-only) or test/run-tests.mjs (installer)
```

---

## §5 The 3-file rule — read these first per feature

| Feature | Read 1 | Read 2 | Read 3 |
|---|---|---|---|
| F1 shazam | `install.mjs` | `lib/intake.mjs` | `lib/installer.mjs` |
| F2 orient | `lib/orient.mjs` | `lib/util.mjs` | `test/run-tests.mjs` |
| F3 indepth | `lib/indepth.mjs` | `ai/repo-indepth.json` | `test/run-tests.mjs` |
| F4 maturity | `lib/maturity.mjs` | `lib/orient.mjs` (embeds result) | `lib/installer.mjs` (Process-2 use) |
| F5 intake | `lib/intake.mjs` | `lib/util.mjs` (ask/choose/isInteractive) | `install.mjs` (wizard gating) |
| F6/F7 install | `lib/installer.mjs` | `templates/README.md` | `ai/install-manifest.json` |
| F8 verify | `lib/verify.mjs` | `ai/analysis/audit-reports/VERIFICATION_REPORT.md` | `CLAUDE.md` (what gets scanned) |
| F9 drift | `lib/drift.mjs` | `ai/guide/MODULE_MAP.md` (what gets parsed) | `.github/workflows/ai-check.yml` |
| F10 claude assets | `templates/claude/commands/cold-start.md` | `templates/claude/skills/add-feature/SKILL.md` | `templates/claude/agents/repo-explorer.md` |
| F11 ci-check | `templates/github/workflows/ai-check.yml.tmpl` | `.github/workflows/ai-check.yml` | `lib/verify.mjs` |
| F12 deep-test | `test/run-deep-test.mjs` | `.agents/skills/deep-test/SKILL.md` | `package.json` |

---

## §6 Specification-Driven Development — new features

New features follow a spec-first workflow:

```
1. Create specification: ai/lab/specs/SPEC_<feature-name>.md
2. AI fills in: design based on this catalog
3. Human approves spec
4. AI implements using the /add-feature skill
5. AI updates: FEATURE_CATALOG.md and ai/guide/FEATURE_MAP.md
```

---

## Sampling guide — spot-check these 5 first (least certain entries)

1. **F3 indepth touch list** — `lib/indepth.mjs` is ~1200 lines of heuristics; confirm the output sections listed in §3 match what it actually writes.
2. **F4 → F6 Process-2 linkage** — confirm `checkMaturity()`'s `process` value is the only thing that triggers the backup flow in `lib/installer.mjs`.
3. **F11 npm assumption** — the template installs the kit from npm in CI; confirm the published package name/dist-tags before relying on it in a target repo.
4. **F5 skip conditions** — wizard skips on `--yes`/non-TTY and when `humanContext` already exists; confirm no other exit path writes a partial profile.
5. **F10 "keep byte-identical" claim** — confirm the team actually intends `.claude/` to mirror `templates/claude/` (it does today; nothing enforces it).
