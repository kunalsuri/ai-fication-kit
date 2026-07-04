<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Serving the Knowledge Layer over MCP: Adapters, Freshness, and the Ship-While-Sailing Problem

## Metadata

| Field | Value |
|---|---|
| **Timestamp** | 2026-07-04T20:30:00+02:00 |
| **Category** | Knowledge-Layer Design / MCP / Freshness / Future-Proofing |
| **Status** | `[inferred]` — agent-drafted from a design session; a human must audit before flipping any item to `[verified]` |

This document records the design reasoning behind exposing the `ai/` knowledge-base
through an MCP (Model Context Protocol) server, so the same questions are not
re-litigated in future sessions. The companion implementation spec is
`ai/lab/specs/SPEC_mcp-kb-server.md`.

## Context

Design question (2026-07-04): should the kit grow an MCP server for the `ai/`
knowledge-base, how can it be built without breaking the codebase, should a
knowledge graph be added, and — the hard one — how does an MCP layer stay fresh
when the kit's own workflows continuously rewrite `ai/` underneath it ("we are on
a ship while building the ship")?

## Lesson 1 — The durable asset is verified knowledge, not any file format

The project's moat is **human-verified knowledge with provenance**: the
`[inferred]`/`[verified]` tags, the `frozen` Stability markers, and the
deterministic verify/drift loop. File formats (`CLAUDE.md`, `.cursorrules`,
`.mcp.json`) are **adapters** over that core, and adapters churn as agent tools
churn. The future-proof architecture is therefore *knowledge core + adapters*:
MCP is one more adapter — the most important one, because it is the single
interface every major agent vendor adopted in 2025 — not a replacement store.
Corollary: the markdown in `ai/` remains the single source of truth; the MCP
server must never become a second place where knowledge lives.

## Lesson 2 — MCP turns prose guardrails into machine-enforced guardrails

Today the kit's rules ("check Stability before editing", "never flip
`[inferred]` yourself") are prose that an agent may skip or misread. A tool
boundary makes them structural: `kb_check_stability(path)` returning
`{"stability": "frozen"}` is data no agent can gloss over. Moving safety rails
from convention into the interface is the main *qualitative* win of the MCP
layer, beyond mere convenience.

## Lesson 3 — The server must be a window, not a warehouse (freshness layer 1)

Because the kit's own workflows append to `WORKLOG.md` and update
`FEATURE_MAP.md` after every feature/bugfix, the server serves a knowledge-base
that is being edited while it runs. The design answer: **statelessness as a
contract, not an accident.** The server holds no snapshot, cache, or index —
every tool call and resource read hits the filesystem at request time. A
knowledge update is visible on the very next call, with no rebuild, restart, or
sync step. The few milliseconds of file I/O per call are the price of never
having a cache-invalidation bug inside the trust layer; at per-repo scale that
is the correct trade. *Caching must be forbidden in the spec, not merely
omitted* — otherwise a future "optimization" silently reintroduces staleness.

## Lesson 4 — Three staleness layers need three different answers

1. **Server vs. disk** — solved automatically by Lesson 3 (stateless
   read-through).
2. **Derived artifacts vs. source docs** — compiled outputs
   (`ai/repo-profile.json`, a future `ai/graph.json`) can lag their inputs.
   Mechanism: compare input/output mtimes (or hashes) per request; regenerate
   on the fly (cheap, deterministic) or flag the response `derived_stale`.
   Never serve a stale derivation silently.
3. **Docs vs. code reality** — the kit's core problem, which exists with or
   without MCP. MCP should *surface* it in-band rather than hide it: every tool
   response carries the current `status` verdict (TRUSTED / NEEDS AUDIT /
   DRIFTING) and per-row provenance tags. Honest freshness is not "always
   fresh" but "staleness is always declared in the same payload."

## Lesson 5 — Derive the knowledge graph; never store one

A graph database (Neo4j, vector stores, embeddings) would break the kit's three
core properties — human-auditable, git-diffable, zero-dependency — and adds no
retrieval value at per-repo scale. But the graph already exists *implicitly*:
`MODULE_MAP.md` rows are module→path→stability edges, `FEATURE_MAP.md` rows are
feature→files edges, specs/ADRs are decision→files edges. The right move is a
deterministic compile step (orient-style) emitting `ai/graph.json` with typed
edges, regenerated never hand-edited, plus a one-hop `kb_related(node)` tool
("what else breaks if I touch this file?"). Multi-hop GraphRAG can layer on top
later *if* markdown+grep retrieval ever actually fails — do not build it before
that failure is observed.

## Lesson 6 — Zero-dependency is itself a future-proofing feature

MCP over stdio is newline-delimited JSON-RPC 2.0 — implementable in a few
hundred lines of stdlib Node, like every other `lib/*.mjs` module. Pulling in
`@modelcontextprotocol/sdk` would add the kit's first runtime dependency (supply
chain to audit, versions to chase) to avoid writing a small amount of framing
code. Delete the part: hand-roll the transport, keep the dependency count at
zero.

## Lesson 7 — Additive integration is possible because lib/ exports pure compute

The MCP server needs zero changes to existing logic because the kit already
separates compute from presentation: `computeVerification` (`lib/verify.mjs`),
`computeDrift` + `parseModuleMap` (`lib/drift.mjs`), `computeStatus`
(`lib/status.mjs`) are importable pure functions. The server is one new module
(`lib/mcp.mjs`) plus one new `else if` in the `install.mjs` dispatch. Lesson for
future features: keeping `compute*` functions pure and exported is what makes
new adapters cheap — preserve that convention.

## Lesson 8 — Write access through MCP is a separate, human-gated decision

Phase-1 tools are read-only. Write tools (append WORKLOG, draft specs with
auto-`[inferred]` tagging) would let the protocol *enforce* the "knowledge
update on completion" checklist — reads and writes through one interface means
completion can be gated on the update actually happening. But they touch the
human-in-the-loop contract, which is the product; they need their own spec and
explicit human approval, and must never be bundled into the read-only phase.

## Pitfall recorded for implementers

`parseModuleMap` (`lib/drift.mjs`) does **not** expose the Stability column — it
returns path claims and provenance status only. Any stability-answering code
must parse the MODULE_MAP table's Stability cell itself (and must treat `?` or
unmatched paths as frozen, per the map's legend). This is exactly the kind of
detail that an implementing agent will get wrong if the spec does not state it
explicitly.
