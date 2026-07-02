---
mode: agent
description: Deep-mine the source code to discover implemented features; writes ai/analysis/FEATURE_CATALOG.md.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Build the feature catalog — the highest-value artifact for agents. Budget significant
exploration; if a `repo-explorer` chat mode is available, switch to it for the heavy
reading (it is read-only by design and protects this context window).

## Method
1. Start from user-visible surfaces: routes, UI entry points, CLI commands, public
   APIs. Each surface is a candidate feature.
2. For each feature, trace the touch list across layers: UI, backend/services,
   persistence (tables/collections/files), and tests that exercise it.
3. Cluster and name features the way a USER would name them, not by module names.

## Output — `ai/analysis/FEATURE_CATALOG.md`
For every feature: name · business goal (one line) · touch list per layer ·
verifying tests · related features. End with two sections agents use most:
- **"Where new code lives"** — a decision tree from feature-type to target directories.
- **The 3-file rule** — for each feature, the 3 files to read first to understand it.

## Rules
- Every entry `[inferred]`. Where a layer can't be confirmed, write "UNSURE".
- Do not modify source. Update `ai/guide/FEATURE_MAP.md` candidate list to reference
  the catalog, nothing more.
- Print a sampling guide at the end: the 5 entries a human should spot-check first
  (pick the ones you are least sure of).
