<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Multi-tool setup — one knowledge layer, every agent

The kit is deliberately **tool-agnostic at the knowledge level**: the `ai/`
folder and the rules in `AGENTS.md` are the same for every agent. What differs
per tool is the *automation* — whether the workflow commands and helper
personas are available natively or driven by hand. This guide covers what each
tool gets and how to run the workflow in it.

**The shared foundation (every tool reads these):**

- `AGENTS.md` — the tool-agnostic rules file at the repo root.
- `CLAUDE.md` — Claude Code's entry point; it imports `AGENTS.md` so the rules
  are written once.
- `ai/` — the knowledge layer itself: maps, architecture docs, feature
  catalogs, specs, ADRs. This is the product; the rest is delivery.

The provenance discipline (`[inferred]` → `[verified]`, Stability gates — see
[METHODOLOGY.md](METHODOLOGY.md)) is identical across every tool. Only the
invocation differs.

---

## What the installer stamps, per tool

One `install` run writes all of these side by side — you don't choose a tool at
install time, and a mixed team can use different tools on the same repo:

| Tool | Assets installed | Invocation |
|---|---|---|
| **Claude Code** | `.claude/commands/`, `.claude/agents/`, `.claude/skills/` | slash commands + subagents, natively |
| **GitHub Copilot** (VS Code) | `.github/copilot-instructions.md`, `.github/prompts/*.prompt.md`, `.github/chatmodes/*.chatmode.md` | prompts + chat modes in Copilot Chat |
| **Google Antigravity** | `.agents/workflows/*.md`, `.agents/skills/add-feature/` | workflows in the Agent Manager |
| **Cursor** | `.cursor/rules/*.mdc` | invoke a rule, same as any other Cursor rule |
| **Codex** | (reads `AGENTS.md` natively — no dedicated tree needed) | manual: paste command bodies as prompts |

## The workflow commands, across tools

All eight commands exist in every native integration — same names, same
behavior, different packaging:

| Command | Claude Code | Copilot Chat | Antigravity | Cursor |
|---|---|---|---|---|
| `cold-start` — draft the maps | `/cold-start` | `/cold-start` (prompt) | `cold-start` workflow | `cold-start` rule |
| `add-feature` — safeguarded development | `/add-feature` | `/add-feature` | `add-feature` workflow | `add-feature` rule |
| `check-drift` — drift diagnostics | `/check-drift` | `/check-drift` | `check-drift` workflow | `check-drift` rule |
| `create-feature-catalog` — mine implemented features | `/create-feature-catalog` | `/create-feature-catalog` | workflow | rule |
| `post-cold-start-verification` — semantic gap audit | `/post-cold-start-verification` | `/post-cold-start-verification` | workflow | rule |
| `review-agent-config` — config consistency gate | `/review-agent-config` | `/review-agent-config` | workflow | rule |
| `verify-ai-readiness` — maturity rating | `/verify-ai-readiness` | `/verify-ai-readiness` | workflow | rule |
| `perform-feature-add-simulation` — dry-run friction check | `/perform-feature-add-simulation` | `/perform-feature-add-simulation` | workflow | rule |

The helper personas exist across tools too:

| Persona | Claude Code | Copilot | Purpose |
|---|---|---|---|
| `repo-explorer` | subagent (`.claude/agents/`) | chat mode (`.github/chatmodes/`) | read-only code location and tracing |
| `feature-builder` | subagent | chat mode | implements planned changes, surgical diffs |
| `test-runner` | subagent | chat mode | runs builds/tests, reports faithfully |

The `add-feature` **skill** is written once, in the shared Agent Skills
(`SKILL.md`) format, under `.agents/skills/add-feature/` and
`.claude/skills/add-feature/` — Copilot and Antigravity both discover the
shared format, so nothing is duplicated per tool.

---

## Claude Code

The most complete integration, and what the main docs assume by default.
`CLAUDE.md` is auto-loaded every session; commands are typed directly
(`/cold-start`, `/add-feature`, …); subagents are delegated to automatically by
the commands (e.g. `/cold-start` sends heavy reading to `repo-explorer` to keep
the main context window clean).

Nothing to configure — open the repo in Claude Code after `shazam` and run
`/cold-start`.

## GitHub Copilot (VS Code)

Copilot reads three things the kit installed:

- **`.github/copilot-instructions.md`** — repository-wide instructions, loaded
  automatically (Copilot's equivalent of `CLAUDE.md`).
- **`.github/prompts/*.prompt.md`** — the eight commands. In Copilot Chat, type
  `/` and the prompt name, e.g. `/cold-start`.
- **`.github/chatmodes/*.chatmode.md`** — the three personas. Switch the chat
  mode in the Copilot Chat mode picker to work as `repo-explorer`,
  `feature-builder`, or `test-runner`.

Copilot also reads `AGENTS.md` and discovers the shared `add-feature` skill.

## Google Antigravity

Antigravity reads the tool-agnostic `AGENTS.md` at the repo root natively — the
kit ships no separate Antigravity rules file because none is needed. The
commands are installed as **workflows** (`.agents/workflows/*.md`), invoked
from the Agent Manager, and the `add-feature` skill is discovered from
`.agents/skills/`.

## Cursor

Cursor gets a native rules tree, `.cursor/rules/*.mdc`: one rule per workflow
command (same content as the Copilot prompts, wrapped in MDC frontmatter —
`description:`, `alwaysApply: false`), plus one `alwaysApply: true` rule
(`ai-knowledge-layer.mdc`) that always points the agent at `ai/INDEX.md` and
the provenance rule. Invoke a workflow rule the same way you would any other
Cursor rule; no manual pasting needed.

## Codex (manual mode)

No dedicated template tree — Codex reads `AGENTS.md` for the rules and the
`ai/` maps for knowledge natively, but the commands are driven by hand:

1. Open the command file you want, e.g. `.claude/commands/cold-start.md`.
2. **Strip the YAML frontmatter** — delete the `---` delimiters at the top and
   everything between them (`description:` etc.). Pasting the metadata confuses
   the model; start from the actual instructions.
3. Paste the remainder into the tool as a prompt.

The provenance rules still apply in full: whatever the tool drafts into `ai/`
is `[inferred]` until *you* flip it.

---

## FAQ pointers

- Which tools get what, in one paragraph: [FAQ.md](FAQ.md#cursor-copilot-codex)
- The agent flipped `[verified]` itself: [FAQ.md](FAQ.md) → "The agent flipped a tag"
- Full command semantics (what each workflow does): the command files themselves
  under `.claude/commands/` are the source of truth and are identical in
  content across the four template trees (Claude, Copilot, Antigravity, Cursor).
