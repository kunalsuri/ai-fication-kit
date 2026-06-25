<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Contributing

Thanks for your interest. Until v1.0, the method and kit are evolving quickly and the
project is maintained by a single author, so the most useful contributions are:

1. **Issues** — reports from running the kit on real legacy repositories: what the
   `orient` step misdetected, where `/cold-start` struggled, what your audit found.
2. **Example repos** — small, self-contained legacy codebases (different stacks) we can
   use as worked examples and CI fixtures.
3. **Template improvements** — sharper prompts, better checklists. Keep the provenance
   discipline intact: anything an agent writes must be markable `[inferred]`.

Ground rules:
- Installers stay zero-dependency. PRs adding packages will be declined.
- Both installers (`install.mjs`, `install.py`) must keep identical behavior; change both.
  The implementation lives in `lib/` as language-mirrored pairs (`lib/orient.mjs` ↔
  `lib/orient.py`, etc.) — keep each pair in sync, side by side.
- `node test/run-tests.mjs` must pass on your platform before you open a PR.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
