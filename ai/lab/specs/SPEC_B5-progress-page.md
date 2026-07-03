<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: Living progress page in the target repo
> **Status:** implemented
> **Author:** Sonnet (implementing agent) · **Date:** 2026-07-03
> **Verification:** `npm test` (328/328), `node install.mjs verify . --strict`,
> `node install.mjs drift . --strict`, `npm run release-check` — all green.
> Depends on A2 (`status`), which shipped earlier in this backlog. A real
> regression was caught and fixed during implementation: the generic
> installer's child-lock/edited-file detection initially treated the page's
> ever-changing content as a human edit and left a spurious timestamped
> backup on every `--force` re-install — see "Design notes" below and the
> dedicated regression test.

## Goal
`START-HERE.html` at the kit repo's root is static marketing about the kit
itself; beginners need the equivalent *about their own repo*, refreshed as
they progress. `ai/START-HERE.html`, stamped into every target repo, is a
fully offline (double-click to open, zero network requests) dashboard: a
5-step checklist (reusing `doctor`'s stage detection), `[verified]`/`[inferred]`
row counts, open drift items, and a small glossary — regenerated every time
`install`, `verify`, `drift`, `status`, or `audit` runs.

## Scope
**In:** `templates/ai/START-HERE.html.tmpl`; `lib/progress.mjs`
(`refreshProgressPage`); call sites in `install`/`verify`/`drift`/`status`/
`audit`; one `ai/INDEX.md.tmpl` manifest row.
**Out (explicitly):** a build step, any client-side fetch (data is inlined
at generation time), hosting/serving the page.

## Design notes
- The static shell (title, CSS, glossary, JS renderer) is stamped once by the
  normal template mechanism. The dynamic bit is a single
  `<script id="progress-data" type="application/json">{...}</script>` block
  that starts as a valid bootstrap JSON object (not a `{{PLACEHOLDER}}` — that
  would trip the installer's leftover-placeholder warning for something that's
  expected and self-heals within the same command).
- `refreshProgressPage(targetAbs)` only ever replaces that one script block's
  contents via a regex, leaving the rest of the file byte-for-byte — so a
  user's `{{PROJECT_NAME}}`-stamped title survives every refresh.
- **Import-cycle avoidance:** `install`/`verify`/`drift`/`status`/`audit` all
  statically import `refreshProgressPage`, which itself needs their compute
  functions (`computeStatus`, `diagnose`). `lib/progress.mjs` therefore uses
  *dynamic* `import()` internally for `status.mjs`/`doctor.mjs` — by the time
  `refreshProgressPage` actually runs, every module is already loaded, so the
  cycle never has to be resolved by the static module graph.
- **Child-lock exemption:** `ai/START-HERE.html`'s content legitimately
  changes on every run (that's the whole point). The generic installer's
  edited-file detection doesn't know that and would otherwise take a pointless
  timestamped backup on every `--force` re-install once the page had been
  refreshed once. `lib/installer.mjs`'s `install()` special-cases this one
  destination path to always classify as `up-to-date`/`new` — never
  `keep`/`overwrite` — so its ownership stays with `refreshProgressPage` alone.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| templates | `templates/ai/START-HERE.html.tmpl` | new |
| backend | `lib/progress.mjs` | new — `refreshProgressPage` |
| backend | `lib/installer.mjs` | call `refreshProgressPage` at the end of `install()`; child-lock exemption for the page's destination path |
| backend | `lib/verify.mjs`, `lib/drift.mjs`, `lib/status.mjs`, `lib/audit.mjs` | call `refreshProgressPage` after a real (non-dry-run) run |
| templates | `templates/ai/INDEX.md.tmpl` | one manifest row for the page |
| tests | `test/run-tests.mjs` | install/refresh/uninstall/absent-page coverage, the child-lock-exemption regression |

## Acceptance criteria
1. The page is valid, complete HTML with zero external requests (no `http(s)://`
   anywhere in the output).
2. It reflects state changes: after `verify` runs, its `brokenClaims` count updates.
3. `uninstall` removes it (it's manifest-tracked, like any other stamped file).
4. `verify`/`drift`/`status` still work (exit 0, no crash) when the page is
   absent (deleted by the user) — and none of them recreate it on their own.
5. `--force`/`--force-verified` re-installs never leave a `START-HERE_bkp_*.html`
   behind (the child-lock exemption).

## Verification
- Tests to add: `test/run-tests.mjs` — `refreshProgressPage` unit tests
  (populates real data, no-ops when absent, no-ops on an unrecognized file),
  install-time page presence + content, a verify-time refresh assertion,
  uninstall removal, and the `--force` no-spurious-backup regression.
- Suites to run: `npm test`, `node install.mjs verify . --strict`,
  `node install.mjs drift . --strict`, `npm run release-check`.
- Stability check: only `ours`-stability files touched. No `frozen` files modified.

## Knowledge update on completion
- [x] FEATURE_MAP.md entry added
- [x] MODULE_MAP.md rows still accurate (no new directories)
- [ ] FEATURE_CATALOG.md regenerated — deferred to `/create-feature-catalog`
