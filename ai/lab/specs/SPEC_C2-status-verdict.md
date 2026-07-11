<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: C2 — Stage-aware `status` verdict
> **Status:** implemented
> **Author:** AI draft (transcribed from `ai/lab/ROADMAP.md` Planned §C2) · **Date:** 2026-07-11 · **Revision:** 1

This spec is written to be implemented without further design decisions. It
is a direct transcription of the C2 detailed specification that lived in
`ai/lab/ROADMAP.md` (Planned → Detailed specifications → #C2) before this
feature shipped; that roadmap section has been collapsed to a Shipped
pointer row per the roadmap's own linking protocol.

## 1. Goal
`status` renders one of three verdicts (`lib/status.mjs`), and on a freshly
scaffolded repo it always picked the scariest one (`DRIFTING`/`NEEDS
AUDIT`), even though `doctor` already knows the user is only at "step 1 of
5" or "step 2 of 5" of the onboarding workflow. After this ships, `status`
agrees with `doctor`: a repo that hasn't been scanned yet reports `NOT
INSTALLED` and points to `shazam`; a repo whose map hasn't been drafted yet
reports `NOT MAPPED YET` and points to `/cold-start`. Stages 3-5 (the
existing DRIFTING/NEEDS AUDIT/TRUSTED logic) are untouched byte-for-byte.
Invariant: a health check that cries wolf on day one teaches users to
ignore it — this fix protects that trust.

## 2. Hard constraints (violating any of these fails the review)
| # | Constraint |
|---|---|
| C1 | Zero new runtime dependencies (stdlib only). |
| C2 | No changes to `lib/doctor.mjs`'s exported `diagnose()` behavior — import and call it, do not reimplement its stage logic. |
| C3 | Match the license-header practice of neighboring files. |
| C4 | Surgical diffs: touch only the files in §5; no reformatting of untouched code. |
| C5 | Stages 3-5 verdict logic (DRIFTING / NEEDS AUDIT / TRUSTED) stays byte-identical for any fixture already past stage 2. |

## 3. Scope & glossary
**In:** two new verdicts (`NOT INSTALLED`, `NOT MAPPED YET`) computed before
the existing three; badge color/message for both; terminal + `--json` +
living-progress-page rendering.
**Out (explicitly — do NOT build now):** changing `doctor` itself; changing
exit codes; auto-fixing anything; per-row remediation.

- **Doctor stage** — the 1-5 step number returned by `diagnose()` in
  `lib/doctor.mjs`. Stage 1 = no `ai/repo-profile.json`. Stage 2 =
  `ai/guide/MODULE_MAP.md` missing or still the scaffolded
  `MODULE_MAP_PLACEHOLDER` (`<fill in>`) template.

## 4. Behaviour (exact)
- `computeStatus()` (`lib/status.mjs`) additionally imports and calls
  `diagnose()` from `lib/doctor.mjs` (already read-only) and includes the
  doctor stage in its result (`doctorStep`, `doctorAction`).
- Two new verdicts, checked **before** the existing three:
  - Doctor stage 1 (no profile) → verdict `NOT INSTALLED` (dim/grey), badge
    color `grey`, badge message `not installed`.
  - Doctor stage 2 (MODULE_MAP missing or still the placeholder template) →
    verdict `NOT MAPPED YET` (blue/neutral), badge color `blue`, badge
    message `not mapped yet`. The printed report still shows the MODULE_MAP
    rows / broken-claims / drift-items block (honesty), prefixed with one
    line: "expected at this stage — the map hasn't been drafted yet".
- Doctor stages 3-5 keep the pre-existing DRIFTING / NEEDS AUDIT / TRUSTED
  logic **unchanged**, including its own (now practically unreachable but
  harmless) `mapText === null` branch.
- `printStatusReport()` colors `NOT INSTALLED` with `style.dim` and `NOT
  MAPPED YET` with a new `style.blue` (added to `lib/util.mjs`'s style
  table, `sgr("38;5;39", 39)`), and prints a `Next: <doctor action>` line
  for both new verdicts.
- `--json` output (`STATUS.json`) and the shields.io `badge` object gain the
  new verdict strings/colors; schema version unchanged.
- `refreshProgressPage()` (`lib/progress.mjs`) requires no code change — it
  already passes `status.verdict` through as an opaque string. The living
  progress page template (`templates/ai/START-HERE.html.tmpl`) gains two CSS
  classes (`.verdict.not-installed`, `.verdict.not-mapped-yet`) and two CSS
  custom properties (`--blue`, `--grey`) plus a JS branch so the two new
  verdicts render with distinct styling instead of falling into the
  `needs-audit` (amber) catch-all.

## 5. Touch list (complete — nothing else changes)
| Layer | Location | Stability (from MODULE_MAP) | Change |
|---|---|---|---|
| backend | `lib/status.mjs` | ours (`lib/` row, `[verified]`) | modify — verdict block + printer |
| backend | `lib/util.mjs` | ours (`lib/` row, `[verified]`) | modify — add `style.blue` |
| backend | `lib/doctor.mjs` | ours (`lib/` row, `[verified]`) | none (import only) |
| templates | `templates/ai/START-HERE.html.tmpl` | ours (`templates/ai/` row, `[verified]`) | modify — CSS + JS verdict mapping |
| docs | `docs/CLI-REFERENCE.md` | ours (`docs/` row, `[verified]`) | modify — status verdict table |
| docs | `CHANGELOG.md` | — (root files, `ours`/`[verified]`) | modify — `[Unreleased]` entry |
| tests | `test/run-tests.mjs` | ours (`test/` row, `[verified]`) | modify — new/updated fixtures |

Stability check: no `frozen` or `?` files touched — every touched file falls
under a `lib/`, `templates/ai/`, `docs/`, `test/`, or root row already marked
`ours` and `[verified]` in `ai/guide/MODULE_MAP.md`.

## 6. Test plan (numbered — the implementer implements every row)
Harness: `test/run-tests.mjs` (fixture-repo pattern via `makeBareFixture`,
`ok()` assertions), run with `npm test`.
| # | Test | Assertion |
|---|---|---|
| T1 | No `ai/repo-profile.json`, no map (`status-no-map` fixture) | `computeStatus` returns `NOT INSTALLED`; badge is `{color:"grey", message:"not installed"}`; CLI output points to `shazam` |
| T2 | Profile present, `MODULE_MAP.md` absent (`status-not-mapped-yet-absent`) | verdict `NOT MAPPED YET`; CLI output prints the "expected at this stage" line and points to `/cold-start` |
| T3 | Profile present, `MODULE_MAP.md` still the scaffolded placeholder (`status-not-mapped-yet-template`) | verdict `NOT MAPPED YET`; badge `{color:"blue", message:"not mapped yet"}` |
| T4 | Broken claim + profile present (`status-drifting`) | verdict stays `DRIFTING`, unchanged |
| T5 | Unmapped dir + profile present (`status-drifting-drift`) | verdict stays `DRIFTING`, unchanged |
| T6 | `[inferred]` row + profile present (`status-needs-audit`) | verdict stays `NEEDS AUDIT`, unchanged |
| T7 | Stale audit (>90d) + profile present (`status-stale-audit`) | verdict stays `NEEDS AUDIT`, unchanged |
| T8 | All-verified, fresh audit, profile present (`status-trusted`) | verdict stays `TRUSTED`, badge `brightgreen`, unchanged |
| T9 | Real-git fixture with profile.json added | verdict stays `TRUSTED`, `drift.stale === 0` (status never invokes git), unchanged |
| T10 | `--json` fixture with profile.json added | `STATUS.json` verdict/badge unchanged (`NEEDS AUDIT`) |
| T11 | own-repo sanity (`kitRoot`, already has a real profile) | row counts unchanged |

## 7. Acceptance criteria (definition of done)
1. All §2 constraints hold; the diff matches §5 exactly.
2. `npm test` green (468/468) including the §6 tests; `node install.mjs
   verify . --strict` passes (376/376 claims confirmed).
3. Manually exercised end-to-end on throwaway fixtures: a directory with no
   `ai/` at all prints `NOT INSTALLED` and a `shazam` next-step; the same
   directory with only `ai/repo-profile.json` prints `NOT MAPPED YET` and a
   `/cold-start` next-step. A populated+broken fixture still says
   `DRIFTING` byte-identically to before this change.

## 8. Knowledge update on completion (part of the change, not an afterthought)
- [x] FEATURE_MAP.md entry added/updated (status feature's verdict list)
- [ ] FEATURE_CATALOG.md — does not exist in this repo, skipped
- [x] MODULE_MAP.md rows still accurate — no new/changed rows (existing
      `lib/`, `templates/ai/`, `docs/`, `test/` rows already cover the
      touched files; no directory-level change)
- [x] WORKLOG.md row appended (W-041) linking this spec and the commit
- [x] This spec's Status → `implemented`
