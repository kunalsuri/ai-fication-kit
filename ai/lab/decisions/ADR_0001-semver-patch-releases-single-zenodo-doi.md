<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# ADR 0001 — Patch releases post-0.1.0; one citable Zenodo DOI  `[inferred]`

> Drafted 2026-07-02 by an agent, backfilled from the rationale already recorded in
> `CHANGELOG.md` (0.1.1 entry). `[inferred]` until a human confirms — the decision
> itself was made by the maintainer at release time; this file only captures it
> where ADRs are supposed to live.

## Status
Accepted (in effect since v0.1.1, 2026-06-30).

## Context
After the 0.1.0 proof-of-concept was deposited on Zenodo with a DOI, follow-up work
landed: documentation, citation metadata, audit-report hygiene, and one read-only
diagnostic command (`check-repo-maturity`). A version number was needed that neither
implied new capability nor forked the citable record.

## Decision
- Post-0.1.0 consolidation ships as PATCH releases (0.1.1, 0.1.2): additive polish
  only — nothing breaks or redefines the kit, which under SemVer is a PATCH.
- The MINOR bump to 0.2.0 is deliberately reserved for the next round of genuinely
  new capabilities.
- Patch releases are NOT deposited on Zenodo; the 0.1.0 DOI remains the single
  citable version of the PoC.

## Consequences
- `KIT_VERSION` (in `lib/util.mjs` / `lib/util.py`) and `package.json` move together
  on every release; stamped artifacts (`ai/repo-profile.json`, `ai/repo-indepth.json`)
  should be regenerated after a bump so their `kitVersion` stamps stay current.
- Citations stay stable while the kit iterates.
- Anything that changes installer behavior or the knowledge-layer contract signals
  the 0.2.0 boundary.
