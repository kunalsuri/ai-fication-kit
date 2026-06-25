<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# diagrams/ — text-based architecture diagrams

Mermaid (`.mmd`) only — diffable, regenerable, no binary images.

Drafted by `/cold-start`:
- `package-deps.mmd` — module/package dependency graph
- `domain-core.mmd` — core domain types and relationships
- `seam.mmd` — the main boundary (e.g., frontend ↔ backend) and its protocol

Regenerate rather than hand-edit. If a diagram and the code disagree, the code wins —
fix the generator prompt or rerun the pass, and note the drift in an audit report.
