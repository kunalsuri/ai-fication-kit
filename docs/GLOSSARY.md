<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# Glossary — the vocabulary of the kit

One-line definitions of every term the kit assumes you know. New here? Read this
once and the rest of the docs will read smoothly. Each entry links to where the
concept is explained in depth.

## Core trust model

- **Provenance** — knowing *who* produced a claim and *whether a human checked it*.
  The kit's whole design is provenance tracking: every fact is tagged with its trust
  level. (README → "The Problem & The Solution".)
- **`[inferred]`** — a tag meaning "drafted by the installer or the AI agent, **not yet
  checked by a human**." Treat it as a plausible guess, not a fact.
- **`[verified]`** — a tag a **human** adds after confirming a claim first-hand. It is
  your signature. Agents are forbidden from writing this tag themselves — the flip is
  yours alone. The audit is where `[inferred]` becomes `[verified]`. (See
  [AUDIT-GUIDE.md](AUDIT-GUIDE.md).)
- **Stability** — the column in `MODULE_MAP.md` that gates every future agent edit. Each
  module is one of:
  - **`frozen`** — hands off (upstream/vendor/legacy code you can't confidently review).
  - **`stable`** — change carefully, with tests; not where new work lands by default.
  - **`ours`** — the active surface you own and expect agents to modify routinely.
  - **`?`** — unaudited. Agents treat `?` as `frozen`, so it is safe by default.

  How to decide each value: [AUDIT-GUIDE.md](AUDIT-GUIDE.md) → "Deciding Stability".

## The artifacts

- **`MODULE_MAP.md`** — the map's heart: directory → one-line responsibility → entry
  point → Stability. **Start here** to locate anything in a repo.
- **`ai/` folder** — the knowledge layer the kit scaffolds inside *your* repo. Once a
  human verifies it, it is your single source of truth — read by agents *and* by new
  teammates onboarding.
- **`repo-profile.json`** — machine-readable stack facts produced deterministically by
  `orient` (languages, build/test commands, fork status). No guessing, no LLM.

## The commands

- **`orient`** — deterministic scan. Reads marker files (`package.json`, `pom.xml`, …)
  and writes `repo-profile.json`. No model, nothing executed.
- **`shazam`** — the one-shot entry point: runs `orient` → first-run wizard → stamps the
  templates. This is what most people run first.
- **`install`** — just the template-stamping step of `shazam` (no scan/wizard).
- **`verify`** — mechanically cross-checks every file-path claim in the docs against the
  real tree. Catches docs that have gone stale. No LLM.
- **`drift`** — the reverse of `verify`: reports code the map has stopped covering as the
  repo evolves.
- **`uninstall`** — removes exactly what the installer wrote (via the manifest), cleanly.

## AI-agent terms

- **AI coding agent** — an assistant (Claude Code, Cursor, Copilot, Codex) that can read
  files, run commands, and edit across a codebase — not just autocomplete.
- **Claude Code** — Anthropic's command-line coding agent. Its commands are typed with a
  leading slash (e.g. `/cold-start`).
- **Context window / tokens** — an agent's working memory. Large repos overflow it, which
  is why the kit builds a compact map the agent reads instead of re-crawling the tree.
- **Slash command** — a Claude Code action like `/cold-start` or `/add-feature`. Other
  tools don't have these; you paste the command file's body as a prompt instead (see
  [FAQ.md](FAQ.md#cursor-copilot-codex)).
- **`/cold-start`** — the slash command that makes the agent draft the maps. Everything it
  writes is `[inferred]`, awaiting your audit.
- **Subagent** — a helper process the main agent spawns for an isolated job:
  `repo-explorer` (find code), `feature-builder` (implement), `test-runner` (verify).

---

New to all of this? Follow the linear path in [GETTING-STARTED.md](GETTING-STARTED.md).
