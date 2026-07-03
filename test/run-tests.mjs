#!/usr/bin/env node
// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
//
// Smoke tests for ai-fication-kit. Zero dependencies. Run: node test/run-tests.mjs
//
// For the Node installer this:
//   1. builds a throwaway fixture repo (TS app, fork remote, Java fixture too)
//   2. orient        → asserts repo-profile.json has the right facts
//   3. shazam --yes  → asserts files exist, placeholders resolved, fork rule stamped
//   4. re-run (incremental) → asserts edited files are kept (child-lock), missing
//      files are restored, humanContext survives, --force backs up + respects
//      [verified], --force-verified warns per signature + needs explicit consent
//   5. uninstall --yes  → asserts every manifest file is gone and user files remain
//   6. --dry-run     → asserts nothing is written

import { promises as fs } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import os from "node:os";
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

// Minimal fixture: exactly the given files (nested paths allowed), nothing else.
async function makeBareFixture(name, files) {
  const dir = path.join(here, `tmp-${name}-${process.pid}`);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, ...rel.split("/"));
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content);
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

  // ---------- indepth: per-ecosystem dependency parsing ----------
  // The main fixture only exercises the package.json parser; each case below
  // isolates one manifest format and asserts the exact direct-dependency count.
  const depCases = [
    { name: "pip", direct: 2, files: {
      "requirements.txt": "flask==2.0.1\nrequests>=2.28\n# a comment\n-r other.txt\n" } },
    { name: "poetry", direct: 1, files: {
      "pyproject.toml": "[tool.poetry.dependencies]\npython = \"^3.11\"\nflask = \"^2.0\"\n\n[build-system]\n" } },
    { name: "go", direct: 1, files: {
      "go.mod": "module example.com/m\n\ngo 1.21\n\nrequire (\n\tgithub.com/a/b v1.0.0\n\tgithub.com/c/d v2.1.0 // indirect\n)\n" } },
    { name: "cargo", direct: 2, files: {
      "Cargo.toml": "[package]\nname = \"x\"\n\n[dependencies]\nserde = \"1\"\ntokio = \"1\"\n\n[profile.release]\nopt-level = 3\n" } },
    { name: "bundler", direct: 2, files: {
      "Gemfile": "source 'https://rubygems.org'\ngem 'rails', '~> 7.0'\ngem \"puma\"\n" } },
    { name: "composer", direct: 2, files: {
      "composer.json": "{\"require\":{\"php\":\">=8.0\",\"monolog/monolog\":\"^3.0\"},\"require-dev\":{\"phpunit/phpunit\":\"^10\"}}\n" } },
  ];
  for (const tc of depCases) {
    const d = await makeBareFixture(`${label}-dep-${tc.name}`, tc.files);
    r = run(exec, [script, "indepth", d]);
    let got = null;
    try {
      got = JSON.parse(await fs.readFile(path.join(d, "ai", "repo-indepth.json"), "utf8")).dependencies.direct;
    } catch { /* missing/invalid output — caught by the assertion */ }
    ok(r.code === 0 && got === tc.direct,
      `indepth counts ${tc.name} direct dependencies (got ${got}, want ${tc.direct})`);
    await fs.rm(d, { recursive: true, force: true });
  }

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
    path.join(".claude", "commands", "check-drift.md"),
    path.join(".claude", "agents", "repo-explorer.md"),
    path.join(".claude", "skills", "add-feature", "SKILL.md"),
    path.join(".github", "workflows", "ai-check.yml"),
    path.join(".github", "copilot-instructions.md"),
    path.join(".github", "prompts", "cold-start.prompt.md"),
    path.join(".github", "prompts", "check-drift.prompt.md"),
    path.join(".github", "chatmodes", "repo-explorer.chatmode.md"),
    path.join(".github", "chatmodes", "feature-builder.chatmode.md"),
    path.join(".github", "chatmodes", "test-runner.chatmode.md"),
    path.join(".agents", "workflows", "cold-start.md"),
    path.join(".agents", "workflows", "add-feature.md"),
    path.join(".agents", "skills", "add-feature", "SKILL.md"),
    path.join(".cursor", "rules", "cold-start.mdc"),
    path.join(".cursor", "rules", "add-feature.mdc"),
    path.join(".cursor", "rules", "ai-knowledge-layer.mdc"),
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
  const cursorRule = await fs.readFile(path.join(repo, ".cursor", "rules", "cold-start.mdc"), "utf8");
  ok(!cursorRule.includes("{{") && !cursorRule.includes(".mdc.tmpl"),
    `no unresolved placeholders / leaked .tmpl suffixes in .cursor/rules/*.mdc`);
  ok(/^---\ndescription: .+\nalwaysApply: false\n---/.test(cursorRule),
    `.cursor/rules/cold-start.mdc carries MDC frontmatter (description, alwaysApply: false)`);
  const cursorAlwaysRule = await fs.readFile(path.join(repo, ".cursor", "rules", "ai-knowledge-layer.mdc"), "utf8");
  ok(/^---\ndescription: .+\nalwaysApply: true\n---/.test(cursorAlwaysRule),
    `.cursor/rules/ai-knowledge-layer.mdc is the alwaysApply: true index rule`);
  ok(cursorAlwaysRule.includes("ai/INDEX.md") && /\[inferred\]/.test(cursorAlwaysRule) && /\[verified\]/.test(cursorAlwaysRule),
    `the always-on rule points at ai/INDEX.md and states the provenance rule`);
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

  // ---------- incremental re-run: hash provenance + the child-lock ----------
  const manifestPath = path.join(repo, "ai", "install-manifest.json");
  const manifestAfterShazam = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  ok(manifestAfterShazam.fileHashes && typeof manifestAfterShazam.fileHashes["CLAUDE.md"] === "string",
    `manifest records a content hash per installed file`);

  // simulate a human-audited map (carries [verified]) and a plainly edited doc
  const mapPath = path.join(repo, "ai", "guide", "MODULE_MAP.md");
  const auditedMap = (await fs.readFile(mapPath, "utf8")) +
    "\n| `app.ts` | core | `app.ts` | ours | [verified] (01/07/2026) |\n";
  await fs.writeFile(mapPath, auditedMap);
  const convPath = path.join(repo, "ai", "guide", "CONVENTIONS.md");
  await fs.writeFile(convPath, "# my own conventions\n");
  // simulate a kit update shipping a new file: remove one so the re-run restores it
  const newFeatureFile = path.join(repo, ".agents", "workflows", "cold-start.md");
  await fs.rm(newFeatureFile);
  const newCursorFile = path.join(repo, ".cursor", "rules", "cold-start.mdc");
  await fs.rm(newCursorFile);
  // give shazam a humanContext to prove re-runs carry it forward
  const profileBefore = JSON.parse(await fs.readFile(profilePath, "utf8"));
  profileBefore.humanContext = { skill: "expert" };
  await fs.writeFile(profilePath, JSON.stringify(profileBefore, null, 2) + "\n");

  r = run(exec, [script, "shazam", repo, "--yes"]);
  ok(r.code === 0, `shazam re-run exits 0`);
  ok((await fs.readFile(mapPath, "utf8")) === auditedMap,
    `re-run keeps the human-audited MODULE_MAP.md byte-for-byte`);
  ok((await fs.readFile(convPath, "utf8")) === "# my own conventions\n",
    `re-run keeps the edited CONVENTIONS.md`);
  ok(await exists(newFeatureFile), `re-run adds only the missing (new-feature) file`);
  ok(await exists(newCursorFile), `re-run also restores a missing Cursor rule file`);
  ok(/keep \(/.test(r.out) && /write \(new\)/.test(r.out),
    `re-run reports kept and newly written files`);
  const profileAfterRerun = JSON.parse(await fs.readFile(profilePath, "utf8"));
  ok(profileAfterRerun.humanContext?.skill === "expert",
    `re-run carries humanContext forward (wizard answers survive)`);

  // --force: [verified] content stays locked; other edits get a backup, then overwrite
  r = run(exec, [script, "install", repo, "--yes", "--force"]);
  ok(r.code === 0, `--force re-install exits 0`);
  ok((await fs.readFile(mapPath, "utf8")) === auditedMap,
    `child-lock: --force never overwrites [verified] content`);
  ok((await fs.readFile(convPath, "utf8")) !== "# my own conventions\n",
    `--force overwrites the edited (non-verified) file`);
  const guideFiles = await fs.readdir(path.join(repo, "ai", "guide"));
  ok(guideFiles.some(n => /^CONVENTIONS_bkp_\d{8}_\d{6}\.md$/.test(n)),
    `--force leaves a timestamped backup of the file it overwrote`);

  // --force-verified: the explicit escape hatch for [verified] files.
  // In a non-TTY shell without --yes, the typed "overwrite" confirmation cannot
  // be given, so the run must warn and abort without touching anything.
  r = run(exec, [script, "install", repo, "--force-verified"]);
  ok(r.code === 0 && /LOST/.test(r.out) && /Aborted/.test(r.out),
    `--force-verified without confirmation warns and aborts`);
  ok((await fs.readFile(mapPath, "utf8")) === auditedMap,
    `aborted --force-verified leaves the [verified] map untouched`);

  // with --yes (explicit automation opt-in) it proceeds: warning + backup + overwrite
  r = run(exec, [script, "install", repo, "--yes", "--force-verified"]);
  ok(r.code === 0, `--force-verified --yes exits 0`);
  ok(/DANGER/.test(r.out) && /signature\(s\) will be LOST/.test(r.out),
    `--force-verified prints the per-signature warning`);
  ok(/\[verified\] \(01\/07\/2026\)/.test(r.out),
    `warning quotes the actual [verified] line(s) from the file on disk`);
  ok((await fs.readFile(mapPath, "utf8")) !== auditedMap,
    `--force-verified overwrites the [verified] file`);
  const guideFilesAfter = await fs.readdir(path.join(repo, "ai", "guide"));
  const mapBkp = guideFilesAfter.find(n => /^MODULE_MAP_bkp_\d{8}_\d{6}\.md$/.test(n));
  ok(Boolean(mapBkp), `--force-verified leaves a timestamped backup of the [verified] file`);
  ok(mapBkp && (await fs.readFile(path.join(repo, "ai", "guide", mapBkp), "utf8")) === auditedMap,
    `the backup preserves the audited content byte-for-byte`);

  // remove backups (not manifest-listed) so the uninstall empty-tree check holds
  for (const n of guideFilesAfter) {
    if (/_bkp_/.test(n)) await fs.rm(path.join(repo, "ai", "guide", n));
  }

  // uninstall removes manifest files, keeps user files
  r = run(exec, [script, "uninstall", repo, "--yes"]);
  ok(r.code === 0, `uninstall exits 0` + (r.code === 0 ? "" : ` (out: ${r.out})`));
  ok(!(await exists(path.join(repo, "CLAUDE.md"))), `uninstall removed CLAUDE.md`);
  ok(!(await exists(path.join(repo, "ai"))), `uninstall removed empty ai/ tree`);
  ok(!(await exists(path.join(repo, ".cursor"))), `uninstall removed the .cursor/ tree`);
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

  // ---------- orient: detector matrix (one bare fixture per stack) ----------
  // `expect` strings must appear in the orient --dry-run output; `absent` must not.
  const detectorCases = [
    { name: "gradle", files: { "build.gradle": "" },
      expect: ["Java/Kotlin", "./gradlew build -x test", "./gradlew test"] },
    { name: "gradle-kts", files: { "build.gradle.kts": "" },
      expect: ["Kotlin/Java", "./gradlew build -x test"] },
    { name: "go", files: { "go.mod": "module example.com/m\n" },
      expect: ["Go", "go build ./...", "go test ./..."] },
    { name: "rust", files: { "Cargo.toml": "[package]\nname = \"x\"\n" },
      expect: ["Rust", "cargo build", "cargo test"] },
    { name: "ruby", files: { "Gemfile": "source 'https://rubygems.org'\n" },
      expect: ["Ruby", "bundle install", "bundle exec rake test"] },
    { name: "php", files: { "composer.json": "{}\n" },
      expect: ["PHP", "composer install", "composer test"] },
    { name: "cmake", files: { "CMakeLists.txt": "" },
      expect: ["C/C++", "cmake -B build && cmake --build build"] },
    { name: "makefile-fallback", files: { "Makefile": "all:\n" },
      expect: ["C/C++", "make test"] },
    { name: "makefile-suppressed",
      files: { "Makefile": "all:\n", "package.json": "{\"scripts\":{\"build\":\"x\",\"test\":\"y\"}}\n" },
      expect: ["JavaScript"], absent: ["C/C++"] },
    { name: "pip", files: { "requirements.txt": "flask==2.0\n" },
      expect: ["Python", "pip install -r requirements.txt", "pytest"] },
    { name: "yarn",
      files: { "yarn.lock": "", "package.json": "{\"scripts\":{\"build\":\"x\",\"test\":\"y\"}}\n" },
      expect: ["yarn install && yarn build", "yarn test"] },
    { name: "bun",
      files: { "bun.lockb": "", "package.json": "{\"scripts\":{\"build\":\"x\",\"test\":\"y\"}}\n" },
      expect: ["bun install && bun run build", "bun test"] },
    { name: "pipenv", files: { "Pipfile": "", "requirements.txt": "flask==2.0\n" },
      expect: ["pipenv install", "pipenv run pytest"] },
    { name: "no-build-script", files: { "package.json": "{\"name\":\"x\"}\n" },
      expect: ["npm install", "no test script in package.json"], absent: ["npm run build"] },
    { name: "malformed-package-json", files: { "package.json": "{ not json\n" },
      expect: ["npm install"], absent: ["npm run build"] },
    { name: "empty-repo", files: {},
      expect: ["No known build-system marker found"] },
    { name: "multi-stack",
      files: { "go.mod": "module m\n", "package.json": "{\"scripts\":{\"build\":\"x\",\"test\":\"y\"}}\n" },
      expect: ["Multiple build systems detected"] },
  ];
  for (const tc of detectorCases) {
    const d = await makeBareFixture(`${label}-det-${tc.name}`, tc.files);
    r = run(exec, [script, "orient", d, "--dry-run"]);
    const missing = (tc.expect || []).filter(s => !r.out.includes(s));
    const leaked = (tc.absent || []).filter(s => r.out.includes(s));
    ok(r.code === 0 && missing.length === 0 && leaked.length === 0,
      `orient detects ${tc.name}` +
      (missing.length ? ` — missing: ${missing.join(" | ")}` : "") +
      (leaked.length ? ` — unexpected: ${leaked.join(" | ")}` : ""));
    await fs.rm(d, { recursive: true, force: true });
  }

  // ---------- orient: flag overrides win over detection ----------
  {
    const d = await makeBareFixture(`${label}-flags`, { "package.json": "{}\n" });
    r = run(exec, [script, "orient", d, "--dry-run", "--name", "CustomName",
      "--description", "Custom description here.", "--build", "make custom-build",
      "--test", "make custom-test", "--upstream", "acme/widget"]);
    const wanted = ["CustomName", "Custom description here.", "make custom-build",
      "make custom-test", "acme/widget", "--upstream flag"];
    const missing = wanted.filter(s => !r.out.includes(s));
    ok(r.code === 0 && missing.length === 0,
      `orient honors --name/--description/--build/--test/--upstream` +
      (missing.length ? ` — missing: ${missing.join(" | ")}` : ""));
    await fs.rm(d, { recursive: true, force: true });
  }

  // ---------- orient: turbo.json refinement lands in the profile ----------
  {
    const d = await makeBareFixture(`${label}-turbo`, {
      "package.json": "{\"scripts\":{\"build\":\"turbo build\",\"test\":\"turbo test\"}}\n",
      "turbo.json": "{}\n",
    });
    r = run(exec, [script, "orient", d]);
    let systems = [];
    try {
      systems = JSON.parse(await fs.readFile(path.join(d, "ai", "repo-profile.json"), "utf8")).buildSystems;
    } catch { /* missing profile — caught by the assertion */ }
    ok(r.code === 0 && systems.includes("Turborepo"),
      `turbo.json adds Turborepo to buildSystems: ${systems}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // ---------- orient: description extraction edge cases ----------
  {
    const noisy = await makeBareFixture(`${label}-desc-noisy`, {
      "README.md": "# Title\n\n[![CI](https://img)](https://ci)\n![badge](x.png)\n" +
        "<p align=\"center\">html</p>\n---\nshort\n\nThe real prose description of this project.\n",
    });
    r = run(exec, [script, "orient", noisy, "--dry-run"]);
    ok(r.code === 0 && r.out.includes("The real prose description of this project."),
      `description skips headings/badges/HTML/rules/short lines to the first prose line`);
    await fs.rm(noisy, { recursive: true, force: true });

    const longLine = "This project " + "x".repeat(180);
    const longd = await makeBareFixture(`${label}-desc-long`, { "README.md": longLine + "\n" });
    r = run(exec, [script, "orient", longd, "--dry-run"]);
    ok(r.code === 0 && r.out.includes(longLine.slice(0, 157) + "...") && !r.out.includes(longLine),
      `description over 160 chars is truncated with an ellipsis`);
    await fs.rm(longd, { recursive: true, force: true });

    const bare = await makeBareFixture(`${label}-desc-none`, {
      "README.md": "# Only a heading\n\n![badge](b.png)\n" });
    r = run(exec, [script, "orient", bare, "--dry-run"]);
    ok(r.code === 0 && r.out.includes("fill in"),
      `README with no prose line falls back to the fill-in placeholder`);
    await fs.rm(bare, { recursive: true, force: true });
  }

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

  // verify with no knowledge docs at all → refuses with a clear error
  {
    const nrepo = await makeBareFixture(`${label}-verify-none`, { "app.ts": "export {};\n" });
    r = run(exec, [script, "verify", nrepo]);
    ok(r.code !== 0 && /Nothing to verify/.test(r.out),
      `verify without knowledge docs exits non-zero with guidance`);
    await fs.rm(nrepo, { recursive: true, force: true });
  }

  // duplicate basenames: a filename claim is confirmed but flags the ambiguity
  {
    const dupe = await makeBareFixture(`${label}-verify-dupe`, {
      "a/dup.ts": "export {};\n",
      "b/dup.ts": "export {};\n",
      "ai/guide/MODULE_MAP.md": "# map\nSee `dup.ts`.\n",
    });
    r = run(exec, [script, "verify", dupe]);
    let dc = null;
    try {
      const dm = JSON.parse(await fs.readFile(path.join(dupe, "ai", "analysis",
        "audit-reports", "VERIFICATION_MANIFEST.json"), "utf8"));
      dc = dm.claims.find(c => c.claim === "dup.ts");
    } catch { /* missing manifest — caught by the assertion */ }
    ok(r.code === 0 && dc?.status === "confirmed" && /2 matches/.test(dc?.note || ""),
      `filename claim with duplicate basenames confirmed with a "2 matches" note`);
    await fs.rm(dupe, { recursive: true, force: true });
  }

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

  // ---------- drift --suggest: ready-to-paste fixes ----------
  // A bare fixture (no tests/ or other base-fixture dirs) so unmapped/vanished
  // counts are exact: one unmapped directory, one vanished row.
  const srepo = await makeBareFixture(`${label}-suggest`, {
    // a bigger, non-entry file plus a small index.ts — the picker must prefer
    // index.* over a larger file, proving the entry-point priority (not "largest").
    "widgets/helpers.ts": "export const big = " + "1".repeat(200) + ";\n",
    "widgets/index.ts": "export const w = 1;\n",
    "ai/guide/MODULE_MAP.md":
      "# Module map\n" +
      "> Last verified: 2026-06-01 @ commit <fill in sha>\n" +
      "| Directory | Responsibility | Entry point | Stability | Status |\n" +
      "|---|---|---|---|---|\n" +
      "| `gone/` | removed module | (unmapped) | stable | [inferred] |\n",
  });

  // without --suggest: byte-identical to today (no suggestions key, no report section)
  r = run(exec, [script, "drift", srepo]);
  ok(r.code === 0, `drift (no --suggest) exits 0`);
  const sManifestPath = path.join(srepo, "ai", "analysis", "audit-reports", "DRIFT_MANIFEST.json");
  const sReportPath = path.join(srepo, "ai", "analysis", "audit-reports", "DRIFT_REPORT.md");
  const sManifestNoSuggest = JSON.parse(await fs.readFile(sManifestPath, "utf8"));
  ok(!("suggestions" in sManifestNoSuggest), `no --suggest → manifest has no suggestions key`);
  const sReportNoSuggest = await fs.readFile(sReportPath, "utf8");
  ok(!/Suggested rows/.test(sReportNoSuggest), `no --suggest → report has no Suggested rows section`);
  ok(sManifestNoSuggest.summary.unmapped === 1 && sManifestNoSuggest.summary.vanished === 1,
    `--suggest fixture has exactly one unmapped dir and one vanished row`);

  // --dry-run --suggest still writes nothing
  r = run(exec, [script, "drift", srepo, "--suggest", "--dry-run"]);
  ok(r.code === 0, `drift --suggest --dry-run exits 0`);

  // real run with --suggest
  r = run(exec, [script, "drift", srepo, "--suggest"]);
  ok(r.code === 0, `drift --suggest exits 0`);
  const sManifest = JSON.parse(await fs.readFile(sManifestPath, "utf8"));
  ok(Array.isArray(sManifest.suggestions) && sManifest.suggestions.length === 2,
    `--suggest manifest carries exactly 2 suggestion entries (1 unmapped-row + 1 vanished-fix)`);
  const unmappedSuggestion = sManifest.suggestions.find(s => s.type === "unmapped-row");
  ok(unmappedSuggestion?.directory === "widgets/" && unmappedSuggestion?.entry === "widgets/index.ts",
    `suggested entry point prefers index.ts over the larger helpers.ts: ${unmappedSuggestion?.entry}`);
  ok(/\[inferred\]/.test(unmappedSuggestion?.row) && / \? /.test(unmappedSuggestion?.row),
    `suggested row carries Stability ? and tag [inferred], never a guess`);
  const vanishedSuggestion = sManifest.suggestions.find(s => s.type === "vanished-fix");
  ok(vanishedSuggestion?.claim === "gone/" && vanishedSuggestion?.line === 5,
    `suggested vanished fix points at the exact MODULE_MAP.md line: ${JSON.stringify(vanishedSuggestion)}`);
  const sReport = await fs.readFile(sReportPath, "utf8");
  ok(sReport.includes("Suggested rows") && sReport.includes("widgets/index.ts"),
    `report includes the Suggested rows section with the paste-ready row`);
  ok(sReport.includes("Suggested fixes for vanished rows") && /`gone\/`\s*\|\s*5\s*\|/.test(sReport),
    `report includes the vanished-row line-number pointer`);

  await fs.rm(srepo, { recursive: true, force: true });

  // ---------- --github-summary: friendly CI feedback ----------
  {
    const sumFile = path.join(here, `tmp-summary-${label}-${process.pid}.md`);
    const runEnv = (extraEnv, args) => {
      const rr = spawnSync(exec, [script, ...args], { encoding: "utf8", env: { ...process.env, ...extraEnv } });
      return { code: rr.status, out: (rr.stdout || "") + (rr.stderr || "") };
    };

    // verify: failing claim + --github-summary + env set → ❌ headline naming the fix
    {
      const d = await makeBareFixture(`${label}-summary-verify-fail`, {
        "ai/guide/MODULE_MAP.md": "# map\nSee `missing/ghost.ts`.\n",
      });
      await fs.rm(sumFile, { force: true });
      const rr = runEnv({ GITHUB_STEP_SUMMARY: sumFile }, ["verify", d, "--github-summary"]);
      ok(rr.code === 0, `verify --github-summary exits 0 (no --strict) even with an unconfirmed claim`);
      const sum = await fs.readFile(sumFile, "utf8").catch(() => "");
      ok(/❌/.test(sum) && /missing\/ghost\.ts/.test(sum) && /check-drift/.test(sum),
        `verify appends a ❌ summary naming the missing claim and the fix`);
      await fs.rm(d, { recursive: true, force: true });
      await fs.rm(sumFile, { force: true });
    }

    // verify: clean run + --github-summary + env set → ✅ headline + confirmation
    {
      const d = await makeBareFixture(`${label}-summary-verify-ok`, {
        "app.ts": "export {};\n",
        "ai/guide/MODULE_MAP.md": "# map\nEntry point `app.ts`.\n",
      });
      await fs.rm(sumFile, { force: true });
      const rr = runEnv({ GITHUB_STEP_SUMMARY: sumFile }, ["verify", d, "--github-summary"]);
      ok(rr.code === 0, `verify --github-summary exits 0 on a clean run`);
      const sum = await fs.readFile(sumFile, "utf8").catch(() => "");
      ok(/✅/.test(sum) && /confirmed/.test(sum), `verify appends a ✅ confirmation summary`);
      await fs.rm(d, { recursive: true, force: true });
      await fs.rm(sumFile, { force: true });
    }

    // verify: --github-summary without the env var set → silent no-op, exit unaffected
    {
      const d = await makeBareFixture(`${label}-summary-verify-noenv`, {
        "app.ts": "export {};\n",
        "ai/guide/MODULE_MAP.md": "# map\nEntry point `app.ts`.\n",
      });
      const envNoSummary = { ...process.env };
      delete envNoSummary.GITHUB_STEP_SUMMARY;
      const rr = spawnSync(exec, [script, "verify", d, "--github-summary"], { encoding: "utf8", env: envNoSummary });
      ok(rr.status === 0, `verify --github-summary without the env var still exits 0 (silent no-op)`);
      await fs.rm(d, { recursive: true, force: true });
    }

    // verify: env var set but the flag absent → nothing appended (today's behavior)
    {
      const d = await makeBareFixture(`${label}-summary-verify-noflag`, {
        "app.ts": "export {};\n",
        "ai/guide/MODULE_MAP.md": "# map\nEntry point `app.ts`.\n",
      });
      await fs.rm(sumFile, { force: true });
      runEnv({ GITHUB_STEP_SUMMARY: sumFile }, ["verify", d]);
      ok(!(await exists(sumFile)), `verify without --github-summary appends nothing, even with the env var set`);
      await fs.rm(d, { recursive: true, force: true });
    }

    // drift: unmapped directory + --github-summary + env set → ❌ headline naming the fix
    {
      const d = await makeBareFixture(`${label}-summary-drift-fail`, {
        "widgets/widget.ts": "export {};\n",
        "ai/guide/MODULE_MAP.md":
          "# map\n| Directory | Responsibility | Entry point | Stability | Status |\n|---|---|---|---|---|\n",
      });
      await fs.rm(sumFile, { force: true });
      const rr = runEnv({ GITHUB_STEP_SUMMARY: sumFile }, ["drift", d, "--github-summary"]);
      ok(rr.code === 0, `drift --github-summary exits 0 (no --strict) even with drift found`);
      const sum = await fs.readFile(sumFile, "utf8").catch(() => "");
      ok(/❌/.test(sum) && /widgets\//.test(sum) && /check-drift/.test(sum),
        `drift appends a ❌ summary naming the unmapped directory and the fix`);
      await fs.rm(d, { recursive: true, force: true });
      await fs.rm(sumFile, { force: true });
    }

    // drift: clean run + --github-summary + env set → ✅ headline + confirmation
    {
      const d = await makeBareFixture(`${label}-summary-drift-ok`, {
        "app.ts": "export {};\n",
        "ai/guide/MODULE_MAP.md":
          "# map\n| Directory | Responsibility | Entry point | Stability | Status |\n|---|---|---|---|---|\n" +
          "| `/` (root) | core | `app.ts` | ours | [verified] |\n",
      });
      await fs.rm(sumFile, { force: true });
      const rr = runEnv({ GITHUB_STEP_SUMMARY: sumFile }, ["drift", d, "--github-summary"]);
      ok(rr.code === 0, `drift --github-summary exits 0 on a clean run`);
      const sum = await fs.readFile(sumFile, "utf8").catch(() => "");
      ok(/✅/.test(sum) && /No drift/.test(sum), `drift appends a ✅ confirmation summary`);
      await fs.rm(d, { recursive: true, force: true });
      await fs.rm(sumFile, { force: true });
    }
  }

  // ---------- error handling & CLI surface ----------
  r = run(exec, [script, "install", path.join(here, "definitely-not-here-xyz")]);
  ok(r.code !== 0, `missing target → non-zero exit`);
  r = run(exec, [script]);
  ok(r.code === 0 && /Usage:/.test(r.out), `bare invocation prints usage and exits 0`);
  r = run(exec, [script, "orient", ".", "--bogus"]);
  ok(r.code !== 0 && /Unknown option/.test(r.out), `unknown option → non-zero exit`);
}

console.log("ai-fication-kit smoke tests");

await testInstaller("node", process.execPath, path.join(kitRoot, "install.mjs"));

// the intake wizard must self-skip (return null) for automation, never hang on input.
{
  const { runFirstRunWizard } = await import(pathToFileURL(path.join(kitRoot, "lib", "intake.mjs")).href);
  const r = await runFirstRunWizard(here, { languages: [] }, { yes: true });
  ok(r === null, `intake wizard self-skips under --yes (no humanContext, no prompt)`);
}

// ---------- intake: AI-tool detection + tailored next-steps text ----------
console.log("\n— intake: tool detection —");
{
  const { detectPrimaryTool, coldStartInstructionFor, PRIMARY_TOOL_OPTIONS } =
    await import(pathToFileURL(path.join(kitRoot, "lib", "intake.mjs")).href);

  ok(PRIMARY_TOOL_OPTIONS.includes("Claude Code") && PRIMARY_TOOL_OPTIONS.includes("None yet"),
    `PRIMARY_TOOL_OPTIONS lists the expected choices: ${PRIMARY_TOOL_OPTIONS.join(", ")}`);

  // signals detected in isolation — each fixture "home" carries exactly one signal
  {
    const home = await makeBareFixture("tool-detect-claude", { ".claude/settings.json": "{}\n" });
    const target = await makeBareFixture("tool-detect-claude-target", { "app.ts": "export {};\n" });
    ok((await detectPrimaryTool(target, home)) === "Claude Code",
      `detectPrimaryTool: <home>/.claude/ → "Claude Code"`);
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(target, { recursive: true, force: true });
  }
  {
    const home = await makeBareFixture("tool-detect-nohome", {});
    const target = await makeBareFixture("tool-detect-cursor-target", { ".cursor/settings.json": "{}\n" });
    ok((await detectPrimaryTool(target, home)) === "Cursor",
      `detectPrimaryTool: .cursor/ in the TARGET repo → "Cursor"`);
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(target, { recursive: true, force: true });
  }
  {
    const home = await makeBareFixture("tool-detect-cursor-home", { ".cursor/settings.json": "{}\n" });
    const target = await makeBareFixture("tool-detect-plain-target", { "app.ts": "export {};\n" });
    ok((await detectPrimaryTool(target, home)) === "Cursor",
      `detectPrimaryTool: .cursor/ in the HOME dir → "Cursor"`);
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(target, { recursive: true, force: true });
  }
  {
    const home = await makeBareFixture("tool-detect-copilot", {
      ".vscode/extensions/github.copilot-1.2.3/package.json": "{}\n",
    });
    const target = await makeBareFixture("tool-detect-copilot-target", { "app.ts": "export {};\n" });
    ok((await detectPrimaryTool(target, home)) === "GitHub Copilot",
      `detectPrimaryTool: ~/.vscode/extensions/github.copilot* → "GitHub Copilot"`);
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(target, { recursive: true, force: true });
  }
  {
    // no home dir at all (permissions, sandboxed container, …) — tolerated silently, no throw
    const missingHome = path.join(here, `tmp-tool-detect-missing-${process.pid}`);
    const target = await makeBareFixture("tool-detect-missing-target", { "app.ts": "export {};\n" });
    let result, threw = false;
    try { result = await detectPrimaryTool(target, missingHome); } catch { threw = true; }
    ok(!threw && result === null, `detectPrimaryTool: missing home dir → null, no throw`);
    await fs.rm(target, { recursive: true, force: true });
  }
  {
    const home = await makeBareFixture("tool-detect-none", {});
    const target = await makeBareFixture("tool-detect-none-target", { "app.ts": "export {};\n" });
    ok((await detectPrimaryTool(target, home)) === null,
      `detectPrimaryTool: no signal at all → null (asks with no default guess)`);
    await fs.rm(home, { recursive: true, force: true });
    await fs.rm(target, { recursive: true, force: true });
  }

  // coldStartInstructionFor: every named tool, plus the fallback cases
  ok(/Claude Code/.test(coldStartInstructionFor("Claude Code")), `coldStartInstructionFor: Claude Code`);
  ok(/Copilot Chat/.test(coldStartInstructionFor("GitHub Copilot")), `coldStartInstructionFor: GitHub Copilot`);
  ok(/\.cursor\/rules\/cold-start\.mdc/.test(coldStartInstructionFor("Cursor")), `coldStartInstructionFor: Cursor`);
  ok(/Agent Manager/.test(coldStartInstructionFor("Google Antigravity")), `coldStartInstructionFor: Google Antigravity`);
  const fallback = coldStartInstructionFor("Claude Code");
  ok(coldStartInstructionFor("Several of these") === fallback, `coldStartInstructionFor: "Several of these" falls back to Claude Code`);
  ok(coldStartInstructionFor("something-unrecognized") === fallback, `coldStartInstructionFor: unrecognized value falls back to Claude Code`);
  ok(coldStartInstructionFor(undefined) === fallback, `coldStartInstructionFor: undefined (no wizard ran) falls back to Claude Code`);
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
// ---------- indepth git history (git-gated; both installers) ----------
// The main-fixture indepth run has a fake .git (config only, no repository), so
// the whole git-history analyzer short-circuits there. This exercises it for real.
console.log("\n— indepth git history —");
{
  const gitOk = run("git", ["--version"]).code === 0;
  if (!gitOk) {
    console.log("  — SKIPPED (no git on PATH)");
  } else {
    const hrepo = path.join(here, `tmp-indepth-git-${process.pid}`);
    await fs.rm(hrepo, { recursive: true, force: true });
    await fs.mkdir(hrepo, { recursive: true });
    await fs.writeFile(path.join(hrepo, "app.ts"), "export const a = 1;\n");
    const g = (...a) => run("git", ["-C", hrepo, ...a]);
    g("init", "-q"); g("config", "user.email", "t@t.t"); g("config", "user.name", "t");
    g("config", "commit.gpgsign", "false"); g("config", "tag.gpgsign", "false");
    g("add", "-A"); g("commit", "--no-gpg-sign", "-qm", "init");
    await fs.writeFile(path.join(hrepo, "app.ts"), "export const a = 2;\n");
    g("add", "-A"); g("commit", "--no-gpg-sign", "-qm", "change");
    g("tag", "-a", "v1.0.0", "-m", "first release");
    const sha = run("git", ["-C", hrepo, "rev-parse", "HEAD"]).out.trim();
    if (!/^[0-9a-f]{7,40}$/.test(sha)) {
      console.log("  — SKIPPED (could not create a commit in this environment)");
    } else {
      const installers = [["node", process.execPath, path.join(kitRoot, "install.mjs")]];
      for (const [ilabel, exec, script] of installers) {
        const r = run(exec, [script, "indepth", hrepo]);
        let gh = null;
        try {
          gh = JSON.parse(await fs.readFile(path.join(hrepo, "ai", "repo-indepth.json"), "utf8")).gitHistory;
        } catch { /* missing output — caught by the assertion */ }
        ok(r.code === 0 && gh && gh.commitCount === 2 && gh.contributorCount === 1 && gh.tagCount === 1,
          `${ilabel}: indepth analyzes real git history ` +
          `(commits ${gh?.commitCount}, contributors ${gh?.contributorCount}, tags ${gh?.tagCount})`);
        await fs.rm(path.join(hrepo, "ai"), { recursive: true, force: true });
      }
    }
    await fs.rm(hrepo, { recursive: true, force: true });
  }
}

// ---------- doctor: read-only workflow-stage detector ----------
console.log("\n— doctor —");
{
  const { diagnose } = await import(pathToFileURL(path.join(kitRoot, "lib", "doctor.mjs")).href);

  async function treeHash(dir) {
    const parts = [];
    async function walk(rel) {
      let entries;
      try { entries = await fs.readdir(path.join(dir, rel), { withFileTypes: true }); }
      catch { return; }
      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const e of entries) {
        const r = rel ? rel + "/" + e.name : e.name;
        if (e.isDirectory()) await walk(r);
        else parts.push(r);
      }
    }
    await walk("");
    return parts.join("|");
  }

  // Step 1: no ai/repo-profile.json at all.
  {
    const d = await makeBareFixture("doctor-step1", { "app.ts": "export {};\n" });
    const before = await treeHash(d);
    const result = await diagnose(d);
    ok(result.step === 1 && /shazam/.test(result.action), `step 1: no profile → run shazam`);
    ok(await treeHash(d) === before, `doctor never writes a file (step 1)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // Step 2: profile exists, MODULE_MAP.md missing entirely.
  {
    const d = await makeBareFixture("doctor-step2a", {
      "ai/repo-profile.json": "{}\n",
    });
    const result = await diagnose(d);
    ok(result.step === 2 && /cold-start/.test(result.action), `step 2: no MODULE_MAP.md → run /cold-start`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // Step 2: profile exists, MODULE_MAP.md is still the scaffolded template.
  {
    const templateMap = await fs.readFile(
      path.join(kitRoot, "templates", "ai", "guide", "MODULE_MAP.md.tmpl"), "utf8");
    const d = await makeBareFixture("doctor-step2b", {
      "ai/repo-profile.json": "{}\n",
      "ai/guide/MODULE_MAP.md": templateMap.replace("{{TEST_DIRS}}", "test/"),
    });
    const before = await treeHash(d);
    const result = await diagnose(d);
    ok(result.step === 2 && /cold-start/.test(result.action), `step 2: scaffolded template → run /cold-start`);
    ok(await treeHash(d) === before, `doctor never writes a file (step 2)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // Step 3: MODULE_MAP.md populated but rows still [inferred].
  {
    const d = await makeBareFixture("doctor-step3", {
      "ai/repo-profile.json": "{}\n",
      "ai/guide/MODULE_MAP.md":
        "# Module map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ours | [inferred] |\n",
      "src/app.ts": "export {};\n",
    });
    const result = await diagnose(d);
    ok(result.step === 3 && /audit/.test(result.action), `step 3: [inferred] rows → human audit`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // Step 4: all rows [verified], but no verify/drift manifests yet.
  {
    const d = await makeBareFixture("doctor-step4", {
      "ai/repo-profile.json": "{}\n",
      "ai/guide/MODULE_MAP.md":
        "# Module map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ours | [verified] (01/07/2026) |\n",
      "src/app.ts": "export {};\n",
    });
    const before = await treeHash(d);
    const result = await diagnose(d);
    ok(result.step === 4 && /verify/.test(result.action) && /drift/.test(result.action),
      `step 4: no manifests yet → run verify --strict / drift --strict`);
    ok(await treeHash(d) === before, `doctor never writes a file (step 4)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // Step 4: manifests exist but recorded failures.
  {
    const d = await makeBareFixture("doctor-step4b", {
      "ai/repo-profile.json": "{}\n",
      "ai/guide/MODULE_MAP.md":
        "# Module map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ours | [verified] (01/07/2026) |\n",
      "src/app.ts": "export {};\n",
      "ai/analysis/audit-reports/VERIFICATION_MANIFEST.json":
        JSON.stringify({ summary: { confirmed: 1, moved: 0, missing: 1 } }),
      "ai/analysis/audit-reports/DRIFT_MANIFEST.json":
        JSON.stringify({ summary: { unmapped: 0, vanished: 0, stale: 0 } }),
    });
    const result = await diagnose(d);
    ok(result.step === 4, `step 4: manifests present but verify found a missing claim`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // Step 5: all rows [verified], manifests present and clean.
  {
    const d = await makeBareFixture("doctor-step5", {
      "ai/repo-profile.json": "{}\n",
      "ai/guide/MODULE_MAP.md":
        "# Module map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ours | [verified] (01/07/2026) |\n",
      "src/app.ts": "export {};\n",
      "ai/analysis/audit-reports/VERIFICATION_MANIFEST.json":
        JSON.stringify({ summary: { confirmed: 1, moved: 0, missing: 0 } }),
      "ai/analysis/audit-reports/DRIFT_MANIFEST.json":
        JSON.stringify({ summary: { unmapped: 0, vanished: 0, stale: 0 } }),
    });
    const before = await treeHash(d);
    const result = await diagnose(d);
    ok(result.step === 5 && /trusted|maintenance/.test(result.action),
      `step 5: all verified + clean manifests → maintenance mode`);
    ok(await treeHash(d) === before, `doctor never writes a file (step 5)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // CLI surface: `doctor` exits 0 and writes nothing on a real fixture.
  {
    const d = await makeFixture("doctor-cli", { fork: false });
    const before = await treeHash(d);
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "doctor", d]);
    ok(r.code === 0 && /step 1 of 5/.test(r.out), `doctor CLI exits 0 and reports step 1 of 5`);
    ok(await treeHash(d) === before, `doctor CLI writes nothing`);
    await fs.rm(d, { recursive: true, force: true });
  }
}

// ---------- status: one-command health snapshot ----------
console.log("\n— status —");
{
  const { computeStatus } = await import(pathToFileURL(path.join(kitRoot, "lib", "status.mjs")).href);

  // DRIFTING: a broken claim, regardless of MODULE_MAP audit state.
  {
    const d = await makeBareFixture("status-drifting", {
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ours | [verified] (01/07/2026) |\n" +
        "See `missing/ghost.ts`.\n",
      "src/app.ts": "export {};\n",
    });
    const result = await computeStatus(d);
    ok(result.verdict === "DRIFTING", `broken claim → DRIFTING verdict (got ${result.verdict})`);
    ok(result.brokenClaims === 1, `brokenClaims counts the unconfirmed claim`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // DRIFTING: a structural drift item (unmapped dir), no broken claims.
  {
    const d = await makeBareFixture("status-drifting-drift", {
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `/` (root) | core | `app.ts` | ours | [verified] (01/07/2026) |\n",
      "app.ts": "export {};\n",
      "widgets/widget.ts": "export {};\n",
    });
    const result = await computeStatus(d);
    ok(result.verdict === "DRIFTING", `unmapped directory → DRIFTING verdict (got ${result.verdict})`);
    ok(result.driftItems === 1, `driftItems counts the unmapped directory`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // NEEDS AUDIT: no broken claims/drift, but an [inferred] row.
  {
    const d = await makeBareFixture("status-needs-audit", {
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `/` (root) | core | `app.ts` | ours | [inferred] |\n",
      "app.ts": "export {};\n",
    });
    const result = await computeStatus(d);
    ok(result.verdict === "NEEDS AUDIT", `[inferred] row → NEEDS AUDIT verdict (got ${result.verdict})`);
    ok(result.rows.inferred === 1 && result.rows.verified === 0, `row counts reflect the [inferred] row`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // NEEDS AUDIT: no MODULE_MAP.md at all.
  {
    const d = await makeBareFixture("status-no-map", { "app.ts": "export {};\n" });
    const result = await computeStatus(d);
    ok(result.verdict === "NEEDS AUDIT" && result.hasModuleMap === false,
      `missing MODULE_MAP.md → NEEDS AUDIT verdict (got ${result.verdict})`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // NEEDS AUDIT: every row [verified], but the audit is stale (> 90 days).
  {
    const d = await makeBareFixture("status-stale-audit", {
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `/` (root) | core | `app.ts` | ours | [verified] (01/01/2020) |\n",
      "app.ts": "export {};\n",
    });
    const result = await computeStatus(d);
    ok(result.verdict === "NEEDS AUDIT" && result.daysSinceAudit > 90,
      `audit older than 90 days → NEEDS AUDIT verdict (${result.daysSinceAudit} days)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // TRUSTED: no broken claims/drift, every row [verified], audit recent.
  {
    const today = new Date();
    const dd = String(today.getUTCDate()).padStart(2, "0");
    const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = today.getUTCFullYear();
    const d = await makeBareFixture("status-trusted", {
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        `| \`/\` (root) | core | \`app.ts\` | ours | [verified] (${dd}/${mm}/${yyyy}) |\n`,
      "app.ts": "export {};\n",
    });
    const result = await computeStatus(d);
    ok(result.verdict === "TRUSTED", `all-verified, clean, fresh audit → TRUSTED verdict (got ${result.verdict})`);
    ok(result.badge.schemaVersion === 1 && result.badge.label === "ai-ready" && result.badge.color === "brightgreen",
      `TRUSTED badge matches the shields.io endpoint schema: ${JSON.stringify(result.badge)}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // status never invokes git, even with real git history + a --git-worthy stale row.
  {
    const gitOk = run("git", ["--version"]).code === 0;
    if (!gitOk) {
      console.log("  — SKIPPED (no git on PATH)");
    } else {
      const d = path.join(here, `tmp-status-git-${process.pid}`);
      await fs.rm(d, { recursive: true, force: true });
      await fs.mkdir(path.join(d, "billing"), { recursive: true });
      await fs.writeFile(path.join(d, "billing", "invoice.ts"), "export const b = 1;\n");
      const g = (...a) => run("git", ["-C", d, ...a]);
      g("init", "-q"); g("config", "user.email", "t@t.t"); g("config", "user.name", "t");
      g("config", "commit.gpgsign", "false");
      g("add", "-A"); g("commit", "--no-gpg-sign", "-qm", "init");
      const sha = run("git", ["-C", d, "rev-parse", "HEAD"]).out.trim();
      await fs.mkdir(path.join(d, "ai", "guide"), { recursive: true });
      const today = new Date();
      const dd = String(today.getUTCDate()).padStart(2, "0");
      const mm = String(today.getUTCMonth() + 1).padStart(2, "0");
      const yyyy = today.getUTCFullYear();
      await fs.writeFile(path.join(d, "ai", "guide", "MODULE_MAP.md"),
        "# map\n" +
        `> Last verified: ${yyyy}-${mm}-${dd} @ commit ${sha}\n` +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        `| \`billing/\` | billing | \`billing/invoice.ts\` | stable | [verified] (${dd}/${mm}/${yyyy}) |\n`);
      g("add", "-A"); g("commit", "--no-gpg-sign", "-qm", "map");
      // change billing AFTER the verified commit — a real `drift --git` would flag this stale
      await fs.writeFile(path.join(d, "billing", "invoice.ts"), "export const b = 2;\n");
      g("add", "-A"); g("commit", "--no-gpg-sign", "-qm", "change");
      const result = await computeStatus(d);
      ok(result.verdict === "TRUSTED" && result.drift.stale === 0,
        `status ignores the stale [verified] row (never invokes git), unlike drift --git would`);
      await fs.rm(d, { recursive: true, force: true });
    }
  }

  // --json: writes STATUS.json only when the flag is passed.
  {
    const d = await makeBareFixture("status-json", {
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `/` (root) | core | `app.ts` | ours | [inferred] |\n",
      "app.ts": "export {};\n",
    });
    const statusJsonPath = path.join(d, "ai", "analysis", "audit-reports", "STATUS.json");

    let r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "status", d]);
    ok(r.code === 0 && /Verdict:/.test(r.out), `status CLI exits 0 and prints a Verdict line`);
    ok(!(await exists(statusJsonPath)), `status without --json writes nothing`);

    r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "status", d, "--json"]);
    ok(r.code === 0, `status --json exits 0`);
    ok(await exists(statusJsonPath), `status --json writes ai/analysis/audit-reports/STATUS.json`);
    const statusJson = JSON.parse(await fs.readFile(statusJsonPath, "utf8"));
    ok(statusJson.verdict === "NEEDS AUDIT" && statusJson.badge?.schemaVersion === 1,
      `STATUS.json carries the verdict and a shields.io-schema badge`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // own-repo sanity: row counts match a hand count of ai/guide/MODULE_MAP.md
  // (table rows only — start with "| `"; prose mentions of the tags elsewhere
  // in the file, e.g. the audit-protocol notes, must not be counted).
  {
    const mapText = await fs.readFile(path.join(kitRoot, "ai", "guide", "MODULE_MAP.md"), "utf8");
    const tableLines = mapText.split("\n").filter(l => /^\|\s*`/.test(l));
    const verifiedCount = tableLines.filter(l => l.includes("[verified]")).length;
    const inferredCount = tableLines.filter(l => l.includes("[inferred]")).length;
    const result = await computeStatus(kitRoot);
    ok(result.rows.verified === verifiedCount && result.rows.inferred === inferredCount,
      `own-repo row counts match a hand count: verified ${result.rows.verified}/${verifiedCount}, inferred ${result.rows.inferred}/${inferredCount}`);
    await fs.rm(path.join(kitRoot, "ai", "analysis", "audit-reports", "STATUS.json"), { force: true });
  }
}

// ---------- audit: guided human audit ----------
// The CLI's interactive loop needs a real TTY (choose()/confirm() self-skip
// otherwise), which this sandboxed test runner cannot allocate without a new
// dependency — so the refusal path is exercised end-to-end via the CLI, and
// every deterministic building block (evidence, row rewrite, edit application,
// backup+write) is unit-tested directly against lib/audit.mjs.
console.log("\n— audit —");
{
  const {
    formatAuditTimestamp, targetDirFor, computeEvidence, rewriteRowLine,
    applyEdits, writeAuditedMap,
  } = await import(pathToFileURL(path.join(kitRoot, "lib", "audit.mjs")).href);

  // ---- CLI refusal path: non-TTY and --yes both refuse, write nothing ----
  {
    const d = await makeBareFixture("audit-refuse", {
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ours | [inferred] |\n",
      "src/app.ts": "export {};\n",
    });
    const before = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");

    let r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "audit", d]);
    ok(r.code === 0 && /human activity/.test(r.out), `non-TTY audit refuses with the friendly message`);

    r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "audit", d, "--yes"]);
    ok(r.code === 0 && /human activity/.test(r.out), `--yes does NOT unlock audit — still refuses`);

    const after = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
    ok(after === before, `refused audit runs leave MODULE_MAP.md byte-identical`);
    const files = await fs.readdir(path.join(d, "ai", "guide"));
    ok(!files.some(f => /_bkp_/.test(f)), `refused audit runs take no backup`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // ---- formatAuditTimestamp ----
  ok(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(formatAuditTimestamp(new Date(2026, 6, 3, 9, 5))),
    `formatAuditTimestamp produces DD/MM/YYYY HH:mm: ${formatAuditTimestamp(new Date(2026, 6, 3, 9, 5))}`);

  // ---- targetDirFor ----
  // Minimal inline row shapes (mirroring parseModuleMap's output) — no need
  // for a full MODULE_MAP.md fixture to unit-test this pure function.
  {
    ok(targetDirFor({ dirClaims: ["src/"], entryClaims: ["src/app.ts"] }) === "src",
      `targetDirFor prefers a non-root directory claim`);
    ok(targetDirFor({ dirClaims: ["/"], entryClaims: ["app.ts"] }) === "",
      `targetDirFor treats the root marker as the repo root`);
    ok(targetDirFor({ dirClaims: [], entryClaims: ["lib/util.mjs"] }) === "lib",
      `targetDirFor falls back to the entry point's directory`);
    ok(targetDirFor({ dirClaims: [], entryClaims: [] }) === "",
      `targetDirFor falls back to root with no claims at all`);
  }

  // ---- computeEvidence ----
  {
    const d = await makeBareFixture("audit-evidence", {
      "widgets/small.ts": "export const a = 1;\n",
      "widgets/big.ts": "export const big = " + "1".repeat(500) + ";\n",
      "widgets/sub/nested.ts": "export const n = 1;\n",
    });
    // make big.ts the newest by touching it after the others
    await new Promise(res => setTimeout(res, 10));
    await fs.utimes(path.join(d, "widgets", "big.ts"), new Date(), new Date());
    const evidence = await computeEvidence(d, { dirClaims: ["widgets/"], entryClaims: [] }, { git: false });
    ok(evidence.dirRel === "widgets", `computeEvidence resolves the row's directory`);
    ok(evidence.fileCount === 3, `computeEvidence counts files recursively (incl. widgets/sub/)`);
    ok(evidence.largest[0].rel === "widgets/big.ts", `computeEvidence ranks the largest file first`);
    ok(evidence.newest[0].rel === "widgets/big.ts", `computeEvidence ranks the most recently modified file first`);
    ok(evidence.lastCommit === null, `computeEvidence skips git evidence without --git`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // ---- rewriteRowLine ----
  {
    const line5col = "| `src/` | core logic | `src/app.ts` | ? | [inferred] |";
    const rewritten = rewriteRowLine(line5col, "ours", "[verified] (03/07/2026 09:05)");
    ok(rewritten === "| `src/` | core logic | `src/app.ts` | ours | [verified] (03/07/2026 09:05) |",
      `rewriteRowLine replaces only Stability and Status, keeping other cells verbatim: ${rewritten}`);
    const line4col = "| <fill in> | <fill in> | <fill in> | ? |";
    ok(rewriteRowLine(line4col, "ours", "[verified] (x)") === null,
      `rewriteRowLine returns null for a 4-column (scaffolded, no Status column) row`);
  }

  // ---- applyEdits: no line insertion/deletion, only listed+eligible rows change ----
  {
    const mapText =
      "# Module map\n" +
      "| Directory | Responsibility | Entry point | Stability | Status |\n" +
      "|---|---|---|---|---|\n" +
      "| `src/` | core | `src/app.ts` | ? | [inferred] |\n" +
      "| `lib/` | helpers | `lib/util.mjs` | ? | [inferred] |\n";
    const edits = new Map([[4, { stability: "ours", timestamp: "03/07/2026 09:05" }]]);
    const { text, appliedLines } = applyEdits(mapText, edits);
    const lines = text.split("\n");
    ok(lines.length === mapText.split("\n").length, `applyEdits never inserts/removes lines`);
    ok(lines[3].includes("[verified] (03/07/2026 09:05)") && lines[3].includes("| ours |"),
      `applyEdits rewrites the confirmed row (line 4)`);
    ok(lines[4] === "| `lib/` | helpers | `lib/util.mjs` | ? | [inferred] |",
      `applyEdits leaves the unconfirmed row byte-identical (line 5)`);
    ok(appliedLines.length === 1 && appliedLines[0] === 4, `applyEdits reports exactly the applied line numbers`);

    // the rewritten table must still parse cleanly (verify/drift can consume it)
    const dTable = await makeBareFixture("audit-table-parses", {
      "src/app.ts": "export {};\n",
      "lib/util.mjs": "export {};\n",
      "ai/guide/MODULE_MAP.md": text,
    });
    let r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "drift", dTable, "--strict"]);
    ok(r.code === 0, `the rewritten table passes drift --strict`);
    await fs.rm(dTable, { recursive: true, force: true });
  }

  // ---- writeAuditedMap: one backup, then the new content ----
  {
    const d = await makeBareFixture("audit-write", {
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ? | [inferred] |\n",
      "src/app.ts": "export {};\n",
    });
    const mapPath = path.join(d, "ai", "guide", "MODULE_MAP.md");
    const before = await fs.readFile(mapPath, "utf8");
    const newText = before.replace("| ? | [inferred] |", "| ours | [verified] (03/07/2026 09:05) |");
    const { bkpPath } = await writeAuditedMap(mapPath, before, newText);
    ok(await exists(bkpPath) && /MODULE_MAP_bkp_\d{8}_\d{6}\.md$/.test(bkpPath),
      `writeAuditedMap leaves a timestamped MODULE_MAP_bkp_*.md backup`);
    ok((await fs.readFile(bkpPath, "utf8")) === before, `the backup preserves the pre-audit content byte-for-byte`);
    ok((await fs.readFile(mapPath, "utf8")) === newText, `writeAuditedMap writes the new content to MODULE_MAP.md`);
    await fs.rm(d, { recursive: true, force: true });
  }
}

// ---------- demo: zero-risk playground run ----------
console.log("\n— demo —");
{
  const osTmpdir = os.tmpdir();
  const kitProfilePath = path.join(kitRoot, "ai", "repo-profile.json");
  const kitProfileBefore = await fs.readFile(kitProfilePath, "utf8").catch(() => null);

  function parseCreatedDir(out) {
    const m = out.match(/Demo repo created:\s*(\S+)/);
    return m ? m[1] : null;
  }

  // first run: writes only under os.tmpdir(), with the expected files
  const r1 = run(process.execPath, [path.join(kitRoot, "install.mjs"), "demo"]);
  ok(r1.code === 0, `demo exits 0`);
  const dir1 = parseCreatedDir(r1.out);
  ok(Boolean(dir1), `demo prints the created temp dir path`);
  ok(Boolean(dir1) && path.resolve(dir1).startsWith(path.resolve(osTmpdir)),
    `demo dir is under the OS temp dir: ${dir1}`);
  if (dir1) {
    ok(await exists(path.join(dir1, "ai", "repo-profile.json")), `demo dir has ai/repo-profile.json`);
    ok(await exists(path.join(dir1, "CLAUDE.md")), `demo dir has a stamped CLAUDE.md`);
    ok(await exists(path.join(dir1, "ai", "install-manifest.json")), `demo dir has ai/install-manifest.json`);
  }
  ok(/cold-start/.test(r1.out), `demo prints the suggested next step (/cold-start)`);
  ok(/rm -rf/.test(r1.out), `demo prints how to delete the temp dir`);

  // the kit's own repo is untouched
  const kitProfileAfter = await fs.readFile(kitProfilePath, "utf8").catch(() => null);
  ok(kitProfileAfter === kitProfileBefore, `demo leaves the kit's own ai/repo-profile.json untouched`);

  // second run creates an independent directory
  const r2 = run(process.execPath, [path.join(kitRoot, "install.mjs"), "demo"]);
  ok(r2.code === 0, `second demo run exits 0`);
  const dir2 = parseCreatedDir(r2.out);
  ok(Boolean(dir2) && dir2 !== dir1, `running demo twice creates two independent directories`);

  for (const d of [dir1, dir2]) {
    if (d) await fs.rm(d, { recursive: true, force: true });
  }

  // missing example: a clear, actionable error — not a stack trace
  {
    const exampleAbs = path.join(kitRoot, "examples", "legacy-calculator");
    const movedAbs = path.join(kitRoot, "examples", "legacy-calculator__test-moved-aside");
    await fs.rename(exampleAbs, movedAbs);
    try {
      const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "demo"]);
      ok(r.code !== 0 && /Demo example not found/.test(r.out) && !/at file:/.test(r.out),
        `demo fails with a clear message (no stack trace) when the example is missing`);
    } finally {
      await fs.rename(movedAbs, exampleAbs);
    }
  }
}

// ---------- npm pack: examples/legacy-calculator/ must ship (the demo packaging trap) ----------
console.log("\n— npm pack (demo packaging) —");
{
  const rr = spawnSync("npm", ["pack", "--dry-run"], { encoding: "utf8", cwd: kitRoot });
  const packOut = (rr.stdout || "") + (rr.stderr || "");
  ok(rr.status === 0 && /examples\/legacy-calculator\/calculator\.js/.test(packOut),
    `npm pack --dry-run lists examples/legacy-calculator/ (the files[] packaging fix)`);
}

// ---------- unit tests: destinationFor ----------
{
  console.log("\n— destinationFor unit tests —");
  const { destinationFor } = await import(pathToFileURL(path.join(kitRoot, "lib", "installer.mjs")).href);
  ok(destinationFor(path.join("claude", "commands", "cold-start.md")) ===
    path.join(".claude", "commands", "cold-start.md"),
    `claude/ → .claude/ mapping`);
  ok(destinationFor(path.join("github", "workflows", "ai-check.yml.tmpl")) ===
    path.join(".github", "workflows", "ai-check.yml"),
    `github/ → .github/ mapping with .tmpl strip`);
  ok(destinationFor(path.join("github", "workflows", "ai-check.yml")) ===
    path.join(".github", "workflows", "ai-check.yml"),
    `github/ → .github/ mapping without .tmpl`);
  ok(destinationFor(path.join("github", "prompts", "cold-start.prompt.md")) ===
    path.join(".github", "prompts", "cold-start.prompt.md"),
    `github/prompts/ → .github/prompts/ mapping (Copilot)`);
  ok(destinationFor(path.join("agents", "workflows", "cold-start.md")) ===
    path.join(".agents", "workflows", "cold-start.md"),
    `agents/ → .agents/ mapping (Antigravity)`);
  ok(destinationFor(path.join("agents", "skills", "add-feature", "SKILL.md")) ===
    path.join(".agents", "skills", "add-feature", "SKILL.md"),
    `agents/skills/ → .agents/skills/ mapping (Antigravity)`);
  ok(destinationFor(path.join("cursor", "rules", "cold-start.mdc")) ===
    path.join(".cursor", "rules", "cold-start.mdc"),
    `cursor/rules/ → .cursor/rules/ mapping (Cursor)`);
  ok(destinationFor(path.join("ai", "INDEX.md.tmpl")) ===
    path.join("ai", "INDEX.md"),
    `non-prefixed .tmpl strip`);
  ok(destinationFor(path.join("AGENTS.md.tmpl")) === "AGENTS.md",
    `root-level .tmpl strip`);
  ok(destinationFor("README.md") === "README.md",
    `plain file passthrough`);
}

// ---------- unit tests: classifyAction (the re-run three-way compare) ----------
// The E2E suite cannot reach the "update" outcome — it needs a template that
// changed BETWEEN kit versions (disk == recorded hash != fresh stamp), i.e. the
// upgrade path — so the classification matrix is pinned down directly here.
{
  console.log("\n— classifyAction unit tests —");
  const { classifyAction, VERIFIED_TAG } =
    await import(pathToFileURL(path.join(kitRoot, "lib", "installer.mjs")).href);
  const { sha256 } = await import(pathToFileURL(path.join(kitRoot, "lib", "util.mjs")).href);
  const tmpl = "# doc\nrow one\n";
  const newTmpl = "# doc\nrow one\nrow two (new in this kit version)\n";
  const edited = "# doc\nrow one\nhuman note\n";
  const audited = `# doc\nrow one ${VERIFIED_TAG} (01/07/2026)\n`;
  const base = { newText: newTmpl, force: false, forceVerified: false };
  ok(classifyAction({ ...base, diskText: null, recordedHash: undefined }) === "new",
    `missing file → "new"`);
  ok(classifyAction({ ...base, diskText: newTmpl, recordedHash: sha256(tmpl) }) === "up-to-date",
    `disk equals the fresh template → "up-to-date"`);
  ok(classifyAction({ ...base, diskText: tmpl, recordedHash: sha256(tmpl) }) === "update",
    `kit-owned file + newer template → "update" (the upgrade path)`);
  ok(classifyAction({ ...base, diskText: edited, recordedHash: sha256(tmpl) }) === "keep",
    `edited file without --force → "keep"`);
  ok(classifyAction({ ...base, diskText: edited, recordedHash: undefined }) === "keep",
    `edited file under a pre-hash (old-format) manifest → "keep"`);
  ok(classifyAction({ ...base, diskText: edited, recordedHash: sha256(tmpl), force: true }) === "overwrite",
    `edited file with --force → "overwrite"`);
  ok(classifyAction({ ...base, diskText: audited, recordedHash: sha256(tmpl), force: true }) === "locked",
    `${VERIFIED_TAG} file stays "locked" even under --force (child-lock)`);
  ok(classifyAction({ ...base, diskText: audited, recordedHash: sha256(tmpl),
    force: true, forceVerified: true }) === "overwrite-verified",
    `${VERIFIED_TAG} file with --force-verified → "overwrite-verified"`);
  ok(classifyAction({ ...base, newText: audited, diskText: audited, recordedHash: undefined }) === "up-to-date",
    `a template's own ${VERIFIED_TAG} prose does not trigger the lock when disk matches`);
}

// ---------- unit tests: detectBranch (intake wizard branch safety) ----------
{
  console.log("\n— detectBranch unit tests —");
  const { detectBranch } = await import(pathToFileURL(path.join(kitRoot, "lib", "intake.mjs")).href);
  const broot = path.join(here, `tmp-branch-${process.pid}`);
  await fs.mkdir(path.join(broot, ".git"), { recursive: true });
  await fs.writeFile(path.join(broot, ".git", "HEAD"), "ref: refs/heads/feature/x\n");
  let b = await detectBranch(broot);
  ok(b.versionControlled === true && b.name === "feature/x",
    `normal checkout → branch name read from .git/HEAD`);
  await fs.writeFile(path.join(broot, ".git", "HEAD"),
    "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678\n");
  b = await detectBranch(broot);
  ok(b.versionControlled === true && b.name === "(detached HEAD)", `detached HEAD detected`);
  await fs.rm(path.join(broot, ".git"), { recursive: true, force: true });
  b = await detectBranch(broot);
  ok(b.versionControlled === false && b.name === null, `no .git → not version controlled`);
  await fs.rm(broot, { recursive: true, force: true });
}

// ---------- release-check: the deterministic release gate ----------
// Fixture scenarios pin the failure modes from SPEC_release-check.md (criteria
// 2–4); the final scenario runs the gate against the kit repo itself so any
// real version/changelog/CLI-docs drift fails CI immediately.
{
  console.log("\n— release-check (release gate) —");
  const gate = path.join(kitRoot, "test", "release-check.mjs");
  // Fixture scenarios must control tag-vs-pre-tag mode purely via --tag: strip
  // GITHUB_REF so a real v* tag push (which sets it for this whole CI job)
  // can't silently force tag mode onto a fixture that's testing pre-tag mode.
  const gateEnv = { ...process.env };
  delete gateEnv.GITHUB_REF;
  const runGate = (dir, ...extra) => {
    const r = spawnSync(process.execPath, [gate, dir, ...extra], { encoding: "utf8", env: gateEnv });
    return { code: r.status, out: (r.stdout || "") + (r.stderr || ""), error: r.error };
  };

  // criterion 2: one desynchronized version source → exit 1 naming the file
  {
    const dir = await makeBareFixture("relcheck-desync", {
      "package.json": JSON.stringify({ name: "fx", version: "9.9.9" }),
      "lib/util.mjs": `export const KIT_VERSION = "1.0.0";\n`,
      "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n- pending\n",
    });
    const r = runGate(dir);
    ok(r.code === 1 && r.out.includes("lib/util.mjs") && r.out.includes("1.0.0"),
      `version desync → exit 1 naming the out-of-sync file`);
    await fs.rm(dir, { recursive: true, force: true });
  }

  // pre-tag mode: versions in sync + [Unreleased] present (no dated section yet) → green
  {
    const dir = await makeBareFixture("relcheck-ok", {
      "package.json": JSON.stringify({ name: "fx", version: "9.9.9" }),
      "lib/util.mjs": `export const KIT_VERSION = "9.9.9";\n`,
      "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n\n- pending\n",
    });
    const r = runGate(dir);
    ok(r.code === 0 && r.out.includes("[Unreleased] exists"),
      `pre-tag mode passes on synced versions with only an [Unreleased] section`);
    // criterion 4: tag mode with no dated ## [9.9.9] section → exit 1
    const rt = runGate(dir, "--tag", "v9.9.9");
    ok(rt.code === 1 && rt.out.includes("required at tag time"),
      `tag mode without a dated ## [9.9.9] section → exit 1`);
    // tag mode fully release-ready → green (dated section, link ref, [Unreleased] emptied)
    await fs.writeFile(path.join(dir, "CHANGELOG.md"),
      "# Changelog\n\n## [Unreleased]\n\n## [9.9.9] — 2026-07-03\n\n- shipped\n\n" +
      "[9.9.9]: https://example.com/releases/tag/v9.9.9\n");
    const rr = runGate(dir, "--tag", "v9.9.9");
    ok(rr.code === 0, `tag mode passes once the section is dated, linked, and [Unreleased] is empty`);
    await fs.rm(dir, { recursive: true, force: true });
  }

  // criterion 3: a CLI token missing from docs/CLI-REFERENCE.md → exit 1 naming it
  {
    const dir = await makeBareFixture("relcheck-clidocs", {
      "package.json": JSON.stringify({ name: "fx", version: "9.9.9" }),
      "CHANGELOG.md": "# Changelog\n\n## [Unreleased]\n",
      "install.mjs":
        `const COMMANDS = new Set(["orient", "frobnicate"]);\n` +
        `console.log("Usage: orient | frobnicate [--dry-run]");\n`,
      "docs/CLI-REFERENCE.md": "# CLI\n\n`orient` — detect stack. Options: `--dry-run`.\n",
    });
    const r = runGate(dir);
    ok(r.code === 1 && r.out.includes("frobnicate"),
      `command missing from docs/CLI-REFERENCE.md → exit 1 naming the token`);
    await fs.rm(dir, { recursive: true, force: true });
  }

  // the kit repo itself must pass its own gate (pre-tag mode)
  {
    const r = runGate(kitRoot);
    ok(r.code === 0, `the kit repo passes its own release gate (pre-tag mode)`);
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
