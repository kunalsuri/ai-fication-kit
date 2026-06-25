<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# Project overview — ai-fication-kit

> Status: drafted by an `[inferred]` cold-start pass on 2026-06-14 (the kit dogfooding
> itself); every section `[inferred]` until a human audits it.

## What this is
**A Toolkit to Give AI Coding Agents a Trusted Map of Any Existing/Legacy Repo**

## Stack (from `ai/repo-profile.json` — deterministic)
- Languages: JavaScript/TypeScript (Node ≥ 18) and Python ≥ 3.8 — two mirrored, zero-dependency implementations
- Build: `npm install` (zero-dependency; `package.json` defines no `build` script, so there is nothing to compile)
- Test:  `npm test` (runs `node test/run-tests.mjs`, which exercises both installers)

## Why it exists  `[inferred]`
AI coding agents are powerful but context-blind on large or legacy repositories: they
re-crawl the tree every session, guess what is safe to edit, and confidently
hallucinate maps. This kit scaffolds a compact, provenance-tracked knowledge layer
(`ai/`) so an agent reads a trusted map instead of guessing — and, once a human
verifies that layer, it doubles as AI-Powered Repo Intelligence that lets new teammates
onboard fast. The deliberate split is **deterministic observation** (`orient`, no LLM)
vs. **model inference** (`/cold-start`, everything tagged `[inferred]`), with a human
audit as the trust boundary.

## What we add vs. what we inherit  `[inferred]`
Not a fork — all code here is `ours`. The implementation is intentionally split into
two parallel runtimes that must stay behavior-identical: `install.mjs` + `lib/*.mjs`
(Node) and `install.py` + `lib/*.py` (Python). `templates/` is the payload that gets
stamped into target repos; everything else (`lib/`, `test/`, `docs/`) is the tooling
around it.

## Glossary  `[inferred]`
| Term | Meaning here |
|---|---|
| `orient` | Deterministic stack-detection pass; reads marker files, writes `ai/repo-profile.json`. No LLM. |
| `shazam` | One-shot `orient` + `install` + printed next steps. |
| `/cold-start` | Agent pass that drafts the `ai/` maps, all tagged `[inferred]`. |
| `[inferred]` → `[verified]` | Provenance flip; the human's signature. Agents must never do it. |
| Stability | Per-module edit gate: `frozen` / `stable` / `ours` / `?` (treated as `frozen`). |

