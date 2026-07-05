<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Feature-planning inputs: who uses the kit, and the simulation evidence

## Metadata

| Field | Value |
|---|---|
| **Timestamp** | 2026-07-04T00:00:00+02:00 |
| **Category** | Product Planning / User Research / Journey Simulation |

This document records the product-management thinking that seeds the kit's feature
roadmap — the personas the kit is built for, and the journey-simulation evidence
that produced the wave-3 (C-series) features. It was extracted from the wave-3
plan when the roadmap was consolidated into
[`ai/lab/ROADMAP.md`](../../../ai/lab/ROADMAP.md); the *what to build* lives there
(as Planned entries), the *why these, for whom* lives here. It follows the
model-tiering pattern in
[model-tiering-plan-heavy-implement-light.md](./model-tiering-plan-heavy-implement-light.md):
the expensive thinking (user research, journey simulation, trap-spotting) is done
once here, so a lighter autonomous coding agent can implement each feature later
without re-deriving context.

## 1 · Product context: who uses this kit, and for what

The kit's promise: *give AI coding agents — and new human teammates — a compact,
human-verified map of a repository, so context is spent on the task, not on
rediscovery.* Every roadmap feature is judged against the personas who hire the kit
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

All findings below were reproduced with the real CLI (kit v0.2.0, at the wave-3
planning commit) on fixture repos — not hypothesized. Reproduction steps are exact.

| ID | Journey simulated | Finding | Feeds feature |
|---|---|---|---|
| F1 | `orient` on an npm-workspaces monorepo (`packages/api`, `packages/web`, plus `backend/pom.xml`) | Detected as a **single flat npm project**. Workspaces not listed, the Java backend invisible, `testCmd` left as `<fill in>` even though both packages define test scripts. Matches the FAQ's known limitation. | C4 |
| F2 | `shazam --yes` on a **Python** repo (`pyproject.toml`, `src/`, `tests/`), then `verify` | **Fails out of the box: 2 missing claims.** The stamped `CLAUDE.md:22` and `AGENTS.md:24` hard-code `package.json` in the "No Phantom Bugs" rule; a Python repo has none, so the very first `verify` a beginner runs reports broken claims they didn't cause. | C1 |
| F3 | `status` on the same freshly scaffolded repo (correct usage, nothing wrong yet) | Verdict **"DRIFTING"** in red, before `/cold-start` has even run. `doctor` correctly says "step 2 of 5", but `status` has no notion of journey stage — a brand-new user's first health check tells them their repo is rotting. | C2 |
| F4 | Cold-start rows added, one row flipped `[verified]`, code changed, then `drift --git --suggest` | Stale check **silently skipped**: "MODULE_MAP records no verified commit". The flagship staleness detection only works if a human hand-edits `Last verified: … @ commit <sha>` in an exact regex-matched format (`lib/drift.mjs:68`). The `audit` command does not stamp it. | C3 |
| F5 | New file added inside an already-mapped directory, then `drift` | Not flagged — `drift` maps at directory-segment level, so anything new inside a mapped dir is invisible. Already documented as a real incident in [drift-blindspots-and-automation-bias.md](./drift-blindspots-and-automation-bias.md). | C5 |
| F6 | Value story: `examples/value-demo/measure.mjs` | Works — but only for the **bundled sample app**. A tech lead cannot produce the "map vs raw tree" context-savings number for *their own repo*, which is exactly the number they need to justify adoption internally. | C6 |
| F7 | This kit's own `ai/INDEX.md` footer | Reads "Installed by ai-fication-kit **0.1.0**" while the CLI is 0.2.0. Nothing ever tells a user their installed layer predates the current kit or that re-running `shazam` is a safe upgrade. | C7 |
| F8 | `demo`, `doctor`, `audit` (non-TTY refusal), maturity check | All behaved well — clear copy, correct stage detection, correct refusal. Wave 2 quality is good; wave 3 should build on it, not rework it. | — |

**Fixture recipes** (for regression tests): F1 = root `package.json` with
`"workspaces": ["packages/*"]`, two member packages with their own `package.json`
(+ test scripts), one `backend/pom.xml`. F2 = `pyproject.toml` + `src/app/views.py`
+ `tests/test_views.py`, git-initialized, then `shazam --yes`.

## 3 · How this feeds the roadmap

Each `Feeds feature` ID above is a Planned entry in
[`ai/lab/ROADMAP.md`](../../../ai/lab/ROADMAP.md). The pattern to keep: a feature
earns its place on the roadmap only when a reproduced journey (not a hypothesis)
shows a real persona losing trust or time. When a new planning wave opens, run the
journeys first, record the evidence here, then write the Planned specs.
