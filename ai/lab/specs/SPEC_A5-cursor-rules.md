<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: Native Cursor rules assets
> **Status:** implemented
> **Author:** Sonnet (implementing agent) · **Date:** 2026-07-03
> **Verification:** `npm test` (295/295), `node install.mjs verify . --strict`,
> `node install.mjs drift . --strict`, `npm run release-check`,
> `npm pack --dry-run` (lists `templates/cursor/rules/*.mdc`) — all green.

## Goal
The README claims Cursor compatibility, but Cursor only got the generic
`AGENTS.md` while Copilot got prompts/chatmodes and Antigravity got
workflows. This ships `.cursor/rules/*.mdc` — the same 8 workflow commands as
native Cursor rules, plus one always-on rule pointing at the knowledge layer —
so Cursor users get the same automation everyone else does. Codex needs
nothing new; it reads `AGENTS.md` natively, so the docs say so instead of
inventing files for it.

## Scope
**In:** `templates/cursor/rules/*.mdc` (8 mirrored workflow rules + 1
`alwaysApply: true` index rule); `cursor/` → `.cursor/` in
`lib/installer.mjs`'s `destinationFor`; docs (`templates/README.md`,
`docs/MULTI-TOOL-SETUP.md`, `docs/FAQ.md`, README badges/diagrams).
**Out (explicitly):** writing new methodology — rule bodies are the existing
Copilot prompt content, only the frontmatter changes. Codex-specific assets.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| templates | `templates/cursor/rules/*.mdc` | new — 8 files mirroring `templates/github/prompts/*.prompt.md` + `ai-knowledge-layer.mdc` |
| backend | `lib/installer.mjs` | `destinationFor`: `cursor/` → `.cursor/` |
| docs | `templates/README.md`, `docs/MULTI-TOOL-SETUP.md`, `docs/FAQ.md`, `README.md` | Cursor gains a "native" row/section, no longer lumped with Codex's manual mode |
| tests | `test/run-tests.mjs` | install/re-run/uninstall coverage extended with `.cursor/` files; `destinationFor` unit test |

## Acceptance criteria
1. `install`/`shazam` stamps `.cursor/rules/*.mdc` (8 workflow rules + the
   always-on index rule) alongside the existing three trees.
2. `uninstall` removes the whole `.cursor/` tree.
3. An incremental re-run restores a missing Cursor rule file exactly like it
   already does for `.agents/workflows/`; the child-lock protects a
   human-edited Cursor rule the same as any other stamped file.
4. Every `.mdc` file references only paths that exist in a stamped target
   repo (`ai/INDEX.md`, `AGENTS.md`); no unresolved `{{PLACEHOLDER}}` tokens.

## Verification
- Tests to add: `test/run-tests.mjs` — install-file-list, MDC-frontmatter
  shape, one child-lock-extension file, uninstall, `destinationFor` unit test.
- Suites to run: `npm test`, `node install.mjs verify . --strict`,
  `node install.mjs drift . --strict`, `npm run release-check`,
  `npm pack --dry-run`.
- Stability check: only `ours`-stability files touched (`lib/`, `templates/`,
  `docs/`, `README.md`). No `frozen` files modified.

## Knowledge update on completion
- [x] FEATURE_MAP.md entry added
- [x] MODULE_MAP.md rows still accurate (no new top-level directories in the kit repo itself)
- [ ] FEATURE_CATALOG.md regenerated — deferred to `/create-feature-catalog`
