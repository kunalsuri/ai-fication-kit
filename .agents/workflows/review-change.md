---
description: Review a completed change against its spec in fresh context — evidence-based checks, severity-ranked findings, a written verdict for the human's merge decision.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Review a completed change against its spec. Run this in a session that did NOT
implement the change — a reviewer sharing the implementer's context inherits the
implementer's blind spots.

1. **Pin the scope.** Identify the exact diff (commits / branch / files) and the
   spec or bugfix doc in `ai/lab/specs/` that authorized it. No spec ⇒ that is
   finding #1, severity blocker: unspecced work.
2. **Copy the template.** `ai/lab/reviews/REVIEW_TEMPLATE.md` →
   `ai/lab/reviews/REVIEW_<work-id>.md`.
3. **Check with evidence, not assertions.** For each check in the template —
   spec conformance, surgical diff, Stability respected, tests, conventions,
   knowledge updated, provenance clean — record where you looked and what you
   saw. Re-run the suites the spec names; do not trust the implementer's report.
4. **File findings by severity.** Any blocker or major ⇒ verdict
   `request-changes` and hand the list back to the implementer. Minor/nit
   findings can ship with notes.
5. **Verdict and hand-off.** Fill "what the human should double-check" — the
   judgement calls a mechanical check cannot make. The review itself is
   `[inferred]`; the human's merge decision is the real approval, and this
   document is its evidence.
6. **Record.** Link the review from the work's row in `ai/lab/WORKLOG.md`
   (Review column) and set that row's Status to `in-review`.
