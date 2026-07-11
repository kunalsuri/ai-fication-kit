---
name: check-drift
description: Run verification and drift checks on the AI knowledge-base to identify missing documentation or stale references.
disable-model-invocation: true
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Run the mechanical verification and drift analysis to inspect the state of the `ai/` knowledge-base:

1. Run the path verifier:
   `node install.mjs verify . --strict`
2. Run the drift detector with git history comparison:
   `node install.mjs drift . --git --strict`
3. Run `git status` to inspect modified and untracked files.

If any issues are reported, or if `git status` reveals newly added or modified source files/templates that are not yet covered in the maps:
- Draft updates to `ai/guide/MODULE_MAP.md` or `ai/guide/FEATURE_MAP.md` to map new folders, files, or features, or to update stale verified dates.
- Mark any changes you draft as `[inferred]`.
- Report findings to the user and outline what needs their manual review.
