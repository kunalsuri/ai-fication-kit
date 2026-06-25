// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// verify — deterministic claim verification, the mechanical half of "kept
// mechanically honest". Every backtick-quoted token in the knowledge docs that
// looks like a path is a CLAIM; a claim is either on disk or it is not.
// No model, no execution, no judgement — the human (and the agent commands)
// interpret the report; this code only states facts.

import { promises as fs } from "node:fs";
import path from "node:path";
import { KIT_VERSION, die, info, isDir, isFile, readText } from "./util.mjs";

const VERIFY_MANIFEST_REL = ["ai", "analysis", "audit-reports", "VERIFICATION_MANIFEST.json"];
const VERIFY_REPORT_REL = ["ai", "analysis", "audit-reports", "VERIFICATION_REPORT.md"];
const VERIFY_IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", "out",
  "target", "vendor", "coverage", "__pycache__", ".venv", "venv", ".next", ".turbo",
  ".gradle", ".idea", ".cache", "bin", "obj"]);
// Tokens that look like filenames but never are: product names and code idioms.
const VERIFY_NON_FILES = new Set(["node.js", "vue.js", "react.js", "next.js",
  "express.js", "nest.js", "three.js", "d3.js", "elk.js", "p5.js",
  "module.exports", "process.env", "process.argv", "import.meta", "console.log",
  "console.error", "window.location", "document.body", "this.props", "this.state"]);

function extractClaims(text, sourceFile) {
  const claims = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/`([^`\n]+)`/g)) {
      let s = m[1].trim();
      // Commands, prose, templates, globs: anything with whitespace or shell/
      // placeholder characters is not a path claim.
      if (!s || /[\s{}<>*$()|&;"']/.test(s)) continue;
      // URLs, CLI flags, slash commands, absolute paths: not repo-relative claims.
      if (/^(https?:|--|-|\/|~)/.test(s)) continue;
      s = s.replace(/\\/g, "/").replace(/^\.\//, "").replace(/:\d+(-\d+)?$/, "");
      const isDirClaim = s.endsWith("/");
      if (isDirClaim) s = s.replace(/\/+$/, "");
      if (!s || s === "." || s === "..") continue;
      let type;
      if (isDirClaim || s.includes("/")) type = "path";
      else if (/^[\w.-]+\.[A-Za-z][A-Za-z0-9_]{0,11}$/.test(s) &&
               !VERIFY_NON_FILES.has(s.toLowerCase())) type = "filename";
      else continue; // bare words, tags like [inferred], tool names, commands
      claims.push({ claim: isDirClaim ? s + "/" : s, lookup: s, type,
        sourceFile, line: i + 1 });
    }
  }
  return claims;
}

async function buildFileIndex(root) {
  const byPath = new Map(); // lowercased rel path -> actual rel path (files AND dirs)
  const byName = new Map(); // lowercased basename  -> [actual rel file paths]
  async function walk(relDir) {
    let entries;
    try {
      entries = await fs.readdir(path.join(root, relDir), { withFileTypes: true });
      entries.sort((a, b) => a.name.localeCompare(b.name));
    } catch { return; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const rel = relDir ? relDir + "/" + e.name : e.name;
      byPath.set(rel.toLowerCase(), rel);
      if (e.isDirectory()) {
        if (!VERIFY_IGNORED_DIRS.has(e.name.toLowerCase())) await walk(rel);
      } else if (e.isFile()) {
        const k = e.name.toLowerCase();
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(rel);
      }
    }
  }
  await walk("");
  return { byPath, byName };
}

export async function verify(targetAbs, flags) {
  // 1. Which docs make claims? Entry files + the guide + the feature catalogs.
  const sources = [];
  for (const f of ["CLAUDE.md", "AGENTS.md"]) {
    if (await isFile(path.join(targetAbs, f))) sources.push(f);
  }
  const guideDir = path.join(targetAbs, "ai", "guide");
  if (await isDir(guideDir)) {
    for (const n of (await fs.readdir(guideDir)).sort()) {
      if (n.endsWith(".md")) sources.push("ai/guide/" + n);
    }
  }
  const analysisDir = path.join(targetAbs, "ai", "analysis");
  if (await isDir(analysisDir)) {
    for (const n of (await fs.readdir(analysisDir)).sort()) {
      if (n.startsWith("FEATURE_CATALOG") && n.endsWith(".md")) {
        sources.push("ai/analysis/" + n);
      }
    }
  }
  if (!sources.length) {
    die("Nothing to verify: no CLAUDE.md/AGENTS.md/ai/ docs found. Run install (or shazam) first.");
  }

  // 2. Extract claims (deduplicated per source file).
  const seen = new Set();
  const claims = [];
  for (const src of sources) {
    const text = await readText(path.join(targetAbs, src));
    if (!text) continue;
    for (const c of extractClaims(text, src)) {
      const key = c.lookup.toLowerCase() + "|" + src;
      if (seen.has(key)) continue;
      seen.add(key);
      claims.push(c);
    }
  }

  // 3. One walk of the tree, then check every claim against the index.
  const { byPath, byName } = await buildFileIndex(targetAbs);
  let confirmed = 0, moved = 0, missing = 0;
  for (const c of claims) {
    if (c.type === "path") {
      const hit = byPath.get(c.lookup.toLowerCase());
      if (hit) {
        c.status = "confirmed"; c.foundAt = hit; confirmed++;
      } else {
        const alt = byName.get(c.lookup.split("/").pop().toLowerCase()) || [];
        if (alt.length) {
          c.status = "moved"; c.foundAt = alt[0]; moved++;
          if (alt.length > 1) c.note = `${alt.length} files share this basename`;
        } else {
          c.status = "missing"; c.foundAt = null; missing++;
        }
      }
    } else { // filename claim: confirmed if the basename exists anywhere
      const alt = byName.get(c.lookup.toLowerCase()) || [];
      if (alt.length) {
        c.status = "confirmed"; c.foundAt = alt[0]; confirmed++;
        if (alt.length > 1) c.note = `${alt.length} matches`;
      } else {
        c.status = "missing"; c.foundAt = null; missing++;
      }
    }
    delete c.lookup;
  }

  // 4. Report.
  const generatedAt = new Date().toISOString();
  const manifest = {
    _comment: "Generated by ai-fication-kit `verify` — deterministic file-existence " +
              "checks only, no LLM. Safe to edit manually; regenerate any time.",
    kitVersion: KIT_VERSION,
    generated: generatedAt,
    sourcesScanned: sources,
    totalClaims: claims.length,
    summary: { confirmed, moved, missing },
    claims,
  };
  const bad = claims.filter(c => c.status !== "confirmed");
  const reportLines = [
    "# Claim verification report",
    "",
    `> Generated mechanically by ai-fication-kit \`verify\` on ${generatedAt.slice(0, 10)}.`,
    "> A claim is a backtick-quoted path in the knowledge docs; verification is a",
    "> file-existence check against the repository tree. No model involved — treat",
    "> the statuses as facts, the fix as your judgement.",
    "",
    "| Status | Count | Meaning |",
    "|---|---|---|",
    `| confirmed | ${confirmed} | claim found on disk |`,
    `| moved | ${moved} | path is stale; a file with that name exists elsewhere |`,
    `| missing | ${missing} | nothing on disk matches the claim |`,
    "",
  ];
  if (bad.length) {
    reportLines.push("## Stale or missing claims (fix the docs, or the docs lie)", "",
      "| Claim | Status | Found at | Source | Line |", "|---|---|---|---|---|");
    for (const c of bad) {
      reportLines.push(`| \`${c.claim}\` | ${c.status} | ${c.foundAt ? "`" + c.foundAt + "`" : "—"} | ${c.sourceFile} | ${c.line} |`);
    }
    reportLines.push("");
  } else {
    reportLines.push("All claims confirmed. The knowledge docs match the tree.", "");
  }
  reportLines.push(`${confirmed} confirmed claim(s) — full list in VERIFICATION_MANIFEST.json.`, "");

  info(`\nScanned ${sources.length} doc(s), checked ${claims.length} claim(s):`);
  info(`  confirmed ${confirmed}   moved ${moved}   missing ${missing}`);
  for (const c of bad.slice(0, 20)) {
    info(`  ${c.status === "missing" ? "✗ missing" : "→ moved  "}  ${c.claim}  (${c.sourceFile}:${c.line}${c.foundAt ? " — found at " + c.foundAt : ""})`);
  }
  if (bad.length > 20) info(`  … and ${bad.length - 20} more — see the report.`);

  if (flags.dryRun) {
    info("\n--dry-run: manifest and report not written.");
  } else {
    const reportsDir = path.join(targetAbs, ...VERIFY_MANIFEST_REL.slice(0, -1));
    await fs.mkdir(reportsDir, { recursive: true });
    await fs.writeFile(path.join(targetAbs, ...VERIFY_MANIFEST_REL),
      JSON.stringify(manifest, null, 2) + "\n", "utf8");
    await fs.writeFile(path.join(targetAbs, ...VERIFY_REPORT_REL),
      reportLines.join("\n"), "utf8");
    info(`\n✓ Wrote ${VERIFY_MANIFEST_REL.join("/")}`);
    info(`✓ Wrote ${VERIFY_REPORT_REL.join("/")}`);
  }
  if (flags.strict && bad.length) {
    die(`--strict: ${bad.length} claim(s) not confirmed.`);
  }
}
