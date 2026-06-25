#!/usr/bin/env node
// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
//
// measure.mjs — a deterministic, zero-dependency "what is the map worth?" demo.
//
// It compares the CONTEXT an agent must read to safely implement one fixed task
// (sample-app/TASK.md) two ways:
//
//   WITHOUT the map → it cannot know which files matter, so to be safe it reads
//                     the whole source tree (src/ + test/).
//   WITH the map    → it reads the compact map + index, which point it at the
//                     task's touch set, and opens only those files.
//
// This measures READABLE CONTEXT (bytes, and a ~4-bytes/token estimate), not live
// API spend — there is no model and no network here, so the numbers are exactly
// reproducible. Real token savings track this closely and GROW with repo size:
// the "without" side scales with the whole codebase, the "with" side does not.
//
// Usage:  node examples/value-demo/measure.mjs [path-to-sample-app]

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(process.argv[2] || path.join(here, "sample-app"));

const SOURCE_EXTS = new Set(["js", "mjs", "cjs", "jsx", "ts", "tsx"]);
const BYTES_PER_TOKEN = 4; // common rough heuristic; this is an estimate, not a meter.

async function walk(dir) {
  const out = [];
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(abs));
    else if (e.isFile()) {
      const ext = e.name.includes(".") ? e.name.split(".").pop().toLowerCase() : "";
      if (SOURCE_EXTS.has(ext)) out.push(abs);
    }
  }
  return out;
}

async function sizeOf(files) {
  let bytes = 0;
  const rows = [];
  for (const f of files) {
    const b = (await fs.stat(f)).size;
    bytes += b;
    rows.push({ rel: path.relative(appDir, f), bytes: b });
  }
  return { bytes, rows };
}

function tokens(bytes) { return Math.ceil(bytes / BYTES_PER_TOKEN); }

async function touchSetFromTask() {
  const taskText = await fs.readFile(path.join(appDir, "TASK.md"), "utf8");
  // Pull backtick-quoted paths that appear after the "## Touch set" heading.
  const after = taskText.split(/##\s*Touch set/i)[1] || "";
  const files = [];
  for (const m of after.matchAll(/`([^`]+)`/g)) {
    const p = path.join(appDir, m[1].trim());
    try { if ((await fs.stat(p)).isFile()) files.push(p); } catch { /* skip */ }
  }
  return files;
}

function bar(value, max, width = 28) {
  const n = max ? Math.max(1, Math.round((value / max) * width)) : 0;
  return "█".repeat(n);
}

async function main() {
  // WITHOUT the map: the whole source surface (src/ + test/).
  const crawlFiles = [...await walk(path.join(appDir, "src")),
                      ...await walk(path.join(appDir, "test"))];
  const crawl = await sizeOf(crawlFiles);

  // WITH the map: the navigation docs + the task's touch set.
  const navFiles = [path.join(appDir, "ai", "guide", "MODULE_MAP.md"),
                    path.join(appDir, "ai", "INDEX.md")];
  const touchFiles = await touchSetFromTask();
  const mapped = await sizeOf([...navFiles, ...touchFiles]);

  const cTok = tokens(crawl.bytes), mTok = tokens(mapped.bytes);
  const ratio = mTok ? (cTok / mTok) : 0;
  const saved = cTok ? Math.round((1 - mTok / cTok) * 100) : 0;

  console.log(`\nai-fication-kit · value demo — what is the map worth?`);
  console.log(`task:   ${path.join(path.relative(process.cwd(), appDir), "TASK.md")}`);
  console.log(`(context an agent must read to locate + edit safely; ~${BYTES_PER_TOKEN} bytes/token estimate)\n`);

  console.log(`WITHOUT the map — read the whole source tree (${crawl.rows.length} files)`);
  for (const r of crawl.rows) console.log(`   ${String(r.bytes).padStart(6)} B  ${r.rel}`);
  console.log(`   ${bar(cTok, cTok)}  ~${cTok} tokens\n`);

  console.log(`WITH the map — read the index + the task's touch set (${mapped.rows.length} files)`);
  for (const r of mapped.rows) console.log(`   ${String(r.bytes).padStart(6)} B  ${r.rel}`);
  console.log(`   ${bar(mTok, cTok)}  ~${mTok} tokens\n`);

  console.log(`RESULT:  ~${cTok} → ~${mTok} tokens   (${ratio.toFixed(1)}× less, ${saved}% saved)`);
  console.log(`Note:    this is a deliberately tiny repo. The "without" cost scales with the`);
  console.log(`         whole codebase, the "with" cost does not — so the gap widens on real repos.\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
