// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// install / uninstall — template stamping and manifest-based removal.
// install only copies and stamps text files inside the target directory and
// records every path it writes (plus its content hash, for re-run provenance)
// in ai/install-manifest.json; uninstall deletes exactly the files listed
// there, never following a path outside the target. Re-runs are incremental:
// see classifyAction below for the child-lock that protects human edits.

import { promises as fs } from "node:fs";
import path from "node:path";
import { KIT_VERSION, MANIFEST_REL, PROFILE_REL, ask, backupName, confirm, die, info,
  readText, sha256, style, templatesRoot } from "./util.mjs";

/** @internal retry budget for transient filesystem locks (Windows AV, etc.). */
const UNINSTALL_RETRY_COUNT = 5;
const UNINSTALL_RETRY_DELAY_MS = 50;

function placeholders(profile) {
  const fork = profile.fork.isFork;
  return {
    PROJECT_NAME: profile.projectName,
    DESCRIPTION: profile.description,
    LANGUAGES: profile.languages.join(", ") || "<fill in>",
    BUILD_CMD: profile.buildCmd,
    TEST_CMD: profile.testCmd,
    UPSTREAM: profile.fork.upstream || "",
    // NOTE: the upstream is an org/repo slug, not a repo-relative path — keep it
    // OUT of backticks so the deterministic `verify` does not flag it as a missing file.
    FORK_LINE: fork
      ? ` This is a FORK of **${profile.fork.upstream}** (upstream).`
      : "",
    FORK_RULE: fork
      ? `**Frozen upstream.** Code inherited from **${profile.fork.upstream}** is off-limits unless the task explicitly requires it. New work goes in our own modules.`
      : "**Respect existing boundaries.** Treat unfamiliar, load-bearing code as frozen until the module map says otherwise.",
    TEST_DIRS: profile.testDirs.join(", ") || "<fill in during cold start>",
    DATE: new Date().toISOString().slice(0, 10),
    KIT_VERSION,
  };
}

function stamp(text, vars) {
  const out = text.replace(/\{\{([A-Z_]+)\}\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : whole);
  const leftover = [...out.matchAll(/\{\{([A-Z_]+)\}\}/g)].map(m => m[1]);
  return { out, leftover: [...new Set(leftover)] };
}

async function listTemplateFiles(rel = "") {
  const abs = path.join(templatesRoot, rel);
  const st = await fs.lstat(abs);
  if (st.isSymbolicLink()) die(`Refusing symlink in kit templates: ${abs}`);
  if (st.isFile()) return [rel];
  const out = [];
  for (const name of (await fs.readdir(abs)).sort()) {
    out.push(...await listTemplateFiles(rel ? path.join(rel, name) : name));
  }
  return out;
}

/** @internal exported for testing — maps template-relative path to install-relative path. */
export function destinationFor(rel) {
  // templates/claude/** installs to .claude/**; *.tmpl loses its suffix.
  // templates/github/** installs to .github/** (also carries Copilot prompts/chatmodes).
  // templates/agents/** installs to .agents/** (Antigravity workflows/skills).
  // templates/cursor/** installs to .cursor/** (native Cursor rules, *.mdc).
  let dest = rel;
  const claudePrefix = "claude" + path.sep;
  const githubPrefix = "github" + path.sep;
  const agentsPrefix = "agents" + path.sep;
  const cursorPrefix = "cursor" + path.sep;
  if (dest === "claude" || dest.startsWith(claudePrefix)) {
    dest = ".claude" + dest.slice("claude".length);
  } else if (dest === "github" || dest.startsWith(githubPrefix)) {
    dest = ".github" + dest.slice("github".length);
  } else if (dest === "agents" || dest.startsWith(agentsPrefix)) {
    dest = ".agents" + dest.slice("agents".length);
  } else if (dest === "cursor" || dest.startsWith(cursorPrefix)) {
    dest = ".cursor" + dest.slice("cursor".length);
  }
  if (dest.endsWith(".tmpl")) dest = dest.slice(0, -".tmpl".length);
  return dest;
}

// The human audit signature. A modified file carrying this tag holds verification
// work a human spent real time on — the installer refuses to overwrite it, even
// under --force (the "child-lock"). Only --force-verified can override it, and
// that path shows every signature at risk and demands a typed confirmation.
export const VERIFIED_TAG = "[verified]";

/** @internal exported for testing — decides what a (re-)install may do to one file.
 * Provenance is the hash recorded in ai/install-manifest.json when the kit last
 * wrote the file. Three-way compare (recorded / on disk / freshly stamped):
 *   "new"        — not on disk: write it (this is how new kit features arrive)
 *   "up-to-date" — disk already equals the stamped template: nothing to do
 *   "update"     — kit-owned (disk == recorded hash, never edited): safe refresh
 *   "locked"     — edited AND carries [verified]: kept, even under --force
 *   "keep"       — edited (or provenance unknown, e.g. pre-hash manifest): kept
 *   "overwrite"  — edited, --force given, no [verified] tag: backup then overwrite
 *   "overwrite-verified" — edited AND [verified], --force-verified given: backup,
 *                  a loud per-signature warning, and an explicit typed confirmation
 */
export function classifyAction({ diskText, recordedHash, newText, force, forceVerified }) {
  if (diskText === null) return "new";
  const diskHash = sha256(diskText);
  if (diskHash === sha256(newText)) return "up-to-date";
  if (recordedHash && diskHash === recordedHash) return "update";
  if (diskText.includes(VERIFIED_TAG)) return forceVerified ? "overwrite-verified" : "locked";
  return force ? "overwrite" : "keep";
}

// The --force-verified warning: for each file, show what is on disk NOW (the human
// [verified] signatures) and what the overwrite does to it, so "are you sure?" is
// answered with full knowledge, not a guess.
function printVerifiedWarning(verifiedOverwrites) {
  const shown = 3; // example lines per file — enough to recognize the audit work
  info("");
  info(style.red(style.bold("  ⚠ DANGER — --force-verified will overwrite human-verified files.")));
  info(style.red("    These files carry [verified] signatures: audit work a human spent real"));
  info(style.red("    time on. Overwriting resets them to the pristine kit template."));
  for (const p of verifiedOverwrites) {
    info("");
    info(`  ${style.bold(p.destRel)} — ${style.red(`${p.verifiedLines.length} ${VERIFIED_TAG} signature(s) will be LOST`)}. On disk now:`);
    for (const line of p.verifiedLines.slice(0, shown)) {
      const trimmed = line.trim();
      info(style.dim(`      ${trimmed.length > 96 ? trimmed.slice(0, 93) + "..." : trimmed}`));
    }
    if (p.verifiedLines.length > shown) {
      info(style.dim(`      … and ${p.verifiedLines.length - shown} more ${VERIFIED_TAG} line(s)`));
    }
    info(`    ${style.amber("after:")} the file becomes the stock template again — audited content is`);
    info(`    replaced, rows return to ${style.dim("[inferred]")} placeholders, and a human must re-audit.`);
    info(`    ${style.green("backup:")} the current file is copied to ${p.backup} first.`);
  }
  info("");
}

export async function install(targetAbs, profile, flags) {
  // ---- Process 2: back up user-authored CLAUDE.md / AGENTS.md ----
  const backups = [];
  if (profile.maturity?.process === 2) {
    const aiConfig = profile.existingAIConfig || {};
    for (const [srcFile, base] of [["CLAUDE.md", "CLAUDE"], ["AGENTS.md", "AGENTS"]]) {
      const cfg = aiConfig[srcFile === "CLAUDE.md" ? "claudeMd" : "agentsMd"];
      if (cfg?.exists && !cfg.hasKitFooter) {
        const srcAbs = path.join(targetAbs, srcFile);
        const bkpRel = backupName(base);
        const bkpAbs = path.join(targetAbs, bkpRel);
        if (!flags.dryRun) {
          await fs.copyFile(srcAbs, bkpAbs);
        }
        backups.push({ source: srcFile, backup: bkpRel });
        info(`  ℹ Backed up ${srcFile} → ${bkpRel} (knowledge preserved for /cold-start)`);
      }
    }
  }
  // Files backed up in Process 2 must be overwritten even without --force.
  const backedUpFiles = new Set(backups.map(b => b.source));

  const vars = placeholders(profile);
  // templates/README.md documents the templates themselves and is not installed.
  const installable = (await listTemplateFiles()).filter(rel => rel !== "README.md");

  // Provenance from the previous install: content hashes recorded when the kit
  // last wrote each file. Manifests older than this feature have no hashes; their
  // existing files classify as "keep" (unknown provenance — same as today's skip).
  const posix = (p) => p.split(path.sep).join("/");
  const prevText = await readText(path.join(targetAbs, MANIFEST_REL));
  let prevFiles = [];
  let prevHashes = {};
  if (prevText) {
    try {
      const parsed = JSON.parse(prevText);
      if (parsed && Array.isArray(parsed.files)) prevFiles = parsed.files;
      if (parsed && parsed.fileHashes && typeof parsed.fileHashes === "object") {
        prevHashes = parsed.fileHashes;
      }
    } catch { /* corrupt — start fresh */ }
  }

  const plan = [];      // will be written: action ∈ new | update | overwrite
  const kept = [];      // untouched: action ∈ keep | locked
  const upToDate = [];  // disk already equals the stamped template
  const allLeftovers = new Set();

  for (const rel of installable) {
    const destRel = destinationFor(rel);
    const destAbs = path.join(targetAbs, destRel);
    const raw = await fs.readFile(path.join(templatesRoot, rel), "utf8");
    const { out, leftover } = rel.endsWith(".tmpl") ? stamp(raw, vars) : { out: raw, leftover: [] };
    const diskText = await readText(destAbs);
    // Files backed up in Process 2 were preserved already — write unconditionally.
    const action = backedUpFiles.has(destRel)
      ? (diskText === null ? "new" : "overwrite-backed-up")
      : classifyAction({ diskText, recordedHash: prevHashes[posix(destRel)], newText: out,
          force: flags.force, forceVerified: flags.forceVerified });
    if (action === "up-to-date") { upToDate.push({ destRel, hash: sha256(out) }); continue; }
    if (action === "keep" || action === "locked") { kept.push({ destRel, action }); continue; }
    leftover.forEach(k => allLeftovers.add(k));
    // "overwrite" / "overwrite-verified" target a human-edited file — take a
    // timestamped backup first.
    const backup = (action === "overwrite" || action === "overwrite-verified")
      ? path.join(path.dirname(destRel), backupName(path.basename(destRel, path.extname(destRel)), path.extname(destRel)))
      : null;
    let verifiedLines = null;
    if (action === "overwrite-verified") {
      // Show the human's signatures, not the template's own [verified] prose:
      // prefer tag lines that do not appear verbatim in the pristine template.
      const templateLines = new Set(out.split("\n"));
      const tagLines = diskText.split("\n").filter(l => l.includes(VERIFIED_TAG));
      const humanAdded = tagLines.filter(l => !templateLines.has(l));
      verifiedLines = humanAdded.length ? humanAdded : tagLines;
    }
    plan.push({ destRel, destAbs, content: out, action, backup, verifiedLines });
  }

  info(`\nPlan for ${targetAbs}:`);
  for (const p of plan) {
    if (p.action === "new") info(`  write (new)        ${p.destRel}`);
    else if (p.action === "update") info(`  update (kit-owned, never edited)  ${p.destRel}`);
    else if (p.action === "overwrite") info(`  overwrite (--force; backup: ${p.backup})  ${p.destRel}`);
    else if (p.action === "overwrite-verified") info(`  overwrite (--force-verified — see warning below; backup: ${p.backup})  ${p.destRel}`);
    else info(`  overwrite (backed up above)  ${p.destRel}`);
  }
  for (const k of kept) {
    if (k.action === "locked") {
      info(`  keep (child-lock: human ${VERIFIED_TAG} content — only --force-verified overrides)  ${k.destRel}`);
    } else {
      info(`  keep (edited since install${flags.force ? "" : "; --force to overwrite with backup"})  ${k.destRel}`);
    }
  }
  if (upToDate.length) info(`  ${upToDate.length} file(s) already up to date — untouched.`);
  info(`  write      ${PROFILE_REL}   (the orient profile)`);
  info(`  write      ${MANIFEST_REL}  (for clean uninstall + re-run provenance)`);
  if (allLeftovers.size) {
    info(`  ⚠ unresolved placeholders left for you to fill: ${[...allLeftovers].join(", ")}`);
  }

  // --force-verified: show exactly what will be destroyed, then require an explicit
  // typed confirmation. Printed on --dry-run too, so the warning can be previewed.
  const verifiedOverwrites = plan.filter(p => p.action === "overwrite-verified");
  if (verifiedOverwrites.length) printVerifiedWarning(verifiedOverwrites);

  if (flags.dryRun) { info("\n--dry-run: nothing written."); return; }

  if (verifiedOverwrites.length && !flags.yes) {
    // Deliberately NOT a y/N prompt: destroying audit signatures takes a typed word.
    // Non-interactive runs without --yes get "" back from ask() and abort safely.
    const answer = await ask(
      `Are you SURE? Type "overwrite" to replace the ${verifiedOverwrites.length} ${VERIFIED_TAG} file(s) above (anything else aborts)`,
      flags, "");
    if (answer.trim().toLowerCase() !== "overwrite") {
      info(`Aborted; nothing written. Your ${VERIFIED_TAG} files are untouched.`);
      return;
    }
  }
  if (!(await confirm(`Write ${plan.length + 2} file(s) into ${targetAbs}?`, flags))) {
    info("Aborted; nothing written.");
    return;
  }

  for (const p of plan) {
    if (p.backup) {
      await fs.copyFile(p.destAbs, path.join(targetAbs, p.backup));
      info(`  ℹ Backed up ${p.destRel} → ${p.backup}`);
    }
    await fs.mkdir(path.dirname(p.destAbs), { recursive: true });
    await fs.writeFile(p.destAbs, p.content, "utf8");
  }
  // A re-run must never erase the intake wizard's answers: if the fresh profile has
  // no humanContext but the one on disk does, carry it forward.
  if (!profile.humanContext) {
    try {
      const prevProfile = JSON.parse(await readText(path.join(targetAbs, PROFILE_REL)) ?? "null");
      if (prevProfile?.humanContext) profile.humanContext = prevProfile.humanContext;
    } catch { /* no usable prior profile */ }
  }
  await fs.mkdir(path.join(targetAbs, "ai"), { recursive: true });
  await fs.writeFile(path.join(targetAbs, PROFILE_REL),
    JSON.stringify(profile, null, 2) + "\n", "utf8");
  // Merge with any existing manifest so re-installs never lose track of files.
  // Paths are recorded with forward slashes so manifests are portable across
  // OSes. fileHashes records the
  // content the kit wrote, so the next run can tell kit-owned from human-edited.
  const fileHashes = { ...prevHashes };
  for (const p of plan) fileHashes[posix(p.destRel)] = sha256(p.content);
  for (const u of upToDate) fileHashes[posix(u.destRel)] = u.hash;
  const manifest = {
    kitVersion: KIT_VERSION,
    installed: new Date().toISOString(),
    files: [...new Set([...prevFiles, ...plan.map(p => posix(p.destRel)),
      posix(PROFILE_REL), posix(MANIFEST_REL), posix(path.join("ai", "repo-indepth.json"))])].sort(),
    fileHashes: Object.fromEntries(Object.entries(fileHashes).sort(([a], [b]) => a.localeCompare(b))),
  };
  await fs.writeFile(path.join(targetAbs, MANIFEST_REL),
    JSON.stringify(manifest, null, 2) + "\n", "utf8");

  info(`\n✓ Installed ${plan.length + 2} file(s).`);
  const lockedCount = kept.filter(k => k.action === "locked").length;
  if (kept.length) {
    info(`  (${kept.length} edited file(s) kept${lockedCount ? `, ${lockedCount} of them ${VERIFIED_TAG}-locked` : ""} — your audit work is untouched)`);
  }
  if (upToDate.length) info(`  (${upToDate.length} file(s) were already up to date)`);
  if (backups.length) {
    info(`  (${backups.length} existing file(s) backed up with timestamp)`);
  }
}

export async function uninstall(targetAbs, flags) {
  const manifestText = await readText(path.join(targetAbs, MANIFEST_REL));
  if (!manifestText) die(`No ${MANIFEST_REL} found in ${targetAbs} — nothing to uninstall.`);
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    die(`Could not parse ${MANIFEST_REL}.`);
  }
  const files = (manifest && Array.isArray(manifest.files)) ? manifest.files : [];

  info(`\nWill remove ${files.length} file(s) recorded by the installer:`);
  for (const f of files) info(`  delete  ${f}`);
  if (flags.dryRun) { info("\n--dry-run: nothing deleted."); return; }
  if (!(await confirm("Proceed?", flags))) { info("Aborted; nothing deleted."); return; }

  const targetAbsNormalized = path.normalize(targetAbs);
  for (const f of files) {
    const abs = path.normalize(path.join(targetAbs, f));
    // Safety: never follow a path outside the target.
    const relative = path.relative(targetAbsNormalized, abs);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
      die(`Refusing path outside target: ${f}`);
    }
    for (let attempt = 0; attempt < UNINSTALL_RETRY_COUNT; attempt++) {
      try {
        await fs.rm(abs, { force: true });
        break;
      } catch (err) {
        if (attempt === UNINSTALL_RETRY_COUNT - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, UNINSTALL_RETRY_DELAY_MS));
      }
    }
  }
  // Remove now-empty directories the kit created (best effort, deepest first).
  const dirsSet = new Set();
  for (const f of files) {
    const parts = f.split("/");
    parts.pop(); // remove file name
    while (parts.length > 0) {
      dirsSet.add(parts.join(path.sep));
      parts.pop();
    }
  }
  const dirs = [...dirsSet].sort((a, b) => b.length - a.length);
  for (const d of dirs) {
    try { await fs.rmdir(path.join(targetAbs, d)); } catch { /* not empty — keep */ }
  }
  // Report backup files if any exist.
  const bkpFiles = [];
  for (const name of await fs.readdir(targetAbsNormalized).catch(() => [])) {
    if (/^(CLAUDE|AGENTS)_bkp_\d{8}_\d{6}\.md$/.test(name)) bkpFiles.push(name);
  }
  if (bkpFiles.length) {
    info(`\nℹ The following backup files were NOT removed (your prior knowledge):`);
    for (const b of bkpFiles) info(`  → ${path.join(targetAbsNormalized, b)}`);
    info(`  Restore manually if needed, or delete them when no longer useful.`);
  }
  info(`\n✓ Uninstalled.`);
}
