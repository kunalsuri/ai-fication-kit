<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Release-day checklist

Work top to bottom for any release `vX.Y.Z`; everything below the Zenodo step is
immutable forever. One-time steps already done for `v0.1.0` are marked ✓ and kept
for the record.

## Step 0 — run the deterministic gate
- [ ] `npm run release-check` green. It enforces version-sync across every file
      that states a version, the changelog gate, and CLI-docs sync, and prints a
      changed-files-vs-changelog coverage report. The same gate re-runs in CI on
      the tag push (`.github/workflows/release-check.yml`).

## Before tagging
- [ ] Bump every version location to `X.Y.Z` (release-check names any file you miss):
      `package.json`, `lib/util.mjs` (`KIT_VERSION`), `CITATION.cff` (`version:` and
      `date-released:`), and the README BibTeX block.
- [ ] `CHANGELOG.md`: move `[Unreleased]` into a dated `## [X.Y.Z] — YYYY-MM-DD`
      section, add its link reference at the bottom, leave `[Unreleased]` empty.
- [ ] Hygiene sweep: nothing personal/institutional/unresolved anywhere
      (`grep -rn "TODO" --include="*.md" .` and read each hit).
- [ ] `node test/run-tests.mjs` green locally; CI green on all three OSes.
- [ ] `./make-checksums.sh`; commit `CHECKSUMS.txt`.
- [ ] README renders correctly on GitHub (badges, banner, tables).
- [ ] Optional (dogfooding): re-run `node install.mjs install .` on this repo and
      review the diff — it regenerates `ai/install-manifest.json` with the new
      `kitVersion` and content hashes, and stamps any assets added since the last
      install. Human review of the diff is required before committing.
- [ ] Tag exactly `vX.Y.Z` — both `release.yml` and `release-check.yml` fail when
      the tag does not equal `v` + `package.json` version.

## Zenodo
- [x] One-time setup (done at `v0.1.0`): Zenodo account linked to ORCID; GitHub
      integration enabled for this repo **before tagging** (the webhook only fires
      on releases created after enabling); affiliation line decided.
- [ ] Create a GitHub release `vX.Y.Z` titled "ai-fication-kit vX.Y.Z" — this is
      what triggers the Zenodo deposit (a git tag alone does not).
- [ ] Verify the Zenodo record: title, sole author + ORCID, Apache-2.0, keywords
      (it reads `.zenodo.json`). The **concept DOI** stays the same across
      versions; note the new **version DOI**.

## Immediately after
- [x] One-time (done at `v0.1.1`): README DOI badge and `CITATION.cff` `doi:` wired
      to the **concept DOI** — no per-release change needed unless you want to cite
      a specific version DOI somewhere.
- [x] One-time: old prototype repo private/archived, README pointing here.

## Technical report
- [ ] `docs/AI-fication-Kit-TR-2026-01.pdf`: method, related-work positioning,
      contribution statement, implemented/designed table; cites the concept DOI and
      the version DOI it describes.
- [ ] Example repos seeded; video linked from README (hosted externally).

## npm publishing — deferred (as of v0.1.1)

The kit is **not** on npm yet, and `NPM_TOKEN` is intentionally unset.

- `.github/workflows/release.yml` auto-publishes on any `v*` tag, but its publish
  step is **skipped while `NPM_TOKEN` is absent** — so tagging (e.g. `v0.2.0`) runs
  the tests and creates the tag without publishing anything.
- To publish later: add an `NPM_TOKEN` repository secret (npm Automation token),
  then push a `v*` tag whose version matches `package.json`.
- npm is independent of Zenodo — publishing to npm does **not** create a Zenodo
  deposit (that still requires a GitHub *Release*).
