---
name: review-change
description: Review a completed change against its authorizing spec in fresh context — evidence-based checks, severity-ranked findings, and a written verdict for the human's merge decision. Use when a diff needs reviewing before merge, or when add-feature / fix-bug / implement-spec reaches its review gate.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

# Review a change

The contract: **review in a session that did NOT write the change; check with
evidence, not assertions; re-run the suites yourself; the written verdict is the
deliverable — the human merges, not you.**

## 1. Fresh-context gate
A reviewer sharing the implementer's context inherits the implementer's blind
spots. If this session wrote the change, stop and hand the review to a fresh
session that did not implement it.

## 2. Pin the scope
Identify the exact diff (commits / branch / files) and the spec or bugfix doc in
`ai/lab/specs/` that authorized it. No spec ⇒ that is finding #1, severity blocker:
unspecced work.

## 3. Open the review
Copy `ai/lab/reviews/REVIEW_TEMPLATE.md` → `ai/lab/reviews/REVIEW_<work-id>.md`.

## 4. Check with evidence
For each check in the template — spec conformance, surgical diff, Stability
respected, tests, conventions, knowledge updated, provenance clean — record where
you looked and what you saw. Delegate the suite re-run to `test-runner`: run the
suites the spec names yourself; do not trust the implementer's report.

## 5. File findings by severity
Any blocker or major ⇒ verdict `request-changes`; hand the list back to the
implementer. Minor / nit findings can ship with notes.

## 6. Verdict and hand-off
Fill "what the human should double-check" — the judgement calls a mechanical check
cannot make. The review itself is `[inferred]`; the human's merge decision is the
real approval, and this document is its evidence.

## 7. Record
Link the review from the work's row in `ai/lab/WORKLOG.md` (Review column) and set
that row's Status to `in-review`.
