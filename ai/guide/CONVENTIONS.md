<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Conventions — how to write code that fits ai-fication-kit

> Status: drafted `[inferred]` from the source on 2026-07-02 (audit follow-up pass);
> humans confirm and add the rules that live only in heads.

## Languages & style  `[inferred]`
- JavaScript (Node ≥ 18, ESM `.mjs`) and Python (≥ 3.8, stdlib only). No formatter or
  linter config exists; match the style of the file you are editing.
- Zero runtime dependencies in both runtimes — "nothing else to trust" is a product
  guarantee, not a preference. Do not add packages.

## Patterns to follow  `[inferred]`
- **Dual-runtime parity:** every behavior change must land in BOTH runtimes —
  `lib/<module>.mjs` and `lib/<module>.py` stay behavior-identical and are exercised
  by the same suite (`test/run-tests.mjs` spawns each). Exemplar pair: `lib/verify.mjs`
  ↔ `lib/verify.py`.
- **No execution, no network:** lib code only inspects files. The sanctioned
  exceptions run LOCAL, READ-ONLY git: the `drift --git` stale check
  (`lib/drift.mjs`) and the `indepth` git-history section (`lib/indepth.mjs`).
- **License header on every source file:** copy the `Copyright (c) 2026 Kunal Suri
  (CEA LIST)` line from a neighboring file; `npm run deep-test` fails on `.js`,
  `.mjs`, `.py`, and `.md` files without it.
- **TTY-only color:** style output through `style` in `lib/util.mjs` (honors
  `NO_COLOR`, colors only a real TTY) so piped/CI output stays byte-stable — the
  test suite asserts on plain strings.
- **Placeholder discipline:** `{{UPPER_SNAKE}}` tokens exist only under `templates/`;
  deep-test flags any that leak elsewhere.
- **CLI shape:** `install.mjs` / `install.py` parse args and dispatch only; put
  behavior in a single-purpose `lib/` module a human can audit in one sitting.

## Things that look wrong but are right  `[verified] required`
<Only humans add rows. The institutional knowledge that prevents "helpful" breakage.>

## Definition of done
- Builds: `npm install`
- Tests pass: `npm test`
- License headers match neighbors; diffs are surgical; ai/ knowledge updated if the
  change moved or added modules/features.
