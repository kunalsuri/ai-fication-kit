// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// audit — guided human audit of ai/guide/MODULE_MAP.md. This command gathers
// deterministic evidence (fs stat only; git only with the opt-in --git flag)
// and walks the operator through each row, but it is the human's interactive
// confirmation — never automation — that writes a [verified] tag. That
// confirmation IS the signature the rest of the kit trusts; --yes does NOT
// unlock this command, unlike every other command in the kit.

import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  confirm, choose, info, isInteractive, readText, reserveBackupPath, style,
} from "./util.mjs";
import { MODULE_MAP_REL, DRIFT_IGNORED_DIRS, parseModuleMap } from "./drift.mjs";
import { VERIFIED_TAG } from "./installer.mjs";
import { refreshProgressPage } from "./progress.mjs";

const STABILITY_OPTIONS = ["frozen", "stable", "ours"];

export function formatAuditTimestamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Which directory (repo-relative, "" for root) a row's evidence should come
// from: its first non-root directory claim, else the entry point's directory.
export function targetDirFor(row) {
  const nonRootDir = row.dirClaims
    .map((d) => d.replace(/\/+$/, ""))
    .find((d) => d && d !== "/");
  if (nonRootDir) return nonRootDir;
  const entry = row.entryClaims[0];
  if (entry) {
    const dir = path.posix.dirname(entry.replace(/\/+$/, ""));
    return dir === "." ? "" : dir;
  }
  return "";
}

function runGit(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return { ok: !r.error && r.status === 0, out: r.stdout || "" };
}

// Deterministic evidence for one row: file count, 3 largest + 3 newest files
// (fs stat only), and — only with --git — the last commit touching the
// directory (local, read-only git; the same documented exception as `drift --git`).
export async function computeEvidence(targetAbs, row, { git = false } = {}) {
  const dirRel = targetDirFor(row);
  const dirAbs = path.join(targetAbs, dirRel);
  const files = [];
  const stack = [{ abs: dirAbs, rel: dirRel }];
  while (stack.length) {
    const { abs, rel } = stack.pop();
    let entries;
    try { entries = await fs.readdir(abs, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const childRel = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) {
        if (!DRIFT_IGNORED_DIRS.has(e.name.toLowerCase()) && !e.name.startsWith(".")) {
          stack.push({ abs: path.join(abs, e.name), rel: childRel });
        }
      } else if (e.isFile()) {
        let stat;
        try { stat = await fs.stat(path.join(abs, e.name)); } catch { continue; }
        files.push({ rel: childRel, size: stat.size, mtimeMs: stat.mtimeMs });
      }
    }
  }
  const largest = [...files].sort((a, b) => b.size - a.size || a.rel.localeCompare(b.rel)).slice(0, 3);
  const newest = [...files].sort((a, b) => b.mtimeMs - a.mtimeMs || a.rel.localeCompare(b.rel)).slice(0, 3);

  let lastCommit = null;
  if (git) {
    const r = runGit(targetAbs, ["log", "-1", "--format=%h %ad", "--date=short", "--", dirRel || "."]);
    if (r.ok && r.out.trim()) lastCommit = r.out.trim();
  }

  return { dirRel, fileCount: files.length, largest, newest, lastCommit };
}

// Replace the Stability (2nd-to-last) and Status (last) cells of a MODULE_MAP
// table row line, preserving every other cell verbatim. Returns null if the
// line doesn't have a Status column to rewrite (the 4-column scaffolded
// layout — nothing to flip until /cold-start populates it).
export function rewriteRowLine(line, stability, statusTag) {
  const parts = line.split("|");
  if (parts.length < 3) return null; // not "| a | b | ... |" shaped
  const interior = parts.slice(1, -1);
  if (interior.length < 5) return null; // no Status column
  interior[interior.length - 2] = ` ${stability} `;
  interior[interior.length - 1] = ` ${statusTag} `;
  return "|" + interior.join("|") + "|";
}

// Pure: apply a set of confirmed edits to MODULE_MAP text. `edits` maps a
// row's 1-indexed line number to { stability, timestamp }. No line is ever
// inserted or removed, so every other row's line number stays valid. Returns
// { text, appliedLines } — appliedLines lists the line numbers actually
// rewritten (a line with no Status column is left untouched even if listed).
export function applyEdits(mapText, edits) {
  const lines = mapText.split("\n");
  const appliedLines = [];
  for (const [lineNo, { stability, timestamp }] of edits) {
    const idx = lineNo - 1;
    if (idx < 0 || idx >= lines.length) continue;
    const rewritten = rewriteRowLine(lines[idx], stability, `${VERIFIED_TAG} (${timestamp})`);
    if (rewritten === null) continue;
    lines[idx] = rewritten;
    appliedLines.push(lineNo);
  }
  return { text: lines.join("\n"), appliedLines };
}

// Rewrite the "Last verified: … @ commit <sha>" anchor line — the line
// `drift --git` diffs against. Returns the updated text, or null when the map
// has no anchor line. Pure text transform; only the guided audit's interactive
// flow calls it, and only after the human explicitly confirms the move —
// automation must never relocate the anchor (same policy as the row tags).
export function updateAnchorLine(text, dateStr, sha) {
  const lines = text.split("\n");
  const idx = lines.findIndex((l) => /Last verified:/i.test(l));
  if (idx === -1) return null;
  const prefix = (lines[idx].match(/^\s*>?\s*/) || [""])[0];
  // The anchor may carry a parenthetical note that spans blockquote
  // continuation lines (an unbalanced "(" on the anchor line). Consume the
  // whole note, or the rewrite would orphan half a sentence and a dangling ")".
  const parenDepth = (l) => (l.match(/\(/g) || []).length - (l.match(/\)/g) || []).length;
  let end = idx;
  let open = parenDepth(lines[idx]);
  while (open > 0 && end + 1 < lines.length && /^\s*>/.test(lines[end + 1])) {
    end++;
    open += parenDepth(lines[end]);
  }
  lines.splice(idx, end - idx + 1, `${prefix}Last verified: ${dateStr} @ commit ${sha}`);
  return lines.join("\n");
}

export async function audit(targetAbs, flags) {
  // Automation must never manufacture a human signature — unlike every other
  // command, --yes does NOT unlock this one.
  if (flags.yes || !isInteractive()) {
    info("audit is a human activity — run it from an interactive terminal, without --yes.");
    return;
  }

  const mapPath = path.join(targetAbs, ...MODULE_MAP_REL);
  const mapText = await readText(mapPath);
  if (mapText === null) {
    info(`No ${MODULE_MAP_REL.join("/")} found. Run install (or shazam) first, then /cold-start.`);
    return;
  }
  const { rows } = parseModuleMap(mapText);
  if (!rows.length) {
    info("MODULE_MAP.md has no rows yet — run /cold-start first.");
    return;
  }

  const edits = new Map();
  for (const row of rows) {
    info("");
    info(style.bold(row.label) + style.gray(`  (MODULE_MAP.md line ${row.line})`));
    info(`  Current: Status=${row.status}`);

    const evidence = await computeEvidence(targetAbs, row, { git: Boolean(flags.git) });
    info(`  Evidence: ${evidence.fileCount} file(s) in \`${evidence.dirRel || "/"}\``);
    if (evidence.largest.length) {
      info(`    Largest: ${evidence.largest.map((f) => `${f.rel} (${f.size}B)`).join(", ")}`);
    }
    if (evidence.newest.length) {
      info(`    Newest:  ${evidence.newest.map((f) => `${f.rel}`).join(", ")}`);
    }
    if (evidence.lastCommit) {
      info(`    Last commit touching this area: ${evidence.lastCommit}`);
    }

    const proceed = await confirm("Audit this row now?", flags);
    if (!proceed) { info("  skipped."); continue; }

    const options = [...STABILITY_OPTIONS, "skip (leave this row untouched)"];
    const stability = await choose("Set Stability for this row:", options, flags, options.length - 1);
    if (stability === options[options.length - 1]) { info("  skipped."); continue; }

    const confirmed = await confirm(
      `Flip this row to ${VERIFIED_TAG} with Stability="${stability}"? This is your signature.`, flags);
    if (!confirmed) { info("  skipped (not confirmed)."); continue; }

    edits.set(row.line, { stability, timestamp: formatAuditTimestamp() });
  }

  if (!edits.size) {
    info("\nNo rows confirmed — nothing written.");
    return;
  }

  const { text, appliedLines } = applyEdits(mapText, edits);

  if (flags.dryRun) {
    info(`\n--dry-run: would confirm ${appliedLines.length} row(s); MODULE_MAP.md not written.`);
    return;
  }

  // The rows just audited would be flagged stale by `drift --git` the moment
  // code changes after the OLD anchor commit — offer to move the anchor to
  // HEAD now. Git is only consulted under the documented --git exception, and
  // the move happens only on the human's explicit confirmation.
  let finalText = text;
  if (/Last verified:/i.test(finalText)) {
    if (flags.git) {
      const head = runGit(targetAbs, ["rev-parse", "--short", "HEAD"]);
      const sha = head.ok ? head.out.trim() : "";
      if (/^[0-9a-fA-F]{7,40}$/.test(sha)) {
        const today = new Date().toISOString().slice(0, 10);
        const moved = await confirm(
          `Update the "Last verified" anchor to ${today} @ commit ${sha}? (drift --git diffs against it)`, flags);
        if (moved) finalText = updateAnchorLine(finalText, today, sha) ?? finalText;
      }
    } else {
      info(`\nℹ Update the "Last verified: … @ commit <sha>" line yourself, or drift --git`);
      info(`  will flag the rows you just audited as stale. (Run audit with --git to be`);
      info(`  offered this update automatically.)`);
    }
  }

  const { bkpPath } = await writeAuditedMap(mapPath, mapText, finalText);
  info(`\n✓ Confirmed ${appliedLines.length} row(s).`);
  info(`✓ Backed up the previous MODULE_MAP.md to ${path.relative(targetAbs, bkpPath)}`);
  info(`✓ Wrote ${MODULE_MAP_REL.join("/")}`);
  await refreshProgressPage(targetAbs);
}

// Takes one timestamped backup of the pre-audit content, then writes the new
// content. No interactivity — the caller (the interactive loop above, or a
// test) decides when this should run.
export async function writeAuditedMap(mapPath, previousText, newText) {
  const dir = path.dirname(mapPath);
  const bkpPath = path.join(dir, await reserveBackupPath(dir, path.basename(mapPath, ".md"), ".md"));
  await fs.writeFile(bkpPath, previousText, "utf8");
  await fs.writeFile(mapPath, newText, "utf8");
  return { mapPath, bkpPath };
}
