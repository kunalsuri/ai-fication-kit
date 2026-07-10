<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Pre-completion checklist
- [ ] `ai/repo-profile.json` read; build/test commands verified against real config
- [ ] Prior config (`CLAUDE_bkp_*`/`AGENTS_bkp_*`) absorbed on Process 2 repos; extracts tagged `[inferred — from prior config]`
- [ ] MODULE_MAP has one row per module with ACTUAL names and a Stability guess
- [ ] Diagrams drafted — `package-deps.mmd`, `domain-core.mmd`, `seam.mmd`
- [ ] Everything written tagged `[inferred]`; OBSERVED separated from INFERRED
- [ ] Fork upstream marked `frozen` + "UNSURE — needs human"
- [ ] No source file modified — only `ai/` written
- [ ] AUDIT TODO table printed; stopped before building any feature
