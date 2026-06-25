// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// Billing: tax rules. The discount-code feature in TASK.md lands here + invoice.js.
const RATE = 0.2;
function applyTax(subtotal) {
  const tax = Math.round(subtotal * RATE * 100) / 100;
  return { tax, total: subtotal + tax };
}
module.exports = { applyTax, RATE };
