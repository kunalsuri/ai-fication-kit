<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# CLI reference — every command, every flag

The complete reference for the kit's command-line interface. Both installers are
**feature-identical and zero-dependency** — pick whichever runtime you have:

```bash
node install.mjs <command> <path-to-your-repo> [options]     # Node.js ≥ 18
python install.py <command> <path-to-your-repo> [options]    # Python ≥ 3.8
npx github:kunalsuri/ai-fication-kit <command> <path> [options]  # no clone needed
```

Everything on this page is deterministic script behavior — **no LLM is involved in
any command**. Model inference only happens later, inside your agent, via
`/cold-start` and friends (see [GETTING-STARTED.md](GETTING-STARTED.md) Step 2).

**Safety guarantees shared by every command** (see [SECURITY.md](../SECURITY.md)):

- Nothing is executed and no network connection is opened. Two documented
  exceptions run **local, read-only git**: `drift --git` and `indepth`.
- Nothing is written outside the target directory you pass in.
- A file you have edited is never silently overwritten (see `install` below for
  the exact re-run rules and the `[verified]` child-lock).
- `--dry-run` previews any command's plan without writing.

---

## Command index

| Command | One line | Writes |
|---|---|---|
| [`shazam`](#shazam) | One-shot: maturity check → orient → wizard → install | profile, manifest, all templates |
| [`orient`](#orient) | Deterministic stack detection | `ai/repo-profile.json` |
| [`indepth`](#indepth) | Comprehensive Tier-2 repo analysis | `ai/repo-indepth.json` |
| [`install`](#install) | Stamp the kit's templates into the repo | templates + `ai/install-manifest.json` |
| [`uninstall`](#uninstall) | Remove exactly what `install` wrote | (deletes manifest-listed files) |
| [`verify`](#verify) | Check every path claim in the docs against the tree | `VERIFICATION_MANIFEST.json` + report |
| [`drift`](#drift) | Report where the code has outgrown the map | `DRIFT_MANIFEST.json` + report |
| [`check-repo-maturity`](#check-repo-maturity) | Read-only AI-readiness diagnostic | `MATURITY_REPORT.json` |

---

<a id="shazam"></a>
## `shazam` — the one-shot entry point

```bash
node install.mjs shazam /path/to/your/repo [options]
```

What most people run first. It chains the whole scaffolding pipeline and then
stops exactly where inference begins, handing the next steps to you and your agent:

1. **Analysis level** — interactively asks *General* (quick profile, ~200 ms) or
   *Indepth* (adds `ai/repo-indepth.json`, ~2–5 s). Defaults to *General* when run
   with `--yes`, `--skip-prompt`, `--analysis-level general`, or without a TTY.
2. **`check-repo-maturity`** — the 11-check read-only diagnostic runs first and
   decides **Process 1** (legacy, no prior AI config) vs **Process 2** (existing
   user-authored `CLAUDE.md`/`AGENTS.md`).
3. **`orient`** — detects the stack and writes `ai/repo-profile.json` (with the
   maturity results embedded).
4. **First-run wizard** — 4–5 short questions (your familiarity with the code, a
   warning if you're on `main`/`master`, a chance to correct the detected stack).
   Answers are stored under `humanContext` in the profile. Self-skips when the
   profile already has a `humanContext`, when `--yes` is passed, or without a TTY.
5. **`install`** — stamps the templates (Process 2: timestamped backups first) and
   prints your next steps (`/cold-start` → audit → `verify`).

**Options:** `--dry-run`, `--yes`, `--skip-prompt`, `--analysis-level`, `--indepth`,
`--force`, `--force-verified`, and the profile overrides (`--name`,
`--description`, `--build`, `--test`, `--upstream`).

---

<a id="orient"></a>
## `orient` — deterministic stack detection

```bash
node install.mjs orient /path/to/your/repo [--dry-run] [--analysis-level general|indepth]
```

Pure file inspection. Reads marker files at the repo root (`package.json`,
`pom.xml`, `pyproject.toml`, `*.csproj`/`*.sln`, `CMakeLists.txt`, `go.mod`,
`Cargo.toml`, `Gemfile`, `composer.json`, …), applies refinements (TypeScript via
`tsconfig.json`, Poetry/Pipenv, lockfile-based package-manager detection), runs the
maturity check, and writes the combined result to `ai/repo-profile.json`
(languages, build/test commands, fork status, `maturity.process`,
`maturity.score`). Never interactive, never guesses beyond its marker tables —
wrong guesses are overridden with `--build` / `--test` / `--name` (flags win over
detection; see [FAQ.md](FAQ.md)).

With `--analysis-level indepth` (or `--indepth`), the indepth analysis runs
afterwards and `ai/repo-indepth.json` is written too. `--interactive` / `-i`
asks you to choose the level instead.

**Options:** `--dry-run`, `--analysis-level`, `--indepth`, `--interactive`/`-i`,
`--name`, `--description`, `--build`, `--test`, `--upstream`.

---

<a id="indepth"></a>
## `indepth` — comprehensive Tier-2 analysis

```bash
node install.mjs indepth /path/to/your/repo [--dry-run]
```

The deep, still-deterministic layer on top of `orient` (added in v0.1.2). Reuses
an existing `ai/repo-profile.json` if present (otherwise runs `orient` first),
then analyzes the codebase and writes `ai/repo-indepth.json` containing:

- **Code metrics** — file count, lines of code, comment counts, docstring ratio,
  import/export counts per file.
- **Dependency analysis** — total / direct / transitive counts and a
  production-vs-development split, read from manifests and lockfiles.
- **Architecture inference** — a heuristic pattern guess (with a confidence
  score) and detected layers.
- **Communication & scalability signals** — HTTP server, database access,
  caching, detected from source patterns.
- **Git history** — commit count, contributor count, last-commit date (this is
  one of the two documented **local, read-only git** exceptions).
- **Documentation completion score** (0–100).

Like everything `orient` produces, the output is deterministic input for your
audit and for `/cold-start` — a structured observation, not a verdict.

**Options:** `--dry-run`.

---

<a id="install"></a>
## `install` — stamp the templates

```bash
node install.mjs install /path/to/your/repo [options]
```

Reads `ai/repo-profile.json` (or runs `orient` in-memory if it's missing),
substitutes the detected facts into the kit's templates
(`{{PROJECT_NAME}}`, `{{BUILD_CMD}}`, …), and writes them into the target. Every
written file — with a SHA-256 content hash — is recorded in
`ai/install-manifest.json` so `uninstall` can remove exactly what was written.

**Where templates land:**

| Template tree | Installed to | For |
|---|---|---|
| `templates/claude/` | `.claude/` | Claude Code commands, subagents, skills |
| `templates/github/` | `.github/` | Copilot instructions, prompts, chatmodes |
| `templates/agents/` | `.agents/` | Antigravity workflows + shared Agent Skills |
| `templates/ai/`, root templates | `ai/`, `CLAUDE.md`, `AGENTS.md` | the knowledge layer + agent rules |

(See [MULTI-TOOL-SETUP.md](MULTI-TOOL-SETUP.md) for what each tool does with its tree.)

**Process 2 backups.** If a user-authored `CLAUDE.md`/`AGENTS.md` exists (detected
by the absence of the kit's footer marker), it is copied to a timestamped backup
(`CLAUDE_bkp_20260617_221847.md`) before being replaced. Backups are never
deleted — `/cold-start` later mines them for knowledge (Step 0.5).

**Re-runs are incremental and safe by construction.** A three-way compare
(recorded hash / file on disk / freshly stamped template) classifies each file:

- **missing from disk** → written (how new kit features arrive on upgrade);
- **kit-owned, never edited by you** → refreshed to the new template;
- **edited by you** → **kept** untouched by default;
- with `--force` → edited files are overwritten only after a timestamped `_bkp_`
  copy is written next to them — but files carrying a human `[verified]` tag are
  **never** overwritten, even with `--force` (the **child-lock** protecting your
  audit work);
- `--force-verified` (implies `--force`) is the only way through the child-lock:
  it prints each affected file with the exact `[verified]` signature lines that
  will be lost, then requires you to type `overwrite` (a `y/N` reflex-click is
  not enough). Backups are still taken. `--force-verified --yes` skips the prompt
  for automation but still prints the full warning; `--force-verified` alone in a
  non-interactive shell aborts safely.

The intake wizard's `humanContext` survives re-runs, and manifests merge across
installs. Manifests written by pre-hash kit versions classify existing files as
"keep" — nothing regresses.

**Options:** `--dry-run`, `--force`, `--force-verified`, `--yes`, plus the profile
overrides (`--name`, `--description`, `--build`, `--test`, `--upstream`).

---

<a id="uninstall"></a>
## `uninstall` — clean removal

```bash
node install.mjs uninstall /path/to/your/repo [--dry-run]
```

Deletes **exactly** the files listed in `ai/install-manifest.json` — after
verifying each path resolves strictly inside the target (a path-traversal
safeguard) — then removes any directories left empty. Files you created or
edited outside the manifest are untouched. Backup files (`*_bkp_*.md`) are
**preserved** and their locations reported, so Process 2 users never lose their
prior configuration.

**Options:** `--dry-run`, `--yes`.

---

<a id="verify"></a>
## `verify` — mechanical claim verification

```bash
node install.mjs verify /path/to/your/repo [--dry-run] [--strict]
```

The mechanical half of "kept mechanically honest". Extracts every backtick-quoted
token that looks like a path from the knowledge docs — `CLAUDE.md`, `AGENTS.md`,
`ai/guide/*.md`, and `ai/analysis/FEATURE_CATALOG*.md` — and checks each claim
against the real file tree. A claim is either on disk or it is not; no model, no
judgement. Results are counted as **confirmed**, **moved** (found elsewhere by
basename), or **missing**, and written to
`ai/analysis/audit-reports/VERIFICATION_MANIFEST.json` (machine-readable) and
`VERIFICATION_REPORT.md` (human-readable).

With `--strict`, the command exits `1` if any claim is unconfirmed — drop it into
CI so a stale map fails the build (the kit's own
`.github/workflows/ai-check.yml` template does exactly this).

**Options:** `--dry-run`, `--strict`.

---

<a id="drift"></a>
## `drift` — where the code outgrew the map

```bash
node install.mjs drift /path/to/your/repo [--dry-run] [--strict] [--git]
```

The reverse of `verify`: instead of checking what the docs quote, it checks what
the docs *fail to cover*. Three finding types:

| Finding | Meaning | Requires |
|---|---|---|
| **unmapped** | a code-bearing directory no `MODULE_MAP.md` row covers — the agent is back to guessing there | pure file inspection |
| **vanished** | a directory or entry point the map quotes that is gone | pure file inspection |
| **stale** | a `[verified]` row whose code changed since the verified commit — trust silently rotting | `--git` (local, **read-only** git) |

Docs-only and config-only directories are not flagged (a directory "bears code"
only if it holds source-extension files), and build output, tooling, and the
kit's own `ai/` and `.claude/` are never crawled. Writes
`ai/analysis/audit-reports/DRIFT_MANIFEST.json` + `DRIFT_REPORT.md`. With
`--strict`, exits `1` on any finding.

Mechanical drift detection has known blind spots — read
[dev/lessons-learnt/drift-blindspots-and-automation-bias.md](dev/lessons-learnt/drift-blindspots-and-automation-bias.md)
before trusting a clean report too much.

**Options:** `--dry-run`, `--strict`, `--git`.

---

<a id="check-repo-maturity"></a>
## `check-repo-maturity` — AI-readiness diagnostic

```bash
node install.mjs check-repo-maturity /path/to/your/repo [--dry-run]
```

Read-only, no LLM. Runs 11 deterministic file-existence/content checks — AI
config, version control, build system, test infrastructure, CI/CD,
documentation, dependency locks, code structure, license, security policy,
gitignore — scores the repo 0–100, assigns a level
(Minimal / Early / Developing / Mature), and determines **Process 1 vs
Process 2** (by looking for user-authored `CLAUDE.md`/`AGENTS.md` without the
kit's footer marker). Prints a rich console report and writes
`ai/analysis/audit-reports/MATURITY_REPORT.json`. Also runs automatically as the
first step of `shazam`.

**Options:** `--dry-run`.

---

## Flags — the complete table

| Flag | Applies to | Effect |
|---|---|---|
| `--dry-run` | all commands | show the full plan, write nothing |
| `--strict` | `verify`, `drift` | exit `1` if any claim is unconfirmed / any drift found (for CI) |
| `--git` | `drift` | enable the *stale* check (local, read-only git) |
| `--force` | `install`, `shazam` | overwrite files you edited, after a timestamped `_bkp_` copy; `[verified]` files still kept |
| `--force-verified` | `install`, `shazam` | implies `--force`; unlocks `[verified]` files after showing every signature to be lost and requiring you to type `overwrite` |
| `--yes` | `shazam`, `install`, `uninstall` | skip confirmation prompts and the wizard (CI mode); warnings still printed |
| `--skip-prompt` | `shazam`, `orient` | skip the analysis-level question (defaults to *general*) |
| `--interactive`, `-i` | `orient` | ask for the analysis level interactively |
| `--analysis-level general\|indepth` | `shazam`, `orient` | choose the analysis depth explicitly |
| `--indepth` | `shazam`, `orient` | shorthand for `--analysis-level indepth` |
| `--name "X"` | `shazam`, `orient`, `install` | project name (default: target folder name) |
| `--description "X"` | `shazam`, `orient`, `install` | one-line description (default: first line of README) |
| `--build "X"` | `shazam`, `orient`, `install` | build command (default: detected) |
| `--test "X"` | `shazam`, `orient`, `install` | test command (default: detected) |
| `--upstream "org/repo"` | `shazam`, `orient`, `install` | fork upstream (default: detected from git remotes) |
| `--version`, `-v` | (standalone) | print the kit version and exit |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | success (also: usage help when run without arguments) |
| `1` | error — bad target, unknown option, aborted confirmation, or a `--strict` failure |

---

*Every claim on this page is sourced from `install.mjs` / `install.py` and the
`lib/` modules — the implementation each command routes to is documented for
contributors in [FUNCTIONALITY.md](FUNCTIONALITY.md).*
