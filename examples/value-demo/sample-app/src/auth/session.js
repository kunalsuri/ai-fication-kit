// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// Session tokens for the demo: creation, lookup, expiry, teardown.
const { insert, where, remove } = require("../db");

const TTL_MS = 1000 * 60 * 30;
let counter = 0;

function newSession(user) {
  const token = `s${++counter}-${Date.now()}`;
  return insert("sessions", { token, user, expires: Date.now() + TTL_MS });
}

function lookup(token) {
  return where("sessions", (s) => s.token === token)[0] || null;
}

function requireSession(token) {
  const s = lookup(token);
  if (!s) { const e = new Error("not authenticated"); e.status = 401; throw e; }
  if (s.expires < Date.now()) {
    endSession(token);
    const e = new Error("session expired"); e.status = 401; throw e;
  }
  return s;
}

function endSession(token) {
  const s = lookup(token);
  if (s) remove("sessions", s.id);
}

module.exports = { newSession, lookup, requireSession, endSession };
