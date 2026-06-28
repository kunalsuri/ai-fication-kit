<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

# ai-fication-kit: Technical Report

**A Toolkit for Making Legacy Codebases AI-Native through Scaffolded, Human-Verified Repository Intelligence**

| Field | Value |
|---|---|
| **Version** | 0.1.0 |
| **Release Date** | 2026-06-25 |
| **Report Date** | 2026-06-28 |
| **Report Revision** | v4 (2026-06-28) — incorporates an independent technical review |
| **Author** | Kunal Suri (CEA LIST — French Alternative Energies and Atomic Energy Commission) |
| **License** | Apache 2.0 |
| **DOI** | 10.5281/zenodo.20860637 |
| **Repository** | https://github.com/kunalsuri/ai-fication-kit |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Motivation](#2-motivation)
3. [Architecture](#3-architecture)
4. [Workflow](#4-workflow)
5. [Trust Model](#5-trust-model)
6. [Verification and Integrity](#6-verification-and-integrity)
7. [Security Properties](#7-security-properties)
8. [Scaffolded Artifacts](#8-scaffolded-artifacts)
9. [Claude Code Integration](#9-claude-code-integration)
10. [Stack Detection and Tool Compatibility](#10-stack-detection-and-tool-compatibility)
11. [Bundled Examples](#11-bundled-examples)
12. [Testing](#12-testing)
13. [Current Status and Limitations](#13-current-status-and-limitations)
14. [Differentiation](#14-differentiation)
15. [Summary](#15-summary)

---

## 1. Introduction

AI coding agents — tools such as Claude Code, Cursor, GitHub Copilot, and OpenAI Codex — can read files, execute terminal commands, and perform multi-file edits across a codebase. However, on large or legacy repositories they operate without reliable context: they re-crawl directory trees each session, guess which files are safe to modify, and risk hallucinating structural details that lead to edits in the wrong module.

**ai-fication-kit** addresses this problem by scaffolding a structured knowledge layer into any existing repository. The kit produces a compact `ai/` directory — a map of modules, architecture, conventions, and features — that AI agents read instead of re-crawling source. Every claim in this map carries an explicit **provenance tag**: `[inferred]` (drafted by an agent or tool, not yet verified) or `[verified]` (confirmed by a human operator). Provenance tracking means knowing *who* produced a claim and *whether a human checked it*. By the agent rules the kit installs, agents must never promote their own drafts to `[verified]`; that flip is reserved as the human operator's signature. This is an instructional constraint enforced by the agent rules (and reinforced by a detective post-cold-start check), not a programmatic access control — see §5.

While the knowledge layer (`ai/` folder and `AGENTS.md`) is designed to be tool-agnostic — readable by any AI coding agent — the kit's automation layer is built around **Claude Code** as its primary agent runtime. Claude Code is a leading agentic coding tool that natively supports slash commands, subagent spawning, custom skills, and auto-loaded project memory (`CLAUDE.md`). The kit leverages these capabilities to deliver a deeply integrated experience — seven purpose-built slash commands, three specialized subagents, and a multi-phase add-feature skill — that together form a complete agentic development workflow from repository onboarding through safeguarded feature delivery. Users of other tools (Cursor, Copilot, Codex, Windsurf) can still use the provenance-tracked knowledge layer and agent rules, but must drive the slash-command workflows manually by pasting the command file contents as prompts.

The result is a dual-purpose artifact. For AI agents, the `ai/` folder provides a trusted navigation layer that reduces context-window consumption and prevents unsafe edits to frozen code. For human engineers, the same verified knowledge-base serves as instant onboarding documentation — a single source of truth about module responsibilities, stability boundaries, and feature locations.

The project is developed at CEA LIST by Kunal Suri and is released under the Apache 2.0 license.

---

## 2. Motivation

### 2.1 The Agent Context Tax

AI coding agents face three recurring problems on unfamiliar repositories:

1. **Token burn.** Without a map, an agent must read large portions of the directory tree to locate relevant code, consuming context-window capacity on irrelevant files.
2. **Guesswork.** The agent has no structured way to determine which modules are safe to modify and which are frozen, vendor-supplied, or load-bearing legacy code.
3. **Hallucinated structure.** An agent's confident but inaccurate description of repository layout can lead to edits in the wrong module — a failure mode worse than having no map at all.

### 2.2 The Trust Gap

Existing approaches to repository documentation tend to be either fully manual (and therefore quickly stale) or fully automated (and therefore unverifiable). ai-fication-kit addresses this gap by combining automated drafting with mandatory human verification and deterministic integrity checks.

### 2.3 Design Goal

The project's CITATION.cff states the design goal directly: ai-fication-kit "scaffolds a provenance-tracked repository-intelligence layer (maps, feature catalogs, conventions, decision records) into any legacy codebase, then guides an AI coding agent through a bootstrapping pass whose every claim is tagged `[inferred]` until a human audits it to `[verified]`. Deterministic observation (the orient step) is strictly separated from model inference (the cold-start step), and a verification workflow keeps the generated knowledge mechanically honest against the code."

---

## 3. Architecture

### 3.1 Three Pillars

The system rests on three pillars:

1. **Agent Scaffolding.** The kit stamps agent instruction files (`CLAUDE.md`, `AGENTS.md`), slash commands (`/cold-start`, `/add-feature`), subagent definitions (`repo-explorer`, `feature-builder`, `test-runner`), and reusable skills into the target repository.

2. **Repository Context.** The kit generates a structured `ai/` folder containing human-readable maps of conventions, architecture, modules, and features. Agents query this folder instead of crawling raw source each session.

3. **Human-in-the-Loop Trust.** Every agent-drafted claim starts as `[inferred]` and can only be promoted to `[verified]` by a human operator. Deterministic `verify` and `drift` checks enforce mechanical honesty so the knowledge layer cannot silently diverge from the actual codebase.

### 3.2 Separation of Concerns

The architecture enforces a strict separation between two categories of operation:

- **Deterministic operations** (no LLM, no code execution): `orient`, `check-repo-maturity`, `install`, `uninstall`, `verify`, `drift`, and the `shazam` command that chains them. These are implemented in the kit's own code and perform only file reads, file copies, and file comparisons. (The single exception: `drift --git` runs local, read-only `git` — see §6.2.)
- **Model-inference operations** (require an external AI agent): `/cold-start`, `/add-feature`, and related slash commands. These are defined as template prompts in `.claude/commands/` and executed by an AI coding agent, not by the kit itself.

The kit never runs the user's code, opens a network connection, or installs external dependencies.

### 3.3 Dual-Runtime Implementation

The entire toolkit is implemented twice — in Node.js (`install.mjs` + `lib/*.mjs`) and in Python (`install.py` + `lib/*.py`). Both implementations are feature-identical, use only standard-library modules (zero external dependencies), and produce functionally identical output, kept honest by a shared cross-runtime test suite that exercises both installers. The user selects whichever runtime they have available: Node.js ≥ 18 or Python ≥ 3.8.

### 3.4 Module Architecture

The codebase is organized as a thin CLI entry point (`install.mjs` / `install.py`) delegating to seven single-purpose library modules:

| Module | Responsibility |
|---|---|
| `lib/util` | Shared filesystem wrappers, user prompts, and constants (`KIT_VERSION`, `PROFILE_REL`, `MANIFEST_REL`, `KIT_FOOTER_MARKER`). |
| `lib/maturity` | Deterministic, read-only AI-readiness assessment. Runs 11 file-existence and file-content checks. Outputs a score (0–100, with 95 the practical maximum — see §4.2), a maturity level, and a process assignment (1 or 2). |
| `lib/orient` | Deterministic stack detection. Reads marker files and produces the `ai/repo-profile.json` payload (persisted by the CLI) with detected languages, build/test commands, fork status, and maturity data. Calls `checkMaturity()` internally. |
| `lib/intake` | Interactive onboarding questionnaire. Captures developer skill level, warns about default-branch installation, confirms detected stack, and (for Process 2) explains the backup flow. Reads `.git/HEAD` directly without shelling out to git. |
| `lib/installer` | Template stamping and manifest-based uninstall. Reads templates from the `templates/` directory, substitutes `{{PLACEHOLDER}}` variables, writes stamped files, and records every written path in `ai/install-manifest.json`. For Process 2 repos, creates timestamped backups before overwriting. |
| `lib/verify` | Mechanical path-claim verification. Extracts backtick-quoted path references from knowledge documents, builds a file-tree index, and cross-references claims against the index. Filters out URLs, bash commands, and common code idioms (e.g., `module.exports`, `process.env`) using an exclusion list. |
| `lib/drift` | Map drift detection. Compares `MODULE_MAP.md` entries against the filesystem to find unmapped code-bearing directories, vanished map entries, and (with `--git`) stale `[verified]` rows. |

Within a single CLI invocation (e.g., `shazam`), modules pass data in-memory as function arguments. For persistent state across independent invocations, the kit uses filesystem documents: `ai/repo-profile.json` stores profile data, and `ai/install-manifest.json` records installed files for clean uninstall.

### 3.5 Kit-Footer Detection

The kit distinguishes its own generated files from user-authored files using a footer marker: `<!-- Installed by ai-fication-kit`. This HTML comment is stamped at the bottom of kit-generated `CLAUDE.md` and `AGENTS.md` files. Its presence or absence drives the Process 1 vs. Process 2 decision gate (see §4.3). The marker is defined as the constant `KIT_FOOTER_MARKER` in `lib/util`.

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

The check produces a numeric score (0–100) and a maturity level: Minimal (0–24), Early (25–49), Developing (50–79), or Mature (80–100). AI config presence is recorded but does not contribute to the numeric score. Because the AI-config row is neutral, the scored rows above sum to 95 — the maximum attainable score in practice — but the level bands are unchanged (≥80 is still Mature).

### 4.3 The Two Installation Processes

The maturity check determines one of two installation paths. The decision is based solely on file authorship detection, not the numeric score:

**Process 1 — Legacy.** Triggered when no user-authored `CLAUDE.md` or `AGENTS.md` is detected. A file is considered user-authored if it exists and does not contain the kit's footer marker (`<!-- Installed by ai-fication-kit`). Everything is created from scratch.

**Process 2 — Modern.** Triggered when at least one user-authored `CLAUDE.md` or `AGENTS.md` is found (the file exists but has no kit footer). The installer creates timestamped backups (e.g., `CLAUDE_bkp_20260617_221847.md`) using the `backupName()` utility before overwriting, then installs templates. During the subsequent `/cold-start`, a "Step 0.5" reads the backup files and extracts useful knowledge (conventions, architecture, module descriptions) into the new `ai/guide/` documents, tagged `[inferred — from prior config]`.

Backup files are never deleted by `uninstall` — the user's prior knowledge is preserved. The `uninstall` command reports their locations so the user can manage them manually.

### 4.4 Step 1: Orient

The `orient` command reads marker files at the repository root and writes `ai/repo-profile.json`. It calls `checkMaturity()` internally to embed maturity data (`maturity.process`, `maturity.score`, `maturity.level`, `existingAIConfig`). It also detects fork status by inspecting `.git/config` for an `upstream` remote, and extracts a project description from the README's first text line.

When several stacks are present, `orient` de-duplicates detectors by build system and chains the resulting build/test commands; for `package.json` projects it emits a bare install command unless a `build` script is actually defined, avoiding a promised `npm run build` that would fail on libraries and CLIs.

All detected values are deterministic guesses. Users can override any detection with CLI flags: `--name`, `--description`, `--build`, `--test`, `--upstream`.

### 4.5 Step 2: Install

The `install` command reads templates from `templates/`, substitutes placeholder variables, and writes the stamped files. The template variables substituted by the `placeholders()` function are:

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
| `{{KIT_VERSION}}` | Current kit version (0.1.0) |

Without `--force`, existing files are not overwritten. The manifest merges across installs so `uninstall` can always perform a clean removal. In non-interactive environments (no TTY) and with `--yes`, the kit's interactive prompts — the `shazam` intake wizard (§4.6) and the install confirmation — self-skip, making the kit CI-compatible.

### 4.6 The `shazam` Command

The one-shot entry point that chains the above: `check-repo-maturity` → `orient` → interactive intake wizard (if TTY and not `--yes`) → `install`. The wizard asks 4–5 questions: developer skill/familiarity, branch safety warnings (reads `.git/HEAD` to detect `main`/`master`), and stack confirmation. Answers are saved under a `humanContext` block in `ai/repo-profile.json`.

### 4.7 Step 3: Cold-Start (Agent Inference)

The `/cold-start` slash command is executed by an AI coding agent (not by the kit itself). The agent:

1. Reads `ai/repo-profile.json` to understand the detected stack and human context.
2. (Process 2 only) Scans `*_bkp_*.md` backup files and extracts prior conventions, architecture notes, and module descriptions.
3. Explores the codebase (directory listing, selective file reads, recent git history).
4. Populates `ai/guide/MODULE_MAP.md` with one row per code-bearing directory — each row containing the directory path, a one-line responsibility, an entry-point file, a stability guess, and an `[inferred]` tag.
5. Drafts supplementary documents: `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `FEATURE_MAP.md`, `CONVENTIONS.md`, and Mermaid diagrams under `ai/analysis/diagrams/`.
6. Prints an audit TODO table summarizing what needs human verification.

According to the project documentation, this step runs for approximately five minutes.

### 4.8 Step 4: Human Audit

The human audit is the step on which the entire trust model rests. The operator opens `ai/guide/MODULE_MAP.md` and reviews each row:

1. **Sets Stability.** Each module receives one of four stability markers:
   - `frozen` — hands-off code (upstream, vendor, legacy, generated output, or code the team could not confidently review a diff against).
   - `stable` — working code with tests; changeable with care, but not where new work lands by default.
   - `ours` — the active development surface the team owns and expects agents to modify.
   - `?` — unaudited. Agents treat `?` as `frozen`, so an unaudited row is safe by default.

2. **Flips provenance tags.** The operator changes `[inferred]` to `[verified] (YYYY-MM-DD)` only after direct confirmation — opening the entry-point file, running the stated command, or having previously shipped changes to the module. The AUDIT-GUIDE explicitly states that "sounds plausible" is not evidence.

The audit documentation notes an asymmetric cost principle: a false `frozen` costs an occasional "the agent refused to touch X" prompt; a false `ours` lets an agent modify load-bearing code it does not understand. When torn between two values, the more conservative choice is recommended.

### 4.9 Step 5: Verify (Optional)

The optional verification step is, in the project's own terms, a "Script + Agent" stage: it pairs the deterministic `verify`/`drift` scripts (§6) with three agent-driven audits.

- **Deterministic half.** `verify` (no LLM) mechanically cross-checks every file-path claim in the knowledge docs against the real tree; `drift` reports where the code has outgrown the map.
- **Agent half.** `/post-cold-start-verification` (semantic gap report), `/verify-ai-readiness` (maturity-scale rating), and `/perform-feature-add-simulation` (dry-run friction test) judge the semantic quality a script cannot.

The step is optional but recommended before building features, and its mechanical half is CI-friendly via `--strict` (see §5.3, §6).

### 4.10 Step 6: Build (`/add-feature`)

Agent-assisted development through the `add-feature` skill (§9.3): spec first, locate via the maps, respect Stability, surgical implementation, tests before "done," and a knowledge update afterward. This is where verified scaffolding is finally used to ship change safely.

---

## 5. Trust Model

### 5.1 Provenance Tags

The kit defines two provenance states for every claim in the knowledge layer:

- **`[inferred]`** — drafted by an agent or a deterministic tool. Treated as a plausible guess, not a fact. Agents can create and modify `[inferred]` content.
- **`[verified]` (date)** — confirmed by a human operator, with the verification date. By the agent rules the kit installs, agents must never write this tag themselves; the `[verified]` flip is the human's signature. This is an instructional constraint (see §5.2), reinforced by the `/post-cold-start-verification` provenance-hygiene check — not a programmatic access control.

If a `[verified]` tag is found that the operator did not write, the project documentation instructs treating it as a process violation: revert the flip, remind the agent, and report it as an issue.

### 5.2 Stability Markers and Provenance as Behavioral Constraints

The stability column in `MODULE_MAP.md` functions as a behavioral constraint for agent edits, and the provenance discipline of §5.1 operates the same way. These rules are **advisory**: they are defined in the prompt instructions (`CLAUDE.md`, `AGENTS.md`) that the agent reads, not enforced by a programmatic access-control system. Their effectiveness depends on the agent faithfully following its instructions; the deterministic checks of §5.3 and the `/post-cold-start-verification` command act as *detective* controls that catch violations after the fact, not *preventive* ones.

| Stability | Expected agent behavior |
|---|---|
| `frozen` | Agent will not modify this code without explicit human approval. |
| `stable` | Agent may modify with care, ensuring tests pass. |
| `ours` | Agent may modify routinely as part of normal development. |
| `?` | Treated as `frozen` — safe by default for unaudited modules. |

### 5.3 Mechanical Honesty

The `verify` and `drift` commands provide deterministic, LLM-free checks that the knowledge layer has not silently diverged from the codebase. When run with `--strict` in CI, they fail the build if any path claim is stale or if code has outgrown the map. This closes the loop: human judgment sets the trust boundaries, and deterministic automation enforces their mechanical integrity over time.

---

## 6. Verification and Integrity

### 6.1 Verify

The `verify` command extracts every backtick-quoted token from the knowledge documents that resembles a file or directory path. It specifically scans: `CLAUDE.md`, `AGENTS.md`, all `*.md` files in `ai/guide/`, and all `FEATURE_CATALOG*.md` files in `ai/analysis/`. The `extractClaims()` function filters out URLs, CLI flags, shell commands, template placeholders, globs, and common code idioms (the `VERIFY_NON_FILES` set includes `module.exports`, `process.env`, `console.log`, etc.).

Each extracted claim is checked against a file-tree index built by a single traversal of the target directory (skipping directories in `VERIFY_IGNORED_DIRS`: `node_modules`, `.git`, `dist`, etc.). Results are categorized as:

- **`confirmed`** — the path exists on disk.
- **`moved`** — the exact path is gone but a file with the same basename exists elsewhere.
- **`missing`** — the path cannot be found.

Output: `VERIFICATION_MANIFEST.json` and `VERIFICATION_REPORT.md` in `ai/analysis/audit-reports/`.

### 6.2 Drift

The `drift` command performs the reverse check — detecting where the codebase has outgrown the knowledge layer:

- **`unmapped`** — code-bearing directories (containing source files, not just config or docs) that no `MODULE_MAP.md` row covers.
- **`vanished`** — directories or entry points the map references that no longer exist on disk.
- **`stale`** (with `--git`) — `[verified]` rows whose underlying source files have been modified since the verified commit. This is the only check that shells out to an external command: a local, read-only `git` invocation (`git rev-parse` to read `HEAD`, then `git diff --name-only <verified-commit> HEAD` to list the files changed since the verified commit). It never mutates the repository.

Output: `DRIFT_MANIFEST.json` and `DRIFT_REPORT.md`. Both commands support `--strict` (exit non-zero on any issue, for CI integration) and `--dry-run`.

---

## 7. Security Properties

The kit's installers are designed to be minimal-trust:

- **Zero dependencies.** Node.js standard library or Python standard library only. No external packages to audit.
- **No network access.** Nothing is downloaded, fetched, or sent.
- **No code execution.** The kit copies and stamps text files; it never runs the user's code or any third-party code. (Exception: `drift --git` runs local, read-only `git` — `git rev-parse` and `git diff` — which inspects history without modifying the repository.)
- **No writes outside the target.** Only the directory passed as a CLI argument is modified. The `uninstall` command includes a path-traversal guard that verifies all deletions are strictly within the target directory.
- **Dry-run support.** `--dry-run` shows the full plan before any writes.
- **Clean removal.** `uninstall` reads `ai/install-manifest.json` and deletes exactly the files recorded. Backup files created during Process 2 are explicitly preserved and their locations are reported to the user.

Each library module is commented and short enough to audit in one sitting, as stated in the project's `SECURITY.md`.

---

## 8. Scaffolded Artifacts

### 8.1 Output Structure

After installation and cold-start, the target repository contains:

```
your-repo/
├── CLAUDE.md                     # Agent instructions for Claude Code
├── AGENTS.md                     # Tool-agnostic agent rules
├── CLAUDE_bkp_*.md               # (Process 2 only) timestamped backup
├── AGENTS_bkp_*.md               # (Process 2 only) timestamped backup
├── ai/
│   ├── INDEX.md                  # Role → path manifest
│   ├── repo-profile.json         # Deterministic stack facts
│   ├── install-manifest.json     # Written file record
│   ├── guide/                    # Human-verified navigation
│   │   ├── MODULE_MAP.md         # Directory → responsibility → stability
│   │   ├── ARCHITECTURE.md       # System architecture
│   │   ├── CONVENTIONS.md        # Coding conventions
│   │   ├── FEATURE_MAP.md        # Feature → file mapping
│   │   └── PROJECT_OVERVIEW.md   # Project description
│   ├── analysis/                 # Generated on demand
│   │   ├── FEATURE_CATALOG.md    # Feature index with touch lists
│   │   ├── diagrams/             # Mermaid diagrams
│   │   ├── audit-reports/        # Verify, drift, and maturity reports
│   │   └── problems/             # Dated issue analyses
│   └── lab/                      # Development intelligence
│       ├── decisions/            # Architecture Decision Records
│       ├── specs/                # Feature specifications
│       ├── evaluations/          # Post-implementation reviews
│       └── experiments/          # Agent approach trials
└── .claude/
    ├── commands/                 # 7 slash commands
    ├── agents/                   # 3 subagent definitions
    └── skills/                   # add-feature skill
```

### 8.2 The `ai/` Knowledge Layer

The `ai/` folder is the tool-agnostic core. Its `INDEX.md` maps roles to paths so that prompts and commands reference *roles* ("navigation guide," "feature catalog") rather than file paths. If paths change, only `INDEX.md` needs updating. The `guide/` subdirectory is loaded by the agent every session; `analysis/` and `lab/` are loaded on demand per task.

### 8.3 The Root Agent Files

**`CLAUDE.md`** is auto-loaded by Claude Code at session start. It is deliberately thin: it contains the `@AGENTS.md` import directive, the build and test commands, a pointer to the `ai/guide/` knowledge map, and token-discipline rules directing the agent to use subagents for heavy reading. Beyond these, it surfaces a curated subset of the most critical hard rules for emphasis (the fork/frozen-upstream boundary, provenance discipline, the no-config-churn rule, and the verify-claims obligation) even though `@AGENTS.md` already imports the full rule set; it deliberately avoids restating `AGENTS.md` wholesale.

**`AGENTS.md`** contains the tool-agnostic rules that any AI coding agent reads. These include: respecting existing code boundaries, testing before declaring done, surgical diffs, provenance tagging discipline, the verify-claims obligation, and the license-header matching requirement. This file follows the tool-agnostic `AGENTS.md` convention supported by Cursor, Copilot, Codex, and Windsurf.

---

## 9. Claude Code Integration

The kit's automation layer is built specifically for Claude Code, leveraging its native support for slash commands, subagents, and skills. This section documents every artifact the kit stamps into the `.claude/` directory and how they compose into a complete agentic development workflow.

### 9.1 Slash Commands

Seven slash commands are stamped into `.claude/commands/`. Each is a Markdown file with YAML frontmatter (containing a `description` field) followed by detailed, structured instructions that Claude Code executes when the user types the command.

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

#### `/create-feature-catalog` — Deep Feature Mining

Instructs the agent to build a comprehensive feature catalog — described as "the highest-value artifact for agents." The command specifies a three-phase method:

1. Start from user-visible surfaces: routes, UI entry points, CLI commands, and public APIs. Each surface is a candidate feature.
2. For each feature, trace the touch list across layers: UI, backend/services, persistence (tables, collections, files), and tests.
3. Cluster and name features as a *user* would name them, not by module names.

Output is `ai/analysis/FEATURE_CATALOG.md` containing per-feature entries with: name, business goal, per-layer touch list, verifying tests, and related features. The catalog ends with two sections agents use most: a "where new code lives" decision tree and a "3-file rule" (the three files to read first to understand each feature). The command requires the agent to print a sampling guide — the five entries the human should spot-check first, selected by the agent's own confidence ranking.

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

### 9.2 Subagents

Three subagent definitions are stamped into `.claude/agents/`. Each is a Markdown file with YAML frontmatter defining a `name`, `description`, and `tools` list. Claude Code spawns these as isolated helper processes, each with its own context window, so the main agent's working memory is preserved.

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

### 9.3 The `add-feature` Skill

The `.claude/skills/add-feature/` directory contains a `SKILL.md` file and a `reference/` subdirectory. Skills in Claude Code are more structured than slash commands: they are automatically triggered when relevant and provide multi-step automation logic.

The skill encodes a six-phase contract:

1. **Spec.** If `ai/lab/specs/SPEC_<name>.md` does not exist, draft one from the spec template (goal, scope, touch list, acceptance criteria, verification plan) and get the user's OK before writing any code.
2. **Locate.** Navigate using `MODULE_MAP.md` to identify target modules and note their Stability. Use the `FEATURE_CATALOG.md`'s "where new code lives" decision tree and the 3-file rule for related features. Delegate broad reading to `repo-explorer`.
3. **Gate.** Any file in the touch list with Stability `frozen` or `?` triggers a stop: ask the human for approval and record it in the spec before proceeding.
4. **Implement.** Delegate to `feature-builder` with the exact touch list. Follow conventions per `ai/guide/CONVENTIONS.md`.
5. **Verify.** Delegate to `test-runner`: narrowest suite first, then the suites the spec names. Red or unrun tests mean the task is not done.
6. **Update knowledge.** Add a `FEATURE_MAP` entry, amend the catalog, update `MODULE_MAP` if the layout changed — all `[inferred]`. Tell the user which tags await their `[verified]` flip.

The skill's stated contract is: "no code before a spec, no edits to frozen code, no 'done' without green tests, no merge without a knowledge update."

### 9.4 How the Pieces Compose

The slash commands, subagents, and skill form a layered system designed around context-window preservation and separation of concerns:

```
Developer → /cold-start ─┬→ repo-explorer (heavy reading)
                          └→ writes ai/guide/ [inferred]

Developer → /add-feature ─→ add-feature skill ─┬→ repo-explorer (locate)
                                                ├→ feature-builder (implement)
                                                └→ test-runner (verify)
```

The main agent orchestrates; subagents do the context-heavy work in isolated windows. The skill encodes the multi-phase contract so the agent follows it consistently. Slash commands provide the user-facing entry points. Together they form the workflow from onboarding (`/cold-start`) through verification (`/review-agent-config`, `/post-cold-start-verification`, `/verify-ai-readiness`) to safeguarded development (`/add-feature`) and quality assurance (`/perform-feature-add-simulation`).

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

Multiple stacks are detected simultaneously for polyglot repositories. Detection operates only at the repository root; this is a documented limitation for monorepos with nested build systems. The FAQ provides workarounds: explicit `--build`/`--test` overrides, per-package `MODULE_MAP.md` rows via the audit, or separate kit installations per sub-repo.

### 10.2 Tool Compatibility

The kit's knowledge layer (`ai/` and `AGENTS.md`) is tool-agnostic. The automation layer (`.claude/`) is Claude Code-specific. The following table summarizes what each tool receives:

| Feature | Claude Code | Cursor / Copilot / Codex / Windsurf |
|---|---|---|
| `AGENTS.md` rules | ✓ (via `CLAUDE.md` `@import`) | ✓ (read natively) |
| `ai/` knowledge layer | ✓ | ✓ |
| Provenance tags (`[inferred]`/`[verified]`) | ✓ | ✓ |
| Slash commands (7 commands) | ✓ (native — type `/cold-start`) | Manual (paste command body as prompt, removing YAML frontmatter) |
| Subagents (3 agents) | ✓ (native spawning) | Not available |
| Skills (`add-feature`) | ✓ (auto-triggered) | Not available |

---

## 11. Bundled Examples

### 11.1 legacy-calculator

A minimal JavaScript repository (five files: `calculator.js`, `test.js`, `package.json`, `.gitignore`, and a `README.md` walkthrough) used to demonstrate the full before-and-after transformation. Users can run `node install.mjs shazam examples/legacy-calculator` to see the kit produce the complete `ai/` knowledge layer and `.claude/` scaffolding.

### 11.2 value-demo

A deterministic measurement tool that quantifies the context reduction provided by the `ai/` map. It compares the bytes an agent would need to read to perform a fixed task ("add a discount-code field to invoices") with and without the map:

- **Without the map:** the agent reads the entire source tree (~2,604 tokens across 13 files).
- **With the map:** the agent reads the index plus the task's touch set (~842 tokens across 5 files).
- **Result:** approximately 3.1× less context, ~68% saved.

The measurement uses no model and no network — `measure.mjs` counts file bytes and applies a rough ~4 bytes/token estimate. These numbers come from a deliberately small sample app; the value-demo README notes that 3× is "the floor, not the ceiling" because the map's fixed cost stays constant while the full-crawl cost grows linearly with repository size.

---

## 12. Testing

The kit includes a cross-runtime test suite (`test/run-tests.mjs`) that verifies:

- Node.js and Python installer behavior
- Stack detection across multiple marker-file configurations
- Process 1 and Process 2 installation paths
- Maturity check scoring and process assignment
- Backup creation and content preservation
- Kit-footer detection and exclusion logic
- Verify and drift operations
- Uninstall completeness and backup file preservation
- **Documentation link integrity** — every local link in the human-facing docs (`README.md`, `docs/**`, `examples/**`) is checked to ensure it resolves on disk, extending the honesty guarantee from the knowledge layer to the project's own prose

The suite reports roughly 87 assertions per run (executed against each available runtime); about 30 of these were added specifically to cover dual-mode (Process 2) installation. The Python checks self-skip when no Python interpreter is on `PATH`. CI runs on Linux, macOS, and Windows, and additionally exercises Python 3.8 alongside 3.11.

---

## 13. Current Status and Limitations

### 13.1 Version

The project is at version 0.1.0 (first public release, 2026-06-25). It is pre-v1.0 and maintained by a single author.

### 13.2 Known Limitations

1. **Root-only detection.** The `orient` command inspects only the repository root for marker files. Monorepos with per-package manifests in subdirectories are detected as a single project. Workarounds are documented in the FAQ.
2. **Claude Code coupling.** The automation layer (slash commands, subagents, skill) is Claude Code-specific. While the knowledge layer and agent rules are tool-agnostic, users of other tools must drive workflows manually by pasting command file contents as prompts and cannot use subagent delegation.
3. **Advisory stability and provenance enforcement.** Stability markers and the `[verified]` discipline are behavioral constraints defined in agent instructions, not programmatic access controls. Their effectiveness depends on the AI agent faithfully following its instructions; deterministic and agent-driven checks catch violations after the fact rather than preventing them.
4. **No automated semantic verification.** The `verify` and `drift` commands check structural integrity (file paths, directory existence). Semantic accuracy of descriptions depends on the human audit and optional agent-driven checks (`/post-cold-start-verification`).

### 13.3 Planned Work

The release checklist and documentation reference planned but not-yet-present items:
- Publication to the public npm registry (currently installed via `npx github:kunalsuri/ai-fication-kit`).
- A technical report PDF (`docs/AI-fication-Kit-TR-2026-01.pdf`).
- A video walkthrough.

---

## 14. Differentiation

The README identifies six design pillars that distinguish this toolkit:

| Design Pillar | Implementation |
|---|---|
| **Deterministic scan vs. model inference** | Strict separation between deterministic environment checks (`orient`, `verify`, `drift`) and model generation (`/cold-start`, `/add-feature`). |
| **Provenance tracking** | The `[inferred]` → `[verified]` progression ensures every claim has a known trust level. |
| **Fork-aware stability** | Stability markers (`frozen` / `stable` / `ours` / `?`) prevent agents from touching upstream or legacy modules. |
| **Active verification** | `verify` cross-checks path claims deterministically (no LLM); agent workflows cover semantic checks. |
| **Drift detection** | `drift` catches the reverse problem — code the map no longer covers, entries that vanished, and (with `--git`) stale verified rows. |
| **Dual-mode installation** | Automatic detection of legacy vs. modern repos. Process 2 preserves prior knowledge through timestamped backups and feeds it into `/cold-start` as seed intelligence. |

---

## 15. Summary

ai-fication-kit provides a structured method for making any existing codebase navigable by AI coding agents while preserving human authority over trust decisions. Its core contributions are:

1. **A provenance-tracked knowledge layer** (`ai/`) where every claim carries an explicit trust tag (`[inferred]` or `[verified]`).
2. **A strict separation** between deterministic observation (the `orient`/`verify`/`drift` pipeline) and model inference (agent-driven `/cold-start` and `/add-feature`).
3. **Stability markers** (`frozen` / `stable` / `ours` / `?`) that function as behavioral constraints for agent edits.
4. **Mechanical integrity checks** (`verify` and `drift`) that keep the knowledge layer honest as the codebase evolves, with CI-compatible `--strict` modes.
5. **A deeply integrated Claude Code automation layer** — seven slash commands, three subagents, and a multi-phase skill — composing into a complete agentic workflow from onboarding through safeguarded feature delivery.
6. **A dual-runtime, zero-dependency implementation** (Node.js and Python) that never executes user code or accesses the network.
7. **Dual onboarding value** — the verified `ai/` folder serves both AI agents and human engineers as instant, trustworthy repository documentation.

The kit transforms a legacy repository into an AI-native workspace through a single `shazam` command, then relies on the human audit to convert scaffolding into a verified knowledge-base that serves both AI agents and human engineers.

---

*Revision v4 (2026-06-28): incorporates corrections from an independent technical review — provenance-enforcement wording (advisory/instructional, not "structural"); the `drift --git` command description (`git rev-parse` / `git diff`, not `git log`); the Step 5 (Verify) workflow definition and an explicit Step 6 subsection; the `CLAUDE.md`/`AGENTS.md` duplication description; the maturity-score 95 ceiling; the test-suite figures; the Ruby default command; the legacy-calculator file count; and several minor precision fixes.*
