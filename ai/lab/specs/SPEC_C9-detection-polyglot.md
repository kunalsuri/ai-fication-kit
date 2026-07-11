<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: C9 — Detection-layer robustness on polyglot / monorepo targets
> **Status:** approved — implementation complete, human audit of the diff still
> pending (2026-07-11, via chat — one correction from the spec-audit
> subagent's report folded into Revision 2: §5 touch list now lists
> `docs/CLI-REFERENCE.md` as a conditional row, matching §8's conditional
> knowledge-update item; see `ai/lab/WORKLOG.md` row W-039)
> **Author:** AI draft (from `ai/analysis/audit-reports/2026-07-06-fullstack-simulation-report.md` findings F1, F3, F4, F5, F8) · **Date:** 2026-07-06 · **Revision:** 2

This spec is written to be implemented **without further design decisions** (consume
via `/implement-spec`). Read the whole spec before writing code. Design rationale
lives in `ai/analysis/audit-reports/2026-07-06-fullstack-simulation-report.md`;
read it once, then implement from *this* document. Every observed defect below was
reproduced against a clone of fastapi/full-stack-fastapi-template (bun + uv
workspaces, frontend/ + backend/ split).

## 1. Goal
`orient`, `indepth`, `check-repo-maturity`, and `verify` stop producing false facts
on repos that use bun or uv, keep manifests in workspace members instead of the
root, or backtick non-path tokens. Invariants: all four commands stay
zero-dependency (Node stdlib only), deterministic, and read-only toward the target
(except their own report files); existing single-stack behavior is byte-identical
where no new marker fires.

## 2. Hard constraints (violating any of these fails the review)
| # | Constraint |
|---|---|
| C1 | Zero new dependencies; Node stdlib only (`node:fs`, `node:path`). |
| C2 | No behavior change for repos where none of the new markers/dirs exist — existing tests must pass unmodified except where this spec says to extend them. |
| C3 | Copyright header on every touched `.mjs` file stays intact (do not move or reformat it). |
| C4 | Surgical diffs: touch only the files in §5; no reformatting of untouched code. |
| C5 | Every work package lands with its §6 regression test in the same commit. |

## 3. Scope & glossary
**In:** W1–W6 below. **Out (explicitly — do NOT build now):** full monorepo
per-package profiles (ROADMAP C4's later slices); GitHub-slug detection in verify
(owner/repo is indistinguishable from a real path without network); re-stamping
already-installed repos; any TOML parser beyond the minimal regex in W4.

- **workspace member** — a first-level subdirectory of the target that contains its
  own build manifest. Pitfall: scan exactly ONE level down; never recurse further.
- **marker table** — the `DETECTORS`-style array at the top of `lib/orient.mjs`
  (entries `{ marker, language, buildSystem, build, test }`, ~lines 15–35).

## 4. Behaviour (exact)

### W1 — orient: bun + uv lockfile awareness (finding F1)
<!-- verify-ignore:start — names lockfiles that do not exist in this repo -->
In `lib/orient.mjs`:
1. Line ~104 currently reads
   `const hasBun = await isFile(path.join(targetAbs, "bun.lockb"));`
   Change it to detect either format:
   `const hasBun = (await isFile(path.join(targetAbs, "bun.lockb"))) || (await isFile(path.join(targetAbs, "bun.lock")));`
2. Next to `hasPoetry` / `hasPipenv` add
   `const hasUv = await isFile(path.join(targetAbs, "uv.lock"));`
3. In the `pyproject.toml || requirements.txt` branch (~line 130), add a first
   condition BEFORE the poetry check, same shape as the existing ones:
   ```js
   if (hasUv) {
     d.buildSystem = "uv";
     d.build = "uv sync";
     d.test = "uv run pytest";
   } else if (hasPoetry) { …unchanged… }
   ```
   (uv wins over poetry when both lockfiles exist — uv.lock is the stronger signal
   of the active tool.)
<!-- verify-ignore:end -->

### W2 — orient: workspace-member manifests and test dirs (findings F1, F3)
In `lib/orient.mjs`:
1. After the root marker scan builds `found`, add a one-level member scan:
   read the target's entries with `fs.readdir(targetAbs, { withFileTypes: true })`,
   keep directories whose name is not in the skip set
   `new Set([".git", "node_modules", "ai", "dist", "build", "vendor", ".venv", "venv", "__pycache__"])`
   and does not start with `.`, and for each, check the same marker table against
   `path.join(targetAbs, member, marker)`. A member hit appends a detector clone
   with a new field `dir: member` (root hits have `dir: ""`). The lockfile flags of
   W1 must also be probed per-member (root flag OR member flag).
2. Command composition (~lines 180–181): when every detector for a build system
   came from the same non-root `dir`, prefix its commands with `cd <dir> && `.
   Keep the existing `join("  &&  ")` chaining and the existing
   "Multiple build systems detected" note unchanged.
3. Test dirs (~lines 157–160): after the existing root loop over
   `TEST_DIR_CANDIDATES`, run the same candidates inside each member directory
   found in step 1 and push hits as `member + "/" + t + "/"` (e.g.
   `backend/tests/`, `frontend/tests/`).

### W3 — orient: README description harvesting (finding F4b)
In `detectDescription()` (`lib/orient.mjs` ~lines 56–70): the current line filter
skips headings/badges/HTML but accepts markdown list items, so the target got the
literal bullet `- ⚡ [**FastAPI**](…) for the Python backend API.` stamped into
CLAUDE.md. Change the inner loop:
1. First pass (unchanged filters) additionally skips list items:
   `if (/^[-*+]\s/.test(line)) continue;`
2. If the first pass found nothing, run a second pass that accepts the first list
   item ≥10 chars but normalizes it: strip the leading `/^[-*+]\s+/`, convert
   `[text](url)` → `text` (`replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")`), and strip
   `**`/`*`/`` ` `` emphasis markers. Length cap (160/157+"...") applies after
   normalization, same as today.

### W4 — indepth: dependencies across workspace members (finding F4a)
In `lib/indepth.mjs` `detectDependencies()` (~line 132):
1. Collect manifest paths instead of assuming the root: the root `package.json`
   PLUS every workspace member's `package.json` (reuse the W2 member scan — factor
   it into a small exported helper `listWorkspaceMembers(targetAbs)` in
   `lib/util.mjs` so orient and indepth share it; same skip set, one level only).
   Run the existing dependencies/devDependencies/optionalDependencies counting per
   manifest, summing into the same `result` object.
2. Python: for the root and each member, if `pyproject.toml` exists, count entries
   with two regexes — the `dependencies = [ … ]` array inside `[project]` (count
   quoted strings) as `production`, and every quoted string inside a
   `[dependency-groups]` or `[project.optional-dependencies]` section as
   `development`. Push each as `{ name: <string up to first ><=~! or [>, version: <rest or "">, category }`
   into `topLevelDeps`. Accepted imprecision: multi-line arrays are handled by a
   `[\s\S]*?` non-greedy match from the key to the closing `]`; anything the regex
   misses is simply not counted (never throw).
3. `result.direct = result.topLevelDeps.length; result.total = result.direct;`
   (transitive stays 0 — unchanged semantics).

### W5 — maturity: modern lockfiles, nested src dirs, state-aware panel (finding F5)
<!-- verify-ignore:start — names lockfiles that do not exist in this repo -->
In `lib/maturity.mjs`:
1. `checkDependencyLocks` (~lines 145–148): add `"bun.lock"` and `"uv.lock"` to the
   `locks` array (keep `bun.lockb`).
2. `checkCodeStructure` (~line 157): after the root `codeDirs` loop, scan workspace
   members (the shared `listWorkspaceMembers` helper from W4) and push hits as
   `member + "/" + d + "/"` (e.g. `frontend/src/`, `backend/app/`).
3. The "→ Process N will run:" panel (~lines 391–401 in the print function): when
   the target already has an `ai/` directory containing `repo-profile.json`, print
   `→ ai/ layer already installed — next: /cold-start (if the map is empty) or the human audit`
   instead of either Process block. Detection: `isFile(path.join(targetAbs, "ai", "repo-profile.json"))`.
<!-- verify-ignore:end -->

### W6 — verify: scoped-package and pytest-selector tokens (finding F8)
In `lib/verify.mjs` `extractClaims()` (~line 60):
1. After the existing URL/flag/absolute-path skip
   (`if (/^(https?:|--|-|\/|~)/.test(s)) continue;`) add:
   `if (/^@[\w.-]+\//.test(s)) continue; // npm scoped package, not a path`
2. On the normalization line that already strips `:\d+` line suffixes, also strip
   pytest selectors: extend to `.replace(/::[^\s`]*$/, "")` applied BEFORE the
   `:\d+` strip. Effect: `` `backend/tests/test_x.py::test_y` `` verifies the file
   path `backend/tests/test_x.py`.

## 5. Touch list (complete — nothing else changes)
| Layer | Location | Stability (from MODULE_MAP) | Change |
|---|---|---|---|
| lib | `lib/orient.mjs` | ours | modify (W1, W2, W3) |
| lib | `lib/indepth.mjs` | ours | modify (W4) |
| lib | `lib/util.mjs` | ours | modify (add `listWorkspaceMembers`) |
| lib | `lib/maturity.mjs` | ours | modify (W5) |
| lib | `lib/verify.mjs` | ours | modify (W6) |
| tests | `test/run-tests.mjs` | ours | modify (T1–T8) |
| docs | `docs/CLI-REFERENCE.md` | ours | modify, conditional — only if its current orient/maturity text contradicts the new member-scanning behavior (§8) |
| docs | `ai/lab/ROADMAP.md`, `ai/lab/WORKLOG.md` | — | knowledge update |

Stability check: no `frozen` or `?` files touched.

## 6. Test plan (numbered — the implementer implements every row)
Harness: `test/run-tests.mjs` (`makeBareFixture` + `ok()` style; see the existing
"— doctor —" section for the idiom). All fixtures are new; name them as given.
<!-- verify-ignore:start — fixture file names, not current-tree claims -->
| # | Test | Assertion |
|---|---|---|
| T1 | orient-bun-text-lock | fixture with package.json + bun.lock (text) → profile `buildCmd` starts with `bun install`, buildSystems includes `Bun`. |
| T2 | orient-uv | fixture with pyproject.toml + uv.lock → `buildCmd` is `uv sync`, `testCmd` is `uv run pytest`. |
| T3 | orient-workspace | fixture with root package.json (no test script), `frontend/package.json`, `backend/pyproject.toml` + `backend/uv.lock`, dirs `frontend/tests/` and `backend/tests/` → `testDirs` contains both `frontend/tests/` and `backend/tests/`; buildCmd contains a `cd backend && uv sync` segment. |
| T4 | orient-description-bullet | fixture whose README.md first content line is `- ⚡ [**FastAPI**](https://x) for the backend.` → description equals `⚡ FastAPI for the backend.` (no `-`, no link syntax, no `**`). |
| T5 | indepth-workspace-deps | fixture of T3 shape with 2 deps in frontend/package.json and a pyproject `dependencies = ["fastapi>=0.1", "sqlmodel"]` → `dependencies.total === 4`. |
| T6 | maturity-modern-locks | fixture with bun.lock + uv.lock → dependencyLocks.exists true, files lists both. |
| T7 | maturity-installed-panel | fixture with ai/repo-profile.json present → printed report contains `already installed` and does NOT contain `Process 1 will run`. |
| T8 | verify-scoped-and-selector | doc fixture containing `` `@scope/pkg` `` and `` `src/a.py::test_b` `` with `src/a.py` on disk → verify reports 0 missing (scoped token skipped; selector resolves to the file). |
<!-- verify-ignore:end -->

## 7. Acceptance criteria (definition of done)
1. All §2 constraints hold; the diff matches §5 exactly.
2. `node test/run-tests.mjs` fully green (pre-existing count + T1–T8, no skips);
   `node install.mjs verify . --strict` exits 0 on this repo.
3. Contract-critical observable: T3 — a split-stack fixture yields per-component
   commands and both nested test dirs; if T3 fails the change fails, regardless of
   the rest.

## 8. Knowledge update on completion (part of the change, not an afterthought)
- [ ] `ai/lab/ROADMAP.md` row C9 moved Planned → Shipped (cross-link spec + WORKLOG row)
- [ ] `ai/lab/WORKLOG.md` row appended linking this spec, the review, and the commits
- [ ] `docs/CLI-REFERENCE.md` orient/maturity sections: one line each on member scanning (only if their current text contradicts the new behavior)
- [ ] This spec's Status → `implemented` (the human flips it after audit)
