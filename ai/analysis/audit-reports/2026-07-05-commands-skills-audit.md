<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Commands & skills audit — overlap, dead weight, and drift `[inferred]`

**Date:** 2026-07-05 · **Scope:** every Claude command (`.claude/commands/`, 11 files),
skill (`.claude/skills/`, 2 + `.agents/skills/`, 3), and their `templates/` twins
across all four tool integrations. Question asked: *which of the v0.1.x-era and
post-v0.2.0 commands overlap, do nothing, or can be removed?*

**Method:** strict evidence-only pass — per-file git first/last-commit dates, byte
diffs of every local file against its `templates/` twin and its `.agents/` sibling,
content comparison of every command pair with plausible overlap, doc-reference sweep
(README, `docs/`, `ai/`) for orphans, and a check of each command's hardcoded shell
invocations against what actually resolves in a stamped target repo.

## Verdict

**Nothing is safe to delete outright.** All 10 shipped workflow commands exist in
all four integrations (matching the `docs/MULTI-TOOL-SETUP.md` table), every command
is referenced by at least one human-facing doc, local copies are byte-identical to
their `templates/` twins, and the two dogfood-only extras (`/implement-spec`,
`deep-test`) are deliberate. The real issues are one **defect** (F1), one
**within-Claude duplication** (F2), and four drift/overlap items to resolve (F3–F6).

## Findings (P1 agent-blocking → P3 cosmetic)

### F1 · P1 · `/check-drift` breaks in every stamped target repo
`.claude/commands/check-drift.md:9,11` (and its twins `templates/claude/commands/check-drift.md`,
`templates/github/prompts/check-drift.prompt.md`, the Cursor rule, and the Antigravity
workflow) hardcode `node install.mjs verify . --strict` and `node install.mjs drift . --git --strict`.
Those commands only resolve inside the **kit's own checkout** — a target repo has no
`install.mjs`, so step 1 of the shipped command fails immediately.
- Evidence the repo already knows the correct form: `docs/GETTING-STARTED.md:115`
  runs the kit from its checkout with a target path
  (`node install.mjs verify /path/to/your/repo`), and
  `.claude/commands/post-cold-start-verification.md` was patched on 2026-07-02 to say
  *"run from the kit checkout: `node install.mjs verify <repo>`"*. `/check-drift`
  (last touched 2026-06-30, v0.1.2-era) never received the same fix.
- `package.json` declares a `bin` (`ai-fication-kit`), so `npx`-style invocation is
  also available.
- **Fix:** reword the command (all 5 packaging twins + local dogfood copy) to the
  kit-checkout form or the `bin` form. Works-by-accident in this repo only because
  the dogfood target *is* the kit checkout.

### F2 · P1 · `add-feature` and `fix-bug` are each registered twice in Claude Code
`.claude/commands/add-feature.md` *and* `.claude/skills/add-feature/SKILL.md` both
register as invocable entries (observed live: this session's skill list shows two
`add-feature` and two `fix-bug` entries with different descriptions). The command
wrapper does not just point at the skill — it **restates the full 7-step contract**,
so the protocol is maintained twice per workflow inside one tool's tree (and the
Copilot prompt + Cursor rule are further copies by design). They are in sync today,
but only because the Unreleased engineering-loop PR edited both in lockstep; the two
descriptions have already diverged.
- **Fix (recommended):** shrink each command body to a two-line pointer ("Run the
  `add-feature` skill; the contract lives in `.claude/skills/add-feature/SKILL.md`")
  in both the local and `templates/claude/commands/` copies. Keeps the slash-command
  file for older-client parity while leaving exactly one canonical contract per tool.
  Outright deletion of the command files also works on current Claude Code (skills
  are slash-invocable) but sacrifices that parity for no extra gain.

### F3 · P2 · `docs/MULTI-TOOL-SETUP.md` single-source claim is false
The doc states the skills are *"written once, in the shared Agent Skills (`SKILL.md`)
format, under `.agents/skills/` and `.claude/skills/` … so nothing is duplicated per
tool."* Byte diff says otherwise: the `.claude` variants delegate to the
`repo-explorer`/`feature-builder`/`test-runner` subagents; the `.agents` variants
inline that behavior (no subagents in Antigravity). The **divergence is sensible**;
the doc sentence is not. **Fix:** reword to "same contract, tool-appropriate
delegation" — do not actually unify the files.

### F4 · P2 · `/verify-ai-readiness` re-derives what `doctor`/`status` now compute
The command's 5-level scale (0 Opaque → 4 Maintained, authored 2026-06-27, untouched
since) maps ~1:1 onto the post-v0.2.0 deterministic `doctor` five-stage detector
(`lib/doctor.mjs`) and `status`'s TRUSTED / NEEDS AUDIT / DRIFTING verdict
(`lib/status.mjs`): MODULE_MAP existence, `[inferred]`-row counts, verified-row
ratio, manifest health are all now mechanical facts. The repo already set the
precedent for this exact situation: `post-cold-start-verification.md` gained a
*"Step 0 — use the mechanical verifier's output, don't redo its job"* section.
- **Fix:** give `/verify-ai-readiness` the same Step 0 (read `doctor`/`status` /
  `STATUS.json` output first; spend the LLM pass only on the semantic half:
  per-area evidence quality, conventions, agent-blocking gaps). **Not** a removal —
  it is the only per-area semantic assessment and is cited by README,
  `docs/METHODOLOGY.md`, and `docs/AUDIT-GUIDE.md`.

### F5 · P3 · `review-agent-config` ↔ `post-cold-start-verification` shared slice
Both check placeholders and build/test-command consistency in `CLAUDE.md`/`AGENTS.md`
(RAC checks C5–C8/A10/X3 vs PCSV checks 1 and 3). RAC's "What this skill does NOT do"
section delineates the two commands but does not mention this overlap. Acceptable as
a fast-gate/deep-pass pair; if tightened, scope PCSV checks 1 and 3 to `ai/` files
only and let RAC own the entry files.

### F6 · P3 · `deep-test` skill invisible to Claude Code
`.agents/skills/deep-test/SKILL.md` (added 0.1.2) wraps the kit's own release-health
script (`npm run deep-test`) but has no `.claude/skills/` mirror, so Claude Code
sessions in the kit repo cannot discover it — unlike the other dogfood-only extra
`/implement-spec`, whose Claude-side copy and rationale both exist
(`docs/IMPLEMENT-SPEC.md`). Its mechanical core (verify + drift) also overlaps
`/check-drift`, though the audiences differ (kit release-gate vs stamped-repo
maintenance). **Fix:** add a `.claude/skills/deep-test/` mirror, or a one-line
pointer in `CLAUDE.md`'s build/test section.

## Explicitly cleared — checked, keep as-is

| Candidate | Suspicion | Evidence it stays |
|---|---|---|
| `/implement-spec` vs `/add-feature` | overlapping implementation flows | Distinction documented (`docs/IMPLEMENT-SPEC.md` — spec-faithful second half for pre-hardened specs, lighter models); dogfood-only status recorded there and in `ai/lab/WORKLOG.md` W-004. |
| `/perform-feature-add-simulation` | "does it do anything?" | Unique function: add-feature phases 1–3 as a no-write pre-flight; referenced by README, `docs/AUDIT-GUIDE.md`, tech report. No other command produces a friction report. |
| `/cold-start`, `/create-feature-catalog`, `/review-change` | age / overlap | Single-purpose, mutually referenced (cold-start's stop condition names the two audit commands), no duplicated contract. |
| v0.1.0-era leftovers | orphaned files | None found: local `.claude/commands/` byte-identical to `templates/claude/commands/`; `.agents/` matches `templates/agents/` except the two documented dogfood extras; every shipped command appears in all four integrations and the docs table. |

## Suggested resolution order
1. **F1** — fix the shipped `/check-drift` invocation (defect in every target repo).
2. **F2** — collapse the command-wrapper duplication to pointers.
3. **F4** — Step-0 mechanical-first preamble for `/verify-ai-readiness`.
4. **F3** — one-sentence doc correction.
5. **F5/F6** — batch with the next hygiene pass.

*Report is `[inferred]` — a human audits before any file above is changed or removed.*
