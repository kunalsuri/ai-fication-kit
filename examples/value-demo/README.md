<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# value-demo — what is the `ai/` map actually worth?

The kit's claim is simple: **a verified map lets an agent read a fraction of the
code to do a task safely.** This demo lets anyone *see* that in one command — with
no API key, no model, and no network, so the numbers are exactly reproducible.

## Run it

```bash
node examples/value-demo/measure.mjs
```

## What it measures

It takes one fixed task — [`sample-app/TASK.md`](sample-app/TASK.md) ("add a
discount-code field to invoices") — and compares the **context an agent must read
to locate and edit safely**, two ways:

| Approach | What the agent reads | Why |
|---|---|---|
| **Without the map** | the whole `src/` + `test/` tree | it can't know which files matter, so to be safe it reads everything |
| **With the map** | `ai/guide/MODULE_MAP.md` + `ai/INDEX.md` + the task's touch set | the map points it straight at the billing module and its test |

The script sums file bytes and converts to a rough token estimate (~4 bytes/token).
This is **readable context, not live API spend** — there is no model here — but real
token usage tracks it closely.

## Result (this sample app)

```
WITHOUT the map — read the whole source tree (13 files)   ~2604 tokens
WITH the map    — read the index + the task's touch set (5 files)   ~842 tokens
RESULT:  ~3.1× less, ~68% saved
```

This is a **deliberately tiny** repo, so treat 3× as the floor, not the ceiling.
The "without" cost scales with the size of the *whole codebase*; the "with" cost is
bounded by the map plus the files the task actually touches. On a real legacy repo
with hundreds of files, the gap is far larger — the map's fixed cost stays flat
while the crawl cost keeps growing.

## It also stays honest as code changes

The same map is checked mechanically. From the kit root:

```bash
node install.mjs verify examples/value-demo/sample-app   # do the quoted paths exist?
node install.mjs drift  examples/value-demo/sample-app   # what has the code outgrown?
```

`verify` confirms every path the map quotes; `drift` reports directories the map
doesn't cover, entries that have vanished, and (with `--git`) verified rows whose
code changed since they were last verified. Together they keep the savings above
from rotting into a stale, misleading map.

## A real-agent case study

The measurement here is a deterministic *proxy*. A dated, human-run A/B with a live
agent — same task, with and without `ai/`, real session token counts — lives in
[`ai/lab/evaluations/`](../../ai/lab/evaluations/) so the proxy can be checked
against reality.
