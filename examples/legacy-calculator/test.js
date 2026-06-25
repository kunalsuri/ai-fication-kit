/**
 * Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
 * Lightweight dependency-free test runner for Legacy Calculator.
 */

const calculator = require("./calculator.js");

let failures = 0;
let checks = 0;

function assertEqual(actual, expected, message) {
  checks++;
  if (actual === expected) {
    console.log(`  ✓ Pass: ${message}`);
  } else {
    failures++;
    console.error(`  ✗ Fail: ${message} (Expected ${expected}, got ${actual})`);
  }
}

function assertThrows(fn, message) {
  checks++;
  try {
    fn();
    failures++;
    console.error(`  ✗ Fail: ${message} (Expected function to throw)`);
  } catch (err) {
    console.log(`  ✓ Pass: ${message} (Threw: ${err.message})`);
  }
}

console.log("Running Legacy Calculator Smoke Tests...");

assertEqual(calculator.add(2, 3), 5, "add(2, 3) should equal 5");
assertEqual(calculator.subtract(10, 4), 6, "subtract(10, 4) should equal 6");
assertEqual(calculator.multiply(3, 4), 12, "multiply(3, 4) should equal 12");
assertEqual(calculator.divide(20, 5), 4, "divide(20, 5) should equal 4");

assertThrows(() => calculator.add("2", 3), "add with string should throw error");
assertThrows(() => calculator.divide(5, 0), "divide by zero should throw error");

console.log(`\nTest results: ${checks - failures}/${checks} tests passed.`);

if (failures > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
