#!/usr/bin/env node
// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
//
// Automated deep-test verification script for ai-fication-kit.
// Unlike the functional smoke tests (test/run-tests.mjs), this script
// verifies the health and standards compliance of the entire repository itself:
//   1. Runs functional installer smoke tests (test/run-tests.mjs)
//   2. Runs documentation claim checks (verify --strict)
//   3. Runs structural drift checks (drift --strict)
//   4. Scans for required copyright license headers
//   5. Checks for unresolved template placeholders leaked outside of templates/
//
// Run this via: npm run deep-test

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const startTime = Date.now();
const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");

let failures = 0;
let checks = 0;

function ok(cond, label) {
  checks++;
  if (cond) {
    console.log(`  ✓ ${label}`);
  } else {
    failures++;
    console.error(`  ✗ ${label}`);
  }
}

// Helper to run commands relative to repo root
function run(cmd, args, options = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", cwd: repoRoot, ...options });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), error: r.error };
}

// Helper to walk directory structure
async function walk(dir, fileList = []) {
  const files = await fs.readdir(dir, { withFileTypes: true });
  for (const file of files) {
    const res = path.join(dir, file.name);
    // Ignore patterns
    if (
      file.name === ".git" ||
      file.name === ".github" ||
      file.name === "node_modules" ||
      file.name === "__pycache__" ||
      file.name === "audit-reports" ||
      file.name.startsWith("tmp-")
    ) {
      continue;
    }
    if (file.isDirectory()) {
      await walk(res, fileList);
    } else {
      fileList.push(res);
    }
  }
  return fileList;
}

console.log("ai-fication-kit deep-test runner");

// 1. Run Smoke Tests (npm test)
console.log("\n1. Running smoke tests...");
const smokeRes = run("node", ["test/run-tests.mjs"]);
if (smokeRes.out) {
  console.log(smokeRes.out.trim().split("\n").map(line => "    " + line).join("\n"));
}
ok(smokeRes.code === 0, `smoke tests pass (node test/run-tests.mjs)`);

// 2. Run Claim Verification (node install.mjs verify . --strict)
console.log("\n2. Running claim verification...");
const verifyRes = run("node", ["install.mjs", "verify", ".", "--strict"]);
if (verifyRes.out) {
  console.log(verifyRes.out.trim().split("\n").map(line => "    " + line).join("\n"));
}
ok(verifyRes.code === 0, `claim verification passes (--strict)`);

// 3. Run Drift Verification (node install.mjs drift . --strict --git / --strict)
console.log("\n3. Running drift verification...");
let driftRes = run("node", ["install.mjs", "drift", ".", "--strict", "--git"]);
if (driftRes.code !== 0 && driftRes.out.includes("SKIPPED")) {
  // If git fails or skipped, retry without --git
  driftRes = run("node", ["install.mjs", "drift", ".", "--strict"]);
}
if (driftRes.out) {
  console.log(driftRes.out.trim().split("\n").map(line => "    " + line).join("\n"));
}
ok(driftRes.code === 0, `drift detection passes (--strict)`);

// 4. Verify License Headers
console.log("\n4. Running license header checks...");
try {
  const allFiles = await walk(repoRoot);
  const codeFiles = allFiles.filter(f => {
    const ext = path.extname(f);
    // Scan only .js, .mjs, .py, .md files (exclude packages/check files/etc)
    return [".js", ".mjs", ".py", ".md"].includes(ext);
  });

  console.log(`    Scanning ${codeFiles.length} source/documentation files for license headers...`);

  const copyrightText = "Copyright (c) 2026 Kunal Suri (CEA LIST)";
  const missingHeaders = [];

  for (const file of codeFiles) {
    // Skip third-party/special files that shouldn't have license headers
    const relPath = path.relative(repoRoot, file).replace(/\\/g, "/");
    if (
      relPath.includes("package.json") ||
      relPath.includes("package-lock.json") ||
      relPath.includes("LICENSE") ||
      relPath.includes("NOTICE")
    ) {
      continue;
    }
    const content = await fs.readFile(file, "utf8");
    if (!content.includes(copyrightText)) {
      missingHeaders.push(relPath);
    }
  }

  if (missingHeaders.length > 0) {
    console.error("    Missing copyright license header in the following files:");
    for (const f of missingHeaders) {
      console.error(`      - ${f}`);
    }
  }
  ok(missingHeaders.length === 0, `all source files contain license headers`);
} catch (err) {
  failures++;
  console.error(`  ✗ Error scanning license headers: ${err.message}`);
}

// 5. Verify Placeholders
console.log("\n5. Running placeholder checks...");
try {
  const allFiles = await walk(repoRoot);
  const textFiles = allFiles.filter(file => {
    const ext = path.extname(file);
    return [".md", ".json", ".mjs", ".py", ".html"].includes(ext);
  });
  console.log(`    Checking ${textFiles.length} files for unresolved placeholders...`);

  const placeholderFiles = [];
  const placeholderRegex = /\{\{(PROJECT_NAME|DESCRIPTION|LANGUAGES|BUILD_CMD|TEST_CMD|FORK_RULE|FORK_LINE|DATE|KIT_VERSION|TEST_DIRS|UPSTREAM)\}\}/;

  for (const file of allFiles) {
    const relPath = path.relative(repoRoot, file).replace(/\\/g, "/");
    // Ignore templates, docs, .agents, and installation files which legitimately contain placeholder strings
    if (
      relPath.startsWith("templates/") ||
      relPath.startsWith("docs/") ||
      relPath.startsWith(".agents/") ||
      relPath === "install.mjs" ||
      relPath === "install.py" ||
      relPath === "test/run-tests.mjs"
    ) {
      continue;
    }
    // Only check text-like extensions
    const ext = path.extname(file);
    if (![".md", ".json", ".mjs", ".py", ".html"].includes(ext)) {
      continue;
    }
    const content = await fs.readFile(file, "utf8");
    if (placeholderRegex.test(content)) {
      placeholderFiles.push(relPath);
    }
  }

  if (placeholderFiles.length > 0) {
    console.error("    Found unresolved templates placeholders in the following files:");
    for (const f of placeholderFiles) {
      console.error(`      - ${f}`);
    }
  }
  ok(placeholderFiles.length === 0, `no unresolved placeholders in active codebase`);
} catch (err) {
  failures++;
  console.error(`  ✗ Error scanning placeholders: ${err.message}`);
}

const duration = ((Date.now() - startTime) / 1000).toFixed(2);
console.log(`\nDeep test run: ${checks - failures}/${checks} checks passed in ${duration}s`);
process.exit(failures ? 1 : 0);
