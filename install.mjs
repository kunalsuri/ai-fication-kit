#!/usr/bin/env node
// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// ai-fication-kit installer (Node ≥ 18, zero dependencies).
//
// WHAT THIS DOES, IN FULL:
//   orient    — reads marker files (package.json, pom.xml, pyproject.toml, ...) in a
//               target repo and writes ai/repo-profile.json. Pure file inspection.
//   install   — stamps the kit's templates/ into the target repo, substituting
//               detected facts ({{PROJECT_NAME}}, {{BUILD_CMD}}, ...). Records every
//               file it writes in ai/install-manifest.json.
//   shazam    — orient + install + prints your next steps. The magic stops exactly
//               where inference begins: this tool never guesses, never runs your
//               code, and hands the thinking to you and your agent.
//   uninstall — deletes exactly the files listed in ai/install-manifest.json.
//
// WHAT THIS DOES NOT DO (by design, so it cannot harm you):
//   - It does NOT execute any code, run any command, or open any network connection.
//   - It does NOT write anywhere outside the target folder you pass in.
//   - It does NOT overwrite existing files unless you pass --force.
//   - It has NO dependencies, so there is nothing else to trust.
//
// You are encouraged to read this whole file before running it.
//
// USAGE:
//   node install.mjs shazam   <path-to-your-repo> [options]
//   node install.mjs orient   <path-to-your-repo> [--dry-run]
//   node install.mjs install  <path-to-your-repo> [options]
//   node install.mjs uninstall <path-to-your-repo> [--dry-run]
//
// OPTIONS:
//   --dry-run            show the plan, write nothing
//   --force              overwrite existing files
//   --yes                skip the confirmation prompt
//   --name "X"           project name        (default: target folder name)
//   --description "X"    one-line description (default: first line of README, or placeholder)
//   --build "X"          build command        (default: detected)
//   --test "X"           test command         (default: detected)
//   --upstream "org/repo" fork upstream       (default: detected from git remotes)

import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

const KIT_VERSION = "0.1.0";
const PROFILE_REL = path.join("ai", "repo-profile.json");
const MANIFEST_REL = path.join("ai", "install-manifest.json");

// ---------------------------------------------------------------- CLI parsing

const argv = process.argv.slice(2);
const COMMANDS = new Set(["orient", "install", "shazam", "uninstall"]);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry-run") flags.dryRun = true;
  else if (a === "--force") flags.force = true;
  else if (a === "--yes") flags.yes = true;
  else if (["--name", "--description", "--build", "--test", "--upstream"].includes(a)) {
    const v = argv[++i];
    if (v === undefined) die(`${a} requires a value`);
    flags[a.slice(2)] = v;
  } else if (a.startsWith("--")) die(`Unknown option: ${a}`);
  else positional.push(a);
}
const command = COMMANDS.has(positional[0]) ? positional.shift() : null;
const target = positional.shift();

function die(msg) { console.error("✗ " + msg); process.exit(1); }
function info(msg) { console.log(msg); }

if (!command || !target) {
  console.log(`ai-fication-kit ${KIT_VERSION} — make a legacy repo AI-native, with a human in the loop.

Usage:
  node install.mjs shazam    <path-to-your-repo>   one-shot: orient + install + next steps
  node install.mjs orient    <path-to-your-repo>   detect stack, write ai/repo-profile.json
  node install.mjs install   <path-to-your-repo>   stamp templates into the repo
  node install.mjs uninstall <path-to-your-repo>   remove exactly what install wrote

Options: --dry-run --force --yes --name --description --build --test --upstream
`);
  process.exit(command ? 1 : 0);
}

const kitRoot = path.dirname(fileURLToPath(import.meta.url));
const templatesRoot = path.join(kitRoot, "templates");

// ------------------------------------------------------------------ utilities

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function isDir(p) {
  try { const st = await fs.stat(p); return st.isDirectory(); } catch { return false; }
}

async function isFile(p) {
  try { const st = await fs.stat(p); return st.isFile(); } catch { return false; }
}

async function readText(p) {
  try { return await fs.readFile(p, "utf8"); } catch { return null; }
}

async function confirm(question) {
  if (flags.yes) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(res => rl.question(`${question} [y/N] `, res));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

// -------------------------------------------------------------------- orient
// Deterministic observation only. Every check below is a file-existence or
// file-content test; nothing is executed and nothing is inferred by a model.

const DETECTORS = [
  { marker: "pom.xml",           language: "Java",                buildSystem: "Maven",
    build: "mvn -B clean install -DskipTests", test: "mvn -B test" },
  { marker: "build.gradle",      language: "Java/Kotlin",         buildSystem: "Gradle",
    build: "./gradlew build -x test", test: "./gradlew test" },
  { marker: "build.gradle.kts",  language: "Kotlin/Java",         buildSystem: "Gradle",
    build: "./gradlew build -x test", test: "./gradlew test" },
  { marker: "package.json",      language: "JavaScript/TypeScript", buildSystem: "npm",
    build: "npm install && npm run build", test: "npm test" },
  { marker: "pyproject.toml",    language: "Python",              buildSystem: "pyproject",
    build: "pip install -e .", test: "pytest" },
  { marker: "requirements.txt",  language: "Python",              buildSystem: "pip",
    build: "pip install -r requirements.txt", test: "pytest" },
  { marker: "go.mod",            language: "Go",                  buildSystem: "go",
    build: "go build ./...", test: "go test ./..." },
  { marker: "Cargo.toml",        language: "Rust",                buildSystem: "Cargo",
    build: "cargo build", test: "cargo test" },
  { marker: "Gemfile",           language: "Ruby",                buildSystem: "Bundler",
    build: "bundle install", test: "bundle exec rake test" },
  { marker: "composer.json",     language: "PHP",                 buildSystem: "Composer",
    build: "composer install", test: "composer test" },
  { marker: "CMakeLists.txt",    language: "C/C++",               buildSystem: "CMake",
    build: "cmake -B build && cmake --build build", test: "ctest --test-dir build" },
];

const TEST_DIR_CANDIDATES = ["test", "tests", "spec", "__tests__",
  "integration-tests", "e2e", "cypress", "playwright"];

async function detectFork(targetAbs) {
  // Observation only: a remote literally named "upstream" in .git/config,
  // or an explicit --upstream flag. We do not call any API.
  if (flags.upstream) return { isFork: true, upstream: flags.upstream, evidence: "--upstream flag" };
  const gitConfig = await readText(path.join(targetAbs, ".git", "config"));
  if (gitConfig) {
    const m = gitConfig.match(/\[remote "upstream"\][^[]*?url\s*=\s*(\S+)/);
    if (m) {
      const url = m[1];
      const gh = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
      return { isFork: true, upstream: gh ? gh[1] : url, evidence: `git remote "upstream" → ${url}` };
    }
  }
  return { isFork: false, upstream: null, evidence: "no remote named \"upstream\"" };
}

async function detectDescription(targetAbs) {
  if (flags.description) return flags.description;
  for (const name of ["README.md", "README.adoc", "README.rst", "README.txt", "README"]) {
    const text = await readText(path.join(targetAbs, name));
    if (!text) continue;
    // First non-empty line that is not a heading marker, badge, or HTML — a crude
    // but deterministic guess; the human confirms it in the audit.
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/^(#|=|!\[|\[!|<|:|-{3,}|\*{3,})/.test(line)) continue;
      if (line.length < 10) continue;
      return line.length > 160 ? line.slice(0, 157) + "..." : line;
    }
  }
  return "<one line: what this project does — fill in>";
}

async function orient(targetAbs) {
  const found = [];
  for (const d of DETECTORS) {
    if (await isFile(path.join(targetAbs, d.marker))) found.push({ ...d });
  }
  // Refinements (still pure observation):
  const hasTsconfig = await isFile(path.join(targetAbs, "tsconfig.json"));
  const hasTurbo = await isFile(path.join(targetAbs, "turbo.json"));

  // Check for JS/Python package manager locks:
  const hasPnpm = await isFile(path.join(targetAbs, "pnpm-lock.yaml"));
  const hasYarn = await isFile(path.join(targetAbs, "yarn.lock"));
  const hasBun = await isFile(path.join(targetAbs, "bun.lockb"));
  const hasPoetry = await isFile(path.join(targetAbs, "poetry.lock"));
  const hasPipenv = await isFile(path.join(targetAbs, "Pipfile"));

  for (const d of found) {
    if (d.marker === "package.json") {
      if (hasTsconfig) {
        d.language = "TypeScript/JavaScript";
      }
      if (hasPnpm) {
        d.buildSystem = "pnpm";
        d.build = "pnpm install && pnpm build";
        d.test = "pnpm test";
      } else if (hasYarn) {
        d.buildSystem = "Yarn";
        d.build = "yarn install && yarn build";
        d.test = "yarn test";
      } else if (hasBun) {
        d.buildSystem = "Bun";
        d.build = "bun install && bun run build";
        d.test = "bun test";
      }
    }
    if (d.marker === "pyproject.toml" || d.marker === "requirements.txt") {
      if (hasPoetry) {
        d.buildSystem = "Poetry";
        d.build = "poetry install";
        d.test = "poetry run pytest";
      } else if (hasPipenv) {
        d.buildSystem = "Pipenv";
        d.build = "pipenv install";
        d.test = "pipenv run pytest";
      }
    }
  }

  // De-duplicate found detectors by buildSystem to prevent redundant chained commands
  const uniqueFound = [];
  const seenBuildSystems = new Set();
  for (const d of found) {
    if (!seenBuildSystems.has(d.buildSystem)) {
      seenBuildSystems.add(d.buildSystem);
      uniqueFound.push(d);
    }
  }

  const languages = [...new Set(uniqueFound.map(d => d.language))];
  const buildSystems = [...new Set(uniqueFound.map(d => d.buildSystem))];
  if (hasTurbo && !buildSystems.includes("Turborepo")) buildSystems.push("Turborepo");

  const testDirs = [];
  for (const t of TEST_DIR_CANDIDATES) {
    if (await isDir(path.join(targetAbs, t))) testDirs.push(t + "/");
  }

  const fork = await detectFork(targetAbs);
  const notes = [];
  if (uniqueFound.length === 0) {
    notes.push("No known build-system marker found — set --build and --test manually.");
  }
  if (uniqueFound.length > 1) {
    notes.push("Multiple build systems detected — build/test commands chained; review them.");
  }

  const profile = {
    _comment: "Generated by ai-fication-kit `orient` — deterministic observation only. " +
              "A human should confirm every field during the audit.",
    kitVersion: KIT_VERSION,
    generated: new Date().toISOString(),
    projectName: flags.name || path.basename(targetAbs),
    description: await detectDescription(targetAbs),
    languages,
    buildSystems,
    buildCmd: flags.build || (uniqueFound.map(d => d.build).join("  &&  ") || "<fill in>"),
    testCmd: flags.test || (uniqueFound.map(d => d.test).join("  &&  ") || "<fill in>"),
    fork,
    testDirs,
    notes,
  };
  return profile;
}

function printProfile(p) {
  info(`\n  Project      ${p.projectName}`);
  info(`  Description  ${p.description}`);
  info(`  Languages    ${p.languages.join(", ") || "(none detected)"}`);
  info(`  Build        ${p.buildCmd}`);
  info(`  Test         ${p.testCmd}`);
  info(`  Fork         ${p.fork.isFork ? `yes — upstream ${p.fork.upstream}` : "no"} (${p.fork.evidence})`);
  info(`  Test dirs    ${p.testDirs.join(", ") || "(none found)"}`);
  for (const n of p.notes) info(`  Note         ${n}`);
  info("");
}

// ------------------------------------------------------------------- install

function placeholders(profile) {
  const fork = profile.fork.isFork;
  return {
    PROJECT_NAME: profile.projectName,
    DESCRIPTION: profile.description,
    LANGUAGES: profile.languages.join(", ") || "<fill in>",
    BUILD_CMD: profile.buildCmd,
    TEST_CMD: profile.testCmd,
    UPSTREAM: profile.fork.upstream || "",
    FORK_LINE: fork
      ? ` This is a FORK of \`${profile.fork.upstream}\`.`
      : "",
    FORK_RULE: fork
      ? `**Frozen upstream.** Code inherited from \`${profile.fork.upstream}\` is off-limits unless the task explicitly requires it. New work goes in our own modules.`
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

async function install(targetAbs, profile) {
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
    if (already && !flags.force) { skipped.push(destRel); continue; }
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
  if (!(await confirm(`Write ${plan.length + 2} file(s) into ${targetAbs}?`))) {
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
      posix(PROFILE_REL), posix(MANIFEST_REL)])].sort(),
  };
  await fs.writeFile(path.join(targetAbs, MANIFEST_REL),
    JSON.stringify(manifest, null, 2) + "\n", "utf8");

  info(`\n✓ Installed ${plan.length + 2} file(s).`);
  if (skipped.length) info(`  (${skipped.length} existing file(s) left untouched — use --force to overwrite)`);
}

// ----------------------------------------------------------------- uninstall

async function uninstall(targetAbs) {
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
  if (!(await confirm("Proceed?"))) { info("Aborted; nothing deleted."); return; }

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
  info(`\n✓ Uninstalled.`);
}

// ----------------------------------------------------------------- main flow

const targetAbs = path.resolve(target);
if (!(await exists(targetAbs))) die(`Target does not exist: ${targetAbs}`);
if (!(await fs.stat(targetAbs)).isDirectory()) die(`Target is not a directory: ${targetAbs}`);

if (command === "orient") {
  const profile = await orient(targetAbs);
  printProfile(profile);
  if (flags.dryRun) { info("--dry-run: profile not written."); }
  else {
    await fs.mkdir(path.join(targetAbs, "ai"), { recursive: true });
    await fs.writeFile(path.join(targetAbs, PROFILE_REL),
      JSON.stringify(profile, null, 2) + "\n", "utf8");
    info(`✓ Wrote ${PROFILE_REL}`);
  }
} else if (command === "install") {
  const existingProfile = await readText(path.join(targetAbs, PROFILE_REL));
  const profile = existingProfile ? JSON.parse(existingProfile) : await orient(targetAbs);
  await install(targetAbs, profile);
} else if (command === "shazam") {
  info("⚡ shazam — orient, install, and hand you the audit. No magic past this point.");
  const profile = await orient(targetAbs);
  printProfile(profile);
  await install(targetAbs, profile);
  if (!flags.dryRun) {
    info(`
Next steps (the part that needs a brain):
  1. Open the repo in Claude Code and run  /cold-start
     The agent drafts ai/guide/MODULE_MAP.md and friends — everything tagged [inferred].
     (Not using Claude Code? See docs/FAQ.md#cursor-copilot-codex for other tools.)
  2. Audit (~30 min): set each module's Stability (frozen / stable / ours),
     flip [inferred] → [verified] on rows you confirm.
  3. Optional: /post-cold-start-verification, /verify-ai-readiness.
  4. Build: /add-feature.
`);
  }
} else if (command === "uninstall") {
  await uninstall(targetAbs);
}
