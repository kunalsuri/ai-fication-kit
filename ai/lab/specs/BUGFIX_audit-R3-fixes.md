<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# BUGFIX: Audit R3 fixes — AUD-R3-01..11 (+ AUD-R2-11) `[inferred]`
> **Status:** approved
> **Author:** Claude (agent) · **Date:** 2026-07-04 · **Issue:** `ai/analysis/audit-reports/ADVERSARIAL_AUDIT_2026-07-04_R3.md`

## Symptom
Eleven defects filed by audit R3 (see the report for full evidence; four were
reproduced live). Headlines —
**Observed:** main's own `ai-check` CI gate is red (`drift --git --strict` → 8
stale rows); `--force` cannot refresh any edited core doc because the templates'
own `[verified]` prose triggers the child-lock; Process-2 backups are written
before the user consents ("Aborted; nothing written" is false); `orient` re-runs
wipe `humanContext`; `.gitignore` dir rules over-match prefix siblings in
`indepth`; the CI syntax gate misses 7 files; Cargo/Gemfile dev deps booked as
production; two stale trust-header claims; a misleading `runCmd` comment; the
first WORKLOG row violates the loop's own rules.
**Expected:** each behavior as documented by the command's own contract prose
and `docs/CLI-REFERENCE.md`.

## Reproduction — no fix before this exists and fails
Live repros recorded in the R3 report §§1–4, 6 (commands + observed output).
- Failing tests: `test/run-tests.mjs` — new regression blocks
  "audit R3 regressions" (classifyAction template-prose case, `--force`
  overwrite of an edited stamped CLAUDE.md, aborted install leaves no backup,
  orient preserves humanContext, gitignore prefix over-match, dep categories,
  `updateAnchorLine`). Watched fail before the fix (run log in the review doc).
- AUD-R3-01/05/07/08/10/11 are CI-config/docs/comment/ledger fixes with no
  unit-testable runtime surface; R3-01's fix is exercised by
  `drift . --git --strict` returning green after re-anchor.

## Root cause
Per finding — see R3 report. The common thread: invariants written once and
never re-validated when a neighboring feature landed (the audit's class 1/4/6).

## Touch list (from MODULE_MAP / FEATURE_MAP gotchas)
| Location | Stability | Change |
|---|---|---|
| `lib/installer.mjs` | ours | R3-02 classifyAction template-prose-aware lock; R3-03 defer Process-2 backup copies to the write phase |
| `install.mjs` | ours | R3-04 orient carries humanContext forward; R3-05/R3-10 header corrections |
| `lib/indepth.mjs` | ours | R3-06 gitignore dir-rule anchor; R3-09 Cargo/Gemfile dep categories; R3-11 runCmd argv-array signature |
| `lib/audit.mjs` | ours | AUD-R2-11: offer to update the `Last verified` anchor after a `--git` audit (human confirms); reminder otherwise |
| `.github/workflows/test.yml` | (unmapped config) | R3-07 glob the syntax-check list |
| `templates/ai/lab/WORKLOG.md.tmpl`, `ai/lab/WORKLOG.md` | ours | R3-08 example row ID `W-000`; backfill row W-001 |
| `test/run-tests.mjs` | ours | regression tests (fail-first) |
| `ai/guide/MODULE_MAP.md` | ours | R3-01 re-anchor baseline to the fix commit (established precedent: accompanies the PR for human review at merge; per-row signatures untouched) |
| `CHECKSUMS.txt` | ours | regenerate (`./make-checksums.sh`) after code/template changes |

No `frozen`/`?` files touched. Human approval for the batch: the user's
instruction "fix all of them, use the loop engineering way" (2026-07-04).

## Fix sketch
Smallest-diff fixes as prescribed in the R3 report's per-finding "Fix" lines.
Two judgement calls promoted here rather than to an ADR:
1. **R3-02:** the lock keys on `[verified]` lines *not present verbatim in the
   freshly stamped template* (same diff the `--force-verified` warning already
   computes) — conservative direction preserved: any human-added `[verified]`
   line still locks.
2. **AUD-R2-11 / R3-01:** the guided `audit` may move the anchor only in the
   interactive session, only after the human explicitly confirms, and only
   under `--git` (the documented git exception). Without `--git` it prints a
   reminder. Automation still cannot move the anchor.

## Acceptance
1. New regression tests fail on the pre-fix tree and pass after.
2. Full suite (`npm test`) green; `verify . --strict` green;
   `drift . --git --strict` green after the re-anchor commit.
3. R3 report's live repros no longer reproduce.

## Knowledge update on completion
- [x] WORKLOG.md row appended (type `bugfix`, linking this doc + review)
- [x] DEFECT_TRACEABILITY.md rows AUD-R3-01..11 (+ AUD-R2-11) flipped with the fix commit
- [x] FEATURE_MAP.md gotchas added for the touched features (`install`, `orient`,
      `indepth`, `audit`); the stale `ci-checks` gotcha (pre-AUD-R2-06 npm-publish
      claim) corrected in the same pass. Reviewed fresh in `ai/lab/reviews/REVIEW_W-002.md`.
- [ ] EVAL — deferred; the R3 report itself records the lessons
