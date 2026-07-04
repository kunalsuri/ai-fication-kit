<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# REVIEW: W-002 — Audit R3 fixes, AUD-R3-02..11 + AUD-R2-11 `[inferred]`
> **Date:** 2026-07-04 · **Spec:** specs/BUGFIX_audit-R3-fixes.md · **Ledger row:** W-002
> **Reviewer:** agent, fresh session (not the implementing session)
> **Verdict:** approve

## Scope reviewed
Commits `206e24e` ("Fix audit R3 defects AUD-R3-02..11 and close AUD-R2-11
(fail-first tests)") and `2b5d0b6` ("Address REVIEW_W-002 finding 1: anchor rewrite
consumes multi-line notes") on branch `claude/deep-codebase-audit-zmd328`, parent
`86a69f8` (the R3 audit report). The first review pass covered `206e24e` alone and
returned request-changes on finding 1 (major); the implementer's `2b5d0b6` addresses
exactly that finding and was independently re-verified by this reviewer — see
finding 1's Resolution. Files: `.github/workflows/test.yml`, `CHECKSUMS.txt`,
`ai/lab/WORKLOG.md`, `ai/lab/specs/BUGFIX_audit-R3-fixes.md` (new), `install.mjs`,
`lib/audit.mjs`, `lib/indepth.mjs`, `lib/installer.mjs`,
`templates/ai/lab/WORKLOG.md.tmpl`, `test/run-tests.mjs`. Authorizing spec:
`ai/lab/specs/BUGFIX_audit-R3-fixes.md` (Status: approved; batch approval quoted).
Findings prescription: `ai/analysis/audit-reports/ADVERSARIAL_AUDIT_2026-07-04_R3.md`.
AUD-R3-01's re-anchor is deliberately deferred to a follow-up records commit per the
spec's touch list — its absence here is expected, not a finding.

## Checks — evidence, not assertions
| Check | Result | Evidence |
|---|---|---|
| Spec conformance — every acceptance criterion met | ✅ (with deferrals noted) | (1) Fail-first: re-verified independently in a worktree of parent `86a69f8` — pre-fix `classifyAction({edited stamped doc + template [verified] prose, force:true})` returns `"locked"` (new test demands `"overwrite"`), and `lib/audit.mjs` had no `updateAnchorLine` export; the E2E cases (abort-backup, orient humanContext, gitignore prefix) were live-reproduced pre-fix in the R3 report §§2–4, 6. (2) `node test/run-tests.mjs` → **361/361, exit 0** at `206e24e`, re-run at `2b5d0b6` → **362/362, exit 0**; `node install.mjs verify . --strict` → **178/178 confirmed, exit 0** (run at both commits); `drift . --git --strict` → **red, 9 stale** — expected until the deferred re-anchor commit (spec wording: "green **after** the re-anchor commit"). (3) The four live repros are now encoded as passing E2E tests. |
| Surgical diff — every hunk traces to the spec | ✅ | Hunk→finding map: test.yml→R3-07; installer.mjs `classifyAction`→R3-02; installer.mjs backup deferral + plan-message wording→R3-03; install.mjs orient carry-forward→R3-04; install.mjs header carve-out→R3-05; install.mjs status header→R3-10; indepth.mjs gitignore→R3-06; indepth.mjs Cargo/Gemfile→R3-09; indepth.mjs `runCmd` argv + call sites→R3-11; audit.mjs→AUD-R2-11; WORKLOG.md + .tmpl→R3-08; CHECKSUMS.txt + spec file→spec touch list; test/run-tests.mjs→regression tests. `2b5d0b6`'s three hunks (audit.mjs `updateAnchorLine`, one regression test, CHECKSUMS regen) all trace to this review's finding 1. No drive-bys found in either commit. |
| Stability respected — no `frozen`/`?` files touched without recorded approval | ✅ | `ai/guide/MODULE_MAP.md` rows checked: `/` (root), `lib/`, `templates/`, `templates/ai/`, `test/` — all `ours` `[verified]`. `.github/workflows/test.yml` is unmapped config, called out as such in the spec's touch list. No `frozen`/`?` row touched. |
| Tests — new behavior covered; suites green | ✅ | 24 new checks in the "audit R3 regressions" block (3 unit classifyAction, 3 E2E --force, 2 E2E abort, 1 orient, 1 gitignore, 2 dep-category, 2 updateAnchorLine + fixture setup checks), plus `2b5d0b6`'s multi-line-anchor regression built from this review's reproduction shape. Full suite `node test/run-tests.mjs`: 362/362, exit 0 (run by this reviewer at `2b5d0b6`, 2026-07-04; 361/361 at `206e24e`). |
| Conventions & license headers match neighbors | ✅ | New file `ai/lab/specs/BUGFIX_audit-R3-fixes.md` carries the standard copyright comment; all modified `.mjs`/`.md` files retain theirs; `test.yml` has no header, matching the pre-existing workflow file convention. `CHECKSUMS.txt` regenerated and consistent with the shipped sources (test suite's checksum checks pass). |
| Knowledge updated — maps/catalog amended, tagged `[inferred]` | ⚠️ partial | WORKLOG W-001 backfilled + template example row fixed (R3-08), spec doc added `[inferred]`. But the spec's completion checkboxes claim "[x] WORKLOG.md row appended (type bugfix)" and "[x] DEFECT_TRACEABILITY.md rows … flipped" — neither is in this commit or the working tree (register rows AUD-R3-01..11/AUD-R2-11 still read OPEN). See finding 2. |
| Provenance clean — no `[verified]` written by an agent | ✅ | `git show 206e24e \| grep '^+' \| grep -i verified` (and the same over `2b5d0b6`): every added `[verified]` occurrence is comment prose, spec prose, or a test string built from `VERIFIED_TAG`; `2b5d0b6` adds none. No map/ledger row tag flipped; the backfilled W-001 row and the new spec stay `[inferred]`. |

## Findings
| # | Severity | File | Finding | Resolution |
|---|---|---|---|---|
| 1 | major | `lib/audit.mjs` (`updateAnchorLine`, lines 118–130) | The anchor rewrite only handles a single-line anchor, but this repo's own `ai/guide/MODULE_MAP.md` anchor is a five-line blockquote parenthetical (lines 7–11). Reproduced by this reviewer: `updateAnchorLine(<real map text>, "2026-07-04", "deadbee")` replaces line 7 and orphans lines 8–11 — four dangling continuation lines with an unmatched `)` and now-false prose ("…re-anchor accompanies that PR…" about PR #22) attached to the new anchor. `drift --git` still parses the new sha, but the human who confirms the offer in `audit --git` gets the kit's highest-trust document silently corrupted — in exactly the repo (this one) whose recurring re-anchor problem (AUD-R3-01/AUD-R2-11) motivated the feature. **Fixed in `2b5d0b6`, re-verified by this reviewer:** `updateAnchorLine` now counts net parenthetical depth on the anchor line and consumes blockquote continuation lines until it balances, splicing the whole note down to the single new anchor line. Re-verification evidence: (a) run against the repo's real `ai/guide/MODULE_MAP.md` — clean single-line anchor, exactly 4 lines consumed, no "re-anchor accompanies" / dangling `)` remnants, and the following `> Status:` blockquote left intact; (b) single-line and balanced-paren anchors still replaced 1:1 (next line not eaten); (c) the new regression test ("updateAnchorLine consumes a multi-line parenthetical anchor note whole") uses this review's reproduction shape; suite 362/362. Residual accepted risk: an unbalanced `(` whose continuation is not blockquote-formatted degrades to the old single-line behavior — acceptable, since only blockquote continuations exist in the template and this repo. |
| 2 | minor | `ai/lab/specs/BUGFIX_audit-R3-fixes.md` | "Knowledge update on completion" checkboxes assert the WORKLOG bugfix row and the DEFECT_TRACEABILITY flips are done (`[x]`), but at this commit `ai/analysis/audit-reports/DEFECT_TRACEABILITY.md` rows AUD-R3-01..11 and AUD-R2-11 are still OPEN and no bugfix WORKLOG row exists. The committed spec makes claims the tree does not yet satisfy. | Accepted: records commit pending — per the coordinator it immediately follows this re-verdict and must carry the WORKLOG W-002 row, the DEFECT_TRACEABILITY flips, and the R3-01 re-anchor; otherwise amend the checkboxes to unchecked. |
| 3 | minor | `lib/installer.mjs` (`classifyAction`, lines 111–117) | The verbatim line-set diff leaves two residual false-lock cases: (a) a file edited with a CRLF-converting editor — every line gains `\r`, so the template's own `[verified]` prose lines no longer match `templateLines` and the file locks again; (b) template evolution — if a future kit version rewords a `[verified]`-prose line, files stamped from the old template and edited elsewhere lock under `--force`. Both fail in the conservative direction (false lock, never a false overwrite), match the R3 report's own fix prescription, and are no worse than pre-fix behavior. | Accepted as conservative; suggest normalizing `\r` in both splits as a cheap hardening. Noted for the human below. |
| 4 | nit | `lib/installer.mjs` line 164 | The Process-2 plan message now reads "Will back up …" even under `--dry-run` (pre-fix printed "Would back up" there). Nothing is written — the dry-run exit at line 263 precedes the copy loop, which this reviewer traced — but the tense slightly overstates during a dry run. | Ship with note. |
| 5 | nit | `lib/indepth.mjs` (Gemfile parser, lines 311–322) | The `group :development/:test` heuristic treats any bare `end` as closing the group, so a nested `do…end` inside a dev group flips subsequent dev gems back to production; inline `gem 'x', group: :development` is not recognized. The comment discloses the heuristic; the R3 fix prescription asked exactly for this level. | Ship with note. |

## What the human should double-check
1. **The anchor-move policy itself** (spec Fix-sketch #2, now that finding 1 is
   fixed): the guided `audit --git` may rewrite — after explicit confirmation — the
   anchor line *and* its multi-line note, replacing human-written re-anchor prose
   with a bare `Last verified: <date> @ commit <sha>`. The mechanics are correct
   (verified); whether losing the explanatory note is acceptable is a policy call
   only the human can make (the pre-write MODULE_MAP backup preserves it).
2. **The R3-02 policy judgement call** (spec Fix-sketch #1): defining a "human-added
   signature" as any `[verified]` line absent verbatim from the freshly stamped
   template. Direction is conservative, but it is a security-relevant boundary of
   the child-lock — confirm you accept verbatim-line matching (and whether CRLF
   normalization from finding 3 should ride along).
3. **The follow-up records commit is now load-bearing.** It must carry: the
   MODULE_MAP re-anchor to `2b5d0b6` or later (`drift . --git --strict` currently
   reports **9** stale rows — one more than the audit's 8, since the fix commits
   themselves touched mapped areas), the WORKLOG W-002 row linking spec + this
   review, and the DEFECT_TRACEABILITY flips the spec already claims. Merging
   without it leaves CI red and the spec's completion claims false.
4. **The W-001 waiver.** The backfilled row records a self-declared review waiver
   ("this work shipped the review process itself"). Reasonable, but accepting a
   waiver written by the same agent that did the work is a judgement only the human
   can make.

## Addendum — W-002 knowledge update (commit 8ca033a)

**Reviewer:** agent, fresh session · **Date:** 2026-07-04

**Scope.** Commit `8ca033a` on branch `claude/deep-codebase-audit-zmd328` — the
knowledge-update step of W-002. It adds/updates "Gotchas" lines in
`ai/guide/FEATURE_MAP.md` for the features touched by the R3 bug fixes (`orient`,
`indepth`, `install`, `audit`) and corrects a stale `ci-checks` gotcha; it also
bumps the confirmed count in `VERIFICATION_REPORT.md` (184 → 186) and checks a box
in `BUGFIX_audit-R3-fixes.md`. Only the truth of each new gotcha claim against the
current implementation was in scope. No non-doc code is touched by the commit.

**Evidence table** (one row per gotcha claim checked):

| Gotcha claim | Result | Evidence |
|---|---|---|
| orient — re-runs carry `humanContext` forward | ✅ | `install.mjs:233-242`: after real orient, reads prior profile and copies `humanContext` onto the fresh profile when the new one lacks it, before writing. |
| indepth — `.gitignore` dir rule needs the slash; `build/` no longer over-matches `builder/` | ✅ | `lib/indepth.mjs:40-59`; regex reproduced live: `/(^\|\/)build(\/.*)?$/` → matches `build/main.js` & `build`, rejects `builder/main.js`, `builder`, `src/builder/x`. |
| indepth — Cargo `[dev-dependencies]` booked as development | ✅ | `lib/indepth.mjs:287,293`: `[dev-dependencies]` sets section `dev` → `byCategory.development++`. |
| indepth — Gemfile `group :development`/`:test` booked as development | ✅ | `lib/indepth.mjs:316-321`: `inDevGroup` set by `/:(development\|test)\b/`, dev gems increment `development`. |
| indepth — `runCmd` takes an argv array (no shell/word-split) | ✅ | `lib/indepth.mjs:13-24`: `runCmd(argv,cwd)` destructures `[bin,...args]` into `execFile` (no shell). All git callers pass arrays. |
| indepth — `topContributors[].email` actually holds names (open item) | ✅ | `lib/indepth.mjs:703-718`: pushes `email: parts[1]` from `git shortlog -sn` output (counts + names). Correctly flagged as open AUD-R2-27. |
| install — child-lock keys on human-added `[verified]` lines, CRLF-stripped | ✅ | `lib/installer.mjs:111-121`: `humanVerified` = disk `[verified]` line NOT in `templateLines`, both compared via `stripCR`. Template prose therefore never locks. |
| install — Process-2 backups copied only in write phase, after the confirm prompt; `--dry-run` reads "Would back up" | ✅ | Decided up front `:162-169` (`flags.dryRun ? "Would" : "Will"` at `:168`); copied at `:288` after `confirm` at `:280`; dry-run returns at `:267` and both abort paths (`:276`,`:281`) precede the copy loop. |
| audit — offers to move anchor to HEAD only under `--git`, human confirms, via exported `updateAnchorLine`; reminder otherwise | ✅ | `lib/audit.mjs:210-225`: `if (flags.git)` → `confirm(...)` → `updateAnchorLine`; `else` prints the reminder. `updateAnchorLine` exported at `:123`. |
| audit — `updateAnchorLine` consumes a multi-line parenthetical note whole | ✅ | `lib/audit.mjs:131-138`: net paren-depth walk over blockquote continuation lines, single `splice` of the whole span. (Matches finding 1's fix.) |
| ci-checks — corrected: template uses `npm install -g github:kunalsuri/ai-fication-kit`, not npm-registry form | ✅ | `templates/github/workflows/ai-check.yml.tmpl:26`: `run: npm install -g github:kunalsuri/ai-fication-kit`. |

**Verify.** `node install.mjs verify . --strict` → **186 confirmed, 0 moved, 0
missing** (12 docs). Every backticked path introduced by the new gotchas resolves;
no claim broke the strict verify. This matches the commit's own `186/186` note and
the `VERIFICATION_REPORT.md` bump.

**Findings.** None. All eleven gotcha claims are accurate against the current code.
Nit (not a finding, no change requested): finding 4 of the main review flagged a
pre-fix "Will back up" tense under `--dry-run`; the current tree emits "Would back
up" there (`installer.mjs:168`), and the new `install` gotcha correctly documents
that wording — so the addendum's claim and the code now agree.

**Verdict: approve.** The gotchas are true, surgical, provenance-clean (all remain
`[inferred]`), and materially useful to the next agent. Confidently-wrong gotcha
risk: none observed.
