<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: <feature name>
> **Status:** draft | approved | implemented
> **Author:** <name, or "AI draft"> · **Date:** <YYYY-MM-DD> · **Revision:** <n>

<!-- Scale this template to the change: a small feature fills every section in a
     few lines (one-row tables are fine); a protocol or subsystem spec grows §4
     into numbered subsections — see the MCP KB server spec
     (SPEC_mcp-kb-server.md in the ai-fication-kit repo) for the
     implementation-grade example this template is modeled on.
     Do NOT delete sections: §2 and §5–§8 are the hand-off contract any
     spec-faithful implementer reads first (in the kit's own repo, the
     kit-only /implement-spec command consumes them mechanically).
     The human flips Status draft → approved; implementation starts only from
     an approved spec. -->

This spec is written to be implemented **without further design decisions**.
Read the whole spec before writing code. Where the implementer is tempted to
improvise, the spec says what to do instead. Design rationale lives in
<doc path, or "—">; read it once, then implement from *this* document.

## 1. Goal
<One paragraph: what the user can do after this ships, and why it matters.
Name what must stay true afterward (invariants), not only what changes.>

## 2. Hard constraints (violating any of these fails the review)
| # | Constraint |
|---|---|
| C1 | <e.g. zero new runtime dependencies> |
| C2 | <e.g. no changes to module X — import its exports, do not reimplement> |
| C3 | Match the license-header practice of neighboring files (including having none). |
| C4 | Surgical diffs: touch only the files in §5; no reformatting of untouched code. |

## 3. Scope & glossary
**In:** <bullets> · **Out (explicitly — do NOT build now):** <bullets>

Terms the implementer could misread, each with its pitfall spelled out:
- **<term>** — <definition; e.g. "table columns match by POSITION, not header text">

## 4. Behaviour (exact)
<The design decisions, made HERE so the implementer makes none. Exact shapes:
function signatures, input/output formats, error cases with their expected
handling, edge-case rules. Grow into numbered subsections (§4.1, §4.2 …) as
needed. Where existing code is to be reused, say "import X from <path> — do
not reimplement". If you provide a code skeleton, it is contractual:
structure, export names, and file layout are not suggestions.>

## 5. Touch list (complete — nothing else changes)
| Layer | Location | Stability (from MODULE_MAP) | Change |
|---|---|---|---|
| <UI / backend / data / tests / docs> | <path> | <ours / stable / frozen / ?> | <add / modify> |

Stability check: <"no `frozen` or `?` files touched" — or quote the human's
approval and its date here>. `frozen` or `?` anywhere in this table without a
recorded approval ⇒ the spec is blocked, not the implementer's call.

## 6. Test plan (numbered — the implementer implements every row)
Harness: <existing runner and style to follow, and where the tests live>.
| # | Test | Assertion |
|---|---|---|
| T1 | <name> | <one observable assertion> |
| T2 | <…> | <…> |

## 7. Acceptance criteria (definition of done)
1. All §2 constraints hold; the diff matches §5 exactly.
2. <test suite command> green including the §6 tests; <verify command> passes.
3. <The contract-critical observable(s) — name the §6 test a shortcut would
   break; failing it fails the whole change.>

## 8. Knowledge update on completion (part of the change, not an afterthought)
- [ ] FEATURE_MAP.md entry added/updated (+ any gotcha found on the way)
- [ ] FEATURE_CATALOG.md amended (if it exists)
- [ ] MODULE_MAP.md rows still accurate — new/changed rows `[inferred]`, never
      self-flipped to `[verified]`
- [ ] WORKLOG.md row appended linking this spec, the review, and the commits
- [ ] This spec's Status → `implemented` (the human flips it after audit)
