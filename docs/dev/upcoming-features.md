<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Upcoming features — implementation-ready backlog

> Developer-facing planning notes for the kit itself. (What the repo *is* lives in
> `ai/`; this page is deliberately outside it.) Specs drafted 2026-07-03 by a
> heavy planning model (Claude Fable/Opus class) for a lighter coding model
> (Sonnet class) to implement one at a time. Triage and final say rest with the
> maintainer.

## How to use this file (instructions for the implementing agent)

1. The human names ONE feature ID. Implement only that one. Do not start another.
2. Read the **Shared engineering contract** below — every rule applies to every feature.
3. Read the feature's **Touchpoints** files *before* writing code; copy their style.
4. Draft a spec first: copy `ai/lab/specs/SPEC_TEMPLATE.md` to
   `ai/lab/specs/SPEC_<feature-id>.md`, fill it from the entry below, then implement.
5. When done, run the **Definition of done** checklist, then update this file's
   tracking table: set Status, tick Implemented, fill Completed date and Commit.
6. If the spec here conflicts with what you find in the code, STOP and ask the
   human — do not improvise around the conflict.

## Tracking table

<!-- The implementing agent updates ONE row per finished feature. Date format: YYYY-MM-DD. -->

| ID | Feature | Priority | Effort | Depends on | Status | Implemented | Added | Completed | Commit / PR |
|---|---|---|---|---|---|---|---|---|---|
| B1 | `doctor` — state-aware next step | P1 | S–M | — | shipped | ☑ | 2026-07-03 | 2026-07-03 | (this branch) |
| A3 | `drift --suggest` — ready-to-paste fixes | P1 | S | — | shipped | ☑ | 2026-07-03 | 2026-07-03 | (this branch) |
| B4 | Friendly CI feedback (step summary) | P1 | S | — | shipped | ☑ | 2026-07-03 | 2026-07-03 | (this branch) |
| A2 | `status` — health snapshot + badge | P2 | M | — | shipped | ☑ | 2026-07-03 | 2026-07-03 | (this branch) |
| A1 | `audit` — guided human audit | P2 | M | A3 helpful | idea | ☐ | 2026-07-03 | — | — |
| B3 | `demo` — zero-risk playground | P2 | S–M | — | idea | ☐ | 2026-07-03 | — | — |
| A5 | Native Cursor rules assets | P3 | S | — | idea | ☐ | 2026-07-03 | — | — |
| B2 | AI-tool detection in wizard | P3 | M | — | idea | ☐ | 2026-07-03 | — | — |
| B5 | Living progress page in target `ai/` | P3 | M | A2 | idea | ☐ | 2026-07-03 | — | — |
| A4 | Monorepo / workspace support | P4 | L | — | needs own spec | ☐ | 2026-07-03 | — | — |

Status values: `idea` → `spec drafted` → `in progress` → `shipped` (or `dropped`).

## Shared engineering contract (applies to every feature)

- **Runtime:** Node ≥ 18, ESM `.mjs`, **stdlib only — zero npm dependencies.** If you
  are about to `npm install` anything, you have misread the task.
- **Layout:** `install.mjs` is CLI parsing/dispatch only; logic lives in `lib/<name>.mjs`.
  A new command = add its name to the `COMMANDS` set in `install.mjs` (~line 95), add a
  dispatch branch, create `lib/<name>.mjs`. New flags must be added to the flag parser
  (unknown `--flags` are fatal by design). Reuse helpers from `lib/util.mjs`
  (`die`, `info`, `style`, `readText`, `isFile`, `isDir`, `ask`, `choose`, `confirm`,
  `isInteractive`, `KIT_VERSION`).
- **License header:** first line of every new file:
  `// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.` (`.mjs`) or the
  HTML-comment equivalent (`.md`, templates).
- **Safety discipline (non-negotiable):** no code execution, no network, no writes
  outside the target directory. The only sanctioned exceptions are local read-only
  git behind an explicit opt-in flag (pattern: `drift --git`) — a new exception must
  be opt-in, documented in the command's `docs/CLI-REFERENCE.md` section, and called
  out in `SECURITY.md`. Every command that writes must support `--dry-run`.
- **Deterministic:** no LLM calls in the CLI, ever. Same input ⇒ same output.
- **Provenance:** anything the kit or an agent writes into a target's `ai/` is tagged
  `[inferred]`. Only feature A1 may write `[verified]`, and only after an explicit
  interactive human confirmation (that IS the human's signature).
- **Generated artifacts** (reports/manifests) go to `ai/analysis/audit-reports/` in the
  target repo, as a JSON manifest + MD report pair — copy the pattern in `lib/verify.mjs`.
- **Files stamped into target repos** must be listed in the install manifest so
  `uninstall` removes them — follow how `lib/installer.mjs` records `fileHashes`.
- **Tests:** extend `test/run-tests.mjs` (fixture-repo pattern, `ok()` assertions).
  Interactive prompts must self-skip without a TTY / with `--yes` so CI passes.
- **Docs ride along in the same commit:** `docs/CLI-REFERENCE.md` (command index table
  + a section), `CHANGELOG.md` under `[Unreleased]`, and `README.md`/
  `docs/MULTI-TOOL-SETUP.md` only if user-facing behavior changes.

**Definition of done (run all, in the kit repo):**
`npm test` passes · `node install.mjs verify . --strict` passes · new command appears
in `docs/CLI-REFERENCE.md` index · CHANGELOG entry written · tracking table row updated.

---

## P1 features

### B1 · `doctor` — "what do I do next?"

**Context.** The workflow has 5 stages a beginner loses track of. All stages are
mechanically detectable from files on disk. Biggest anxiety-remover for
not-yet-AI-native users.

**Behavior.** `node install.mjs doctor <path>` — read-only, writes nothing, exit 0.
Detect the first stage whose condition holds and print a plain-language block:
current step ("You are at step N of 5"), one-sentence diagnosis, and the exact next
command or action to copy-paste.

| Step | Condition (checked in order) | Next action printed |
|---|---|---|
| 1 | no `ai/repo-profile.json` | run `shazam` |
| 2 | MODULE_MAP missing or still has template placeholder rows | run `/cold-start` in your agent (name the file that proves it: ai/guide/MODULE_MAP.md) |
| 3 | MODULE_MAP has `[inferred]` rows | human audit — point to `docs/AUDIT-GUIDE.md` (and the `audit` command once A1 ships) |
| 4 | no verification/drift manifests, OR latest ones contain failures | run `verify --strict` / `drift` |
| 5 | all rows `[verified]`, manifests clean | "map is trusted — maintenance mode"; suggest re-running `drift` after big changes |

**Touchpoints.** New `lib/doctor.mjs`; dispatch in `install.mjs`; reuse the
MODULE_MAP table parser from `lib/drift.mjs` (export it rather than copying);
placeholder detection = the marker text found in `templates/ai/guide/` templates
(read the template to get the exact placeholder strings — do not invent them).

**Acceptance.** Correct stage detected on: fresh repo, post-shazam repo,
post-cold-start repo, fully verified repo (build these as test fixtures). Never
writes a file (assert fixture tree hash unchanged). Output contains no jargon
term that `docs/GLOSSARY.md` doesn't define.

**Out of scope.** No auto-fixing, no interactivity, no git.

---

### A3 · `drift --suggest` — turn the report into an action

**Context.** `drift` names unmapped/vanished items but the fix is manual. Emit
ready-to-paste fixes; deterministic, no LLM.

**Behavior.** New flag `--suggest` on the existing `drift` command:
- For each **unmapped** directory: append a "Suggested rows" section to
  `DRIFT_REPORT.md` containing a paste-ready MODULE_MAP row:
  ``| `<dir>/` | _describe this directory_ | `<entry>` | ? | [inferred] |``
  where `<entry>` is the first match of: `index.*` / `main.*` / largest source file
  in the directory (source extensions already listed in `lib/drift.mjs`).
- For each **vanished** row: report the exact 1-indexed line number in
  MODULE_MAP.md to delete or fix.
- Mirror the same data as a `suggestions` array in `DRIFT_MANIFEST.json`.

**Touchpoints.** `lib/drift.mjs` only (plus flag parser in `install.mjs`,
CLI-REFERENCE, CHANGELOG). Keep Stability `?` and tag `[inferred]` in every
suggested row — never guess a Stability.

**Acceptance.** Fixture with one unmapped dir + one vanished row produces exactly
one suggested row (correct entry-point choice) and one line-number pointer;
without `--suggest` output is byte-identical to today; `--dry-run` still writes
nothing.

**Out of scope.** Editing MODULE_MAP.md itself. Suggestions land in the report only.

---

### B4 · Friendly CI feedback — plain English instead of a bare red ❌

**Context.** The stamped workflow (`templates/github/workflows/ai-check.yml.tmpl`)
fails with raw logs; beginners give up there. GitHub renders anything appended to
the file named by `$GITHUB_STEP_SUMMARY`.

**Behavior.** New flag `--github-summary` on `verify` and `drift`: after writing
their normal reports, if env `GITHUB_STEP_SUMMARY` is set, append a short markdown
summary to that file: ✅/❌ headline, per-problem plain-English line
("Your map mentions `X` but it no longer exists — edit MODULE_MAP.md line N, or ask
your agent to run /check-drift"), and "all N claims confirmed" on success. Without
the env var, the flag is a silent no-op (so local runs don't fail).
Update the workflow template to pass the flag and to run the steps with
`if: always()` so the summary appears on failure.

**Touchpoints.** `lib/verify.mjs`, `lib/drift.mjs` (share one formatting helper —
put it in `lib/util.mjs`), `install.mjs` flag parser,
`templates/github/workflows/ai-check.yml.tmpl`.

**Acceptance.** Test by pointing `GITHUB_STEP_SUMMARY` at a temp file: failure case
appends the explanation lines, success case appends the confirmation line, absent
env var appends nothing and exits with today's codes. Exit codes unchanged —
`--strict` semantics must not shift.

**Out of scope.** PR comments (needs a token — separate feature if ever), any
network call.

---

## P2 features

### A2 · `status` — one-command health snapshot

**Context.** "How trustworthy is my `ai/` layer right now?" currently takes three
commands and three reports.

**Behavior.** `node install.mjs status <path>`:
- Refactor `lib/verify.mjs` and `lib/drift.mjs` so their core scan is an exported
  pure function (compute, don't write); `status` calls both in-process for fresh
  results (structural drift only — never git).
- Parse MODULE_MAP for `[verified]` vs `[inferred]` row counts and the newest
  audit date.
- Print one block: counts, broken claims, drift items, days since last audit, and a
  single verdict line (e.g. "TRUSTED", "NEEDS AUDIT", "DRIFTING") with thresholds
  documented in code.
- `--json` additionally writes `ai/analysis/audit-reports/STATUS.json`, including a
  `badge` object in shields.io endpoint schema
  (`{schemaVersion:1, label:"ai-ready", message, color}`) so users can wire a badge.

**Touchpoints.** New `lib/status.mjs`; exports added to `lib/verify.mjs` /
`lib/drift.mjs` (their CLI behavior must stay byte-identical); `install.mjs`.

**Acceptance.** On this kit's own repo, counts match a hand count of MODULE_MAP;
existing `verify`/`drift` tests still pass unchanged; without `--json` nothing is
written.

**Out of scope.** Hosting the badge; the git-based stale check; fixing anything.

---

### A1 · `audit` — guided human audit (the human's signature, assisted)

**Context.** The audit is the method's bottleneck and is fully manual. This command
does the drudgery but the HUMAN makes every judgement — that is what keeps the
`[verified]` tag meaningful.

**Behavior.** `node install.mjs audit <path>` — interactive only:
- No TTY or `--yes` ⇒ exit with a friendly message ("audit is a human activity");
  never auto-verify anything.
- For each MODULE_MAP row (reuse the exported parser from A3/B1 work): show
  deterministic evidence — file count, 3 largest + 3 newest files (fs stat only, no
  git), current Stability/Status; then `choose()`: set Stability
  (frozen/stable/ours) and confirm, or **skip** (row untouched).
- On confirm: rewrite that row's Status cell to `[verified] (DD/MM/YYYY HH:mm)` —
  match the timestamp format already used in `ai/guide/MODULE_MAP.md` rows.
- Before the first write, save a timestamped backup next to the file (reuse the
  `_bkp_` naming from `lib/installer.mjs`). Support `--dry-run` (walk + prompt,
  print the would-be rows, write nothing).
- Optional `--git` (documented opt-in, same wording as drift's): adds
  last-commit-touching-directory to the evidence via local read-only git.

**Touchpoints.** New `lib/audit.mjs`; `lib/drift.mjs` (parser export);
`install.mjs`; `docs/AUDIT-GUIDE.md` gets a short "or use the audit command"
pointer (surgical edit — do not restructure that guide).

**Acceptance.** Skipped rows byte-identical after run; confirmed rows carry the tag
+ correct format; backup exists; non-TTY run writes nothing and exits 0 with the
message; table still parses (run `verify` + `drift` on the result in the test).

**Out of scope.** Auditing files other than MODULE_MAP.md; editing Responsibility
text; any batch/non-interactive verify mode (explicitly forbidden).

---

### B3 · `demo` — zero-risk playground run

**Context.** Nervous first-timers should see the full before/after without pointing
the kit at their own code. `examples/legacy-calculator` already exists for this.

**Behavior.** `node install.mjs demo` (no target argument — special-case it in
`install.mjs`, which currently requires one):
- Copy `examples/legacy-calculator` into a fresh directory under `os.tmpdir()`
  (`ai-fication-demo-<timestamp>`), run the `shazam` pipeline there with
  `--yes`-equivalent flags, then print: the demo path, a 5-line "what just got
  created" tour (ai/ folder, CLAUDE.md, .claude/ commands), the suggested next step
  ("open it in your agent and run /cold-start"), and how to delete it.
- **Packaging trap (do not skip):** npm only ships the paths in `package.json`
  `files` — `examples/` is NOT in that list, so under `npx` the example is absent.
  Add `"examples/legacy-calculator/"` to the `files` array as part of this feature,
  and make `demo` fail with a clear message if the example directory is missing.
- Writing to `os.tmpdir()` is a sanctioned, documented exception to
  "writes only inside the target" — say so in the CLI-REFERENCE section and
  `SECURITY.md`, mirroring how `drift --git` documents its exception.

**Touchpoints.** New `lib/demo.mjs` (reuse `lib/installer.mjs` / `lib/orient.mjs`
functions in-process — do not spawn child processes); `install.mjs`;
`package.json` `files`; `SECURITY.md`.

**Acceptance.** After `demo`: temp dir contains `ai/repo-profile.json`, stamped
CLAUDE.md, and install manifest; the user's cwd and the kit repo are untouched;
running it twice creates two independent dirs; `npm pack --dry-run` lists the
example files.

**Out of scope.** Auto-launching an agent; auto-cleanup daemons; using `value-demo`.

---

## P3 features

### A5 · Native Cursor rules assets

**Context.** README claims Cursor compatibility, but Cursor only gets the generic
`AGENTS.md` while Copilot gets prompts/chatmodes and Antigravity gets workflows.
(Codex needs nothing new — it reads `AGENTS.md` natively; say so in docs rather
than inventing files.)

**Behavior.** New `templates/cursor/rules/` stamped to `.cursor/rules/` in the
target: one `.mdc` file per existing workflow (mirror the 8 files in
`templates/github/prompts/` — same content adapted, do not write new methodology),
each with MDC frontmatter (`description:`, `alwaysApply: false`), plus one
`alwaysApply: true` rule pointing agents at `ai/INDEX.md` and the provenance rule.
Installer treats the new directory exactly like `templates/github/` (manifest
entries, uninstall coverage, incremental re-run classification).

**Touchpoints.** New files under `templates/cursor/`; `lib/installer.mjs` template
walk (check whether directories are auto-discovered or explicitly listed — follow
whichever it is); `docs/MULTI-TOOL-SETUP.md`; README badge row.

**Acceptance.** Install stamps `.cursor/rules/*.mdc`; uninstall removes them;
re-run keeps a human-edited rule (existing child-lock tests extended with one
cursor file); content of each rule references only paths that exist in a stamped
target repo.

---

### B2 · Detect the user's AI tool, tailor instructions

**Context.** Docs and post-install output describe all tools at once; a
Copilot-only beginner must filter out Claude/Antigravity noise.

**Behavior.** In the first-run wizard (`lib/intake.mjs`), add one question: "Which
AI coding tool will you use?" (Claude Code / Copilot / Cursor / Antigravity /
several / none yet). Pre-select a default by read-only file inspection —
`~/.claude/`, `~/.cursor/` or `.cursor/`, `~/.vscode/extensions/github.copilot*`
— tolerating any read failure silently (home-dir reads are inspection-only; never
write there). Store as `humanContext.primaryTool` in `ai/repo-profile.json`
(survives re-runs — `humanContext` carry-forward already exists). The post-install
"next steps" output prints only the chosen tool's instructions, with one line
pointing to `docs/MULTI-TOOL-SETUP.md` for the rest; "none yet" prints a short
plain-language menu of options. `--yes`/no-TTY keeps today's generic output.

**Touchpoints.** `lib/intake.mjs`, the next-steps printer (find it in
`lib/installer.mjs` / `install.mjs` shazam branch), `docs/MULTI-TOOL-SETUP.md`.

**Acceptance.** Wizard answer persists across a re-run; `--yes` path unchanged
(existing tests must not need edits); detection failure (no home dir) still
completes the wizard.

**Out of scope.** Changing which templates get stamped (all tools' assets are still
installed — only the *messaging* is tailored).

---

### B5 · Living progress page in the target repo

**Context.** `START-HERE.html` (kit repo root) is static marketing; beginners need
the same thing but about *their* repo, refreshed as they progress. Depends on A2.

**Behavior.** New template `templates/ai/START-HERE.html.tmpl` stamped to
`ai/START-HERE.html` in the target (manifest-tracked). A shared
`refreshProgressPage()` in a new `lib/progress.mjs`, called at the end of
`install`, `verify`, `drift`, `status` (and A1 `audit` if shipped): regenerates the
page from the template + the A2 status data. All data **inlined** into the HTML
(no fetch — `file://` XHR is blocked by browsers; the page must work offline by
double-click). Content: 5-step checklist with the doctor stages (reuse B1
detection), verified/inferred counts, open drift items, and jargon tooltips whose
one-liners are sourced from `docs/GLOSSARY.md` definitions (copy the needed lines
into the template at build time — target repos don't have the kit's docs/).

**Touchpoints.** `templates/ai/`, new `lib/progress.mjs`, call sites in
`lib/installer.mjs` / `lib/verify.mjs` / `lib/drift.mjs`; INDEX template
(`templates/ai/INDEX.md.tmpl`) gains one manifest row for the page.

**Acceptance.** Page valid HTML, zero external requests (grep for `http` in the
output), reflects state changes after a verify run; uninstall removes it; commands
still work when the page is absent (user deleted it).

---

## P4 — parked until its own spec exists

### A4 · Monorepo / workspace support

**Context.** `lib/orient.mjs` reads root markers only; workspace repos (npm/pnpm
workspaces, Turborepo, Nx, Lerna) get one flat profile and MODULE_MAP treats
`packages/` as a single row — yet these are exactly the kit's target repos.

**Direction (not yet a spec).** Phase 1: orient detects workspace manifests
(`package.json` `workspaces`, pnpm-workspace.yaml, lerna.json, turbo.json, nx.json)
and writes a `workspaces[]` array (name, path, detected stack) into
`ai/repo-profile.json`. Phase 2: drift treats each workspace package as a mappable
unit. Phase 3: MODULE_MAP template guidance for per-package sections. **Do not
implement from this paragraph** — it spans orient, drift, and templates; a heavy
model should write `ai/lab/specs/SPEC_A4-monorepo.md` first and split the phases.

---

## Triage notes

- Suggested order: B1 → A3 → B4 (P1s are independent), then A2 before B5.
- A3/B1 both need the MODULE_MAP parser exported from `lib/drift.mjs` — whichever
  ships first does that refactor; the second reuses it.
- Keep each feature to its own branch and its own CHANGELOG bullet; one feature per
  session for the implementing model.
