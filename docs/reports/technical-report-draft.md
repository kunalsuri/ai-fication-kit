<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

# ai-fication-kit: Technical Report

**A Toolkit for Making Legacy Codebases AI-Native through Scaffolded, Human-Verified Repository Intelligence**

| Field | Value |
|---|---|
| **Version** | 0.2.0 |
| **Release Date** | 2026-07-03 |
| **Report Date** | 2026-07-04 |
| **Report Revision** | v7 (2026-07-12) — added the Executive Summary purpose map and part-structured Table of Contents; content unchanged since v6 (see §13.1 for scope) |
| **Author** | Kunal Suri (CEA LIST — French Alternative Energies and Atomic Energy Commission) |
| **License** | Apache 2.0 |
| **DOI** | 10.5281/zenodo.20860637 |
| **Repository** | https://github.com/kunalsuri/ai-fication-kit |

---

## Executive Summary: Five Purposes, One Kit

*Read this page first. The kit is deliberately multi-purpose, and each purpose runs as its own thread through the fifteen sections below. This page maps every purpose to the sections that carry it — so you can review only the thread you care about instead of reading linearly.*

**What it is.** ai-fication-kit scaffolds a provenance-tracked knowledge layer (the `ai/` folder) plus a pre-built agent harness into any existing repository, so AI coding agents work from a trusted, human-verified map instead of re-crawling source and guessing. A single `shazam` command installs everything; deterministic `verify`/`drift` checks keep the map honest as the code evolves.

### The purpose map

P1–P3 follow the README's three-part framing (quoted in §2.3); P4 and P5 are implicit there and made explicit here because reviewers ask about them directly.

| # | Purpose | What the kit ships for it | Core sections |
|---|---|---|---|
| **P1** | **Context & memory for the agent** — a compact, trusted map replaces re-crawling the tree | The `ai/` knowledge layer: module map, architecture, conventions, feature catalog (~3× measured context reduction) | §2.1, §8, §11.2 |
| **P2** | **Harness engineering** — a pre-built agent harness, no per-tool hand-rolling | Instructions, ten workflow commands, three helper-agent personas, two multi-phase skills, and a CI check — stamped natively for Claude Code, GitHub Copilot, Google Antigravity, and Cursor in one install | §3.1, §9, §10 |
| **P3** | **Guided, human-verified repo intelligence** — humans keep authority over what the map claims | `[inferred]` → `[verified]` provenance tags, four stability markers, the guided `audit` command, and the child-lock that mechanically protects human signatures | §4.8, §5, §7 (mechanics: §3.6) |
| **P4** | **Mechanical honesty over time** — the map must not silently rot as code changes | Deterministic `verify`/`drift`/`status` checks, CI `--strict` gates, and the Spec → Decide → Implement → Review → Evaluate → Record engineering loop | §6, §9.5, §12 |
| **P5** | **Instant human onboarding** — the same map serves people, not just agents | The verified `ai/` folder doubles as trustworthy onboarding documentation for new engineers | §1, §2.1, §15 |

### Reading paths

Pick the path that matches why you are reviewing:

- **Deciding whether to adopt (~10 minutes):** this page → §14 (Differentiation) → §15 (Summary) → §13.2 (Known Limitations).
- **Reviewing the trust and security claims:** §5 (Trust Model) → §6 (Verification and Integrity) → §7 (Security Properties), with §3.6 (child-lock) and §4.8 (guided audit) as the mechanical anchors.
- **About to install it on a repo:** §4 (Workflow, Steps 0–6) → §8 (what lands in your tree) → §11.3 (the zero-risk `demo` command).
- **Evaluating AI-tool coverage:** §9 (Agent Integration) → §10.2 (compatibility matrix) → §13.2 item 2 (uneven automation depth).
- **Assessing engineering maturity:** §12 (Testing and Release Engineering) → §13 (Current Status and Limitations).

---

## Table of Contents

- [Executive Summary: Five Purposes, One Kit](#executive-summary-five-purposes-one-kit)

**Part I — Problem & Purpose** *(why the kit exists: all five purposes motivated)*

1. [Introduction](#1-introduction)
2. [Motivation](#2-motivation)

**Part II — System Design** *(how it is built and operated)*

3. [Architecture](#3-architecture)
4. [Workflow](#4-workflow)

**Part III — Trust & Verification** *(P3 and P4: the load-bearing claims)*

5. [Trust Model](#5-trust-model)
6. [Verification and Integrity](#6-verification-and-integrity)
7. [Security Properties](#7-security-properties)

**Part IV — What Gets Installed** *(P1 and P2: the deliverables)*

8. [Scaffolded Artifacts](#8-scaffolded-artifacts)
9. [Agent Integration](#9-agent-integration)
10. [Stack Detection and Tool Compatibility](#10-stack-detection-and-tool-compatibility)

**Part V — Evidence & Positioning** *(measurements, tests, limits, comparison)*

11. [Bundled Examples and the Demo Command](#11-bundled-examples-and-the-demo-command)
12. [Testing and Release Engineering](#12-testing-and-release-engineering)
13. [Current Status and Limitations](#13-current-status-and-limitations)
14. [Differentiation](#14-differentiation)
15. [Summary](#15-summary)

---

## 1. Introduction

AI coding agents — tools such as Claude Code, Cursor, GitHub Copilot, and OpenAI Codex — can read files, execute terminal commands, and perform multi-file edits across a codebase. However, on large or legacy repositories they operate without reliable context: they re-crawl directory trees each session, guess which files are safe to modify, and risk hallucinating structural details that lead to edits in the wrong module.

**ai-fication-kit** addresses this problem by scaffolding a structured knowledge layer into any existing repository. The kit produces a compact `ai/` directory — a map of modules, architecture, conventions, and features — that AI agents read instead of re-crawling source. Every claim in this map carries an explicit **provenance tag**: `[inferred]` (drafted by an agent or tool, not yet verified) or `[verified]` (confirmed by a human operator). Provenance tracking means knowing *who* produced a claim and *whether a human checked it*. By the agent rules the kit installs, agents must never promote their own drafts to `[verified]`; that flip is reserved as the human operator's signature. This is an instructional constraint enforced by the agent rules (and reinforced by a detective post-cold-start check), not a programmatic access control — see §5. (The kit's own guided `audit` command is the one sanctioned writer of `[verified]` tags, and it only writes one after an explicit per-row human confirmation — see §4.8.)

The knowledge layer (`ai/` folder and `AGENTS.md`) is tool-agnostic — readable by any AI coding agent. As of v0.2.0, the kit's automation layer is no longer Claude Code-only: a single install stamps the same ten workflow commands, three helper-agent personas, and two multi-phase skills (`add-feature`, `fix-bug`) **natively for four tools** — Claude Code (`.claude/`: slash commands, subagents, skills), GitHub Copilot (`.github/`: `copilot-instructions.md`, prompt files, chat modes), Google Antigravity (`.agents/`: workflows plus the skills in the shared Agent Skills format), and Cursor (`.cursor/rules/*.mdc` rules). Claude Code remains the most deeply integrated runtime (native subagent spawning and auto-triggered skills); users of Codex or Windsurf can still use the provenance-tracked knowledge layer and agent rules, driving the workflows manually by pasting command file contents as prompts.

The result is a dual-purpose artifact. For AI agents, the `ai/` folder provides a trusted navigation layer that reduces context-window consumption and prevents unsafe edits to frozen code. For human engineers, the same verified knowledge-base serves as instant onboarding documentation — a single source of truth about module responsibilities, stability boundaries, and feature locations.

The project is developed at CEA LIST by Kunal Suri and is released under the Apache 2.0 license.

---

## 2. Motivation

### 2.1 The Agent Context Tax

AI coding agents face three recurring problems on unfamiliar repositories:

1. **Token burn.** Without a map, an agent must read large portions of the directory tree to locate relevant code, consuming context-window capacity on irrelevant files.
2. **Guesswork.** The agent has no structured way to determine which modules are safe to modify and which are frozen, vendor-supplied, or load-bearing legacy code.
3. **Hallucinated structure.** An agent's confident but inaccurate description of repository layout can lead to edits in the wrong module — a failure mode worse than having no map at all.

The README adds a fourth cost: **humans pay the same tax** — a new engineer joining the codebase spends days or weeks reverse-engineering tribal knowledge that lives in a few people's heads. The same verified map that serves agents doubles as that engineer's onboarding document.

### 2.2 The Trust Gap

Existing approaches to repository documentation tend to be either fully manual (and therefore quickly stale) or fully automated (and therefore unverifiable). ai-fication-kit addresses this gap by combining automated drafting with mandatory human verification and deterministic integrity checks.

### 2.3 Design Goal

The project's CITATION.cff states the design goal directly: ai-fication-kit "scaffolds a provenance-tracked repository-intelligence layer (maps, feature catalogs, conventions, decision records) into any legacy codebase, then guides an AI coding agent through a bootstrapping pass whose every claim is tagged `[inferred]` until a human audits it to `[verified]`. Deterministic observation (the orient step) is strictly separated from model inference (the cold-start step), and a verification workflow keeps the generated knowledge mechanically honest against the code."

The v0.2.0 README distills this into a three-part framing: **context and memory for the agent** (the `ai/` knowledge layer), **harness engineering support** (the pre-built agent harness — instructions, commands, personas, skills, CI workflow — stamped natively for four tools), and **guided, human-verified repo intelligence** (one linear path: scaffold → agent inference → human audit → mechanical verification).

---

## 3. Architecture

### 3.1 Three Pillars

The system rests on three pillars:

1. **Agent Scaffolding.** The kit stamps agent instruction files (`CLAUDE.md`, `AGENTS.md`), ten workflow commands (`/cold-start`, `/add-feature`, `/fix-bug`, …), helper-agent definitions (`repo-explorer`, `feature-builder`, `test-runner`), reusable skills, and a CI check (`ai-check.yml`) into the target repository — natively for Claude Code, GitHub Copilot, Google Antigravity, and Cursor in one install.

2. **Repository Context.** The kit generates a structured `ai/` folder containing human-readable maps of conventions, architecture, modules, and features. Agents query this folder instead of crawling raw source each session.

3. **Human-in-the-Loop Trust.** Every agent-drafted claim starts as `[inferred]` and can only be promoted to `[verified]` by a human operator. Deterministic `verify` and `drift` checks enforce mechanical honesty so the knowledge layer cannot silently diverge from the actual codebase.

### 3.2 Separation of Concerns

The architecture enforces a strict separation between two categories of operation:

- **Deterministic operations** (no LLM): `orient`, `indepth`, `check-repo-maturity`, `install`, `uninstall`, `verify`, `drift`, `status`, `doctor`, `audit`, `demo`, and the `shazam` command that chains the core pipeline. These are implemented in the kit's own code and perform only file reads, file copies, and file comparisons. (The exceptions that shell out at all invoke only local, read-only `git` via `execFile` — `drift --git`, `audit --git`, and `indepth`'s git-history analysis; see §6.2 and §7.)
- **Model-inference operations** (require an external AI agent): `/cold-start`, `/add-feature`, and the other workflow commands. These are defined as template prompts (stamped per tool into `.claude/commands/`, `.github/prompts/`, `.agents/workflows/`, and `.cursor/rules/`) and executed by an AI coding agent, not by the kit itself.

The kit never runs the user's code, opens a network connection, or installs external dependencies.

### 3.3 Single-Runtime Implementation

The toolkit is implemented in Node.js (`install.mjs` + `lib/*.mjs`). The implementation uses only standard-library modules (zero external dependencies) and requires Node.js ≥ 18. v0.2.0 removed the feature-identical Python installer that earlier versions shipped, eliminating cross-runtime parity maintenance; Python **target** repositories remain fully supported by `orient`/`indepth` and all knowledge-layer features.

### 3.4 Module Architecture

The codebase is organized as a thin CLI entry point (`install.mjs`) delegating to thirteen single-purpose library modules:

| Module | Responsibility |
|---|---|
| `lib/util` | Shared filesystem wrappers, user prompts, and constants (`KIT_VERSION`, `PROFILE_REL`, `MANIFEST_REL`, `KIT_FOOTER_MARKER`). |
| `lib/maturity` | Deterministic, read-only AI-readiness assessment. Runs 11 file-existence and file-content checks. Outputs a score (0–100, with 95 the practical maximum — see §4.2), a maturity level, a process assignment (1 or 2), and `MATURITY_REPORT.json`. |
| `lib/orient` | Deterministic stack detection. Reads marker files and produces the `ai/repo-profile.json` payload (persisted by the CLI) with detected languages, build/test commands, fork status, and maturity data. Calls `checkMaturity()` internally. |
| `lib/indepth` | Optional deep-analysis engine. Computes per-file code metrics (lines of code, comment counts, docstring ratio, import/export counts, direct dependencies), builds dependency graphs, derives structural health scores, and writes `ai/repo-indepth.json`. Its git-history analysis runs local `git` via `execFile` (no shell). |
| `lib/intake` | Interactive onboarding questionnaire. Captures developer skill level, warns about default-branch installation, confirms detected stack, detects the user's primary AI coding tool (see §4.6), and (for Process 2) explains the backup flow. Reads `.git/HEAD` directly without shelling out to git. |
| `lib/installer` | Template stamping and manifest-based uninstall. Reads templates from the `templates/` directory, substitutes `{{PLACEHOLDER}}` variables, writes stamped files, and records every written path **with a SHA-256 content hash** in `ai/install-manifest.json` (the basis for incremental re-runs and the child-lock — see §3.6). Maps template subtrees to per-tool destinations (`github/` → `.github/`, `agents/` → `.agents/`, `cursor/` → `.cursor/`). For Process 2 repos, creates timestamped backups before overwriting. |
| `lib/verify` | Mechanical path-claim verification. Extracts backtick-quoted path references from knowledge documents, builds a file-tree index, and cross-references claims against the index. Filters out URLs, bash commands, and common code idioms (e.g., `module.exports`, `process.env`) using an exclusion list. Exports a pure `computeVerification()` used by `status`. |
| `lib/drift` | Map drift detection. Compares `MODULE_MAP.md` entries against the filesystem to find unmapped code-bearing directories, vanished map entries, and (with `--git`) stale `[verified]` rows. Exports a pure `computeDrift()` used by `status`. |
| `lib/status` | One-command health snapshot. Runs the verify and drift core scans in-process (structural only, never git), counts `[verified]`/`[inferred]` MODULE_MAP rows, and prints a single verdict (see §6.3). |
| `lib/doctor` | Read-only "what do I do next?" diagnostic. Detects which of the five workflow stages the repo is at and prints the exact next command. Writes nothing. |
| `lib/audit` | Guided, interactive-only human audit of `MODULE_MAP.md` (see §4.8). The only kit code that writes `[verified]` tags — and only after explicit per-row human confirmation. |
| `lib/demo` | Zero-risk playground. Copies the bundled example into a fresh temporary directory and runs `orient` + `install` there in-process (see §11.3). |
| `lib/progress` | Regenerates the offline progress dashboard `ai/START-HERE.html` after `install`, `verify`, `drift`, `status`, and `audit` runs (see §8.2). |

Within a single CLI invocation (e.g., `shazam`), modules pass data in-memory as function arguments. For persistent state across independent invocations, the kit uses filesystem documents: `ai/repo-profile.json` stores profile data, and `ai/install-manifest.json` records installed files (with content hashes) for incremental re-runs and clean uninstall.

### 3.5 Kit-Footer Detection

The kit distinguishes its own generated files from user-authored files using a footer marker: `<!-- Installed by ai-fication-kit`. This HTML comment is stamped at the bottom of kit-generated `CLAUDE.md` and `AGENTS.md` files. Its presence or absence drives the Process 1 vs. Process 2 decision gate (see §4.3). The marker is defined as the constant `KIT_FOOTER_MARKER` in `lib/util`.

### 3.6 Incremental Re-Runs, Hash Provenance, and the Child-Lock

New in v0.2.0, re-running `install`/`shazam` on an already-scaffolded repository is safe by construction. The install manifest records a SHA-256 hash per written file, enabling a deterministic three-way comparison on every re-run:

- **New kit assets** (present in the templates, absent on disk) are written — so upgrades deliver new files.
- **Untouched kit files** (on-disk hash matches the manifest) are refreshed to the latest template.
- **User-edited files** (on-disk hash differs from the manifest) are kept — human edits are never overwritten by default.

On top of this sits the **child-lock**: any file carrying a human `[verified]` tag is never overwritten, **even with `--force`**. The only way through is the explicit `--force-verified` escape hatch, which prints a per-signature warning quoting exactly what would be lost and requires typed `overwrite` consent (backups are always taken; non-interactive runs behave safely). Re-runs also carry the `humanContext` block of `ai/repo-profile.json` forward, so intake answers survive upgrades.

The child-lock is notable in the trust model (§5): unlike the advisory stability rules that constrain *agent* behavior, it is a *programmatic* control on the kit's own write path — the installer mechanically refuses to destroy a human signature.

---

## 4. Workflow

### 4.1 Overview

The kit defines a seven-step workflow. Steps 0–2 are deterministic scripts; Step 3 is model inference; Step 4 is human review; Step 5 (optional) pairs a deterministic script with agent-driven audits; Step 6 is agent-assisted development.

### 4.2 Step 0: Maturity Check (`check-repo-maturity`)

A read-only diagnostic that inspects 11 aspects of the target repository:

| Check | Points | What is tested |
|---|---|---|
| AI config | 0 (neutral) | Presence/authorship of `CLAUDE.md`, `AGENTS.md`, `.claude/`, `ai/`, and other tool configs (`.cursorrules`, `copilot-instructions.md`, `.windsurfrules`) |
| Version control | 15 | `.git` directory existence, current branch |
| Build system | 15 | Marker files (`package.json`, `pom.xml`, etc.) |
| Test infrastructure | 15 | Test directories (`test/`, `tests/`, `spec/`), test runner config |
| CI/CD | 10 | `.github/workflows/`, `.gitlab-ci.yml`, etc. |
| Documentation | 15 | README (10), CONTRIBUTING.md (2), `docs/` folder (3) |
| Dependency locks | 10 | Lock files (`package-lock.json`, `yarn.lock`, etc.) |
| Code structure | 5 | Source directories (`src/`, `lib/`, `app/`, etc.) |
| License | 5 | `LICENSE` file |
| Security | 2 | `SECURITY.md` file |
| Gitignore | 3 | `.gitignore` existence (2) and common pattern coverage (1) |

The check produces a numeric score (0–100), a maturity level — Minimal (0–24), Early (25–49), Developing (50–79), or Mature (80–100) — a rich console report, and `MATURITY_REPORT.json`. AI config presence is recorded but does not contribute to the numeric score. Because the AI-config row is neutral, the scored rows above sum to 95 — the maximum attainable score in practice — but the level bands are unchanged (≥80 is still Mature).

### 4.3 The Two Installation Processes

The maturity check determines one of two installation paths. The decision is based solely on file authorship detection, not the numeric score:

**Process 1 — Legacy.** Triggered when no user-authored `CLAUDE.md` or `AGENTS.md` is detected. A file is considered user-authored if it exists and does not contain the kit's footer marker (`<!-- Installed by ai-fication-kit`). Everything is created from scratch.

**Process 2 — Modern.** Triggered when at least one user-authored `CLAUDE.md` or `AGENTS.md` is found (the file exists but has no kit footer). The installer creates timestamped backups (e.g., `CLAUDE_bkp_20260617_221847.md`) using the `backupName()` utility before overwriting, then installs templates. During the subsequent `/cold-start`, a "Step 0.5" reads the backup files and extracts useful knowledge (conventions, architecture, module descriptions) into the new `ai/guide/` documents, tagged `[inferred — from prior config]`.

Backup files are never deleted by `uninstall` — the user's prior knowledge is preserved. The `uninstall` command reports their locations so the user can manage them manually.

### 4.4 Step 1: Orient (and the Optional `indepth` Pass)

The `orient` command reads marker files at the repository root and writes `ai/repo-profile.json`. It calls `checkMaturity()` internally to embed maturity data (`maturity.process`, `maturity.score`, `maturity.level`, `existingAIConfig`). It also detects fork status by inspecting `.git/config` for an `upstream` remote, and extracts a project description from the README's first text line.

When several stacks are present, `orient` de-duplicates detectors by build system and chains the resulting build/test commands; for `package.json` projects it emits a bare install command unless a `build` script is actually defined, avoiding a promised `npm run build` that would fail on libraries and CLIs.

All detected values are deterministic guesses. Users can override any detection with CLI flags: `--name`, `--description`, `--build`, `--test`, `--upstream`.

Since v0.1.2, a deeper optional pass is available: `node install.mjs indepth <path>` (or `--analysis-level indepth` on `shazam`) runs the `lib/indepth` engine — per-file code metrics, dependency graphs, and structural health scores — and writes `ai/repo-indepth.json`. Like `orient`, it is deterministic and model-free.

### 4.5 Step 2: Install

The `install` command reads templates from `templates/`, substitutes placeholder variables, and writes the stamped files — including the per-tool automation trees (`.claude/`, `.github/`, `.agents/`, `.cursor/`; see §9) and the CI workflow `ai-check.yml`. The template variables substituted by the `placeholders()` function are:

| Variable | Source |
|---|---|
| `{{PROJECT_NAME}}` | `profile.projectName` (folder name or `--name` override) |
| `{{DESCRIPTION}}` | First README line or `--description` override |
| `{{LANGUAGES}}` | Detected languages joined |
| `{{BUILD_CMD}}` | Detected or overridden build command |
| `{{TEST_CMD}}` | Detected or overridden test command |
| `{{UPSTREAM}}` | Fork upstream `org/repo` slug |
| `{{FORK_LINE}}` / `{{FORK_RULE}}` | Fork-aware text for agent instructions |
| `{{TEST_DIRS}}` | Detected test directories |
| `{{DATE}}` | Current date (ISO 8601 date portion) |
| `{{KIT_VERSION}}` | Current kit version (0.2.0) |

Without `--force`, existing files are not overwritten; on re-runs the hash-based three-way comparison of §3.6 decides per file whether to write, refresh, or keep, and the child-lock protects `[verified]` work unconditionally. The manifest merges across installs so `uninstall` can always perform a clean removal. In non-interactive environments (no TTY) and with `--yes`, the kit's interactive prompts — the `shazam` intake wizard (§4.6) and the install confirmation — self-skip, making the kit CI-compatible.

### 4.6 The `shazam` Command

The one-shot entry point that chains the above: `check-repo-maturity` → `orient` → interactive intake wizard (if TTY and not `--yes`) → `install`. The wizard asks a handful of questions: developer skill/familiarity, branch safety warnings (reads `.git/HEAD` to detect `main`/`master`), stack confirmation, and — new in the 0.2.0 cycle — "Which AI coding tool will you use?", pre-selected via read-only inspection of the environment (`~/.claude/`, `.cursor/` in the target or home directory, `~/.vscode/extensions/github.copilot*`; any read failure is tolerated silently). Answers are saved under a `humanContext` block in `ai/repo-profile.json` (the tool choice as `humanContext.primaryTool`), and the post-install "Next steps" output then shows only the chosen tool's instructions, pointing to `docs/MULTI-TOOL-SETUP.md` for the rest. `--yes`/no-TTY runs are unaffected — the wizard self-skips, and automation keeps the generic output.

### 4.7 Step 3: Cold-Start (Agent Inference)

The `/cold-start` command is executed by an AI coding agent (not by the kit itself). The agent:

1. Reads `ai/repo-profile.json` to understand the detected stack and human context.
2. (Process 2 only) Scans `*_bkp_*.md` backup files and extracts prior conventions, architecture notes, and module descriptions.
3. Explores the codebase (directory listing, selective file reads, recent git history).
4. Populates `ai/guide/MODULE_MAP.md` with one row per code-bearing directory — each row containing the directory path, a one-line responsibility, an entry-point file, a stability guess, and an `[inferred]` tag.
5. Drafts supplementary documents: `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `FEATURE_MAP.md`, `CONVENTIONS.md`, and Mermaid diagrams under `ai/analysis/diagrams/`.
6. Prints an audit TODO table summarizing what needs human verification.

According to the project documentation, this step runs for approximately five minutes (more on large repositories).

### 4.8 Step 4: Human Audit

The human audit is the step on which the entire trust model rests. The operator opens `ai/guide/MODULE_MAP.md` and reviews each row:

1. **Sets Stability.** Each module receives one of four stability markers:
   - `frozen` — hands-off code (upstream, vendor, legacy, generated output, or code the team could not confidently review a diff against).
   - `stable` — working code with tests; changeable with care, but not where new work lands by default.
   - `ours` — the active development surface the team owns and expects agents to modify.
   - `?` — unaudited. Agents treat `?` as `frozen`, so an unaudited row is safe by default.

2. **Flips provenance tags.** The operator changes `[inferred]` to `[verified] (YYYY-MM-DD)` only after direct confirmation — opening the entry-point file, running the stated command, or having previously shipped changes to the module. The AUDIT-GUIDE explicitly states that "sounds plausible" is not evidence.

The audit documentation notes an asymmetric cost principle: a false `frozen` costs an occasional "the agent refused to touch X" prompt; a false `ours` lets an agent modify load-bearing code it does not understand. When torn between two values, the more conservative choice is recommended.

**The guided `audit` command.** The 0.2.0 cycle added kit support for this step: `node install.mjs audit` walks the operator through `MODULE_MAP.md` row by row, gathering deterministic evidence per row (file count; the three largest and newest files via `fs.stat`; `--git` adds the last commit touching that area) — but it only ever writes a `[verified] (DD/MM/YYYY HH:mm)` tag after an explicit per-row human confirmation. Uniquely among the kit's commands, `--yes` does **not** unlock `audit`: automation must never manufacture a human signature. The command takes one timestamped backup before its first write and supports `--dry-run`.

### 4.9 Step 5: Verify (Optional)

The optional verification step is, in the project's own terms, a "Script + Agent" stage: it pairs the deterministic `verify`/`drift` scripts (§6) with agent-driven audits.

- **Deterministic half.** `verify` (no LLM) mechanically cross-checks every file-path claim in the knowledge docs against the real tree; `drift` reports where the code has outgrown the map. The stamped CI workflow (`.github/workflows/ai-check.yml`) runs both with `--strict` on every push and pull request.
- **Agent half.** `/check-drift` (runs the two scripts, then `git status` as a procedural safeguard against files mechanical checks miss, and drafts `[inferred]` map updates), `/post-cold-start-verification` (semantic gap report), `/verify-ai-readiness` (maturity-scale rating), and `/perform-feature-add-simulation` (dry-run friction test) judge the semantic quality a script cannot.

The step is optional but recommended before building features, and its mechanical half is CI-friendly via `--strict` (see §5.3, §6).

### 4.10 Step 6: Build (`/add-feature`)

Agent-assisted development through the `add-feature` skill (§9.3): spec first, locate via the maps, respect Stability, surgical implementation, tests before "done," and a knowledge update afterward. This is where verified scaffolding is finally used to ship change safely.

### 4.11 Everyday Health Commands (`status`, `doctor`)

Two read-only commands added in the 0.2.0 cycle support day-to-day use between the numbered steps:

- **`status`** — a one-command health snapshot (see §6.3) that answers "can I trust the map right now?" with a single verdict.
- **`doctor`** — answers "what do I do next?": it detects which of the five workflow stages the repository is at (no scan yet / no MODULE_MAP / unaudited `[inferred]` rows / no or failing verify-drift manifests / fully verified) and prints the exact next command in plain language. It writes nothing, ever.

---

## 5. Trust Model

### 5.1 Provenance Tags

The kit defines two provenance states for every claim in the knowledge layer:

- **`[inferred]`** — drafted by an agent or a deterministic tool. Treated as a plausible guess, not a fact. Agents can create and modify `[inferred]` content.
- **`[verified]` (date)** — confirmed by a human operator, with the verification date. By the agent rules the kit installs, agents must never write this tag themselves; the `[verified]` flip is the human's signature. This is an instructional constraint (see §5.2), reinforced by the `/post-cold-start-verification` provenance-hygiene check — not a programmatic access control.

The flip can be made by hand in an editor, or through the guided `audit` command (§4.8), which is the only kit code path that writes `[verified]` — and only after an explicit, interactive, per-row human confirmation that `--yes` cannot bypass.

If a `[verified]` tag is found that the operator did not write, the project documentation instructs treating it as a process violation: revert the flip, remind the agent, and report it as an issue.

### 5.2 Stability Markers and Provenance as Behavioral Constraints

The stability column in `MODULE_MAP.md` functions as a behavioral constraint for agent edits, and the provenance discipline of §5.1 operates the same way. These rules are **advisory**: they are defined in the prompt instructions (`CLAUDE.md`, `AGENTS.md`) that the agent reads, not enforced by a programmatic access-control system. Their effectiveness depends on the agent faithfully following its instructions; the deterministic checks of §5.3 and the `/post-cold-start-verification` command act as *detective* controls that catch violations after the fact, not *preventive* ones.

One boundary of this model moved in v0.2.0: on the kit's *own* write path, protection of `[verified]` work is now programmatic. The installer's child-lock (§3.6) mechanically refuses to overwrite any file carrying a human `[verified]` tag — even with `--force` — and the `audit` command refuses to accept `--yes` in place of a human confirmation. Agent edits to the knowledge layer remain governed by the advisory rules.

| Stability | Expected agent behavior |
|---|---|
| `frozen` | Agent will not modify this code without explicit human approval. |
| `stable` | Agent may modify with care, ensuring tests pass. |
| `ours` | Agent may modify routinely as part of normal development. |
| `?` | Treated as `frozen` — safe by default for unaudited modules. |

### 5.3 Mechanical Honesty

The `verify` and `drift` commands provide deterministic, LLM-free checks that the knowledge layer has not silently diverged from the codebase. When run with `--strict` in CI, they fail the build if any path claim is stale or if code has outgrown the map; the stamped `ai-check.yml` workflow runs them on every push. With `--github-summary`, both commands additionally append a plain-English ✅/❌ summary to `$GITHUB_STEP_SUMMARY` (one line per problem), so CI failures read like guidance instead of raw logs. This closes the loop: human judgment sets the trust boundaries, and deterministic automation enforces their mechanical integrity over time.

---

## 6. Verification and Integrity

### 6.1 Verify

The `verify` command extracts every backtick-quoted token from the knowledge documents that resembles a file or directory path. It specifically scans: `CLAUDE.md`, `AGENTS.md`, all `*.md` files in `ai/guide/`, and all `FEATURE_CATALOG*.md` files in `ai/analysis/`. The `extractClaims()` function filters out URLs, CLI flags, shell commands, template placeholders, globs, and common code idioms (the `VERIFY_NON_FILES` set includes `module.exports`, `process.env`, `console.log`, etc.).

Each extracted claim is checked against a file-tree index built by a single traversal of the target directory (skipping directories in `VERIFY_IGNORED_DIRS`: `node_modules`, `.git`, `dist`, etc.; the disk probe is contained strictly inside the target repository). Results are categorized as:

- **`confirmed`** — the path exists on disk.
- **`moved`** — the exact path is gone but a file with the same basename exists elsewhere.
- **`missing`** — the path cannot be found.

Output: `VERIFICATION_MANIFEST.json` and `VERIFICATION_REPORT.md` in `ai/analysis/audit-reports/`. The scan core is exported as a pure `computeVerification()` function consumed by `status` (§6.3); the CLI behavior is unchanged.

### 6.2 Drift

The `drift` command performs the reverse check — detecting where the codebase has outgrown the knowledge layer:

- **`unmapped`** — code-bearing directories (containing source files, not just config or docs) that no `MODULE_MAP.md` row covers.
- **`vanished`** — directories or entry points the map references that no longer exist on disk.
- **`stale`** (with `--git`) — `[verified]` rows whose underlying source files have been modified since the verified commit. This check shells out only to a local, read-only `git` invocation (`git rev-parse` to read `HEAD`, then `git diff --name-only <verified-commit> HEAD` to list the files changed since the verified commit). It never mutates the repository.

With `--suggest`, `drift` goes one step further than reporting: it appends ready-to-paste `MODULE_MAP.md` rows for every unmapped directory (with a deterministic entry-point guess — `index.*`/`main.*`, else the largest source file) and the exact line number to delete or fix for every vanished row, mirrored as a `suggestions` array in the manifest. It never edits `MODULE_MAP.md` itself; without the flag, output is unchanged.

Output: `DRIFT_MANIFEST.json` and `DRIFT_REPORT.md`. Both `verify` and `drift` support `--strict` (exit non-zero on any issue, for CI integration), `--dry-run`, and `--github-summary` (§5.3). Like `verify`, the scan core is exported as a pure `computeDrift()` function.

### 6.3 Status

The `status` command condenses the health of the knowledge layer into a single verdict. It runs `verify`'s and `drift`'s core scans in-process (structural checks only — it never invokes git), counts the `[verified]`/`[inferred]` rows in `MODULE_MAP.md` and the newest audit date, and prints one of three verdicts: **`TRUSTED`**, **`NEEDS AUDIT`**, or **`DRIFTING`**. With `--json` it additionally writes `ai/analysis/audit-reports/STATUS.json` containing a shields.io-schema `badge` object, suitable for a README status badge.

---

## 7. Security Properties

The kit's installer is designed to be minimal-trust:

- **Zero dependencies.** Node.js standard library only. No external packages to audit. (The repository carries a `package-lock.json` solely so CI's `npm ci` works; the runtime dependency list is empty.)
- **No network access.** Nothing is downloaded, fetched, or sent. The progress dashboard (§8.2) makes zero external requests.
- **No code execution.** The kit copies and stamps text files; it never runs the user's code or any third-party code. (Exceptions: `drift --git`, `audit --git`, and `indepth`'s history analysis run local, read-only `git` — via `execFile`, with no shell — which inspects history without modifying the repository.)
- **No writes outside the target.** Only the directory passed as a CLI argument is modified. The `uninstall` command includes a path-traversal guard that verifies all deletions are strictly within the target directory. (`demo` writes only to a fresh directory under the OS temporary folder.)
- **Human signatures are mechanically protected.** The child-lock (§3.6) prevents the installer from overwriting any file carrying a `[verified]` tag, even with `--force`; the `--force-verified` escape hatch requires typed consent and always takes backups. The `audit` command never accepts `--yes` in place of a human confirmation.
- **Dry-run support.** `--dry-run` shows the full plan before any writes.
- **Clean removal.** `uninstall` reads `ai/install-manifest.json` and deletes exactly the files recorded. Backup files created during Process 2 are explicitly preserved and their locations are reported to the user.

Each library module is commented and short enough to audit in one sitting, as stated in the project's `SECURITY.md`.

---

## 8. Scaffolded Artifacts

### 8.1 Output Structure

After installation and cold-start, the target repository contains:

```
your-repo/
├── CLAUDE.md                     # Agent instructions for Claude Code (thin; points everywhere else)
├── AGENTS.md                     # Tool-agnostic agent rules
├── CLAUDE_bkp_*.md               # (Process 2 only) timestamped backup
├── AGENTS_bkp_*.md               # (Process 2 only) timestamped backup
├── ai/
│   ├── INDEX.md                  # Role → path manifest
│   ├── START-HERE.html           # Offline progress dashboard (see §8.2)
│   ├── repo-profile.json         # Deterministic stack facts
│   ├── repo-indepth.json         # (optional) indepth: dependency graph, metrics, health scores
│   ├── install-manifest.json     # Written-file record + SHA-256 hashes
│   ├── guide/                    # Human-verified navigation
│   │   ├── MODULE_MAP.md         # Directory → responsibility → stability
│   │   ├── ARCHITECTURE.md       # System architecture
│   │   ├── CONVENTIONS.md        # Coding conventions
│   │   ├── FEATURE_MAP.md        # Feature → file mapping
│   │   └── PROJECT_OVERVIEW.md   # Project description
│   ├── analysis/                 # Generated on demand
│   │   ├── FEATURE_CATALOG.md    # Feature index with touch lists
│   │   ├── diagrams/             # Mermaid diagrams
│   │   ├── audit-reports/        # Verify, drift, status, and maturity reports
│   │   └── problems/             # Dated issue analyses
│   └── lab/                      # Development intelligence
│       ├── WORKLOG.md            # Append-only work ledger (one row per unit of work)
│       ├── decisions/            # Architecture Decision Records
│       ├── specs/                # Feature specifications and bugfix docs
│       ├── reviews/              # Fresh-context change reviews (/review-change)
│       ├── evaluations/          # Post-implementation reviews
│       └── experiments/          # Agent approach trials
├── .claude/                      # Claude Code: 10 slash commands, 3 subagents,
│                                   add-feature + fix-bug skills, rules/ (always-on
│                                   index rule + path-scoped ai/ provenance guard)
├── .github/                      # GitHub Copilot: copilot-instructions.md,
│                                   prompts/*.prompt.md (same 10 commands),
│                                   chatmodes/*.chatmode.md (same 3 personas),
│                                   workflows/ai-check.yml (CI verify + drift)
├── .agents/                      # Google Antigravity: workflows/*.md (same 10 commands),
│                                   skills/ (add-feature, fix-bug — shared Agent Skills format)
└── .cursor/                      # Cursor: rules/*.mdc (same 10 commands as native rules,
                                    plus one always-on knowledge-layer index rule)
```

### 8.2 The `ai/` Knowledge Layer

The `ai/` folder is the tool-agnostic core. Its `INDEX.md` maps roles to paths so that prompts and commands reference *roles* ("navigation guide," "feature catalog") rather than file paths. If paths change, only `INDEX.md` needs updating. The `guide/` subdirectory is loaded by the agent every session; `analysis/` and `lab/` are loaded on demand per task.

The 0.2.0 cycle added a **living progress page**, `ai/START-HERE.html` — a fully offline dashboard the kit stamps into every target repo. It shows a five-step workflow checklist (reusing `doctor`'s stage detection), `[verified]`/`[inferred]` row counts, open drift items, and a small glossary. `lib/progress` regenerates it at the end of `install`, `verify`, `drift`, `status`, and `audit`; it makes zero external requests and works by double-click. `uninstall` removes it like any other stamped file, and the CLI commands work fine if it is ever deleted. Because its content legitimately changes on every run, the installer exempts it from the usual edited-file and child-lock detection.

### 8.3 The Root Agent Files

**`CLAUDE.md`** is auto-loaded by Claude Code at session start. It is deliberately thin: it contains the `@AGENTS.md` import directive, the build and test commands, a pointer to the `ai/guide/` knowledge map, and token-discipline rules directing the agent to use subagents for heavy reading. Beyond these, it surfaces a curated subset of the most critical hard rules for emphasis (the fork/frozen-upstream boundary, provenance discipline, the no-config-churn rule, and the verify-claims obligation) even though `@AGENTS.md` already imports the full rule set; it deliberately avoids restating `AGENTS.md` wholesale.

**`AGENTS.md`** contains the tool-agnostic rules that any AI coding agent reads. These include: respecting existing code boundaries, testing before declaring done, surgical diffs, provenance tagging discipline, the verify-claims obligation, and the license-header matching requirement. This file follows the tool-agnostic `AGENTS.md` convention supported by Cursor, Copilot, Codex, and Windsurf.

---

## 9. Agent Integration

The kit's automation layer delivers the same workflow in four native tool formats from a single install. The command *content* is authored once; the installer stamps it as Claude Code slash commands (`.claude/commands/*.md`), GitHub Copilot prompt files (`.github/prompts/*.prompt.md`), Google Antigravity workflows (`.agents/workflows/*.md`), and Cursor rules (`.cursor/rules/*.mdc`, `alwaysApply: false`, plus one always-on `ai-knowledge-layer.mdc` rule pointing at `ai/INDEX.md` and the provenance rule). Claude Code remains the deepest integration — it alone adds native subagent spawning and auto-triggered skills — so this section describes the commands in their Claude Code form; the other formats carry the same instructions.

### 9.1 The Ten Workflow Commands

Ten commands are stamped into `.claude/commands/` (and mirrored per tool as above). Each is a Markdown file with YAML frontmatter (containing a `description` field) followed by detailed, structured instructions that the agent executes when the user invokes the command. (An eleventh command, `/implement-spec`, is currently dogfooded in the kit's own repository only and is not yet stamped into target repos — it is described with the engineering loop in §9.5.)

#### `/cold-start` — Bootstrap the Knowledge Layer

The most substantial command (~100 lines). It orchestrates the initial read-and-write-docs-only pass where the agent drafts all `ai/` content. The command specifies:

- **Step 0 — Load the facts.** Read `ai/repo-profile.json` and treat its stack facts as given. If a `humanContext` block is present (from the intake wizard), calibrate output accordingly — a junior developer or someone new to the codebase gets more conservative stability guesses (prefer `?` or `frozen` when unsure) and more detailed explanations; an expert gets terse output. If the profile indicates a `split` stack (separate frontend/backend), map them separately.
- **Step 0.5 — Absorb prior knowledge (Process 2 only).** If `maturity.process` is `2`, scan root-level `*_bkp_*.md` files and extract useful knowledge: build/test commands, project descriptions, coding conventions, architecture notes, known gotchas, forbidden patterns, module descriptions, and external system references. Merge the extracted facts into the appropriate `ai/guide/` documents and tag them `[inferred — from prior config]`. The instruction explicitly states: "Do NOT blindly copy the backup content. Parse it for KNOWLEDGE."
- **Exploration strategy.** Use the `repo-explorer` subagent for heavy reading to protect the main context window. List the tree two levels deep, read build manifests (not source), check the last ~30 commit subjects for active areas. Prefer grep and line counts over whole-file reads.
- **Outputs.** Populate `MODULE_MAP.md` (one row per module), draft Mermaid diagrams (`package-deps.mmd`, `domain-core.mmd`, `seam.mmd`) into `ai/analysis/diagrams/`, note candidate features in `FEATURE_MAP.md`, and update `ARCHITECTURE.md` and `PROJECT_OVERVIEW.md`.
- **Hard rules.** Tag everything `[inferred]`. Separate observed facts from inferences. On forks, mark inherited code as `frozen` and flag it "UNSURE — needs human." Never modify source files — write only inside `ai/`.
- **Re-run safety.** If rows already carry `[verified]`, leave them unchanged. Only populate rows still at `?` or containing placeholder text.
- **Stop condition.** Print an "AUDIT TODO" table listing all rows still `?`, all `frozen` guesses needing confirmation, and any unverified assumptions. Then recommend running `/review-agent-config` and `/post-cold-start-verification`.

#### `/add-feature` — Safeguarded Feature Implementation

A concise command (~18 lines) that activates the `add-feature` skill (see §9.3). It encodes a strict contract:

1. **Spec first.** If no spec exists in `ai/lab/specs/`, draft one and get the user's OK before writing code.
2. **Locate via the maps.** Use `MODULE_MAP` → `FEATURE_MAP`/`CATALOG` to identify target modules; open only what is needed.
3. **Respect Stability.** Never modify `frozen` or `?` files without explicit human approval in the current conversation.
4. **Build surgically.** Smallest diff that satisfies the spec; match conventions and license headers.
5. **Verify.** Run the test suites matching the change. Failing or unrun tests mean the task is not done.
6. **Update knowledge.** Add `FEATURE_MAP` entries, catalog amendments, and `MODULE_MAP` updates — all tagged `[inferred]`.

#### `/fix-bug` — Reproduction-First Bug Fixing

The defect-side counterpart to `/add-feature`, activating the `fix-bug` skill (§9.3). It encodes a reproduce-before-fix contract designed to make the fix provable rather than plausible:

1. **Reproduce first.** Draft `ai/lab/specs/BUGFIX_<name>.md` (symptom, exact steps) and get the user's OK before touching code.
2. **Failing test before fix.** Turn the reproduction into a permanent regression test and watch it fail — that failing test is the proof the bug is understood.
3. **Locate via the maps.** `MODULE_MAP` Stability → `FEATURE_MAP` gotchas → `WORKLOG.md` history (was this area just touched? is the behavior deliberate?).
4. **Respect Stability.** A root cause inside `frozen` or `?` files requires explicit human approval in the conversation, recorded in the bugfix doc.
5. **Root cause, then surgical fix.** Name the defect, not the symptom; the smallest diff that turns the regression test green, with no drive-by refactors.
6. **Verify.** The regression test plus the suites covering the touched area must pass; failing or unrun tests mean the bug is not fixed.
7. **Review and record.** Request `/review-change` on the diff, then append the `bugfix` row to `ai/lab/WORKLOG.md` and the `FEATURE_MAP` gotcha — all `[inferred]`.

#### `/check-drift` — Mechanical Checks Plus a Bias Safeguard

Added in v0.1.2. Runs the two deterministic integrity checks (`verify --strict`, then `drift --git --strict`), then runs `git status` as an explicit procedural safeguard against automation bias — catching newly added or modified files inside already-mapped directories that the mechanical directory-level checks can miss. If issues are found, the agent drafts `[inferred]` updates to `MODULE_MAP.md`/`FEATURE_MAP.md` and reports what needs the human's manual review. (The safeguard was motivated by a documented drift blind spot — see `docs/dev/lessons-learnt/drift-blindspots-and-automation-bias.md`.)

#### `/create-feature-catalog` — Deep Feature Mining

Instructs the agent to build a comprehensive feature catalog — described as "the highest-value artifact for agents." The command specifies a three-phase method:

1. Start from user-visible surfaces: routes, UI entry points, CLI commands, and public APIs. Each surface is a candidate feature.
2. For each feature, trace the touch list across layers: UI, backend/services, persistence (tables, collections, files), and tests.
3. Cluster and name features as a *user* would name them, not by module names.

Output is `ai/analysis/FEATURE_CATALOG.md` containing per-feature entries with: name, business goal, per-layer touch list, verifying tests, and related features. The catalog ends with two sections agents use most: a "where new code lives" decision tree and a "3-file rule" (the three files to read first to understand each feature). The command requires the agent to print a sampling guide — the five entries the human should spot-check first, selected by the agent's own confidence ranking.

#### `/review-change` — Fresh-Context Change Review

The review gate of the engineering loop (§9.5). It is designed to be run in a session that did **not** implement the change, on the premise that a reviewer sharing the implementer's context inherits the implementer's blind spots. The contract:

1. **Pin the scope.** Identify the exact diff (commits / branch / files) and the spec or bugfix doc in `ai/lab/specs/` that authorized it. No spec is finding #1, severity blocker: unspecced work.
2. **Copy the template.** `ai/lab/reviews/REVIEW_TEMPLATE.md` → `ai/lab/reviews/REVIEW_<work-id>.md`.
3. **Check with evidence, not assertions.** For each check — spec conformance, surgical diff, Stability respected, tests, conventions, knowledge updated, provenance clean — record where you looked and what you saw, and re-run the suites the spec names rather than trusting the implementer's report.
4. **File findings by severity.** Any blocker or major finding means verdict `request-changes` and the list goes back to the implementer; minor/nit findings can ship with notes.
5. **Verdict and hand-off.** Fill in "what the human should double-check" — the judgement calls a mechanical check cannot make. The review is `[inferred]`; the human's merge decision is the real approval, and this document is its evidence.
6. **Record.** Link the review from the work's `ai/lab/WORKLOG.md` row and set that row's Status to `in-review`.

#### `/review-agent-config` — Configuration Diagnostic

A comprehensive diagnostic (~100 lines) that checks `CLAUDE.md` and `AGENTS.md` for structural completeness and cross-file consistency. It defines 27 individual checks across three sections:

- **Section A — `CLAUDE.md` structure (10 checks):** Verifies the `@AGENTS.md` import directive, the presence of "Hard rules" and "Where to look" sections, token-discipline directives, unfilled placeholders (regex-based detection of `<fill in>`, bare `TODO`, etc.), filled build/test commands, test locations, absence of stale backup references, and no wholesale duplication from `AGENTS.md`.
- **Section B — `AGENTS.md` structure (11 checks):** Verifies absence of Claude-specific syntax (`@import`, memory syntax) and the presence of seven specific hard rules: frozen upstream boundaries, test-before-done with actual commands, surgical diffs, provenance tagging, no phantom bugs/config churn, verify-claims obligation, and license-header matching. The remaining checks confirm an `AGENTS.md` knowledge-map section pointing to `ai/guide/`, the absence of unfilled placeholders, and no stale `AGENTS_bkp_*.md` references.
- **Section C — Cross-file consistency (6 checks):** Build commands match between the two files; test commands match; commands match what `package.json` scripts or `pom.xml` actually define; `ai/guide/` paths resolve on disk; no contradictory rules; no verbatim content copy-pasting between files.

Each check has an assigned severity (❌ error or ⚠️ warning). The output is a structured findings report with pass/warn/fail per check, a concrete one-line fix for every failure, and a single highest-priority next action. The command explicitly does not auto-edit files — it diagnoses and reports only.

#### `/post-cold-start-verification` — Semantic Gap Report

Audits the entire `ai/` layer for gaps, stale placeholders, and inconsistencies that the deterministic `verify` command cannot catch. It runs four checks:

1. **Placeholders:** Finds every `<fill in>`, `?` Stability, and `{{...}}` leftover.
2. **Internal consistency:** Confirms MODULE_MAP rows correspond to real directories, FEATURE_MAP entries point at real files, and diagrams name real modules. If the kit's `VERIFICATION_MANIFEST.json` exists, it reads the manifest first and does not re-derive path checks (since those are already deterministic facts).
3. **Profile consistency:** Build/test commands in `CLAUDE.md`/`AGENTS.md` match `ai/repo-profile.json`.
4. **Provenance hygiene:** No `[verified]` tag lacking a date; nothing agent-written carrying `[verified]`.

Output is a dated report under `ai/analysis/audit-reports/` with findings grouped by priority: P1 (agent-blocking), P2 (misleading), P3 (cosmetic).

#### `/verify-ai-readiness` — Maturity Scale Assessment

Rates the knowledge layer against a five-level maturity scale:

| Level | Name | Description |
|---|---|---|
| 0 | Opaque | No agent entry files; agents crawl and guess. |
| 1 | Scaffolded | Kit installed; maps exist but are placeholders. |
| 2 | Drafted | `/cold-start` ran; maps populated but `[inferred]`. |
| 3 | Verified | Human audit done: Stability set, core rows `[verified]`. **Minimum bar for letting an agent build features.** |
| 4 | Maintained | Feature catalog exists; knowledge updated on merge; audits recur; evaluations recorded. |

The command scores each area (entry files, MODULE_MAP coverage and verification ratio, FEATURE_MAP/CATALOG coverage, conventions, diagrams, `ai/lab/` activity) using file contents only — no speculation. Output is a dated readiness report with overall level, per-area evidence table, the single most valuable next action, and any agent-blocking gaps.

#### `/perform-feature-add-simulation` — Dry-Run Friction Test

Simulates adding a user-named feature *without writing a single line of code*. It walks four phases, scoring each as smooth / friction / blocked:

1. **Locate** — Can `MODULE_MAP` + `FEATURE_MAP`/`CATALOG` identify the target modules without crawling?
2. **Plan** — Draft the touch list per layer; note the Stability of every file. Any `frozen` or `?` file in the touch list means "blocked pending human approval."
3. **Verify** — Which test suites would prove it works? Do they exist? Are the test commands confirmed?
4. **Knowledge update** — Which `ai/` files would need updating?

Output is a friction report with per-phase scores, the specific missing knowledge that caused friction, estimated context cost, and a go/no-go recommendation. The command frames knowledge gaps found here as "the cheapest bugs you will ever fix."

### 9.2 Subagents (and Their Copilot Chat-Mode Mirrors)

Three subagent definitions are stamped into `.claude/agents/`. Each is a Markdown file with YAML frontmatter defining a `name`, `description`, and `tools` list. Claude Code spawns these as isolated helper processes, each with its own context window, so the main agent's working memory is preserved. For GitHub Copilot, the same three personas are stamped as chat modes (`.github/chatmodes/*.chatmode.md`); other tools do not support delegated helper agents.

#### `repo-explorer` — Read-Only Codebase Scout

**Tools:** Read, Grep, Glob, Bash.

A strictly read-only exploration agent. Its instructions enforce:
- Never modify, create, or delete any file.
- Prefer cheap signals first: directory listings, build manifests, grep hits, line counts, commit subjects. Read full files only when the question demands it.
- Report findings as OBSERVED (cite file:line or command output) vs. INFERRED (interpretation, clearly labeled).
- Answer compactly — prefer paths and one-line summaries over long quotes.
- When asked about code safety/stability, check `ai/guide/MODULE_MAP.md` first and report the recorded Stability alongside the observation.

This subagent is mandated by the `/cold-start` and `/create-feature-catalog` commands for all heavy reading to protect the main agent's context budget.

#### `feature-builder` — Surgical Implementation Agent

**Tools:** Read, Grep, Glob, Edit, Write, Bash.

Implements exactly the plan it is given — nothing more. Its instructions enforce:
- Before any edit, check the file's row in `MODULE_MAP.md`. If `frozen` or `?`: stop and report back; do not edit.
- Match the conventions in `ai/guide/CONVENTIONS.md` and the license headers of neighboring files.
- Smallest possible diff. No drive-by refactors, no layout changes, no dependency additions unless the plan specifies them.
- After editing, list every file touched and the verification the caller should run. Do not claim success — that is `test-runner`'s job.
- Anything written into `ai/` gets tagged `[inferred]`.

#### `test-runner` — Verification Agent

**Tools:** Read, Grep, Glob, Bash.

Runs builds and test suites and reports results faithfully. Its instructions enforce:
- Use the build/test commands from `ai/repo-profile.json` (cross-checked against `CLAUDE.md`). If the two sources differ, report the divergence before running anything.
- Run the narrowest suite that covers the change first, then broaden if it passes.
- Report: command run, exit status, failures verbatim (trimmed to relevant lines), and a one-line reading of each failure.
- Never mark a failure as "probably unrelated" without evidence (e.g., the same failure on the unmodified base). Flaky does not mean unrelated.
- Do not fix code. Diagnose and report; fixing is `feature-builder`'s job.

### 9.3 The `add-feature` and `fix-bug` Skills

The `.claude/skills/add-feature/` and `.claude/skills/fix-bug/` directories each contain a `SKILL.md` file and a `reference/` subdirectory. Skills in Claude Code are more structured than slash commands: they are automatically triggered when relevant and provide multi-step automation logic. Because Google Antigravity supports the same shared Agent Skills (`SKILL.md`) format, both skills are also stamped to `.agents/skills/` for Antigravity users. The `/add-feature` and `/fix-bug` commands (§9.1) are the thin, explicit entry points that invoke them.

The skill encodes a six-phase contract:

1. **Spec.** If `ai/lab/specs/SPEC_<name>.md` does not exist, draft one from the spec template (goal, scope, touch list, acceptance criteria, verification plan) and get the user's OK before writing any code.
2. **Locate.** Navigate using `MODULE_MAP.md` to identify target modules and note their Stability. Use the `FEATURE_CATALOG.md`'s "where new code lives" decision tree and the 3-file rule for related features. Delegate broad reading to `repo-explorer`.
3. **Gate.** Any file in the touch list with Stability `frozen` or `?` triggers a stop: ask the human for approval and record it in the spec before proceeding.
4. **Implement.** Delegate to `feature-builder` with the exact touch list. Follow conventions per `ai/guide/CONVENTIONS.md`.
5. **Verify.** Delegate to `test-runner`: narrowest suite first, then the suites the spec names. Red or unrun tests mean the task is not done.
6. **Update knowledge.** Add a `FEATURE_MAP` entry, amend the catalog, update `MODULE_MAP` if the layout changed — all `[inferred]`. Tell the user which tags await their `[verified]` flip.

The skill's stated contract is: "no code before a spec, no edits to frozen code, no 'done' without green tests, no merge without a knowledge update."

The `fix-bug` skill shares that spec → locate → gate → implement → verify → record shape but is built around one extra discipline: **a failing regression test before any fix.** Its contract turns the reproduction into a permanent test and requires the agent to watch it fail first — that failing test is the proof the defect is understood — then names the root cause (not the symptom) and writes the smallest diff that turns the test green. Locating the defect additionally consults `WORKLOG.md` history (was this code just changed? is the behavior deliberate?), and the fix ends in the engineering loop's review-and-record step (§9.5). Its stated contract: "no fix before a failing test, root cause not symptom, and the regression test stays."

### 9.4 How the Pieces Compose

The workflow commands, subagents, and skill form a layered system designed around context-window preservation and separation of concerns:

```
Developer → /cold-start ─┬→ repo-explorer (heavy reading)
                          └→ writes ai/guide/ [inferred]

Developer → /add-feature ─→ add-feature skill ─┬→ repo-explorer (locate)
                                                ├→ feature-builder (implement)
                                                └→ test-runner (verify)

Developer → /fix-bug ─────→ fix-bug skill ─────┬→ failing regression test first
                                                ├→ feature-builder (surgical fix)
                                                └→ test-runner (verify green)
```

The main agent orchestrates; subagents do the context-heavy work in isolated windows. The skills encode the multi-phase contracts so the agent follows them consistently. The workflow commands provide the user-facing entry points. Together they form the workflow from onboarding (`/cold-start`) through verification (`/check-drift`, `/review-agent-config`, `/post-cold-start-verification`, `/verify-ai-readiness`) to safeguarded development (`/add-feature`, `/fix-bug`), change review (`/review-change`), and quality assurance (`/perform-feature-add-simulation`).

### 9.5 The Engineering Loop, the Work Ledger, and `/implement-spec`

Steps 0–5 (§4) make a repository AI-native *once*; the **engineering loop** is the repeatable cycle every subsequent unit of work runs, so the map stays trustworthy as the code changes rather than decaying after the initial audit. Its six stages are **Spec → Decide → Implement → Review → Evaluate → Record**, with the test suites and `verify --strict` as the "done" signal (the full treatment is in `docs/METHODOLOGY.md` §7):

- **Spec** authorizes the work (`ai/lab/specs/SPEC_*.md` for features, `BUGFIX_*.md` for defects); **Decide** records any non-obvious choice as an ADR under `ai/lab/decisions/`.
- **Implement** is `/add-feature`, `/fix-bug`, or `/implement-spec`, always under the Stability gates.
- **Review** is `/review-change`, run in a **fresh context that never shares the implementer's window** (§9.1) — blockers send the work back.
- **Record** appends exactly one row to `ai/lab/WORKLOG.md`, the append-only **work ledger**: the repository's episodic memory of *what was done, when, and under which contract*, linking the spec, decisions, review, and commits for each change. Because `verify` checks the backtick-quoted artifact paths in each row against the tree, a row whose spec or review vanished fails CI instead of rotting silently.

`/implement-spec <spec-path>` is the loop's dedicated implementation engine, built for the "plan with a heavy model, implement with a light one" split: it takes a finished, human-hardened spec and drives an agent — typically a cheaper model — through *faithful translation only*. Its prime rule is **stop-and-report, never improvise**: on any spec-vs-reality conflict (a signature differs, a file is missing, an example contradicts a rule) the agent must halt and ask rather than guess, because specs are `[inferred]` artifacts that are "mostly right, wrong in confident-sounding places." The spec's full test plan is the definition of done, and the run ends in the same `/review-change` gate and `[inferred]` knowledge updates as the other implementation paths. The command is currently dogfooded in the kit's own repository (`.claude/commands/`, `.agents/workflows/`) and not yet stamped into target repos — its promotion into `templates/` is a deferred product decision (see `docs/IMPLEMENT-SPEC.md`).

---

## 10. Stack Detection and Tool Compatibility

### 10.1 Supported Stacks

The `orient` command detects stacks by probing marker files at the repository root:

| Stack | Marker Files | Default Commands |
|---|---|---|
| Java | `pom.xml`, `build.gradle(.kts)` | Maven/Gradle build and test |
| JavaScript/TypeScript | `package.json` (+ `tsconfig.json`, lockfiles for pnpm/yarn/bun) | npm/pnpm/yarn/bun install and test; build script included only if defined in `package.json` |
| Python | `pyproject.toml`, `requirements.txt` | pip/poetry/pipenv + pytest |
| C#/.NET | `*.csproj`, `*.sln`, `*.fsproj` (glob-based, no fixed filename) | `dotnet build` / `dotnet test` |
| C/C++ | `CMakeLists.txt`; `Makefile` as fallback | cmake/ctest, or make |
| Go | `go.mod` | Go standard commands |
| Rust | `Cargo.toml` | Cargo standard commands |
| Ruby | `Gemfile` | Bundler (`bundle install` / `bundle exec rake test`) |
| PHP | `composer.json` | Composer commands |

Multiple stacks are detected simultaneously for polyglot repositories, and v0.2.0's test hardening added a detector matrix covering every supported stack. Detection operates only at the repository root; this is a documented limitation for monorepos with nested build systems. The FAQ provides workarounds: explicit `--build`/`--test` overrides, per-package `MODULE_MAP.md` rows via the audit, or separate kit installations per sub-repo.

### 10.2 Tool Compatibility

The kit's knowledge layer (`ai/` and `AGENTS.md`) is tool-agnostic. The automation layer is stamped natively for four tools; the remainder drive the workflow manually. The following table summarizes what each tool receives:

| Feature | Claude Code | GitHub Copilot | Google Antigravity | Cursor | Codex / Windsurf |
|---|---|---|---|---|---|
| `AGENTS.md` rules | ✓ (via `CLAUDE.md` `@import`) | ✓ (+ `copilot-instructions.md`) | ✓ | ✓ | ✓ (read natively) |
| `ai/` knowledge layer | ✓ | ✓ | ✓ | ✓ | ✓ |
| Provenance tags (`[inferred]`/`[verified]`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| The 10 workflow commands | ✓ native slash commands | ✓ native prompt files | ✓ native workflows | ✓ native rules (`.mdc`) | Manual (paste command body as prompt) |
| Helper-agent personas (3) | ✓ native subagent spawning | ✓ chat modes (mirrors) | — | — | — |
| `add-feature` skill | ✓ (auto-triggered) | — | ✓ (shared Agent Skills format) | — | — |

---

## 11. Bundled Examples and the Demo Command

### 11.1 legacy-calculator

A minimal JavaScript repository (five files: `calculator.js`, `test.js`, `package.json`, `.gitignore`, and a `README.md` walkthrough) used to demonstrate the full before-and-after transformation. Users can run `node install.mjs shazam examples/legacy-calculator` to see the kit produce the complete `ai/` knowledge layer and multi-tool scaffolding. As of the 0.2.0 cycle, `examples/legacy-calculator/` is included in `package.json`'s `files` list, fixing a packaging gap where the example was silently absent under `npx`.

### 11.2 value-demo

A deterministic measurement tool that quantifies the context reduction provided by the `ai/` map. It compares the bytes an agent would need to read to perform a fixed task ("add a discount-code field to invoices") with and without the map:

- **Without the map:** the agent reads the entire source tree (~2,604 tokens across 13 files).
- **With the map:** the agent reads the index plus the task's touch set (~842 tokens across 5 files).
- **Result:** approximately 3.1× less context, ~68% saved.

The measurement uses no model and no network — `measure.mjs` counts file bytes and applies a rough ~4 bytes/token estimate. These numbers come from a deliberately small sample app; the value-demo README notes that 3× is "the floor, not the ceiling" because the map's fixed cost stays constant while the full-crawl cost grows linearly with repository size.

### 11.3 The `demo` Command

For a zero-risk first contact, `node install.mjs demo` (no target argument) copies the bundled `legacy-calculator` example into a fresh directory under the OS temporary folder and runs `orient` + `install` there in-process, then prints a short tour of what was created and the suggested next step. Nothing in the user's own repositories is touched.

---

## 12. Testing and Release Engineering

### 12.1 Test Suites

The kit includes a smoke-test suite (`test/run-tests.mjs`, `npm test`) that verifies:

- Installer behavior, including incremental re-runs (write / refresh / keep classification), the child-lock, and `--force-verified`
- Stack detection across a full detector matrix of every supported stack
- Process 1 and Process 2 installation paths
- Maturity check scoring and process assignment
- Backup creation and content preservation
- Kit-footer detection and exclusion logic
- Verify and drift operations (including CLI edge cases), plus `indepth` per-ecosystem dependency analysis
- Uninstall completeness and backup file preservation
- **Documentation link integrity** — every local link in the human-facing docs (`README.md`, `docs/**`, `examples/**`) is checked to ensure it resolves on disk, extending the honesty guarantee from the knowledge layer to the project's own prose

The suite currently reports on the order of 330 checks per run (332 at the time of writing) — up from roughly 87 at v0.1.0 — after a coverage-driven hardening pass in v0.2.0 that raised installer line coverage from 78.6% to 85.8% and established a CI coverage floor (83% lines / 73% branches, measured via `npm run coverage`). CI runs on Linux, macOS, and Windows.

A separate **deep-test** suite (`test/run-deep-test.mjs`, `npm run deep-test`, added in v0.1.2) verifies repository health, standards compliance, placeholder leaks, and documentation/claim integrity on the kit's own repo.

### 12.2 The Deterministic Release Gate

v0.2.0 introduced `npm run release-check` (`test/release-check.mjs`) — a deterministic release gate that verifies version synchronization across files, gates on a complete changelog section, produces a changed-files coverage report, and checks that every CLI command is documented in `docs/CLI-REFERENCE.md`. The gate is enforced on every `v*` tag by the `.github/workflows/release-check.yml` workflow, and the kit's own repository must pass it (the smoke suite asserts this).

---

## 13. Current Status and Limitations

### 13.1 Version and Report Scope

The project is at version 0.2.0, released 2026-07-03 (v0.1.0, the first public release and the Zenodo-deposited version, was 2026-06-25; v0.1.1 and v0.1.2 were interim consolidation releases). It is pre-v1.0 and maintained by a single author.

**Scope note.** A number of additions landed on the `main` branch immediately after the v0.2.0 tag, within the same development cycle, and are listed under *Unreleased* in the changelog: the `demo`, `doctor`, `status`, and `audit` commands; `drift --suggest`; the `--github-summary` flag; the `ai/START-HERE.html` progress page; AI-tool detection in the intake wizard; and the native Cursor rule assets. Because the repository's README documents them as part of the current toolset, this report describes them alongside the tagged v0.2.0 features; they will be formally released in the next version.

### 13.2 Known Limitations

1. **Root-only detection.** The `orient` command inspects only the repository root for marker files. Monorepos with per-package manifests in subdirectories are detected as a single project. Workarounds are documented in the FAQ.
2. **Uneven automation depth across tools.** The workflow commands are native in Claude Code, Copilot, Antigravity, and Cursor, but subagent delegation is native only in Claude Code (mirrored as Copilot chat modes), and the auto-triggered skill format is shared only between Claude Code and Antigravity. Codex and Windsurf users drive the workflows manually by pasting command file contents as prompts.
3. **Advisory stability and provenance enforcement for agents.** Stability markers and the `[verified]` discipline are behavioral constraints defined in agent instructions, not programmatic access controls on the agent. Their effectiveness depends on the AI agent faithfully following its instructions; deterministic and agent-driven checks catch violations after the fact rather than preventing them. (The kit's *own* write path is now mechanically constrained — the child-lock and the `audit` command's consent requirements of §3.6 and §4.8 — but this does not bind third-party agents editing files directly.)
4. **No automated semantic verification.** The `verify` and `drift` commands check structural integrity (file paths, directory existence). Semantic accuracy of descriptions depends on the human audit and optional agent-driven checks (`/post-cold-start-verification`).

### 13.3 Planned Work

The release checklist and documentation reference planned but not-yet-present items:
- Publication to the public npm registry (currently installed via `npx github:kunalsuri/ai-fication-kit`).
- A technical report PDF (`docs/AI-fication-Kit-TR-2026-01.pdf`).
- A video walkthrough.

---

## 14. Differentiation

The README identifies seven design pillars that distinguish this toolkit:

| Design Pillar | Implementation |
|---|---|
| **Deterministic scan vs. model inference** | Strict separation between deterministic environment checks (`orient`, `verify`, `drift`) and model generation (`/cold-start`, `/add-feature`). |
| **Provenance tracking** | The `[inferred]` → `[verified]` progression ensures every claim has a known trust level. |
| **Fork-aware stability** | Stability markers (`frozen` / `stable` / `ours` / `?`) prevent agents from touching upstream or legacy modules. |
| **Active verification** | `verify` cross-checks path claims deterministically (no LLM); agent workflows cover semantic checks. |
| **Drift detection** | `drift` catches the reverse problem — code the map no longer covers, entries that vanished, and (with `--git`) stale verified rows — so the map ages with the repo instead of silently rotting. |
| **Dual-mode installation** | Automatic detection of legacy vs. modern repos. Process 2 preserves prior knowledge through timestamped backups and feeds it into `/cold-start` as seed intelligence. |
| **Incremental re-runs (child-lock)** | Re-running `install`/`shazam` is safe by construction: a hash-verified three-way compare brings in new kit assets, refreshes untouched kit files, and keeps anything the user edited. Files carrying a human `[verified]` tag are never overwritten — even with `--force`. |

---

## 15. Summary

ai-fication-kit provides a structured method for making any existing codebase navigable by AI coding agents while preserving human authority over trust decisions. Its core contributions are:

1. **A provenance-tracked knowledge layer** (`ai/`) where every claim carries an explicit trust tag (`[inferred]` or `[verified]`).
2. **A strict separation** between deterministic observation (the `orient`/`indepth`/`verify`/`drift` pipeline) and model inference (agent-driven `/cold-start` and `/add-feature`).
3. **Stability markers** (`frozen` / `stable` / `ours` / `?`) that function as behavioral constraints for agent edits.
4. **Mechanical integrity checks** (`verify` and `drift`) that keep the knowledge layer honest as the codebase evolves, with CI-compatible `--strict` modes, plain-English CI summaries, and a one-command `status` verdict.
5. **A multi-tool native automation layer** — ten workflow commands, three helper-agent personas, and two multi-phase skills (`add-feature`, `fix-bug`) — stamped for Claude Code, GitHub Copilot, Google Antigravity, and Cursor in one install, composing into a complete agentic workflow from onboarding through safeguarded feature delivery, defect fixing, and fresh-context review — the repeatable engineering loop that keeps the map trustworthy as the code evolves.
6. **Mechanically protected human signatures** — hash-verified incremental re-runs whose child-lock never overwrites `[verified]` work, and a guided `audit` command that writes a `[verified]` tag only after explicit per-row human consent.
7. **A zero-dependency Node.js implementation** that never executes user code or accesses the network.
8. **Dual onboarding value** — the verified `ai/` folder serves both AI agents and human engineers as instant, trustworthy repository documentation.

The kit transforms a legacy repository into an AI-native workspace through a single `shazam` command, then relies on the human audit to convert scaffolding into a verified knowledge-base that serves both AI agents and human engineers.

---

*Revision v7 (2026-07-12): structural revision for reviewability — added the front-matter Executive Summary (the P1–P5 purpose map with per-purpose section pointers, and five reader-intent reading paths) and grouped the Table of Contents into five thematic parts. Section numbering, anchors, and body content are unchanged from v6. Also corrected the metadata table's Report Revision field, which still said v5 while the footer already recorded v6.*

*Revision v6 (2026-07-05): documented the engineering loop that the 0.2.0 cycle added on top of the one-time onboarding — the command roster grew from eight to ten (`/fix-bug`, `/review-change`), the second multi-phase skill (`fix-bug`), the append-only `ai/lab/WORKLOG.md` work ledger and `ai/lab/reviews/`, and the new §9.5 covering the Spec → Decide → Implement → Review → Evaluate → Record loop plus the kit-dogfood-only `/implement-spec` command (heavy-model plan / light-model implement, stop-and-report). Updated §8.1's `.claude/` rules and directory tree, §9.1/§9.3/§9.4, and the compatibility table to match; command/skill counts corrected throughout.*

*Revision v5 (2026-07-04): updated for the 0.2.0 release cycle — Node-only runtime; incremental re-runs with hash provenance, the child-lock, and `--force-verified`; native GitHub Copilot, Google Antigravity, and Cursor automation assets; the eighth workflow command (`/check-drift`) and the `indepth`, `demo`, `doctor`, `status`, and `audit` commands; `drift --suggest` and `--github-summary`; the `ai/START-HERE.html` progress page; AI-tool detection in the intake wizard; the deterministic release gate; updated test-suite and coverage figures; and the README's revised goal/why/how framing. See §13.1 for the scope note on post-tag additions.*

*Revision v4 (2026-06-28): incorporated corrections from an independent technical review — provenance-enforcement wording (advisory/instructional, not "structural"); the `drift --git` command description (`git rev-parse` / `git diff`, not `git log`); the Step 5 (Verify) workflow definition and an explicit Step 6 subsection; the `CLAUDE.md`/`AGENTS.md` duplication description; the maturity-score 95 ceiling; the test-suite figures; the Ruby default command; the legacy-calculator file count; and several minor precision fixes.*
