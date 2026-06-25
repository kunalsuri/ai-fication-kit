// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// Catalog: product records and validation.
const { insert, find } = require("../db");

function product(name, price, opts = {}) {
  if (!name) throw new Error("name required");
  if (typeof price !== "number" || price < 0) throw new Error("bad price");
  return insert("products", {
    name,
    price,
    tags: opts.tags || [],
    stock: opts.stock == null ? 0 : opts.stock,
  });
}

function inStock(id) {
  const p = find("products", id);
  return Boolean(p && p.stock > 0);
}

function restock(id, qty) {
  const p = find("products", id);
  if (!p) throw new Error("no such product");
  p.stock += qty;
  return p;
}

module.exports = { product, inStock, restock };
