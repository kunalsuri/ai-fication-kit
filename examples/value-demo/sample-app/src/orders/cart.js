// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// Orders: cart math and validation.
function validateCart(cart) {
  if (!Array.isArray(cart) || cart.length === 0) throw new Error("empty cart");
  for (const line of cart) {
    if (typeof line.price !== "number" || line.price < 0) throw new Error("bad price");
    if (!Number.isInteger(line.qty) || line.qty <= 0) throw new Error("bad qty");
  }
}

function totalFor(cart = []) {
  return cart.reduce((sum, line) => sum + line.price * line.qty, 0);
}

function itemCount(cart = []) {
  return cart.reduce((n, line) => n + line.qty, 0);
}

module.exports = { validateCart, totalFor, itemCount };
