<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
---
title: "ai-fication-kit: A Human-Auditable Method for Making Legacy Repositories AI-Native"
subtitle: "Technical Report TR-2026-01 — Method v2 Reference Implementation (v0.1.0)"
author:
  - "Kunal Suri (CEA LIST) · ORCID 0000-0002-2341-5343"
date: "June 2026"
abstract: |
  AI coding agents are capable but context-blind on large or legacy
  repositories: they re-read the directory tree each session, guess which
  files are safe to touch, and—worst of all—act on maps they hallucinate.
  This report describes ai-fication-kit, a method and a zero-dependency
  reference implementation that gives an agent a *provenance-tracked* map of
  an existing repository. The method rests on three design commitments: a
  strict separation between deterministic observation and model inference; an
  `[inferred]` → `[verified]` trust boundary that only a human may cross; and
  fork-aware stability markers that fence off code the agent must not modify.
  We describe the method, its six-step workflow, and the reference
  implementation—two byte-for-byte mirrored installers (Node and Python) that
  detect a repository's stack, scaffold a compact `ai/` knowledge layer, and
  mechanically verify that every path claim in that layer still matches the
  tree. We close with an explicit statement of what is mechanically
  guaranteed versus what is designed but agent-dependent, and the current
  limitations. This is the first public release (v0.1.0).
keywords: [AI coding agents, repository intelligence, legacy code, human-in-the-loop, provenance, Claude Code]
geometry: margin=1in
fontsize: 11pt
linkcolor: blue
urlcolor: blue
colorlinks: true
---

# 1. Introduction: the agent context tax

AI coding agents—Claude Code, Cursor, GitHub Copilot, Codex—are now competent
collaborators on small, well-structured projects. On large or legacy
repositories they degrade in a specific and expensive way. The repository
exceeds the agent's context window, so the agent cannot hold the codebase in
working memory. It compensates by crawling: re-reading the directory tree,
re-opening the same files, and re-deriving the same structural facts on every
session. We call this recurring cost the **agent context tax**, and it has
three components:

- **Token burn.** The agent spends a large share of each session's context
  budget rediscovering structure it discovered yesterday.
- **Guesswork.** Lacking a reliable map, the agent guesses which modules are
  load-bearing, which are safe to edit, and which belong to an upstream it
  must not touch.
- **Hallucinated maps.** When the agent infers structure and then trusts its
  own inference, the result is worse than having no map at all: it edits the
  wrong module *confidently*.

The reflexive fix—"let the agent generate documentation"—reproduces the third
failure. An agent-authored map that no human has checked is exactly a
hallucinated map written to disk. The contribution of this work is not more
documentation; it is a discipline that makes a repository map *trustworthy*:
every claim in the map is labelled with its provenance, and no
machine-generated claim is treated as fact until a human signs it.

The README that ships with the project carries the full motivation and a
quick-start; this report is the method-of-record behind it. Section 2 states
the method and its workflow. Section 3 describes the reference
implementation. Sections 4–6 give the contribution statement, an honest
implemented-versus-designed accounting, and the limitations.

# 2. The method

The method produces a small, structured **knowledge layer** inside the target
repository—an `ai/` directory plus two thin root files—and governs how that
layer is created, trusted, and kept honest. Four design commitments define it.

## 2.1 Deterministic observation, separated from model inference

The single most important boundary in the method is the line between *what a
script can observe* and *what a model must infer*. They are never mixed.

A deterministic step, `orient`, inspects the repository using nothing but
file-existence and file-content tests. It reads marker files—`package.json`,
`pom.xml`, `pyproject.toml`, `go.mod`, `Cargo.toml`, and others—to identify
languages and build systems, derives candidate build and test commands from
those markers, locates conventional test directories, and determines whether
the repository is a fork. It executes nothing, calls no network, and invokes
no model. Its entire output is a machine-readable profile that a human is
expected to confirm.

Only after this deterministic floor is laid does model inference begin, in a
separate, clearly named step (`/cold-start`). Because the two are separate, a
reader of the resulting knowledge layer can always tell which facts were
*observed* and which were *guessed by a model*—and the latter carry a tag that
says so.

## 2.2 The `[inferred]` → `[verified]` trust boundary

Every claim the agent writes is tagged `[inferred]`. A claim becomes
`[verified]` only when a human reads it, confirms it against the actual code,
and flips the tag. The flip is the human's signature.

The discipline is enforced as a one-way gate: **agents are structurally
forbidden from marking their own output `[verified]`.** An agent that flips its
own tag has committed a process violation, to be reverted and reported, not
accepted. This is what separates a provenance-tracked map from
auto-generated documentation: the trust in the map is exactly the trust a
human has invested by signing it, never more.

## 2.3 Fork-aware stability markers

Legacy work is frequently fork work: a team maintains a fork of an upstream
project and adds its own modules alongside inherited code. An agent let loose
on such a tree will happily refactor upstream code that must stay
byte-compatible. The method fences this off with a per-module **stability**
marker, set by the human during the audit:

- **`frozen`** — do not modify (typically inherited or upstream code);
- **`stable`** — mature, change only with care;
- **`ours`** — code the team owns and actively develops;
- **`?`** — not yet classified; the audit's job is to resolve these.

`orient` detects fork status deterministically (a git remote literally named
`upstream`, or an explicit flag) and the installer stamps a corresponding
rule into the agent's root instructions, so the default posture toward
inherited code is "hands off until the map says otherwise."

## 2.4 The human audit gate

The method deliberately concentrates human effort at one point: the audit.
After the agent drafts the map, the human reads it—prioritising the module
map and its stability column, because that is what gates every future
edit—corrects what is wrong, classifies stability, and flips confirmed rows
to `[verified]`. The project's field guide time-boxes this to roughly thirty
minutes for a typical repository. Everything downstream inherits its
trustworthiness from this single human act.

## 2.5 The six-step workflow

The four commitments above are operationalised as a six-step workflow, with
ownership (script, agent, or human) made explicit at each step:

| # | Step | Owner | What happens |
|---|------|-------|--------------|
| 1 | `orient` | Script | Deterministic stack/fork detection → `ai/repo-profile.json`. No LLM, nothing executed. |
| 2 | `install` | Script | Stamps the template knowledge layer into the repo; records every written path for clean removal. |
| 3 | `/cold-start` | Agent | Drafts the module map, overviews, and diagrams. Every claim tagged `[inferred]`. |
| 4 | Audit | **Human** | Reads the draft, sets stability, flips confirmed rows to `[verified]`. |
| 5 | `verify` | Script (+ agent) | Mechanically cross-checks every path claim against the tree; agent commands cover the semantic gaps a script cannot judge. |
| 6 | `/add-feature` | Agent | Builds features using the verified map, runs tests, never touches `frozen` code. |

Steps 1, 2, and 5 (the mechanical core) are deterministic and model-free.
Steps 3 and 6 are agent-driven. Step 4 is irreducibly human. The one-shot
command `shazam` chains steps 1–2 and then stops—precisely at the point where
inference would begin—handing control back for the human-supervised
remainder.

## 2.6 The knowledge layer

The artifact the method maintains is intentionally compact, so an agent loads
a few small maps instead of crawling the whole project:

- **Root files** (`CLAUDE.md`, `AGENTS.md`) — thin; they point at `ai/`.
  `CLAUDE.md` is auto-loaded by Claude Code; `AGENTS.md` carries the same
  rules for Cursor, Copilot, Codex, and Windsurf.
- **`ai/guide/`** — navigation loaded every session: `MODULE_MAP.md` (the
  starting point), `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `FEATURE_MAP.md`,
  `CONVENTIONS.md`.
- **`ai/analysis/`** — generated on demand: feature catalogs, Mermaid
  diagrams, audit reports, dated problem analyses.
- **`ai/lab/`** — development intelligence: specifications, architecture
  decision records, evaluations, experiments.
- **`ai/INDEX.md`** — a role → path manifest, so prompts reference *roles*
  rather than brittle paths.

# 3. Reference implementation

The reference implementation is a command-line kit with two design
priorities: **auditability** and **parity**. It must be trivial for a
security-conscious user to read end-to-end, and it must behave identically
whether the user runs the Node or the Python edition.

## 3.1 Two mirrored, zero-dependency installers

The kit ships as two installers—`install.mjs` (Node ≥ 18) and `install.py`
(Python ≥ 3.8)—built only on their respective standard libraries. There are
no third-party dependencies to vet, pin, or trust. The two editions are
mirrored 1:1: the same commands, flags, output, and on-disk results. A team
can adopt the kit through whichever runtime it already has, and a manifest
written by one edition is readable by the other (paths are recorded
POSIX-style for portability).

Each entry point is a thin CLI over four small single-purpose modules in
`lib/`—`util`, `orient`, `installer`, and `verify`—kept symmetric between the
two languages. The split exists for auditability: each module does one thing
and is short enough to read in a sitting.

## 3.2 `orient` — deterministic detection

`orient` is, by design, "deliberately dumb." It walks a table of build-system
detectors keyed on marker files (Maven, Gradle, npm/pnpm/Yarn/Bun, pip/Poetry/
Pipenv, Go, Cargo, Bundler, Composer, CMake), refines its guess from secondary
signals (a `tsconfig.json` upgrades a project to TypeScript; a lockfile selects
the package manager), de-duplicates chained build systems, scans for
conventional test directories, and detects fork status from `.git/config`.
Every operation is a file read; nothing is executed and nothing is inferred by
a model. The output, `ai/repo-profile.json`, carries an explicit note that a
human should confirm every field. When detection is wrong, command-line flags
(`--build`, `--test`, `--name`, `--upstream`) override it, and the flags win.

## 3.3 `install` / `uninstall` — stamping with a clean-removal contract

`install` copies the templates into the target, substituting detected facts
into `{{PLACEHOLDER}}` slots, and records **every path it writes** in
`ai/install-manifest.json`. Templates under `templates/claude/**` install to
`.claude/**`; the `.tmpl` suffix is dropped on write. The installer never
overwrites an existing file unless `--force` is given (so a human's audited
maps are safe across re-installs), reports unresolved placeholders for the
user to fill, and supports `--dry-run` to print the exact plan without
writing.

`uninstall` reads the manifest and deletes **exactly** the recorded files—no
globbing, no heuristics—after refusing any path that would resolve outside the
target directory, then removes directories the kit emptied. Re-installs merge
manifests so removal stays complete. The result is a clean-removal contract:
the kit can always be taken back out, leaving no trace.

## 3.4 `verify` — keeping the map mechanically honest

`verify` is the mechanical half of the method's honesty guarantee. It treats
every backtick-quoted, path-shaped token in the knowledge docs (`CLAUDE.md`,
`AGENTS.md`, `ai/guide/*.md`, and the feature catalogs) as a **claim**, then
checks each claim against a single walk of the real file tree. A claim's
status is one of:

- **confirmed** — the path exists where the doc says;
- **moved** — no file at that path, but a file of that name exists elsewhere
  (the claim is stale);
- **missing** — nothing on disk matches.

The extractor is conservative: it discards anything containing whitespace or
shell/glob characters, URLs, flags, and a denylist of path-shaped non-files
(`node.js`, `process.env`, and similar), so prose and code idioms are not
mistaken for claims. The build directories that pollute such checks
(`node_modules`, `dist`, `target`, `.venv`, …) are skipped. `verify` writes a
machine-readable `VERIFICATION_MANIFEST.json` and a human-readable
`VERIFICATION_REPORT.md`; `--strict` exits non-zero on any unconfirmed claim,
which makes it a drop-in CI gate against documentation rot. As with the rest
of the kit, no model is involved: `verify` states facts; the human (or an
agent command) decides what to do about them.

## 3.5 The agent layer

For Claude Code, the kit installs a command suite (`/cold-start`,
`/post-cold-start-verification`, `/create-feature-catalog`,
`/verify-ai-readiness`, `/perform-feature-add-simulation`, `/add-feature`),
three subagents (`repo-explorer`, `feature-builder`, `test-runner`), and an
`add-feature` skill. These automate the agent-driven steps of the workflow.
Tools that read `AGENTS.md` but lack slash commands (Cursor, Copilot, Codex)
get the same knowledge layer and rules; the workflow is then driven by hand,
by pasting the relevant command file as a prompt. The provenance discipline is
identical across tools—only the automation differs.

## 3.6 Safety properties and testing

The installer's safety posture follows directly from the implementation:
**zero dependencies**, **no network and no code execution** (it only copies and
stamps text), **scoped writes** (only inside the target directory),
**dry-run preview**, and **clean removal** via the manifest. Cross-platform
smoke tests run in CI on Linux, macOS, and Windows.

# 4. Contribution statement

The contribution of this work is a *method*, with a reference implementation
that makes it usable today:

1. **A provenance discipline for agent-generated repository knowledge**—the
   one-way `[inferred]` → `[verified]` gate, in which a human signature is the
   only thing that converts a machine guess into a trusted fact, and agents
   are structurally barred from self-verifying.
2. **A strict separation of deterministic observation from model
   inference**, so that every fact in the knowledge layer is attributable to
   either a script or a model, never ambiguously both.
3. **Fork-aware stability fencing**, which encodes "do not touch this code"
   as machine-readable structure the agent is bound by, rather than as prose
   it may ignore.
4. **A deterministic verification mechanism** that holds the knowledge layer
   accountable to the code over time, usable as a CI gate, with no model in
   the loop.

Taken together these turn "let the agent document the repo" from a source of
confident errors into a supervised, auditable process.

# 5. Implemented vs. designed

In the spirit of the method, this report is explicit about what the v0.1.0
release *mechanically guarantees* versus what it *designs and automates but
which depends on an agent's behaviour*. The distinction matters: the
mechanical column is reproducible and model-free; the agent column is
assistive and must itself be audited.

| Capability | Status in v0.1.0 | Nature |
|------------|------------------|--------|
| `orient` deterministic detection | **Implemented** | Mechanical, reproducible |
| `install` / `uninstall` with manifest | **Implemented** | Mechanical, reproducible |
| `verify` claim checking (+`--strict` CI gate) | **Implemented** | Mechanical, reproducible |
| Node ⇄ Python 1:1 parity | **Implemented** | Mechanical, CI-tested |
| Knowledge-layer + command templates | **Implemented** | Scaffolding (static) |
| `/cold-start` map drafting | Designed / automated | Agent-dependent, output is `[inferred]` |
| Semantic verification commands | Designed / automated | Agent-dependent |
| Feature catalog / readiness / simulation | Designed / automated | Agent-dependent |
| The human audit (step 4) | By design **not** automated | Human judgement |

The honest reading: the kit *mechanically* guarantees deterministic
detection, safe scaffolding, clean removal, and path-claim verification. It
*does not* guarantee the agent's drafted map is correct—that is precisely why
the map is `[inferred]` and why the human audit is a required, un-automatable
step.

# 6. Limitations and future work

- **Root-only detection.** `orient` inspects only the repository root for
  marker files. A monorepo with per-package manifests under `packages/*`, or a
  `backend/pom.xml` beside a `frontend/package.json`, is under-detected;
  today's workaround is explicit `--build`/`--test` flags or installing per
  sub-project. Recursive, workspace-aware detection is the natural next step.
- **Path-claim verification only.** `verify` checks that path claims point at
  real files; it does not judge whether a module's *described responsibility*
  is accurate. Semantic drift is left to the agent-assisted commands and,
  ultimately, the human—by design, but it bounds what the mechanical guarantee
  covers.
- **Claude-centric automation.** The knowledge layer and rules are
  tool-agnostic, but the slash commands, subagents, and skill are specific to
  Claude Code. Other agents get the map and must drive the workflow manually.
- **Heuristic detection.** Build and test commands are defaults inferred from
  markers; they are starting points for the human audit, not validated
  invocations.

Future work includes workspace-aware detection, richer semantic verification,
and broadening first-class command support beyond a single agent.

# 7. Reproducibility and citation

The kit is released under Apache-2.0. The source, this report, and the
templates live in the project repository; releases are archived with a
persistent identifier, and published artifacts carry checksums
(`CHECKSUMS.txt`). Detection, installation, and verification are deterministic
and model-free, so the mechanical results in this report are reproducible from
the source.

- **Repository:** <https://github.com/kunalsuri/ai-fication-kit>
- **Version:** 0.1.0 (Method v2 reference implementation), released 2026-06-12
- **Author:** Kunal Suri, CEA LIST — ORCID `0000-0002-2341-5343`
- **License:** Apache-2.0
- **DOI:** *[reserved — Zenodo concept DOI, to be inserted on the v0.1.0 release]*

Please cite via the repository's `CITATION.cff`. This report (TR-2026-01)
documents the first public release; the method matured through earlier
prototyping, which this release generalises into a stack-agnostic
implementation.
