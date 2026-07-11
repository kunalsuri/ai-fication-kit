<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: C10 — Knowledge-template & workflow alignment
> **Status:** approved — implementation complete, human audit of the diff still
> pending (2026-07-11, via chat — corrections from the spec-audit subagent's
> report folded into Revision 2 below: touch list updated for the W-032
> commands→skills migration, W2 exception wording tightened; see
> `ai/lab/WORKLOG.md` row W-038)
> **Author:** AI draft (from `ai/analysis/audit-reports/2026-07-06-fullstack-simulation-report.md` findings F2, F6, F7, F9, F10) · **Date:** 2026-07-06 · **Revision:** 2

This spec is written to be implemented **without further design decisions** (consume
via `/implement-spec`). It is text/template work: no `lib/` logic changes except the
one test in §6. Rationale: `ai/analysis/audit-reports/2026-07-06-fullstack-simulation-report.md`.

## 1. Goal
The templates the kit stamps into a target agree with what the kit's own parsers and
dogfooded files expect: a cold-started MODULE_MAP is counted correctly by
`status`/`doctor`, the cold-start pass is explicitly allowed to correct the stamped
build/test lines, and the stamped rules stop asserting conventions a target may not
have. Invariant: `MODULE_MAP_PLACEHOLDER` (`"<fill in>"`, `lib/drift.mjs:29`) must
still appear in the stamped MODULE_MAP template so doctor step-2 detection keeps
working.

## 2. Hard constraints (violating any of these fails the review)
| # | Constraint |
|---|---|
| C1 | Every command/workflow text change is applied to ALL tool-surface copies listed in §5 — the 5 live local body-text families AND their 5 `templates/` twins (10 files total; the W-013 "14 copies" lesson: a drifting twin is worse than no fix). [Revision 2: corrected from "4 live/4 templates" per spec-audit report — see §3 glossary.] |
| C2 | Template edits are surgical line replacements; never regenerate or reflow a whole file (the "No Phantom Bugs & Configuration Churn" rule). |
| C3 | `"<fill in>"` remains present verbatim in `templates/ai/guide/MODULE_MAP.md.tmpl` after the change (doctor step-2 contract, see §1). |
| C4 | No new Stability *value* is introduced — parsers and the audit command must not need changes (W3 uses legend text, not a new enum). |
| C5 | Copyright headers on touched template files stay intact. |

## 3. Scope & glossary
**In:** W1–W5 below. **Out (explicitly — do NOT build now):** stack-conditional
stamping logic in the installer (that is ROADMAP C1's `{{CONFIG_FILES}}` token —
W4 here is wording-only and must not collide with it); parser changes to accept the
old 4-column format (the template becomes 5-column; old installs migrate on their
next update run); any `/implement-spec` template distribution (deliberate W-004/W-014 deferral).

- **tool-surface copies** — [Revision 2, per spec-audit report: corrected post
  W-032/W-033, which migrated Claude Code from `.claude/commands/` to
  `.claude/skills/` and added a distinct `.agents/skills/` mirror. There are now
  FIVE independent cold-start body-text families, not four, and
  `.agents/workflows/cold-start.md` / `.agents/skills/cold-start/SKILL.md` are NOT
  twins of each other (confirmed by diff — different step-3 wording) even though
  each has its own `templates/` twin.] The same workflow text exists as
  `.claude/skills/<name>/SKILL.md`, `.agents/skills/<name>/SKILL.md`,
  `.agents/workflows/<name>.md`, `.cursor/rules/<name>.mdc`,
  `.github/prompts/<name>.prompt.md` — 5 families, each with its own `templates/`
  twin (10 files total for `cold-start`). Pitfall: the `.mdc` and `.prompt.md`
  variants have different front-matter, and `.claude/skills/`/`.agents/skills/`
  have YAML frontmatter too — edit the shared body text only, and diff each live
  file against its OWN twin, never against a sibling family.

## 4. Behaviour (exact)

### W1 — 5-column MODULE_MAP template + explicit row shape in cold-start (finding F2)
1. In `templates/ai/guide/MODULE_MAP.md.tmpl` replace the modules table header and
   placeholder row (currently 4-column at ~line 19):
   ```markdown
   | Directory | Responsibility (one line) | Entry point | Stability (guess) | Status |
   |---|---|---|---|---|
   | <fill in> | <fill in> | <fill in> | ? | [inferred] |
   ```
   Directly under the table add one HTML-comment worked example (kept out of
   parsers by being a comment):
   `<!-- Example: | `src/api/` | HTTP routes | `src/api/main.ts` | ours | [inferred] | — the human audit rewrites Status to [verified] (YYYY-MM-DD) -->`
2. In the audit-protocol block of the same template, change
   "1. /cold-start fills rows and tags them `[inferred]`." to
   "1. /cold-start fills rows, Stability = its guess (or `?`), Status = `[inferred]`."
3. In ALL 5 cold-start body-text families (10 files, §5), extend the "Fill `ai/guide/MODULE_MAP.md`" step
   with one sentence: "Each row has FIVE cells — Directory, Responsibility, Entry
   point, Stability guess, Status — and the Status cell is where the `[inferred]`
   tag goes (the tooling reads provenance from the LAST cell only)."

### W2 — cold-start owns correcting the stamped build/test lines (finding F6)
1. In ALL 5 cold-start body-text families (10 files), insert a new step after the "Fill MODULE_MAP" step:
   "**Correct the stamped commands.** If the build/test commands you verified in
   config files differ from the Build/Test lines stamped into `CLAUDE.md` and
   `AGENTS.md`, correct exactly those lines (and the Definition-of-done lines in
   `ai/guide/CONVENTIONS.md`), tag the correction `[inferred]`, and change nothing
   else in those files. This is the sanctioned exception to the No-Churn rule."
   Renumber the following steps.
2. In `templates/CLAUDE.md.tmpl` and `templates/AGENTS.md.tmpl`, append to the
   No-Churn rule sentence: "(one exception: during /cold-start only, the pass may
   correct the stamped Build/Test lines in this file and AGENTS.md/CLAUDE.md, and
   the Definition-of-done line in ai/guide/CONVENTIONS.md, after verifying against
   real config files — tag each correction `[inferred]` and change nothing else in
   these files)". [Revision 2, per spec-audit report: the original wording omitted
   the `[inferred]`-tagging and scope-limiter that W2.1's workflow text carries, and
   never mentioned `ai/guide/CONVENTIONS.md` even though W2.1 also authorizes
   editing it — creating a rule/workflow contradiction. This wording closes both
   gaps.]

### W3 — a home for generated/vendored code in the Stability legend (finding F10b)
In `templates/ai/guide/MODULE_MAP.md.tmpl`'s Stability legend, extend the `frozen`
line: "- `frozen` — inherited / load-bearing legacy, **or generated/vendored code**:
never hand-edit; if it has a regeneration command, name it in the Responsibility
cell and change the module only by re-running it." Add the same sentence to the
Stability section of `docs/AUDIT-GUIDE.md` (find the frozen definition; append
after it).

### W4 — stop asserting license headers unconditionally (finding F9)
1. `templates/AGENTS.md.tmpl` rule 4 currently reads "Match license headers on
   every new source file, copying from neighboring files." Replace with: "Match the
   license-header practice of neighboring files — copy their header if they have
   one, add none if they don't."
2. Apply the same wording to the corresponding line in `templates/CLAUDE.md.tmpl`
   (if present) and to constraint C3 in `templates/ai/lab/specs/SPEC_TEMPLATE.md`
   (and the kit's own `ai/lab/specs/SPEC_TEMPLATE.md`): "C3 | Match the
   license-header practice of neighboring files (including having none)."

### W5 — blocked-env verification state + W-001 ID consistency (findings F7, F10a)
1. `templates/ai/lab/reviews/REVIEW_TEMPLATE.md` (and the kit's own
   `ai/lab/reviews/REVIEW_TEMPLATE.md`): in the verification/evidence section add
   one line: "If a required suite cannot execute in this environment, record the
   check as `BLOCKED-ENV: <blocker> — compensating evidence: <what was run
   instead>` rather than skipping it silently; BLOCKED-ENV anywhere caps the
   verdict at approve-with-nits."
2. `templates/ai/lab/WORKLOG.md.tmpl` (and the kit's own `ai/lab/WORKLOG.md`
   rules block): extend the Status vocabulary line to
   "`specced` → `in-progress` → `in-review` → `shipped` (or `rolled-back` /
   `dropped`; suffix ` (blocked-env)` when verification could not run in the
   working environment)".
3. `templates/ai/lab/ROADMAP.md.tmpl` linking-protocol text: change the example
   "a row ID like `W-1`" to "a row ID like `W-001`" so it matches the WORKLOG
   template's "real rows start at W-001".

## 5. Touch list (complete — nothing else changes)
| Layer | Location | Stability (from MODULE_MAP) | Change |
|---|---|---|---|
| templates | `templates/ai/guide/MODULE_MAP.md.tmpl` | ours | modify (W1, W3) |
| templates | `templates/CLAUDE.md.tmpl`, `templates/AGENTS.md.tmpl` | ours | modify (W2, W4) |
| templates | `templates/ai/lab/specs/SPEC_TEMPLATE.md`, `templates/ai/lab/reviews/REVIEW_TEMPLATE.md`, `templates/ai/lab/WORKLOG.md.tmpl`, `templates/ai/lab/ROADMAP.md.tmpl` | ours | modify (W4, W5) |
| workflows (live) | [Revision 2, per spec-audit report: post-W-032/W-033 the live set is 5 families, not 4] `.claude/skills/cold-start/SKILL.md`, `.agents/skills/cold-start/SKILL.md`, `.agents/workflows/cold-start.md`, `.cursor/rules/cold-start.mdc`, `.github/prompts/cold-start.prompt.md` | ours | modify (W1.3, W2.1) |
| workflows (twins) | `templates/claude/skills/cold-start/SKILL.md`, `templates/agents/skills/cold-start/SKILL.md`, `templates/agents/workflows/cold-start.md`, `templates/cursor/rules/cold-start.mdc`, `templates/github/prompts/cold-start.prompt.md` | ours | modify (W1.3, W2.1) |
| kit's own lab files | `ai/lab/specs/SPEC_TEMPLATE.md`, `ai/lab/reviews/REVIEW_TEMPLATE.md`, `ai/lab/WORKLOG.md` (rules block only), `ai/lab/ROADMAP.md` (protocol text only) | — | modify (W4, W5) |
| docs | `docs/AUDIT-GUIDE.md` | ours | modify (W3) |
| tests | `test/run-tests.mjs` | ours | modify (T1–T3) |

Stability check: no `frozen` or `?` files touched.

## 6. Test plan (numbered — the implementer implements every row)
Harness: `test/run-tests.mjs`.
| # | Test | Assertion |
|---|---|---|
| T1 | stamped map is parser-legible | run the installer against a bare fixture, then feed the stamped MODULE_MAP.md through `parseModuleMap` from `lib/drift.mjs`: the template yields 0 rows (placeholder), AND a synthetic row appended in the stamped 5-column shape with `[inferred]` in the last cell is counted `status === "inferred"`. |
| T2 | placeholder contract survives | the stamped MODULE_MAP.md still contains the literal string `<fill in>` (doctor step-2 detection, `MODULE_MAP_PLACEHOLDER`). |
| T3 | copy parity | for each of the 5 cold-start body-text families in §5, the body text (after stripping front-matter up to the first blank line) is byte-identical between the live copy and its OWN `templates/` twin — never compared against a sibling family (`.agents/workflows/cold-start.md` and `.agents/skills/cold-start/SKILL.md` are confirmed NOT twins of each other). [Revision 2, per spec-audit report: corrected from "4 twin pairs".] |

## 7. Acceptance criteria (definition of done)
1. All §2 constraints hold; the diff matches §5 exactly.
2. `node test/run-tests.mjs` fully green including T1–T3;
   `node install.mjs verify . --strict` exits 0.
3. Contract-critical observable: T1 — a map drafted in the stamped format is
   counted as `[inferred]` by the parser that `status`/`doctor` use; if T1 fails,
   finding F2 is not fixed and the change fails.

## 8. Knowledge update on completion (part of the change, not an afterthought)
- [ ] `ai/lab/ROADMAP.md` row C10 moved Planned → Shipped (cross-link spec + WORKLOG row)
- [ ] `ai/lab/WORKLOG.md` row appended linking this spec, the review, and the commits
- [ ] `docs/GETTING-STARTED.md` step-2/3 screenshots or text updated only if they show the 4-column table
- [ ] This spec's Status → `implemented` (the human flips it after audit)
