<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# REVIEW: <work id> — <title>
> **Date:** <YYYY-MM-DD> · **Spec:** specs/SPEC_<name>.md · **Ledger row:** W-<n>
> **Reviewer:** <human | agent, fresh session — never the implementing session>
> **Verdict:** approve | request-changes | reject

## Scope reviewed
<Exact commits / diff range / files. A review of "the change" without a pinned
diff is not a review.>

## Checks — evidence, not assertions
| Check | Result | Evidence |
|---|---|---|
| Spec conformance — every acceptance criterion met | ✅/❌ | <criterion → where demonstrated> |
| Surgical diff — every hunk traces to the spec | ✅/❌ | <drive-by changes found?> |
| Stability respected — no `frozen`/`?` files touched without recorded approval | ✅/❌ | <MODULE_MAP rows checked> |
| Tests — new behavior covered; suites green | ✅/❌ | <commands run + exit status> |
| Conventions & license headers match neighbors | ✅/❌ | <files checked> |
| Knowledge updated — maps/catalog amended, tagged `[inferred]` | ✅/❌ | <which docs> |
| Provenance clean — no `[verified]` written by an agent | ✅/❌ | <grep result> |

If a required suite cannot execute in this environment, record the check as
`BLOCKED-ENV: <blocker> — compensating evidence: <what was run instead>` rather
than skipping it silently; BLOCKED-ENV anywhere caps the verdict at approve-with-nits.

## Findings
| # | Severity | File | Finding | Resolution |
|---|---|---|---|---|
| 1 | blocker / major / minor / nit | <path> | <what is wrong> | <fixed in… / accepted because…> |

## What the human should double-check
<The 2–3 judgement calls a mechanical check cannot make — the reviewer's honest
pointer for the human whose merge decision is the real approval.>
