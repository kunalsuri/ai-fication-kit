<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# Task: add a discount-code field to invoices

A customer can pass a `discountCode` when creating an invoice; a valid code
reduces the subtotal before tax is applied.

This is the fixed task the value demo measures. The map (`ai/guide/MODULE_MAP.md`)
points an agent straight at the billing module and its test, so it reads only the
files below instead of crawling the whole `src/` tree.

## Touch set
The files an agent needs to open to implement and verify this task, taken from the
billing rows of the module map:

- `src/billing/invoice.js`
- `src/billing/tax.js`
- `test/billing.test.js`
