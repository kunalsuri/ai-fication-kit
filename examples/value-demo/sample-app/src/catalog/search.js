// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// Catalog: search, filter, sort, and paginate over products.
const { all, find } = require("../db");

function byId(id) {
  const p = find("products", Number(id));
  if (!p) { const e = new Error("not found"); e.status = 404; throw e; }
  return p;
}

function search({ q = "", tag = "", sort = "name", page = 1, size = 10 } = {}) {
  let rows = all("products");
  if (q) rows = rows.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  if (tag) rows = rows.filter((p) => p.tags.includes(tag));
  rows.sort((a, b) => {
    if (sort === "price") return a.price - b.price;
    return String(a.name).localeCompare(String(b.name));
  });
  const start = (page - 1) * size;
  return { total: rows.length, page, items: rows.slice(start, start + size) };
}

module.exports = { byId, search };
