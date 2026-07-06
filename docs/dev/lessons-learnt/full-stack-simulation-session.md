<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Full-stack simulation session: what running the whole methodology on a real polyglot repo taught us

## Metadata

| Field | Value |
|---|---|
| **Timestamp** | 2026-07-06T10:30:00+02:00 |
| **Category** | Methodology Validation / Detection-Layer QA / Review Loop |

This document records the lessons learnt from running the kit's **entire**
methodology end-to-end against a real external repository — a fresh clone of
fastapi/full-stack-fastapi-template (React 19 + TypeScript frontend, FastAPI +
Python backend, bun + uv workspaces, Docker Compose) — including shipping a real
feature inside the target under the spec → implement → verify → review → record
loop. The findings live in
`ai/analysis/audit-reports/2026-07-06-fullstack-simulation-report.md` (W-020);
the resulting implementation plan is `ai/lab/specs/SPEC_C9-detection-polyglot.md`
and `ai/lab/specs/SPEC_C10-template-alignment.md` (W-022). This extends the
2026-07-05 single-stack simulation (debug-js/debug, W-018) to the polyglot,
monorepo-shaped case.

## Context

The session ran: `shazam --yes --analysis-level indepth` → `/cold-start` (with
`repo-explorer` delegation) → a simulated human audit → `verify` / `drift` /
`status` / `check-repo-maturity` → `/add-feature` with a full spec (a version
endpoint + sidebar display, shipped as a 10-file surgical diff in the sandbox) →
a fresh-context `/review-change` → ROADMAP/WORKLOG bookkeeping — then converted
every observed deviation into severity-ranked findings and, later,
implementation-grade specs. The target clone lived in a session scratchpad and
was discarded; only the kit-side documentation and fixes were kept.

## 1. Real-repo simulation is the kit's highest-yield QA method — and each run should change the repo *shape*

The 2026-07-05 run (single-stack JS library) surfaced doctor/verify/drift logic
bugs. This run — same method, different repo shape — surfaced an almost disjoint
set: polyglot command detection, workspace-member blindness, template↔parser
format drift. The lesson: the finding classes live at the **boundaries the target
exercises**, so repeating the simulation on the same shape has diminishing
returns, while changing one axis per run (single→poly language, flat→workspace
layout, npm→bun/uv toolchain) keeps the yield high. Natural next axis: a
Java/Maven or Gradle multi-module monorepo. A corollary: nothing beats making the
agent actually *ship a feature* in the target — several findings (the generated
client's frozen-but-regenerable status, the pytest `::` selector false positive)
only appeared during implementation, not during mapping.

## 2. Templates and parsers are one contract and must be tested as one

The stamped MODULE_MAP template is 4-column; `parseModuleMap` and the kit's own
dogfooded map expect a 5th `Status` cell. Result: every fresh cold-start counted
as "0 [inferred], N unaudited" in `status`/`doctor` — the audit counters were
meaningless for every new adopter, silently. Neither side was "wrong"; they had
simply evolved separately. The durable fix isn't the one-time template edit
(SPEC_C10 W1) but the *test pattern*: stamp a fixture, feed the stamped file
through the real parser, assert a row in the documented shape is counted
(SPEC_C10 T1). Any file the kit both writes and later reads needs such a
round-trip test; prose agreement between a `.tmpl` and a `.mjs` rots.

## 3. Committed artifacts must never embed machine-local state — fix the producer, not the artifact

`ai/START-HERE.html` (committed) is refreshed by `refreshProgressPage` with
`doctor` output that embedded the absolute target path and a "drift has never
been run" diagnosis derived from gitignored manifests. This bit PR #39, was
"fixed" there by hand-restoring the artifact, and bit PR #41 again — the classic
sign the producer was never fixed. Two sub-lessons: (a) any generator whose
output is committed must emit **portable** content (relative paths, no
machine-local claims) — that is a property of the generator, enforceable by a
regression test, not a thing to clean up per-PR; (b) "never happened" and "not
recorded on this machine" are different diagnoses — when local state
(gitignored manifests) is missing but a committed report twin exists, say "not
run on this checkout", never "never run".

## 4. Verification needs a vocabulary for environments that cannot run the suite

The target's only backend harness required Docker (or Python 3.14 + Postgres);
the sandbox had neither, and the proxy blocked uv's interpreter download. The
tests were written but could not execute. "Failing or unrun tests ⇒ not done" is
the right *policy*, but with no sanctioned way to record the state, the honest
outcome had to be improvised mid-session (`BLOCKED-ENV: <blocker> —
compensating evidence: <what ran instead>`; here: tsc + biome + ruff green, plus
a TestClient smoke run on 3.11 with temporary, restored compat shims). SPEC_C10
W5 blesses that vocabulary in the review and WORKLOG templates. The lesson
generalizes: agent sandboxes (Claude Code web, CI runners) routinely can't run
Docker-based suites, and a process with no honest "blocked" state pushes agents
toward the two dishonest ones — claiming success or silently skipping.

## 5. The fresh-context review is not ceremony — it caught what the implementer could not see

The `/review-change` pass (clean context, evidence-based, no memory of the
implementation) returned request-changes with two real majors: the WORKLOG row
was missing *at the reviewed commit* (it existed only in the working tree —
invisible to the implementer who "knew" it was done), and a FEATURE_MAP claim
written as `path::test` broke `verify --strict`. Both were one-line fixes;
both would have shipped without the fresh session. Corollary for strict
checkers: every false positive `verify` emits (scoped npm packages, pytest
selectors) trains agents to *avoid backticking claims*, which quietly erodes
the checkable-claims convention the kit depends on — so allow-list gaps are
trust bugs, not cosmetics (SPEC_C9 W6).

## 6. Findings reports don't transfer to lighter models — specs with line anchors do

The findings report (diagnosis + one-line suggestions) was the right artifact
for the human decision, but handing it to a lighter implementation model would
have re-opened every design question. The transferable artifact turned out to
be the `/implement-spec`-grade spec: exact file/line anchors verified against
the current tree (`lib/orient.mjs:104`, `lib/maturity.mjs:145-148`), decisions
pre-made in §4 (uv wins over poetry; one-level member scan with a named skip
set; no new Stability enum value), numbered tests naming their fixtures, and
hard constraints that double as review criteria. Writing the spec forced
reading the real code — which itself corrected two assumptions the report had
gotten subtly wrong (orient already had a `hasBun` branch; it only missed the
text lockfile format). Diagnosis and plan are different documents with
different audiences; budget for both.

## 7. Small process frictions observed in passing (recorded so they aren't relearnt)

- **Provenance discipline held under pressure:** the simulation needed an
  "audited" map to proceed to /add-feature; setting Stability while leaving
  every row `[inferred]` (and the verdict at NEEDS AUDIT) was the correct
  resolution — the agent must never manufacture `[verified]`, even in a
  simulation where it plays both roles.
- **The churn rule needs its exception spelled out:** cold-start says "verify
  the stamped commands" while the No-Churn rule forbids touching `CLAUDE.md` —
  an obedient agent leaves stamped lies in place. Sanctioned, surgical
  exceptions beat implicit judgement calls (SPEC_C10 W2).
- **ID formats drift across templates** (`W-1` vs `W-001`): trivial alone, but
  every such mismatch is a fork in an agent's behavior that a template test
  could pin.
- **Frozen needs a "generated" idiom:** `frontend/src/client` had to change on
  every API change yet was correctly `frozen`; the spec had to invent
  "frozen — regeneration only". Legend text, not a new enum, was the
  parser-safe home for it (SPEC_C10 W3).
