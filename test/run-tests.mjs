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

  // ---------- indepth: repo-health warnings & recommendations ----------
  // Each heuristic in lib/indepth.mjs is a one-line `if` guarding a warning or
  // recommendation push; the "gaps" fixture trips every guard, "clean" trips none.
  {
    const gaps = await makeBareFixture(`${label}-health-gaps`, {
      "package.json": "{}\n",
      ".git/config": "",
      "app.ts": "export const x = 1;\n",
      ".env": "SECRET=1\n",
      "test/app.test.ts": "test('x', () => {});\n",
    });
    r = run(exec, [script, "indepth", gaps]);
    const gapsResult = JSON.parse(await fs.readFile(path.join(gaps, "ai", "repo-indepth.json"), "utf8"));
    ok(gapsResult.warnings.some(w => w.category === "gitignore"),
      `indepth flags a missing .gitignore`);
    ok(gapsResult.warnings.some(w => w.category === "license"),
      `indepth flags a missing LICENSE`);
    ok(gapsResult.warnings.some(w => w.category === "config" && /\.env\.example/.test(w.message)),
      `indepth flags a missing .env.example when .env is present`);
    ok(gapsResult.recommendations.some(rec => rec.area === "Configuration" && /\.env\.example/.test(rec.suggestion)),
      `indepth recommends creating .env.example`);
    ok(gapsResult.recommendations.some(rec => rec.area === "Documentation" && /ARCHITECTURE\.md/.test(rec.suggestion)),
      `indepth recommends an ARCHITECTURE.md when none exists`);
    ok(gapsResult.recommendations.some(rec => rec.area === "Configuration" && /linting/.test(rec.suggestion)),
      `indepth recommends linter/formatter configuration when none exists`);
    await fs.rm(gaps, { recursive: true, force: true });

    const clean = await makeBareFixture(`${label}-health-clean`, {
      "package.json": "{}\n",
      ".git/config": "",
      "app.ts": "export const x = 1;\n",
      ".gitignore": "node_modules/\n",
      ".env": "SECRET=1\n",
      ".env.example": "SECRET=\n",
      "LICENSE": "MIT\n",
      "ARCHITECTURE.md": "# Architecture\n",
      ".eslintrc.json": "{}\n",
      "test/app.test.ts": "test('x', () => {});\n",
    });
    r = run(exec, [script, "indepth", clean]);
    const cleanResult = JSON.parse(await fs.readFile(path.join(clean, "ai", "repo-indepth.json"), "utf8"));
    ok(!cleanResult.warnings.some(w => w.category === "gitignore"),
      `indepth does not flag .gitignore when it's present`);
    ok(!cleanResult.warnings.some(w => w.category === "license"),
      `indepth does not flag LICENSE when it's present`);
    ok(!cleanResult.warnings.some(w => w.category === "config"),
      `indepth does not flag .env.example when it's already present`);
    ok(!cleanResult.recommendations.some(rec => /ARCHITECTURE\.md/.test(rec.suggestion)),
      `indepth does not recommend ARCHITECTURE.md when one exists`);
    ok(!cleanResult.recommendations.some(rec => /linting/.test(rec.suggestion)),
      `indepth does not recommend linter config when one exists`);
    await fs.rm(clean, { recursive: true, force: true });
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
    path.join("ai", "lab", "WORKLOG.md"),
    path.join("ai", "lab", "ROADMAP.md"),
    path.join("ai", "lab", "reviews", "REVIEW_TEMPLATE.md"),
    path.join("ai", "lab", "specs", "BUGFIX_TEMPLATE.md"),
    path.join(".claude", "skills", "cold-start", "SKILL.md"),
    path.join(".claude", "skills", "check-drift", "SKILL.md"),
    path.join(".claude", "skills", "adversarial-audit", "SKILL.md"),
    path.join(".claude", "skills", "verify-ai-readiness", "SKILL.md"),
    path.join(".claude", "skills", "review-change", "SKILL.md"),
    path.join(".claude", "agents", "repo-explorer.md"),
    path.join(".claude", "skills", "add-feature", "SKILL.md"),
    path.join(".claude", "skills", "fix-bug", "SKILL.md"),
    path.join(".github", "workflows", "ai-check.yml"),
    path.join(".github", "copilot-instructions.md"),
    path.join(".github", "prompts", "cold-start.prompt.md"),
    path.join(".github", "prompts", "check-drift.prompt.md"),
    path.join(".github", "prompts", "adversarial-audit.prompt.md"),
    path.join(".github", "chatmodes", "repo-explorer.chatmode.md"),
    path.join(".github", "chatmodes", "feature-builder.chatmode.md"),
    path.join(".github", "chatmodes", "test-runner.chatmode.md"),
    path.join(".github", "prompts", "fix-bug.prompt.md"),
    path.join(".github", "prompts", "review-change.prompt.md"),
    path.join(".agents", "workflows", "cold-start.md"),
    path.join(".agents", "workflows", "add-feature.md"),
    path.join(".agents", "workflows", "adversarial-audit.md"),
    path.join(".agents", "workflows", "fix-bug.md"),
    path.join(".agents", "workflows", "review-change.md"),
    path.join(".agents", "skills", "add-feature", "SKILL.md"),
    path.join(".agents", "skills", "fix-bug", "SKILL.md"),
    path.join(".cursor", "rules", "cold-start.mdc"),
    path.join(".cursor", "rules", "add-feature.mdc"),
    path.join(".cursor", "rules", "adversarial-audit.mdc"),
    path.join(".cursor", "rules", "fix-bug.mdc"),
    path.join(".cursor", "rules", "review-change.mdc"),
    path.join(".cursor", "rules", "ai-knowledge-layer.mdc"),
    path.join(".claude", "rules", "ai-knowledge-layer.md"),
    path.join(".claude", "rules", "provenance.md"),
    path.join("ai", "START-HERE.html"),
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
  const claudeAlwaysRule = await fs.readFile(path.join(repo, ".claude", "rules", "ai-knowledge-layer.md"), "utf8");
  ok(!/^---[\s\S]*?paths:/.test(claudeAlwaysRule),
    `.claude/rules/ai-knowledge-layer.md has no paths: frontmatter (always-on)`);
  ok(claudeAlwaysRule.includes("ai/INDEX.md") && /\[inferred\]/.test(claudeAlwaysRule)
    && /\[verified\]/.test(claudeAlwaysRule) && claudeAlwaysRule.includes("ai/lab/WORKLOG.md"),
    `the Claude always-on rule points at ai/INDEX.md and states the provenance + record rules`);
  const claudePathRule = await fs.readFile(path.join(repo, ".claude", "rules", "provenance.md"), "utf8");
  ok(/^---\n[\s\S]*?paths:[\s\S]*?ai\/\*\*[\s\S]*?---/.test(claudePathRule),
    `.claude/rules/provenance.md is path-scoped to ai/** via paths: frontmatter`);
  ok(/\[inferred\]/.test(claudePathRule) && /\[verified\]/.test(claudePathRule),
    `the path-scoped guard states the provenance rule for ai/ writes`);

  // ---------- ai/START-HERE.html: the living progress page ----------
  const progressPath = path.join(repo, "ai", "START-HERE.html");
  const progressHtml = await fs.readFile(progressPath, "utf8");
  ok(progressHtml.startsWith("<!-- Copyright") && progressHtml.includes("<!doctype html>") &&
    progressHtml.trim().endsWith("</html>"), `ai/START-HERE.html is a complete HTML document`);
  ok(!progressHtml.includes("{{") && !/https?:\/\//i.test(progressHtml),
    `ai/START-HERE.html has no unresolved placeholders and zero external requests`);
  ok(progressHtml.includes(`${label}-saas`), `ai/START-HERE.html is stamped with the project name`);
  const progressDataMatch = progressHtml.match(/<script id="progress-data"[^>]*>([\s\S]*?)<\/script>/);
  ok(Boolean(progressDataMatch), `ai/START-HERE.html carries a progress-data script block`);
  const progressDataAfterInstall = progressDataMatch ? JSON.parse(progressDataMatch[1]) : null;
  ok(progressDataAfterInstall && typeof progressDataAfterInstall.doctorStep === "number",
    `install() already refreshed the progress page with live data (not the bootstrap placeholder)`);
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
  // `verify` reruns refreshProgressPage — confirm the page reflects the fresh,
  // all-claims-confirmed state (the state changed since the install()-time refresh).
  {
    const html = await fs.readFile(progressPath, "utf8");
    const m = html.match(/<script id="progress-data"[^>]*>([\s\S]*?)<\/script>/);
    const data = m ? JSON.parse(m[1]) : null;
    ok(data && data.brokenClaims === 0,
      `verify's refresh updates the progress page's brokenClaims to 0: ${JSON.stringify(data)}`);
  }
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
  // regression: ai/START-HERE.html's content legitimately changes on every
  // verify/drift/install run (refreshProgressPage) — --force must never treat
  // that as a human edit and leave a pointless timestamped backup behind.
  ok(!(await fs.readdir(path.join(repo, "ai"))).some(n => /^START-HERE_bkp_/.test(n)),
    `--force never backs up ai/START-HERE.html (it's a live dashboard, not human prose)`);

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
  ok(!(await exists(progressPath)), `uninstall removed ai/START-HERE.html (the progress page)`);
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

  // the work ledger is a claim source: a row whose artifacts vanished fails --strict
  {
    const lrepo = await makeBareFixture(`${label}-verify-worklog`, {
      "app.ts": "export {};\n",
      "ai/guide/MODULE_MAP.md": "# map\nEntry point `app.ts`.\n",
      "ai/lab/specs/SPEC_x.md": "# SPEC: x\n",
      "ai/lab/WORKLOG.md": "# Work ledger\n\n| ID | Spec | Status |\n|---|---|---|\n" +
        "| W-001 | `ai/lab/specs/SPEC_x.md` | shipped |\n",
    });
    r = run(exec, [script, "verify", lrepo, "--strict"]);
    ok(r.code === 0, `verify --strict passes while every WORKLOG artifact link resolves`);
    await fs.appendFile(path.join(lrepo, "ai", "lab", "WORKLOG.md"),
      "| W-002 | `ai/lab/specs/SPEC_vanished.md` | in-review |\n");
    r = run(exec, [script, "verify", lrepo, "--strict"]);
    let lm = { sourcesScanned: [], claims: [] };
    try {
      lm = JSON.parse(await fs.readFile(path.join(lrepo, "ai", "analysis",
        "audit-reports", "VERIFICATION_MANIFEST.json"), "utf8"));
    } catch { /* missing manifest — caught by the assertion */ }
    ok(r.code !== 0 && lm.sourcesScanned.includes("ai/lab/WORKLOG.md") &&
      lm.claims.some(c => c.claim === "ai/lab/specs/SPEC_vanished.md" &&
        c.status === "missing" && c.sourceFile === "ai/lab/WORKLOG.md"),
      `a WORKLOG row whose spec vanished fails verify --strict, attributed to the ledger`);
    await fs.rm(lrepo, { recursive: true, force: true });
  }

  // regression: a backticked API/method reference shaped like name.ext
  // (`util.inspect`, `array.map`) must NOT be treated as a filename claim — its
  // "extension" is not a real file extension — so it can never fail verify
  // --strict. Real filename claims alongside it are still checked and confirmed,
  // including supported marker/build filenames like `go.mod` / `*.sln` /
  // `*.csproj`.
  {
    const arepo = await makeBareFixture(`${label}-verify-api-ref`, {
      "app.ts": "export {};\n",
      "go.mod": "module example.com/m\n",
      "kit.sln": "Microsoft Visual Studio Solution File, Format Version 12.00\n",
      "App.csproj": "<Project/>\n",
      "ai/guide/MODULE_MAP.md":
        "# Module map\n\n" +
        "Formatting goes through `util.inspect` and `array.map`; the entries are `app.ts`, `go.mod`, `kit.sln`, and `App.csproj`.\n",
    });
    r = run(exec, [script, "verify", arepo, "--strict"]);
    let am = { claims: [] };
    try {
      am = JSON.parse(await fs.readFile(
        path.join(arepo, "ai", "analysis", "audit-reports", "VERIFICATION_MANIFEST.json"), "utf8"));
    } catch { /* missing manifest — caught by the assertion */ }
    const aClaims = am.claims.map(c => c.claim);
    ok(r.code === 0 && !aClaims.includes("util.inspect") && !aClaims.includes("array.map"),
      `API refs util.inspect / array.map are not path claims, so verify --strict passes: ${JSON.stringify(aClaims)}`);
    ok(["app.ts", "go.mod", "kit.sln", "App.csproj"].every(name =>
      am.claims.some(c => c.claim === name && c.status === "confirmed")),
    `real filename claims remain checked and confirmed alongside ignored API refs: ${JSON.stringify(am.claims)}`);
    await fs.rm(arepo, { recursive: true, force: true });
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

  // regression: a FILE placed in the Directory column of a small/flat repo must
  // NOT be reported "vanished" while it exists — drift must agree with verify
  // (which counts the same path as confirmed). Before the fix, isDir() on the
  // Directory column flagged every file-level row as vanished, contradicting
  // verify's "confirmed".
  {
    const fr = await makeBareFixture(`${label}-drift-file-in-dircol`, {
      "src/index.js": "module.exports = 1;\n",
      "ai/guide/MODULE_MAP.md":
        "# Module map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/index.js` | entry | `src/index.js` | ours | [verified] (01/07/2026) |\n",
    });
    r = run(exec, [script, "drift", fr]);
    let frm = { summary: {} };
    try {
      frm = JSON.parse(await fs.readFile(
        path.join(fr, "ai", "analysis", "audit-reports", "DRIFT_MANIFEST.json"), "utf8"));
    } catch { /* missing manifest — caught by the assertion */ }
    ok(r.code === 0 && frm.summary.vanished === 0,
      `an existing file in the Directory column is not "vanished": ${JSON.stringify(frm.summary)}`);
    const vr = run(exec, [script, "verify", fr, "--strict"]);
    ok(vr.code === 0,
      `verify --strict agrees the same file-in-Directory-column path exists (no verify/drift contradiction)`);
    await fs.rm(fr, { recursive: true, force: true });
  }

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

// ---------- install.mjs: additional CLI coverage ----------
console.log("\n— install.mjs: CLI edge cases —");
{
  const exec = process.execPath;
  const script = path.join(kitRoot, "install.mjs");

  // --version / -v
  {
    const { KIT_VERSION } = await import(pathToFileURL(path.join(kitRoot, "lib", "util.mjs")).href);
    let r = run(exec, [script, "--version"]);
    ok(r.code === 0 && r.out.trim() === KIT_VERSION, `--version prints ${KIT_VERSION} and exits 0`);
    r = run(exec, [script, "-v"]);
    ok(r.code === 0 && r.out.trim() === KIT_VERSION, `-v prints ${KIT_VERSION} and exits 0`);
  }

  // --analysis-level parsing
  {
    const d = await makeBareFixture("cli-analysis-level", { "package.json": "{}\n" });
    let r = run(exec, [script, "orient", d, "--analysis-level"]);
    ok(r.code !== 0 && /--analysis-level requires a value/.test(r.out),
      `--analysis-level with no value → non-zero exit`);
    r = run(exec, [script, "orient", d, "--analysis-level", "bogus"]);
    ok(r.code !== 0 && /must be 'general' or 'indepth'/.test(r.out),
      `--analysis-level bogus → non-zero exit naming the valid values`);
    r = run(exec, [script, "orient", d, "--analysis-level", "indepth"]);
    ok(r.code === 0 && await exists(path.join(d, "ai", "repo-indepth.json")),
      `orient --analysis-level indepth writes ai/repo-indepth.json`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // `orient --indepth` (shorthand for --analysis-level indepth)
  {
    const d = await makeBareFixture("cli-orient-indepth", { "package.json": "{}\n" });
    const r = run(exec, [script, "orient", d, "--indepth"]);
    ok(r.code === 0 && await exists(path.join(d, "ai", "repo-profile.json")) &&
      await exists(path.join(d, "ai", "repo-indepth.json")),
      `orient --indepth writes both repo-profile.json and repo-indepth.json`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // standalone `indepth` command: --dry-run writes nothing
  {
    const d = await makeBareFixture("cli-indepth-dryrun", { "package.json": "{}\n" });
    const r = run(exec, [script, "indepth", d, "--dry-run"]);
    ok(r.code === 0 && /repo-indepth\.json not written/.test(r.out),
      `indepth --dry-run reports nothing written`);
    ok(!(await exists(path.join(d, "ai", "repo-indepth.json"))) &&
      !(await exists(path.join(d, "ai", "repo-profile.json"))),
      `indepth --dry-run writes neither repo-profile.json nor repo-indepth.json`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // standalone `indepth` command: tolerates a corrupted repo-profile.json on disk
  {
    const d = await makeBareFixture("cli-indepth-corrupt-profile", {
      "package.json": "{}\n",
      "ai/repo-profile.json": "{ not valid json",
    });
    const r = run(exec, [script, "indepth", d]);
    ok(r.code === 0, `indepth tolerates a corrupted ai/repo-profile.json (falls back to a fresh orient)`);
    ok(await exists(path.join(d, "ai", "repo-indepth.json")),
      `indepth still writes ai/repo-indepth.json despite the corrupt profile`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // shazam --indepth also writes ai/repo-indepth.json
  {
    const d = await makeBareFixture("cli-shazam-indepth", { "package.json": "{}\n" });
    const r = run(exec, [script, "shazam", d, "--yes", "--indepth"]);
    ok(r.code === 0 && await exists(path.join(d, "ai", "repo-indepth.json")),
      `shazam --yes --indepth writes ai/repo-indepth.json`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // shazam's "Next steps" message is tailored when a prior wizard answered "None yet"
  {
    const d = await makeBareFixture("cli-shazam-none-yet", {
      "package.json": "{}\n",
      "ai/repo-profile.json": JSON.stringify({ languages: [], humanContext: { primaryTool: "None yet" } }),
    });
    const r = run(exec, [script, "shazam", d, "--yes"]);
    ok(r.code === 0 && /Pick an AI coding tool/.test(r.out),
      `shazam's next-steps text tells a "None yet" user to pick a tool first`);
    await fs.rm(d, { recursive: true, force: true });
  }
}

// the intake wizard must self-skip (return null) for automation, never hang on input.
{
  const { runFirstRunWizard } = await import(pathToFileURL(path.join(kitRoot, "lib", "intake.mjs")).href);
  const r = await runFirstRunWizard(here, { languages: [] }, { yes: true });
  ok(r === null, `intake wizard self-skips under --yes (no humanContext, no prompt)`);
}

// ---------- intake: wizard decision branches, driven by a scripted io ----------
// runFirstRunWizard's actual body (branch-safety warnings, Process 1 vs 2,
// the 4 stack shapes, the 2 exit(0) escape hatches) needs a real TTY under the
// production `choose()`/`confirm()`/`ask()` from util.mjs, so it was previously
// exercised only via the `--yes` self-skip above. Injecting a scripted `io` —
// same shape, canned answers — reaches every decision branch without a TTY.
console.log("\n— intake: wizard decision branches (scripted io) —");
{
  const { runFirstRunWizard } = await import(pathToFileURL(path.join(kitRoot, "lib", "intake.mjs")).href);

  function scriptedIo({ confirms = [], chooses = [], asks = [] } = {}) {
    let ci = 0, coi = 0, ai = 0;
    return {
      isInteractive: () => true,
      confirm: async () => {
        if (ci >= confirms.length) throw new Error("scriptedIo: unexpected extra confirm() call");
        return confirms[ci++];
      },
      choose: async (_q, options, _flags, defaultIndex) => {
        const scripted = chooses[coi++];
        return scripted !== undefined ? scripted : options[defaultIndex];
      },
      ask: async (_q, _flags, fallback) => {
        const scripted = asks[ai++];
        return scripted !== undefined ? scripted : fallback;
      },
    };
  }

  // Runs `fn`, capturing a process.exit(0) call as a normal return instead of
  // killing this whole coverage-instrumented test process.
  async function expectingExit(fn) {
    const origExit = process.exit;
    let exitCode;
    process.exit = (code) => { exitCode = code; throw new Error("__TEST_PROCESS_EXIT__"); };
    try {
      const value = await fn();
      return { exited: false, value };
    } catch (e) {
      if (e instanceof Error && e.message === "__TEST_PROCESS_EXIT__") return { exited: true, exitCode };
      throw e;
    } finally {
      process.exit = origExit;
    }
  }

  // 1 — non-git repo, decline "Proceed without version control?" → exit(0), no humanContext.
  {
    const d = await makeBareFixture("wizard-nogit-decline", { "app.ts": "export {};\n" });
    const io = scriptedIo({ confirms: [false] });
    const r = await expectingExit(() => runFirstRunWizard(d, { languages: [] }, {}, io));
    ok(r.exited && r.exitCode === 0,
      `non-git repo + declined risk → process.exit(0), no files written`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // 2 — non-git repo, accept risk, Process 1, "confirmed" stack shape, explicit tool.
  {
    const d = await makeBareFixture("wizard-nogit-accept", { "app.ts": "export {};\n" });
    const io = scriptedIo({
      confirms: [true],
      chooses: [undefined, undefined, "That's right — single stack", "Cursor"],
    });
    const ctx = await runFirstRunWizard(d, { languages: ["TypeScript"] }, {}, io);
    ok(ctx !== null && ctx.branch.versionControlled === false && ctx.branch.acknowledgedRisk === true,
      `non-git repo + accepted risk → humanContext records versionControlled=false, acknowledgedRisk=true`);
    ok(ctx.stack.kind === "single" && ctx.stack.source === "confirmed-detection",
      `stack shape "That's right" → kind=single, source=confirmed-detection`);
    ok(ctx.primaryTool === "Cursor", `primaryTool records the scripted choice: ${ctx.primaryTool}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // 3 — git repo on "main", decline "Continue on 'main' anyway?" → exit(0).
  {
    const d = await makeBareFixture("wizard-main-decline", { ".git/HEAD": "ref: refs/heads/main\n" });
    const io = scriptedIo({ confirms: [false] });
    const r = await expectingExit(() => runFirstRunWizard(d, { languages: [] }, {}, io));
    ok(r.exited && r.exitCode === 0, `default-branch repo + declined "continue anyway" → process.exit(0)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // 4 — git repo on "main", accept, Process 2 (existing AI config), decline backup → exit(0).
  {
    const d = await makeBareFixture("wizard-process2-decline", { ".git/HEAD": "ref: refs/heads/main\n" });
    const profile = {
      languages: [],
      maturity: { process: 2 },
      existingAIConfig: { claudeMd: { exists: true, hasKitFooter: false } },
    };
    const io = scriptedIo({ confirms: [true, false] });
    const r = await expectingExit(() => runFirstRunWizard(d, profile, {}, io));
    ok(r.exited && r.exitCode === 0, `Process 2 + declined "proceed with backup" → process.exit(0)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // 5 — git repo on "main", accept both, Process 2, "correct it" stack shape (ask), "Several of these" tool.
  {
    const d = await makeBareFixture("wizard-process2-accept", { ".git/HEAD": "ref: refs/heads/main\n" });
    const profile = {
      languages: ["Go"],
      maturity: { process: 2 },
      existingAIConfig: { agentsMd: { exists: true, hasKitFooter: false } },
    };
    const io = scriptedIo({
      confirms: [true, true],
      chooses: [undefined, undefined, "Single stack, but let me correct it", "Several of these"],
      asks: ["Go + Gin"],
    });
    const ctx = await runFirstRunWizard(d, profile, {}, io);
    ok(ctx !== null && ctx.branch.isDefaultBranch === true && ctx.branch.acknowledgedRisk === true,
      `Process 2 + accepted both confirms → humanContext recorded, isDefaultBranch=true`);
    ok(ctx.stack.kind === "single" && ctx.stack.description === "Go + Gin",
      `stack shape "correct it" → asks for and records a free-text description`);
    ok(ctx.primaryTool === "Several of these", `primaryTool records "Several of these"`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // 6 — git repo on a non-default branch: the branch-safety confirm is skipped
  // entirely (only Process 1/2 and stack/tool choices remain). "Split" stack shape.
  {
    const d = await makeBareFixture("wizard-feature-branch", { ".git/HEAD": "ref: refs/heads/feature-x\n" });
    const io = scriptedIo({
      confirms: [], // no branch-safety confirm on a non-default branch, no Process-2 confirm (Process 1)
      chooses: [undefined, undefined, "Split: separate frontend and backend", "None yet"],
      asks: ["React + TypeScript", "Django"],
    });
    const ctx = await runFirstRunWizard(d, { languages: ["Python"] }, {}, io);
    ok(ctx !== null && ctx.branch.name === "feature-x" && ctx.branch.isDefaultBranch === false
        && ctx.branch.acknowledgedRisk === true,
      `non-default branch → no confirm prompt, acknowledgedRisk stays true by default`);
    ok(ctx.stack.kind === "split" && ctx.stack.frontend === "React + TypeScript" && ctx.stack.backend === "Django",
      `stack shape "Split" → asks for and records frontend + backend separately`);
    ok(ctx.primaryTool === "None yet", `primaryTool records "None yet"`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // 7 — "Not sure / mixed" stack shape → kind=unknown, no free-text prompt.
  {
    const d = await makeBareFixture("wizard-unknown-stack", { "app.ts": "export {};\n" });
    const io = scriptedIo({
      confirms: [true],
      chooses: [undefined, undefined, "Not sure / mixed", "GitHub Copilot"],
    });
    const ctx = await runFirstRunWizard(d, { languages: [] }, {}, io);
    ok(ctx.stack.kind === "unknown", `stack shape "Not sure / mixed" → kind=unknown`);
    await fs.rm(d, { recursive: true, force: true });
  }
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

// ---------- indepth: walk() filesystem-error path ----------
// A directory that becomes unreadable mid-scan (permission denied, vanished,
// a broken mount) must degrade to a warning, not crash the whole analysis.
// The full `indepth` CLI never hits this branch in CI (fixtures are always
// readable, and running as root defeats chmod-based simulation anyway), so
// call walk() directly against a path that cannot be readdir'd for any user —
// nonexistent — which is portable across Linux/macOS/Windows and root/non-root.
console.log("\n— indepth: walk() filesystem-error path —");
{
  const { walk } = await import(pathToFileURL(path.join(kitRoot, "lib", "indepth.mjs")).href);
  const fixtureRoot = await makeBareFixture("walk-fs-error", { "README.md": "# fixture\n" });
  const missingDir = path.join(fixtureRoot, "does-not-exist");
  const filesInfo = [];
  const warnings = [];
  await walk(missingDir, fixtureRoot, [], filesInfo, warnings);
  ok(filesInfo.length === 0, `walk() on an unreaddir'able directory collects no files`);
  ok(warnings.some(w => w.category === "filesystem" && /Failed to read directory/.test(w.message)
      && /does-not-exist/.test(w.message)),
    `walk() reports a filesystem warning instead of throwing: ${JSON.stringify(warnings)}`);
  await fs.rm(fixtureRoot, { recursive: true, force: true });
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

// ---------- shazam: default-branch warning when the wizard is skipped ----------
console.log("\n— shazam branch guard —");
{
  const mkBranchRepo = async (name, headRef) => {
    const d = path.join(here, `tmp-${name}-${process.pid}`);
    await fs.rm(d, { recursive: true, force: true });
    await fs.mkdir(path.join(d, ".git"), { recursive: true });
    await fs.writeFile(path.join(d, ".git", "HEAD"), headRef + "\n");
    await fs.writeFile(path.join(d, "package.json"), "{\"name\":\"x\"}\n");
    return d;
  };
  const kit = path.join(kitRoot, "install.mjs");

  // On master with the wizard skipped via --yes, the install must warn LOUDLY —
  // never write 91 files onto the production branch silently (finding #2).
  const onMaster = await mkBranchRepo("branchguard-master", "ref: refs/heads/master");
  let r = run(process.execPath, [kit, "shazam", onMaster, "--yes"]);
  ok(r.code === 0 && /Installing onto 'master'/.test(r.out) && /ai-fication-setup/.test(r.out),
    `shazam --yes onto 'master' warns about installing on the default branch`);
  await fs.rm(onMaster, { recursive: true, force: true });

  // On a throwaway/feature branch, that warning must NOT fire.
  const onFeature = await mkBranchRepo("branchguard-feature", "ref: refs/heads/feature/x");
  r = run(process.execPath, [kit, "shazam", onFeature, "--yes"]);
  ok(r.code === 0 && !/production\/default branch/.test(r.out),
    `shazam --yes on a feature branch does not warn about the default branch`);
  await fs.rm(onFeature, { recursive: true, force: true });
}

// ---------- doctor: read-only workflow-stage detector ----------
console.log("\n— doctor —");
{
  const { diagnose } = await import(pathToFileURL(path.join(kitRoot, "lib", "doctor.mjs")).href);
  const { shellQuote } = await import(pathToFileURL(path.join(kitRoot, "lib", "util.mjs")).href);

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
    // Platform-aware quoting (Copilot PR review, PR #38): POSIX single-quotes,
    // Windows double-quotes — a fixed quote style breaks on the other platform.
    // Rendered relative to cwd, never absolute (PR #39/#41 — doctor output is
    // embedded into the committed ai/START-HERE.html).
    ok(result.action.includes(shellQuote(path.relative(process.cwd(), d))),
      `step 1 action quotes the target path (regression: spaces-safe)`);
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
    // regression (Copilot PR review): must point at the real `audit` command,
    // not the stale "once available" placeholder from before A1 shipped.
    ok(result.action.includes("install.mjs audit") && !/once available/.test(result.action),
      `step 3 action names the real audit command, not "once available": ${result.action}`);
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
    // regression (Copilot PR review): the action must be one shell-safe,
    // copy/paste-able command, with the target path quoted (spaces-safe) using
    // this platform's quoting convention (PR #38) — and the path must be
    // rendered RELATIVE to the caller's cwd, never absolute, because doctor
    // output is embedded into the committed ai/START-HERE.html (PR #39/#41).
    ok(!result.action.includes("(then)") && result.action.includes("&&") &&
      result.action.includes(shellQuote(path.relative(process.cwd(), d))),
      `step 4 action is a single copy/paste-safe command with the path quoted: ${result.action}`);
    ok(!result.action.includes(d),
      `step 4 action never embeds the absolute target path: ${result.action}`);
    ok(await treeHash(d) === before, `doctor never writes a file (step 4)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // Step 4 (regression, Copilot PR #41): manifests are machine-local
  // (gitignored), so a fresh clone with a COMMITTED drift report must not be
  // told "drift has never been run" — it ran, just not on this checkout.
  {
    const d = await makeBareFixture("doctor-step4-fresh-clone", {
      "ai/repo-profile.json": "{}\n",
      "ai/guide/MODULE_MAP.md":
        "# Module map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ours | [verified] (01/07/2026) |\n",
      "src/app.ts": "export {};\n",
      "ai/analysis/audit-reports/VERIFICATION_REPORT.md": "# Verification report\n",
      "ai/analysis/audit-reports/DRIFT_REPORT.md": "# Drift report\n",
    });
    const result = await diagnose(d);
    ok(result.step === 4 && !/never been run/.test(result.diagnosis) &&
      /not been run on this checkout/.test(result.diagnosis),
      `step 4 fresh clone: committed reports temper "never been run" to "not on this checkout": ${result.diagnosis}`);
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

  // Step 3 (regression): a cold-started 4-column map whose rows end in Stability
  // `?` with NO [inferred] tag, plus clean verify/drift manifests, must still be
  // "needs audit" (step 3) — never "trusted" (step 5). Guards the doctor/status
  // contradiction where doctor read an untagged draft as fully verified.
  {
    const d = await makeBareFixture("doctor-untagged-needs-audit", {
      "ai/repo-profile.json": "{}\n",
      "ai/guide/MODULE_MAP.md":
        "# Module map\n" +
        "| Directory | Responsibility | Entry point | Stability |\n" +
        "|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ? |\n",
      "src/app.ts": "export {};\n",
      "ai/analysis/audit-reports/VERIFICATION_MANIFEST.json":
        JSON.stringify({ summary: { confirmed: 1, moved: 0, missing: 0 } }),
      "ai/analysis/audit-reports/DRIFT_MANIFEST.json":
        JSON.stringify({ summary: { unmapped: 0, vanished: 0, stale: 0 } }),
    });
    const result = await diagnose(d);
    ok(result.step === 3 && /audit/.test(result.action),
      `untagged '?' rows + clean manifests → step 3 (needs audit), not step 5: got step ${result.step}`);
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
  const { MODULE_MAP_PLACEHOLDER: STATUS_MAP_PLACEHOLDER } = await import(pathToFileURL(path.join(kitRoot, "lib", "drift.mjs")).href);

  // DRIFTING: a broken claim, regardless of MODULE_MAP audit state.
  {
    const d = await makeBareFixture("status-drifting", {
      "ai/repo-profile.json": "{}\n",
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
      "ai/repo-profile.json": "{}\n",
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
      "ai/repo-profile.json": "{}\n",
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

  // NOT INSTALLED (C2): no ai/repo-profile.json at all — doctor stage 1, day
  // one. This used to be the scariest verdict (NEEDS AUDIT); now it's an
  // orientation nudge toward `shazam`.
  {
    const d = await makeBareFixture("status-no-map", { "app.ts": "export {};\n" });
    const result = await computeStatus(d);
    ok(result.verdict === "NOT INSTALLED" && result.hasModuleMap === false,
      `no profile, no map → NOT INSTALLED verdict (got ${result.verdict})`);
    ok(result.badge.color === "grey" && result.badge.message === "not installed",
      `NOT INSTALLED badge is grey: ${JSON.stringify(result.badge)}`);
    // regression (Copilot PR review): with no knowledge docs at all (so
    // computeVerification returns null), the printed line must not claim
    // "verify has never run" — that's not what null means here.
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "status", d]);
    ok(r.code === 0 && /no knowledge docs to check/.test(r.out) && !/verify has never run/.test(r.out),
      `status wording reflects "no knowledge docs", not "verify has never run": ${r.out}`);
    ok(/shazam/.test(r.out), `NOT INSTALLED prints a next step pointing to shazam: ${r.out}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // NOT MAPPED YET (C2): profile exists (kit installed) but MODULE_MAP.md is
  // absent — doctor stage 2.
  {
    const d = await makeBareFixture("status-not-mapped-yet-absent", {
      "ai/repo-profile.json": "{}\n",
      "app.ts": "export {};\n",
    });
    const result = await computeStatus(d);
    ok(result.verdict === "NOT MAPPED YET" && result.hasModuleMap === false,
      `profile present, map absent → NOT MAPPED YET verdict (got ${result.verdict})`);
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "status", d]);
    ok(r.code === 0 && /cold-start/.test(r.out) &&
      /expected at this stage — the map hasn't been drafted yet/.test(r.out),
      `NOT MAPPED YET prints the "expected at this stage" note and points to /cold-start: ${r.out}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // NOT MAPPED YET (C2): profile exists but MODULE_MAP.md is still the
  // scaffolded template placeholder.
  {
    const d = await makeBareFixture("status-not-mapped-yet-template", {
      "ai/repo-profile.json": "{}\n",
      "ai/guide/MODULE_MAP.md": `# map\n\n${STATUS_MAP_PLACEHOLDER}\n`,
      "app.ts": "export {};\n",
    });
    const result = await computeStatus(d);
    ok(result.verdict === "NOT MAPPED YET",
      `profile present, map still the scaffolded template → NOT MAPPED YET verdict (got ${result.verdict})`);
    ok(result.badge.color === "blue" && result.badge.message === "not mapped yet",
      `NOT MAPPED YET badge is blue: ${JSON.stringify(result.badge)}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // NEEDS AUDIT: every row [verified], but the audit is stale (> 90 days).
  {
    const d = await makeBareFixture("status-stale-audit", {
      "ai/repo-profile.json": "{}\n",
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
      "ai/repo-profile.json": "{}\n",
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
      await fs.mkdir(path.join(d, "ai"), { recursive: true });
      await fs.writeFile(path.join(d, "ai", "repo-profile.json"), "{}\n");
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
      "ai/repo-profile.json": "{}\n",
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
    audit, formatAuditTimestamp, targetDirFor, computeEvidence, rewriteRowLine,
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

  // ---- interactive loop, driven by a scripted io (no real TTY needed) ----
  // Mirrors the intake wizard's approach: audit()'s per-row confirm/choose
  // loop, --dry-run short-circuit, and --git anchor-move offer were previously
  // unreachable outside a real terminal. A scripted io reaches them directly.
  {
    function scriptedIo({ confirms = [], chooses = [] } = {}) {
      let ci = 0, coi = 0;
      return {
        isInteractive: () => true,
        confirm: async () => {
          if (ci >= confirms.length) throw new Error("scriptedIo: unexpected extra confirm() call");
          return confirms[ci++];
        },
        choose: async (_q, options, _flags, defaultIndex) => {
          const scripted = chooses[coi++];
          return scripted !== undefined ? scripted : options[defaultIndex];
        },
      };
    }
    const oneRowMap =
      "# map\n" +
      "| Directory | Responsibility | Entry point | Stability | Status |\n" +
      "|---|---|---|---|---|\n" +
      "| `src/` | core | `src/app.ts` | ours | [inferred] |\n";

    // interactive-but-nothing-to-audit early returns: no MODULE_MAP.md at all,
    // and a MODULE_MAP.md with a header but zero table rows.
    {
      const d = await makeBareFixture("audit-no-map", {});
      await audit(d, {}, scriptedIo()); // no confirms/chooses expected — must return before any prompt
      ok(true, `audit() with no ai/guide/MODULE_MAP.md returns without prompting`);
      await fs.rm(d, { recursive: true, force: true });
    }
    {
      const d = await makeBareFixture("audit-no-rows", {
        "ai/guide/MODULE_MAP.md": "# map\n\nPlaceholder — nothing scaffolded yet.\n",
      });
      await audit(d, {}, scriptedIo());
      ok(true, `audit() with a rowless MODULE_MAP.md returns without prompting`);
      await fs.rm(d, { recursive: true, force: true });
    }

    // a — decline "Audit this row now?" → row skipped, nothing written.
    {
      const d = await makeBareFixture("audit-decline-row", { "ai/guide/MODULE_MAP.md": oneRowMap, "src/app.ts": "export {};\n" });
      const before = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
      await audit(d, {}, scriptedIo({ confirms: [false] }));
      const after = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
      ok(after === before, `declining "Audit this row now?" leaves MODULE_MAP.md untouched`);
      const files = await fs.readdir(path.join(d, "ai", "guide"));
      ok(!files.some(f => /_bkp_/.test(f)), `declined row takes no backup`);
      await fs.rm(d, { recursive: true, force: true });
    }

    // b — confirm the row, then choose "skip (leave this row untouched)" → same outcome, different path.
    {
      const d = await makeBareFixture("audit-skip-stability", { "ai/guide/MODULE_MAP.md": oneRowMap, "src/app.ts": "export {};\n" });
      const before = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
      await audit(d, {}, scriptedIo({
        confirms: [true],
        chooses: ["skip (leave this row untouched)"],
      }));
      const after = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
      ok(after === before, `choosing the "skip" stability option leaves MODULE_MAP.md untouched`);
      await fs.rm(d, { recursive: true, force: true });
    }

    // c — confirm the row, pick a stability, then decline the "this is your signature" confirm.
    {
      const d = await makeBareFixture("audit-decline-signature", { "ai/guide/MODULE_MAP.md": oneRowMap, "src/app.ts": "export {};\n" });
      const before = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
      await audit(d, {}, scriptedIo({
        confirms: [true, false],
        chooses: ["stable"],
      }));
      const after = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
      ok(after === before, `declining the final "this is your signature" confirm leaves MODULE_MAP.md untouched`);
      await fs.rm(d, { recursive: true, force: true });
    }

    // d — full confirm → row flipped to [verified], backup taken, no --git so the
    // "update it yourself" info branch prints instead of offering the anchor move.
    {
      const mapWithAnchor =
        "# map\n> Last verified: 2026-01-01 @ commit abc1234\n\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `src/` | core | `src/app.ts` | ours | [inferred] |\n";
      const d = await makeBareFixture("audit-confirm-full", { "ai/guide/MODULE_MAP.md": mapWithAnchor, "src/app.ts": "export {};\n" });
      await audit(d, {}, scriptedIo({
        confirms: [true, true],
        chooses: ["frozen"],
      }));
      const after = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
      ok(/\| frozen \| \[verified\]/.test(after), `full confirm flips Stability=frozen, Status=[verified]: ${after.split("\n").find(l => l.includes("src/"))}`);
      ok(/Last verified: 2026-01-01 @ commit abc1234/.test(after), `no --git → the anchor line is left for the human to update themselves`);
      const files = await fs.readdir(path.join(d, "ai", "guide"));
      ok(files.some(f => /^MODULE_MAP_bkp_\d{8}_\d{6}\.md$/.test(f)), `full confirm takes a timestamped backup`);
      await fs.rm(d, { recursive: true, force: true });
    }

    // e — --dry-run: edits are computed but never written.
    {
      const d = await makeBareFixture("audit-dry-run", { "ai/guide/MODULE_MAP.md": oneRowMap, "src/app.ts": "export {};\n" });
      const before = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
      await audit(d, { dryRun: true }, scriptedIo({
        confirms: [true, true],
        chooses: ["ours"],
      }));
      const after = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
      ok(after === before, `--dry-run computes the edit but writes nothing`);
      const files = await fs.readdir(path.join(d, "ai", "guide"));
      ok(!files.some(f => /_bkp_/.test(f)), `--dry-run takes no backup`);
      await fs.rm(d, { recursive: true, force: true });
    }

    // f — --git: after a confirmed edit, accepting the anchor-move offer rewrites
    // the "Last verified" line to today @ HEAD's short sha (real, local git only).
    {
      const gitOk = run("git", ["--version"]).code === 0;
      if (!gitOk) {
        console.log("  — SKIPPED --git anchor-move (no git on PATH)");
      } else {
        const mapWithAnchor =
          "# map\n> Last verified: 2020-01-01 @ commit 0000000\n\n" +
          "| Directory | Responsibility | Entry point | Stability | Status |\n" +
          "|---|---|---|---|---|\n" +
          "| `src/` | core | `src/app.ts` | ours | [inferred] |\n";
        const d = await makeBareFixture("audit-git-anchor", { "ai/guide/MODULE_MAP.md": mapWithAnchor, "src/app.ts": "export {};\n" });
        const g = (...a) => run("git", ["-C", d, ...a]);
        g("init", "-q"); g("config", "user.email", "t@t.t"); g("config", "user.name", "t");
        g("config", "commit.gpgsign", "false");
        g("add", "-A"); g("commit", "--no-gpg-sign", "-qm", "init");
        const sha = run("git", ["-C", d, "rev-parse", "--short", "HEAD"]).out.trim();

        await audit(d, { git: true }, scriptedIo({
          confirms: [true, true, true], // audit row, sign the flip, move the anchor
          chooses: ["stable"],
        }));
        const after = await fs.readFile(path.join(d, "ai", "guide", "MODULE_MAP.md"), "utf8");
        ok(after.includes(`@ commit ${sha}`) && !after.includes("@ commit 0000000"),
          `--git + accepted anchor move rewrites "Last verified" to HEAD's short sha (${sha})`);
        await fs.rm(d, { recursive: true, force: true });
      }
    }
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

// ---------- progress: the living progress page ----------
console.log("\n— progress (ai/START-HERE.html) —");
{
  const { refreshProgressPage } = await import(pathToFileURL(path.join(kitRoot, "lib", "progress.mjs")).href);
  const bootstrapPage =
    "<!doctype html><html><body>" +
    '<script id="progress-data" type="application/json">' +
    '{"doctorStep":1,"rows":{"verified":0,"inferred":0,"unknown":0},"brokenClaims":null,"driftItems":null,"verdict":"NEEDS AUDIT"}' +
    "</script></body></html>";

  // refreshProgressPage populates real data over the bootstrap placeholder
  {
    const d = await makeBareFixture("progress-refresh", {
      "ai/START-HERE.html": bootstrapPage,
      "ai/repo-profile.json": "{}\n",
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `/` (root) | core | `app.ts` | ours | [verified] (01/07/2026) |\n",
      "app.ts": "export {};\n",
    });
    await refreshProgressPage(d);
    const html = await fs.readFile(path.join(d, "ai", "START-HERE.html"), "utf8");
    const m = html.match(/<script id="progress-data"[^>]*>([\s\S]*?)<\/script>/);
    const data = JSON.parse(m[1]);
    ok(data.rows.verified === 1 && data.rows.inferred === 0, `refreshProgressPage picks up MODULE_MAP row counts`);
    ok(data.verdict === "TRUSTED", `refreshProgressPage computes the same verdict status would: ${data.verdict}`);
    ok(html.startsWith("<!doctype html>"), `refreshProgressPage only rewrites the data block, not the shell`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // no-op when the page doesn't exist — never recreates it, never throws
  {
    const d = await makeBareFixture("progress-absent", {
      "ai/guide/MODULE_MAP.md": "# map\n",
    });
    let threw = false;
    try { await refreshProgressPage(d); } catch { threw = true; }
    ok(!threw, `refreshProgressPage does not throw when ai/START-HERE.html is absent`);
    ok(!(await exists(path.join(d, "ai", "START-HERE.html"))), `refreshProgressPage does not recreate a deleted page`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // no-op when the file exists but isn't a progress page we recognize (no data block)
  {
    const d = await makeBareFixture("progress-not-ours", {
      "ai/START-HERE.html": "<!doctype html><html><body>hand-written page</body></html>",
    });
    await refreshProgressPage(d);
    const html = await fs.readFile(path.join(d, "ai", "START-HERE.html"), "utf8");
    ok(html === "<!doctype html><html><body>hand-written page</body></html>",
      `refreshProgressPage leaves an unrecognized ai/START-HERE.html untouched`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // commands still work when the page is absent (user deleted it) — no crash
  {
    const d = await makeBareFixture("progress-cmds-no-page", {
      "ai/guide/MODULE_MAP.md":
        "# map\n" +
        "| Directory | Responsibility | Entry point | Stability | Status |\n" +
        "|---|---|---|---|---|\n" +
        "| `/` (root) | core | `app.ts` | ours | [verified] (01/07/2026) |\n",
      "app.ts": "export {};\n",
    });
    let r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "verify", d]);
    ok(r.code === 0, `verify still works with no ai/START-HERE.html present`);
    r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "drift", d]);
    ok(r.code === 0, `drift still works with no ai/START-HERE.html present`);
    r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "status", d]);
    ok(r.code === 0, `status still works with no ai/START-HERE.html present`);
    ok(!(await exists(path.join(d, "ai", "START-HERE.html"))),
      `none of verify/drift/status recreate ai/START-HERE.html on their own`);
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
  // shell: true is required on Windows — npm is a .cmd shim there, and
  // spawnSync can't resolve/execute it directly without a shell (the same
  // gotcha does not apply to node itself, which is why every other spawnSync
  // call in this file omits it).
  const rr = spawnSync("npm", ["pack", "--dry-run"], { encoding: "utf8", cwd: kitRoot, shell: true });
  const packOut = (rr.stdout || "") + (rr.stderr || "");
  ok(rr.status === 0 && /examples\/legacy-calculator\/calculator\.js/.test(packOut),
    `npm pack --dry-run lists examples/legacy-calculator/ (the files[] packaging fix): status=${rr.status} err=${(rr.stderr || "").slice(0, 200)}`);
}

// ---------- unit tests: destinationFor ----------
{
  console.log("\n— destinationFor unit tests —");
  const { destinationFor } = await import(pathToFileURL(path.join(kitRoot, "lib", "installer.mjs")).href);
  ok(destinationFor(path.join("claude", "skills", "cold-start", "SKILL.md")) ===
    path.join(".claude", "skills", "cold-start", "SKILL.md"),
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

// ---------- unit tests: reserveBackupPath collision handling ----------
{
  console.log("\n— reserveBackupPath unit tests —");
  const { backupName, reserveBackupPath } = await import(pathToFileURL(path.join(kitRoot, "lib", "util.mjs")).href);
  const uroot = await makeBareFixture("util-reserve-backup", {});
  const first = backupName("MODULE_MAP", ".md");
  ok(await reserveBackupPath(uroot, "MODULE_MAP", ".md") === first,
    `reserveBackupPath returns the plain backupName() when nothing collides`);
  await fs.writeFile(path.join(uroot, first), "already taken\n");
  const second = await reserveBackupPath(uroot, "MODULE_MAP", ".md");
  ok(second !== first && second === first.replace(/\.md$/, "_2.md"),
    `reserveBackupPath appends _2 when the plain name is already taken: ${second}`);
  await fs.writeFile(path.join(uroot, second), "also taken\n");
  const third = await reserveBackupPath(uroot, "MODULE_MAP", ".md");
  ok(third === first.replace(/\.md$/, "_3.md"),
    `reserveBackupPath keeps incrementing past a second collision: ${third}`);
  await fs.rm(uroot, { recursive: true, force: true });
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

// ---------- audit R3 regressions (ai/lab/specs/BUGFIX_audit-R3-fixes.md) ----------
console.log("\n— audit R3 regressions —");
{
  const script = path.join(kitRoot, "install.mjs");

  // AUD-R3-02 (unit): the templates' own [verified] prose must not trigger the
  // child-lock — only a [verified] line the human ADDED (absent from the
  // pristine template) is a signature worth locking.
  {
    const { classifyAction, VERIFIED_TAG } =
      await import(pathToFileURL(path.join(kitRoot, "lib", "installer.mjs")).href);
    const { sha256 } = await import(pathToFileURL(path.join(kitRoot, "lib", "util.mjs")).href);
    const tmpl = `# doc\nflip rows to ${VERIFIED_TAG} when audited\n`;
    const editedProseOnly = tmpl + "my human note\n";
    ok(classifyAction({ diskText: editedProseOnly, recordedHash: sha256(tmpl),
      newText: tmpl, force: true, forceVerified: false }) === "overwrite",
      `template ${VERIFIED_TAG} prose alone does not lock: edited file + --force → "overwrite"`);
    ok(classifyAction({ diskText: editedProseOnly, recordedHash: sha256(tmpl),
      newText: tmpl, force: false, forceVerified: false }) === "keep",
      `template ${VERIFIED_TAG} prose alone does not lock: edited file without --force → "keep"`);
    const humanAudited = tmpl + `| row | ours | ${VERIFIED_TAG} (01/07/2026) |\n`;
    ok(classifyAction({ diskText: humanAudited, recordedHash: sha256(tmpl),
      newText: tmpl, force: true, forceVerified: false }) === "locked",
      `a human-ADDED ${VERIFIED_TAG} line still locks under --force (child-lock kept)`);
    // Copilot PR #26 review: a CRLF disk file (Windows / editor conversion)
    // whose only [verified] lines are the template's own prose must NOT
    // false-lock — the comparison strips trailing \r on both sides.
    const crlfEditedProse = editedProseOnly.replace(/\n/g, "\r\n");
    ok(classifyAction({ diskText: crlfEditedProse, recordedHash: sha256(tmpl),
      newText: tmpl, force: true, forceVerified: false }) === "overwrite",
      `CRLF disk file with only template ${VERIFIED_TAG} prose → "overwrite", not false-locked`);
  }

  // Copilot PR #26 review: the Process-2 backup notice must say "Would back up"
  // under --dry-run (nothing is written), not "Will back up".
  {
    const d = await makeBareFixture("r3-drybackup", {
      "package.json": "{}\n",
      "CLAUDE.md": "# my own hand-written rules\n",
    });
    const r = run(process.execPath, [script, "install", d, "--dry-run", "--yes"]);
    ok(r.code === 0 && /Would back up CLAUDE\.md/.test(r.out) && !/Will back up/.test(r.out),
      `--dry-run says "Would back up", never "Will back up": ${(r.out.match(/(Would|Will) back up[^\n]*/) || ["<none>"])[0]}`);
    ok(!(await fs.readdir(d)).some(n => /_bkp_/.test(n)),
      `--dry-run backup notice writes no actual backup file`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // AUD-R3-02 (E2E): --force must be able to refresh an edited stamped
  // CLAUDE.md (whose template contains "[verified]" in its provenance prose),
  // taking a timestamped backup — the documented --force contract.
  {
    const d = await makeBareFixture("r3-forcelock", { "package.json": "{}\n" });
    let r = run(process.execPath, [script, "install", d, "--yes"]);
    ok(r.code === 0, `r3: baseline install exits 0`);
    await fs.appendFile(path.join(d, "CLAUDE.md"), "\nmy typo fix note\n");
    r = run(process.execPath, [script, "install", d, "--yes", "--force"]);
    const claude = await fs.readFile(path.join(d, "CLAUDE.md"), "utf8");
    ok(r.code === 0 && !claude.includes("my typo fix note"),
      `--force refreshes an edited stamped CLAUDE.md (template [verified] prose is not a signature)`);
    const rootFiles = await fs.readdir(d);
    const bkp = rootFiles.find(n => /^CLAUDE_bkp_\d{8}_\d{6}(_\d+)?\.md$/.test(n));
    ok(Boolean(bkp) && (await fs.readFile(path.join(d, bkp), "utf8")).includes("my typo fix note"),
      `the --force overwrite left a timestamped backup holding the edit`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // AUD-R3-03 (E2E): declining the install confirmation must leave the repo
  // byte-identical — no Process-2 backup may be written before consent.
  {
    const d = await makeBareFixture("r3-abort", {
      "package.json": "{}\n",
      "CLAUDE.md": "# my own hand-written rules\n",
    });
    const r = run(process.execPath, [script, "install", d]); // no --yes, stdin closed → abort
    const rootFiles = await fs.readdir(d);
    ok(!rootFiles.some(n => /_bkp_/.test(n)),
      `aborted install writes NO backup file (consent first): ${rootFiles.join(", ")}`);
    ok((await fs.readFile(path.join(d, "CLAUDE.md"), "utf8")) === "# my own hand-written rules\n" &&
      !(await exists(path.join(d, "ai", "install-manifest.json"))),
      `aborted install leaves the repo untouched (exit ${r.code})`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // AUD-R3-04 (E2E): re-running orient must carry humanContext forward, like install does.
  {
    const d = await makeBareFixture("r3-orient", {
      "package.json": "{}\n",
      "ai/repo-profile.json": JSON.stringify({
        humanContext: { primaryTool: "Claude Code" } }, null, 2) + "\n",
    });
    const r = run(process.execPath, [script, "orient", d]);
    let p = null;
    try { p = JSON.parse(await fs.readFile(path.join(d, "ai", "repo-profile.json"), "utf8")); }
    catch { /* caught by the assertion */ }
    ok(r.code === 0 && p?.humanContext?.primaryTool === "Claude Code",
      `orient re-run preserves humanContext (wizard answers survive)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // AUD-R3-06 (E2E): a .gitignore dir rule ("gen/") must not swallow a prefix
  // sibling ("genuine/") from the indepth analysis.
  {
    const d = await makeBareFixture("r3-gitignore", {
      "package.json": "{}\n",
      ".gitignore": "gen/\n",
      "gen/out.js": "// generated\n",
      "genuine/mod.js": "export const x = 1;\n",
    });
    const r = run(process.execPath, [script, "indepth", d]);
    let count = null;
    try {
      count = JSON.parse(await fs.readFile(path.join(d, "ai", "repo-indepth.json"), "utf8"))
        .codeStructure.codeMetrics.fileCount;
    } catch { /* caught by the assertion */ }
    ok(r.code === 0 && count === 3,
      `gitignore "gen/" excludes gen/ but not genuine/ (fileCount ${count}, want 3: package.json, .gitignore, genuine/mod.js)`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // AUD-R3-09 (E2E): Cargo [dev-dependencies] and Gemfile :development/:test
  // groups must be booked as development, not production.
  {
    const d = await makeBareFixture("r3-cargo-dev", {
      "Cargo.toml": "[package]\nname = \"x\"\n\n[dependencies]\nserde = \"1\"\n\n[dev-dependencies]\ncriterion = \"0.5\"\n",
    });
    const r = run(process.execPath, [script, "indepth", d]);
    let deps = null;
    try { deps = JSON.parse(await fs.readFile(path.join(d, "ai", "repo-indepth.json"), "utf8")).dependencies; }
    catch { /* caught by the assertion */ }
    ok(r.code === 0 && deps?.direct === 2 &&
      deps?.byCategory.production === 1 && deps?.byCategory.development === 1,
      `Cargo dev-dependencies booked as development (prod ${deps?.byCategory.production}, dev ${deps?.byCategory.development})`);
    await fs.rm(d, { recursive: true, force: true });
  }
  {
    const d = await makeBareFixture("r3-gem-dev", {
      "Gemfile": "source 'https://rubygems.org'\ngem 'rails'\n\ngroup :development do\n  gem 'rubocop'\nend\n",
    });
    const r = run(process.execPath, [script, "indepth", d]);
    let deps = null;
    try { deps = JSON.parse(await fs.readFile(path.join(d, "ai", "repo-indepth.json"), "utf8")).dependencies; }
    catch { /* caught by the assertion */ }
    ok(r.code === 0 && deps?.direct === 2 &&
      deps?.byCategory.production === 1 && deps?.byCategory.development === 1,
      `Gemfile :development group booked as development (prod ${deps?.byCategory.production}, dev ${deps?.byCategory.development})`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // AUD-R2-11 (unit): the anchor rewrite the guided audit offers after a --git run.
  {
    const { updateAnchorLine } =
      await import(pathToFileURL(path.join(kitRoot, "lib", "audit.mjs")).href);
    const map = "# map\n> Last verified: <fill in date> @ commit <fill in sha>\n| a | b | c |\n";
    const updated = updateAnchorLine ? updateAnchorLine(map, "2026-07-04", "abc1234") : null;
    ok(typeof updateAnchorLine === "function" &&
      updated !== null && updated.includes("> Last verified: 2026-07-04 @ commit abc1234") &&
      updated.split("\n").length === map.split("\n").length,
      `updateAnchorLine rewrites exactly the anchor line`);
    ok(typeof updateAnchorLine === "function" && updateAnchorLine("# no anchor here\n", "2026-07-04", "abc1234") === null,
      `updateAnchorLine returns null when the map has no anchor line`);
    // REVIEW_W-002 finding 1: an anchor whose parenthetical note spans
    // blockquote continuation lines must be replaced whole — never leaving
    // orphaned half-sentences and a dangling ")".
    const multiline = "# map\n" +
      "> Last verified: 2026-07-03 @ commit aaaaaaa (re-anchored: the fix\n" +
      "> commits (PR #22) touched `lib/` after the previous baseline —\n" +
      "> the per-row signatures below remain authoritative)\n" +
      "| a | b | c |\n";
    const u2 = updateAnchorLine ? updateAnchorLine(multiline, "2026-07-04", "abc1234") : null;
    ok(u2 !== null && u2.includes("> Last verified: 2026-07-04 @ commit abc1234") &&
      !u2.includes("signatures below") && !u2.includes("PR #22") && u2.includes("| a | b | c |"),
      `updateAnchorLine consumes a multi-line parenthetical anchor note whole`);
  }

  // ---------- update mode: shazam on an already-installed repo ----------

  // Unit: semver comparison and Keep-a-Changelog parsing (lib/update.mjs).
  {
    const { compareSemver, parseChangelog, changelogDigest } =
      await import(pathToFileURL(path.join(kitRoot, "lib", "update.mjs")).href);
    ok(compareSemver("0.1.0", "0.2.0") < 0 && compareSemver("0.2.0", "0.2.0") === 0 &&
      compareSemver("0.10.0", "0.9.9") > 0 && compareSemver(undefined, "0.1.0") < 0,
      `compareSemver orders versions numerically (0.10.0 > 0.9.9; unknown = oldest)`);
    // Copilot PR #34 review: the parse regex must be anchored — a pre-release
    // or four-part string must NOT pass as its x.y.z prefix.
    ok(compareSemver("1.2.3-beta", "0.0.1") < 0 && compareSemver("1.2.3.4", "0.0.1") < 0,
      `compareSemver treats "1.2.3-beta" / "1.2.3.4" as malformed (0.0.0), not as 1.2.3`);
    const changelog = [
      "# Changelog", "",
      "## [Unreleased]", "### Added", "- **Never shown** — unreleased work",
      "## [0.3.0] — 2099-01-01", "### Added",
      "- **MCP server** — serve the knowledge base over MCP",
      "  - nested bullet must not become a headline",
      "## [0.2.0] — 2026-07-03", "### Fixed", "- **A fix** — details here",
      "## [0.1.0] — 2026-06-25", "### Added", "- plain bullet with no dash separator",
    ].join("\n");
    const releases = parseChangelog(changelog);
    ok(releases.length === 3 && releases[0].version === "0.3.0" && releases[0].date === "2099-01-01",
      `parseChangelog keeps only released [x.y.z] sections (${releases.length} found)`);
    ok(releases[0].bullets.length === 1 && releases[0].bullets[0].headline === "MCP server" &&
      releases[0].bullets[0].category === "Added",
      `bullets: top-level only, bold+em-dash headline extraction, category tracked`);
    ok(releases[2].bullets[0].headline === "plain bullet with no dash separator",
      `bullets without an em-dash keep their full (trimmed) text`);
    const digest = changelogDigest(releases, "0.1.0", "0.3.0");
    ok(digest.length === 2 && digest[0].version === "0.2.0" && digest[1].version === "0.3.0",
      `changelogDigest: strictly-after-from, up-to-to, oldest first`);
    ok(changelogDigest(releases, "0.3.0", "0.3.0").length === 0,
      `changelogDigest: same version → empty digest`);
  }

  // Copilot PR #34 review: manifest paths are untrusted input — the loader must
  // drop anything that could steer a later pass outside the target directory.
  {
    const { isSafeManifestPath } =
      await import(pathToFileURL(path.join(kitRoot, "lib", "installer.mjs")).href);
    const bad = ["../evil.md", "ai/../../evil.md", "/etc/passwd", "C:whoops.md",
      "ai\\windows.md", "ai/\0nul.md", "ai//double.md", "./ai/dot.md", "", 42, null];
    const good = ["ai/INDEX.md", ".claude/skills/cold-start/SKILL.md", "ai/guide/MODULE_MAP.md"];
    ok(bad.every(p => !isSafeManifestPath(p)) && good.every(p => isSafeManifestPath(p)),
      `isSafeManifestPath rejects absolute/../NUL/backslash/empty-segment paths, keeps clean posix-relative ones`);
  }

  // Unit: the rename registry lookup, both branches.
  {
    const { renameTargetFor, RENAMES } =
      await import(pathToFileURL(path.join(kitRoot, "lib", "migrations.mjs")).href);
    ok(Array.isArray(RENAMES) && renameTargetFor("ai/never-existed.md") === null,
      `renameTargetFor returns null for unmapped paths (registry has ${RENAMES.length} entries)`);
    ok(RENAMES.length > 0 && renameTargetFor(RENAMES[0].from) === RENAMES[0].to,
      `renameTargetFor resolves a registered rename to its "to" path: ${RENAMES[0].from} -> ${RENAMES[0].to}`);
  }

  // E2E: fresh install seeds manifest v2; a version jump switches shazam to
  // update mode, prints the digest, and records history exactly once.
  {
    const { KIT_VERSION } = await import(pathToFileURL(path.join(kitRoot, "lib", "util.mjs")).href);
    const d = await makeBareFixture("update-mode", {
      "package.json": JSON.stringify({ name: "update-mode", version: "1.0.0" }) + "\n",
      "README.md": "# update-mode\n\nFixture for update-mode tests.\n",
    });
    const manifestPath = path.join(d, "ai", "install-manifest.json");
    const readManifest = async () => JSON.parse(await fs.readFile(manifestPath, "utf8"));

    let r = run(process.execPath, [script, "shazam", d, "--yes"]);
    let m = await readManifest();
    ok(r.code === 0 && m.kitVersion === KIT_VERSION && m.firstInstalled === m.installed &&
      Array.isArray(m.history) && m.history.length === 0,
      `fresh install writes manifest v2 (firstInstalled === installed, empty history)`);

    // Simulate a repo installed by kit v0.1.0 back in March.
    m.kitVersion = "0.1.0";
    m.installed = "2026-03-03T10:00:00.000Z";
    delete m.firstInstalled;
    delete m.history;
    await fs.writeFile(manifestPath, JSON.stringify(m, null, 2) + "\n");

    r = run(process.execPath, [script, "update", d, "--yes"]);
    m = await readManifest();
    ok(r.code === 0 && /update mode/.test(r.out) && r.out.includes(`v0.1.0 → v${KIT_VERSION}`),
      `update on an old install announces the version transition`);
    ok(/What changed since v0\.1\.0/.test(r.out) && /v0\.2\.0/.test(r.out),
      `update prints the CHANGELOG digest for the versions being jumped`);
    ok(/Preflight \(read-only\)/.test(r.out) && /Postflight/.test(r.out) && /no worse than preflight/.test(r.out),
      `update brackets the write with pre/postflight health snapshots`);
    ok(m.kitVersion === KIT_VERSION && m.firstInstalled === "2026-03-03T10:00:00.000Z" &&
      m.history.length === 1 && m.history[0].from === "0.1.0" && m.history[0].to === KIT_VERSION,
      `manifest records the jump: firstInstalled preserved (pre-v2 seed), history has the 0.1.0 → ${KIT_VERSION} row`);

    // Same-version re-run: no new history row, still succeeds.
    r = run(process.execPath, [script, "update", d, "--yes"]);
    m = await readManifest();
    ok(r.code === 0 && m.history.length === 1 && /already on v/.test(r.out),
      `same-version update repairs without appending history`);

    // Obsolete files: one kit-owned (hash matches), one edited. --yes must NOT delete.
    const crypto = await import("node:crypto");
    const ownedContent = "old template content\n";
    await fs.writeFile(path.join(d, "ai", "OLD_OWNED.md"), ownedContent);
    await fs.writeFile(path.join(d, "ai", "OLD_EDITED.md"), "the human changed this\n");
    m.files.push("ai/OLD_OWNED.md", "ai/OLD_EDITED.md", "ai/OLD_GONE.md");
    m.fileHashes["ai/OLD_OWNED.md"] = crypto.createHash("sha256").update(ownedContent, "utf8").digest("hex");
    m.fileHashes["ai/OLD_EDITED.md"] = "0".repeat(64); // recorded hash ≠ disk → edited
    m.fileHashes["ai/OLD_GONE.md"] = "1".repeat(64);   // in manifest, not on disk
    await fs.writeFile(manifestPath, JSON.stringify(m, null, 2) + "\n");

    r = run(process.execPath, [script, "shazam", d, "--yes"]);
    m = await readManifest();
    ok(r.code === 0 && /obsolete \(no longer shipped/.test(r.out) && /OLD_OWNED\.md/.test(r.out),
      `obsolete kit-owned file is reported in the plan`);
    ok(/deletion needs an interactive run/.test(r.out) && await exists(path.join(d, "ai", "OLD_OWNED.md")),
      `--yes does NOT delete obsolete files (interactive consent only)`);
    ok(/obsolete but EDITED — kept/.test(r.out) && await exists(path.join(d, "ai", "OLD_EDITED.md")),
      `obsolete edited file is kept and called out as edited`);
    ok(m.files.includes("ai/OLD_OWNED.md") && m.files.includes("ai/OLD_EDITED.md") &&
      !m.files.includes("ai/OLD_GONE.md") && !("ai/OLD_GONE.md" in m.fileHashes),
      `kept obsolete files stay tracked; already-deleted ones are dropped from the manifest`);

    // Copilot PR #34 review (E2E): a planted path-traversal manifest entry must
    // be scrubbed on load — never scanned, never listed, never rewritten.
    const outsideAbs = path.join(path.dirname(d), `OUTSIDE-${process.pid}.md`);
    await fs.writeFile(outsideAbs, "must never be touched\n");
    m.files.push("../" + path.basename(outsideAbs));
    m.fileHashes["../" + path.basename(outsideAbs)] = "2".repeat(64);
    await fs.writeFile(manifestPath, JSON.stringify(m, null, 2) + "\n");
    r = run(process.execPath, [script, "shazam", d, "--yes"]);
    m = await readManifest();
    ok(r.code === 0 && !r.out.includes("OUTSIDE-") &&
      !m.files.some(f => f.startsWith("../")) &&
      !Object.keys(m.fileHashes).some(f => f.startsWith("../")) &&
      await exists(outsideAbs),
      `"../" manifest entries are dropped on load and the outside file is untouched`);
    await fs.rm(outsideAbs, { force: true });

    // Downgrade guard: installed version newer than the running kit.
    m.kitVersion = "9.9.9";
    await fs.writeFile(manifestPath, JSON.stringify(m, null, 2) + "\n");
    r = run(process.execPath, [script, "update", d, "--yes"]);
    ok(r.code !== 0 && /Refusing to downgrade/.test(r.out),
      `update refuses a downgrade without --force`);
    r = run(process.execPath, [script, "update", d, "--yes", "--force"]);
    ok(r.code === 0, `--force overrides the downgrade guard (protections still apply)`);

    await fs.rm(d, { recursive: true, force: true });
  }

  // E2E: `update` on a repo with no manifest refuses with a pointer to shazam.
  {
    const d = await makeBareFixture("update-fresh", { "package.json": "{}\n" });
    const r = run(process.execPath, [script, "update", d, "--yes"]);
    ok(r.code !== 0 && /isn't installed here yet/.test(r.out) && /shazam/.test(r.out),
      `update on a never-installed repo refuses and points at shazam`);
    await fs.rm(d, { recursive: true, force: true });
  }
}

// ---------- C10: template & workflow alignment (SPEC_C10-template-alignment.md §6) ----------
console.log("\n— C10: template & workflow alignment —");
{
  const { parseModuleMap, MODULE_MAP_PLACEHOLDER } = await import(
    pathToFileURL(path.join(kitRoot, "lib", "drift.mjs")).href);

  // T1: a freshly stamped MODULE_MAP.md is parser-legible — the scaffolded
  // placeholder row yields 0 rows, and a synthetic 5-column row appended in
  // the stamped shape with [inferred] in the last cell is counted "inferred".
  {
    const d = await makeFixture("c10-t1", { fork: false });
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "shazam", d, "--yes"]);
    ok(r.code === 0, `T1: shazam --yes exits 0`);
    const mapPath = path.join(d, "ai", "guide", "MODULE_MAP.md");
    const stamped = await fs.readFile(mapPath, "utf8");
    const { rows: scaffoldRows } = parseModuleMap(stamped);
    ok(scaffoldRows.length === 0, `T1: scaffolded placeholder row yields 0 rows`);
    const withRow = stamped + "\n| `src/api/` | HTTP routes | `src/api/main.ts` | ours | [inferred] |\n";
    const { rows } = parseModuleMap(withRow);
    ok(rows.length === 1 && rows[0].status === "inferred",
      `T1: a stamped-shape 5-column row with [inferred] in the last cell is counted "inferred"`);
    // T2: the placeholder contract survives (doctor step-2 detection).
    ok(stamped.includes(MODULE_MAP_PLACEHOLDER), `T2: stamped MODULE_MAP.md still contains the literal "<fill in>"`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T3: copy parity — for each of the 5 cold-start body-text families, the
  // body text (after stripping front-matter up to the first blank line) is
  // byte-identical between the live copy and its OWN templates/ twin.
  {
    // Normalize line endings first: .gitattributes forces `eol=lf` on
    // templates/** but not on the live .claude//.agents//.cursor//.github/
    // copies, so a Windows checkout gives the live file CRLF while its
    // template twin stays LF — a platform checkout artifact, not a real
    // content difference, so it must not fail this parity check.
    const normalizeEol = (text) => text.replace(/\r\n/g, "\n");
    const bodyAfterFrontmatter = (rawText) => {
      const text = normalizeEol(rawText);
      if (!text.startsWith("---")) return text;
      const end = text.indexOf("\n---", 3);
      if (end === -1) return text;
      const afterClose = text.indexOf("\n", end + 4);
      return afterClose === -1 ? "" : text.slice(afterClose + 1);
    };
    const families = [
      [".claude/skills/cold-start/SKILL.md", "templates/claude/skills/cold-start/SKILL.md"],
      [".agents/skills/cold-start/SKILL.md", "templates/agents/skills/cold-start/SKILL.md"],
      [".agents/workflows/cold-start.md", "templates/agents/workflows/cold-start.md"],
      [".cursor/rules/cold-start.mdc", "templates/cursor/rules/cold-start.mdc"],
      [".github/prompts/cold-start.prompt.md", "templates/github/prompts/cold-start.prompt.md"],
    ];
    for (const [live, tmpl] of families) {
      const liveText = await fs.readFile(path.join(kitRoot, live), "utf8");
      const tmplText = await fs.readFile(path.join(kitRoot, tmpl), "utf8");
      ok(bodyAfterFrontmatter(liveText) === bodyAfterFrontmatter(tmplText),
        `T3: ${live} body is byte-identical to its templates/ twin`);
    }
    // Confirm the two skills families are NOT twins of each other (SPEC_C10 §3 note).
    const claudeSkill = bodyAfterFrontmatter(await fs.readFile(
      path.join(kitRoot, ".claude/skills/cold-start/SKILL.md"), "utf8"));
    const agentsSkill = bodyAfterFrontmatter(await fs.readFile(
      path.join(kitRoot, ".agents/skills/cold-start/SKILL.md"), "utf8"));
    ok(claudeSkill !== agentsSkill,
      `T3: .claude/skills and .agents/skills cold-start bodies are distinct families, not twins`);
  }
}

// ---------- C9: detection-layer robustness on polyglot/monorepo targets (SPEC_C9-detection-polyglot.md §6) ----------
console.log("\n— C9: detection-layer robustness —");
{
  const { orient } = await import(pathToFileURL(path.join(kitRoot, "lib", "orient.mjs")).href);
  const { checkMaturity } = await import(pathToFileURL(path.join(kitRoot, "lib", "maturity.mjs")).href);

  // T1: orient-bun-text-lock
  {
    const d = await makeBareFixture("c9-t1-orient-bun-text-lock", {
      "package.json": JSON.stringify({ name: "x", scripts: { build: "tsc", test: "vitest" } }),
      "bun.lock": "{}\n",
    });
    const p = await orient(d, {});
    ok(p.buildCmd.startsWith("bun install"), `T1: buildCmd starts with "bun install": ${p.buildCmd}`);
    ok(p.buildSystems.includes("Bun"), `T1: buildSystems includes "Bun": ${p.buildSystems}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T2: orient-uv
  {
    const d = await makeBareFixture("c9-t2-orient-uv", {
      "pyproject.toml": "[project]\nname = \"x\"\n",
      "uv.lock": "",
    });
    const p = await orient(d, {});
    ok(p.buildCmd === "uv sync", `T2: buildCmd is "uv sync": ${p.buildCmd}`);
    ok(p.testCmd === "uv run pytest", `T2: testCmd is "uv run pytest": ${p.testCmd}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T3: orient-workspace
  {
    const d = await makeBareFixture("c9-t3-orient-workspace", {
      "package.json": JSON.stringify({ name: "root" }),
      "frontend/package.json": JSON.stringify({ name: "frontend" }),
      "frontend/tests/x.test.ts": "export {};\n",
      "backend/pyproject.toml": "[project]\nname = \"backend\"\n",
      "backend/uv.lock": "",
      "backend/tests/test_x.py": "def test_x(): pass\n",
    });
    const p = await orient(d, {});
    ok(p.testDirs.includes("frontend/tests/") && p.testDirs.includes("backend/tests/"),
      `T3: testDirs contains both frontend/tests/ and backend/tests/: ${p.testDirs}`);
    ok(p.buildCmd.includes("cd backend && uv sync"),
      `T3: buildCmd contains a "cd backend && uv sync" segment: ${p.buildCmd}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T4: orient-description-bullet
  {
    const d = await makeBareFixture("c9-t4-orient-description-bullet", {
      "README.md": "# Title\n\n- ⚡ [**FastAPI**](https://x) for the backend.\n",
    });
    const p = await orient(d, {});
    ok(p.description === "⚡ FastAPI for the backend.",
      `T4: description strips the bullet, link syntax, and emphasis: ${JSON.stringify(p.description)}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T5: indepth-workspace-deps
  {
    const d = await makeBareFixture("c9-t5-indepth-workspace-deps", {
      "package.json": JSON.stringify({ name: "root" }),
      "frontend/package.json": JSON.stringify({ name: "frontend", dependencies: { react: "^18.0.0", axios: "^1.0.0" } }),
      "backend/pyproject.toml": "[project]\nname = \"backend\"\ndependencies = [\"fastapi>=0.1\", \"sqlmodel\"]\n",
    });
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "indepth", d]);
    ok(r.code === 0, `T5: indepth exits 0`);
    ok(/Total Dependencies\s+4/.test(r.out), `T5: dependencies.total === 4: ${r.out.match(/Total Dependencies.*/)?.[0]}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T6: maturity-modern-locks
  {
    const d = await makeBareFixture("c9-t6-maturity-modern-locks", {
      "bun.lock": "",
      "uv.lock": "",
    });
    const m = await checkMaturity(d);
    ok(m.checks.dependencyLocks.exists && m.checks.dependencyLocks.files.includes("bun.lock") &&
      m.checks.dependencyLocks.files.includes("uv.lock"),
      `T6: dependencyLocks.exists true, files lists bun.lock and uv.lock: ${m.checks.dependencyLocks.files}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T7: maturity-installed-panel
  {
    const d = await makeBareFixture("c9-t7-maturity-installed-panel", {
      "ai/repo-profile.json": "{}\n",
    });
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "check-repo-maturity", d]);
    ok(r.code === 0 && r.out.includes("already installed"), `T7: printed report contains "already installed"`);
    ok(!r.out.includes("Process 1 will run"), `T7: printed report does NOT contain "Process 1 will run"`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T8: verify-scoped-and-selector
  {
    const d = await makeBareFixture("c9-t8-verify-scoped-and-selector", {
      "src/a.py": "x = 1\n",
      "CLAUDE.md": "Uses `@scope/pkg` and `src/a.py::test_b`.\n",
    });
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "verify", d]);
    ok(r.code === 0 && /missing 0/.test(r.out),
      `T8: verify reports 0 missing (scoped token skipped; selector resolves to the file): ${r.out}`);
    await fs.rm(d, { recursive: true, force: true });
  }
}

// ---------- C1: stack-aware agent instructions (SPEC_C1-stack-aware-instructions.md §6) ----------
console.log("\n— C1: stack-aware agent instructions —");
{
  const noChurnLine = async (repoAbs) => {
    const text = await fs.readFile(path.join(repoAbs, "CLAUDE.md"), "utf8");
    return text.split("\n").find(l => l.includes("No Phantom Bugs")) || "";
  };

  // T1: Python-only fixture — verify --strict must exit 0 with zero missing claims.
  {
    const d = await makeBareFixture("c1-t1-python-only", {
      "pyproject.toml": "[project]\nname = \"x\"\n",
    });
    let r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "shazam", d, "--yes"]);
    ok(r.code === 0, `T1: shazam --yes exits 0`);
    r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "verify", d, "--strict"]);
    ok(r.code === 0 && /missing 0/.test(r.out),
      `T1: verify --strict exits 0 with zero missing claims on a Python-only repo`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T2: JS fixture keeps the literal `package.json` wording (byte-level check).
  {
    const d = await makeBareFixture("c1-t2-js-fixture", {
      "package.json": JSON.stringify({ name: "x" }),
    });
    run(process.execPath, [path.join(kitRoot, "install.mjs"), "shazam", d, "--yes"]);
    const line = await noChurnLine(d);
    ok(line.includes("`package.json`"), `T2: No-Churn line keeps the literal \`package.json\`: ${line}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T3: polyglot fixture lists both manifests.
  {
    const d = await makeBareFixture("c1-t3-polyglot", {
      "package.json": JSON.stringify({ name: "x" }),
      "pom.xml": "<project/>\n",
    });
    run(process.execPath, [path.join(kitRoot, "install.mjs"), "shazam", d, "--yes"]);
    const line = await noChurnLine(d);
    ok(line.includes("`package.json`") && line.includes("`pom.xml`"),
      `T3: No-Churn line lists both manifests: ${line}`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // T4: no recognized manifest — falls back to the plain-text phrase, no backticked token.
  {
    const d = await makeBareFixture("c1-t4-no-marker", { "README.md": "# x\n" });
    run(process.execPath, [path.join(kitRoot, "install.mjs"), "shazam", d, "--yes"]);
    const line = await noChurnLine(d);
    ok(line.includes("the project's build manifests") && !/`[^`]*\.(json|toml|txt|xml|gradle|mod|Gemfile|kts)`/.test(line),
      `T4: falls back to the plain-text phrase with no backticked manifest token: ${line}`);
    await fs.rm(d, { recursive: true, force: true });
  }
}

// ---------- simply-ai-native & lite mode tests ----------
console.log("\n— simply-ai-native & lite mode —");
{
  // L1: simply-ai-native creates root configs + tool dirs, no ai/ directory
  {
    const d = await makeBareFixture("lite-t1-basic", {
      "package.json": JSON.stringify({ name: "lite-app", scripts: { build: "tsc", test: "node test.js" } }),
      "README.md": "# Lite App\nA lightweight web application.\n",
    });
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "simply-ai-native", d, "--yes"]);
    ok(r.code === 0, `L1: simply-ai-native --yes exits 0`);
    ok(await exists(path.join(d, "CLAUDE.md")), `L1: CLAUDE.md exists`);
    ok(await exists(path.join(d, "AGENTS.md")), `L1: AGENTS.md exists`);
    ok(await exists(path.join(d, ".claude")), `L1: .claude/ directory exists`);
    ok(await exists(path.join(d, ".agents")), `L1: .agents/ directory exists`);
    ok(await exists(path.join(d, ".cursor")), `L1: .cursor/ directory exists`);
    ok(await exists(path.join(d, ".github")), `L1: .github/ directory exists`);
    ok(!(await exists(path.join(d, "ai"))), `L1: ai/ directory does NOT exist`);
    ok(!(await exists(path.join(d, "ai", "repo-profile.json"))), `L1: ai/repo-profile.json does NOT exist`);
    ok(!(await exists(path.join(d, "ai", "START-HERE.html"))), `L1: ai/START-HERE.html does NOT exist`);
    ok(await exists(path.join(d, ".agents", "install-manifest.json")), `L1: .agents/install-manifest.json exists`);

    const claudeContent = await fs.readFile(path.join(d, "CLAUDE.md"), "utf8");
    const agentsContent = await fs.readFile(path.join(d, "AGENTS.md"), "utf8");
    ok(claudeContent.includes("lite mode"), `L1: CLAUDE.md mentions lite mode in footer`);
    ok(agentsContent.includes("lite mode"), `L1: AGENTS.md mentions lite mode in footer`);
    ok(claudeContent.includes("npm run build") || claudeContent.includes("tsc"), `L1: CLAUDE.md contains build command`);
    ok(!claudeContent.includes("ai/guide/MODULE_MAP.md"), `L1: CLAUDE.md does not reference non-existent MODULE_MAP.md`);
    ok(!agentsContent.includes("ai/guide/MODULE_MAP.md"), `L1: AGENTS.md does not reference non-existent MODULE_MAP.md`);

    await fs.rm(d, { recursive: true, force: true });
  }

  // L2: install --lite behaves identically to simply-ai-native
  {
    const d = await makeBareFixture("lite-t2-install-flag", {
      "package.json": JSON.stringify({ name: "flag-app" }),
    });
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "install", d, "--lite", "--yes"]);
    ok(r.code === 0, `L2: install --lite --yes exits 0`);
    ok(await exists(path.join(d, "CLAUDE.md")), `L2: CLAUDE.md exists`);
    ok(!(await exists(path.join(d, "ai"))), `L2: ai/ folder does not exist`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // L3: uninstall removes lite mode files and manifests cleanly
  {
    const d = await makeBareFixture("lite-t3-uninstall", {
      "package.json": JSON.stringify({ name: "uninstall-app" }),
      "app.js": "console.log('keep me');\n",
    });
    run(process.execPath, [path.join(kitRoot, "install.mjs"), "simply-ai-native", d, "--yes"]);
    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "uninstall", d, "--yes"]);
    ok(r.code === 0, `L3: uninstall exits 0 on lite installation`);
    ok(!(await exists(path.join(d, "CLAUDE.md"))), `L3: CLAUDE.md was removed`);
    ok(!(await exists(path.join(d, "AGENTS.md"))), `L3: AGENTS.md was removed`);
    ok(!(await exists(path.join(d, ".claude"))), `L3: .claude/ was removed`);
    ok(!(await exists(path.join(d, ".agents"))), `L3: .agents/ was removed`);
    ok(await exists(path.join(d, "app.js")), `L3: user file app.js is preserved`);
    await fs.rm(d, { recursive: true, force: true });
  }

  // L4: upgrade path: simply-ai-native -> shazam graduates cleanly
  {
    const d = await makeBareFixture("lite-t4-upgrade", {
      "package.json": JSON.stringify({ name: "upgrade-app" }),
    });
    run(process.execPath, [path.join(kitRoot, "install.mjs"), "simply-ai-native", d, "--yes"]);
    ok(!(await exists(path.join(d, "ai"))), `L4: pre-upgrade: ai/ does not exist`);

    const r = run(process.execPath, [path.join(kitRoot, "install.mjs"), "shazam", d, "--yes"]);
    ok(r.code === 0, `L4: shazam --yes upgrade exits 0`);
    ok(await exists(path.join(d, "ai")), `L4: post-upgrade: ai/ directory created`);
    ok(await exists(path.join(d, "ai", "repo-profile.json")), `L4: ai/repo-profile.json created`);
    ok(await exists(path.join(d, "ai", "guide", "MODULE_MAP.md")), `L4: MODULE_MAP.md created`);
    await fs.rm(d, { recursive: true, force: true });
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
