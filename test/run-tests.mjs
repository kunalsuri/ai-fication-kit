#!/usr/bin/env node
// Smoke tests for ai-fication-kit. Zero dependencies. Run: node test/run-tests.mjs
//
// For EACH installer (Node, Python — if present on PATH) this:
//   1. builds a throwaway fixture repo (TS app, fork remote, Java fixture too)
//   2. orient        → asserts repo-profile.json has the right facts
//   3. shazam --yes  → asserts files exist, placeholders resolved, fork rule stamped
//   4. install (re-run) → asserts existing files are skipped without --force
//   5. uninstall --yes  → asserts every manifest file is gone and user files remain
//   6. --dry-run     → asserts nothing is written

// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";

const here = path.dirname(fileURLToPath(import.meta.url));
const kitRoot = path.dirname(here);

// Clean up any stale temp directories from previous interrupted runs
try {
  for (const name of await fs.readdir(here)) {
    if (name.startsWith("tmp-")) {
      await fs.rm(path.join(here, name), { recursive: true, force: true });
    }
  }
} catch { /* ignore */ }

let failures = 0;
let checks = 0;
function ok(cond, label) {
  checks++;
  if (cond) console.log(`  ✓ ${label}`);
  else { failures++; console.error(`  ✗ ${label}`); }
}

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), error: r.error };
}

function pythonCmd() {
  for (const c of ["python3", "python"]) {
    const r = spawnSync(c, ["--version"], { encoding: "utf8" });
    if (r.status === 0) return c;
  }
  return null;
}

async function makeFixture(name, { fork }) {
  const dir = path.join(here, `tmp-${name}-${process.pid}`);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, "package.json"),
    JSON.stringify({ name, version: "1.0.0", scripts: { build: "tsc", test: "vitest" } }, null, 2));
  await fs.writeFile(path.join(dir, "tsconfig.json"), "{}\n");
  await fs.mkdir(path.join(dir, "tests"), { recursive: true });
  await fs.writeFile(path.join(dir, "README.md"),
    `# ${name}\n\nA tiny invoicing SaaS used as a kit test fixture.\n`);
  await fs.writeFile(path.join(dir, "app.ts"), "export const x = 1;\n");
  if (fork) {
    await fs.mkdir(path.join(dir, ".git"), { recursive: true });
    await fs.writeFile(path.join(dir, ".git", "config"),
      `[remote "origin"]\n\turl = https://github.com/me/${name}.git\n` +
      `[remote "upstream"]\n\turl = https://github.com/upstream-org/${name}.git\n`);
  }
  return dir;
}

async function testInstaller(label, exec, script) {
  console.log(`\n— ${label} —`);

  // ---------- fixture: TS app that is a fork ----------
  const repo = await makeFixture(`${label}-saas`, { fork: true });

  // orient
  let r = run(exec, [script, "orient", repo]);
  ok(r.code === 0, `orient exits 0`);
  const profilePath = path.join(repo, "ai", "repo-profile.json");
  ok(await exists(profilePath), `orient writes ai/repo-profile.json`);
  const profile = JSON.parse(await fs.readFile(profilePath, "utf8"));
  ok(profile.languages.includes("TypeScript/JavaScript"),
    `detects TypeScript (tsconfig refinement): ${profile.languages}`);
  ok(profile.fork.isFork === true && profile.fork.upstream === `upstream-org/${label}-saas`,
    `detects fork upstream from .git/config: ${profile.fork.upstream}`);
  ok(profile.testDirs.includes("tests/"), `detects tests/ dir`);
  ok(profile.description.includes("invoicing SaaS"), `description from README prose line`);

  // dry-run writes nothing new
  r = run(exec, [script, "install", repo, "--dry-run"]);
  ok(r.code === 0, `install --dry-run exits 0`);
  ok(!(await exists(path.join(repo, "CLAUDE.md"))), `--dry-run writes nothing`);

  // shazam
  r = run(exec, [script, "shazam", repo, "--yes"]);
  ok(r.code === 0, `shazam --yes exits 0`);
  for (const f of ["CLAUDE.md", "AGENTS.md",
    path.join("ai", "INDEX.md"),
    path.join("ai", "guide", "MODULE_MAP.md"),
    path.join("ai", "guide", "CONVENTIONS.md"),
    path.join("ai", "lab", "decisions", "ADR_TEMPLATE.md"),
    path.join("ai", "analysis", "diagrams", "README.md"),
    path.join("ai", "analysis", "FEATURE_CATALOG.md"),
    path.join("ai", "analysis", "FEATURE_CATALOG_BACKEND.md"),
    path.join("ai", "analysis", "FEATURE_CATALOG_FRONTEND.md"),
    path.join(".claude", "commands", "cold-start.md"),
    path.join(".claude", "agents", "repo-explorer.md"),
    path.join(".claude", "skills", "add-feature", "SKILL.md"),
    path.join("ai", "install-manifest.json")]) {
    ok(await exists(path.join(repo, f)), `installed ${f}`);
  }
  const claudeMd = await fs.readFile(path.join(repo, "CLAUDE.md"), "utf8");
  ok(claudeMd.includes(`${label}-saas`), `CLAUDE.md stamped with project name`);
  ok(claudeMd.includes("upstream-org"), `CLAUDE.md stamped with fork rule/upstream`);
  ok(!/\{\{(PROJECT_NAME|DESCRIPTION|LANGUAGES|BUILD_CMD|TEST_CMD|FORK_RULE|FORK_LINE|DATE|KIT_VERSION|TEST_DIRS|UPSTREAM)\}\}/.test(claudeMd),
    `no unresolved known placeholders in CLAUDE.md`);
  const indexMd = await fs.readFile(path.join(repo, "ai", "INDEX.md"), "utf8");
  ok(!indexMd.includes("{{"), `no unresolved placeholders in ai/INDEX.md`);
  ok(!(await exists(path.join(repo, "ai", "README.md"))) &&
     !(await exists(path.join(repo, "README.md.tmpl"))),
    `templates/README.md not installed; no .tmpl suffixes leaked`);

  // re-run without --force skips
  r = run(exec, [script, "install", repo, "--yes"]);
  ok(r.code === 0 && /skip \(exists/.test(r.out), `re-install skips existing files without --force`);

  // uninstall removes manifest files, keeps user files
  r = run(exec, [script, "uninstall", repo, "--yes"]);
  ok(r.code === 0, `uninstall exits 0`);
  ok(!(await exists(path.join(repo, "CLAUDE.md"))), `uninstall removed CLAUDE.md`);
  ok(!(await exists(path.join(repo, "ai"))), `uninstall removed empty ai/ tree`);
  ok(await exists(path.join(repo, "package.json")) && await exists(path.join(repo, "app.ts")),
    `uninstall kept user files`);

  await fs.rm(repo, { recursive: true, force: true });

  // ---------- fixture: Java non-fork ----------
  const jrepo = await makeFixture(`${label}-java`, { fork: false });
  await fs.writeFile(path.join(jrepo, "pom.xml"), "<project/>\n");
  await fs.rm(path.join(jrepo, "package.json"));
  await fs.rm(path.join(jrepo, "tsconfig.json"));
  r = run(exec, [script, "orient", jrepo, "--dry-run"]);
  ok(r.code === 0 && /Java/.test(r.out) && /Maven|mvn/.test(r.out),
    `Java/Maven fixture detected in orient output`);
  ok(!(await exists(path.join(jrepo, "ai"))), `orient --dry-run writes nothing`);
  r = run(exec, [script, "shazam", jrepo, "--yes", "--name", "MyJavaApp"]);
  const jAgents = await fs.readFile(path.join(jrepo, "AGENTS.md"), "utf8");
  ok(jAgents.includes("MyJavaApp"), `--name override stamped`);
  ok(jAgents.includes("Respect existing boundaries"), `non-fork rule stamped (no fork text)`);
  ok(!jAgents.includes("FORK of"), `no fork line for non-fork`);
  await fs.rm(jrepo, { recursive: true, force: true });

  // ---------- lockfiles & de-duplication ----------
  const lockrepo = await makeFixture(`${label}-lock`, { fork: false });
  // Add pnpm-lock.yaml to test pnpm detection
  await fs.writeFile(path.join(lockrepo, "pnpm-lock.yaml"), "");
  r = run(exec, [script, "orient", lockrepo, "--dry-run"]);
  ok(r.code === 0 && /pnpm/.test(r.out) && /pnpm install && pnpm build/.test(r.out),
    `pnpm-lock.yaml detected correctly: ${r.out}`);

  // Test poetry + pyproject.toml de-duplication
  // Remove package.json & tsconfig to isolate Python detection
  await fs.rm(path.join(lockrepo, "package.json"));
  await fs.rm(path.join(lockrepo, "tsconfig.json"));
  await fs.rm(path.join(lockrepo, "pnpm-lock.yaml"));
  await fs.writeFile(path.join(lockrepo, "pyproject.toml"), "");
  await fs.writeFile(path.join(lockrepo, "poetry.lock"), "");
  r = run(exec, [script, "orient", lockrepo, "--dry-run"]);
  ok(r.code === 0 && /poetry/i.test(r.out) && /poetry install/.test(r.out) && !/poetry install.*poetry install/.test(r.out),
    `Poetry lockfile + pyproject.toml detected and de-duplicated correctly`);

  await fs.rm(lockrepo, { recursive: true, force: true });

  // ---------- verify: mechanical claim checking ----------
  const vrepo = await makeFixture(`${label}-verify`, { fork: false });
  await fs.mkdir(path.join(vrepo, "ai", "guide"), { recursive: true });
  await fs.writeFile(path.join(vrepo, "ai", "guide", "MODULE_MAP.md"),
    "# map\n" +
    "Entry point `app.ts`, tests in `tests/`.\n" +
    "Stale path `src/app.ts` (file exists, dir is wrong).\n" +
    "Gone entirely: `missing/ghost.ts`.\n" +
    "Not claims: `npm install && npm run build`, `/cold-start`, `Node.js`, " +
    "`[inferred]`, `{{BUILD_CMD}}`, `frozen`, `module.exports`.\n");

  // dry-run writes nothing
  r = run(exec, [script, "verify", vrepo, "--dry-run"]);
  ok(r.code === 0, `verify --dry-run exits 0`);
  const vManifestPath = path.join(vrepo, "ai", "analysis", "audit-reports",
    "VERIFICATION_MANIFEST.json");
  ok(!(await exists(vManifestPath)), `verify --dry-run writes nothing`);

  // real run: manifest + report, correct statuses
  r = run(exec, [script, "verify", vrepo]);
  ok(r.code === 0, `verify exits 0`);
  ok(await exists(vManifestPath), `verify writes VERIFICATION_MANIFEST.json`);
  const vManifest = JSON.parse(await fs.readFile(vManifestPath, "utf8"));
  const byClaim = Object.fromEntries(vManifest.claims.map(c => [c.claim, c]));
  ok(byClaim["app.ts"]?.status === "confirmed", `filename claim app.ts confirmed`);
  ok(byClaim["tests/"]?.status === "confirmed", `directory claim tests/ confirmed`);
  ok(byClaim["src/app.ts"]?.status === "moved" && byClaim["src/app.ts"].foundAt === "app.ts",
    `stale path detected as moved with foundAt`);
  ok(byClaim["missing/ghost.ts"]?.status === "missing", `dead path detected as missing`);
  ok(!vManifest.claims.some(c => /npm|cold-start|Node\.js|inferred|BUILD_CMD|^frozen$|module\.exports/.test(c.claim)),
    `commands, slash commands, product names, code idioms, and tags are not claims`);
  ok(vManifest.summary.confirmed === 2 && vManifest.summary.moved === 1 &&
     vManifest.summary.missing === 1,
    `summary counts correct: ${JSON.stringify(vManifest.summary)}`);
  const vReport = await fs.readFile(path.join(vrepo, "ai", "analysis", "audit-reports",
    "VERIFICATION_REPORT.md"), "utf8");
  ok(vReport.includes("missing/ghost.ts"), `report lists the missing claim`);

  // --strict fails when claims are missing
  r = run(exec, [script, "verify", vrepo, "--strict"]);
  ok(r.code !== 0, `verify --strict exits non-zero on unconfirmed claims`);

  await fs.rm(vrepo, { recursive: true, force: true });

  // ---------- error handling ----------
  r = run(exec, [script, "install", path.join(here, "definitely-not-here-xyz")]);
  ok(r.code !== 0, `missing target → non-zero exit`);
}

console.log("ai-fication-kit smoke tests");

await testInstaller("node", process.execPath, path.join(kitRoot, "install.mjs"));

const py = pythonCmd();
if (py) {
  await testInstaller("python", py, path.join(kitRoot, "install.py"));
} else {
  console.log("\n— python — SKIPPED (no python on PATH)");
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
