<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# ai/analysis/ — generated artifacts for ai-fication-kit

Detailed, AI-generated knowledge. Loaded **on demand per task**, never pre-loaded.
Everything here is regenerable; prefer regenerating to hand-editing.

| Artifact | Produced by | Purpose |
|---|---|---|
| `FEATURE_CATALOG.md` | `/create-feature-catalog` | full feature index: feature → UI/backend/data/tests touch lists, plus "where new code lives" decision tree |
| `diagrams/*.mmd` | `/cold-start` | Mermaid architecture/dependency/sequence diagrams |
| `audit-reports/` | `/post-cold-start-verification`, `/verify-ai-readiness` | findings reports, readiness assessments |
| `problems/` | humans + agents | dated analyses of specific issues |

Provenance rule applies here too: generated content is `[inferred]` until a human
verifies it — and because these files are large, verify by **sampling** and record
what you sampled in the report header.
