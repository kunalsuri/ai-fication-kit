<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: C11 — `speclint`, the deterministic implementation-grade spec gate
> **Status:** draft
> **Author:** AI draft (heavy-model planning pass, branch claude/sonnet-5-spec-doc-3nf3xh) · **Date:** 2026-07-11 · **Revision:** 1

This spec is written to be implemented **without further design decisions**. The
intended implementer is a **Sonnet-class model running `/implement-spec`**
(protocol: `docs/IMPLEMENT-SPEC.md`) — every judgement call has been made here, in
this document. Read the whole spec before writing code. Where the implementer is
tempted to improvise, the spec says what to do instead; where the spec conflicts
with what you find in the code, **stop and report** (spec §, file:line, smallest
unblocking question) — never pick the "obvious interpretation". Design rationale
lives in `ai/lab/evaluations/2026-07-11-360-review-sdd-fit-and-directions.md` (§4,
recommendation R3) and `docs/IMPLEMENT-SPEC.md` (section "What makes a spec
implementation-grade"); read them once, then implement from *this* document.

## 1. Goal

After this ships, `node install.mjs speclint <repo> <spec>` mechanically answers
the question *"is this spec ready to hand to a light-model implementer?"* — in
seconds, with no LLM, by checking the spec against the implementation-grade bar
that `docs/IMPLEMENT-SPEC.md` states as prose today: status line present, all
eight template sections, a hard-constraints table, an explicit out-of-scope list,
a touch list whose Stability claims agree with `ai/guide/MODULE_MAP.md`, a
T-numbered test plan, numbered acceptance criteria, a knowledge-update checklist,
and no unresolved template placeholders. A spec that passes gates a
`/implement-spec` run; a spec that fails is sent back for hardening *before* a
light model burns a round-trip on the gap.

Invariants that must stay true afterward: the CLI stays deterministic (same input
⇒ same output), zero-dependency, and no-LLM; `speclint` is **read-only** (writes
nothing, anywhere); every existing command, flag, and exit code behaves exactly
as before.

## 2. Hard constraints (violating any of these fails the review)

| # | Constraint |
|---|---|
| C1 | Zero new runtime dependencies. Node ≥ 18, ESM `.mjs`, stdlib only. |
| C2 | No LLM calls, no network, no code execution, and **no writes** — `speclint` is a read-only diagnostic like `doctor`. It writes no report pair and therefore needs no `--dry-run` handling. |
| C3 | No new CLI flags. Reuse the existing `--strict` flag (already parsed in `install.mjs`); do not touch the flag parser. Unknown flags stay fatal by design. |
| C4 | No behaviour change to any existing command or exit code. Edits to `install.mjs` are purely additive: one `COMMANDS` entry, one import, usage-help lines, one dispatch branch. |
| C5 | License header on every new file, copied from a neighbouring file (first line of `lib/verify.mjs` for `.mjs`). |
| C6 | Surgical diffs: touch only the files in §5; no reformatting of untouched code. |
| C7 | Import helpers from `lib/util.mjs` (`die`, `info`, `isFile`, `isDir`, `readText`) — do not reimplement them and do not modify `lib/util.mjs` or `lib/verify.mjs`. |
| C8 | All output is plain byte-stable strings printed via `info()` — no `style()` color, so the §6 tests can assert exact substrings in CI. |
| C9 | Exit codes are `0` and `1` only, matching the table in `docs/CLI-REFERENCE.md`. |
| C10 | Provenance: every knowledge-layer edit is tagged `[inferred]`; never flip a `[verified]` tag. The `lib/` row description change in `ai/guide/MODULE_MAP.md` (§5) flips that row's Status to `[inferred]` — the W-033 precedent. |

## 3. Scope & glossary

**In:** one new CLI command (`speclint`), one new module (a `lib/` file per the
CLI-shape convention), tests, and the doc rows the roadmap's shared engineering
contract requires (`docs/CLI-REFERENCE.md`, `CHANGELOG.md`, knowledge layer).

**Out (explicitly — do NOT build now):**
- Linting *all* specs in a directory, or any recursive/batch mode — `speclint` takes exactly one spec file (legacy specs predate the numbered template and would fail en masse).
- CI wiring, `--json` output, report/manifest files, or auto-fixing specs.
- Any semantic judgement of spec *quality* — the gate is structural only.
- The W-035 review's sibling recommendations: R2 (`/implement-spec` template promotion), R4 (model-tier WORKLOG column), R5 (ceremony ladder). Separate units of work.
- Stamping `speclint` into target repos via `templates/` — kit-repo command only for now, same posture `/implement-spec` had in W-004.

Terms the implementer could misread, each with its pitfall spelled out:
- **FAIL vs WARN** — the two finding severities. Any FAIL ⇒ exit 1. WARN alone ⇒ exit 0, promoted to exit 1 by `--strict`. There is no third severity.
- **Section** — a block opened by an h2 heading matching `RX_SECTION` (§4.3). Only `##` headings count: `###` subheadings (like §4.1 of this very spec) belong to their parent section, and a heading like the literal text `## 4.1 Foo` does not match because a digit follows the dot.
- **Data row** — a pipe-table line *after* the header row and the separator row. A table with header + separator but nothing below has zero data rows.
- **Outside fences** — every parsing rule in §4.3–§4.4 ignores lines inside fenced code blocks. This is load-bearing: spec §6 test-plan sections routinely embed fixture markdown (this spec's §6 does) whose headings and tables must not confuse the linter.
- **Cell by POSITION, not header text** — when reading a table column (e.g. Stability), find the header cell's index once, then read that index in each data row. Never match on the data cell's text position by name.
- **Implementation-grade** — defined *only* as "passes SL1–SL14 with zero FAILs". The word carries no semantic promise.

## 4. Behaviour (exact)

### 4.1 CLI contract

Invocation: `node install.mjs speclint <path-to-your-repo> <path-to-spec>`.
The second positional is the spec file, resolved with
`path.resolve(targetAbs, specArg)` — so a repo-relative path (the normal case,
e.g. `ai/lab/specs/SPEC_C11-speclint.md`) and an absolute path both work,
regardless of the caller's working directory.

Exactly four additive edits to `install.mjs`:

1. Add `"speclint"` to the `COMMANDS` set (the line currently listing
   `orient`, `install`, `shazam`, …, `demo`).
2. Add the import alongside the other `lib/` imports:
   `import { speclint } from "./lib/speclint.mjs";`
3. Add a usage-help entry to the no-command help text, between the `audit` and
   `demo` lines, matching the existing two-column layout:

   ```
     node install.mjs speclint  <path-to-your-repo> <path-to-spec>
                                                    deterministic implementation-grade
                                                    gate for one lab spec (read-only)
   ```

4. Add a dispatch branch after the `audit` branch:

   ```js
   } else if (command === "speclint") {
     await speclint(targetAbs, positional.shift(), flags);
   }
   ```

   `positional` still holds any arguments after the command and target were
   shifted off, so `positional.shift()` yields the spec argument or `undefined`.

Do not add anything to the `Options:` line of the help text (no new flags, C3),
but the release gate's cli-docs-sync check (`test/release-check.mjs`) requires
the new command to be mentioned in both the usage help *and*
`docs/CLI-REFERENCE.md` — the §5 doc rows are not optional.

### 4.2 Module contract

New file (the `lib/` module the dispatch branch imports — first line is the
license header per C5). Its header comment states what it is: the deterministic
implementation-grade gate; no model, no execution, no writes; the human and the
loop skills interpret the verdict, this code only states facts (mirror the tone
of `lib/verify.mjs`'s header).

```js
export async function speclint(targetAbs, specArg, flags = {}) { ... }
```

Flow, in order:

1. **Argument guard.** If `specArg` is falsy:
   `die("speclint needs a spec file: node install.mjs speclint <path-to-your-repo> <path-to-spec>")`.
2. **Containment.** `const specAbs = path.resolve(targetAbs, specArg);` then
   compute `path.relative(path.normalize(targetAbs), specAbs)`; if it is `""`,
   starts with `..`, or is absolute:
   `die("speclint: spec path escapes the target repo: " + specArg)` — same
   containment rule as `probeInsideTarget` in `lib/verify.mjs` (untrusted path,
   never stat outside the tree).
3. **Existence.** If not `await isFile(specAbs)`:
   `die("speclint: spec not found: " + specAbs)`.
4. **Parse** the spec text per §4.3, **run** checks SL1–SL14 per §4.4–§4.5,
   collecting `{ id, severity, where, message }` findings in check-ID order.
5. **Print** the report per §4.6.
6. **Exit contract.** If any FAIL:
   `die("speclint: " + failures + " failure(s) — spec is not implementation-grade.")`.
   Else if `flags.strict` and any WARN: `die("--strict: " + warnings + " warning(s).")`.
   Else return `{ findings, failures: 0, warnings }`.

### 4.3 Parsing pipeline (ordered — do these steps in this order)

Named patterns, referenced by the checks table in §4.4:

- `RX_COMMENT` = `/<!--[\s\S]*?-->/g` — **step 1:** strip HTML comments from the
  whole text first, replacing each match with the same number of newline
  characters it contained, so every later line number still matches the file on
  disk.
- `RX_FENCE` = `` /^\s*(```|~~~)/ `` — **step 2:** walk lines; a line matching this
  toggles fence state (the marker lines themselves count as inside). All
  subsequent parsing ignores lines inside fences.
- `RX_SECTION` = `/^##\s+(\d+)\.\s/` — h2 section headings. Section *n* spans
  from its heading to the next matching heading (or EOF). The **header region**
  is everything before the first matching heading.
- Pipe table (within a section): a maximal contiguous run of non-fence lines
  each starting with optional whitespace then `|`. The first line is the header
  row; the second must be a separator row (only `|`, `-`, `:`, and whitespace);
  the rest are data rows. Cells: split the line on `|`, drop the first and last
  empty fragments produced by the leading/trailing pipes, `trim()` each. A
  section's table = the **first** such run in the section; later runs are
  ignored.
- `RX_STATUS` = `/^>\s*\*\*Status:\*\*/` — status line (header region).
- Stability extraction (from a cell or a map cell): earliest match in the cell
  of the word-bounded regex for `ours`, `stable`, `frozen` (case-insensitive)
  or the literal character `?`. No match ⇒ "unrecognized".
- `RX_TESTID` = `/^T\d+$/` — test-plan row IDs.
- `RX_NUMITEM` = `/^\s*\d+\.\s/` — numbered list items.
- `RX_CHECKBOX` = `/^\s*- \[[ xX]\]/` — checklist items.
- Placeholder scan (per non-fence line): first remove inline code spans with
  `` /`[^`\n]*`/g `` (HTML comments are already gone from step 1), then every match
  of `/<[^<>\n]+>/g` is a candidate; exempt only autolinks
  (`/^<(https?:\/\/|mailto:)[^\s>]+>$/`) and email autolinks
  (`/^<[^\s@>]+@[^\s@>]+>$/`). Everything else — including real HTML like a
  `<br>` tag — is flagged; the documented convention is that literal HTML in a
  spec must be written inside backticks. This is deliberate: distinguishing
  "HTML tag" from a template placeholder like a bare `<name>` is impossible
  syntactically.
- Touch-list path extraction (from a Location cell): every backtick-quoted
  token in the cell; if the cell has none, the whole trimmed cell text is the
  one path. Normalize each: strip surrounding backticks, strip a leading `./`,
  strip trailing `/`; discard if empty. Containment-check each path exactly as
  in §4.2 step 2 before any filesystem probe (skip the probe with a WARN
  finding if it escapes).

### 4.4 The checks

Run every check even after failures (the report shows everything at once). IDs,
severities, and rules are contractual:

| ID | Severity | Rule |
|---|---|---|
| SL1 | FAIL | The header region contains a line matching `RX_STATUS` whose text after the colon contains (case-insensitive) one of `draft`, `approved`, `implemented`. Missing line or unrecognized value ⇒ FAIL. |
| SL2 | WARN | The SL1 status value contains `draft` ⇒ one WARN: the human must flip draft → approved before implementation starts. (Skipped when SL1 failed.) |
| SL3 | FAIL | Sections `1` through `8` are each present exactly once, in ascending order. One finding per missing/duplicated/out-of-order number. Heading *titles* are not checked — only the numbers — so numbered specs with older wording still pass. |
| SL4 | FAIL | §2 contains a table with ≥ 1 data row (the hard-constraints table). |
| SL5 | FAIL | §3 contains a non-fence line containing the literal text `**Out` (the template's explicit out-of-scope marker). |
| SL6 | FAIL | §5 contains a table with ≥ 1 data row and a header cell whose text contains `Stability` (case-insensitive). Failing SL6 skips SL7–SL10. |
| SL7 | FAIL | Every §5 data row's Stability cell (by position, per §3 glossary) yields a recognized stability word. One finding per unrecognized row; such rows are skipped by SL8–SL10. |
| SL8 | FAIL→WARN | A row whose stability is `frozen` or `?` is a FAIL — the spec is blocked, not the implementer's call — **unless** the §5 text outside the table contains the word `approved` (case-insensitive), in which case each such row is a WARN instead (the recorded human approval is surfaced for the reviewer, per the template's Stability-check instruction). |
| SL9 | FAIL/WARN | Per row: the Change cell (by position under a header cell containing `Change`) containing the word `modify` ⇒ every extracted Location path must exist in the target (`isFile` or `isDir`), else FAIL. Containing `add` ⇒ no existence probe. Containing neither ⇒ one WARN for the row. If §5's table has no `Change` header cell ⇒ one WARN and skip SL9. |
| SL10 | FAIL/WARN | Cross-check each row's stability claim against `ai/guide/MODULE_MAP.md` per §4.5. Claim ≠ map ⇒ FAIL; no covering map row ⇒ WARN (`unmapped`); map file absent ⇒ a single WARN and SL10 is skipped entirely. |
| SL11 | FAIL | §6 contains a table with ≥ 1 data row, and **every** data row's first cell matches `RX_TESTID`. One finding per bad row; missing table is one FAIL. |
| SL12 | FAIL | §7 contains ≥ 1 non-fence line matching `RX_NUMITEM`. |
| SL13 | FAIL | §8 contains ≥ 1 non-fence line matching `RX_CHECKBOX`. |
| SL14 | FAIL | The placeholder scan (§4.3) finds nothing. One finding per occurrence, reporting the 1-based line number and the matched text — leftover template placeholders are the classic silent spec rot. |

### 4.5 MODULE_MAP cross-check (SL10 detail)

1. Read `ai/guide/MODULE_MAP.md` under the target (via `readText`); if it is not
   a file, emit the single WARN and stop.
2. Find the first pipe table (same parser as §4.3) whose header row has a cell
   containing `Directory` and a cell containing `Stability` (case-insensitive).
   None ⇒ same single WARN as a missing map.
3. For each data row: directory = first cell stripped of backticks and trimmed;
   stability = the Stability-position cell run through the §4.3 stability
   extraction (rows with no recognized word are skipped). Normalize: a
   directory cell equal to `/` or starting with `/ (` is the **root sentinel**;
   otherwise strip any trailing `/`.
4. For each §5 touch path `p` (already normalized): candidate map entries are
   those whose directory `d` satisfies `p === d` or `p.startsWith(d + "/")`;
   the root sentinel matches exactly the paths containing no `/` (top-level
   files). Pick the longest `d` (root sentinel has length 0).
5. No candidate ⇒ WARN `unmapped path — MODULE_MAP has no row covering <path>`
   (angle text illustrative). Candidate found ⇒ compare words: unequal ⇒ FAIL
   stating both sides and the map row's directory. Equal ⇒ no finding. The
   comparison is exact equality of the extracted words — the touch-list
   template says Stability comes *from* MODULE_MAP, so any disagreement in
   either direction is a transcription error, by design.

### 4.6 Output contract

Everything goes through `info()`. Line 1 is a header naming the spec relative to
the target (forward slashes); then one line per finding in check-ID order — FAIL
prefix `  ✗ `, WARN prefix `  ! `, then the check ID, a location token
(`header`, `§2`…`§8`, `§5 row 3`, `line 12`), a colon, and the message; then the
verdict line. The prefixes, check-ID tokens, and the verdict line are
contractual (tests assert them; always plural, no singularization):

```
speclint — ai/lab/specs/SPEC_widget.md
  ✗ SL14 line 4: unresolved placeholder <YYYY-MM-DD>
  ! SL2 header: Status is draft — a human flips it to approved before implementation
speclint verdict: BLOCKED (1 failures, 1 warnings)
```

A clean pass prints exactly the header line and
`speclint verdict: IMPLEMENTATION-GRADE (0 failures, 0 warnings)`.
The verdict is `IMPLEMENTATION-GRADE` whenever failures are zero (warnings
allowed — `--strict` only changes the exit, not the verdict word), `BLOCKED`
otherwise.

## 5. Touch list (complete — nothing else changes)

<!-- verify-ignore:start — the lib row names lib/speclint.mjs, which does not exist until this spec is implemented -->
| Layer | Location | Stability (from MODULE_MAP) | Change |
|---|---|---|---|
| CLI | `install.mjs` | ours | modify |
| lib | `lib/speclint.mjs` | ours | add |
| tests | `test/run-tests.mjs` | ours | modify |
| docs | `docs/CLI-REFERENCE.md` | ours | modify |
| docs | `CHANGELOG.md` | ours | modify |
| knowledge | `ai/guide/MODULE_MAP.md` | ours | modify |
| knowledge | `ai/guide/FEATURE_MAP.md` | ours | modify |
| knowledge | `ai/analysis/FEATURE_CATALOG.md` | ours | modify |
| knowledge | `ai/lab/ROADMAP.md` | ours | modify |
| knowledge | `ai/lab/WORKLOG.md` | ours | modify |
<!-- verify-ignore:end -->

Stability check: no `frozen` or `?` files touched. `ai/`-layer rows carry `ours`
because the knowledge layer is the agent-writable surface by this repo's own
rules (`CLAUDE.md`); `ai/guide/MODULE_MAP.md` has no `ai/` row, so a future
`speclint` run on this spec reports those rows as *unmapped* WARNs — expected
and correct.

Per-file change notes (contractual):
- `install.mjs` — exactly the four edits in §4.1.
- `docs/CLI-REFERENCE.md` — one command-index row (`Writes` column:
  `(nothing — read-only)`, like `doctor`) plus a `speclint` anchor + section
  mirroring the `doctor` section's structure: what it does, usage, the SL check
  list condensed to a table, `--strict` behaviour, exit codes.
- `CHANGELOG.md` — one entry under `[Unreleased]` / `Added`, following the
  existing style.
- `ai/guide/MODULE_MAP.md` — append "spec linting" to the `lib/` row's
  responsibility list; that row's Status flips to `[inferred]` (C10).
- `ai/guide/FEATURE_MAP.md`, `ai/analysis/FEATURE_CATALOG.md` — one entry each
  in the neighbouring format, tagged `[inferred]`.
- `ai/lab/ROADMAP.md` — C11 row Status `spec drafted` → `in progress` at start,
  and on ship: move the row to Shipped and fill its Spec/WORKLOG/PR cells.
- `ai/lab/WORKLOG.md` — update the W-036 row (this unit of work): fill
  Review/Commits cells, Status `specced` → `in-review`/`shipped`.

## 6. Test plan (numbered — the implementer implements every row)

Harness: extend `test/run-tests.mjs` (zero-dependency, `ok()` assertions,
`run()` spawner, `makeBareFixture()` for minimal fixtures — reuse all three; do
not add a new test file). Add one standalone block, `— speclint —`, after the
existing standalone blocks, invoking the CLI as
`run("node", [path.join(kitRoot, "install.mjs"), "speclint", dir, "ai/lab/specs/SPEC_widget.md", ...flags])`.

Base fixture, built with `makeBareFixture("speclint", { ... })`:
`src/app.mjs` containing one line, `ai/guide/MODULE_MAP.md` containing MAP
(below), and `ai/lab/specs/SPEC_widget.md` containing GOOD (below). Test
variants overwrite `SPEC_widget.md` (or MAP) with the stated mutation of GOOD —
plain `String.prototype.replace` — before re-running.

GOOD (a minimal spec that passes every check — reproduce verbatim):

```
<!-- test fixture -->
# SPEC: widget
> **Status:** approved
> **Author:** fixture · **Date:** 2026-07-11 · **Revision:** 1

## 1. Goal
Add a widget.

## 2. Hard constraints (violating any of these fails the review)
| # | Constraint |
|---|---|
| C1 | No new dependencies. |

## 3. Scope & glossary
**In:** widget. · **Out (explicitly — do NOT build now):** gadgets.

## 4. Behaviour (exact)
Do the thing exactly as written.

## 5. Touch list (complete — nothing else changes)
| Layer | Location | Stability (from MODULE_MAP) | Change |
|---|---|---|---|
| lib | `src/app.mjs` | ours | modify |
| tests | `tests/app.test.mjs` | ours | add |

Stability check: no frozen rows touched.

## 6. Test plan (numbered — the implementer implements every row)
| # | Test | Assertion |
|---|---|---|
| T1 | widget works | returns 42 |

## 7. Acceptance criteria (definition of done)
1. Tests green.

## 8. Knowledge update on completion
- [ ] WORKLOG row appended
```

MAP (fixture module map):

```
# Module map
| Directory | Responsibility (one line) | Entry point | Stability (guess) | Status |
|---|---|---|---|---|
| `src/` | app code | `src/app.mjs` | ours | [verified] |
| `tests/` | tests | `tests/app.test.mjs` | ours | [verified] |
```

| # | Test | Assertion |
|---|---|---|
| T1 | clean pass | GOOD + MAP ⇒ exit 0; output contains `IMPLEMENTATION-GRADE (0 failures, 0 warnings)` |
| T2 | missing spec argument | no second positional ⇒ exit 1; output contains `speclint needs a spec file` |
| T3 | containment | spec argument `../outside.md` ⇒ exit 1; output contains `escapes the target repo` |
| T4 | missing section | GOOD with the `## 6. Test plan` heading line's `## 6.` changed to `## X` ⇒ exit 1; output contains `SL3` |
| T5 | unnumbered test rows | GOOD with `| T1 |` changed to `| 1 |` ⇒ exit 1; output contains `SL11` |
| T6 | leftover placeholder | GOOD with the Date value replaced by the 12-character placeholder form of YYYY-MM-DD in angle brackets ⇒ exit 1; output contains `SL14` and `YYYY-MM-DD` |
| T7 | fence/inline-code exemption | GOOD with a fenced block containing an angle-bracket token AND an inline-backticked angle-bracket token appended to §4 ⇒ exit 0 |
| T8 | frozen unapproved | GOOD with the `src/app.mjs` row's `ours` → `frozen` (MAP's `src/` row also `frozen`, to isolate SL8 from SL10) ⇒ exit 1; output contains `SL8` |
| T9 | frozen approved | T8's spec plus the line `Approved by the maintainer, 2026-07-11.` after the §5 table ⇒ exit 0; output contains `! SL8` |
| T10 | map disagreement | GOOD unchanged, MAP's `src/` row `ours` → `frozen` ⇒ exit 1; output contains `SL10` |
| T11 | modify path missing | GOOD with Location `src/app.mjs` → `src/gone.mjs` ⇒ exit 1; output contains `SL9` |
| T12 | map absent | fixture without `ai/guide/MODULE_MAP.md` ⇒ exit 0 and output contains `! SL10`; same run with `--strict` ⇒ exit 1 |
| T13 | draft status | GOOD with `approved` → `draft` ⇒ exit 0 and output contains `! SL2`; same run with `--strict` ⇒ exit 1 |
| T14 | read-only | recursive file listing of the fixture dir identical before and after a T1 run (names only) |

## 7. Acceptance criteria (definition of done)

1. All §2 constraints hold; the diff matches §5 exactly (files-changed list vs
   touch list in the final report).
2. `npm test` green including T1–T14; `node install.mjs verify . --strict`
   green.
3. Contract-critical observables: **T10** (the MODULE_MAP cross-check — the
   check that makes this a *gate* instead of a formatter) and **T7** (the
   fence/inline-code exemption — without it every real spec false-positives on
   its own examples). Failing either fails the whole change.
4. Dogfood run: `node install.mjs speclint . ai/lab/specs/SPEC_C11-speclint.md`
   exits 0 with verdict `IMPLEMENTATION-GRADE` — expected findings are the SL2
   draft warning (until a human flips this spec's Status) and unmapped-`ai/`
   SL10 warnings, and nothing else.

## 8. Knowledge update on completion (part of the change, not an afterthought)

- [ ] `ai/guide/FEATURE_MAP.md` entry added (+ any gotcha found on the way), `[inferred]`
- [ ] `ai/analysis/FEATURE_CATALOG.md` amended, `[inferred]`
- [ ] `ai/guide/MODULE_MAP.md` `lib/` row updated per §5, flipped to `[inferred]` — never self-flipped to `[verified]`
- [ ] `ai/lab/ROADMAP.md` C11 row moved/updated per §5
- [ ] `ai/lab/WORKLOG.md` W-036 row updated linking this spec, the review, and the commits
- [ ] This spec's Status → `implemented` (the human flips it after audit)
