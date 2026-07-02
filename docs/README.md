<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# docs/ — the documentation hub

Everything about *using* the kit and *understanding* the method lives here.
(The knowledge the kit generates about a target repo lives in that repo's own
`ai/` folder — that is the product; these pages are the manual.)

## Find your path

| You are… | Start with | Then |
|---|---|---|
| **New — I want to try the kit** | [GETTING-STARTED.md](GETTING-STARTED.md) — zero to a trusted map in five steps | keep the [Glossary](GLOSSARY.md) open in a tab |
| **About to audit** the drafted maps | [AUDIT-GUIDE.md](AUDIT-GUIDE.md) — the 30-minute field guide the method hinges on | [FAQ.md](FAQ.md) when something looks wrong |
| **Not using Claude Code** (Copilot, Antigravity, Cursor, Codex) | [MULTI-TOOL-SETUP.md](MULTI-TOOL-SETUP.md) — what each tool gets, how to drive it | — |
| **Looking up a command or flag** | [CLI-REFERENCE.md](CLI-REFERENCE.md) — every command, flag, output, exit code | — |
| **Evaluating the method** (researcher, tech lead) | [METHODOLOGY.md](METHODOLOGY.md) — the trust model and workflow, in full | [reports/technical-report-draft.md](reports/technical-report-draft.md) |
| **Contributing to the kit** | [FUNCTIONALITY.md](FUNCTIONALITY.md) — module-by-module code guide | [system-diagrams/](system-diagrams/README.md) |
| **Releasing** (maintainer) | [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) | — |

## All documents, by kind

**Learn (tutorial):**
- [GETTING-STARTED.md](GETTING-STARTED.md) — the one linear path, with a checkpoint after each step.
- [../examples/legacy-calculator](../examples/legacy-calculator/README.md) — full before/after walkthrough on a bundled sample repo.

**Do (how-to guides):**
- [AUDIT-GUIDE.md](AUDIT-GUIDE.md) — deciding Stability, the evidence bar for `[verified]`, worked rows, common mistakes.
- [MULTI-TOOL-SETUP.md](MULTI-TOOL-SETUP.md) — running the workflow in Claude Code, GitHub Copilot, Google Antigravity, Cursor, or Codex.
- [FAQ.md](FAQ.md) — troubleshooting: misdetection, monorepos, re-runs and upgrades, the `[verified]` child-lock, wizard questions.

**Look up (reference):**
- [CLI-REFERENCE.md](CLI-REFERENCE.md) — all 8 commands, all flags, what each writes, exit codes.
- [GLOSSARY.md](GLOSSARY.md) — one-line definitions of every term the kit assumes.
- [FUNCTIONALITY.md](FUNCTIONALITY.md) — the kit's own modules and functions (for contributors).
- [system-diagrams/](system-diagrams/README.md) — Use Case, Class, Sequence, and State Machine diagrams; [system-diagrams/user-workflow.md](system-diagrams/user-workflow.md) for the end-to-end lifecycle.

**Understand (explanation):**
- [METHODOLOGY.md](METHODOLOGY.md) — the trust model (`[inferred]` → `[verified]`), Process 1 vs 2, the 7-step workflow, how the map stays honest over time.
- [PROBLEM-SOLUTION-STATEMENT.md](PROBLEM-SOLUTION-STATEMENT.md) — the one-page problem framing.
- [reports/technical-report-draft.md](reports/technical-report-draft.md) — the academic treatment (draft).
- [dev/lessons-learnt/](dev/lessons-learnt/drift-blindspots-and-automation-bias.md) — recorded lessons, e.g. drift blind spots and automation bias.

**Maintain:**
- [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md) — release-day procedure (tagging, Zenodo, post-release).
- `dev/` — development notes and reusable prompts; `images/` — figures used by the README and these docs.

Reserved for the project's public materials:
- `AI-fication-Kit-TR-2026-01.pdf` — the technical report (method, contribution statement, implemented/designed table). **Note: This file is a reserved placeholder; it is not present in v0.1.0.**
- `diagrams/` — method figures used in the report and talks.
- Video walkthrough: linked from the README when published (hosted externally; Zenodo record keeps the link, not the file).
