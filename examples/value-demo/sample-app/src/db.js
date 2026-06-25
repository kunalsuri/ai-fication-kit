// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// In-memory store standing in for a real database in this demo. Supports insert,
// lookup by id, simple filtering, and a naive secondary index per table.
const tables = { users: [], orders: [], products: [], sessions: [] };
const indexes = {};
let nextId = 1;

function insert(table, row) {
  if (!tables[table]) throw new Error(`unknown table: ${table}`);
  const record = { id: row.id || nextId++, ...row };
  tables[table].push(record);
  reindex(table);
  return record;
}

function reindex(table) {
  const idx = {};
  for (const r of tables[table]) idx[r.id] = r;
  indexes[table] = idx;
}

function find(table, id) {
  return (indexes[table] || {})[id] || null;
}

function where(table, predicate) {
  return (tables[table] || []).filter(predicate);
}

function all(table) {
  return (tables[table] || []).slice();
}

function remove(table, id) {
  tables[table] = (tables[table] || []).filter((r) => r.id !== id);
  reindex(table);
}

module.exports = { insert, find, where, all, remove, tables };
