<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Release-day checklist — v0.1.0

Work top to bottom; everything below the Zenodo step is immutable forever.

## Before tagging
- [ ] `CITATION.cff`: add your ORCID; set `date-released`; confirm repo URL.
- [ ] `CHANGELOG.md`: set the release date.
- [ ] Hygiene sweep: nothing personal/institutional/unresolved anywhere
      (`grep -rn "TODO" --include="*.md" .` and read each hit).
- [ ] Decide the affiliation line (sole author + affiliation is fine; check your
      institution's release rules once).
- [ ] `node test/run-tests.mjs` green locally; CI green on all three OSes.
- [ ] `./make-checksums.sh`; commit `CHECKSUMS.txt`.
- [ ] README renders correctly on GitHub (badges, banner, tables).

## Zenodo (one-time setup, then the release)
- [ ] Zenodo account linked to ORCID; GitHub integration enabled **for this repo
      before tagging** (the webhook only fires on releases created after enabling).
- [ ] Create GitHub release `v0.1.0` titled
      "ai-fication-kit v0.1.0".
- [ ] Verify the Zenodo record: title, sole author + ORCID, Apache-2.0, keywords
      (it reads `.zenodo.json`). Note BOTH DOIs (version + concept).

## Immediately after
- [ ] README: uncomment the DOI badge with the **concept DOI**; `CITATION.cff`:
      uncomment `doi:`. Commit (this lands in v0.1.1 — expected and fine).
- [ ] Old prototype repo: private (or archived), with its README pointing here.

## Technical report release
- [ ] `docs/AI-fication-Kit-TR-2026-01.pdf`: method, related-work positioning,
      contribution statement, implemented/designed table; cites the concept DOI and
      the v0.1.0 version DOI.
- [ ] Example repos seeded; video linked from README (hosted externally).
