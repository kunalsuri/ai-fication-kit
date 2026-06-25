// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// Orders: place an order from a cart, persist it, and list a user's orders.
const { insert, where, find } = require("../db");
const { totalFor, validateCart } = require("./cart");

function placeOrder({ user, cart } = {}) {
  if (!user) throw new Error("user required");
  validateCart(cart);
  for (const line of cart) {
    const p = find("products", line.productId);
    if (!p) throw new Error(`no such product: ${line.productId}`);
    if (p.stock < line.qty) throw new Error(`out of stock: ${p.name}`);
  }
  const total = totalFor(cart);
  return insert("orders", { user, cart, total, status: "placed" });
}

function listOrders(user) {
  return where("orders", (o) => o.user === user);
}

function cancel(id) {
  const o = find("orders", id);
  if (!o) throw new Error("no such order");
  o.status = "cancelled";
  return o;
}

module.exports = { placeOrder, listOrders, cancel };
