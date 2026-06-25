// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// drift — deterministic drift detection: where has the repository moved away
// from the knowledge layer since it was last mapped/verified?
//
// `verify` answers one question: do the paths the docs QUOTE still exist?
// `drift` answers the reverse and the time question:
//   unmapped — a code-bearing top-level directory that NO MODULE_MAP row covers
//              (the agent is back to crawling/guessing there).
//   vanished — a directory or entry point quoted in MODULE_MAP that is gone.
//   stale    — a [verified] row whose code changed since the verified commit
//              (trust silently rotting).
//
// Structural drift (unmapped, vanished) is pure file inspection: no execution,
// no network — the same guarantee as orient/install/verify. The stale check is
// the single exception and is OPT-IN: only with --git does this command shell
// out to a LOCAL, READ-ONLY `git` to see what changed since the verified commit.
// Like verify, this code states facts; the fix is your (and your agent's) judgement.

import { promises as fs } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { KIT_VERSION, die, info, isDir, isFile, readText } from "./util.mjs";

const MODULE_MAP_REL = ["ai", "guide", "MODULE_MAP.md"];
const DRIFT_MANIFEST_REL = ["ai", "analysis", "audit-reports", "DRIFT_MANIFEST.json"];
const DRIFT_REPORT_REL = ["ai", "analysis", "audit-reports", "DRIFT_REPORT.md"];

// Never crawled and never flagged: build output, tooling, and the kit's own layer.
const DRIFT_IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", "out",
  "target", "vendor", "coverage", "__pycache__", ".venv", "venv", ".next", ".turbo",
  ".gradle", ".idea", ".cache", "bin", "obj", "ai", ".claude"]);

// A directory "bears code" if it holds at least one file with a source extension.
// This keeps docs-only and config-only directories (docs/, .github/) from being
// reported as unmapped — the map is about where the *code* lives.
const SOURCE_EXTS = new Set(["js", "mjs", "cjs", "jsx", "ts", "tsx", "py", "java",
  "kt", "kts", "go", "rs", "rb", "php", "c", "cc", "cpp", "cxx", "h", "hpp", "cs",
  "swift", "scala", "clj", "ex", "exs", "sh", "bash", "vue", "svelte", "m", "mm",
  "dart", "lua", "r", "jl", "pl"]);

// Extract `backtick-quoted` tokens from one Markdown table cell, normalized.
function backticks(cell) {
  const out = [];
  if (!cell) return out;
  for (const m of cell.matchAll(/`([^`]+)`/g)) {
    const s = m[1].trim().replace(/\\/g, "/").replace(/^\.\//, "");
    if (s) out.push(s);
  }
  return out;
}

function firstSegment(p) {
  return p.replace(/^\/+/, "").split("/")[0];
}

// Parse the MODULE_MAP table. The "Entry point" is the 3rd column in both the
// populated layout (Directory|Responsibility|Entry point|Stability|Status) and
// the scaffolded template (Directory|Responsibility|Entry point|Stability); the
// provenance tag, when present, lives in the last column.
function parseModuleMap(text) {
  const rows = [];
  let verifiedSha = null;
  const shaMatch = text.match(/Last verified:[^\n]*@\s*commit\s+([0-9a-fA-F]{7,40})\b/i);
  if (shaMatch) verifiedSha = shaMatch[1];

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith("|")) continue;
    if (/^[\s|:-]+$/.test(line)) continue; // separator row (---|---)
    const cells = line.split("|").map(c => c.trim());
    if (cells.length && cells[0] === "") cells.shift();
    if (cells.length && cells[cells.length - 1] === "") cells.pop();
    if (cells.length < 3) continue;
    const joined = cells.join(" ").toLowerCase();
    if (joined.includes("directory") && joined.includes("entry point")) continue; // header

    const dirClaims = backticks(cells[0]);
    const entryClaims = backticks(cells[2]);
    if (!dirClaims.length && !entryClaims.length) continue; // placeholder (<fill in>)

    const statusCell = cells[cells.length - 1] || "";
    const status = /\[verified\]/i.test(statusCell) ? "verified"
      : /\[inferred\]/i.test(statusCell) ? "inferred" : "unknown";
    rows.push({
      dirClaims, entryClaims, status, line: i + 1,
      label: dirClaims[0] || entryClaims[0],
    });
  }
  return { rows, verifiedSha };
}

// Recursively answer "does this directory contain any source file?" (stops early).
async function hasSourceFile(dirAbs) {
  const stack = [dirAbs];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try { entries = await fs.readdir(current, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (!DRIFT_IGNORED_DIRS.has(e.name.toLowerCase()) && !e.name.startsWith(".")) {
          stack.push(path.join(current, e.name));
        }
      } else if (e.isFile()) {
        const dot = e.name.lastIndexOf(".");
        const ext = dot > 0 ? e.name.slice(dot + 1).toLowerCase() : "";
        if (SOURCE_EXTS.has(ext)) return true;
      }
    }
  }
  return false;
}

function runGit(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return { ok: !r.error && r.status === 0, out: r.stdout || "" };
}

export async function drift(targetAbs, flags) {
  const mapPath = path.join(targetAbs, ...MODULE_MAP_REL);
  const mapText = await readText(mapPath);
  if (mapText === null) {
    die(`No ${MODULE_MAP_REL.join("/")} found. Run install (or shazam) first, then /cold-start.`);
  }
  const { rows, verifiedSha } = parseModuleMap(mapText);

  // Segments (top-level names) the map knows about, via either a directory or an
  // entry-point claim. The `/` (root) marker contributes no segment of its own.
  const mappedSegments = new Set();
  for (const row of rows) {
    for (const c of [...row.dirClaims, ...row.entryClaims]) {
      const seg = firstSegment(c);
      if (seg) mappedSegments.add(seg);
    }
  }

  // 1. UNMAPPED — code-bearing top-level directories no row covers.
  const unmapped = [];
  for (const e of await fs.readdir(targetAbs, { withFileTypes: true })) {
    if (!e.isDirectory() || e.isSymbolicLink()) continue;
    if (e.name.startsWith(".") || DRIFT_IGNORED_DIRS.has(e.name.toLowerCase())) continue;
    if (mappedSegments.has(e.name)) continue;
    if (await hasSourceFile(path.join(targetAbs, e.name))) {
      unmapped.push({ path: e.name + "/", kind: "dir" });
    }
  }
  unmapped.sort((a, b) => a.path.localeCompare(b.path));

  // 2. VANISHED — directories / entry points the map quotes that are gone.
  const vanished = [];
  for (const row of rows) {
    for (const d of row.dirClaims) {
      const clean = d.replace(/\/+$/, "");
      if (!clean || clean === "/") continue; // root marker
      if (!(await isDir(path.join(targetAbs, clean)))) {
        vanished.push({ claim: d, kind: "dir", line: row.line, status: row.status });
      }
    }
    for (const f of row.entryClaims) {
      const clean = f.replace(/\/+$/, "");
      if (!clean || clean === "/") continue;
      const abs = path.join(targetAbs, clean);
      if (!(await isFile(abs)) && !(await isDir(abs))) {
        vanished.push({ claim: f, kind: "file", line: row.line, status: row.status });
      }
    }
  }

  // 3. STALE — [verified] rows whose code changed since the verified commit.
  //    Opt-in (--git): the one place this command shells out to local git.
  const stale = [];
  const git = { requested: Boolean(flags.git), available: false, headSha: null, verifiedSha, note: null };
  if (!flags.git) {
    git.note = "stale check is opt-in — re-run with --git to compare against the last verified commit (local, read-only git).";
  } else {
    const head = runGit(targetAbs, ["rev-parse", "HEAD"]);
    if (!head.ok) {
      git.note = "git not available, or target is not a git repository; stale check skipped.";
    } else if (!verifiedSha) {
      git.available = true; git.headSha = head.out.trim();
      git.note = "MODULE_MAP records no verified commit (`Last verified: … @ commit <sha>`); stale check skipped.";
    } else {
      git.available = true; git.headSha = head.out.trim();
      const diff = runGit(targetAbs, ["diff", "--name-only", verifiedSha, "HEAD"]);
      if (!diff.ok) {
        git.note = `could not diff ${verifiedSha}..HEAD (unknown commit / shallow clone?); stale check skipped.`;
      } else {
        const changed = diff.out.split("\n").map(s => s.trim()).filter(Boolean);
        for (const row of rows.filter(r => r.status === "verified")) {
          const owned = [...row.dirClaims, ...row.entryClaims]
            .map(p => p.replace(/\/+$/, "")).filter(p => p && p !== "/");
          const hits = changed.filter(cf => owned.some(o => cf === o || cf.startsWith(o + "/")));
          if (hits.length) stale.push({ row: row.label, line: row.line, changedFiles: hits.slice(0, 50) });
        }
      }
    }
  }

  const total = unmapped.length + vanished.length + stale.length;

  // ---- Report ----
  const generatedAt = new Date().toISOString();
  const manifest = {
    _comment: "Generated by ai-fication-kit `drift` — deterministic structural " +
      "checks (no execution). The optional --git stale check uses local read-only git.",
    kitVersion: KIT_VERSION,
    generated: generatedAt,
    modulesScanned: rows.length,
    git,
    summary: { unmapped: unmapped.length, vanished: vanished.length, stale: stale.length },
    unmapped, vanished, stale,
  };

  const lines = [
    "# Drift report",
    "",
    `> Generated mechanically by ai-fication-kit \`drift\` on ${generatedAt.slice(0, 10)}.`,
    "> Drift is where the repository has moved away from the knowledge layer. The",
    "> statuses are facts; closing the gap (re-map, fix the docs, re-audit) is your call.",
    "",
    "| Drift | Count | Meaning |",
    "|---|---|---|",
    `| unmapped | ${unmapped.length} | code-bearing directory no MODULE_MAP row covers |`,
    `| vanished | ${vanished.length} | directory / entry point the map quotes is gone |`,
    `| stale | ${stale.length} | \`[verified]\` row whose code changed since the verified commit |`,
    "",
  ];
  if (unmapped.length) {
    lines.push("## Unmapped (agents will crawl/guess here)", "",
      "| Directory |", "|---|");
    for (const u of unmapped) lines.push(`| \`${u.path}\` |`);
    lines.push("");
  }
  if (vanished.length) {
    lines.push("## Vanished (the map points at code that is gone)", "",
      "| Claim | Kind | Status | MODULE_MAP line |", "|---|---|---|---|");
    for (const v of vanished) lines.push(`| \`${v.claim}\` | ${v.kind} | ${v.status} | ${v.line} |`);
    lines.push("");
  }
  if (stale.length) {
    lines.push("## Stale verified rows (re-audit these)", "",
      "| Row | MODULE_MAP line | Changed files since verified commit |", "|---|---|---|");
    for (const s of stale) lines.push(`| \`${s.row}\` | ${s.line} | ${s.changedFiles.map(f => "`" + f + "`").join(", ")} |`);
    lines.push("");
  }
  if (!total) lines.push("No drift detected. The map matches the tree.", "");
  if (git.note) lines.push(`> Stale check: ${git.note}`, "");

  info(`\nScanned ${rows.length} mapped module(s):`);
  info(`  unmapped ${unmapped.length}   vanished ${vanished.length}   stale ${stale.length}`);
  for (const u of unmapped.slice(0, 20)) info(`  + unmapped  ${u.path}`);
  for (const v of vanished.slice(0, 20)) info(`  ✗ vanished  ${v.claim}  (MODULE_MAP:${v.line})`);
  for (const s of stale.slice(0, 20)) info(`  ~ stale     ${s.row}  (MODULE_MAP:${s.line})`);
  if (git.note) info(`  note: ${git.note}`);

  if (flags.dryRun) {
    info("\n--dry-run: manifest and report not written.");
  } else {
    const dir = path.join(targetAbs, ...DRIFT_MANIFEST_REL.slice(0, -1));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(targetAbs, ...DRIFT_MANIFEST_REL),
      JSON.stringify(manifest, null, 2) + "\n", "utf8");
    await fs.writeFile(path.join(targetAbs, ...DRIFT_REPORT_REL), lines.join("\n"), "utf8");
    info(`\n✓ Wrote ${DRIFT_MANIFEST_REL.join("/")}`);
    info(`✓ Wrote ${DRIFT_REPORT_REL.join("/")}`);
  }
  if (flags.strict && total) {
    die(`--strict: ${total} drift finding(s).`);
  }
}
