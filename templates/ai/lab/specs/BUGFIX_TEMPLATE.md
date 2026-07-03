<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# BUGFIX: <short bug title>
> **Status:** draft | approved | fixed | rolled-back
> **Author:** <name> · **Date:** <YYYY-MM-DD> · **Issue:** <link or —>

## Symptom
**Observed:** <what actually happens — exact error text, wrong output.>
**Expected:** <what should happen instead, and why (spec, doc, or user report).>

## Reproduction — no fix before this exists and fails
<Exact steps/commands that show the bug. Then turn them into a regression test
and watch it fail — a red test is the proof the bug is understood.>
- Failing test: <path — where the regression test lives; it stays forever>

## Root cause
<The defect, not the symptom. Tagged hypothesis until the failing test plus a
code read confirm it — "patched where it hurt" is how phantom bugs are born.>

## Touch list (from MODULE_MAP / FEATURE_MAP gotchas)
| Location | Stability | Change |
|---|---|---|
| <path> | <frozen/stable/ours/?> | <fix/test> |

`frozen` or `?` in this list ⇒ stop; explicit human approval recorded here first.

## Fix sketch
<Smallest change that makes the regression test green. Alternatives rejected
and why, if any — promote to an ADR if the choice is architectural.>

## Acceptance
1. The regression test fails before the fix and passes after it.
2. The full suite matching the touched area stays green.
3. <Any bug-specific observable.>

## Knowledge update on completion
- [ ] FEATURE_MAP.md gotcha line added (so the next agent knows the trap)
- [ ] WORKLOG.md row appended (type `bugfix`, linking this doc + review)
- [ ] EVAL written if the hunt taught something worth keeping
