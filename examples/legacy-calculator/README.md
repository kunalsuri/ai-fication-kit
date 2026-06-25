<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# legacy-calculator — a worked before/after walkthrough

A tiny, zero-dependency calculator that stands in for a "legacy" codebase: just
source and tests, no map, no agent instructions. Use it to watch the kit work
end-to-end **without touching any repo of your own.**

```text
legacy-calculator/
├── calculator.js   ← arithmetic logic (add, subtract, multiply, divide)
├── test.js         ← dependency-free test runner
├── package.json    ← "test": "node test.js"
└── .gitignore
```

It works on its own — that's the point. A legacy repo runs fine; what it lacks is
a *map* an AI agent (or a new teammate) can trust.

```bash
# from this folder — the code already passes its own tests
node test.js          # → Test results: 6/6 tests passed.
```

---

## Run the kit on it (≈1 minute)

From the **root of the ai-fication-kit checkout**:

```bash
# 1 · Preview — writes nothing, just shows the plan
node install.mjs shazam examples/legacy-calculator --dry-run

# 2 · Scaffold for real (the wizard self-skips here; add --yes to be explicit)
node install.mjs shazam examples/legacy-calculator --yes
```

You'll see the installer stamp ~34 files and print the next steps.

### After `shazam` — what was added

The installer is deterministic: it adds the agent instructions and the *blank*
knowledge layer. It does **not** run a model and does **not** touch
`calculator.js`, `test.js`, or `package.json`.

```text
legacy-calculator/
├── calculator.js            ← unchanged
├── test.js                  ← unchanged
├── package.json             ← unchanged
├── CLAUDE.md                ← NEW · auto-loaded project memory for Claude Code
├── AGENTS.md                ← NEW · tool-agnostic rules (Cursor, Copilot, Codex)
├── .claude/                 ← NEW · slash commands, subagents, the add-feature skill
└── ai/                      ← NEW · the provenance-tracked knowledge layer
    ├── INDEX.md             ·  role → path manifest
    ├── repo-profile.json    ·  deterministic stack facts from orient
    ├── install-manifest.json·  exactly what was written (for clean uninstall)
    ├── guide/               ·  MODULE_MAP.md (start here) + ARCHITECTURE / CONVENTIONS / …
    ├── analysis/            ·  generated reports + diagrams (filled on demand)
    └── lab/                 ·  specs, ADRs, evaluations
```

At this point the maps are **blank templates**. Nothing is `[verified]`; nothing
is even drafted yet — that's the next step, and it needs an agent.

### After `/cold-start` and your audit — what it becomes

Open the folder in Claude Code and run `/cold-start`. The agent drafts the map
rows (every one tagged `[inferred]`), then **you** audit: set each module's
Stability and flip the rows you trust to `[verified]`. The audited
`MODULE_MAP.md` ends up looking like this:

```markdown
# Module map — directory → responsibility → entry point

> Last verified: 2026-06-15 @ commit a1b2c3d4

| Directory | Responsibility (one line) | Entry point | Stability | Status / Provenance |
|---|---|---|---|---|
| `calculator.js` | Arithmetic ops with type/divide-by-zero guards | `calculator.js` | ours | [verified] (2026-06-15) |
| `test.js` | Dependency-free assertion runner | `test.js` | ours | [verified] (2026-06-15) |
```

For a guided account of *how* to do that audit well, see
[../../docs/AUDIT-GUIDE.md](../../docs/AUDIT-GUIDE.md).

---

## Clean up

```bash
# Removes exactly what the installer wrote; your calculator files stay untouched
node install.mjs uninstall examples/legacy-calculator --yes
```

New to the whole workflow? Start with the linear
[Getting Started guide](../../docs/GETTING-STARTED.md).
