<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: Detect the user's AI tool, tailor instructions
> **Status:** implemented
> **Author:** Sonnet (implementing agent) · **Date:** 2026-07-03
> **Verification:** `npm test` (309/309), `node install.mjs verify . --strict`,
> `node install.mjs drift . --strict`, `npm run release-check` — all green.

## Goal
The first-run wizard and post-install "next steps" currently describe every
tool at once; a Copilot-only (or Cursor-only) beginner has to filter out
noise about tools they don't use. The wizard gains one more question — which
AI coding tool will you use — pre-selected via read-only inspection, and the
next-steps printer shows only that tool's instructions.

## Scope
**In:** one wizard question (`lib/intake.mjs`); read-only, best-effort
default detection (`~/.claude/`, `.cursor/` in target or home, `~/.vscode/
extensions/github.copilot*`); `humanContext.primaryTool` persisted in
`ai/repo-profile.json`; tailored step-1 text in the post-install printer.
**Out (explicitly):** changing which templates get stamped — every tool's
assets are still installed regardless of the answer; only the *messaging*
is tailored.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| backend | `lib/intake.mjs` | `PRIMARY_TOOL_OPTIONS`, `detectPrimaryTool()`, `coldStartInstructionFor()`, the new wizard question |
| backend | `install.mjs` | shazam's "Next steps" printer reads `profile.humanContext?.primaryTool` |
| tests | `test/run-tests.mjs` | `detectPrimaryTool` and `coldStartInstructionFor` unit tests |
| docs | `docs/CLI-REFERENCE.md`, `CHANGELOG.md` | note the new wizard question |

## Acceptance criteria
1. `detectPrimaryTool` returns `"Claude Code"` when `<home>/.claude/` exists,
   `"Cursor"` when `.cursor/` exists in the target or the home dir,
   `"GitHub Copilot"` when a `github.copilot*` extension dir exists under
   `<home>/.vscode/extensions/`, and `null` when none apply or the home dir
   itself doesn't exist (tolerated silently, no throw).
2. `coldStartInstructionFor` returns the right one-liner for each of the 4
   named tools, and falls back to the Claude Code instruction for
   `"Several of these"`, `"None yet"` (handled separately by the printer),
   an unrecognized value, or `undefined` (no wizard ran).
3. The wizard's answer is stored as `humanContext.primaryTool` and survives a
   re-run (the existing `humanContext` carry-forward already covers this —
   no separate mechanism needed).
4. `--yes` / non-interactive `shazam` records no `humanContext` at all (the
   wizard self-skips before this question is ever reached) — today's fully
   generic "Next steps" output is unchanged.

## Verification
- Tests to add: `test/run-tests.mjs` — `detectPrimaryTool` fixtures (each
  signal in isolation, and none-detected), `coldStartInstructionFor` for
  every option plus the fallback.
- Suites to run: `npm test`, `node install.mjs verify . --strict`,
  `node install.mjs drift . --strict`, `npm run release-check`.
- Stability check: only `ours`-stability files touched. No `frozen` files modified.
- Note: the wizard's interactive question sequence itself cannot be driven
  end-to-end in this sandbox (no TTY allocator) — the same constraint noted
  in `SPEC_A1-audit.md`. Every deterministic building block is unit-tested
  directly instead.

## Knowledge update on completion
- [x] FEATURE_MAP.md entry updated (intake gotchas)
- [x] MODULE_MAP.md rows still accurate (no new directories)
- [ ] FEATURE_CATALOG.md regenerated — deferred to `/create-feature-catalog`
