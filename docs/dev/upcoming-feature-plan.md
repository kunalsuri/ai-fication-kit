<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Upcoming feature plan — wave 3 (targets v0.3.x)

> Product plan + implementation-ready specs for the kit's next release wave.
> Drafted 2026-07-04 by a heavy planning model acting as product manager, following
> the model-tiering pattern in
> [lessons-learnt/model-tiering-plan-heavy-implement-light.md](lessons-learnt/model-tiering-plan-heavy-implement-light.md):
> the expensive thinking (user research, journey simulation, trap-spotting) is done
> once here, so a lighter autonomous coding agent can implement each feature in a
> later session without re-deriving context. Triage and final say rest with the
> maintainer.
>
> Relationship to [upcoming-features.md](upcoming-features.md): that file was
> **wave 2** (A/B series — doctor, status, audit, demo, Cursor rules, …) and is
> fully shipped except A4 (monorepo), which was parked "until its own spec exists".
> This file is **wave 3** (C series). C4 below *is* that missing A4 spec, Phase 1.

---

## 1 · Product context: who uses this kit, and for what

The kit's promise: *give AI coding agents — and new human teammates — a compact,
human-verified map of a repository, so context is spent on the task, not on
rediscovery.* Every feature below is judged against the personas who hire the kit
for that job:

| # | Persona | Job they hire the kit for | What loses them |
|---|---|---|---|
| P1 | **Cautious tech lead** — owns a legacy/enterprise repo, evaluating AI adoption | Prove to themselves (and their team) that agent output can be *trusted* on this codebase | False alarms from the kit's own checks; claims of value with no numbers |
| P2 | **AI-curious beginner** — first agent, first "AI-native" repo | A guided, safe path from zero to a working map without jargon | Red ❌ they can't interpret; steps that silently depend on manual bookkeeping |
| P3 | **New teammate / onboarder** — joins a repo that already has a verified `ai/` layer | Read one thing and be productive on day one | Knowledge locked inside agent-session workflows; no shareable artifact |
| P4 | **Monorepo maintainer** — npm/pnpm workspaces, polyglot backend+frontend | A map that reflects the *packages*, not one flat root | `orient` seeing one npm project where there are twelve packages and a Java service |

A fifth "user" is the **coding agent itself**: features that make the mechanical
checks more honest (fewer blindspots, fewer false positives) directly improve every
agent session downstream.

## 2 · Simulation evidence (what was actually run, 2026-07-04)

All findings below were reproduced with the real CLI (kit v0.2.0, this commit) on
fixture repos — not hypothesized. Reproduction steps are exact.

| ID | Journey simulated | Finding | Feeds feature |
|---|---|---|---|
| F1 | `orient` on an npm-workspaces monorepo (`packages/api`, `packages/web`, plus `backend/pom.xml`) | Detected as a **single flat npm project**. Workspaces not listed, the Java backend invisible, `testCmd` left as `<fill in>` even though both packages define test scripts. Matches the FAQ's known limitation. | C4 |
| F2 | `shazam --yes` on a **Python** repo (`pyproject.toml`, `src/`, `tests/`), then `verify` | **Fails out of the box: 2 missing claims.** The stamped `CLAUDE.md:22` and `AGENTS.md:24` hard-code `package.json` in the "No Phantom Bugs" rule; a Python repo has none, so the very first `verify` a beginner runs reports broken claims they didn't cause. | C1 |
| F3 | `status` on the same freshly scaffolded repo (correct usage, nothing wrong yet) | Verdict **"DRIFTING"** in red, before `/cold-start` has even run. `doctor` correctly says "step 2 of 5", but `status` has no notion of journey stage — a brand-new user's first health check tells them their repo is rotting. | C2 |
| F4 | Cold-start rows added, one row flipped `[verified]`, code changed, then `drift --git --suggest` | Stale check **silently skipped**: "MODULE_MAP records no verified commit". The flagship staleness detection only works if a human hand-edits `Last verified: … @ commit <sha>` in an exact regex-matched format (`lib/drift.mjs:68`). The `audit` command does not stamp it. | C3 |
| F5 | New file added inside an already-mapped directory, then `drift` | Not flagged — `drift` maps at directory-segment level, so anything new inside a mapped dir is invisible. Already documented as a real incident in [lessons-learnt/drift-blindspots-and-automation-bias.md](lessons-learnt/drift-blindspots-and-automation-bias.md). | C5 |
| F6 | Value story: `examples/value-demo/measure.mjs` | Works — but only for the **bundled sample app**. A tech lead cannot produce the "map vs raw tree" context-savings number for *their own repo*, which is exactly the number they need to justify adoption internally. | C6 |
| F7 | This kit's own `ai/INDEX.md` footer | Reads "Installed by ai-fication-kit **0.1.0**" while the CLI is 0.2.0. Nothing ever tells a user their installed layer predates the current kit or that re-running `shazam` is a safe upgrade. | C7 |
| F8 | `demo`, `doctor`, `audit` (non-TTY refusal), maturity check | All behaved well — clear copy, correct stage detection, correct refusal. Wave 2 quality is good; wave 3 should build on it, not rework it. | — |

**Fixture recipes** (for regression tests): F1 = root `package.json` with
`"workspaces": ["packages/*"]`, two member packages with their own `package.json`
(+ test scripts), one `backend/pom.xml`. F2 = `pyproject.toml` + `src/app/views.py`
+ `tests/test_views.py`, git-initialized, then `shazam --yes`.

## 3 · The wave-3 features at a glance

Ordering principle: **first make the existing promises true** (C1–C3 fix moments
where a user following instructions perfectly still sees red), **then widen the
audience** (C4), **then deepen honesty and proof** (C5, C6), **then polish the
lifecycle** (C7, C8).

### Tracking table

<!-- The implementing agent updates ONE row per finished feature. Date format: YYYY-MM-DD. -->

| ID | Feature | Persona | Priority | Effort | Depends on | Status | Implemented | Added | Completed | Commit / PR |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 | Stack-aware agent instructions (kill the `package.json` false positive) | P2, P1 | P1 | S | — | idea | ☐ | 2026-07-04 | — | — |
| C2 | Stage-aware `status` verdict (no more "DRIFTING" on day one) | P2 | P1 | S | — | idea | ☐ | 2026-07-04 | — | — |
| C3 | `audit` stamps the verified-commit baseline (make `drift --git` actually fire) | P1, P2 | P1 | S–M | — | idea | ☐ | 2026-07-04 | — | — |
| C4 | Monorepo Phase 1 — workspace-aware `orient` (the parked A4, first slice) | P4 | P2 | M | — | idea | ☐ | 2026-07-04 | — | — |
| C5 | `drift --deep` — file-level coverage inside mapped directories | agent, P1 | P2 | M | — | idea | ☐ | 2026-07-04 | — | — |
| C6 | `value` — context-savings report for *your own* repo | P1 | P2 | M | — | idea | ☐ | 2026-07-04 | — | — |
| C7 | Kit-version awareness in `doctor`/`status` ("your layer is from 0.1.0 — upgrade is safe") | P2 | P3 | S | — | idea | ☐ | 2026-07-04 | — | — |
| C8 | `onboard` — export a single offline onboarding page for new teammates | P3 | P3 | M | C6 helpful | idea | ☐ | 2026-07-04 | — | — |

Status values: `idea` → `spec drafted` → `in progress` → `shipped` (or `dropped`).

### How each feature helps the end user (the one-breath version)

- **C1** — a Python/Java/Go beginner's first `verify` is green instead of reporting phantom breakage; trust in the tool survives minute one.
- **C2** — the first `status` says *where you are on the path*, not that your brand-new repo is "DRIFTING"; anxiety becomes orientation.
- **C3** — the moment a human verifies a row, staleness tracking arms itself; the kit's headline safety net stops depending on a hand-edited magic string nobody knows about.
- **C4** — monorepo users (the kit's core enterprise audience) see their packages, stacks, and test commands reflected instead of one flat wrong guess.
- **C5** — "green ≠ complete" gets fixed: new files inside mapped directories stop being invisible, closing the documented automation-bias trap.
- **C6** — the tech lead gets a reproducible, no-API-key number — "an agent reads 38 KB with the map vs 4.1 MB without" — to justify the audit investment to their team.
- **C7** — users learn their knowledge layer is out of date and that re-running `shazam` is a safe, incremental upgrade (today they'd never know).
- **C8** — the verified knowledge-base becomes a shareable, double-clickable onboarding page for humans who will never open an agent or a terminal.

## 4 · Instructions for the implementing agent

1. The human names **ONE feature ID**. Implement only that one. Do not start another.
2. The **Shared engineering contract** in [upcoming-features.md](upcoming-features.md)
   applies verbatim to every C feature — runtime (Node ≥ 18, ESM, **zero npm
   dependencies**), layout (`install.mjs` dispatch only, logic in `lib/<name>.mjs`),
   license headers, safety discipline (no execution, no network, no writes outside
   the target, `--dry-run` on every writing command), determinism (no LLM calls,
   ever), provenance (`[inferred]` only — the human's flip is sacred), report
   pattern (JSON manifest + MD report in `ai/analysis/audit-reports/`), manifest
   coverage for stamped files, tests in `test/run-tests.mjs`, docs riding along in
   the same commit. Re-read it before coding; it is not repeated here.
3. Read the feature's **Touchpoints** files *before* writing code; copy their style.
4. Draft a spec first: copy `ai/lab/specs/SPEC_TEMPLATE.md` to
   `ai/lab/specs/SPEC_<feature-id>.md`, fill it from the entry below, then implement
   via the `/add-feature` discipline (spec → surgical diff → tests → knowledge
   update → ledger row in `ai/lab/WORKLOG.md`).
5. **Definition of done** (run all, in the kit repo): `npm test` passes ·
   `node install.mjs verify . --strict` passes · command/flag appears in
   `docs/CLI-REFERENCE.md` index · CHANGELOG entry under `[Unreleased]` · tracking
   table row above updated.
6. If a spec conflicts with what you find in the code, **STOP and ask the human** —
   do not improvise around the conflict.

---

## 5 · Detailed specifications

### C1 · Stack-aware agent instructions — kill the `package.json` false positive

**Need (P2 beginner, P1 tech lead — evidence F2).** The stamped `CLAUDE.md` /
`AGENTS.md` "No Phantom Bugs & Configuration Churn" rule names `package.json`
literally, on every stack. On any non-JS repo, `verify` then reports two missing
claims the user never made. The kit's first impression on a Python shop is its own
check failing against its own template — the exact "false alarm" that loses P1.

**Behavior.**
- Add a `{{CONFIG_FILES}}` token to `templates/CLAUDE.md.tmpl` (line 22 area) and
  `templates/AGENTS.md.tmpl` (line 24 area), replacing the literal `` `package.json` ``.
- The stamping code resolves it deterministically from the orient profile's
  `buildSystems` / marker files, as a comma-separated list of the manifests that
  **actually exist at the target root** — e.g. `` `package.json` `` for npm,
  `` `pyproject.toml` `` for Python, `` `pom.xml` `` for Maven, several when polyglot.
  Fallback when nothing matched: the phrase `the project's build manifests` (plain
  text, no backticked path — so `verify` has no claim to check).
- Rule of thumb baked into the resolver: **never emit a backticked path that does
  not exist on disk at stamp time.** That is the invariant the test asserts.

**Touchpoints.** `templates/CLAUDE.md.tmpl`, `templates/AGENTS.md.tmpl`; the token
substitution table in `lib/installer.mjs` (find where `{{BUILD_CMD}}` /
`{{TEST_DIRS}}` are resolved and add `{{CONFIG_FILES}}` beside them — same
mechanism, no new machinery); `test/run-tests.mjs`.

**Acceptance.**
- New fixture: Python-only repo (F2 recipe) → `shazam --yes` → `verify --strict`
  exits 0 with zero missing claims.
- JS fixture keeps mentioning `package.json` (byte-level check of the stamped line).
- Polyglot fixture (npm + Maven markers) lists both manifests.
- The kit repo's own `CLAUDE.md`/`AGENTS.md` (hand-maintained, not stamped) are
  **not** touched by this feature.

**Out of scope.** Re-stamping existing installs (users get the fix on their next
incremental re-run — that path already exists); any other stack-conditional
template content.

---

### C2 · Stage-aware `status` verdict

**Need (P2 — evidence F3).** `status` renders one of three verdicts
(`lib/status.mjs:60-72`), and on a freshly scaffolded repo it picks the scariest.
`doctor` already knows the user is at "step 2 of 5"; `status` should not
contradict it. A health check that cries wolf on day one teaches users to ignore
it — fatal for a trust product.

**Behavior.**
- `computeStatus()` additionally calls `diagnose()` (exported by `lib/doctor.mjs:21`,
  already read-only) and includes the doctor stage in its result.
- Two new verdicts, checked **before** the existing three:
  - Stage 1 (no profile) → verdict `NOT INSTALLED` (grey/dim), message points to `shazam`.
  - Stage 2 (MODULE_MAP still template/placeholder) → verdict `NOT MAPPED YET`
    (blue/neutral), message points to `/cold-start`. Broken-claim and drift counts
    are still printed (honesty), but prefixed with one line: "expected at this
    stage — the map hasn't been drafted yet".
- Stages 3–5 keep today's DRIFTING / NEEDS AUDIT / TRUSTED logic **unchanged**.
- `--json` output and the shields.io `badge` object gain the new verdict strings
  (`not installed` → grey, `not mapped yet` → blue); schema version unchanged.
- `refreshProgressPage()` already consumes status data — confirm the START-HERE
  page renders the new verdicts without edits, or adjust its verdict→copy mapping.

**Touchpoints.** `lib/status.mjs` (verdict block + printer), `lib/doctor.mjs`
(import only, no changes), `lib/progress.mjs` (verdict mapping if needed),
`docs/CLI-REFERENCE.md` status section (verdict table), `test/run-tests.mjs`.

**Acceptance.** Fresh-scaffold fixture → `NOT MAPPED YET`, exit code unchanged;
no-kit fixture → `NOT INSTALLED`; a populated+broken fixture still says
`DRIFTING` byte-identically to today; existing status tests pass without edits
to their expectations for stages 3–5.

**Out of scope.** Changing exit codes; changing `doctor` itself; auto-fixing
anything.

---

### C3 · `audit` stamps the verified-commit baseline

**Need (P1, P2 — evidence F4).** `drift --git`'s stale detection — a headline
differentiator ("[verified] rows whose code changed since the audit") — never
fires unless someone hand-writes `Last verified: <date> @ commit <sha>` into
MODULE_MAP.md in the exact format `lib/drift.mjs:68` greps for. No doc tells them;
the `audit` command, whose whole job is doing the audit's drudgery, leaves the
line as the template placeholder. The safety net exists but ships unarmed.

**Behavior.**
- At the end of a successful `audit` run in which **at least one row was confirmed**
  `[verified]`, rewrite the MODULE_MAP header line
  `> Last verified: <fill in date> @ commit <fill in sha>` to
  `> Last verified: DD/MM/YYYY @ commit <sha>` (reuse `formatAuditTimestamp`'s date
  part for consistency).
- The sha is obtained **without executing git**, copying the sanctioned
  `lib/intake.mjs:72` pattern: read `.git/HEAD` as a file; if it is a ref, read
  `.git/<ref>`; if detached, HEAD already holds the sha. Any read failure (no
  `.git`, packed refs edge case, permissions) → skip the stamp, print one info
  line ("could not determine HEAD commit — stale tracking not armed; add the sha
  to the `Last verified:` line by hand"), exit successfully.
  - Packed-refs note: if `.git/<ref>` does not exist, also try scanning
    `.git/packed-refs` for the ref line (still a plain file read). If that too
    fails, fall back to the skip message.
- If the line already holds a real sha (regex from `lib/drift.mjs:68`), update it —
  a fresh audit moves the baseline forward. That is the correct semantic: staleness
  is measured against the *most recent* human audit.
- `--dry-run` prints the would-be line, writes nothing (matching audit's existing
  dry-run contract). The pre-write timestamped backup already taken by `audit`
  covers this edit too.
- Explicitly **not** gated behind `--git`: reading `.git/HEAD` as a plain file is
  the already-sanctioned intake pattern, not git execution. State this in the
  CLI-REFERENCE section and mirror the wording in `SECURITY.md`'s existing
  file-read paragraph.

**Touchpoints.** `lib/audit.mjs` (new `readHeadSha(targetAbs)` helper + call site in
`audit()` after `writeAuditedMap`); `lib/drift.mjs` (no change — its regex is the
contract; add a test that the stamped line matches it); `docs/AUDIT-GUIDE.md`
(one surgical sentence: the command now arms stale tracking); `docs/CLI-REFERENCE.md`;
`SECURITY.md`; `test/run-tests.mjs`.

**Acceptance.**
- Fixture with git dir + one confirmed row: header line carries today's date and
  the exact HEAD sha; a subsequent `drift --git` run performs the stale check
  (no "records no verified commit" note).
- Zero rows confirmed (all skipped) → header line untouched.
- No `.git` directory → audit completes, info line printed, header untouched.
- Detached-HEAD fixture (HEAD contains a raw sha) → correct sha stamped.
- `--dry-run` → file byte-identical.

**Out of scope.** Per-row commit baselines; running `git` binaries; touching the
line from any command other than `audit`.

---

### C4 · Monorepo Phase 1 — workspace-aware `orient` (A4, first slice)

**Need (P4 — evidence F1, FAQ "My repo is a monorepo").** Workspace repos are the
kit's *most* valuable targets (large, legacy, tribal knowledge) and today `orient`
reduces them to one wrong flat profile: members invisible, nested stacks (a
`backend/pom.xml`) invisible, `testCmd` empty despite every package defining one.
The FAQ documents workarounds; the product should remove the need for them.
Wave 2 parked this as A4 pending a spec — this is that spec, deliberately cut to
the deterministic Phase 1 (profile facts only) so a light model can ship it.

**Behavior.**
- `orient` detects workspace/monorepo shape by root markers, all read-only:
  `package.json` `workspaces` field (array or `{packages: []}` form),
  `pnpm-workspace.yaml` `packages:` list, `lerna.json`, `nx.json`, `turbo.json`
  (turbo/nx/lerna imply npm-style workspaces from `package.json`/pnpm files).
- Glob resolution: support the two forms that cover ~all real repos — literal paths
  and single-level `<dir>/*` globs (expand by readdir, keep only dirs containing a
  `package.json`). **No recursive `**` support in Phase 1** — record unresolvable
  patterns in `notes[]` instead of guessing.
- Additionally scan **one directory level deep** for non-JS build markers the root
  scan misses today (`pom.xml`, `build.gradle(.kts)`, `pyproject.toml`, `go.mod`,
  `Cargo.toml`, `*.csproj`) — bounded: first level only, `DRIFT_IGNORED_DIRS`
  (exported at `lib/drift.mjs:34`) skipped, stop enumerating a directory's entries
  beyond a fixed cap (e.g. 500) for pathological trees.
- New profile block (additive — existing consumers must not break):
  ```json
  "workspaces": {
    "detected": true,
    "tool": "npm|pnpm|lerna|nx|turbo",
    "members": [
      { "name": "@acme/api", "path": "packages/api", "language": "JavaScript/TypeScript",
        "testCmd": "npm test --workspace packages/api" }
    ],
    "nestedStacks": [ { "path": "backend", "marker": "pom.xml", "language": "Java" } ]
  }
  ```
  `testCmd` per member only when that member's `package.json` has a `test` script;
  the root-level `testCmd` fallback becomes the tool's canonical all-packages form
  (`npm test --workspaces`, `pnpm -r test`, `turbo run test`) when the root script
  is absent — replacing today's `<fill in>` (F1).
- `printProfile` gains a compact workspaces section (member count + first few
  names); the intake wizard's stack-confirmation step shows it (display only —
  no new questions in Phase 1).
- Language list gains languages found in `nestedStacks` (so the F1 fixture reports
  Java + JS/TS, not JS/TS alone).

**Touchpoints.** `lib/orient.mjs` (detection + profile block + printer — the file
is 209 lines; keep the addition proportionate), `lib/intake.mjs` (display only),
`docs/CLI-REFERENCE.md` orient section, `docs/FAQ.md` monorepo answer (rewrite the
"known limitation" paragraph to describe Phase 1 behavior + remaining limits),
`test/run-tests.mjs` (F1 fixture recipe from §2).

**Acceptance.**
- F1 fixture: `workspaces.detected === true`, both members listed with test
  commands, `nestedStacks` contains `backend`/`pom.xml`, languages include Java,
  root `testCmd` no longer `<fill in>`.
- pnpm fixture (`pnpm-workspace.yaml`): tool `pnpm`, members resolved.
- Non-monorepo fixtures: profile byte-identical except absent `workspaces` block
  (or `detected:false` — pick one, assert it); all existing orient tests pass
  unchanged.
- A `packages/*` glob whose dir contains a non-package folder: folder ignored, no
  crash. Unresolvable `apps/**/web` pattern → listed in `notes[]`, run succeeds.

**Out of scope (explicitly deferred to Phase 2/3, do not attempt).** Drift
treating members as mappable units; per-package MODULE_MAP sections or template
changes; workspace-aware `verify`; any wizard questions; Bazel/Gradle-composite
detection.

---

### C5 · `drift --deep` — file-level coverage inside mapped directories

**Need (agent, P1 — evidence F5 + the lessons-learnt incident).** `drift` maps at
directory-segment level: once `test/` has one row, *anything* added inside is
invisible, and the tool's green output actively feeds automation bias (the
documented incident: `test/run-deep-test.mjs` went unmapped while `/check-drift`
reported clean). The current mitigation is procedural (commands tell agents to run
`git status`); the mechanical check should carry its own weight.

**Behavior.**
- New opt-in flag `--deep` on `drift` (default behavior byte-identical without it —
  same discipline as `--suggest`).
- For each **mapped** MODULE_MAP row, enumerate source files (extensions already
  listed in `lib/drift.mjs`) directly inside that row's directory tree, bounded by
  `DRIFT_IGNORED_DIRS` and a per-row cap (e.g. 2000 files → report "capped").
- Report per row: file count, and the list of source files **newer than the
  verified baseline** — using the `Last verified @ commit` sha when available via
  the existing `--git` machinery, else falling back to files whose `mtime` is newer
  than the MODULE_MAP file's own `mtime` (pure fs, deterministic given a tree).
- Also verify each row's **Entry point** cell: if the quoted entry file no longer
  exists, flag it (today only `verify` would catch it, and only because the path
  appears in a doc).
- Output: new "Deep coverage" section in `DRIFT_REPORT.md` + `deep` array in
  `DRIFT_MANIFEST.json`. Exit-code behavior: findings are informational by default;
  under `--strict` a missing entry point fails (new-files-noise must NOT fail CI —
  that would train users to delete the flag).
- `--github-summary` includes a one-line deep summary when the flag was used.

**Touchpoints.** `lib/drift.mjs` only (+ flag parser in `install.mjs`,
`docs/CLI-REFERENCE.md`, CHANGELOG, `test/run-tests.mjs`). Reuse `parseModuleMap`
(`lib/drift.mjs:65`) and the existing report writers.

**Acceptance.** Fixture with a mapped dir + one new file since baseline: file
listed under that row; vanished entry point flagged; without `--deep` the report
is byte-identical to today; `--deep --strict` fails only on the vanished entry
point, not on new files; capped-directory fixture reports the cap instead of
hanging.

**Out of scope.** Suggesting row edits for new files (that's `--suggest`'s
territory and stays row-level); watching mode; any git execution beyond what
`--git` already does.

---

### C6 · `value` — context-savings report for your own repo

**Need (P1 — evidence F6).** The kit's core claim ("agents spend context on your
task instead of rediscovery") is demonstrated only on a bundled toy
(`examples/value-demo/`). The cautious tech lead needs that number for *their*
repo to defend the ~30-minute audit investment to their team and manager. This is
the adoption-unlocking feature: it turns the kit's promise into a reproducible,
no-API-key measurement.

**Behavior.**
- `node install.mjs value <path>` — read-only scan, deterministic, no LLM, no
  network (the measurement logic generalizes `examples/value-demo/measure.mjs`).
- Computes and prints one comparison:
  - **Without the map:** total bytes (and ~tokens at the same 4 bytes/token
    heuristic the value-demo documents) of all source files an agent would have to
    consider — source extensions from `lib/drift.mjs`, minus `DRIFT_IGNORED_DIRS`,
    minus `ai/`.
  - **With the map:** bytes/tokens of the session-load set: `CLAUDE.md` (or
    `AGENTS.md`), `ai/INDEX.md`, `ai/guide/*.md`.
  - Ratio + one honest headline: "an agent session starts by reading ~N KB instead
    of ~M MB (~X× less context) — *readable context, not live API spend*". The
    honesty qualifier is mandatory copy; overselling breaks P1 trust.
- Prints 2–3 caveat lines (task work still reads task files; numbers are estimates)
  — reuse the value-demo README's framing.
- Writes `ai/analysis/audit-reports/VALUE_REPORT.md` + `VALUE_MANIFEST.json`
  (standard pair). `--dry-run` prints without writing.
- `status` gains one optional line when a VALUE_REPORT exists ("context savings:
  ~X× — see VALUE_REPORT.md"); `refreshProgressPage()` shows the headline number
  on START-HERE.html. Both degrade silently when the report is absent.

**Touchpoints.** New `lib/value.mjs`; `install.mjs` dispatch; `lib/status.mjs`
(one optional line); `lib/progress.mjs`; `examples/value-demo/README.md` (one
pointer: "measure your own repo with `node install.mjs value <path>`");
`docs/CLI-REFERENCE.md`; `test/run-tests.mjs`.

**Acceptance.** On the kit's own repo: both totals nonzero, map-set total <
tree total, report pair written; on a repo without `ai/`: friendly message
("install first — there is no map to measure"), exit 0, nothing written; byte
totals stable across two runs on an unchanged tree; `--dry-run` writes nothing.

**Out of scope.** Live token counting against any API; per-task measurement
(value-demo keeps that role for the sample app); cost-in-dollars claims.

---

### C7 · Kit-version awareness in `doctor` and `status`

**Need (P2 — evidence F7).** `ai/INDEX.md` in installed repos records the
installing kit version (this very repo says 0.1.0 under a 0.2.0 CLI), and
`ai/repo-profile.json` carries `kitVersion` — but nothing ever surfaces the
mismatch or tells users the upgrade path (`shazam` re-run) is safe and
incremental. Users silently miss new commands, templates, and fixes (including
C1's fix).

**Behavior.**
- `doctor` and `status` compare the profile's `kitVersion` against the running
  CLI's `KIT_VERSION` (`lib/util.mjs`). On mismatch, print one line:
  "installed with kit <old>, this CLI is <new> — re-run `shazam` to upgrade
  (incremental: your edits and `[verified]` files are never overwritten)".
  Newer-profile-than-CLI (user runs an old checkout) → inverse message ("your CLI
  is older than the installed layer — update your kit checkout").
- Missing/unparsable `kitVersion` → silence (no nagging on hand-built layers).
- Comparison: split on dots, numeric compare, tolerate pre-release suffixes by
  comparing the numeric prefix only — ~10 lines in `lib/util.mjs`, exported,
  unit-tested. **No semver package** (zero-dependency rule).
- `STATUS.json` gains `kitVersion: { installed, cli, upgradeAvailable }`.

**Touchpoints.** `lib/util.mjs` (compare helper), `lib/doctor.mjs`,
`lib/status.mjs`, `docs/CLI-REFERENCE.md`, `test/run-tests.mjs`.

**Acceptance.** Fixture profile pinned to `0.1.0` → both commands print the
upgrade line; matching version → no line; garbage version string → no line, no
crash; JSON block present and correct in all three cases.

**Out of scope.** Auto-upgrading; any network version check (the comparison is
strictly local file vs local constant).

---

### C8 · `onboard` — export the verified knowledge-base as one offline page

**Need (P3 — the README's own promise).** The README sells "the fastest
onboarding doc a new teammate will ever read", but consuming `ai/` today means
cloning the repo and navigating eight markdown files — or running an agent. A new
teammate's manager wants to send **one file** in a welcome email. The kit already
proved the pattern with `ai/START-HERE.html` (offline, inlined, double-clickable);
this is the same trick pointed at humans-reading-the-map instead of
progress-tracking.

**Behavior.**
- `node install.mjs onboard <path>` → writes `ai/ONBOARDING.html` (manifest-tracked,
  uninstall-covered), a single self-contained page (zero external requests — same
  constraint and technique as `lib/progress.mjs`):
  - Header: project name/description from the profile, generation date, kit version.
  - Trust banner: `[verified]`/`[inferred]` counts (reuse `computeStatus`) and the
    plain-English provenance rule. **Inferred content is visibly watermarked** —
    each section rendered from a doc that still contains `[inferred]` tags gets a
    "not yet human-verified" badge. The export must never make unaudited guesses
    look official; that would counterfeit the product's core guarantee.
  - Body: `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, MODULE_MAP table (with
    Stability legend), `FEATURE_MAP.md`, `CONVENTIONS.md` — converted with a
    minimal internal markdown renderer (headings, tables, lists, code fences,
    links; links to repo files render as plain code, not hyperlinks — the page
    travels without the repo).
  - Footer: context-savings headline if C6's report exists.
- Re-running regenerates (content changes every run — reuse the installer's
  child-lock exemption pattern used for `START-HERE.html`). `--dry-run` supported.

**Touchpoints.** New `lib/onboard.mjs` (markdown mini-renderer lives here; keep it
~150 lines — tables, headings, lists, fences, inline code only); `install.mjs`;
`lib/installer.mjs` (manifest + child-lock exemption for the destination);
`ai/INDEX.md` template row (`templates/ai/INDEX.md.tmpl`); `docs/CLI-REFERENCE.md`;
`test/run-tests.mjs`.

**Acceptance.** Generated page: valid HTML, `grep -c "http"` shows no external
resource loads (anchor hrefs to https docs allowed, no `src=`/`link href=`),
renders MODULE_MAP rows and both provenance badges correctly on a mixed
verified/inferred fixture; absent guide docs → section shows "not yet drafted —
run /cold-start", command still exits 0; uninstall removes the page; regeneration
after a map edit reflects the edit.

**Out of scope.** PDF export; serving; theming options; rendering `ai/analysis/`
or `ai/lab/` content (guide docs only — the page is for day-one orientation, not
the full lab).

---

## 6 · Sequencing and dependency notes

- **Ship order: C1 → C2 → C3** (independent, all small, each removes a
  trust-breaking moment — together they make an honest v0.2.1 patch wave), then
  **C4** (the biggest audience unlock; isolated to `orient`), then **C5/C6** in
  either order, then **C7/C8**.
- C6 before C8 is preferred (the onboarding page footer consumes the value
  headline) but not required — C8 degrades silently without it.
- C2 and C7 both touch `lib/status.mjs`; if implemented in parallel sessions,
  rebase carefully — the verdict block and the version line are adjacent.
- One feature per branch, per session, per CHANGELOG bullet — same cadence that
  shipped wave 2 cleanly.

## 7 · Deliberately NOT on this roadmap (and why)

Recorded so future planning sessions don't re-litigate:

- **LLM calls inside the CLI** — the deterministic/no-LLM split is the product's
  identity; "smart" CLI features would dissolve the trust story.
- **Hosted dashboards / telemetry / network version checks** — "no network" is a
  hard security guarantee (SECURITY.md); C6/C8 get the same value locally.
- **Auto-verify / batch audit modes** — the human flip *is* the product. Anything
  that automates it counterfeits the `[verified]` tag (already "explicitly
  forbidden" in the A1 spec; reaffirmed).
- **VS Code / IDE extension** — wrong altitude for a pre-1.0 single-maintainer
  kit; the four stamped tool integrations already meet users inside their tools.
- **Monorepo Phases 2–3** (drift per member, per-package MODULE_MAP sections) —
  parked until Phase 1 ships and real workspace feedback exists; needs its own
  spec against the post-C4 codebase.
