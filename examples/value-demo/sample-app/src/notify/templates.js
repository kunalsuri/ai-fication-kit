// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// Notifications: trivial {placeholder} template rendering with a small registry.
const registry = {
  welcome: "Welcome, {user}!",
  receipt: "You paid {total}. Thank you.",
};

function render(tpl, data = {}) {
  const text = registry[tpl] || tpl;
  return text.replace(/\{(\w+)\}/g, (_, key) => (data[key] == null ? "" : String(data[key])));
}

function register(name, text) {
  registry[name] = text;
  return name;
}

module.exports = { render, register, registry };
