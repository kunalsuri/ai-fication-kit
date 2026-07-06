<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Full-stack real-repo simulation — findings report (2026-07-06)  `[inferred]`

**What was run:** the kit's entire methodology, end-to-end, against a real polyglot
repo — a fresh clone of `fastapi/full-stack-fastapi-template` (React 19 + TypeScript
+ Vite + TanStack frontend; FastAPI + SQLModel + Alembic + PostgreSQL backend; uv +
bun workspaces; Docker Compose; also a Copier template). Pipeline exercised:
`shazam --yes --analysis-level indepth` → `/cold-start` (with `repo-explorer`
delegation) → simulated human audit → `verify --strict` / `drift --suggest` /
`status` / `check-repo-maturity` → `/add-feature` with a full spec
(`SPEC_F1-app-version`: new `GET /api/v1/utils/version/` endpoint, client
regeneration, sidebar version display, pytest + tsc verification) → fresh-context
`/review-change` → ROADMAP/WORKLOG bookkeeping. The target repo lived in a session
scratchpad; nothing was pushed anywhere. Companion of the 2026-07-05 `debug-js/debug`
simulation (W-018), which this run extends to a two-language, two-package-manager,
monorepo-shaped target.

**Overall:** the methodology held — the spec→implement→verify→review→record loop
completed, `verify --strict` caught a real hallucinated path during cold-start
drafting, `drift`/`status` verdicts were coherent, and the feature shipped with a
surgical 10-file diff. The deterministic *detection* layer (orient/indepth/maturity)
is where this target broke things: every finding below was observed, not guessed.

---

## Findings (severity-ranked)

### F1 — HIGH · orient's build/test commands are wrong for polyglot/monorepo targets, and they propagate into 4 stamped files
`lib/orient.mjs` maps root markers to fixed commands (package.json → `npm install
&& npm run build` / `npm test`; pyproject.toml → `pip install -e .` / `pytest`) and
chains them. For this target that produced Build `npm install && pip install -e .`,
Test `npm test && pytest` — all four claims false: the repo uses **bun** (root
`bun.lock`, bun workspace) and **uv** (`uv.lock`, `[tool.uv.workspace]`); `npm test`
resolves to Playwright E2E needing a *running Docker stack*; bare `pytest` needs
Python ≥3.14 + Postgres. The wrong commands were stamped into the target's
`CLAUDE.md`, `AGENTS.md`, `ai/guide/PROJECT_OVERVIEW.md`, and
`ai/guide/CONVENTIONS.md` (Definition of done). An agent that trusts "deterministic"
output runs the wrong toolchain on every session.
*Suggestions:* detect `bun.lock`/`bun.lockb` and `uv.lock` as first-class markers
(bun/uv now common); when >1 build system is found, emit per-component commands
(marker path → command) instead of a `&&` chain; scan one level down for workspace
members (root `package.json` `workspaces`, `[tool.uv.workspace]`).

### F2 — HIGH · stamped MODULE_MAP template is 4-column, but the kit's parser and its own dogfooded map are 5-column — fresh cold-starts report "0 [inferred]"
`templates/ai/guide/MODULE_MAP.md.tmpl:19` stamps
`| Directory | Responsibility (one line) | Entry point | Stability |` (no Status
column), and `/cold-start` says only "Tag EVERYTHING you write `[inferred]`" — so a
faithful agent puts the tag in the Responsibility cell. But `parseModuleMap`
(`lib/drift.mjs:87-89`) reads provenance **from the last cell only**, and the kit's
own `ai/guide/MODULE_MAP.md` uses 5 columns (`… | Stability (guess) | Status |`).
Observed result on the target: `status` reported "18 unaudited, 0 [inferred]" for a
fully drafted map; counters (and the doctor/status logic built on them) are
meaningless until someone hand-migrates the table. This is the same failure class
W-018's doctor fix addressed, one layer earlier.
*Suggestions:* add the `Status` column to the stamped template and show one worked
example row; state the exact expected row shape in `cold-start.md` step 2.

### F3 — MEDIUM · orient finds no test dirs on split-stack repos; `testDirs: []` persists in the "trusted" profile
`lib/orient.mjs` checks `TEST_DIR_CANDIDATES` at the repo root only; the target's
`backend/tests` and `frontend/tests` were invisible (`testDirs: []` in
`ai/repo-profile.json`). CLAUDE.md tells agents to trust `ai/repo-profile.json` as
deterministic fact; the cold-start pass corrected the guide docs, but the JSON stays
wrong forever (nothing in the flow re-runs or annotates orient output).
*Suggestion:* also probe `<component>/tests|test|__tests__` one level down, and/or
have `/cold-start` explicitly instructed to re-run `orient` or record corrections in
a designated overrides block.

### F4 — MEDIUM · indepth analysis counted 0 dependencies on a repo with ~70; description scraped as a README bullet
`ai/repo-indepth.json` reported `dependencies.total: 0` — it reads only the root
manifest, missing `frontend/package.json` (~50 deps) and `backend/pyproject.toml`
(~20). Architecture inference found a single "routes" layer. Separately, orient's
`description` field captured the literal first README bullet
(`- ⚡ [**FastAPI**](https://fastapi.tiangolo.com) for the Python backend API.`),
which was then stamped verbatim as the opening line of the target's `CLAUDE.md` and
`PROJECT_OVERVIEW.md` — markdown crumbs where a one-line summary belongs.
*Suggestions:* walk workspace members for dependency counts; strip list markers /
links when harvesting a description, or take the README's first *paragraph*.

### F5 — MEDIUM · maturity check misses modern lockfiles and nested source dirs
`lib/maturity.mjs:145-148` knows `bun.lockb` (obsolete binary format) but not
`bun.lock` (text format, default since bun 1.2), and does not know `uv.lock` at all →
"✗ Dependencies — No lock files" on a repo with two lockfiles. "✗ Code Structure — No
standard dirs" fired despite `frontend/src` and `backend/app` (top-level-only scan).
Post-install, `check-repo-maturity` still prints "→ Process 1 will run: 1. Create
ai/ knowledge layer from templates" even though `ai/` already exists — stale next
steps. Also: the target shipped its own `.claude/skills/` and `.agents/` from
upstream; orient's `existingAIConfig` noted `claudeDir: true` but `otherTools: []`,
and the Process model (which keys off CLAUDE/AGENTS **files**) classified it Process
1 — prior AI config living under `.claude/`/`.agents/` dirs is invisible to the
backup/extraction path.
*Suggestions:* add `bun.lock` + `uv.lock`; scan workspace members for src dirs; make
the "will run" panel state-aware; treat a non-kit `.claude`/`.agents` tree as prior
config worth flagging.

### F6 — MEDIUM · cold-start must fix stamped commands but no step owns it; collides with the no-churn rule
`cold-start.md` step 0 says "VERIFY its build/test commands … before writing them
anywhere as confirmed", but steps 1–5 only write `ai/guide/` files. The wrong
commands sit in `CLAUDE.md`/`AGENTS.md`, whose edit is discouraged by the "No
Phantom Bugs & Configuration Churn" hard rule. A rule-abiding agent leaves the
stamped lies in place. In the simulation the fix was made surgically (2 lines in
each) and flagged `[inferred]` — but that was a judgement call the command should
make explicit.
*Suggestion:* add a cold-start step: "if verified commands differ from the stamped
Build/Test lines, correct exactly those lines in `CLAUDE.md` + `AGENTS.md`, tagged
`[inferred]`" (and name this the sanctioned exception to the churn rule).

### F7 — MEDIUM · the Verify step has no vocabulary for environment-blocked tests
The target's only backend harness needs Docker (or Python 3.14 + Postgres); the
sandbox had a Docker CLI but no daemon, and the proxy 403-blocked uv's
python-build-standalone download from GitHub releases. T1/T2 of the spec were
written but could not execute; the frontend side (tsc, biome) and an equivalent
TestClient smoke run (Python 3.11 venv + temporary compat shims, restored after)
did pass. add-feature's contract says "Failing or unrun tests ⇒ not done" — correct
as policy, but WORKLOG/review templates offer no honest state for "implemented,
verification blocked by environment, needs CI/human run". The simulation had to
invent a `BLOCKED-ENV` annotation in the spec §7 and review.
*Suggestion:* bless a `blocked-env` verification state in the review template +
WORKLOG status vocabulary, requiring the blocker and the compensating evidence to be
named.

### F8 — LOW · verify false-positives on backticked non-path tokens containing slashes
`verify --strict` flagged `@hey-api/openapi-ts` (npm package), 
`fastapi/full-stack-fastapi-template` (GitHub slug), and doc-relative fragments
(`src/`, `build/`, `_layout/`) as missing paths — 8 false positives, 0 true ones on
first run. W-018/W-019 added a bare-filename allow-list, but slash-bearing non-paths
still trip it. The workaround (reword the docs) worked but trains agents to avoid
backticks, weakening the checkable-claims convention.
*Suggestions:* skip `@scope/name` tokens; optionally resolve fragments relative to
paths mentioned earlier in the same row/section before declaring them missing; allow
inline `verify-ignore` spans outside ROADMAP.

### F9 — LOW · stamped rules assert conventions the target doesn't have (license headers)
Target AGENTS.md rule 4 ("Match license headers on every new source file") and
SPEC_TEMPLATE constraint C3 assume a header convention; this repo has none (MIT,
headerless sources). A literal-minded implementer would add headers upstream would
reject. The simulation's spec overrode C3 explicitly.
*Suggestion:* stamp the rule conditionally from an orient signal (headers seen in
sampled sources?) or phrase it as "match neighboring files' header practice —
including having none".

### F10 — LOW · small template inconsistencies
(a) ROADMAP protocol text says WORKLOG row IDs look like `W-1`; WORKLOG template
says real rows start at `W-001`. (b) The Stability legend has no value for
*generated* code: `frozen` means "hands off", but `frontend/src/client` must change
on every API change — via regeneration only. The simulation's spec §5 had to invent
a "frozen — regeneration only, standing exception" wording. Suggest a `generated`
stability value (or a documented frozen-exception idiom) in the legend and
AUDIT-GUIDE.

## What worked (evidence the method carries its weight)
- `verify --strict` caught a genuinely hallucinated path during cold-start drafting
  (`backend/tests/api/routes/test_utils.py` cited before it existed) — precisely the
  failure mode it exists for; after doc fixes: 162/162 claims confirmed.
- `drift` on the drafted 18-row map: 0 unmapped / 0 vanished — the map covered the
  real tree on first pass.
- `status` verdict stayed NEEDS AUDIT with all rows `[inferred]` — correct refusal
  to trust an unaudited map (once F2's format issue was hand-fixed).
- The spec template's §5 touch list + §2 constraints produced a 10-file surgical
  diff that matched the plan exactly; the seam gotcha recorded in cold-start
  (SDK names derive from `custom_generate_unique_id`) directly shaped a correct
  contractual naming decision in §4.2.
- `repo-explorer` delegation kept the main context lean while producing an accurate
  module inventory (verified against the tree during audit).
- Fresh-context `/review-change` ran against the spec + diff and produced
  `ai/lab/reviews/REVIEW_W-001.md` in the target — verdict **request-changes**
  with two real, evidence-based majors the implementer had missed at commit time
  (WORKLOG row absent at the reviewed commit; a FEATURE_MAP claim written as a
  pytest selector `path::test` broke `verify --strict`). Both were one-line fixes;
  after the follow-up commit the target verified 172/172. The review layer earned
  its keep. (Adjacent template note for F8: pytest's `file::test` selector is a
  natural idiom agents will backtick — worth either supporting or calling out in
  the WORKLOG/FEATURE_MAP guidance.)

## Simulation artifacts
Target-repo working tree (scratchpad, not pushed): 3 commits — install+cold-start
drafts; audit-phase fixes; `feat(F1)` implementation. Feature artifacts inside the
target: `ai/lab/specs/SPEC_F1-app-version.md`, `ai/lab/reviews/REVIEW_W-001.md`,
WORKLOG row W-001, ROADMAP F1 row (Planned → Shipped).
