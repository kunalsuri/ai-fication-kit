---
description: Implement a feature using the knowledge layer — spec first, surgical diffs, tests before done, knowledge updated after.
---
<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->

Implement the requested feature using the `add-feature` skill. Summary of the contract:

1. **Spec first.** If no spec exists in `ai/lab/specs/`, draft one from the template
   and get the user's OK before writing code.
2. **Locate via the maps.** MODULE_MAP → FEATURE_MAP/CATALOG → open only what's needed.
3. **Respect Stability.** Never modify `frozen` or `?` files without explicit human
   approval in this conversation.
4. **Build surgically.** Smallest diff that satisfies the spec; match conventions and
   license headers.
5. **Verify.** Run the suite(s) matching the change. Failing or unrun tests ⇒ not done.
6. **Update knowledge.** FEATURE_MAP entry, catalog amendment, MODULE_MAP if layout
   changed — all tagged `[inferred]` for the human to verify.
