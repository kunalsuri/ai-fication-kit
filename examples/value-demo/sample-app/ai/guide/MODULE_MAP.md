<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# Module map — directory → responsibility → entry point

> **Index only.** Find the area here, then open the entry file directly. Don't crawl
> the tree. This is a pre-audited example map shipped with the kit's value demo.
> Last verified: 2026-06-15 @ commit <demo — run `git log` in your own repo>

## Stability legend
- `frozen` — inherited / load-bearing legacy. **DO NOT edit** without explicit instruction.
- `stable` — works; change carefully and with tests.
- `ours`   — active development surface. Safe for agents to modify.
- `?`      — not yet audited. **Treat as `frozen` until a human decides.**

## Modules
| Directory | Responsibility (one line) | Entry point | Stability | Status |
|---|---|---|---|---|
| `src/` | HTTP wiring — routes map to module handlers | `src/server.js` | ours | [verified] |
| `src/auth/` | Authentication and session tokens | `src/auth/login.js` | stable | [verified] |
| `src/billing/` | Invoices and tax rules | `src/billing/invoice.js` | ours | [verified] |
| `src/catalog/` | Product records and search | `src/catalog/search.js` | stable | [verified] |
| `src/orders/` | Cart math and order placement | `src/orders/order.js` | stable | [verified] |
| `src/notify/` | Email notifications and templates | `src/notify/email.js` | frozen | [verified] |
| `test/` | Test suites (one per feature area) | `test/billing.test.js` | ours | [verified] |

Detected test locations (from orient): test/

## Audit protocol
1. /cold-start fills rows and tags them `[inferred]`.
2. A human sets Stability per row and flips confirmed rows to `[verified] (date)`.
3. Agents treat `?` rows as `frozen`. Agents never flip tags.
