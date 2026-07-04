<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Pre-completion checklist
- [ ] Bugfix doc exists (symptom, reproduction, root cause) and user approved it
- [ ] Regression test failed before the fix, passes after, and stays in the suite
- [ ] Root cause named — not just the symptom patched
- [ ] No `frozen`/`?` files modified (or explicit approval recorded in the doc)
- [ ] Diff is surgical — fix + test only, no drive-by changes
- [ ] Area suites green; commands and output reported
- [ ] Review requested via /review-change (fresh context)
- [ ] WORKLOG.md row appended; FEATURE_MAP gotcha added; all tagged `[inferred]`
