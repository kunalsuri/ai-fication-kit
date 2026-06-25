<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# ai/ — repository intelligence for ai-fication-kit

This folder is the knowledge layer that makes the repo legible to AI coding agents —
**with a human in the loop**. Everything an agent writes here is tagged `[inferred]`
until a human audits it to `[verified]`.

Once verified, this folder is also the team's **AI-Powered Repo Intelligence**: a
human-approved knowledge-base that a new teammate (or their agent) can read to onboard
almost instantly, instead of reverse-engineering the codebase by hand.

## Role → path manifest

Commands and prompts reference *roles*; this table maps roles to paths. If paths ever
change, update this one file.

| Role | Path | Authored by | Load pattern |
|---|---|---|---|
| Machine-readable repo facts | `ai/repo-profile.json` | `orient` (deterministic) | any time |
| Navigation guide | `ai/guide/` | agent drafts, human verifies | every agent session |
| Module map (start here) | `ai/guide/MODULE_MAP.md` | agent drafts, human verifies | every agent session |
| Generated analysis | `ai/analysis/` | agent/tools | on demand per task |
| Feature catalog | `ai/analysis/FEATURE_CATALOG.md` | `/create-feature-catalog` | on demand |
| Diagrams (Mermaid) | `ai/analysis/diagrams/` | `/cold-start`, regenerate don't hand-edit | on demand |
| Development intelligence | `ai/lab/` | human (+ AI drafts) | when planning/reviewing |
| Decisions (ADRs) | `ai/lab/decisions/` | human | when planning |
| Feature specs | `ai/lab/specs/` | human + AI draft | per feature |
| Evaluations | `ai/lab/evaluations/` | human | post-ship |
| Experiments | `ai/lab/experiments/` | human + AI | when trying new agent approaches |
| Install manifest | `ai/install-manifest.json` | installer | uninstall only |
| Maturity report | `ai/analysis/audit-reports/MATURITY_REPORT.json` | `check-repo-maturity` | on demand |
| Prior config backup | `CLAUDE_bkp_*.md` / `AGENTS_bkp_*.md` | installer (from user files) | /cold-start only |

## The provenance rule (read this twice)

- `[inferred]` — written by an agent or tool; a guess until checked.
- `[verified]` — a human confirmed it, with the date.
- Agents must NEVER flip `[inferred]` to `[verified]`. That flip is the human's
  signature, and it is what makes this layer trustworthy.

Installed by ai-fication-kit 0.1.0 on 2026-06-17.
