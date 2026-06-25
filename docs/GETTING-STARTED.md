<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Getting started — zero to a trusted map

This is the one linear path: brand-new to done, in five steps, with a
"how do I know it worked?" checkpoint after each. Budget **~40 minutes** total —
most of it is the agent and the audit working, not you typing.

If a term here is unfamiliar (`[inferred]`, Stability, slash command, …), it's
defined in one line in the [Glossary](GLOSSARY.md). Keep it open in a tab.

---

## Before you start

You need **one** of:
- Node.js ≥ 18, **or**
- Python ≥ 3.8

Both installers are feature-identical and zero-dependency. You also need a repo
to point the kit at — your own, or the bundled sample (see "Try it risk-free"
below).

> **Tip — try it risk-free first.** Want to see the kit work without touching your
> own code? Run it against the bundled example and watch the plan, writing nothing:
> ```bash
> git clone https://github.com/kunalsuri/ai-fication-kit.git
> cd ai-fication-kit
> node install.mjs shazam examples/legacy-calculator --dry-run
> ```
> The [legacy-calculator walkthrough](../examples/legacy-calculator/README.md) takes
> you through the full before/after on that sample.

---

## Step 1 — Scaffold the knowledge layer (`shazam`)

From the kit, point `shazam` at your repository:

```bash
node install.mjs shazam /path/to/your/repo        # or: python install.py shazam ...
```

The first interactive run asks 4–5 short questions (your familiarity with the
code, a **warning if you're on `main`/`master`**, and a chance to correct the
detected stack), then stamps the templates. Pass `--yes` to skip the wizard in CI.

**✅ Checkpoint.** Your repo now contains `CLAUDE.md`, `AGENTS.md`, and an `ai/`
folder. Confirm:
```bash
ls /path/to/your/repo/ai/guide        # MODULE_MAP.md, ARCHITECTURE.md, …
```
The closing message prints your next steps. Nothing here was written by a model
yet — these are blank maps waiting to be filled. Stack misdetected? See
[FAQ.md](FAQ.md) → "orient detected the wrong stack".

---

## Step 2 — Let the agent draft the maps (`/cold-start`)

Open the repo in **Claude Code** (or your agent of choice) and run:

```text
/cold-start
```

It runs ~5 minutes, scanning the code and drafting `MODULE_MAP.md`, diagrams, and
candidate features. **Every line it writes is tagged `[inferred]`** — a guess, not
yet a fact.

> Not using Claude Code? Paste the body of `.claude/commands/cold-start.md` as a
> prompt — see [FAQ.md](FAQ.md#cursor-copilot-codex).

**✅ Checkpoint.** `ai/guide/MODULE_MAP.md` now has real rows (one per directory),
each ending in `[inferred]`. If it still shows placeholder text, `/cold-start`
didn't finish — re-run it.

---

## Step 3 — Audit it (this is the step that matters)

This is the human gate, and the whole method rests on it. Budget ~30 minutes.
Open `ai/guide/MODULE_MAP.md` and, row by row:

1. **Set Stability** — `frozen` / `stable` / `ours` / `?` (definitions in the
   [Glossary](GLOSSARY.md); how to decide in the [Audit Guide](AUDIT-GUIDE.md)).
2. **Flip `[inferred]` → `[verified]` (date)** only on rows you confirmed
   first-hand — you opened the file, ran the command, or already know the module.
   "Sounds plausible" is not evidence.
3. Leave anything you're unsure about as `?` — agents treat `?` as `frozen`, so an
   unaudited row is safe by construction.

The full field guide, with worked examples and common mistakes, is
[AUDIT-GUIDE.md](AUDIT-GUIDE.md). **Read it before you start auditing.**

**✅ Checkpoint.** Every row has a Stability value; the rows you trust read
`[verified] (YYYY-MM-DD)`; the top of the file has a "Last verified" date. Your
`ai/` folder is now a human-approved knowledge-base.

---

## Step 4 — Keep it mechanically honest (`verify` / `drift`)

Two deterministic guards (no LLM) keep the map from quietly rotting:

```bash
node install.mjs verify /path/to/your/repo    # do the docs still match the tree?
node install.mjs drift  /path/to/your/repo    # has the code outgrown the map?
```

Add `--strict` to either to make it exit non-zero — drop that into CI so a stale
map fails the build.

**✅ Checkpoint.** `verify` reports `missing 0  moved 0`. If it flags a path, the
docs lie — fix the doc, not the code.

---

## Step 5 — Build features safely (`/add-feature`)

Now the payoff. Run:

```text
/add-feature
```

The agent writes a spec, navigates using the verified maps, runs your tests, and
updates the knowledge layer — all without touching `frozen` code.

**✅ Checkpoint.** A new spec exists under `ai/lab/specs/`, tests pass, and the diff
stays inside the modules you marked `ours`/`stable`.

---

## Where to go next

| You want to… | Read |
|---|---|
| Understand a term | [GLOSSARY.md](GLOSSARY.md) |
| Do the audit well | [AUDIT-GUIDE.md](AUDIT-GUIDE.md) |
| Troubleshoot detection, monorepos, re-runs | [FAQ.md](FAQ.md) |
| Use Cursor / Copilot / Codex instead | [FAQ.md](FAQ.md#cursor-copilot-codex) |
| See a full before/after on a sample repo | [legacy-calculator](../examples/legacy-calculator/README.md) |
| Understand the code of the kit itself | [FUNCTIONALITY.md](FUNCTIONALITY.md) |
