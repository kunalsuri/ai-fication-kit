// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// Shared helpers and constants for the ai-fication-kit installer.
// Everything here is a thin wrapper over node:fs and the console —
// no network, no execution, no state beyond the constants below.

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

export const KIT_VERSION = "0.1.0";
export const PROFILE_REL = path.join("ai", "repo-profile.json");
export const MANIFEST_REL = path.join("ai", "install-manifest.json");

// lib/ lives one level under the kit root.
export const kitRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const templatesRoot = path.join(kitRoot, "templates");

export function die(msg) { console.error("✗ " + msg); process.exit(1); }
export function info(msg) { console.log(msg); }

export async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

export async function isDir(p) {
  try { const st = await fs.stat(p); return st.isDirectory(); } catch { return false; }
}

export async function isFile(p) {
  try { const st = await fs.stat(p); return st.isFile(); } catch { return false; }
}

export async function readText(p) {
  try { return await fs.readFile(p, "utf8"); } catch { return null; }
}

export async function confirm(question, flags) {
  if (flags.yes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(res => rl.question(`${question} [y/N] `, res));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}
