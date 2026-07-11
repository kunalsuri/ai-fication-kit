<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# REVIEW: W-031 / W-032 — Claude Code slash commands merged into Agent Skills
> **Date:** 2026-07-11 · **Spec:** — (no `ai/lab/specs/` doc; user-directed process/refactor work, precedented by W-029/W-030) · **Ledger rows:** W-031, W-032
> **Reviewer:** agent, fresh session (not the implementing session)
> **Verdict:** approve

## Scope reviewed
PR #56 ("Add cold-start and review-change as distributed Agent Skills"), merged
to `main` at `2fd8176`, base `e187b3a`. Two commits, both authored on branch
`claude/project-skills-audit-1oq7kv`:

- `b1c75b3` (WORKLOG W-031) — promotes `cold-start` and `review-change` to
  distributed Agent Skills in `.claude/skills/` and `.agents/skills/` (+
  `templates/` twins), regenerates `CHECKSUMS.txt`, syncs the skill roster in
  `README.md` / `docs/FAQ.md` / `docs/MULTI-TOOL-SETUP.md`.
- `80224c8` (WORKLOG W-032) — the main migration: converts all 13
  `.claude/commands/*.md` to `.claude/skills/<name>/SKILL.md`, deletes
  `.claude/commands/` and `templates/claude/commands/`, adds an 11-row rename
  registry to `lib/migrations.mjs`, updates `test/run-tests.mjs`, the `ai/`
  knowledge layer (`MODULE_MAP.md`, `FEATURE_MAP.md`, `FEATURE_CATALOG.md`),
  and living docs (`README.md`, `docs/FAQ.md`, `docs/MULTI-TOOL-SETUP.md`,
  `docs/GETTING-STARTED.md`, `docs/IMPLEMENT-SPEC.md`, `START-HERE.html`,
  `CHANGELOG.md`, the `ai-knowledge-layer` rules, and the `check-docs` skill's
  auditor logic).

60 files changed, +695/-440. No spec doc authorizes this in `ai/lab/specs/` —
both WORKLOG rows record it as scope "set interactively" with the user. This
repo has precedent for spec-less process/refactor rows (W-029, W-030), and the
change is well-documented in-ledger with an explicit rationale (Claude Code
v2.1.3 merging commands into skills), so I did not treat the absence as a
blocker, but it is flagged below for the human's sign-off.

## Checks — evidence, not assertions
| Check | Result | Evidence |
|---|---|---|
| Spec conformance | N/A (no spec) | See scope note above; WORKLOG rationale independently verified — see next row. |
| Core factual premise correct | ✅ | Fetched `https://code.claude.com/docs/en/skills` directly: *"Custom commands have been merged into skills. A file at `.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy`... If you have files in `.claude/commands/`, those work the same way, but if a skill and a command share the same name, the skill takes precedence."* Matches the commit's claim verbatim. `argument-hint` (used on `implement-spec`) is a documented valid frontmatter field. |
| Surgical diff — every hunk traces to the stated scope | ✅ | Verified `lib/migrations.mjs` (11 renames, exactly the 11 distributed non-local-only commands, pure addition), `test/run-tests.mjs` (3 hunks, all path-string updates: installed-file assertions, `destinationFor` mapping test, `isSafeManifestPath` example), `.claude/rules/ai-knowledge-layer.md` + Cursor/`templates/` twins (prose-only path updates). No drive-by changes found. |
| Stability respected | ✅ | `ai/guide/MODULE_MAP.md`: `templates/claude/` and `templates/agents/` are both Stability `ours` (not `frozen`/`?`) — safe to edit. `templates/claude/` row was correctly downgraded `[verified]` → `[inferred]` after its entry point changed (agent did not self-flip to `[verified]`, per the provenance rule). |
| Tests — suites green, independently re-run | ✅ | Re-ran (not trusted from the WORKLOG) via a fresh `test-runner` subagent: `npm test` **408/408** exit 0; `node install.mjs verify . --strict` **344/344 confirmed, 0 missing** exit 0; `npm run deep-test` **4/5**, the one failure being the pre-existing `--strict` drift staleness on 8 `MODULE_MAP.md` rows whose last-touching commit (`76a84b2`) predates this PR — confirmed not introduced or worsened by #56. All three claims in W-031/W-032 check out exactly. |
| Dogfooding / checksums accurate | ✅ | `diff -rq templates/claude/skills .claude/skills` → byte-identical except the two documented local-only extras (`implement-spec`, `check-docs`). Independently re-hashed every skill file and reconciled against `CHECKSUMS.txt` — exact match. Full-repo checksum sweep (110 real entries): 0 mismatches, 0 missing files. |
| Skill file structural conformance | ✅ | All 24 `SKILL.md` files (13 kit-local incl. 2 local-only, 11 templates-mirrored): `name` matches directory in every case; 4 lifecycle skills (add-feature/fix-bug/cold-start/review-change) model-invocable; exactly 9 skills carry `disable-model-invocation: true` (7 distributed diagnostics + 2 local-only) — matches the CHANGELOG's "nine manual diagnostics" claim precisely; description lengths well under the 1,536-char cap; all files under the 500-line guidance; no leftover `<placeholder>` angle brackets in frontmatter. |
| No stale references to removed paths | ✅ | Repo-wide grep for `.claude/commands/` / `templates/claude/commands/` outside history/prose: zero hits in live code, tests, or current docs. The only remaining textual references are in historical audit reports (dated, describing past state — correctly left alone) and two intentionally un-backticked WORKLOG rows (next check). |
| Conventions & license headers | ✅ | All new/moved `SKILL.md` files carry the standard copyright header, matching neighbors. |
| Knowledge updated, tagged `[inferred]` | ✅ | `FEATURE_MAP.md` (`check-drift`, `adversarial-audit` entries) and `FEATURE_CATALOG.md` (F10 rows, decision tree) all repoint to `templates/claude/skills/...`; all touched rows remain `[inferred]`. `check-docs`'s ground-truth logic was updated to derive the distributed roster from `templates/claude/skills/` instead of the removed `commands/` path. |
| Provenance clean — no `[verified]` written by an agent | ✅ | `git diff <base>..<head> \| grep '^+.*\[verified\]'` — every hit is procedural prose inside `cold-start`'s own SKILL.md instructing *future* agents not to self-flip tags; no content row's tag was flipped. |
| WORKLOG historical-row un-backticking (claimed) | ✅ | W-010 and W-029 rows' `.claude/commands/*.md` mentions are now plain text (not backtick-quoted), matching the W-012 precedent so `verify --strict` doesn't need those historical paths to still exist — confirmed against the rule that only backtick-quoted claims are checked. |

## Findings
| # | Severity | File | Finding | Resolution |
|---|---|---|---|---|
| 1 | minor | `ai/install-manifest.json` | Still lists the 12 old `.claude/commands/*.md` paths (with their old hashes) as this repo's own installed-file record; never refreshed to the new `.claude/skills/*/SKILL.md` paths. Explicitly flagged and deferred in W-031's WORKLOG row ("left to the maintainer's next `node install.mjs install .` dogfood pass" — a real run also touches `ai/repo-profile.json`, unwanted churn on a skills-only branch). Confirmed low-risk: `verify`/`drift`/tests never read this file — only `install`/`uninstall`/`update` do — so it cannot silently corrupt CI or the knowledge layer, but until refreshed, an `update`/`uninstall` run against *this* repo would still reason about the pre-migration file set. | Accepted as documented, deliberate deferral. Recommend the maintainer run `node install.mjs install .` once before or shortly after the 0.4.0 tag so the manifest matches reality. |
| 2 | nit | `ai/guide/MODULE_MAP.md` line 31 | The `templates/agents/` row still describes `.agents/skills/` as holding only "the add-feature skill," but it has held `fix-bug` since commit `51311ea` (predates this PR) and gained `cold-start`/`review-change` in W-031 (part of this PR) without the row being updated. Not a `verify`-checked backtick claim, so it's cosmetic, and it predates W-032's own scope (Claude-surface only) — but W-031 did touch `.agents/skills/` and could have updated it. | Ship with note; low value to block on, but worth a follow-up one-line fix next time this row is touched. |

## What the human should double-check
1. **Spec-less scope.** This is process/refactor work authorized interactively
   rather than via a written spec in `ai/lab/specs/`. The scope (Claude-only,
   11+2 skills, Cursor/Copilot/Antigravity untouched) is exactly what you'd
   expect from the stated goal, but confirm that was the intended blast radius
   — nothing here was checked against a durable, pre-agreed acceptance list.
2. **`ai/install-manifest.json` staleness (finding 1).** Decide whether to run
   the dogfood install pass before tagging 0.4.0, or explicitly accept the
   drift until the next unrelated install-touching change.
3. **The 0.4.0 version bump and release itself** are explicitly left to you —
   nothing in this PR touches `package.json`'s version or cuts a tag; the
   `CHANGELOG.md` entry is filed under `[Unreleased]` and the rename rows in
   `lib/migrations.mjs` are tagged `sinceVersion: "0.4.0"` in anticipation.
