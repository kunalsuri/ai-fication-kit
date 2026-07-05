<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Dev-loop template audit — is every loop mechanism shipped to end users? `[inferred]`

**Date:** 2026-07-05 · **Trigger:** maintainer question — "is `/implement-spec` in the
templates? Verify each item needed for the dev loop is there for an end user; simulate
a new user and an updating user."

**Method:** stage-by-stage inventory of the engineering loop against `templates/`,
plus two live installer runs into a scratch git repo (fresh `shazam`, then update-mode
re-run after a user edit), plus a mutated-kit run proving the promotion path.

## Verdict

The maintainer's suspicion is **confirmed**: `/implement-spec` is absent from all four
distribution surfaces (`templates/claude/commands/`, `templates/agents/workflows/`,
`templates/cursor/rules/`, `templates/github/prompts/`). This matches the recorded
deferred decision (`ai/lab/WORKLOG.md` W-004; the Out-list of
`ai/lab/specs/SPEC_engineering-loop-sync.md`) — it is a known product decision, not an
accidental omission. **Every other loop stage is fully mechanism-backed in the
templates.** End users can run Spec → Decide → Implement (via `/add-feature` /
`/fix-bug`) → Review → Evaluate → Record today; what they cannot run is the
spec-faithful, zero-design-decision Implement variant.

## Stage-by-stage inventory (what a stamped repo receives)

| Loop stage | Mechanism in `templates/` | Status |
|---|---|---|
| Spec | `templates/ai/lab/specs/SPEC_TEMPLATE.md` (implementation-grade, W-008 shape), `templates/ai/lab/specs/BUGFIX_TEMPLATE.md` | ✓ shipped |
| Decide | `templates/ai/lab/decisions/ADR_TEMPLATE.md` | ✓ shipped |
| Implement (design latitude) | `add-feature` + `fix-bug` in all 4 surfaces + both skills + `feature-builder`/`repo-explorer`/`test-runner` subagents & chatmodes | ✓ shipped |
| Implement (spec-faithful) | `/implement-spec` | ✗ **not shipped** (kit `.claude/commands/implement-spec.md` only) |
| Review | `review-change` in all 4 surfaces + `templates/ai/lab/reviews/REVIEW_TEMPLATE.md` | ✓ shipped |
| Evaluate | `templates/ai/lab/evaluations/EVALUATION_TEMPLATE.md` | ✓ shipped |
| Record | `templates/ai/lab/WORKLOG.md.tmpl` + always-on Record rule in `templates/CLAUDE.md.tmpl` (l.24), `templates/AGENTS.md.tmpl` (l.26), `templates/claude/rules/ai-knowledge-layer.md`, `templates/cursor/rules/ai-knowledge-layer.mdc`, `templates/github/copilot-instructions.md` | ✓ shipped |
| Canonical loop text | `templates/ai/lab/README.md.tmpl` — Spec → Decide → Implement → Review → Evaluate → Record, steps 7–8 optional | ✓ shipped |
| Optional Learn/Archive | `templates/ai/lab/experiments/EXPERIMENT_TEMPLATE.md` | ✓ shipped |
| Pre-flight / audit gates | `perform-feature-add-simulation`, `review-agent-config`, `post-cold-start-verification`, `verify-ai-readiness`, `check-drift` in all 4 surfaces | ✓ shipped (but see F3) |

## Findings

### F1 · `/implement-spec` missing from all four template surfaces
10 commands per surface ship; the kit's own `.claude/commands/` has 12
(`implement-spec` + local-only `check-docs`). Even inside the kit repo the command is
Claude-only — `.cursor/rules/` (10 command rules + the always-on `ai-knowledge-layer`
rule, 11 files) and `.github/prompts/` (10 prompts) never had it.
Consequence for end users: the loop's spec-faithful Implement lane — the piece built
for lighter implementation models — is unavailable in every stamped repo.

### F2 · The shipped spec template advertises the missing consumer
`templates/ai/lab/specs/SPEC_TEMPLATE.md` (l.13) tells users its §2 and §5–§8 are the
hand-off contract that "the kit-only /implement-spec command consumes … mechanically."
Honest labeling, but W-008 explicitly rebuilt this template as "groundwork for the
/write-spec → /implement-spec loop" — the contract ships, its mechanical consumer
does not. This is the doc-level symptom of F1.

### F3 · The dogfood command is NOT target-repo-safe as-is (promotion blocker)
`.claude/commands/implement-spec.md` cannot be copied into `templates/` verbatim:
- l.24 and l.55 hardcode `node install.mjs verify . --strict` — resolves only in the
  kit's own checkout (identical defect class to the shipped `/check-drift`, finding F1
  of `ai/analysis/audit-reports/2026-07-05-commands-skills-audit.md`, still open).
- l.62 cites `ai/lab/specs/SPEC_engineering-loop.md` — a kit-repo file that stamped
  repos never receive (the loop lives in their `ai/lab/README.md`).
- l.23 and l.55 hardcode `npm test`; the templates otherwise stamp `{{TEST_COMMAND}}`.

## Simulation evidence

**New user** — `node install.mjs shazam <fresh-git-repo> --yes` from the kit checkout:
86 files stamped; 10 commands in `.claude/commands/`, 10 Antigravity workflows, 11
Cursor rules (10 + `ai-knowledge-layer`), 10 Copilot prompts; all six `ai/lab/`
template families present; `verify --strict` on the stamped repo: 37/37 claims
confirmed. `grep -r implement-spec` in the stamped repo hits exactly one line — the
SPEC_TEMPLATE "kit-only" note (F2). Result: complete loop except the spec-faithful
Implement lane.

**Existing user (update)** — user edits their stamped `CLAUDE.md`, re-runs `shazam`:
installer auto-switches to update mode, reports `keep (edited since install)` for the
edited file, `83 file(s) already up to date`, rewrites only the orient profile and
manifest, postflight no-worse-than-preflight. No mechanism ever delivers
`/implement-spec` because it is not in `templates/`.

**Promotion proof** — a scratch copy of the kit with
`templates/claude/commands/implement-spec.md` added, re-run against the same stamped
repo: the update prints `write (new)  .claude/commands/implement-spec.md`, installs 3
files, still keeps the user's edited `CLAUDE.md`, and records the new file in
`ai/install-manifest.json` (so uninstall stays clean). **Existing users need no
migration — the next `shazam`/`update` delivers a promoted command automatically.**

## If the W-004 decision is flipped (promotion checklist)

1. Port the command text to target-repo-safe wording: verify step in kit-checkout /
   `bin` form (fix together with the open `/check-drift` defect), loop reference →
   the stamped `ai/lab/README.md`, test step → the repo's stamped test command.
2. Author the four template twins (`templates/claude/commands/implement-spec.md`,
   `templates/agents/workflows/implement-spec.md`,
   `templates/cursor/rules/implement-spec.mdc`,
   `templates/github/prompts/implement-spec.prompt.md`) **and** the three missing
   dogfood mirrors (`.agents/workflows/`, `.cursor/rules/`, `.github/prompts/`) —
   the kit's parity convention is all-four-surfaces, template ≡ dogfood.
3. Update `templates/ai/lab/specs/SPEC_TEMPLATE.md` l.13 (drop "kit-only") in both
   copies, and the Implement row of `templates/ai/lab/README.md.tmpl` + live twin.
4. Docs: `docs/MULTI-TOOL-SETUP.md` ("All ten commands" + table), `docs/IMPLEMENT-SPEC.md`
   (dogfood-only rationale), `README.md` roster, `docs/METHODOLOGY.md` §7,
   `docs/GLOSSARY.md`, `docs/reports/technical-report-draft.md` §9.5 ("kit-only").
5. Regenerate `CHECKSUMS.txt` via `make-checksums.sh` (it hashes every `templates/`
   file). No installer or test changes needed: `lib/installer.mjs` walks `templates/`
   recursively and `test/run-tests.mjs` pins no roster counts.
6. WORKLOG row superseding the W-004 deferral.

*Report is `[inferred]` — the promotion itself remains the maintainer's decision (W-004).*
