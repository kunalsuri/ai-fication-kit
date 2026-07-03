<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Two Kinds of Knowledge: Memory, Context, and the Harness

## Metadata

| Field | Value |
|---|---|
| **Timestamp** | 2026-07-03T00:00:00+02:00 |
| **Category** | Knowledge-Layer Design / Memory / Context Engineering / Harness Engineering |
| **Status** | `[inferred]` — agent-drafted; a human must audit before flipping any item to `[verified]` |

This document records the resolution of a recurring design question about the `ai/`
folder — why a "knowledge repo" contains `lab/` at all — so the same confusion is
not re-litigated in future sessions or PRs. It then generalizes the answer into how
memory, context, context engineering, and harness engineering interlock in this kit.

---

## Lesson 1 — `ai/` holds TWO kinds of knowledge, and that is by design

**The confusion (2026-07-03):** "`ai/` is supposed to be a knowledge repo — a map of
the codebase. But it contains `lab/` (specs, ADRs, experiments), which doesn't
describe the code. Doesn't that defeat the point?"

**Resolution:** it doesn't, because "knowledge" here is two different things:

| | Descriptive knowledge | Intentional knowledge |
|---|---|---|
| **Answers** | *What is the repo? Where is the code?* | *Why is it that way? What is planned? What did we learn?* |
| **Lives in** | `ai/guide/`, `ai/analysis/`, `ai/repo-profile.json` | `ai/lab/` (specs, ADRs, evaluations, experiments) |
| **Derivable from code?** | **Yes** — if lost, `/cold-start` can regenerate it and a human re-verifies | **No** — if lost, it is gone forever; no amount of re-crawling recovers a *reason* |
| **Freshness model** | Regenerated / drift-checked against the code | Accumulated; append-mostly, archived when superseded |
| **Load pattern** | `guide/` every session; `analysis/` on demand | Only when planning or reviewing |

Both are knowledge an agent genuinely needs. The map (`guide/`) tells an agent *where*
code is; the ADRs tell it which "weird" code is **deliberate and must not be fixed**
— that is the backbone of the frozen/Stability rule in `ai/guide/MODULE_MAP.md`.
Specs in `lab/specs/` are what `/add-feature` executes against. Without `lab/`, the
kit is a navigation tool; with it, it is a knowledge base.

**Invariants that keep the two kinds from contaminating each other:**

1. **Load-pattern separation** (already encoded in `ai/INDEX.md`): `guide/` loads
   every agent session, `analysis/` on demand per task, `lab/` only when planning or
   reviewing. `lab/` therefore never costs tokens during a normal "where is X" lookup.
2. **Dependency direction:** navigation must **never require reading `lab/`**.
   `guide/` has to make sense on its own. `lab/` may reference `guide/`; never the
   reverse as a prerequisite.
3. **Provenance:** both kinds obey the same `[inferred]` → `[verified]` rule, so a
   reader can trust them under one model.

**The one real structural risk:** `lab/` is the only part of `ai/` that *accumulates*
rather than *regenerates*. Stale specs for shipped features rot into noise, and an
agent planning from `lab/` could mistake an old plan for a current one. Mitigation:
the lifecycle in `ai/lab/README.md` ends with "Archive → mark spec implemented"; the
`/check-drift` pass should enforce that implemented specs are actually marked.

---

## Lesson 2 — the right analogy is *memory*, not a "central nervous system"

The CNS analogy misleads because a nervous system *controls* the body. `ai/` controls
nothing — the source code never reads it; it only *informs* the agents that edit the
code. The accurate analogy is **memory**, and it maps surprisingly precisely onto the
folder layout:

| Human memory system | What it stores | `ai/` equivalent |
|---|---|---|
| **Semantic memory** | Facts about the world ("Paris is a capital") | `ai/guide/` — module map, architecture, conventions: facts about the repo |
| **Episodic memory** | Experiences and events ("last release we broke X") | `ai/lab/` — ADRs, evaluations, experiments: what we decided, tried, learned |
| **Procedural memory** | How to do things (riding a bike) | Skills/commands (`/cold-start`, `/add-feature`, `/check-drift`) + `CONVENTIONS.md` |
| **Perception** (not memory, but feeds it) | Fresh observations of the current world | `ai/analysis/` — regenerated catalogs, diagrams, audit reports |
| **Working memory** | The handful of items held *right now* while reasoning | The agent's **context window** during a session — the only part NOT in `ai/` |

Two consequences of taking the analogy seriously:

- A brain with only semantic memory can describe the world but cannot learn from
  experience. Removing `lab/` would lobotomize exactly that: the episodic half.
- Everything in `ai/` is **external, persistent, shared memory**. It survives the end
  of a session (unlike the context window), and it is shared across *agents and
  humans* (unlike any single tool's proprietary memory feature). That is what makes
  the kit tool-agnostic: Claude, Cursor, Copilot, and a new human teammate all read
  the same memory.

A less biological framing that also works: `guide/` is **the map**, `lab/` is **the
captain's log**. A ship needs both; nobody confuses them because they are shelved
separately.

---

## Lesson 3 — how memory, context, context engineering, and harness engineering fit together

These four terms are layered, not interchangeable. As of mid-2026 the industry
describes them roughly as three phases of AI-engineering maturity — prompt
engineering → context engineering → harness engineering — with memory as the
substrate all of them manage.

### The four layers

1. **Memory** *(what is known)* — durable knowledge outside any single model call.
   Short-term memory is the running conversation (including tool results); long-term
   memory persists across sessions. The `ai/` folder is this repo's long-term memory,
   deliberately stored as plain files under version control so that provenance
   (`[inferred]`/`[verified]`), diffing, and review all come for free.

2. **Context** *(what is loaded right now)* — the finite token window a model
   actually sees in one call: system prompt, instructions, tool schemas, retrieved
   files, and history. Context is the *working memory* into which small slices of
   long-term memory are paged. It is scarce and degrades when overfilled — the
   failure mode the industry calls **context rot**: irrelevant tokens crowding out
   signal until decisions degrade.

3. **Context engineering** *(deciding what gets loaded, when)* — the discipline of
   curating that window across a multi-step task: just-in-time retrieval instead of
   pre-loading, compaction of older turns into summaries, structured note-taking to
   files, and sub-agent isolation so heavy reading happens in a *different* context
   window and only conclusions return. The kit's design choices are context
   engineering decisions made once and reused forever:
   - `INDEX.md` load patterns (every session / on demand / when planning) = a
     **paging policy** for memory.
   - "Locate via `MODULE_MAP.md`, open only needed files" = **just-in-time
     retrieval** (measured in `ai/lab/evaluations/2026-06-15-value-demo-context-budget.md`
     at ~3.1× less context for the same task).
   - `repo-explorer` / `feature-builder` / `test-runner` subagents = **context
     isolation**.
   - Writing findings into `ai/analysis/` = **structured note-taking**: an agent's
     working memory persisted into shared long-term memory before the window resets.

4. **Harness engineering** *(the machinery around the model)* — everything in the
   agent system *except* the model: **Agent = Model + Harness**. Tools, permission
   guardrails, verification loops, hooks, observability. The term was popularized in
   early 2026 (commonly attributed to Mitchell Hashimoto) and its key principle is
   **deterministic enforcement over probabilistic compliance**: telling an agent
   "follow our standards" in a prompt is prompt engineering; wiring a check that
   *blocks* the change when standards are violated is harness engineering. In this
   repo, the harness is:
   - `node install.mjs verify . --strict` — broken knowledge-paths fail
     deterministically instead of relying on the agent's diligence.
   - The provenance rule ("agents must NEVER flip `[inferred]` → `[verified]`") —
     a hard trust boundary, not a suggestion.
   - MODULE_MAP `Stability: frozen` — an enforceable gate consulted before edits.
   - `orient` producing `repo-profile.json` deterministically — facts generated by
     code, not by model recall.

### How they interlock

```
long-term MEMORY (ai/ on disk, versioned, human-verified)
        │  paged in just-in-time…
        ▼
CONTEXT (the finite window: working memory of one session)
        ▲                                   │
        │  …by CONTEXT ENGINEERING          │  writes notes back
        │  (INDEX load patterns, module-map │  (analysis/, lab/,
        │   lookup, subagents, compaction)  ▼   always [inferred])
        └──────────────── enforced by the HARNESS ────────────────
          (verify --strict, provenance rule, stability gates,
           deterministic orient/indepth generators)
```

The loop that matters: **memory feeds context; context engineering keeps the feed
small and relevant; the agent's new conclusions flow back into memory; the harness
guarantees that what flows back is verifiable and cannot silently corrupt the trusted
layer.** Break any link and the system degrades in a predictable way:

- No long-term memory → every session re-derives the repo from scratch (the exact
  cold-start cost this kit exists to eliminate).
- No context engineering → context rot: the map gets pre-loaded wholesale and drowns
  the task.
- No harness → memory rots differently: unverified `[inferred]` claims masquerade as
  truth, paths drift, and agents trust a stale map — worse than no map.

**Positioning takeaway:** ai-fication-kit is best described not as "documentation"
but as a **memory + harness layer for coding agents**: versioned long-term memory
(`ai/`), a context-engineering policy for reading it (`INDEX.md` load patterns +
module-map-first navigation), and a harness that keeps it trustworthy (verify,
provenance, stability gates).

---

## Sources `[inferred]` (checked 2026-07-03; primary pages paywalled/blocked from this environment — summaries via search)

- Anthropic — *Effective context engineering for AI agents* (anthropic.com/engineering):
  context as a finite resource, context rot, compaction, structured note-taking,
  sub-agent architectures, just-in-time retrieval.
- Claude Cookbook — [Context engineering: memory, compaction, and tool clearing](https://platform.claude.com/cookbook/tool-use-context-engineering-context-engineering-tools).
- Martin Fowler (site) — [Harness engineering for coding agent users](https://martinfowler.com/articles/harness-engineering.html).
- Augment Code — [Harness engineering for AI coding agents](https://www.augmentcode.com/guides/harness-engineering-ai-coding-agents):
  "Agent = Model + Harness"; deterministic constraints over probabilistic compliance.
- Faros — [Harness engineering: making AI coding agents work in 2026](https://www.faros.ai/blog/harness-engineering):
  attribution of the term to Mitchell Hashimoto (early Feb 2026); third phase after
  prompt → context engineering.
- Sourcegraph — [Context engineering: a practical guide for AI agents (2026)](https://sourcegraph.com/blog/context-engineering).
- mem0 — [Context engineering AI: how to build smarter LLM agents in 2026](https://mem0.ai/blog/context-engineering-ai-agents-guide):
  short-term vs long-term agent memory, compaction step.
