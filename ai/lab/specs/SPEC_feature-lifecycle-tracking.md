<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: Feature-lifecycle tracking — one ROADMAP, cousin of the WORKLOG
> **Status:** draft | approved | implemented
> **Author:** AI draft `[inferred]` (from the maintainer's 2026-07-05 direction:
> consolidate the two `docs/dev/` feature files into one lifecycle-aware document
> inside the shared knowledge layer, and make the planned→spec→worklog→PR trace
> explicit) · **Date:** 2026-07-05 · **Revision:** 2

This spec is written to be implemented **without further design decisions**. The
design rationale (why one file, why `ai/lab/`, why cross-link instead of copy)
was settled in the 2026-07-05 design conversation and is summarised in §1; read
it once, then implement from *this* document.

## 1. Goal
After this ships, the kit's forward-looking feature planning lives in **one**
place — `ai/lab/ROADMAP.md`, a sibling of `ai/lab/WORKLOG.md` — instead of two
files under `docs/dev/`. `ROADMAP.md` holds two sections: **Planned** (rich,
spec-grade entries so a light model can implement a feature cold) and **Shipped**
(thin pointer rows). A feature is one object with a lifecycle: it is born in
Planned, and when it ships its detail migrates into `ai/lab/specs/SPEC_<id>.md`
while its row collapses to a Shipped pointer that cross-links its spec, its
WORKLOG row(s), and its PR — by **feature ID**, never by copying fields.

**Invariants that must stay true afterward:**
- The single source of truth for "what shipped, when, under which spec" remains
  `ai/lab/WORKLOG.md`. `ROADMAP.md` references it; it never re-transcribes it.
- Nothing that was in the two old files is lost — content is migrated, not
  summarised (the "No Phantom Bugs & Configuration Churn" rule).
- `ai/` stays the one root; the roadmap is discoverable through `ai/INDEX.md`,
  not through a second top-level folder.

## 2. Hard constraints (violating any of these fails the review)
| # | Constraint |
|---|---|
| C1 | No behaviour change to existing CLI commands or exit codes. `verify` gains one additive capability — it scans `ai/lab/ROADMAP.md` and honours `verify-ignore` fences; no existing claim result changes (Rev 2). |
| C2 | Faithful migration: the C1–C8 detailed specs and the shared engineering contract are copied verbatim (link targets re-pointed for the new location), never paraphrased or stubbed. |
| C3 | License header (HTML-comment form) as the first line of every new `.md`. |
| C4 | Surgical diffs: touch only the files in §5; no reformatting of untouched prose. |
| C5 | Delete **only** `docs/dev/features-upcoming-implemented/`. `docs/dev/lessons-learnt/` and `docs/dev/general-prompts/` are not touched. |
| C6 | `node install.mjs verify . --strict` passes after the change (the WORKLOG row's backticked paths all resolve). |
| C7 | Backfilling WORKLOG rows for the wave-2 features stays out of scope (retrofitting is out per `SPEC_engineering-loop.md`). Command-matrix wiring and `verify` enforcement, deferred in Rev 1, are implemented in Rev 2 (see §3). |

## 3. Scope & glossary
**In:** create `ai/lab/ROADMAP.md`; migrate both `docs/dev/features-*` files into
it (Planned = wave-3 C-series rich specs; Shipped = wave-2 A/B pointer rows);
relocate the product-management narrative (personas, simulation evidence) to a
new `docs/dev/lessons-learnt/` entry; register the roadmap in `ai/INDEX.md`,
`CLAUDE.md`, `AGENTS.md`, and `docs/README.md`; repair the inbound links that
pointed at the old files; delete the old folder; append a WORKLOG row.

**Out (explicitly — do NOT build now):** wiring the planned→shipped step into the
`/add-feature` and `/implement-spec` command matrix (Claude/Cursor/Copilot/agents
× template + dogfood); adding `ai/lab/ROADMAP.md` to `verify`'s `sources` list
(the CI-enforced trace); a `templates/ai/lab/ROADMAP.md.tmpl` for adopters;
backfilling WORKLOG rows for the wave-2 features (retrofitting is out per
`SPEC_engineering-loop.md`).

**Revision 2 (2026-07-05):** the command wiring, the `verify` enforcement, and the
adopter template listed above are now **in scope and implemented** (recorded as
W-013). Only the wave-2 WORKLOG backfill remains out.

Terms the implementer could misread:
- **cousin** — `ROADMAP.md` and `WORKLOG.md` are sibling files in `ai/lab/` that
  cross-reference each other by ID. They are at different altitudes: WORKLOG is
  *per-work-unit* (a feature may span several rows); ROADMAP is *per-feature*.
- **collapse on ship** — when a Planned feature ships, its rich detail moves to
  `ai/lab/specs/SPEC_<id>.md` and the Planned row becomes a one-line Shipped
  pointer. Detail is never stored in two places at once.

## 4. Behaviour (exact)
### 4.1 `ai/lab/ROADMAP.md` structure (top to bottom)
1. License header + `# Feature roadmap — ai-fication-kit`.
2. Intro blockquote: what the file is; cousin of `ai/lab/WORKLOG.md`; the
   model-tiering rationale link; the planned→shipped lifecycle in two sentences.
3. `## How to use this file (the linking protocol)` — merge the two old
   "instructions for the implementing agent" sections into one numbered protocol,
   and state the cross-link rule: on ship, flip the row to Shipped, migrate detail
   to `SPEC_<id>.md`, append a WORKLOG row that cites the feature ID.
4. `## Shared engineering contract (applies to every feature)` — migrated verbatim
   from the old shipped file; both sections reference it.
5. `## Planned` → `### Tracking table` (columns: `ID | Feature | Priority |
   Effort | Depends on | Spec | Status`), then `### How each feature helps the end
   user`, then `### Detailed specifications` (C1–C8 verbatim), then
   `### Sequencing and dependency notes`, then
   `### Deliberately NOT on this roadmap (and why)`.
6. `## Shipped` → `### Tracking table` (columns: `ID | Feature | Spec | WORKLOG |
   PR | Shipped`). Wave-2 rows link their existing `ai/lab/specs/SPEC_*.md`; the
   WORKLOG cell is `—` (predates the ledger); PR/date from the old table. A4 is a
   note: superseded by planned C4.

### 4.2 Link re-pointing (relative paths from `ai/lab/ROADMAP.md`)
- old `lessons-learnt/<f>` → `../../docs/dev/lessons-learnt/<f>`.
- old `upcoming-features.md` self-references → intra-document ("the Shipped
  section below" / "the Shared engineering contract above").

### 4.3 The relocated narrative
New file `docs/dev/lessons-learnt/feature-planning-personas-and-simulation.md`
holds the personas table (P1–P4 + the "fifth user" note), the 2026-07-04
simulation-evidence table (F1–F8) and fixture recipes, verbatim, with a one-line
pointer that these seed the Planned features in `ai/lab/ROADMAP.md`. The
`drift-blindspots` link inside F5 becomes a sibling link (`./drift-...md`).

### 4.4 Inbound link repairs
- `docs/README.md` "Maintain" row → point to `../ai/lab/ROADMAP.md` with an
  updated description (now the roadmap, not "upcoming-features").
- `docs/dev/lessons-learnt/model-tiering-plan-heavy-implement-light.md`: the
  markdown link (§Context) → `../../../ai/lab/ROADMAP.md`; the prose mention
  (§2) → `` `ai/lab/ROADMAP.md` ``.
- `CHANGELOG.md:147` — **leave as-is** (historical record of the v0.2.0 release).

### 4.5 Registration
- `ai/INDEX.md`: add a manifest row `| Feature roadmap | ai/lab/ROADMAP.md |
  maintainer (+ AI drafts) | when planning / picking the next feature |`.
- `CLAUDE.md` "Where to look" list and `AGENTS.md` knowledge map: one pointer
  line each to `ai/lab/ROADMAP.md`.

## 5. Touch list (complete — nothing else changes)
| Layer | Location | Stability (from MODULE_MAP) | Change |
|---|---|---|---|
| knowledge | `ai/lab/ROADMAP.md` | ours (new) | add |
| knowledge | `ai/lab/specs/SPEC_feature-lifecycle-tracking.md` | ours (new) | add (this file) |
| docs | `docs/dev/lessons-learnt/feature-planning-personas-and-simulation.md` | ours (new) | add |
| config | `CLAUDE.md` | ours | modify (one pointer line) |
| config | `AGENTS.md` | ours | modify (one pointer line) |
| manifest | `ai/INDEX.md` | ours | modify (one row) |
| docs | `docs/README.md` | ours | modify (one link + description) |
| docs | `docs/dev/lessons-learnt/model-tiering-plan-heavy-implement-light.md` | ours | modify (two link repairs) |
| ledger | `ai/lab/WORKLOG.md` | ours | modify (append W-012) |
| delete | `docs/dev/features-upcoming-implemented/` (2 files + folder) | ours | remove |

Stability check: no `frozen` or `?` files touched — all targets are `ours`/docs.

## 6. Test plan
Harness: no automated tests added (docs move). Manual/CLI verification:
| # | Test | Assertion |
|---|---|---|
| T1 | `node install.mjs verify . --strict` | exits 0; every W-012 backticked path resolves |
| T2 | grep the repo for `upcoming-features` / `upcoming-feature-plan` | only the historical `CHANGELOG.md:147` mention remains |
| T3 | resolve every relative link inside `ai/lab/ROADMAP.md` and the new lessons file | all resolve to existing files |
| T4 | `docs/dev/lessons-learnt/` and `docs/dev/general-prompts/` still present | unchanged |

## 7. Acceptance criteria (definition of done)
1. All §2 constraints hold; the diff matches §5 exactly.
2. T1 green (`verify --strict` passes).
3. `ROADMAP.md` contains the full C1–C8 detailed specs and the shared engineering
   contract verbatim; the Shipped table links every wave-2 feature's existing
   spec; no content from the two old files is lost (T2/T3).

## 8. Knowledge update on completion
- [ ] FEATURE_MAP.md entry — N/A (no feature/code surface changed)
- [ ] FEATURE_CATALOG.md — N/A
- [ ] MODULE_MAP.md rows still accurate (docs-only move; new `ai/lab/ROADMAP.md`
      is `[inferred]`, human to place a row if the map tracks lab files)
- [ ] WORKLOG.md row W-012 appended linking this spec
- [ ] This spec's Status → `implemented` (the human flips it after audit)
