// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// install / uninstall — template stamping and manifest-based removal.
// install only copies and stamps text files inside the target directory and
// records every path it writes in ai/install-manifest.json; uninstall deletes
// exactly the files listed there, never following a path outside the target.

import { promises as fs } from "node:fs";
import path from "node:path";
import { KIT_VERSION, MANIFEST_REL, PROFILE_REL, backupName, confirm, die, exists, info,
  readText, templatesRoot } from "./util.mjs";

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

function destinationFor(rel) {
  // templates/claude/** installs to .claude/**; *.tmpl loses its suffix.
  let dest = rel;
  const claudePrefix = "claude" + path.sep;
  if (dest === "claude" || dest.startsWith(claudePrefix)) {
    dest = ".claude" + dest.slice("claude".length);
  }
  if (dest.endsWith(".tmpl")) dest = dest.slice(0, -".tmpl".length);
  return dest;
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

  const plan = [];
  const skipped = [];
  const allLeftovers = new Set();

  for (const rel of installable) {
    const destRel = destinationFor(rel);
    const destAbs = path.join(targetAbs, destRel);
    const already = await exists(destAbs);
    const forceThis = backedUpFiles.has(destRel);
    if (already && !flags.force && !forceThis) { skipped.push(destRel); continue; }
    const raw = await fs.readFile(path.join(templatesRoot, rel), "utf8");
    const { out, leftover } = rel.endsWith(".tmpl") ? stamp(raw, vars) : { out: raw, leftover: [] };
    leftover.forEach(k => allLeftovers.add(k));
    plan.push({ destRel, destAbs, content: out, overwrites: already });
  }

  info(`\nPlan for ${targetAbs}:`);
  for (const p of plan) info(`  ${p.overwrites ? "overwrite" : "write    "}  ${p.destRel}`);
  for (const s of skipped) info(`  skip (exists, no --force)  ${s}`);
  info(`  write      ${PROFILE_REL}   (the orient profile)`);
  info(`  write      ${MANIFEST_REL}  (for clean uninstall)`);
  if (allLeftovers.size) {
    info(`  ⚠ unresolved placeholders left for you to fill: ${[...allLeftovers].join(", ")}`);
  }

  if (flags.dryRun) { info("\n--dry-run: nothing written."); return; }
  if (!(await confirm(`Write ${plan.length + 2} file(s) into ${targetAbs}?`, flags))) {
    info("Aborted; nothing written.");
    return;
  }

  for (const p of plan) {
    await fs.mkdir(path.dirname(p.destAbs), { recursive: true });
    await fs.writeFile(p.destAbs, p.content, "utf8");
  }
  await fs.mkdir(path.join(targetAbs, "ai"), { recursive: true });
  await fs.writeFile(path.join(targetAbs, PROFILE_REL),
    JSON.stringify(profile, null, 2) + "\n", "utf8");
  // Merge with any existing manifest so re-installs never lose track of files.
  // Paths are recorded with forward slashes so manifests are portable across
  // OSes and between the Node and Python installers.
  const posix = (p) => p.split(path.sep).join("/");
  const prevText = await readText(path.join(targetAbs, MANIFEST_REL));
  let prevFiles = [];
  if (prevText) {
    try {
      const parsed = JSON.parse(prevText);
      if (parsed && Array.isArray(parsed.files)) {
        prevFiles = parsed.files;
      }
    } catch { /* corrupt — start fresh */ }
  }
  const manifest = {
    kitVersion: KIT_VERSION,
    installed: new Date().toISOString(),
    files: [...new Set([...prevFiles, ...plan.map(p => posix(p.destRel)),
      posix(PROFILE_REL), posix(MANIFEST_REL), posix(path.join("ai", "repo-indepth.json"))])].sort(),
  };
  await fs.writeFile(path.join(targetAbs, MANIFEST_REL),
    JSON.stringify(manifest, null, 2) + "\n", "utf8");

  info(`\n✓ Installed ${plan.length + 2} file(s).`);
  if (skipped.length) info(`  (${skipped.length} existing file(s) left untouched — use --force to overwrite)`);
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
    await fs.rm(abs, { force: true });
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
