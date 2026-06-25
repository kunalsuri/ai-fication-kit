<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# sample-app

A small, multi-module demo service (auth, billing, catalog, orders, notify) used by
[`examples/value-demo`](../) to show what the `ai/` knowledge layer is worth.

It ships with a pre-audited `ai/guide/MODULE_MAP.md` and a fixed `TASK.md`. Run the
measurement from the parent directory:

```bash
node examples/value-demo/measure.mjs
```

Run the (tiny) test suite with `npm test`.
