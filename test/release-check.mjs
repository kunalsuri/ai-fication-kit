#!/usr/bin/env node
// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
//
// release-check — deterministic release-readiness gate (SPEC_release-check.md).
// Zero dependencies. Maintainer tooling for THIS repo; not stamped into targets.
//
// Run: npm run release-check              (pre-tag mode: checks against package.json)
//      node test/release-check.mjs --tag v0.2.0   (tag mode: checks against the tag)
//      node test/release-check.mjs --full         (also runs npm test + verify --strict)
// In CI, tag mode is auto-detected from GITHUB_REF (refs/tags/v*).
//
// Checks (hard = exit 1 on failure, info = printed for human judgement):
//   1. version-sync   (hard)  package.json = KIT_VERSION in lib/util.mjs
//                             = CITATION.cff = README BibTeX (= tag, in tag mode).
//                             .zenodo.json is checked only if it carries a version
//                             field (Zenodo normally takes it from the release).
//   2. changelog-gate (hard)  pre-tag: a dated `## [X.Y.Z]` section with its link
//                             ref, OR an `[Unreleased]` section, must exist.
//                             tag mode: the dated section + link ref are required
//                             and `[Unreleased]`, if present, must be empty.
//   3. coverage       (info)  files changed since the last tag, grouped by area,
//                             keyword-matched against the changelog section text.
//                             Skipped (stated, never silent) without git/tags.
//   4. cli-docs-sync  (hard)  every command and --flag in install.mjs must appear
//                             in docs/CLI-REFERENCE.md and in the usage help.
//                             Skipped (stated) if install.mjs is absent (fixtures).

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const here = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- CLI parsing
const argv = process.argv.slice(2);
let tag = null, full = false;
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--tag") {
    tag = argv[++i];
    if (tag === undefined) { console.error("--tag requires a value (vX.Y.Z)"); process.exit(1); }
  } else if (a === "--full") full = true;
  else if (a.startsWith("--")) { console.error(`Unknown option: ${a}`); process.exit(1); }
  else positional.push(a);
}
// CI auto-detection: a v* tag push puts refs/tags/vX.Y.Z in GITHUB_REF.
if (!tag && /^refs\/tags\/v/.test(process.env.GITHUB_REF || "")) {
  tag = (process.env.GITHUB_REF || "").replace("refs/tags/", "");
}
const root = path.resolve(positional[0] || path.dirname(here));
const tagMode = tag !== null;

let failures = 0;
const fail = (msg) => { failures++; console.error(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);
const note = (msg) => console.log(`  — ${msg}`);

async function readIf(rel) {
  try { return await fs.readFile(path.join(root, rel), "utf8"); } catch { return null; }
}

console.log(`release-check — ${tagMode ? `tag mode (${tag})` : "pre-tag mode"} — ${root}`);

// ---------------------------------------------------------- 1 · version-sync
console.log("\n1. version-sync");
const pkgText = await readIf("package.json");
if (pkgText === null) { fail("package.json not found — cannot determine the version"); }
let version = null;
if (pkgText !== null) {
  try { version = JSON.parse(pkgText).version || null; } catch { /* fall through */ }
  if (!version) fail("package.json has no parseable \"version\" field");
}
if (version) {
  pass(`package.json → ${version}`);
  // Every other file that states a version must agree with package.json.
  const sources = [
    { rel: "lib/util.mjs", re: /KIT_VERSION\s*=\s*"([^"]+)"/, what: "KIT_VERSION" },
    { rel: "CITATION.cff", re: /^version:\s*"?([^\s"]+)"?/m, what: "version:" },
    { rel: ".zenodo.json", re: /"version"\s*:\s*"([^"]+)"/, what: "\"version\"", optionalField: true },
    { rel: "README.md", re: /version\s*=\s*\{([^}]+)\}/, what: "BibTeX version" },
  ];
  for (const s of sources) {
    const text = await readIf(s.rel);
    if (text === null) { note(`${s.rel} not present — skipped`); continue; }
    const m = text.match(s.re);
    if (!m) {
      if (s.optionalField) note(`${s.rel} states no version — skipped (Zenodo takes it from the release)`);
      else note(`${s.rel} states no version (${s.what} not found) — skipped`);
      continue;
    }
    if (m[1].trim() === version) pass(`${s.rel} ${s.what} → ${m[1].trim()}`);
    else fail(`${s.rel} ${s.what} says ${m[1].trim()}, package.json says ${version}`);
  }
  if (tagMode) {
    if (tag === `v${version}`) pass(`tag ${tag} matches v${version}`);
    else fail(`tag ${tag} does not match package.json (v${version})`);
  }
}

// -------------------------------------------------------- 2 · changelog-gate
console.log("\n2. changelog-gate");
const changelog = await readIf("CHANGELOG.md");
// The section text feeds check 3's keyword match, so capture it here.
let releaseSectionText = null;
if (changelog === null) {
  fail("CHANGELOG.md not found");
} else if (version) {
  const esc = version.replace(/\./g, "\\.");
  const sectionRe = new RegExp(`^## \\[${esc}\\]\\s*[—–-]+\\s*(\\d{4}-\\d{2}-\\d{2})`, "m");
  const dated = changelog.match(sectionRe);
  const linkRef = new RegExp(`^\\[${esc}\\]:\\s*http`, "m").test(changelog);
  const unreleasedAt = changelog.search(/^## \[Unreleased\]/m);
  const sectionBody = (header) => {
    const start = changelog.indexOf(header);
    if (start === -1) return null;
    const rest = changelog.slice(start + header.length);
    const next = rest.search(/^## /m);
    return next === -1 ? rest : rest.slice(0, next);
  };
  if (dated) releaseSectionText = sectionBody(dated[0]);
  else if (unreleasedAt !== -1) releaseSectionText = sectionBody("## [Unreleased]");

  if (dated && linkRef) {
    pass(`dated section ## [${version}] — ${dated[1]} with link reference`);
  } else if (dated && !linkRef) {
    fail(`## [${version}] section exists but its link reference ([${version}]: https://…) is missing`);
  } else if (tagMode) {
    fail(`no dated ## [${version}] section — required at tag time`);
  } else if (unreleasedAt !== -1) {
    pass(`no ## [${version}] section yet, but [Unreleased] exists (fine before release-day)`);
  } else {
    fail(`neither a dated ## [${version}] section nor an [Unreleased] section exists`);
  }
  if (tagMode && unreleasedAt !== -1) {
    const body = sectionBody("## [Unreleased]") || "";
    if (body.replace(/\s/g, "") === "") pass("[Unreleased] section is empty");
    else fail("[Unreleased] still has content — move it into the release section before tagging");
  }
}

// ------------------------------------------------- 3 · coverage report (info)
console.log("\n3. coverage report (informational — human judges)");
{
  const git = (...args) => spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  const lastTag = git("describe", "--tags", "--abbrev=0").stdout.trim();
  if (!lastTag) {
    note("skipped — no git history or no previous tag reachable from HEAD");
  } else if (!releaseSectionText) {
    note(`skipped — no changelog section to match against`);
  } else {
    const files = git("diff", "--name-only", `${lastTag}..HEAD`).stdout
      .split("\n").map((f) => f.trim()).filter(Boolean);
    const areas = new Map();
    for (const f of files) {
      const top = f.includes("/") ? f.slice(0, f.indexOf("/")) + "/" : f;
      if (!areas.has(top)) areas.set(top, []);
      areas.get(top).push(f);
    }
    note(`${files.length} file(s) changed since ${lastTag} across ${areas.size} area(s)`);
    const sectionLower = releaseSectionText.toLowerCase();
    // Only source-bearing areas need changelog coverage; docs/knowledge churn doesn't.
    const sourceAreas = new Set(["lib/", "templates/", "test/", "install.mjs", ".github/"]);
    for (const [area, list] of [...areas.entries()].sort()) {
      if (!sourceAreas.has(area)) continue;
      const mentioned = sectionLower.includes(area.replace(/\/$/, "").toLowerCase()) ||
        list.some((f) => sectionLower.includes(path.basename(f).toLowerCase()));
      if (mentioned) pass(`${area} (${list.length} file(s)) — mentioned in the changelog section`);
      else console.log(`  ⚠ ${area} (${list.length} file(s)) changed but no keyword match in the changelog section — check it is accounted for`);
    }
  }
}

// -------------------------------------------------------- 4 · cli-docs-sync
console.log("\n4. cli-docs-sync");
{
  const cli = await readIf("install.mjs");
  const docs = await readIf(path.join("docs", "CLI-REFERENCE.md"));
  if (cli === null) {
    note("skipped — no install.mjs at the target root");
  } else if (docs === null) {
    fail("docs/CLI-REFERENCE.md not found while install.mjs exists");
  } else {
    // Commands come from the CLI's own COMMANDS set; flags from every --token
    // literal in the source (the argv parser and its usage text are one file).
    const setMatch = cli.match(/new Set\(\[([^\]]+)\]\)/);
    const commands = setMatch ? [...setMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];
    const flags = [...new Set([...cli.matchAll(/--[a-z][a-z-]*[a-z]/g)].map((m) => m[0]))];
    if (commands.length === 0) note("no COMMANDS set found in install.mjs — command check skipped");
    const usage = spawnSync(process.execPath, [path.join(root, "install.mjs")], {
      encoding: "utf8", cwd: root,
    });
    const usageText = (usage.stdout || "") + (usage.stderr || "");
    const missing = [];
    for (const token of [...commands, ...flags]) {
      if (!docs.includes(token)) missing.push(`${token} (docs/CLI-REFERENCE.md)`);
      if (!usageText.includes(token)) missing.push(`${token} (usage help)`);
    }
    if (missing.length === 0) {
      pass(`${commands.length} command(s) and ${flags.length} flag(s) all documented and in the usage help`);
    } else {
      for (const m of missing) fail(`undocumented: ${m}`);
    }
  }
}

// ------------------------------------------------- 5 · existing gates (--full)
if (full) {
  console.log("\n5. existing gates (--full)");
  const gates = [
    ["npm test", "npm", ["test"]],
    ["verify --strict", process.execPath, [path.join(root, "install.mjs"), "verify", root, "--strict"]],
  ];
  for (const [label, cmd, args] of gates) {
    const r = spawnSync(cmd, args, { encoding: "utf8", cwd: root, shell: process.platform === "win32" });
    if (r.status === 0) pass(label);
    else { fail(`${label} exited ${r.status}`); console.error(((r.stdout || "") + (r.stderr || "")).split("\n").slice(-15).join("\n")); }
  }
}

console.log(failures ? `\n✗ release-check: ${failures} failure(s)` : "\n✓ release-check: all gates green");
process.exit(failures ? 1 : 0);
