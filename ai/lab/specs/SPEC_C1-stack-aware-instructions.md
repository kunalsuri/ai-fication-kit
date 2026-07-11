<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: C1 — Stack-aware agent instructions (kill the `package.json` false positive)
> **Status:** approved — implementation complete, human audit of the diff still
> pending (2026-07-11, via chat — spec-audit subagent verdict: APPROVE WITH
> CHANGES, two minor clarifications folded in as Revision 2 below; see
> `ai/lab/WORKLOG.md` row W-040)
> **Author:** AI draft (from `ai/lab/ROADMAP.md` C1 Planned entry, evidence F2) · **Date:** 2026-07-11 · **Revision:** 2

This spec is written to be implemented **without further design decisions**.
Read the whole spec before writing code. Design rationale lives in
`ai/lab/ROADMAP.md`'s C1 entry (§"Detailed specifications"); read it once,
then implement from *this* document.

## 1. Goal
The stamped `CLAUDE.md` / `AGENTS.md` "No Phantom Bugs & Configuration Churn" rule
names `package.json` literally, on every stack, so a `verify --strict` run on a
freshly-stamped non-JS repo reports two missing claims the user never made — the
kit's own template failing its own check on day one. After this ships, the rule
names only the manifest file(s) that actually exist at the target root, on every
stack. Invariant: **never emit a backticked path that does not exist on disk at
stamp time** — that is the property `verify --strict` on a fresh install proves.

## 2. Hard constraints (violating any of these fails the review)
| # | Constraint |
|---|---|
| C1 | Zero new runtime dependencies; reuse existing `lib/orient.mjs` marker data — do not duplicate the marker filename list. |
| C2 | No behavior change for JS/TS-only repos: the stamped line must still name `package.json` exactly as today (byte-identical wording apart from the token substitution itself). |
| C3 | Match the license-header practice of neighboring files (including having none). |
| C4 | Surgical diffs: touch only the files in §5; no reformatting of untouched code. |
| C5 | Never touch the kit's own hand-maintained root `CLAUDE.md`/`AGENTS.md` (only `templates/CLAUDE.md.tmpl` / `templates/AGENTS.md.tmpl`, which are stamped into *other* repos). |

## 3. Scope & glossary
**In:** the `{{CONFIG_FILES}}` token, its resolver, and the two template line edits.
**Out (explicitly — do NOT build now):** re-stamping already-installed repos (the
next incremental `update`/`shazam` run already re-stamps changed template lines —
no new mechanism needed); any other stack-conditional template content; changing
`lib/orient.mjs` detection logic itself.

- **config files** — the manifest file(s) a build/test command in this repo reads
  (e.g. `package.json` for npm, `pyproject.toml` for a PEP 621 Python project).
  Pitfall: a repo can be polyglot (§4 "polyglot fixture") — list every manifest
  found, not just the first.
- **stamp time** — the moment `lib/installer.mjs`'s `install()` resolves
  `{{TOKEN}}` placeholders and writes the file to the target repo. Distinct from
  "the file is later edited by a human" — this spec only concerns what is written
  at that moment.

## 4. Behaviour (exact)

### 4.1 — Export the marker list from `lib/orient.mjs`
`lib/orient.mjs`'s `DETECTORS` array (module-scoped, ~line 12) already lists every
recognized manifest filename (`marker` field) with no filesystem access baked in.
Export it: `export const DETECTORS = [ … ];` (add `export` to the existing
declaration — no other change to the array). This is the single source of truth
`lib/installer.mjs` reuses in §4.2 instead of hand-duplicating the filename list
(Hard constraint C1).

### 4.2 — Resolve `{{CONFIG_FILES}}` in `lib/installer.mjs`
1. Import `DETECTORS` from `./orient.mjs` and `exists` (already imported from
   `./util.mjs`) at the top of `lib/installer.mjs`.
2. Add a new async function, placed directly above `placeholders()`:
   ```js
   // Which manifest file(s) actually exist at the target root right now —
   // resolved from orient's own marker table so this never drifts from what
   // orient itself recognizes. Backtick each hit so `verify` treats it as a
   // path claim; the whole point is that claim must always resolve.
   async function resolveConfigFiles(targetAbs) {
     const markers = [...new Set(DETECTORS.map(d => d.marker))];
     const found = [];
     for (const m of markers) {
       if (await exists(path.join(targetAbs, m))) found.push(m);
     }
     if (!found.length) return "the project's build manifests";
     return found.map(m => `\`${m}\``).join(", ");
   }
   ```
   `DETECTORS` markers are plain filenames (`package.json`, `pyproject.toml`,
   `requirements.txt`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `go.mod`,
   `Cargo.toml`, `Gemfile`, `composer.json`, `CMakeLists.txt`) — no globs, so a
   plain `exists()` check per marker is sufficient. The `*.sln/*.csproj` glob and
   bare-`Makefile` fallback detectors in `orient()` are deliberately NOT
   duplicated here (out of scope, §3) — a C#/.NET-only or Makefile-only repo
   falls back to the plain-text phrase, which is safe (no broken claim) even
   though slightly less specific; a future feature may extend this list.
3. `placeholders(profile)` becomes `async function placeholders(profile, targetAbs)`.
   Add one line building the vars object:
   `CONFIG_FILES: await resolveConfigFiles(targetAbs),`
4. The one call site (`lib/installer.mjs`, inside `install()`, currently
   `const vars = placeholders(profile);`) becomes
   `const vars = await placeholders(profile, targetAbs);` — `targetAbs` is
   already in scope there (it is `install()`'s first parameter).

### 4.3 — Template line edits
1. `templates/CLAUDE.md.tmpl`, the "No Phantom Bugs & Configuration Churn" line:
   replace the literal `` `package.json` `` with `{{CONFIG_FILES}}`. The rest of
   the sentence (including the C10-added cold-start exception clause) is
   unchanged.
2. `templates/AGENTS.md.tmpl`, rule 8 (same rule, numbered list form): same
   substitution — replace `` `package.json` `` with `{{CONFIG_FILES}}`.
3. Everywhere else in both templates `package.json` may appear (e.g. inside
   `{{BUILD_CMD}}` itself, which is data, not this rule's prose) is untouched —
   only the one literal backticked mention inside the No-Churn rule sentence.

## 5. Touch list (complete — nothing else changes)
| Layer | Location | Stability (from MODULE_MAP) | Change |
|---|---|---|---|
| lib | `lib/orient.mjs` | ours | modify (export `DETECTORS`, one word) |
| lib | `lib/installer.mjs` | ours | modify (§4.2) |
| templates | `templates/CLAUDE.md.tmpl`, `templates/AGENTS.md.tmpl` | ours | modify (§4.3) |
| tests | `test/run-tests.mjs` | ours | modify (T1–T4) |

Stability check: no `frozen` or `?` files touched.

## 6. Test plan (numbered — the implementer implements every row)
Harness: `test/run-tests.mjs` (`makeBareFixture` + `run()` + `ok()` idiom).
| # | Test | Assertion |
|---|---|---|
| T1 | Python-only fixture | `pyproject.toml` at root, no `package.json` → `shazam --yes` then `verify --strict` on that fixture exits 0 with `missing 0`. |
| T2 | JS fixture wording preserved | `package.json` at root → the stamped `CLAUDE.md`'s No-Churn line contains the literal backticked `` `package.json` `` (byte-level check of that line, not just "verify passes"). |
| T3 | Polyglot fixture | both `package.json` and `pom.xml` at root → the stamped line's `{{CONFIG_FILES}}` resolution contains both `` `package.json` `` and `` `pom.xml` ``. |
| T4 | No-marker fixture | empty repo (no recognized manifest) → the stamped line contains the plain-text phrase "the project's build manifests" and **not** a backticked token (so `verify` raises no claim). |

## 7. Acceptance criteria (definition of done)
1. All §2 constraints hold; the diff matches §5 exactly.
2. `node test/run-tests.mjs` fully green including T1–T4; `node install.mjs verify . --strict` passes on the kit's own repo (this feature does not touch the kit's own root `CLAUDE.md`/`AGENTS.md`, so this should already be a no-op check).
3. Contract-critical observable: T1 — a `verify --strict` run on a freshly-stamped Python-only repo must exit 0; if T1 fails, the F2 false-positive is not fixed and the change fails regardless of the rest.

## 8. Knowledge update on completion (part of the change, not an afterthought)
- [ ] `ai/lab/ROADMAP.md` row C1 moved Planned → Shipped (cross-link spec + WORKLOG row); its Planned detail block removed (spec becomes detail of record, per the linking protocol)
- [ ] `ai/lab/WORKLOG.md` row appended linking this spec, the review, and the commits
- [ ] This spec's Status → `implemented` (the human flips it after audit)
