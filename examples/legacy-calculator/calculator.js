/**
 * Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
 * Legacy Calculator module.
 * Implements basic arithmetic with input validation.
 */

function add(a, b) {
  validate(a, b);
  return a + b;
}

function subtract(a, b) {
  validate(a, b);
  return a - b;
}

function multiply(a, b) {
  validate(a, b);
  return a * b;
}

function divide(a, b) {
  validate(a, b);
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
}

function validate(a, b) {
  if (typeof a !== "number" || typeof b !== "number") {
    throw new Error("Both arguments must be numbers");
  }
  if (Number.isNaN(a) || Number.isNaN(b)) {
    throw new Error("Arguments cannot be NaN");
  }
}

module.exports = {
  add,
  subtract,
  multiply,
  divide
};
