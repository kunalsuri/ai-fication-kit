<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: `demo` — zero-risk playground run
> **Status:** implemented
> **Author:** Sonnet (implementing agent) · **Date:** 2026-07-03
> **Verification:** `npm test` (285/285), `node install.mjs verify . --strict`,
> `node install.mjs drift . --strict`, `npm run release-check`, `npm pack --dry-run`
> (lists `examples/legacy-calculator/`) — all green.

## Goal
A nervous first-timer should be able to see the kit's whole before/after
pipeline run without pointing it at their own code. `node install.mjs demo`
(no target argument) copies the bundled `examples/legacy-calculator` into a
fresh OS-temp directory, runs the same in-process pipeline `shazam --yes`
runs, and prints a short tour plus the suggested next step.

## Scope
**In:** the no-target `demo` special case in `install.mjs`; `lib/demo.mjs`
(copy + orient + install, in-process, no child processes); the
`examples/legacy-calculator/` packaging fix in `package.json`'s `files`;
documenting the `os.tmpdir()` write as a sanctioned exception.
**Out (explicitly):** auto-launching an agent, auto-cleanup daemons, using
`examples/value-demo`.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| backend | `lib/demo.mjs` | new — copy example, run `orient` + `install` in-process, print the tour |
| backend | `install.mjs` | `demo` in `COMMANDS`; dispatched *before* the target-required check (demo takes no path argument) |
| packaging | `package.json` | add `"examples/legacy-calculator/"` to `files` |
| docs | `SECURITY.md` | document the `os.tmpdir()` write as a sanctioned exception |
| docs | `docs/CLI-REFERENCE.md` | command index row + `demo` section |
| docs | `CHANGELOG.md` | `[Unreleased]` entry |
| tests | `test/run-tests.mjs` | demo writes to tmpdir only, twice → two independent dirs, missing-example error, `npm pack --dry-run` lists the example |

## Acceptance criteria
1. After `demo`: the printed temp dir contains `ai/repo-profile.json`, a
   kit-stamped `CLAUDE.md`, and `ai/install-manifest.json`.
2. The user's cwd and the kit repo itself are untouched.
3. Running `demo` twice creates two independent directories (different
   timestamps), neither overwriting the other.
4. `npm pack --dry-run` lists `examples/legacy-calculator/` files.
5. If `examples/legacy-calculator/` is missing from the installed package,
   `demo` fails with a clear, actionable message (not a stack trace).

## Verification
- Tests to add: `test/run-tests.mjs` — run `demo`, inspect the printed path,
  assert the files above exist there; run twice and diff the two paths;
  temporarily rename the example directory to test the missing-example error;
  `npm pack --dry-run` output check.
- Suites to run: `npm test`, `node install.mjs verify . --strict`,
  `node install.mjs drift . --strict`, `npm run release-check`.
- Stability check: only `ours`-stability files touched. No `frozen` files modified.

## Knowledge update on completion
- [x] FEATURE_MAP.md entry added
- [x] MODULE_MAP.md rows still accurate (no new directories)
- [ ] FEATURE_CATALOG.md regenerated — deferred to `/create-feature-catalog`
