<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# The methodology — trust through provenance

This is the reference description of *how and why the kit works*: the trust
model, the two installation processes, the 7-step workflow, and the mechanisms
that keep the result honest over time. For the hands-on version of the same
path, follow [GETTING-STARTED.md](GETTING-STARTED.md); for the academic
treatment, see the [technical report draft](reports/technical-report-draft.md).

---

## 1. The problem being solved

AI coding agents (Claude Code, Cursor, Copilot, Codex, Antigravity) are highly
capable but **context-blind** on large or legacy repositories:

- **Token burn** — they re-read the directory tree every session.
- **Guesswork** — they guess which files are safe to modify.
- **Dangerous hallucinations** — an agent-hallucinated map is worse than no
  map: the agent will confidently edit the wrong module.

The failure mode the kit targets is not "the agent lacks information" but "the
agent has *unverified* information and treats it as fact." So the answer is not
to generate more documentation — it is to make every generated claim carry its
**provenance**, and to put a human gate between inference and trust.
(The one-page version of this argument is
[PROBLEM-SOLUTION-STATEMENT.md](PROBLEM-SOLUTION-STATEMENT.md).)

## 2. The core design principle: separate three kinds of knowledge

Everything in the kit is built on a strict separation of concerns:

| Layer | Producer | Nature | Example |
|---|---|---|---|
| **Deterministic observation** | scripts (`orient`, `indepth`, `check-repo-maturity`, `verify`, `drift`) | facts a script can check; no LLM, nothing executed | "`package.json` exists, therefore the test command defaults to `npm test`" |
| **Model inference** | the agent (`/cold-start`, `/create-feature-catalog`, …) | plausible drafts, always tagged `[inferred]` | "this module appears to handle authentication" |
| **Human verification** | **you** (the audit) | first-hand confirmed facts, tagged `[verified]` | "I opened the file; this row is correct" — your signature |

The scripts never guess, the agent never self-certifies, and the human never
has to trust either blindly — because the two tags make the boundary visible in
every file:

- **`[inferred]`** — drafted by the installer or the agent, not yet checked by
  a human. A plausible guess, not a fact.
- **`[verified]`** — a human confirmed this first-hand and signed it (with a
  date). **Agents are structurally forbidden from writing this tag** — the flip
  is the human's alone, and an agent flipping it is treated as a bug worth an
  issue report.

The second gating vocabulary is **Stability**, set per module during the audit:
`frozen` (hands off), `stable` (change carefully), `ours` (the active surface),
and `?` (unaudited — agents treat `?` as `frozen`, so an unaudited row is safe
by construction). Definitions in the [Glossary](GLOSSARY.md); how to decide
each value in the [Audit Guide](AUDIT-GUIDE.md).

## 3. The 7-step workflow

| Step | Owner | What happens |
|:---|:---|:---|
| **0. `check-repo-maturity`** | Script (seconds) | Read-only diagnostic. 11 deterministic checks, a 0–100 score, and the Process 1 vs 2 decision. No LLM, no writes beyond the report. |
| **1. `orient`** | Script (seconds) | Deterministic observation. Reads marker files and writes `ai/repo-profile.json` (languages, build/test commands, fork status, maturity data). Optionally `indepth` adds `ai/repo-indepth.json` (metrics, dependency graph, architecture inference). |
| **2. `install`** | Script (seconds) | Scaffolding. Process 2 backs up existing config first. Stamps the templates, records every written file (with content hashes) in the install manifest. |
| **3. `/cold-start`** | Agent (~5 min) | Model inference. Process 2: Step 0.5 first extracts knowledge from the `*_bkp_*.md` backups. Then drafts `MODULE_MAP.md`, diagrams, and candidate features — every claim tagged `[inferred]`. |
| **4. The audit** | **Human** (~30 min) | The trust verification the whole method hinges on. Set each module's Stability, flip confirmed rows to `[verified]`. See [AUDIT-GUIDE.md](AUDIT-GUIDE.md). |
| **5. `verify` + `drift`** | Script (+ agent, optional) | Mechanical honesty. `verify` cross-checks every path claim in the docs against the tree; `drift` reports what the map stopped covering. Agent commands (`/post-cold-start-verification`, `/verify-ai-readiness`) add the semantic checks a script cannot judge. |
| **6. `/add-feature`** | Agent | Safeguarded development. The agent specs, navigates by the verified maps, tests, and updates the knowledge layer — without touching `frozen` code. |

Steps 0–2 are one command in practice (`shazam` chains them); the full CLI
behavior of every step is specified in [CLI-REFERENCE.md](CLI-REFERENCE.md).

## 4. Process 1 vs Process 2 — legacy and modern repos

The kit detects which situation it is in (during `check-repo-maturity`, by
checking whether `CLAUDE.md`/`AGENTS.md` exist *without* the kit's footer
marker) and adapts:

**Process 1 — legacy repo, no prior AI config.** The original flow: templates
are stamped from scratch and `/cold-start` drafts everything from the code.

**Process 2 — modern repo, existing user-authored config.** Nothing is lost:

1. The installer copies the existing files to timestamped backups
   (`CLAUDE_bkp_20260617_221847.md`) before overwriting — multiple runs never
   conflict, and `uninstall` preserves the backups.
2. `/cold-start` runs **Step 0.5** first: it reads the `*_bkp_*.md` files and
   extracts the knowledge in them (conventions, architecture, gotchas, module
   descriptions) into the appropriate `ai/guide/` documents, tagged
   `[inferred — from prior config]`.
3. The rest of `/cold-start` proceeds normally, drafting what the backups did
   not cover.

The prior configuration becomes *seed knowledge* for the new layer instead of
being discarded — and it still awaits the same human audit as everything else.

## 5. Keeping it honest over time

A map that was true at audit time and silently rots is the failure mode the kit
is most paranoid about. Four mechanisms address it:

- **`verify`** — every backtick-quoted path claim in the knowledge docs either
  exists on disk or it does not. Deterministic, CI-friendly (`--strict`), and
  wired into the kit's own CI via the `ai-check.yml` workflow template.
- **`drift`** — the reverse direction: code-bearing directories the map does not
  cover, map entries that vanished, and (with `--git`) `[verified]` rows whose
  code changed since the verified commit.
- **The child-lock on re-runs** — installer re-runs are incremental and
  hash-verified: your edited files are kept, and files carrying a `[verified]`
  tag are never overwritten — not even with `--force`. Only the explicit
  `--force-verified` escape hatch (typed consent, backups, full warning) can
  touch them. Human audit work is the most expensive artifact in the system, so
  it gets the strongest lock.
- **Human-in-the-loop re-audit** — mechanical checks have blind spots (see the
  recorded lessons in
  [dev/lessons-learnt/drift-blindspots-and-automation-bias.md](dev/lessons-learnt/drift-blindspots-and-automation-bias.md)):
  a clean `drift` report is evidence, not proof. The workflow treats
  re-verification as a recurring activity, not a one-time gate.

## 6. What the method produces

Two outcomes from one workflow:

1. **An AI-native codebase.** Agents stop guessing: they read a compact,
   provenance-tracked map instead of re-crawling the tree every session, edit
   the right module, and respect what is off-limits. (A bundled measurement of
   the context saved — roughly 3× less reading for a fixed task — lives in
   [examples/value-demo](../examples/value-demo/README.md).)
2. **A human-approved knowledge-base.** Once verified, `ai/` is no longer
   scaffolding — it is the repo's single source of truth, and the fastest
   onboarding document a new teammate can get: `MODULE_MAP.md` for what is
   safe to touch, `PROJECT_OVERVIEW.md` / `ARCHITECTURE.md` / `FEATURE_MAP.md`
   for the why and the where.

The knowledge layer is deliberately **tool-agnostic**: every agent reads the
same maps, and three tools additionally get native automation (see
[MULTI-TOOL-SETUP.md](MULTI-TOOL-SETUP.md)).

## 7. Design pillars, summarized

| Pillar | Implementation |
|:---|:---|
| **Deterministic scan vs model inference** | strict separation between script observation (`orient`, `check-repo-maturity`, `indepth`) and agent generation (`/cold-start`) |
| **Provenance tracking** | the `[inferred]` → `[verified]` progression; the flip is a human signature |
| **Fork-aware stability** | `frozen` / `stable` / `ours` / `?` markers gate every future agent edit |
| **Active verification** | `verify` mechanically cross-checks every path claim (manifest + report, no LLM); agent workflows cover the semantic checks |
| **Drift detection** | `drift` catches unmapped, vanished, and (with `--git`) stale entries as the code evolves |
| **Dual-mode installation** | automatic Process 1/2 detection; prior config preserved via backups and mined as seed knowledge |
| **Protected human work** | hash-verified incremental re-runs; the `[verified]` child-lock; typed-consent escape hatch |

---

**Deeper reading:** the [system diagrams](system-diagrams/README.md) (use-case,
class, sequence, and state-machine views of the same workflow), the
[technical report draft](reports/technical-report-draft.md), and the ADRs under
`ai/lab/decisions/` in this repo.
