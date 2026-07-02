<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Post-cold-start audit — 2026-07-02  `[inferred]`

> Written by an agent audit pass (`/post-cold-start-verification`). Everything below
> is `[inferred]` until a human confirms it. Files audited were NOT modified.
>
> **Mechanical baseline (facts, not judgement):**
> - `node install.mjs verify . --strict` → 11 docs scanned, **116/116 claims confirmed** (0 moved, 0 missing).
> - `node install.mjs drift . --git` → 9 mapped modules, **0 unmapped / 0 vanished / 0 stale** — but see P1-1: the stale check was *skipped*, not passed.
> - `npm test` → **189/189 checks passed** (both Node and Python runtimes).
> - Provenance hygiene: clean — every `[verified]` row carries a date; no agent-written content carries `[verified]`.
> - `.claude/` is byte-identical to `templates/claude/` (no template drift).
> - CLAUDE.md/AGENTS.md build & test commands (`npm install` / `npm test`) match `ai/repo-profile.json`. No divergence.

## What the ai/ layer gets right (confirmed against source)

- `MODULE_MAP.md` rows match the real tree; Stability and per-row `[verified]` dates are consistent with the audit protocol.
- `ARCHITECTURE.md` correctly names all eight `lib/` modules and their outputs (`repo-profile.json`, `repo-indepth.json`, audit reports) — more complete than `install.mjs`'s own header comment (see P2-6).
- `PROJECT_OVERVIEW.md` stack facts check out: `package.json` really defines no `build` script; both runtimes are zero-dependency; `npm test` runs `test/run-tests.mjs`.
- `FEATURE_MAP.md` entries for orient/indepth/install/drift/maturity/deep-test/ci-checks match the code (spot-checked: orient's build-system dedup, drift's opt-in `--git` stale check, deep-test's license-header and placeholder enforcement).

## P1 — agent-blocking / a safety control is silently off

1. **`ai/guide/MODULE_MAP.md:7` — placeholder verified-commit SHA disables the stale check everywhere.**
   `Last verified: 2026-06-25 @ commit <set to the release commit sha when tagging>` was never filled in. Consequence, reproduced live: `node install.mjs drift . --git` prints *"MODULE_MAP records no verified commit … stale check skipped"* and reports `stale 0`. CI (`.github/workflows/ai-check.yml`) sets `fetch-depth: 0` specifically to enable this check and runs `drift . --git --strict`, and `npm run deep-test` runs it too — both currently get a green result from a check that never executes. Trust-rot detection on `[verified]` rows is effectively off.
   *Fix:* replace the placeholder with the real commit SHA the 2026-06-25 human audit was performed at (e.g. the `v0.1.2` release commit), then re-run `drift --git` to confirm the check activates.

## P2 — misleading

2. **`ai/analysis/FEATURE_CATALOG.md` (+ `_BACKEND`/`_FRONTEND`) are ungenerated placeholders.**
   `FEATURE_MAP.md:9` and `ai/analysis/README.md` both point here as "the full generated catalog"; an agent following that pointer finds `<angle-bracket>` example rows. The kit has ~10 real features (documented in FEATURE_MAP) but no catalog.
   *Fix:* run `/create-feature-catalog`; this is a CLI project, so use single-file Option A and empty/delete the backend/frontend split files.

3. **`ai/guide/CONVENTIONS.md` is still a scaffold — the repo's real conventions live only in code comments and heads.**
   The file carries the "scaffolded template" banner and `<formatter/linter>` placeholders. Load-bearing conventions an agent needs are undocumented: (a) every change must be mirrored in both runtimes, `lib/*.mjs` ↔ `lib/*.py`, kept behavior-identical and covered by the same test suite; (b) zero runtime dependencies, no network, no code execution — the only sanctioned exceptions are `drift --git` and `indepth`, both local read-only git; (c) the `Copyright (c) 2026 Kunal Suri (CEA LIST)` header on every source file, enforced by `npm run deep-test`; (d) terminal color only on a real TTY (NO_COLOR honored) because tests assert on plain piped output; (e) `{{PLACEHOLDER}}` tokens may exist only under `templates/`.
   *Fix:* draft these five as `[inferred]` bullets in CONVENTIONS.md for the human to confirm.

4. **`ai/guide/FEATURE_MAP.md:54` — the `verify` gotcha is factually inverted.**
   It claims path checking is "case-sensitive on Linux/macOS"; both implementations lowercase the file index *and* the lookup (`lib/verify.mjs:61,119`; `lib/verify.py:80,112`), so claim matching is case-INSENSITIVE on every platform.
   *Fix:* reword to "matching is case-insensitive by design, so a claim can be confirmed even if its casing no longer matches the file on disk."

5. **`ai/guide/FEATURE_MAP.md` — missing entries for `shazam`, `uninstall`, and the Process-2 backup flow; two smaller inaccuracies.**
   The flagship one-shot command (`shazam`: maturity → orient → optional indepth → first-run wizard → install), the manifest-based `uninstall` (with its refuse-paths-outside-target guard, `lib/installer.mjs:184-190`), and the CLAUDE/AGENTS backup + `humanContext` capture are not in the map. Also: the intake entry says `--skip-prompt` bypasses the wizard — it only bypasses the analysis-level chooser; the wizard itself skips on `--yes` or no TTY (`lib/intake.mjs:42`). The scaffold NOTE banner at the top (lines 4-5) is stale now that the file is populated.
   *Fix:* add the three missing feature entries, correct the intake gotcha, drop the scaffold banner.

6. **`install.mjs:25-39` header understates what executes and lists half the modules** (code comment, not ai/).
   It claims the single execution exception is `drift --git`, but `indepth` shells out to several local git commands (`lib/indepth.mjs:660-707` — and FEATURE_MAP already documents this correctly); the module list names 4 of 8 `lib/` files and the USAGE block omits `indepth` and `check-repo-maturity`. `install.py` has the same header.
   *Fix:* update both headers to list all eight modules and name both git-using exceptions.

7. **Diagrams are promised in three places but none exist.**
   `ai/INDEX.md:25`, `ai/guide/ARCHITECTURE.md:22-24`, and `ai/analysis/README.md` all describe Mermaid diagrams in `ai/analysis/diagrams/`; the directory holds only a README. ARCHITECTURE.md at least says "not yet drafted".
   *Fix:* generate the architecture/flow diagrams via /cold-start, or soften the INDEX/analysis-README wording until they exist.

## P3 — cosmetic / hygiene

8. **Stale version stamps in the machine-readable facts.** `ai/repo-profile.json` was generated 2026-06-17 by kit 0.1.0 (current: 0.1.2); its `existingAIConfig` byte sizes no longer match the current CLAUDE.md/AGENTS.md. `ai/repo-indepth.json` says `kitVersion: 0.1.0` though generated 2026-06-30. `ai/INDEX.md:44` and `ai/install-manifest.json` record 0.1.0 (install-time — arguably by design). *Fix:* re-run `node install.mjs orient . --indepth --yes` after each release; add that to `docs/RELEASE-CHECKLIST.md`.
9. **Three MODULE_MAP rows still `[inferred]`** — `lib/` (the largest module), `templates/github/`, `test/`. Protocol is being followed (they're treated as pending), but the biggest directory in the repo awaits its human flip. *Fix:* human audits and dates these three rows.
10. **`ai/guide/ARCHITECTURE.md:26-29` invariants section is an empty placeholder.** The three candidate invariants listed there are all supported by the code (dual-runtime parity is test-enforced; the uninstall path guard exists; the provenance rule is stated everywhere). *Fix:* human confirms and adds them as `[verified]` rows.
11. **`.agents/skills/deep-test/SKILL.md` is referenced nowhere in ai/.** The FEATURE_MAP deep-test entry's touch list omits it. *Fix:* add it to the deep-test "Touches" line.
12. **`ai/lab/` has templates but no instances.** No ADRs or specs exist despite documented design decisions (e.g. CHANGELOG's 0.1.1-vs-0.2.0 SemVer rationale is a ready-made ADR). *Fix:* backfill one ADR to seed the practice.
13. **`verify` never scans `ai/INDEX.md`** (or `ai/analysis/README.md`, `ai/lab/`), so the highest-traffic role→path table is mechanically unchecked; e.g. its `MATURITY_REPORT.json` row points at a file that has never been generated (fine — it's on-demand — but nothing would catch it if the path were wrong). *Fix (enhancement):* add `ai/INDEX.md` to the source list in `lib/verify.mjs`/`lib/verify.py`.

## Suggested order of work
1. P1-1 (one-line fix; re-arms CI's stale detection).
2. P2-4 and P2-5 (correctness fixes to FEATURE_MAP).
3. P2-2 and P2-3 (generate the catalog; draft real conventions).
4. P2-6, P2-7, then the P3 hygiene items.
