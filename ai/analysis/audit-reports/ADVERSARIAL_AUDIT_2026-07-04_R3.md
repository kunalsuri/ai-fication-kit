<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Adversarial audit R3 — 2026-07-04 `[inferred]`

Scope: full re-sweep after PR #23 (engineering loop: fix-bug / review-change /
WORKLOG, merged `bafa3d0`), targeting the six defect classes from this repo's
incident history: stale cross-references, unquoted interpolation, platform
gaps, ownership conflicts on generated files, mechanical-vs-semantic validation
gaps, and cross-module consistency after incremental change.

Method: read every module in `lib/` + `install.mjs` + `test/*.mjs` + the
changed templates in full; ran the kit's own gates against itself
(`verify --strict`, `drift --git --strict`, `sha256sum -c CHECKSUMS.txt`);
live-reproduced every HIGH/CRITICAL finding in throwaway fixtures. Findings
marked **[repro]** were reproduced with a command, not inferred from reading.

Status of prior audits: all 16 R2 FIXED rows re-checked — none regressed.
The 11 R2 OPEN rows were re-verified; all are still present (see §12).

---

## P0

### 1. `main` is failing its own CI gate: PR #23 merged without re-anchoring the drift baseline **[repro]**

- **Where:** `.github/workflows/ai-check.yml:27` (`drift . --git --strict` on
  every push to main and every PR) · `ai/guide/MODULE_MAP.md:7` (baseline
  `4bbf46c`) · `test/run-deep-test.mjs:90` (same gate in `npm run deep-test`).
- **Issue:** commits after `4bbf46c` (PR #23 `51311ea`/`f58bfc1`, snapshot
  refresh `b1fd391`, merge `bafa3d0`) touched `lib/`, `templates/` (5 mapped
  rows), `test/`, and `docs/` — all `[verified]` rows — and no re-audit or
  re-anchor accompanied the merge, unlike every prior PR (`5963e9c`,
  `c48c480`, `7828604`).
- **Evidence (2026-07-04):**
  `node install.mjs drift . --git --strict` → `unmapped 0  vanished 0  stale 8`
  → exit 1. Rows flagged: `lib/`, `templates/`, `templates/ai/`,
  `templates/claude/`, `templates/github/`, `templates/agents/`, `test/`,
  `docs/` (MODULE_MAP lines 30–37).
- **Failure scenario:** the "AI Knowledge-Base Check" workflow is red on main
  right now; every future PR fails it regardless of content; `npm run
  deep-test` fails at step 3. Contributors learn to ignore a red gate — the
  exact trust-rot the gate exists to prevent.
- **Fix:** human re-audits the 8 rows and re-anchors `Last verified:` to the
  merge commit (the established re-anchor procedure); structurally, close
  AUD-R2-11 (make the guided `audit --git` maintain the anchor) and make the
  re-anchor step part of the PR checklist / release gate so a merge cannot
  land without it.

## P1

### 2. The `--force` child-lock false-positives on the templates' own `[verified]` prose — the documented `--force` contract is unreachable for every core doc **[repro]**

- **Where:** `lib/installer.mjs:111` (`if (diskText.includes(VERIFIED_TAG))
  return … "locked"`) · trigger text ships in `templates/CLAUDE.md.tmpl:20,53`,
  `templates/AGENTS.md.tmpl:23`, `templates/ai/guide/MODULE_MAP.md.tmpl:27`,
  `templates/ai/lab/WORKLOG.md.tmpl:22`, `templates/github/copilot-instructions.md`,
  `templates/ai/INDEX.md.tmpl`.
- **Issue:** the lock is meant to protect *human audit signatures*
  (`lib/installer.mjs:88-92`), but it tests for the literal `[verified]`
  anywhere in the edited file — and the pristine templates themselves contain
  that literal in their provenance-rule prose. Any human edit (one appended
  line, a typo fix) to a stamped CLAUDE.md / AGENTS.md / MODULE_MAP.md /
  WORKLOG.md therefore classifies as `locked`.
- **Repro:** stamp a fixture, `echo "my typo fix note" >> CLAUDE.md`, then
  `install . --yes --force` →
  `keep (child-lock: human [verified] content — only --force-verified overrides)  CLAUDE.md`.
  No human ever wrote a `[verified]` signature in that file.
- **Failure scenario:** (a) `--force` as documented (`install.mjs:97-98`:
  "overwrite files you edited (timestamped backup taken first)") never
  applies to the four most-edited files — kit template updates cannot be
  rolled out to them; (b) the operator is pushed toward `--force-verified`,
  whose warning then lists the template's own prose lines as "signatures that
  will be LOST", teaching users the scary warning is noise; (c) the plan
  output misattributes template prose to a human.
- **Fix:** classify with the same `humanAdded` logic the warning printer
  already uses (`lib/installer.mjs:225-228`): lock only when the disk file
  contains a `[verified]` line that is **not** present verbatim in the
  freshly stamped template. Note `classifyAction` already receives `newText`,
  so this is a local change. (The unit test at `test/run-tests.mjs:1858-1859`
  only covers the disk==template case; add an edited-plus-template-prose case.)

### 3. Process-2 backups are written before the user consents, then the abort message denies it **[repro]**

- **Where:** `lib/installer.mjs:150-164` (backup copy runs at the top of
  `install()`) vs `:262-275` (the `--force-verified` typed confirmation and the
  `Write N file(s)?` confirm — both print `Aborted; nothing written.`).
- **Repro:** fixture with a user-authored `CLAUDE.md`, run
  `install .` (no `--yes`) and decline → `CLAUDE_bkp_20260704_084745.md`
  exists in the repo; the transcript claimed nothing was written.
- **Failure scenario:** an operator evaluating the tool answers "no" precisely
  because they don't want their repo touched — and the repo was touched. On
  repeated aborted attempts, backup files accumulate (`_2`, `_3`, …). Same
  class as AUD-R2-26, but for real writes, not a message.
- **Fix:** carry the pending backups in the plan and perform the `copyFile`
  in the write phase after both confirmations (the `backedUpFiles` routing
  needs only the decision, not the copy, up front).

### 4. `orient` re-run silently destroys the wizard's `humanContext` (and any prior profile fields) **[repro]**

- **Where:** `install.mjs:228-232` — the `orient` command writes the fresh
  `orient()` result over `ai/repo-profile.json` unconditionally.
  `lib/installer.mjs:289-295` carries `humanContext` forward on the
  install/shazam path; the orient path has no equivalent.
- **Repro:** profile on disk with `humanContext` → `node install.mjs orient .`
  → `grep -c humanContext ai/repo-profile.json` → `0`.
- **Failure scenario:** `docs/CLI-REFERENCE.md` presents `orient` as a
  safe re-runnable "detect stack facts" step; a user refreshing stack facts
  after adding a build system loses the first-run wizard answers
  (`skillLevel`, branch acknowledgement, stack shape, `primaryTool`) that
  `/cold-start` and the post-install messaging are documented to consume —
  and `shazam` will not re-ask (it only asks when `humanContext` is absent,
  and only interactively).
- **Fix:** in the `orient` branch, read the existing profile and copy
  `humanContext` onto the fresh profile before writing — the same three lines
  the installer already has.

## P2

### 5. Stale trust claim: "It NEVER overwrites a file you have edited" (`install.mjs:50`) is false for Process 2

- **Where:** `install.mjs:50-56` vs `lib/installer.mjs:165-166,207-208`.
- **Issue:** a user-authored `CLAUDE.md`/`AGENTS.md` (no kit footer, no
  `[verified]`) is overwritten on a **plain `install`/`shazam` with no
  `--force`** — deliberately, after a timestamped backup
  (`overwrite-backed-up`). The header's absolute guarantee ("NEVER … --force
  overwrites edited files only after a backup") has no carve-out for this,
  and it is the first thing the header tells a security-reviewing reader.
  Same class as AUD-R2-15 (fixed for the git/write-outside claims; this
  sentence was not covered).
- **Failure scenario:** a reviewer reads the header, points the kit at a repo
  with a hand-written CLAUDE.md, runs plain `install`, and their file is
  replaced (backup or not, the stated contract was "never").
- **Fix:** append the carve-out: "(One exception: on first contact, a
  user-authored CLAUDE.md/AGENTS.md without the kit footer is backed up with
  a timestamp and then replaced — Process 2.)"

### 6. `indepth`'s gitignore directory rules over-match sibling names that share a prefix **[repro]**

- **Where:** `lib/indepth.mjs:42-44` — a rule ending `/` gets `pattern += "?.*"`,
  making the trailing slash *optional*: `build/` compiles to
  `/(^|\/)build\/?.*/`.
- **Repro:** `.gitignore` containing `build/`, tree containing
  `builder/mod.js` → the compiled rule matches `builder/mod.js`; live
  `indepth` run counts 2 files instead of 3 — `builder/` is silently excluded
  from LOC, module structure, architecture inference, and dependency-edge
  scanning.
- **Failure scenario:** any repo with `lib/` ignored-dir-name prefixes
  (`build/`+`builder/`, `dist/`+`distribution/`, `out/`+`outbox/`) gets a
  skewed `ai/repo-indepth.json` with no warning; the "human verification
  recommended" caveat can't help because the omission is invisible.
- **Fix:** for dir rules use `pattern += "(/.*)?$"`-style matching (slash
  required before descendants), and anchor the non-dir case with `($|/)`
  as already done — only the dir branch is wrong.

### 7. `test.yml`'s syntax gate never learned about the five modules added after it was written

- **Where:** `.github/workflows/test.yml:24` — `node --check` lists
  `install.mjs`, 8 `lib/` files, and `test/run-tests.mjs`, but not
  `lib/audit.mjs`, `lib/status.mjs`, `lib/doctor.mjs`, `lib/demo.mjs`,
  `lib/progress.mjs`, `test/run-deep-test.mjs`, `test/release-check.mjs`.
- **Failure scenario:** the check gives partial coverage while reading as
  complete — a parse error in `lib/demo.mjs` (imported dynamically nowhere,
  statically only by `install.mjs`) or `test/release-check.mjs` (only run in
  the release workflow) passes the "Syntax check" step. Classic
  cross-module-consistency rot: each new module needed a manual list edit
  nobody made.
- **Fix:** `node --check install.mjs lib/*.mjs test/*.mjs` via a small glob
  loop, or generate the list.

## P3

### 8. The engineering loop's very first ledger row breaks the loop's own rules

- **Where:** `ai/lab/WORKLOG.md:36` (row `W-001`) · rules in
  `ai/lab/README.md` ("no merge before step 4 (Review)", "no closed row
  before step 6") · `templates/ai/lab/WORKLOG.md.tmpl:31` (example row).
- **Issues:** (a) the row's Review cell is `—` and Status is `in-review`,
  yet PR #23 merged (`bafa3d0`) — merged without a review artifact, and the
  row was never advanced to `shipped`; (b) the Commits/PR cell says
  `(this branch)`, which is unresolvable after merge — the one cell that ties
  the ledger to history points nowhere; (c) the commented example row uses ID
  `W-001`, the same ID as the first real row — the "next `W-<n>`" instruction
  invites a duplicate (use `W-000` or `W-EXAMPLE` in the template).
- **Failure scenario:** the ledger's first entry teaches every future reader
  (human or agent) that Review `—` + merged + stale Status is acceptable —
  the process document's worked example contradicts the process.
- **Fix:** backfill: real PR reference, a review doc or an explicit recorded
  waiver, Status `shipped`; change the template's example ID.

### 9. `indepth` dependency categories: Cargo dev-dependencies and all Gemfile gems counted as production

- **Where:** `lib/indepth.mjs:278-291` — the Cargo parser sets `inDeps` for
  both `[dependencies]` and `[dev-dependencies]` and books every entry as
  `byCategory.production` / `category: "prod"`; `lib/indepth.mjs:302-310`
  books every Gemfile gem as prod (Gemfile `group :development do` blocks are
  ignored).
- **Failure scenario:** the printed "Production / Dev" split
  (`printIndepthReport`) and `ai/repo-indepth.json` misstate the dependency
  posture of Rust/Ruby repos — e.g. a crate with 2 deps + 30 dev-deps reports
  32 production dependencies.
- **Fix:** track the current section and book `[dev-dependencies]` /
  `group :development` entries as `development`.

### 10. `install.mjs:27-31` header understates what `status` writes

- **Where:** `install.mjs:30-31` ("Writes ai/analysis/audit-reports/STATUS.json
  **only with --json**") vs `lib/status.mjs:119` — `status` unconditionally
  rewrites `ai/START-HERE.html` (via `refreshProgressPage`) whenever the page
  exists. `lib/status.mjs:4-6` discloses this; the CLI header a
  reader audits first does not.
- **Fix:** mirror status.mjs's own disclosure into the header sentence.

### 11. `runCmd`'s comment invites callers to break it

- **Where:** `lib/indepth.mjs:10-14` — the comment advertises "callers can
  write git format strings like `--format='%(refname:short)'`", but the
  implementation `cmd.split(" ")` breaks any argument containing a space, and
  `part.replace(/'/g, "")` strips single quotes from *every* token. All
  current call sites happen to be space-free; the first future format string
  with a space (e.g. `--format='%h %ad'`, exactly what sibling
  `lib/audit.mjs:78` uses via a proper argv array) fails silently
  (empty/garbled output swallowed by the `success:false` path).
- **Fix:** change the signature to `runCmd(bin, args, cwd)` with a real argv
  array (as `lib/drift.mjs:160-163` and `lib/audit.mjs:41-44` already do),
  or correct the comment to state the space limitation.

---

## 12. Prior OPEN register rows — re-verified 2026-07-04, all still present

| ID | Still at | Note |
|---|---|---|
| AUD-R2-07 | `templates/CLAUDE.md.tmpl:23` + siblings | Now hedged with "(or your repo's verify script)", but the primary instruction is still `node install.mjs verify . --strict`, which fails in every target repo. |
| AUD-R2-11 | `lib/audit.mjs:104-116` | Root cause of this audit's P0 finding #1 recurring on every merge. Priority raised by evidence. |
| AUD-R2-13 | `lib/installer.mjs:205-207` | `ai/START-HERE.html` still can never be shell-upgraded. |
| AUD-R2-14 | `lib/intake.mjs:74`, `lib/maturity.mjs:67`, `lib/orient.mjs:45` | Worktrees/submodules still misreport "not a git repository". |
| AUD-R2-16 | `lib/doctor.mjs:24-30` | Bare `orient` still yields "kit is installed". |
| AUD-R2-17 | `lib/doctor.mjs:28,53,76` | Suggested commands still double-quote paths (POSIX `$`/backtick expansion) and assume the kit-checkout cwd. |
| AUD-R2-19 | `test/release-check.mjs:218` | `shell: true` still applied to both `--full` gates on Windows, including the node invocation with joinable unquoted paths. |
| AUD-R2-24 | `lib/demo.mjs:56` | `rm -rf` hint still POSIX-only. |
| AUD-R2-25 | `lib/verify.mjs:93-117` | `ai/INDEX.md` still not a verify source — and PR #23 grew its role table (WORKLOG, reviews/), increasing unchecked claims. |
| AUD-R2-27 | `lib/indepth.mjs:700-706` | `topContributors[].email` still holds names. |
| AUD-R2-03 follow-up | `test/release-check.mjs`, CI | Still no CHECKSUMS-match gate (checksums currently pass; nothing prevents the next rot). |

## Summary

- 1 P0 (live red CI on main), 3 P1 (all reproduced), 3 P2, 4 P3 — all new IDs
  AUD-R3-01..11 in the traceability register.
- Gates run this audit: `verify --strict` ✅ (178/178 claims) ·
  `drift --git --strict` ❌ (8 stale — finding #1) · `sha256sum -c
  CHECKSUMS.txt` ✅ (82/82).
