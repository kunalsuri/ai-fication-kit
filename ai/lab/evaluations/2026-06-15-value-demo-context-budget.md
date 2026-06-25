<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# EVAL: context budget — does the map cut what an agent must read?
> **Date:** 2026-06-15 · **Subject:** `examples/value-demo/sample-app` · **Task:** add a discount-code field to invoices (`sample-app/TASK.md`)

## Why this eval exists
The kit claims the `ai/` map reduces the context an agent must load. This eval pins
that claim to a number two ways: a **deterministic proxy** (reproducible by anyone)
and a **live A/B** (real agent, real tokens) that checks the proxy against reality.

## Part A — deterministic proxy (reproducible, no model)
Measured by `examples/value-demo/measure.mjs`, which sums the bytes an agent must
read to locate + edit safely and estimates tokens at ~4 bytes/token.

| Approach | Files read | ~Tokens |
|---|---|---|
| Without the map (crawl `src/` + `test/`) | 13 | ~2604 |
| With the map (`MODULE_MAP.md` + `INDEX.md` + touch set) | 5 | ~842 |
| **Result** | | **~3.1× less · ~68% saved** |

This is `[verified]` only as a *byte/context* measurement: it runs deterministically
and the command is in-repo. It is **not** a claim about live API spend — see Part B.

### Honest limits of the proxy
- It counts each file once; a real agent may re-read, grep, and backtrack (which
  tends to favor the map even more) — so this is a conservative floor.
- The sample app is tiny on purpose. The "without" cost scales with the whole
  codebase; the "with" cost does not. Expect a larger gap on real repos.
- It measures *input context*, not output quality or correctness.

## Part B — live agent A/B  ⚠️ measure live (not yet run)
To validate the proxy, run the *same* task twice in a real agent and record the
session's reported token usage. Do not fill these from memory — paste real numbers.

| Run | Setup | Input tokens | Output tokens | Wrong files opened | Notes |
|---|---|---|---|---|---|
| A (no map) | delete/ignore `ai/`, give only the task | ⚠️ | ⚠️ | ⚠️ | |
| B (with map) | keep verified `ai/`, give the task | ⚠️ | ⚠️ | ⚠️ | |

Expected direction: B reads less and opens fewer wrong files than A. If it does not,
that is a finding about the map's quality, and belongs in `ai/lab/` as an issue.

## What we change next time
- If Part B diverges sharply from Part A's ~3×, revisit the bytes→tokens heuristic
  and the "what an agent must read" assumption in `measure.mjs`.
- Consider promoting `measure.mjs` into a kit command so any repo can self-report
  its context budget, not just the bundled demo.
