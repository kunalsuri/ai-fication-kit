// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// Tests for billing — the verifying suite for the discount-code task.
const assert = require("assert");
const { makeInvoice } = require("../src/billing/invoice");
const inv = makeInvoice({ items: [{ price: 100, qty: 2 }] });
assert.strictEqual(inv.subtotal, 200);
assert.strictEqual(inv.total, 240);
console.log("billing ok");
