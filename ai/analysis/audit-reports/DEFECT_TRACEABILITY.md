<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Defect traceability register `[inferred]`

One row per defect found by an audit: what was wrong, why it was wrong, what was
done about it, and exactly where/when — so any future reader (human or agent) can
trace a fix back to its evidence and forward to its commit.

**Maintenance rules (append-only):**

1. Every defect gets a stable ID (`AUD-<audit>-<nn>`). Reference IDs in commit
   messages and PRs ("fixes AUD-R2-09").
2. Never delete or rewrite a row's history. The only permitted edits to an
   existing row are: `Status` (OPEN → FIXED / WONTFIX), and filling `Fixed in`
   + `Date` when it closes.
3. New audits append a new section with their own ID prefix.
4. `Trace` points at the audit report section holding the verbatim evidence and
   repro for that row.

**Legend** — Status: `FIXED` (verified against a re-run repro) · `OPEN` (deferred,
needs maintainer decision) · Sev: per the audit's user-impact rubric.

---

## Audit R2 — 2026-07-03

- Evidence & repros: [`ADVERSARIAL_AUDIT_2026-07-03_R2.md`](ADVERSARIAL_AUDIT_2026-07-03_R2.md) (commit `42031ea`)
- Prior audit (PR #21, all findings were still unfixed at R2 time): [`ADVERSARIAL_AUDIT_2026-07-03.md`](ADVERSARIAL_AUDIT_2026-07-03.md)
- Fix commit: `c8a0fd7` (2026-07-03, PR #22) · Baseline re-anchor: `c48c480`

| ID | Sev | Status | Location (at audit time) | Defect (the error) | Root cause | Fix made | Fixed in / date | Trace |
|---|---|---|---|---|---|---|---|---|
| AUD-R2-01 | CRITICAL | FIXED | `lib/installer.mjs:200-205`, `install.mjs:283` | Re-running bare `install` overwrote a human-edited, `[verified]`-tagged CLAUDE.md/AGENTS.md **without `--force`** (reproduced: audit content lost) | Process-2 decision trusted the profile's pre-install snapshot (`existingAIConfig.*.hasKitFooter=false` forever); the resulting `"overwrite-backed-up"` action bypassed `classifyAction`, so the child-lock never ran | Backup decision now made from the file **on disk** (kit footer test + `[verified]` tag test); `[verified]` files always route through `classifyAction` | `c8a0fd7` / 2026-07-03 | R2 §1 · R1 #1 |
| AUD-R2-02 | CRITICAL | FIXED | `lib/util.mjs:25-31`, `lib/installer.mjs:153,273`, `lib/audit.mjs:193` | Two backups in the same clock second silently destroyed each other (reproduced: user content gone from every file on disk) | Backup names unique only per second; every writer used plain `copyFile`/`writeFile`, which overwrites an existing file without checking | New `reserveBackupPath()` probes disk and appends `_2`, `_3`… on collision; installer copies use `COPYFILE_EXCL` so a race fails loudly instead of destroying a backup | `c8a0fd7` / 2026-07-03 | R2 §2 · R1 #2 |
| AUD-R2-03 | HIGH | FIXED | `CHECKSUMS.txt` | `sha256sum -c` failed on 9 files — the tamper-detection manifest itself read as "tampered" on a pristine clone | Checksums regenerated only at release time (`docs/RELEASE-CHECKLIST.md`); post-v0.2.0 commits changed `lib/`/`install.mjs`/templates with no gate forcing a regen | Regenerated (82 files, all match). *Follow-up still open: add a CHECKSUMS-match gate to release-check/CI so it cannot rot again* | `c8a0fd7` / 2026-07-03 | R2 §3 (new) |
| AUD-R2-04 | HIGH | FIXED | `lib/status.mjs:57-64` | `status` printed **TRUSTED** (green badge) on a never-cold-started repo while `doctor` said "map is still the scaffolded template" (reproduced) | Verdict only demoted on `inferred>0`/`unknown>0`; a scaffolded map parses to zero rows, so every guard passed vacuously | Zero parsed rows now yields **NEEDS AUDIT** | `c8a0fd7` / 2026-07-03 | R2 §4 · R1 #4 |
| AUD-R2-05 | HIGH | FIXED | `lib/indepth.mjs:488` | `indepth`/`shazam` crashed with `SyntaxError: Invalid regular expression` on repos with a `c++/` (or `a+b/`, `foo(bar)/`) directory (reproduced) | Directory name interpolated into `new RegExp()` without escaping regex metacharacters | Names regex-escaped; patterns precompiled once per module instead of per line | `c8a0fd7` / 2026-07-03 | R2 §5 · R1 #3 |
| AUD-R2-06 | HIGH | FIXED | `templates/github/workflows/ai-check.yml.tmpl:23` | Stamped CI ran `npm install -g ai-fication-kit` — package not on npm (E404 re-confirmed) → permanently red CI in every target repo | Workflow written assuming an npm publish that never happened; nothing validated the assumption | Installs from `github:kunalsuri/ai-fication-kit` (same source as the docs' npx one-liner), with a comment to pin a tag once releases are tagged | `c8a0fd7` / 2026-07-03 | R2 §6 · R1 #5 |
| AUD-R2-07 | HIGH | OPEN | `templates/CLAUDE.md.tmpl:23` + 13 sibling templates | Stamped agent docs order agents to run `node install.mjs …` inside target repos where that file does not exist | Instructions written from the kit repo's perspective and copied into templates; `verify` cannot flag the claim (contains spaces → skipped by `extractClaims`) | Deferred — needs a `{{KIT_INVOCATION}}` (or npx) design decision from the maintainer | — | R2 §7 · R1 #6 |
| AUD-R2-08 | MEDIUM | FIXED | `lib/doctor.mjs:72` | Doctor's prescribed fix command silently laundered stale drift findings: re-running drift **without** `--git` writes `stale: 0`, flipping doctor to "nothing wrong" with rows never re-audited | Step-4 action string omitted `--git` unconditionally; drift's stale set is only computed under `--git` | `--git` is preserved in the suggested command whenever the failing manifest came from a `--git` run | `c8a0fd7` / 2026-07-03 | R2 §8 (new) |
| AUD-R2-09 | MEDIUM | FIXED | `lib/verify.mjs:15-17,64-65` | Truthful claims into `bin/`, `out/`, `target/`, `obj/` reported **missing** → `--strict` CI red on correct docs (reproduced with `bin/cli.js`) | File index prunes build-output directory names globally, with no fallback for repos where those are real source dirs | Direct `isFile`/`isDir` disk probe before declaring a path claim missing | `c8a0fd7` / 2026-07-03 | R2 §9 (new) |
| AUD-R2-10 | MEDIUM | FIXED | `lib/indepth.mjs:48-50` | Rooted `.gitignore` patterns (`/dist`) never matched → ignored/generated trees silently counted in LOC, module and architecture stats | Metacharacter escaping ran before the leading-`/` handling; `slice(1)` removed the escape backslash instead of the slash, leaving an anchor no rel-path can match | `slice(2)` drops the full escaped `\/` so the anchor matches repo-relative paths | `c8a0fd7` / 2026-07-03 | R2 §10 (new) |
| AUD-R2-11 | MEDIUM | OPEN | `lib/audit.mjs:104-116` | Completing a guided audit never updates the `Last verified: … @ commit` anchor → `drift --git` immediately flags freshly audited rows as stale | `applyEdits` rewrites table rows only; anchor maintenance was never implemented | Deferred — interacts with the human-signature policy (who may move the anchor) | — | R2 §11 · R1 #7 |
| AUD-R2-12 | MEDIUM | FIXED | `lib/status.mjs:24` vs `docs/AUDIT-GUIDE.md:57` | Hand audits following the docs' ISO date format showed "Last audit: unknown" forever; the 90-day staleness gate could never fire | Parser written for the `audit` command's `DD/MM/YYYY` stamp; docs teach `YYYY-MM-DD`; the two were never reconciled | `newestAuditDate` accepts both formats | `c8a0fd7` / 2026-07-03 | R2 §12 · R1 #8 |
| AUD-R2-13 | MEDIUM | OPEN | `lib/installer.mjs:200-201,296` | `ai/START-HERE.html` can never be upgraded by a re-install (even `--force-verified`), and its manifest hash records the template, never what's on disk | Unconditional `"up-to-date"` short-circuit for the progress page; hash taken from the template content | Deferred — fix is to compare disk-vs-template with the `progress-data` block stripped, then re-inject live data | — | R2 §13 · R1 #11 |
| AUD-R2-14 | MEDIUM | OPEN | `lib/intake.mjs:74`, `lib/maturity.mjs:67-68`, `lib/orient.mjs:45` | Git worktrees/submodules (`.git` is a *file*) misreport "not a git repository" in the wizard, maturity score, and fork detection — while `drift --git` works on the same tree | All three read `.git` as a directory; the `gitdir:` indirection file was never handled | Deferred — parse the `gitdir:` line and resolve `HEAD`/`config` there (still pure file inspection) | — | R2 §14 (new) |
| AUD-R2-15 | MEDIUM | FIXED | `install.mjs:43-46`, `docs/CLI-REFERENCE.md:18-20` | Trust headers stale twice over: "Two exceptions run git" (audit `--git` is a third) and "does NOT write outside the target" (demo → tmpdir; `--github-summary` → step-summary file) | Guarantee prose not updated when the `audit`, `demo`, and `--github-summary` features landed; no check ties prose to behavior | Both documents corrected: three git exceptions named; both write carve-outs documented | `c8a0fd7` / 2026-07-03 | R2 §15 · R1 #10 |
| AUD-R2-16 | LOW | OPEN | `lib/doctor.mjs:39-41` | "The kit is installed" diagnosis after bare `orient`; prescribes `/cold-start` before the command exists in the repo | Step 1 keys on `ai/repo-profile.json`, which orient writes without installing | Deferred — check `ai/install-manifest.json` and prescribe install/shazam | — | R2 §16 · R1 #9 |
| AUD-R2-17 | LOW | OPEN | `lib/doctor.mjs:28,53,72` | Suggested commands wrap the absolute path in double quotes (`$`, backtick, `"` expand in POSIX shells); assumes cwd is the kit checkout | String interpolation chosen without shell-quoting rules; invocation form hardcoded | Deferred — single-quote with escaping; derive invocation from `process.argv` | — | R2 §17 · R1 #14 |
| AUD-R2-18 | LOW | FIXED | `test/release-check.mjs:148,154` | Raw TypeError when git is not installed, despite the "Skipped (stated, never silent)" contract | `spawnSync` on ENOENT returns `stdout: null`; `.trim()` called unguarded | `(… .stdout \|\| "").trim()` at both sites | `c8a0fd7` / 2026-07-03 | R2 §18 · R1 #12 |
| AUD-R2-19 | LOW | OPEN | `test/release-check.mjs:219` | `shell: true` on Windows with an args array — unquoted join breaks the `--full` gate under paths with spaces | Same class as the fixed `e28482e` incident, one call site over; never exercised on Windows with spaces | Deferred — `shell` only for npm; quote args where a shell is required | — | R2 §19 · R1 #13 |
| AUD-R2-20 | LOW | FIXED | `test/run-deep-test.mjs:89` | The drift "retry without --git" fallback was dead code (matched `"SKIPPED"`, drift emits lowercase and exits 0) — and if it ever fired it would discard stale findings | Retry written against assumed output, never validated against drift's real text or exit codes | Branch removed; drift's own stated-note behavior covers the git-missing case | `c8a0fd7` / 2026-07-03 | R2 §20 · R1 #15 |
| AUD-R2-21 | LOW | FIXED | `lib/progress.mjs:44` | A target path containing `</script>` could break out of the progress page's JSON data block into the DOM | `JSON.stringify` output embedded in HTML without `<` escaping | `<`-escape the serialized JSON | `c8a0fd7` / 2026-07-03 | R2 §21 · R1 #16 |
| AUD-R2-22 | LOW | FIXED | `install.mjs:284` | Corrupt `ai/repo-profile.json` crashed bare `install` with a raw stack trace | `JSON.parse` unguarded (sibling `indepth` path already guarded) | try/catch → fall back to a fresh `orient()` | `c8a0fd7` / 2026-07-03 | R2 §22 · R1 #17 |
| AUD-R2-23 | LOW | FIXED | `lib/installer.mjs:301` | Manifest always recorded `ai/repo-indepth.json` as installed, even when indepth never ran — `uninstall` listed a file that was never written | File added unconditionally to the manifest's `files` list | Recorded only when the file exists on disk | `c8a0fd7` / 2026-07-03 | R2 §23 · R1 #18 |
| AUD-R2-24 | LOW | OPEN | `lib/demo.mjs:56` | Cleanup hint `rm -rf "<tmpdir>"` invalid on Windows | Single POSIX-flavored suggestion for all platforms | Deferred — branch on `process.platform` | — | R2 §24 · R1 #19 |
| AUD-R2-25 | LOW | OPEN | `lib/verify.mjs:81-99` | `ai/INDEX.md` (the densest path-claim doc) never scanned by `verify` — moved paths keep `--strict` green while navigation lies | Sources list enumerates entry files, guide, and catalogs only; INDEX was never added | Deferred — add `ai/INDEX.md` to the sources list | — | R2 §25 · R1 #20 |
| AUD-R2-26 | LOW | FIXED | `lib/installer.mjs:152-156` | `--dry-run` printed "ℹ Backed up X → Y" although nothing was written, then "nothing written" — contradictory transcript | Info line sat outside the `!flags.dryRun` guard | Prints "Would back up …" under `--dry-run` | `c8a0fd7` / 2026-07-03 | R2 §26 (new) |
| AUD-R2-27 | LOW | OPEN | `lib/indepth.mjs:694` | `topContributors[].email` actually holds contributor *names* (`git shortlog -sn` output) | Field named for intended data, not the data the command produces | Deferred — rename to `name` or switch to `shortlog -sne` and parse the email | — | R2 §27 (new) |
| AUD-R2-28 | MEDIUM | FIXED | `lib/verify.mjs` (introduced by the AUD-R2-09 fix in `c8a0fd7`) | The new disk probe could stat outside the target repo: a doc claim like `a/../../secret` (traversal past a leading-`..` check) escaped `targetAbs`, breaching the "scan the repo tree only" guarantee | The guard only rejected a *leading* `..`; `path.join` still resolved interior `..` segments outside the target | `probeInsideTarget()`: `path.resolve` then containment check via `path.relative` (rejects `..`-prefixed and absolute results) — same rule as uninstall's path check | `4bbf46c` / 2026-07-03 | PR #22 Copilot review |

### R2 summary

- **16 FIXED** in `c8a0fd7` (2026-07-03, PR #22) — every fixed row's original live
  repro was re-run against the fix; 332/332 tests pass.
- **11 OPEN** — deferred items needing a maintainer decision or a larger change;
  each row says what the fix should be.
- Audit R1 (PR #21) is fully subsumed: every R1 finding maps to an R2 row (see
  the Trace column); R1 items without an R2 fix are the OPEN rows above.

---

## Audit R3 — 2026-07-04

- Evidence & repros: [`ADVERSARIAL_AUDIT_2026-07-04_R3.md`](ADVERSARIAL_AUDIT_2026-07-04_R3.md)
- Re-verification: all 16 R2 FIXED rows re-checked, none regressed; all 11 R2
  OPEN rows re-verified still present (R3 report §12). Findings below are new.

| ID | Sev | Status | Location (at audit time) | Defect (the error) | Root cause | Fix made | Fixed in / date | Trace |
|---|---|---|---|---|---|---|---|---|
| AUD-R3-01 | CRITICAL | OPEN | `.github/workflows/ai-check.yml:27`, `ai/guide/MODULE_MAP.md:7` | `drift . --git --strict` fails on main (8 stale `[verified]` rows) — the repo's own CI gate is red on every push/PR, and `npm run deep-test` fails at step 3 (reproduced 2026-07-04) | PR #23 merged without the re-anchor/re-audit step every prior PR performed; nothing enforces it (see AUD-R2-11) | — (needs a human re-audit + re-anchor; then automate anchor maintenance) | — | R3 §1 |
| AUD-R3-02 | HIGH | OPEN | `lib/installer.mjs:111` + core templates | `--force` child-lock false-positives on the templates' own `[verified]` prose: any edit to a stamped CLAUDE.md/AGENTS.md/MODULE_MAP.md/WORKLOG.md classifies `locked` (reproduced) — the documented `--force` contract is unreachable for exactly those files | Lock tests `diskText.includes("[verified]")`; pristine templates contain that literal in provenance prose | — (classify via the `humanAdded` diff already computed at `installer.mjs:225-228`) | — | R3 §2 |
| AUD-R3-03 | HIGH | OPEN | `lib/installer.mjs:150-164` vs `:262-275` | Process-2 backups written before any consent; declining the confirm still leaves `CLAUDE_bkp_*.md` behind while printing "Aborted; nothing written." (reproduced) | Backup copy runs at the top of `install()`, before plan display and both confirmations | — (defer the copy to the write phase) | — | R3 §3 |
| AUD-R3-04 | HIGH | OPEN | `install.mjs:228-232` | Re-running `orient` wipes `humanContext` (wizard answers) from `ai/repo-profile.json` (reproduced) | Fresh profile written with no carry-forward; only the install path has one (`installer.mjs:289-295`) | — (copy `humanContext` forward, same as installer) | — | R3 §4 |
| AUD-R3-05 | MEDIUM | OPEN | `install.mjs:50-56` | Trust header "It NEVER overwrites a file you have edited" is false for Process 2 (user-authored CLAUDE.md/AGENTS.md replaced after backup on plain install, no `--force`) | Guarantee prose never updated when Process 2 landed; same class as fixed AUD-R2-15 | — (add the Process-2 carve-out sentence) | — | R3 §5 |
| AUD-R3-06 | MEDIUM | OPEN | `lib/indepth.mjs:42-44` | Gitignore dir rules over-match prefix siblings: `build/` also excludes `builder/` from all indepth metrics (reproduced) | `pattern += "?.*"` makes the trailing slash optional | — (require the slash before descendants) | — | R3 §6 |
| AUD-R3-07 | MEDIUM | OPEN | `.github/workflows/test.yml:24` | Syntax gate omits `lib/audit.mjs`, `lib/status.mjs`, `lib/doctor.mjs`, `lib/demo.mjs`, `lib/progress.mjs`, `test/run-deep-test.mjs`, `test/release-check.mjs` | Hardcoded list never updated as modules were added | — (glob the list) | — | R3 §7 |
| AUD-R3-08 | LOW | OPEN | `ai/lab/WORKLOG.md:36`, `templates/ai/lab/WORKLOG.md.tmpl:31` | First ledger row violates the loop it documents: merged with Review `—`, Status stuck `in-review`, Commits cell "(this branch)" unresolvable; template example row reuses ID `W-001` | Row written pre-merge and never updated; example ID collides with the "next W-n" rule | — (backfill row; use `W-000` in the example) | — | R3 §8 |
| AUD-R3-09 | LOW | OPEN | `lib/indepth.mjs:278-291,302-310` | Cargo `[dev-dependencies]` and all Gemfile gems booked as production | Section/group tracking not implemented for those parsers | — | — | R3 §9 |
| AUD-R3-10 | LOW | OPEN | `install.mjs:30-31` | Header says `status` writes only with `--json`; it also rewrites `ai/START-HERE.html` whenever the page exists (`status.mjs:119`) | Header not updated when the progress-page refresh landed | — | — | R3 §10 |
| AUD-R3-11 | LOW | OPEN | `lib/indepth.mjs:10-14` | `runCmd` comment invites space-containing format strings that `cmd.split(" ")` would break; quotes stripped from every token | Convenience comment overstates the parser | — (argv-array signature like `drift.mjs:160`) | — | R3 §11 |

### R3 summary

- **0 FIXED / 11 OPEN** — this audit reports; fixes are a separate unit of work.
- AUD-R3-01 is live: main's ai-check workflow fails until a human re-audits
  the 8 stale rows and re-anchors the baseline. AUD-R2-11 is its recurring
  root cause and should be prioritized accordingly.
