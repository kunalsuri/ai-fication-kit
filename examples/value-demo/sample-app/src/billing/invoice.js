// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// Billing: build an invoice for a set of line items.
const { applyTax } = require("./tax");
function makeInvoice({ items = [] }) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const { tax, total } = applyTax(subtotal);
  return { subtotal, tax, total };
}
module.exports = { makeInvoice };
