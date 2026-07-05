// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
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
import { KIT_VERSION, die, info, isDir, isFile, readText, writeGithubSummary } from "./util.mjs";
import { refreshProgressPage } from "./progress.mjs";

export const MODULE_MAP_REL = ["ai", "guide", "MODULE_MAP.md"];
// Exact placeholder text from templates/ai/guide/MODULE_MAP.md.tmpl's scaffolded
// row (`| <fill in> | <fill in> | <fill in> | ? |`) — a still-scaffolded map has
// never had this literal string replaced.
export const MODULE_MAP_PLACEHOLDER = "<fill in>";
const DRIFT_MANIFEST_REL = ["ai", "analysis", "audit-reports", "DRIFT_MANIFEST.json"];
const DRIFT_REPORT_REL = ["ai", "analysis", "audit-reports", "DRIFT_REPORT.md"];

// Never crawled and never flagged: build output, tooling, and the kit's own layer.
export const DRIFT_IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", "out",
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
export function parseModuleMap(text) {
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

// Deterministic entry-point guess for an unmapped directory, for `--suggest`:
// first `index.<ext>` / `main.<ext>` found (shallowest, then alphabetical),
// else the largest source file by byte size (ties broken alphabetically).
// Returns a repo-relative posix path, or null if the directory has no source file.
async function findEntryPoint(targetAbs, dirRel) {
  const files = [];
  const stack = [{ abs: path.join(targetAbs, dirRel), rel: dirRel, depth: 0 }];
  while (stack.length) {
    const { abs, rel, depth } = stack.pop();
    let entries;
    try { entries = await fs.readdir(abs, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const childRel = rel + "/" + e.name;
      if (e.isDirectory()) {
        if (!DRIFT_IGNORED_DIRS.has(e.name.toLowerCase()) && !e.name.startsWith(".")) {
          stack.push({ abs: path.join(abs, e.name), rel: childRel, depth: depth + 1 });
        }
      } else if (e.isFile()) {
        const dot = e.name.lastIndexOf(".");
        const ext = dot > 0 ? e.name.slice(dot + 1).toLowerCase() : "";
        if (SOURCE_EXTS.has(ext)) {
          let size = 0;
          try { size = (await fs.stat(path.join(abs, e.name))).size; } catch { /* ignore */ }
          files.push({ rel: childRel, name: e.name.toLowerCase(), depth, size });
        }
      }
    }
  }
  if (!files.length) return null;
  const namedEntry = files.filter(f => /^(index|main)\./.test(f.name))
    .sort((a, b) => a.depth - b.depth || a.rel.localeCompare(b.rel));
  if (namedEntry.length) return namedEntry[0].rel;
  files.sort((a, b) => b.size - a.size || a.rel.localeCompare(b.rel));
  return files[0].rel;
}

function runGit(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return { ok: !r.error && r.status === 0, out: r.stdout || "" };
}

// Pure compute: the structural (and, opted in, git-based stale) scan behind
// `drift`, with no console output and no writes. Returns null if there is no
// MODULE_MAP.md to scan. Shared with `status`, which always calls this with
// `git: false` — the stale check is never run implicitly.
export async function computeDrift(targetAbs, { git: gitRequested = false } = {}) {
  const mapPath = path.join(targetAbs, ...MODULE_MAP_REL);
  const mapText = await readText(mapPath);
  if (mapText === null) return null;
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
      // "Vanished" means gone from disk — not "isn't a directory". A path that
      // still exists, even a file the author put in the Directory column of a
      // small/flat repo, has not vanished, and must not contradict `verify`
      // (which counts the same path as confirmed). Only a claim that resolves to
      // NEITHER a directory nor a file has truly gone.
      const abs = path.join(targetAbs, clean);
      if (!(await isDir(abs)) && !(await isFile(abs))) {
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
  const git = { requested: Boolean(gitRequested), available: false, headSha: null, verifiedSha, note: null };
  if (!gitRequested) {
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

  return { rows, verifiedSha, unmapped, vanished, stale, git };
}

export async function drift(targetAbs, flags) {
  const result = await computeDrift(targetAbs, { git: Boolean(flags.git) });
  if (!result) {
    die(`No ${MODULE_MAP_REL.join("/")} found. Run install (or shazam) first, then /cold-start.`);
  }
  const { rows, unmapped, vanished, stale, git } = result;
  const total = unmapped.length + vanished.length + stale.length;

  // 4. SUGGESTIONS — opt-in (--suggest): ready-to-paste fixes for unmapped/vanished.
  //    Stability is always `?` and rows are always `[inferred]` — never guessed.
  const suggestions = [];
  if (flags.suggest) {
    for (const u of unmapped) {
      const dirRel = u.path.replace(/\/+$/, "");
      const entry = await findEntryPoint(targetAbs, dirRel);
      const entryCell = entry ? `\`${entry}\`` : "?";
      const row = `| \`${u.path}\` | _describe this directory_ | ${entryCell} | ? | [inferred] |`;
      suggestions.push({ type: "unmapped-row", directory: u.path, entry: entry || null, row });
    }
    for (const v of vanished) {
      suggestions.push({ type: "vanished-fix", claim: v.claim, line: v.line,
        note: `delete or fix MODULE_MAP.md line ${v.line}` });
    }
  }

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
    ...(flags.suggest ? { suggestions } : {}),
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
  if (git.note) lines.push(`> ${git.note[0].toUpperCase()}${git.note.slice(1)}`, "");

  if (flags.suggest) {
    const unmappedSuggestions = suggestions.filter(s => s.type === "unmapped-row");
    const vanishedSuggestions = suggestions.filter(s => s.type === "vanished-fix");
    lines.push("## Suggested rows (--suggest)", "",
      "Paste-ready `MODULE_MAP.md` rows for each unmapped directory below. Fill in",
      "the Responsibility, set a real Stability once you've read the code, and",
      "audit before ever flipping `[inferred]` to `[verified]`.", "");
    if (unmappedSuggestions.length) {
      lines.push("| Directory | Responsibility | Entry point | Stability | Status |",
        "|---|---|---|---|---|");
      for (const s of unmappedSuggestions) lines.push(s.row);
      lines.push("");
    } else {
      lines.push("No unmapped directories — nothing to suggest.", "");
    }
    if (vanishedSuggestions.length) {
      lines.push("## Suggested fixes for vanished rows (--suggest)", "",
        "| Claim | MODULE_MAP.md line to delete or fix |", "|---|---|");
      for (const s of vanishedSuggestions) lines.push(`| \`${s.claim}\` | ${s.line} |`);
      lines.push("");
    }
  }

  info(`\nScanned ${rows.length} mapped module(s):`);
  info(`  unmapped ${unmapped.length}   vanished ${vanished.length}   stale ${stale.length}`);
  for (const u of unmapped.slice(0, 20)) info(`  + unmapped  ${u.path}`);
  for (const v of vanished.slice(0, 20)) info(`  ✗ vanished  ${v.claim}  (MODULE_MAP:${v.line})`);
  for (const s of stale.slice(0, 20)) info(`  ~ stale     ${s.row}  (MODULE_MAP:${s.line})`);
  if (git.note) info(`  note: ${git.note}`);
  if (flags.suggest) info(`  suggestions: ${suggestions.length} (see --suggest report section)`);

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

    const summary = [`## ${total ? "❌" : "✅"} ai-fication-kit \`drift\``, ""];
    if (total) {
      for (const u of unmapped) {
        summary.push(`- \`${u.path}\` has code but MODULE_MAP.md doesn't mention it — ` +
          `add a row (run \`drift --suggest\` for a paste-ready one), or ask your agent to run /check-drift.`);
      }
      for (const v of vanished) {
        summary.push(`- MODULE_MAP.md mentions \`${v.claim}\` but it no longer exists — ` +
          `edit MODULE_MAP.md line ${v.line}, or ask your agent to run /check-drift.`);
      }
      for (const s of stale) {
        summary.push(`- \`${s.row}\` is marked [verified] but its code changed since the verified commit — ` +
          `re-audit it (MODULE_MAP.md line ${s.line}), or ask your agent to run /check-drift.`);
      }
    } else {
      summary.push(`No drift across ${rows.length} mapped module(s).`);
    }
    await writeGithubSummary(flags, summary);
    await refreshProgressPage(targetAbs);
  }
  if (flags.strict && total) {
    die(`--strict: ${total} drift finding(s).`);
  }
}
