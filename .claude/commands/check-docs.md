---
description: Kit-maintainer diagnostic (LOCAL-ONLY, not distributed) that audits the README and docs/ for staleness against the repo's real command/skill/CLI roster, stamped tree, and cross-doc consistency. Read-only; produces a severity-ranked findings report.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Run the **check-docs** diagnostic. Read-only. Produce a structured findings
report; do NOT edit any file.

> **Local-only command.** This lives in `.claude/commands/` with no twin in
> `templates/`, so the installer never stamps it into target repos. It audits
> *this kit's own* README and docs — it is a maintainer tool, not a distributed
> workflow command. See `.claude/LOCAL-ONLY-COMMANDS.md`. (Its own file, and any
> other local-only command, is therefore expected to be absent from the
> distributed roster — do not flag that as drift.)

## Why this exists
Docs drift silently: a feature adds a command, a skill, or a stamped file, and
the prose roster, the `What You Get` tree, and the counts scattered across the
docs quietly fall behind the code. `verify`/`drift`/`/check-drift` guard the
*target-repo* knowledge layer (`ai/`), not the kit's *own* public docs. This
command closes that gap.

## Ground truth — derive these FIRST, from the code, before reading any prose
The distributed reality is defined by `templates/`, **not** by `.claude/`
(which also holds local-only extras like this command and `/implement-spec`).
Derive, deterministically:

- **Distributed workflow commands** = the `*.md` files in
  `templates/claude/commands/` (their count and basenames). This is the
  canonical "what users get" roster. Cross-check parity with
  `templates/github/prompts/`, `templates/agents/workflows/`, and
  `templates/cursor/rules/` (a command is "universal" only if present in all).
- **Distributed skills** = the sub-directories of `templates/claude/skills/`
  and `templates/agents/skills/`.
- **CLI commands** = the `command === "…"` branches routed in `install.mjs`
  (and mirrored in the `docs/CLI-REFERENCE.md` "Command index" table).
- **Stamped `ai/` tree** = the structure under `templates/ai/` plus the files
  `install.mjs` writes directly (`ai/repo-profile.json`,
  `ai/install-manifest.json`, optionally `ai/repo-indepth.json`).
- **Local-only commands** = present in `.claude/commands/` but absent from
  `templates/claude/commands/`; the intended list is `.claude/LOCAL-ONLY-COMMANDS.md`.

Use `ls`/Glob and grep for these — do not eyeball. Every count you assert in a
finding must trace to one of these sources.

## Docs in scope
`README.md`, `docs/README.md`, `docs/FAQ.md`, `docs/MULTI-TOOL-SETUP.md`,
`docs/METHODOLOGY.md`, `docs/CLI-REFERENCE.md`, `docs/GETTING-STARTED.md`,
`docs/reports/technical-report-draft.md`, and the root `CLAUDE.md` / `AGENTS.md`.

## Checks

### Section D — Command & skill roster
| ID | Check | Severity |
|----|-------|----------|
| D1 | Every prose count of workflow commands (e.g. README's "The Ten Workflow Commands" heading, "ten workflow commands", MULTI-TOOL-SETUP's "All ten commands") equals the number of `templates/claude/commands/*.md` files | ❌ |
| D2 | Every explicit command **list/table** (README roster table, MULTI-TOOL cross-tool table, technical-report §9.1) names exactly the basenames in `templates/claude/commands/` — none missing, none removed | ❌ |
| D3 | Every skill reference (README tree + highlights, FAQ, MULTI-TOOL-SETUP, technical-report §9.3) matches the sub-dirs of `templates/claude/skills/` / `templates/agents/skills/` — no skill named that isn't shipped, none shipped that isn't named | ❌ |
| D4 | No local-only command (per `.claude/LOCAL-ONLY-COMMANDS.md`) is described anywhere as "stamped", "installed", or part of the distributed roster | ⚠️ |

### Section E — CLI-command & stamped-tree drift
| ID | Check | Severity |
|----|-------|----------|
| E1 | Every "all N commands" claim (e.g. docs/README.md's CLI-REFERENCE blurb) equals the number of CLI command branches in `install.mjs` | ❌ |
| E2 | The `docs/CLI-REFERENCE.md` "Command index" table has one row per `install.mjs` command branch — none missing, none stale | ❌ |
| E3 | The README "What You Get" tree lists every path `templates/ai/` stamps and every directly-written `ai/` file (spot-check: `START-HERE.html`, `INDEX.md`, `lab/WORKLOG.md`, `lab/reviews/`, `guide/*`, `analysis/*`) | ❌ |
| E4 | The technical-report §8.1 directory tree agrees with the same stamped-tree ground truth | ⚠️ |

### Section F — Cross-doc consistency
| ID | Check | Severity |
|----|-------|----------|
| F1 | The command / skill / CLI counts agree with each other across all in-scope docs (a number stated in two places must match) | ❌ |
| F2 | Version strings agree: `package.json` `version` vs the README citation `version:` vs `CITATION.cff` vs the newest `CHANGELOG.md` section | ⚠️ |
| F3 | No doc references a file, command, or stack that no longer exists (e.g. a removed `install.py` / Python path, a renamed command) | ⚠️ |

### Section G — Path-claim resolution
| ID | Check | Severity |
|----|-------|----------|
| G1 | Every backtick-wrapped repo-relative path in the in-scope docs resolves on disk (same discipline `verify` applies to `ai/`, extended to README + docs/). Run `node install.mjs verify . --strict` first to clear the `ai/` layer, then apply the path check to the docs above | ❌ |
| G2 | Every relative markdown link `[text](path)` in `README.md` and `docs/README.md` resolves on disk | ⚠️ |

## Output format
Emit the report directly to the user (do NOT write a file). Use this structure:

```
check-docs — findings
══════════════════════════════════════════════════

Ground truth (from templates/ + install.mjs)
────────────────────────────────────────────
Workflow commands: <N>  ·  Skills: <list>  ·  CLI commands: <M>
Local-only (not distributed): <list>

Roster (Section D)
──────────────────
✅/⚠️/❌  <ID> <check name>
           → <where it's wrong>: <one-line concrete fix>   ← omit for ✅

CLI & tree (Section E)
──────────────────────
✅/⚠️/❌  <ID> <check name>
           → <one-line concrete fix>

Cross-doc (Section F)
─────────────────────
✅/⚠️/❌  <ID> <check name>
           → <one-line concrete fix>

Path claims (Section G)
───────────────────────
✅/⚠️/❌  <ID> <check name>
           → <file:line>: <one-line concrete fix>

Summary
───────
X passed · Y warnings · Z errors
Next step: <single highest-priority action — one sentence>
```

## Reporting discipline
- Report **every** check, not just failures — passing checks build confidence.
- For every ❌/⚠️, cite the **exact file and, where possible, the line or
  heading** that is wrong, and give a concrete one-line fix — never just "this
  is stale."
- When prose and code disagree, the **code (`templates/` + `install.mjs`) is the
  source of truth**; the fix always adjusts the prose, never the code.
- The "Next step" names only the single highest-priority action.

## What this command does NOT do
- Does not auto-edit any file — it diagnoses and reports only.
- Does not audit the target-repo `ai/` knowledge layer's file-path claims for
  drift against source — that is `verify` / `drift` / `/check-drift`.
- Does not judge `ai/guide/` content quality — that is
  `/post-cold-start-verification` / `/verify-ai-readiness`.
- Does not get distributed to target repos — it is local to this kit (see
  `.claude/LOCAL-ONLY-COMMANDS.md`).
