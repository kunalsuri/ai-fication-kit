// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// Notifications: a fake outbox the demo "sends" to, with simple retry bookkeeping.
const { render } = require("./templates");

const outbox = [];

function send(to, tpl, data = {}) {
  if (!to) throw new Error("recipient required");
  const message = { to, body: render(tpl, data), attempts: 1, sentAt: Date.now() };
  outbox.push(message);
  return message;
}

function retry(index) {
  const m = outbox[index];
  if (!m) throw new Error("no such message");
  m.attempts += 1;
  m.sentAt = Date.now();
  return m;
}

function drain() {
  return outbox.splice(0, outbox.length);
}

module.exports = { send, retry, drain, outbox };
