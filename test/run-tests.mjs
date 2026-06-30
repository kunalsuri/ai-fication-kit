#!/usr/bin/env node
// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
//
// Smoke tests for ai-fication-kit. Zero dependencies. Run: node test/run-tests.mjs
//
// For EACH installer (Node, Python — if present on PATH) this:
//   1. builds a throwaway fixture repo (TS app, fork remote, Java fixture too)
//   2. orient        → asserts repo-profile.json has the right facts
//   3. shazam --yes  → asserts files exist, placeholders resolved, fork rule stamped
//   4. install (re-run) → asserts existing files are skipped without --force
//   5. uninstall --yes  → asserts every manifest file is gone and user files remain
//   6. --dry-run     → asserts nothing is written

import { promises as fs } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
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
    JSON.stringify({ name, version: "1.0.0", scripts: { build: "tsc", test: "vitest" }, dependencies: { "express": "^4.18.2" } }, null, 2));
  await fs.writeFile(path.join(dir, "tsconfig.json"), "{}\n");
  await fs.mkdir(path.join(dir, "tests"), { recursive: true });
  await fs.writeFile(path.join(dir, "tests", "app.test.ts"), "import { x } from '../app';\n");
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

  // indepth
  r = run(exec, [script, "indepth", repo]);
  ok(r.code === 0, `indepth exits 0`);
  const indepthPath = path.join(repo, "ai", "repo-indepth.json");
  ok(await exists(indepthPath), `indepth writes ai/repo-indepth.json`);
  const indepthResult = JSON.parse(await fs.readFile(indepthPath, "utf8"));
  ok(indepthResult.analysisLevel === "indepth", `indepth analysisLevel is indepth`);
  ok(indepthResult.dependencies.direct > 0, `indepth detects direct dependencies: ${indepthResult.dependencies.direct}`);
  ok(indepthResult.codeStructure.codeMetrics.fileCount > 0, `indepth counts files: ${indepthResult.codeStructure.codeMetrics.fileCount}`);
  ok(indepthResult.documentation.completionScore > 0, `indepth computes doc completion score: ${indepthResult.documentation.completionScore}`);
  ok(indepthResult.testing.testFileCount > 0, `indepth detects test files: ${indepthResult.testing.testFileCount}`);

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

  // the first-run wizard must NOT touch the automation path: under --yes (and the
  // non-TTY this test runs in) shazam writes no humanContext and never blocks on a prompt.
  const profileAfterShazam = JSON.parse(await fs.readFile(profilePath, "utf8"));
  ok(!("humanContext" in profileAfterShazam),
    `--yes / non-interactive shazam records no humanContext (automation unchanged)`);

  // a freshly installed repo (before any /cold-start) must be mechanically honest:
  // the FEATURE_CATALOG placeholder examples must NOT register as missing claims,
  // or verify --strict would fail for every user in every language.
  r = run(exec, [script, "verify", repo, "--strict"]);
  ok(r.code === 0,
    `fresh install passes verify --strict (no catalog/upstream placeholder false-positives): ${r.out.split("\n").filter(l => /missing|moved/.test(l)).join(" | ")}`);
  // verify writes report artifacts that install did not — remove them so the
  // later "uninstall leaves an empty ai/ tree" assertion still holds.
  for (const f of ["VERIFICATION_MANIFEST.json", "VERIFICATION_REPORT.md"]) {
    await fs.rm(path.join(repo, "ai", "analysis", "audit-reports", f), { force: true });
  }

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

  // ---------- fixture: C# / .NET (glob-detected, no fixed marker filename) ----------
  const csrepo = await makeFixture(`${label}-cs`, { fork: false });
  await fs.rm(path.join(csrepo, "package.json"));
  await fs.rm(path.join(csrepo, "tsconfig.json"));
  await fs.writeFile(path.join(csrepo, "App.csproj"), "<Project/>\n");
  r = run(exec, [script, "orient", csrepo, "--dry-run"]);
  ok(r.code === 0 && /C#|\.NET/.test(r.out) && /dotnet/.test(r.out),
    `C#/.NET fixture detected via *.csproj: ${(r.out.match(/Languages.*/) || [""])[0]}`);
  await fs.rm(csrepo, { recursive: true, force: true });

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

  // ---------- drift: structural detection (unmapped / vanished) ----------
  const drepo = await makeFixture(`${label}-drift`, { fork: false });
  await fs.mkdir(path.join(drepo, "src"), { recursive: true });
  await fs.writeFile(path.join(drepo, "src", "core.ts"), "export const a = 1;\n");
  await fs.mkdir(path.join(drepo, "widgets"), { recursive: true });
  await fs.writeFile(path.join(drepo, "widgets", "widget.ts"), "export const w = 1;\n");
  await fs.mkdir(path.join(drepo, "ai", "guide"), { recursive: true });
  await fs.writeFile(path.join(drepo, "ai", "guide", "MODULE_MAP.md"),
    "# Module map\n" +
    "> Last verified: 2026-06-01 @ commit <fill in sha>\n" +
    "| Directory | Responsibility | Entry point | Stability | Status |\n" +
    "|---|---|---|---|---|\n" +
    "| `src/` | core logic | `src/core.ts` | ours | [inferred] |\n" +
    "| `tests/` | unit tests | `tests/app.test.ts` | stable | [inferred] |\n" +
    "| `gone/` | removed module | `gone/old.ts` | stable | [inferred] |\n");

  // dry-run writes nothing
  r = run(exec, [script, "drift", drepo, "--dry-run"]);
  ok(r.code === 0, `drift --dry-run exits 0`);
  const dManifestPath = path.join(drepo, "ai", "analysis", "audit-reports", "DRIFT_MANIFEST.json");
  ok(!(await exists(dManifestPath)), `drift --dry-run writes nothing`);

  // real run: manifest + report, correct findings
  r = run(exec, [script, "drift", drepo]);
  ok(r.code === 0, `drift exits 0`);
  ok(await exists(dManifestPath), `drift writes DRIFT_MANIFEST.json`);
  const dManifest = JSON.parse(await fs.readFile(dManifestPath, "utf8"));
  ok(dManifest.summary.unmapped === 1 && dManifest.summary.vanished === 2 &&
    dManifest.summary.stale === 0,
    `drift summary correct: ${JSON.stringify(dManifest.summary)}`);
  ok(dManifest.unmapped.some(u => u.path === "widgets/"),
    `widgets/ (source dir, no row) reported unmapped`);
  ok(dManifest.vanished.some(v => v.claim === "gone/") &&
    dManifest.vanished.some(v => v.claim === "gone/old.ts"),
    `gone/ dir and gone/old.ts entry reported vanished`);
  ok(/opt-in/.test(dManifest.git.note),
    `stale check is opt-in without --git: ${dManifest.git.note}`);

  // --strict fails when drift exists
  r = run(exec, [script, "drift", drepo, "--strict", "--dry-run"]);
  ok(r.code !== 0, `drift --strict exits non-zero on drift`);

  await fs.rm(drepo, { recursive: true, force: true });

  // ---------- error handling ----------
  r = run(exec, [script, "install", path.join(here, "definitely-not-here-xyz")]);
  ok(r.code !== 0, `missing target → non-zero exit`);
}

console.log("ai-fication-kit smoke tests");

await testInstaller("node", process.execPath, path.join(kitRoot, "install.mjs"));

// the intake wizard must self-skip (return null) for automation, never hang on input.
{
  const { runFirstRunWizard } = await import(pathToFileURL(path.join(kitRoot, "lib", "intake.mjs")).href);
  const r = await runFirstRunWizard(here, { languages: [] }, { yes: true });
  ok(r === null, `intake wizard self-skips under --yes (no humanContext, no prompt)`);
}

// ---------- check-repo-maturity: standalone command ----------
console.log("\n— check-repo-maturity —");
{
  // Process 1 (legacy): no existing CLAUDE.md/AGENTS.md
  const mrepo = await makeFixture("maturity-legacy", { fork: false });
  let r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "check-repo-maturity", mrepo, "--dry-run"]);
  ok(r.code === 0, `check-repo-maturity --dry-run exits 0`);
  ok(/Process 1/.test(r.out), `legacy repo detected as Process 1`);
  ok(!(await exists(path.join(mrepo, "ai", "analysis", "audit-reports", "MATURITY_REPORT.json"))),
    `--dry-run writes no report`);

  // Real run saves report
  r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "check-repo-maturity", mrepo]);
  ok(r.code === 0, `check-repo-maturity exits 0`);
  ok(await exists(path.join(mrepo, "ai", "analysis", "audit-reports", "MATURITY_REPORT.json")),
    `check-repo-maturity writes MATURITY_REPORT.json`);
  const mReport = JSON.parse(await fs.readFile(
    path.join(mrepo, "ai", "analysis", "audit-reports", "MATURITY_REPORT.json"), "utf8"));
  ok(mReport.process === 1, `legacy fixture is Process 1`);
  ok(typeof mReport.score === "number" && mReport.score >= 0, `report has a numeric score`);
  ok(mReport.existingAIConfig.claudeMd.exists === false, `no CLAUDE.md detected`);
  await fs.rm(mrepo, { recursive: true, force: true });

  // Process 2 (modern): user-authored CLAUDE.md present
  const mrepo2 = await makeFixture("maturity-modern", { fork: false });
  await fs.writeFile(path.join(mrepo2, "CLAUDE.md"),
    "# My Project\nCustom rules here.\nNever use ORM X.\n");
  await fs.writeFile(path.join(mrepo2, "AGENTS.md"),
    "# Agents\nTool-agnostic rules.\n");
  r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "check-repo-maturity", mrepo2]);
  ok(r.code === 0, `check-repo-maturity exits 0 for modern repo`);
  const mReport2 = JSON.parse(await fs.readFile(
    path.join(mrepo2, "ai", "analysis", "audit-reports", "MATURITY_REPORT.json"), "utf8"));
  ok(mReport2.process === 2, `modern repo (user-authored CLAUDE.md) is Process 2`);
  ok(mReport2.existingAIConfig.claudeMd.exists === true &&
    mReport2.existingAIConfig.claudeMd.hasKitFooter === false,
    `CLAUDE.md detected as user-authored (no kit footer)`);
  await fs.rm(mrepo2, { recursive: true, force: true });

  // Kit-generated CLAUDE.md → still Process 1
  const mrepo3 = await makeFixture("maturity-kit", { fork: false });
  await fs.writeFile(path.join(mrepo3, "CLAUDE.md"),
    "# Test\n<!-- Installed by ai-fication-kit 0.1.0 on 2026-06-01. -->\n");
  r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "check-repo-maturity", mrepo3]);
  const mReport3 = JSON.parse(await fs.readFile(
    path.join(mrepo3, "ai", "analysis", "audit-reports", "MATURITY_REPORT.json"), "utf8"));
  ok(mReport3.process === 1, `kit-generated CLAUDE.md → still Process 1 (not user-authored)`);
  ok(mReport3.existingAIConfig.claudeMd.hasKitFooter === true, `kit footer correctly detected`);
  await fs.rm(mrepo3, { recursive: true, force: true });
}

// ---------- Process 2: shazam with backup flow ----------
console.log("\n— process 2 backup flow —");
{
  const brepo = await makeFixture("backup-test", { fork: false });
  const originalClaude = "# My Custom Claude Config\n\nNever use ORM X.\nAlways use pattern Y.\n";
  const originalAgents = "# My Custom Agents Config\n\nTool-agnostic rules for all agents.\n";
  await fs.writeFile(path.join(brepo, "CLAUDE.md"), originalClaude);
  await fs.writeFile(path.join(brepo, "AGENTS.md"), originalAgents);

  let r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "shazam", brepo, "--yes"]);
  ok(r.code === 0, `shazam --yes exits 0 for modern repo`);

  // Check profile has maturity.process === 2
  const profile = JSON.parse(await fs.readFile(path.join(brepo, "ai", "repo-profile.json"), "utf8"));
  ok(profile.maturity?.process === 2, `profile records process 2`);

  // Check backup files exist with timestamped names
  const rootFiles = await fs.readdir(brepo);
  const claudeBkps = rootFiles.filter(f => /^CLAUDE_bkp_\d{8}_\d{6}\.md$/.test(f));
  const agentsBkps = rootFiles.filter(f => /^AGENTS_bkp_\d{8}_\d{6}\.md$/.test(f));
  ok(claudeBkps.length === 1, `CLAUDE.md backed up with timestamp: ${claudeBkps[0] || "MISSING"}`);
  ok(agentsBkps.length === 1, `AGENTS.md backed up with timestamp: ${agentsBkps[0] || "MISSING"}`);

  // Check backup content matches original
  if (claudeBkps.length) {
    const bkpContent = await fs.readFile(path.join(brepo, claudeBkps[0]), "utf8");
    ok(bkpContent === originalClaude, `CLAUDE backup content matches original`);
  }
  if (agentsBkps.length) {
    const bkpContent = await fs.readFile(path.join(brepo, agentsBkps[0]), "utf8");
    ok(bkpContent === originalAgents, `AGENTS backup content matches original`);
  }

  // New CLAUDE.md is kit-generated (has kit footer)
  const newClaude = await fs.readFile(path.join(brepo, "CLAUDE.md"), "utf8");
  ok(newClaude.includes("<!-- Installed by ai-fication-kit"),
    `new CLAUDE.md is kit-generated (has footer)`);
  ok(newClaude.includes("backup-test"), `new CLAUDE.md stamped with project name`);

  // verify --strict should pass on fresh Process 2 install
  r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "verify", brepo, "--strict"]);
  ok(r.code === 0, `verify --strict passes on fresh Process 2 install`);

  // Uninstall should report backup files
  r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "uninstall", brepo, "--yes"]);
  ok(r.code === 0, `uninstall exits 0`);
  ok(/backup files were NOT removed/.test(r.out), `uninstall reports backup file locations`);

  // Backups still exist after uninstall
  const afterUninstall = await fs.readdir(brepo);
  const bkpsAfter = afterUninstall.filter(f => /_bkp_/.test(f));
  ok(bkpsAfter.length >= 2, `backup files preserved after uninstall`);

  await fs.rm(brepo, { recursive: true, force: true });
}

// ---------- Process 2: only CLAUDE.md, no AGENTS.md ----------
console.log("\n— process 2 partial backup —");
{
  const prepo = await makeFixture("partial-backup", { fork: false });
  await fs.writeFile(path.join(prepo, "CLAUDE.md"), "# Just CLAUDE\nSome rules.\n");
  // No AGENTS.md

  let r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "shazam", prepo, "--yes"]);
  ok(r.code === 0, `shazam exits 0 for partial modern repo`);

  const rootFiles = await fs.readdir(prepo);
  const claudeBkps = rootFiles.filter(f => /^CLAUDE_bkp_\d{8}_\d{6}\.md$/.test(f));
  const agentsBkps = rootFiles.filter(f => /^AGENTS_bkp_\d{8}_\d{6}\.md$/.test(f));
  ok(claudeBkps.length === 1, `only CLAUDE.md backed up`);
  ok(agentsBkps.length === 0, `no AGENTS.md backup (original didn't exist)`);

  await fs.rm(prepo, { recursive: true, force: true });
}

// ---------- Process 1: kit-generated files not backed up ----------
console.log("\n— process 1 kit-generated files —");
{
  const krepo = await makeFixture("kit-generated", { fork: false });
  await fs.writeFile(path.join(krepo, "CLAUDE.md"),
    "# Test\n<!-- Installed by ai-fication-kit 0.1.0 on 2026-06-01. -->\n");

  let r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "shazam", krepo, "--yes"]);
  ok(r.code === 0, `shazam exits 0 for kit-generated repo`);

  const rootFiles = await fs.readdir(krepo);
  const bkps = rootFiles.filter(f => /_bkp_/.test(f));
  ok(bkps.length === 0, `no backup created for kit-generated files`);

  await fs.rm(krepo, { recursive: true, force: true });
}

// ---------- Verify own repo's claims ----------
console.log("\n— verify own repo —");
const verifyRes = run(process.execPath, [path.join(kitRoot, "install.mjs"), "verify", kitRoot, "--strict"]);
ok(verifyRes.code === 0, `verify own repo passes --strict`);

// ---------- Drift own repo: the map must still match the tree ----------
console.log("\n— drift own repo —");
const driftRes = run(process.execPath, [path.join(kitRoot, "install.mjs"), "drift", kitRoot, "--strict"]);
ok(driftRes.code === 0, `drift own repo passes --strict (no unmapped/vanished)`);

// ---------- Doc links: every local link in the human-facing docs must resolve ----------
// `verify` only scans the knowledge layer (CLAUDE.md / AGENTS.md / ai/**); it never sees
// README.md, docs/**, or examples/**. This guard keeps those mechanically honest too, so a
// dead relative link (or a renamed file) fails CI instead of shipping. No deps, no model.
console.log("\n— doc links —");
{
  const docFiles = ["README.md", "AGENTS.md", "CLAUDE.md", "CONTRIBUTING.md",
    "SECURITY.md", "CHANGELOG.md", "examples/README.md",
    "examples/legacy-calculator/README.md", "examples/value-demo/README.md"];
  for (const d of ["docs", path.join("docs", "system-diagrams")]) {
    try {
      for (const n of await fs.readdir(path.join(kitRoot, d))) {
        if (n.endsWith(".md")) docFiles.push(path.posix.join(d.split(path.sep).join("/"), n));
      }
    } catch { /* dir absent — skip */ }
  }
  const broken = [];
  for (const rel of docFiles) {
    let text;
    try { text = await fs.readFile(path.join(kitRoot, rel), "utf8"); }
    catch { continue; }
    const targets = [];
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) targets.push(m[1]);
    for (const m of text.matchAll(/(?:src|href)\s*=\s*"([^"]+)"/g)) targets.push(m[1]);
    for (let t of targets) {
      // External, in-page anchors, and template placeholders are not local files.
      if (!t || /^(https?:|mailto:|tel:|data:|#)/.test(t) || t.includes("{{")) continue;
      t = t.split("#")[0];
      if (!t) continue;
      const abs = path.resolve(path.dirname(path.join(kitRoot, rel)), t);
      if (!(await exists(abs))) broken.push(`${rel} -> ${t}`);
    }
  }
  for (const b of broken) console.error(`  ✗ broken link: ${b}`);
  ok(broken.length === 0,
    `all local links in README/docs/examples resolve${broken.length ? ` (${broken.length} broken)` : ""}`);
}

// ---------- Drift stale check (git-gated; skipped if commits can't be made) ----------
console.log("\n— drift stale (git) —");
{
  const gitOk = run("git", ["--version"]).code === 0;
  if (!gitOk) {
    console.log("  — SKIPPED (no git on PATH)");
  } else {
    const grepo = path.join(here, `tmp-drift-git-${process.pid}`);
    await fs.rm(grepo, { recursive: true, force: true });
    await fs.mkdir(path.join(grepo, "src"), { recursive: true });
    await fs.mkdir(path.join(grepo, "billing"), { recursive: true });
    await fs.writeFile(path.join(grepo, "src", "core.ts"), "export const a = 1;\n");
    await fs.writeFile(path.join(grepo, "billing", "invoice.ts"), "export const b = 1;\n");
    const g = (...a) => run("git", ["-C", grepo, ...a]);
    g("init", "-q"); g("config", "user.email", "t@t.t"); g("config", "user.name", "t");
    g("config", "commit.gpgsign", "false");
    g("add", "-A"); g("commit", "--no-gpg-sign", "-qm", "init");
    const sha = run("git", ["-C", grepo, "rev-parse", "HEAD"]).out.trim();
    if (!/^[0-9a-f]{7,40}$/.test(sha)) {
      console.log("  — SKIPPED (could not create a commit in this environment)");
    } else {
      await fs.mkdir(path.join(grepo, "ai", "guide"), { recursive: true });
      await fs.writeFile(path.join(grepo, "ai", "guide", "MODULE_MAP.md"),
        "# Module map\n" +
        `> Last verified: 2026-06-01 @ commit ${sha}\n` +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/core.ts` | ours | [verified] |\n" +
        "| `billing/` | billing | `billing/invoice.ts` | stable | [verified] |\n");
      g("add", "-A"); g("commit", "--no-gpg-sign", "-qm", "map");
      // change ONLY billing after the verified commit
      await fs.writeFile(path.join(grepo, "billing", "invoice.ts"), "export const b = 2;\n");
      g("add", "-A"); g("commit", "--no-gpg-sign", "-qm", "change");
      const dr = run(process.execPath, [path.join(kitRoot, "install.mjs"), "drift", grepo, "--git", "--dry-run"]);
      ok(/stale 1/.test(dr.out) && /billing\//.test(dr.out),
        `--git flags the [verified] row whose code changed (billing/), not src/`);
    }
    await fs.rm(grepo, { recursive: true, force: true });
  }
}

const py = pythonCmd();
if (py) {
  await testInstaller("python", py, path.join(kitRoot, "install.py"));
} else {
  console.log("\n— python — SKIPPED (no python on PATH)");
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
