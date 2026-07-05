<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: Native `.claude/rules/` parity for Claude Code
> **Status:** implemented
> **Author:** agent draft `[inferred]` (from the maintainer's 2026-07-04
> request: re-verify the templates against the latest CLAUDE.md / AGENTS.md /
> harness / context / loop engineering guidance and close any gap)
> · **Date:** 2026-07-04

## Goal
The online re-audit found the kit current on every count except one real
asymmetry: the kit ships Cursor's native always-on rule
(`.cursor/rules/ai-knowledge-layer.mdc`, `alwaysApply: true`) but no native
Claude Code equivalent. Claude Code now supports `.claude/rules/*.md` with
optional `paths:` frontmatter (omitted ⇒ always-on, same priority as
`CLAUDE.md`) — an official mechanism the kit did not use. PR #29 widened the gap
by adding a second always-on invariant (Record-work) to the Cursor rule with
still no Claude twin. This spec ships the missing native rule so Claude Code and
Cursor carry the same two invariants (provenance + record) natively.

## Scope
**In:**
- New always-on rule `templates/claude/rules/ai-knowledge-layer.md` (no `paths:`
  frontmatter) mirroring the Cursor always-on rule: `ai/INDEX.md` pointer +
  provenance + record invariants. Auto-installs to `.claude/rules/` via the
  installer's recursive template walk + existing `claude/` → `.claude/` mapping
  (no `install.mjs` change needed).
- Byte-identical dogfood twin `.claude/rules/ai-knowledge-layer.md`.
- Doc accuracy: `templates/README.md`, root `README.md` structure block,
  `docs/MULTI-TOOL-SETUP.md` (per-tool table + Claude Code section).
- Test coverage: the new file is asserted installed and always-on (no `paths:`
  frontmatter, carries the `ai/INDEX.md` pointer + provenance + record).
- `CHECKSUMS.txt` regenerated (covers `templates/`).

Second pass (same re-audit unit of work — enhancements #2, #3, and the
path-scoped guard, approved after the first commit):
- **Path-scoped guard** `templates/claude/rules/provenance.md` (+ dogfood twin),
  `paths: ["ai/**"]` — loads only when the agent edits the `ai/` layer,
  reinforcing provenance at write-time. Asserted path-scoped in tests.
- **Auto-memory clarifier** (#2): one line in `CLAUDE.md`/`AGENTS.md` and their
  templates — auto-memory is machine-local; the committed `ai/` layer is the
  shared source of truth.
- **README framing** (#3): a "Where this fits" section mapping the kit to
  context / harness / loop engineering, with source links.

**Out (explicitly):** nothing further from this re-audit — the four gaps it
surfaced are all now closed.

## Touch list
| Layer | Location | Change |
|---|---|---|
| rule (kit) | `templates/claude/rules/ai-knowledge-layer.md` | new always-on rule |
| rule (dogfood) | `.claude/rules/ai-knowledge-layer.md` | byte-identical twin |
| guard (kit) | `templates/claude/rules/provenance.md` | new path-scoped `ai/**` guard |
| guard (dogfood) | `.claude/rules/provenance.md` | byte-identical twin |
| config | `CLAUDE.md`, `AGENTS.md`, `templates/CLAUDE.md.tmpl`, `templates/AGENTS.md.tmpl` | auto-memory clarifier line (#2) |
| docs | `templates/README.md`, `README.md`, `docs/MULTI-TOOL-SETUP.md` | mention the rules; README "Where this fits" section (#3) |
| tests | `test/run-tests.mjs` | installed-file checks + always-on & path-scoped assertions |
| ledger | `ai/lab/WORKLOG.md` | row W-006 |
| spec | `ai/lab/specs/SPEC_claude-rules-parity.md` | this file |
| checksums | `CHECKSUMS.txt` | regenerated |
| manifest | `ai/install-manifest.json` | record the dogfood twins |

## Acceptance criteria
1. `install` writes `.claude/rules/ai-knowledge-layer.md`; the file has no
   `paths:` frontmatter (always-on) and states the `ai/INDEX.md` pointer plus
   the provenance and record invariants.
2. Template and dogfood copies are byte-identical.
3. `npm test`, `node install.mjs verify . --strict`, and `drift . --strict`
   (without `--git`) all pass; no new template placeholders leak outside
   `templates/`.
4. `CHECKSUMS.txt` matches the tree (`./make-checksums.sh` produces no diff on
   a re-run).

## Verification
- Suites: `npm test` · `node install.mjs verify . --strict` ·
  `node install.mjs drift . --strict`
- Sync check: `diff templates/claude/rules/ai-knowledge-layer.md
  .claude/rules/ai-knowledge-layer.md` is empty.
- Stability check: `.claude/` and `templates/` are `ours` in
  `ai/guide/MODULE_MAP.md`; no `frozen`/`?` files modified.

## Knowledge update on completion
- [x] WORKLOG row W-006 appended (`[inferred]`)
- [ ] Human audit: flip W-006 to `[verified]`
