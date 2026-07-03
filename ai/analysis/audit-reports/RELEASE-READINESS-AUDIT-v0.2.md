<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# 360° Codebase Maturity Audit — pre-v0.2.0 release
> **Status:** `[inferred]` (agent-drafted 2026-07-03; a human audits before acting)
> **Scope:** full tree at `claude/codebase-maturity-audit-1t756x` (main tip `946f8e8`),
> focused on staleness left behind by the Python-implementation removal.

## Verdict
The codebase itself is release-ready: all suites green, knowledge layer mechanically
consistent, no Python leftovers in code, templates, or CI workflow files. The debris
that remains is concentrated in **release metadata** (version strings) and **one
GitHub repo setting** (CodeQL). Fix the items in §2 and v0.2.0 can ship.

## 1 · What was checked and found healthy
| Check | Result |
|---|---|
| Smoke suite (`npm test`) | 190/190 checks pass |
| Deep suite (`npm run deep-test`) | 5/5 (tests, verify, drift, license headers, placeholders) |
| `node install.mjs verify . --strict` | 147/147 path claims confirmed across 11 docs |
| `node install.mjs drift . --git --strict` | 0 unmapped · 0 vanished · 0 stale (10 modules) |
| `CHECKSUMS.txt` | byte-identical to a fresh `./make-checksums.sh` run |
| Dogfooding drift (`.claude/` vs `templates/claude/`) | zero divergence (13 files diffed) |
| Python leftovers in code/templates/workflows/examples | none — remaining mentions are legitimate (stack *detection* of Python target repos, historical changelog notes, the CONVENTIONS guardrail) |
| TODO/FIXME markers in source | none |
| CLI surface vs `docs/CLI-REFERENCE.md` | all 8 commands and flags match |
| `ai/install-manifest.json` file list | 34 files listed, 0 missing on disk |
| Generated profiles (`ai/repo-profile.json`, `ai/repo-indepth.json`) | fresh (2026-07-02/03, kitVersion 0.1.2) |
| CI on main tip | `test.yml` ✅ · `ai-check.yml` ✅ |

## 2 · Findings — fix before tagging v0.2.0

### F1 · CodeQL still analyzes Python → red ✗ on every push to main  *(repo setting, not code)*
GitHub's **default CodeQL setup** (dynamic workflow, "Push on main") fails at the
Python-removal merge `946f8e8`: job `Analyze (python)` ends in
"CodeQL job status was configuration error" because there is no Python left to scan.
**Fix:** GitHub → Settings → Code security and analysis → CodeQL default setup →
edit languages (deselect Python / re-run detection). This cannot be fixed in the tree.

### F2 · Version strings scattered across five files, three already stale
| Location | Says | Should say at release |
|---|---|---|
| `package.json` | 0.1.2 | 0.2.0 |
| `lib/util.mjs` `KIT_VERSION` (line 13) | 0.1.2 | 0.2.0 |
| `CITATION.cff` `version:` + `date-released:` | **0.1.0** / 2026-06-25 | 0.2.0 / release date |
| `README.md` BibTeX block (≈ line 536) | **0.1.0** | 0.2.0 |
| `ai/install-manifest.json` `kitVersion` | **0.1.0** (old pre-hash format) | regenerate by re-running install (also dogfoods the new hash-verified manifest) |

No guard keeps `package.json` and `KIT_VERSION` in sync — `release.yml` only checks
the tag against `package.json`, so `--version` could print 0.1.2 on a v0.2.0 tag.

### F3 · `SPEC_release-check.md` is approved but unimplemented
`ai/lab/specs/SPEC_release-check.md` (status: **approved**, human sign-off recorded)
specifies exactly the gate that would catch F2: version-sync, changelog-gate,
coverage report, cli-docs-sync. None of its touch list exists yet — no
`test/release-check.mjs`, no `release-check` npm script, no workflow, no checklist
step. Either implement it before tagging (recommended — it is small and Node-only)
or run its §"The checks" table by hand for this release.

### F4 · `docs/RELEASE-CHECKLIST.md` is hardcoded to v0.1.0
The title and the Zenodo steps still read "v0.1.0", and the checklist never mentions
bumping any of the five version locations in F2. Generalize it (parameterize the
version, add a "bump all version strings" step or the F3 gate as step 0).

### F5 · Stale step name in `release.yml`
`Smoke tests (both installers)` — there is one installer now. Cosmetic, but it is
the last "two runtimes" artifact in CI.

## 3 · Minor / housekeeping (non-blocking)
- **Tag naming:** the request said "v0.20" — SemVer and `release.yml`'s tag≡version
  check both want **v0.2.0** (tag must equal `v` + `package.json` version).
- **CHANGELOG:** `[Unreleased]` has no link reference at the bottom (Keep a Changelog
  convention: `[Unreleased]: …/compare/v0.1.2...HEAD`); at release the section
  becomes `## [0.2.0] — <date>` with its tag link added.
- **Governance debt by design:** five `ai/guide/MODULE_MAP.md` rows were correctly
  demoted to `[inferred] … re-audit` by the removal. A human should re-audit and
  flip them back to `[verified]` before v0.2.0 — the kit's own rules require it.
- **`check-repo-maturity` self-report UX:** on this already-AI-fied repo it reports
  "Legacy (Process 1) — create ai/ fresh" because `lib/maturity.mjs` (~line 226/300)
  only knows user-authored-CLAUDE.md ⇒ Process 2; there is no "already installed"
  state. Cosmetic; consider a third state in a later release.
- The maturity report's `.gitignore` suggestion lists `__pycache__` — generic
  target-repo advice, fine to leave.

## 4 · Suggested release order
1. Fix the CodeQL language setting (F1) → main goes fully green.
2. Implement or hand-run release-check (F3); update `docs/RELEASE-CHECKLIST.md` (F4).
3. Bump all five version locations (F2); rename the `release.yml` step (F5).
4. Move `[Unreleased]` → `[0.2.0]` in `CHANGELOG.md`; re-run `./make-checksums.sh`.
5. Human re-audit of the demoted MODULE_MAP rows.
6. Tag `v0.2.0`.
