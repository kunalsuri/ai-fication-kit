// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
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
export const KIT_FOOTER_MARKER = "<!-- Installed by ai-fication-kit";

// Backup naming: CLAUDE_bkp_YYYYMMDD_HHmmss.md
export function backupName(base, ext = ".md") {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}_` +
             `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `${base}_bkp_${ts}${ext}`;
}

// lib/ lives one level under the kit root.
export const kitRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const templatesRoot = path.join(kitRoot, "templates");

// ---------------------------------------------------------------- terminal style
// Zero-dependency ANSI styling — no chalk, nothing extra to trust. We honor the
// NO_COLOR convention (https://no-color.org) and only colorize a real TTY, so piped
// output, CI, and the spawn-based test suite all receive plain strings. FORCE_COLOR=1
// lets a human force color (e.g. for a screenshot) when stdout is not a TTY.
const colorOn = (() => {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR === "1" || process.env.FORCE_COLOR === "true") return true;
  return Boolean(process.stdout.isTTY);
})();
const sgr = (open, close) => (s) => (colorOn ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));

// Warm coral/amber palette (Claude-like). 256-color foreground codes; 39 resets fg.
export const style = {
  enabled: colorOn,
  bold:  sgr(1, 22),
  dim:   sgr(2, 22),
  coral: sgr("38;5;209", 39), // brand accent: borders, sparkle, prompts
  amber: sgr("38;5;214", 39), // warnings and the ⚡ mark
  green: sgr("38;5;42", 39),  // success / ✓
  red:   sgr("38;5;203", 39), // errors / ✗
  gray:  sgr("38;5;245", 39), // hints and secondary labels
};

export function die(msg) { console.error(style.red("✗ ") + msg); process.exit(1); }
export function info(msg) { console.log(msg); }

// The brand lockup printed at the top of `shazam` and the no-arg usage screen: a
// rounded box with a sparkle, the wordmark, version, and tagline. Renders as plain
// ASCII when color is disabled, so it degrades gracefully in pipes and CI logs.
export function banner() {
  const W = 48;                                   // inner width between the bars
  const bar = (inner) => style.coral("│") + inner + style.coral("│");
  const name = "ai-fication-kit", ver = `v${KIT_VERSION}`;
  const leadVisible = 2 + 1 + 2 + name.length;    // visible cells of "  ✦  <name>"
  const gap = Math.max(1, W - leadVisible - ver.length - 2);
  const tag = "a trusted map for AI agents";
  info("");
  info(style.coral("╭" + "─".repeat(W) + "╮"));
  info(bar(" ".repeat(W)));
  info(bar(`  ${style.coral("✦")}  ${style.bold(name)}${" ".repeat(gap)}${style.dim(ver)}  `));
  info(bar(`     ${style.gray(tag)}${" ".repeat(Math.max(0, W - 5 - tag.length))}`));
  info(bar(" ".repeat(W)));
  info(style.coral("╰" + "─".repeat(W) + "╯"));
  info("");
}

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
  const prompt = `   ${style.bold(question)} ${style.gray("[y/N]")} ${style.coral("❯")} `;
  const answer = await new Promise(res => rl.question(prompt, res));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

// Only a real human at a terminal should be prompted; automation/CI must flow through.
export function isInteractive() {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

// Free-text prompt. Returns `fallback` for non-interactive runs or empty input.
export async function ask(question, flags, fallback = "") {
  if (flags.yes || !isInteractive()) return fallback;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const hint = fallback ? style.gray(` (${fallback})`) : "";
  const prompt = `   ${style.bold(question)}${hint} ${style.coral("❯")} `;
  const answer = await new Promise(res => rl.question(prompt, res));
  rl.close();
  return answer.trim() || fallback;
}

// Numbered single-choice menu. Returns the chosen option string (defaultIndex otherwise).
// The default row is marked with ❯ and bolded; pressing Enter accepts it.
export async function choose(question, options, flags, defaultIndex = 0) {
  if (flags.yes || !isInteractive()) return options[defaultIndex];
  info("\n  " + style.bold(question));
  options.forEach((o, i) => {
    const isDefault = i === defaultIndex;
    const marker = isDefault ? style.coral("❯") : " ";
    const num = style.coral(`${i + 1})`);
    info(`   ${marker} ${num} ${isDefault ? style.bold(o) : o}`);
  });
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const hint = style.gray(`↳ 1-${options.length} · Enter = ${defaultIndex + 1}`);
  const answer = await new Promise(res => rl.question(`   ${hint} ${style.coral("❯")} `, res));
  rl.close();
  const n = parseInt(answer.trim(), 10);
  return (Number.isInteger(n) && n >= 1 && n <= options.length) ? options[n - 1] : options[defaultIndex];
}
