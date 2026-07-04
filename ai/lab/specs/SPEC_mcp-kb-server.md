<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: MCP server for the ai/ knowledge-base (`kb` command)
> **Status:** draft `[inferred]` — AI-drafted design, human must audit before implementation
> **Author:** AI draft (design session) · **Date:** 2026-07-04

## Goal
Any MCP-capable coding agent (Claude Code, Cursor, Copilot, Codex CLI, Windsurf)
connected to a kit-installed repo can query the `ai/` knowledge-base through a
standard protocol — look up modules, check Stability before editing, read provenance
tags, and run verify/drift — instead of relying on each tool honouring the prose
conventions in `CLAUDE.md`/`AGENTS.md`. The markdown in `ai/` stays the single
source of truth; MCP is a *serving layer*, not a second store.

## Why (design rationale, kept short)
- The kit's durable asset is **verified knowledge with provenance**, not any file
  format. `CLAUDE.md`, `.cursorrules`, and MCP are all adapters over the same core.
  Adding an MCP adapter future-proofs the kit against agent-tool churn: MCP is the
  one interface all major agent vendors adopted in 2025.
- Today the guardrails (frozen files, `[inferred]` vs `[verified]`) are enforced by
  *prose the agent may skip*. An MCP tool boundary makes them machine-enforced:
  `kb_check_stability` returns `frozen` as structured data an agent cannot misread.
- Zero-dependency constraint holds: MCP over stdio is JSON-RPC 2.0 on
  stdin/stdout with newline/Content-Length framing — implementable in ~300 lines of
  plain Node, same as the rest of `lib/`. No `@modelcontextprotocol/sdk` needed.

## Scope
**In:**
- New `lib/mcp.mjs` implementing an MCP stdio server (JSON-RPC 2.0, protocol rev
  2025-06-18; capabilities: `resources`, `tools`, `prompts`).
- New CLI command `node install.mjs mcp <path-to-repo>` wired into the existing
  dispatch in `install.mjs` (additive `else if` branch only).
- **Resources** (read-only, `kb://` URIs): `ai/INDEX.md`, the five `ai/guide/*.md`
  docs, `ai/repo-profile.json`, `ai/repo-indepth.json`, `ai/analysis/FEATURE_CATALOG.md`.
- **Tools** (all read-only in phase 1):
  - `kb_lookup(query)` — search MODULE_MAP / FEATURE_MAP rows; returns matching
    rows with path, purpose, Stability, provenance tag. Reuses `parseModuleMap`
    from `lib/drift.mjs`.
  - `kb_check_stability(path)` — `frozen | reviewable | unknown` for a file path;
    the pre-edit gate as structured data.
  - `kb_verify()` — wraps `computeVerification` (`lib/verify.mjs`); returns broken
    path references.
  - `kb_drift()` — wraps `computeDrift` (`lib/drift.mjs`); returns undocumented /
    stale areas.
  - `kb_status()` — wraps `computeStatus` (`lib/status.mjs`); TRUSTED / NEEDS
    AUDIT / DRIFTING verdict.
- **Prompts:** expose `templates/agents/workflows/*.md` (cold-start, add-feature,
  fix-bug, check-drift …) as MCP prompts so non-Claude clients get the workflows too.
- Installer (`lib/installer.mjs`): write a `.mcp.json` into target repos (merge-safe,
  recorded in `ai/install-manifest.json` for uninstall) registering
  `npx ai-fication-kit mcp .` as server `repo-kb`. Claude Code reads `.mcp.json`
  natively; document `.cursor/mcp.json` / `.vscode/mcp.json` equivalents in README.
- Every tool response carries the provenance tag of its source rows and a one-line
  reminder when data is `[inferred]` (trust rail preserved at protocol level).

**Out (explicitly):**
- Write tools (append WORKLOG, draft specs) — phase 3, needs its own spec because
  it touches the human-in-the-loop contract.
- Embeddings, vector stores, graph databases (Neo4j etc.) — rejected; they break
  the human-auditable / git-diffable / zero-dep contract and add no value at the
  scale of a per-repo knowledge-base.
- HTTP/SSE transport — stdio only; remote serving is a later concern.
- Knowledge graph *storage*. Graph *derivation* is phase 2, see below.

## Freshness model (how the MCP stays current while agents rewrite ai/ underneath it)
The kit's own workflows write into `ai/` after every feature/bugfix, so the server
is serving a knowledge-base that is being edited while it runs. Three staleness
layers, three answers:
1. **Server vs. disk — stateless by contract.** The server holds no snapshot,
   cache, or index. Every tool call and resource read hits the filesystem at
   request time (`parseModuleMap` on current bytes). A WORKLOG append or
   FEATURE_MAP edit is visible on the very next call, no restart. *Caching is
   forbidden, not merely omitted.* Optional refinement: `fs.watch` on `ai/` →
   MCP `notifications/resources/updated` for clients that cache on their side.
2. **Derived artifacts vs. source docs.** Compiled outputs (`repo-profile.json`,
   future `ai/graph.json`) can lag their inputs. On each relevant call the server
   compares input/output mtimes (or hashes) and either regenerates on the fly
   (deterministic + cheap) or sets `"derived_stale": true` in the response.
   Never serve a stale derivation silently.
3. **Docs vs. code reality.** Already the kit's core job (drift/verify/provenance);
   MCP surfaces it in-band instead of hiding it: every tool response carries the
   current `kb_status` verdict (TRUSTED / NEEDS AUDIT / DRIFTING) plus per-row
   provenance tags — staleness is always *declared* in the same payload. Backstop:
   `check-drift` in CI or a git hook. The phase-3 write tools close the loop fully
   (reads and knowledge updates through one protocol, so completion can be gated
   on the update actually happening).

## Phase 2 (sketch, separate spec before build): derived knowledge graph
Do **not** introduce a graph store. The graph already exists implicitly:
MODULE_MAP rows (module → path → stability), FEATURE_MAP rows (feature → files),
specs/ADRs (decision → files). Phase 2 adds a deterministic compile step (like
`orient`) that emits `ai/graph.json` — nodes (module, feature, spec, ADR) and typed
edges (`implements`, `touches`, `depends-on`, `decided-by`, `frozen`) — plus one MCP
tool `kb_related(node)` for one-hop traversal ("what else do I break if I touch
this file?"). Regenerated, never hand-edited; diffable in git; carries provenance
per edge. GraphRAG-style multi-hop retrieval can layer on top later *if* lookup
quality ever demands it.

## Touch list (from MODULE_MAP / FEATURE_CATALOG)
| Layer | Location | Change |
|---|---|---|
| backend | `lib/mcp.mjs` | add (new module, stdio JSON-RPC server + tool impls) |
| CLI | `install.mjs` | modify (add `mcp` to COMMANDS + one `else if` branch; header comment) |
| backend | `lib/installer.mjs` | modify (write/merge `.mcp.json`, record in manifest) |
| templates | `templates/mcp.json.tmpl` | add |
| tests | `test/` | add `mcp` suite (spawn server, JSON-RPC handshake, each tool against `examples/legacy-calculator`) |
| docs | `README.md`, `templates/CLAUDE.md.tmpl`, `templates/AGENTS.md.tmpl` | modify (one short section: "Querying the knowledge-base over MCP") |

No existing `lib/*.mjs` logic changes — the server imports the already-exported
`compute*` functions. Existing commands, templates, and tests are untouched.

## Acceptance criteria
1. `node install.mjs mcp .` starts, answers `initialize`, and lists ≥5 tools and
   ≥8 resources over stdio JSON-RPC (verifiable with a scripted client in tests).
2. `kb_check_stability` on a path marked `frozen` in MODULE_MAP returns
   `stability: "frozen"`; unknown paths return `unknown`, never a guess.
3. `kb_verify` / `kb_drift` / `kb_status` return the same findings as the CLI
   commands on the same repo (shared `compute*` functions, asserted in tests).
4. Fresh install into `examples/legacy-calculator` produces a `.mcp.json` that
   Claude Code accepts; `uninstall` removes it (manifest round-trip).
5. `npm test` passes; `node install.mjs verify . --strict` passes.
6. A repo *without* the kit installed gets a clear error, not a crash.
7. All tool outputs include the provenance tag of their source data.
8. Freshness: editing `ai/guide/MODULE_MAP.md` between two `kb_lookup` calls
   (server kept running) changes the second result — proves no caching.
9. A derived artifact older than its inputs is regenerated or flagged
   `derived_stale`, never served silently.

## Verification
- Tests to add: `test/` — MCP handshake, per-tool golden outputs against
  `examples/legacy-calculator`, `.mcp.json` install/uninstall round-trip,
  parity check `kb_verify` ≡ `computeVerification`.
- Suites to run: `npm test`, `node install.mjs verify . --strict`.
- Stability check: no `frozen` files modified (touch list is additive except two
  surgical modifications listed above; confirm against MODULE_MAP before build).

## Knowledge update on completion
- [ ] FEATURE_MAP.md entry added/updated (`MCP knowledge-base server`)
- [ ] FEATURE_CATALOG.md regenerated or amended
- [ ] MODULE_MAP.md rows still accurate (add `lib/mcp.mjs` row, `[inferred]`)
- [ ] ai/INDEX.md role table: add "KB over MCP" row
- [ ] WORKLOG.md entry under this spec
