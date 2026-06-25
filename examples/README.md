<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# examples/ — worked example repositories

Worked examples demonstrating how a legacy codebase is transformed into an AI-native workspace:

| Example | Stack | Status |
|---|---|---|
| `legacy-calculator/` | JavaScript (Node.js stdlib) | **Available now in v0.1.0** — zero dependencies, ready for local execution |
| `value-demo/` | JavaScript (Node.js stdlib) | **What the map is worth** — `node value-demo/measure.mjs` measures the context an agent reads to do one task, with vs. without the map (deterministic, no model) |

---

## The Transformation: `legacy-calculator` Before & After

Here is a visual folder comparison showing exactly what is added when you run the kit and the agent cold-starts the codebase.

### 1. Before `shazam` (Untouched Legacy State)
A simple, bare codebase containing only code and tests:

```text
legacy-calculator/
├── .gitignore               ← tracks calculator source files only
├── calculator.js            ← legacy calculator arithmetic logic
├── package.json             ← workspace description & test script
└── test.js                  ← dependency-free test runner
```

### 2. After `shazam` & `/cold-start` (AI-Native Audited State)
The kit scaffolds the agent instructions, custom slash commands, subagents, and the provenance-tracked `ai/` folder. Run it yourself in about a minute (see [Running the Example](#running-the-example) below) — the [legacy-calculator walkthrough](legacy-calculator/README.md) shows exactly what is generated at each stage:

```text
legacy-calculator/
├── .gitignore
├── calculator.js
├── package.json
├── test.js
├── CLAUDE.md                ← auto-loaded project memory for Claude Code
├── AGENTS.md                ← tool-agnostic agent rules (for Cursor, Copilot, Windsurf)
├── .claude/                 ← Claude Code workspace automation
│   ├── agents/              ← specialized subagents (repo-explorer, feature-builder)
│   ├── commands/            ← slash commands (/cold-start, /add-feature)
│   └── skills/              ← complex automation skills (add-feature)
└── ai/                      ← the provenance-tracked knowledge layer
    ├── INDEX.md             ← role → path manifest
    ├── repo-profile.json    ← machine-readable stack profile (orient output)
    ├── install-manifest.json← list of files written by the installer
    ├── guide/               ← audited navigation (start here!)
    │   ├── MODULE_MAP.md    ← module boundary & stability audit map
    │   ├── ARCHITECTURE.md  ← core architecture guide
    │   ├── CONVENTIONS.md   ← coding style & exemplary files
    │   └── PROJECT_OVERVIEW.md
    ├── analysis/            ← generated on-demand reports
    │   ├── FEATURE_CATALOG.md ← deep-mined full-stack features index
    │   └── diagrams/        ← Mermaid diagrams (dependency graphs, core flows)
    └── lab/                 ← development intelligence
        ├── decisions/       ← Architecture Decision Records (ADRs)
        ├── specs/           ← spec-first specifications
        └── evaluations/     ← retrospects of implemented features
```

### Running the Example
To test this transformation yourself, run the following command from the root of the kit's repository:
```bash
# Orient & install the kit templates
node install.mjs shazam examples/legacy-calculator
```

To clean up the generated files and revert the workspace:
```bash
# Clean uninstall
node install.mjs uninstall examples/legacy-calculator
```

