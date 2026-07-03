<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Upcoming features — the developer's idea backlog

> Developer-facing planning notes for the kit itself — what *may* come next, so a
> reader can see where this tool is headed. (What the repo *is* lives in `ai/`;
> this page is deliberately outside it.) Drafted with AI assistance from a codebase
> review on 2026-07-03; triage and final say rest with the maintainer. When an idea
> is picked, it graduates to a spec (copy `ai/lab/specs/SPEC_TEMPLATE.md`) before
> implementation, per the lifecycle in `ai/lab/README.md`.

Two batches of five. Batch A targets overall end-user impact; Batch B targets the
first-time, not-yet-AI-native user. "Effort" is a rough relative guess, not a promise.

## Index

| # | Idea | Audience | Effort | Status |
|---|---|---|---|---|
| A1 | Guided human-audit mode (`audit` command) | everyone | medium | idea |
| A2 | Knowledge-layer health dashboard (`status` command) | everyone | medium | idea |
| A3 | Drift auto-suggestions (`drift --suggest`) | everyone | small | idea |
| A4 | Monorepo / workspace support | teams on large repos | large | idea |
| A5 | Native Cursor & Codex assets | multi-tool users | small | idea |
| B1 | State-aware next-step guide (`doctor` command) | beginners | small–medium | idea |
| B2 | AI-tool detection with tailored instructions | beginners | medium | idea |
| B3 | Zero-risk playground run (`demo` command) | beginners | small–medium | idea |
| B4 | Friendly CI feedback (step summary / PR comment) | beginners | small | idea |
| B5 | Living per-repo progress page | beginners | medium | idea |

---

## Batch A — end-user impact

### A1 · Guided human-audit mode — `audit` command

The human audit is the workflow's core bottleneck (30 minutes to a few hours) and is
entirely manual today: read the audit guide, hand-edit `ai/guide/MODULE_MAP.md`,
get the `[verified]` timestamp format right. An interactive command would walk the
human row-by-row, show deterministic evidence per directory (file count, top files,
last commit touching it), let them pick a Stability and confirm, then write the
`[verified]` tag correctly. Keeps the human in the loop, removes the drudgery — and
only this human-driven flow writes the tag, so the provenance rule stays intact.

### A2 · Knowledge-layer health dashboard — `status` command

There is no single answer to "how trustworthy is my ai/ layer right now?" — users run
`verify`, `drift`, and `check-repo-maturity` separately and read three reports. A
`status` command aggregates them into one score/summary: verified vs. inferred row
counts, broken claims, drift items, days since last audit. Bonus: emit a
shields.io-compatible JSON endpoint so repos can show an "AI-ready" badge.

### A3 · Drift auto-suggestions — `drift --suggest`

`drift` (see `lib/drift.mjs`) detects unmapped directories and vanished entries, but
the fix is fully manual. It could additionally draft ready-to-paste MODULE_MAP rows
for unmapped directories (responsibility blank or heuristically guessed, tagged
`[inferred]`, Stability `?`), and point at exactly which vanished-row lines to delete.
Deterministic, no LLM — turns a report into an action.

### A4 · Monorepo / workspace support

`orient` (see `lib/orient.mjs`) reads root marker files only. Monorepos
(npm/pnpm workspaces, Turborepo, Nx, Lerna) are exactly the large legacy codebases
the kit targets, yet a workspace repo gets one flat profile and a MODULE_MAP that
treats a packages directory as a single row. Detect workspaces and generate
per-package profile entries plus per-package MODULE_MAP sections.

### A5 · Complete the multi-tool matrix — native Cursor & Codex assets

The README says the kit "also works with Cursor | Codex", but that only means they
read `AGENTS.md`. Unlike Copilot (prompts + chatmodes under `templates/github/`) and
Antigravity (workflows under `templates/agents/`), there are no native equivalents.
Stamp Cursor rules files (*.mdc) and Codex prompt files carrying the same
cold-start/add-feature workflows — mostly template work reusing the existing
stamping pipeline in `lib/installer.mjs`.

---

## Batch B — the not-yet-AI-native first-timer

### B1 · State-aware next-step guide — `doctor` command

The journey has mechanically detectable stages: no ai/ folder yet → run shazam;
MODULE_MAP still has placeholder rows → run /cold-start in the agent; rows are
`[inferred]` → time for the human audit; verify/drift reports have failures → here is
the fix. A user who walks away for a week loses their place. `doctor` inspects the
repo and prints one plain-language answer: "You're at step 3 of 5. Next: …".
Pure file inspection, like everything else in the kit.

### B2 · Detect the user's AI tool, tailor every instruction to it

The kit stamps assets for Claude Code, Copilot, and Antigravity, and the docs
describe all of them — a beginner with only VS Code + Copilot must mentally filter
out the rest. During the wizard (`lib/intake.mjs`) or `doctor`, detect what is
installed by file inspection (agent config directories on disk), ask "which tool do
you use?" when ambiguous, then print only that tool's instructions — including a
friendly "you don't have any AI coding tool yet; here are your options" path. Store
the answer under `humanContext` in `ai/repo-profile.json`.

### B3 · Zero-risk playground run — `demo` command

The repo ships `examples/legacy-calculator`. A `demo` command copies it into a temp
directory and runs the full shazam flow there, then says: "look around — this is
exactly what would happen to your repo; nothing here touched your files."
Nervous first-timers see the before/after with zero stakes.

### B4 · Friendly CI feedback instead of a bare red X

The stamped workflow (`templates/github/workflows/ai-check.yml.tmpl`) runs
`verify --strict` and `drift --strict` and simply fails. For a beginner, a failed
check with a wall of log output is where they give up. Two cheap upgrades: write a
plain-English explanation to the GitHub step summary ("Your map mentions a file that
no longer exists. Fix: edit MODULE_MAP.md line 14, or ask your agent to run
/check-drift"), and optionally post the same as a PR comment. The JSON manifests
already contain everything needed — this is formatting, not new analysis.

### B5 · A living progress page — make START-HERE about *their* repo

`START-HERE.html` is a static intro that never changes. Stamp a version into the
target repo's ai/ folder that each command refreshes: a visual 5-step checklist with
actual progress, current health (verified vs. inferred counts, open drift items),
and hover-tooltips for jargon pulled from `docs/GLOSSARY.md`. Opens in a browser —
no server, no dependencies.

---

## Triage notes

- Suggested first picks for a beginner-focused release: B1, then B3, then B4.
- A3 and A5 are the smallest items in Batch A; A4 is the largest overall.
- When picking an idea, draft its spec from `ai/lab/specs/SPEC_TEMPLATE.md` and mark
  the row's Status here as `spec drafted` → `in progress` → `shipped` (then it lands
  in the feature catalog per the lifecycle in `ai/lab/README.md`).
