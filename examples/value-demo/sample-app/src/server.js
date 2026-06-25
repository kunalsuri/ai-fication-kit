// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// HTTP wiring for the demo orders service. Parses a request line, runs the
// matching handler through a small middleware chain, and shapes the response.
const { login, logout } = require("./auth/login");
const { requireSession } = require("./auth/session");
const { makeInvoice } = require("./billing/invoice");
const { search, byId } = require("./catalog/search");
const { placeOrder, listOrders } = require("./orders/order");
const { send } = require("./notify/email");

const PUBLIC = new Set(["POST /login"]);

const routes = {
  "POST /login": (req) => login(req.body),
  "POST /logout": (req) => logout(req.headers.token),
  "GET /catalog": (req) => search(req.query),
  "GET /product": (req) => byId(req.query.id),
  "POST /orders": (req) => placeOrder(req.body),
  "GET /orders": (req) => listOrders(req.session.user),
  "POST /invoice": (req) => makeInvoice(req.body),
};

function authenticate(req) {
  if (PUBLIC.has(`${req.method} ${req.path}`)) return;
  req.session = requireSession(req.headers.token);
}

function handle(method, path, { body = {}, query = {}, headers = {} } = {}) {
  const key = `${method} ${path}`;
  const fn = routes[key];
  if (!fn) return { status: 404, error: "not found" };
  const req = { method, path, body, query, headers };
  try {
    authenticate(req);
    const data = fn(req);
    return { status: 200, data };
  } catch (err) {
    return { status: err.status || 400, error: err.message };
  }
}

function notifyOrder(order) {
  return send(order.user, "Order {id} placed: {total}", order);
}

module.exports = { handle, routes, notifyOrder };
