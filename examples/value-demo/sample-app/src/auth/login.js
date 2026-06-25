// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// Authentication: validate credentials, throttle abuse, open a session.
const { insert, where } = require("../db");
const { newSession, endSession } = require("./session");

const attempts = {};
const MAX_ATTEMPTS = 5;

function hash(pass) {
  // Demo-only "hash": never do this for real.
  let h = 0;
  for (const ch of pass) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return String(h);
}

function register(user, pass) {
  if (where("users", (u) => u.user === user).length) {
    throw new Error("user exists");
  }
  return insert("users", { user, pass: hash(pass) });
}

function login({ user, pass } = {}) {
  if (!user || !pass) throw new Error("missing credentials");
  attempts[user] = (attempts[user] || 0) + 1;
  if (attempts[user] > MAX_ATTEMPTS) throw new Error("too many attempts");
  const found = where("users", (u) => u.user === user)[0];
  if (!found || found.pass !== hash(pass)) throw new Error("invalid credentials");
  attempts[user] = 0;
  return newSession(user);
}

function logout(token) {
  endSession(token);
  return { ok: true };
}

module.exports = { register, login, logout, hash };
