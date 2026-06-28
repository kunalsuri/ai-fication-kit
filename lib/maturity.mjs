// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// maturity — deterministic repo AI-readiness assessment.
// Every check is a file-existence or file-content test; nothing is executed,
// nothing is inferred by a model, and nothing is written to disk.
// The output drives the Process 1 (legacy) vs Process 2 (modern) decision.

import { promises as fs } from "node:fs";
import path from "node:path";
import { KIT_VERSION, KIT_FOOTER_MARKER, info, isDir, isFile, readText } from "./util.mjs";

// ---------------------------------------------------------------- checks

async function checkAIConfig(targetAbs) {
  const result = { claudeMd: null, agentsMd: null, claudeDir: false, aiDir: false, otherTools: [] };

  for (const [file, key] of [["CLAUDE.md", "claudeMd"], ["AGENTS.md", "agentsMd"]]) {
    const p = path.join(targetAbs, file);
    if (await isFile(p)) {
      const content = await readText(p);
      const stat = await fs.stat(p);
      result[key] = {
        exists: true,
        sizeBytes: stat.size,
        hasKitFooter: content ? content.includes(KIT_FOOTER_MARKER) : false,
      };
    } else {
      result[key] = { exists: false, sizeBytes: 0, hasKitFooter: false };
    }
  }

  result.claudeDir = await isDir(path.join(targetAbs, ".claude"));
  result.aiDir = await isDir(path.join(targetAbs, "ai"));

  // Other AI tool configs
  const otherChecks = [
    [".cursorrules", "cursor"],
    [path.join(".cursor", "rules"), "cursor"],
    ["copilot-instructions.md", "copilot"],
    [path.join(".github", "copilot-instructions.md"), "copilot"],
    [".windsurfrules", "windsurf"],
  ];
  const seenTools = new Set();
  for (const [rel, tool] of otherChecks) {
    if (await isFile(path.join(targetAbs, rel)) || await isDir(path.join(targetAbs, rel))) {
      seenTools.add(tool);
    }
  }
  result.otherTools = [...seenTools].sort();
  return result;
}

async function checkVersionControl(targetAbs) {
  const gitDir = path.join(targetAbs, ".git");
  if (!(await isDir(gitDir))) return { exists: false, branch: null };
  const head = await readText(path.join(gitDir, "HEAD"));
  let branch = null;
  if (head) {
    const m = head.match(/ref:\s*refs\/heads\/(.+)/);
    branch = m ? m[1].trim() : "(detached HEAD)";
  }
  return { exists: true, branch };
}

async function checkBuildSystem(targetAbs) {
  const markers = [
    "package.json", "pom.xml", "build.gradle", "build.gradle.kts",
    "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml",
    "Gemfile", "composer.json", "CMakeLists.txt",
  ];
  const found = [];
  for (const m of markers) {
    if (await isFile(path.join(targetAbs, m))) found.push(m);
  }
  // Glob-based: .csproj/.sln
  try {
    for (const e of await fs.readdir(targetAbs)) {
      if (/\.(sln|csproj|fsproj|vbproj)$/i.test(e)) { found.push(e); break; }
    }
  } catch { /* unreadable */ }
  return { exists: found.length > 0, markers: found };
}

async function checkTestInfra(targetAbs) {
  const testDirs = ["test", "tests", "spec", "__tests__", "e2e", "cypress", "playwright"];
  const foundDirs = [];
  for (const d of testDirs) {
    if (await isDir(path.join(targetAbs, d))) foundDirs.push(d + "/");
  }
  let hasTestScript = false;
  const pkgRaw = await readText(path.join(targetAbs, "package.json"));
  if (pkgRaw) {
    try { hasTestScript = Boolean(JSON.parse(pkgRaw).scripts?.test); } catch { /* malformed */ }
  }
  return { exists: foundDirs.length > 0 || hasTestScript, dirs: foundDirs, hasTestScript };
}

async function checkCICD(targetAbs) {
  const checks = [
    [path.join(".github", "workflows"), "github-actions"],
    [".gitlab-ci.yml", "gitlab-ci"],
    ["Jenkinsfile", "jenkins"],
    [path.join(".circleci", "config.yml"), "circleci"],
    [".travis.yml", "travis"],
    ["azure-pipelines.yml", "azure-devops"],
    ["bitbucket-pipelines.yml", "bitbucket"],
  ];
  const found = [];
  for (const [rel, name] of checks) {
    if (await isFile(path.join(targetAbs, rel)) || await isDir(path.join(targetAbs, rel))) {
      found.push(name);
    }
  }
  return { exists: found.length > 0, systems: found };
}

async function checkDocumentation(targetAbs) {
  let readmeSize = 0;
  for (const name of ["README.md", "README.adoc", "README.rst", "README.txt", "README"]) {
    const p = path.join(targetAbs, name);
    if (await isFile(p)) {
      readmeSize = (await fs.stat(p)).size;
      break;
    }
  }
  const hasContributing = await isFile(path.join(targetAbs, "CONTRIBUTING.md"));
  const hasDocs = await isDir(path.join(targetAbs, "docs"));
  return { readmeExists: readmeSize > 0, readmeSize, hasContributing, hasDocs };
}

async function checkDependencyLocks(targetAbs) {
  const locks = [
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
    "poetry.lock", "Pipfile.lock", "Gemfile.lock", "composer.lock",
    "Cargo.lock", "go.sum",
  ];
  const found = [];
  for (const l of locks) {
    if (await isFile(path.join(targetAbs, l))) found.push(l);
  }
  return { exists: found.length > 0, files: found };
}

async function checkCodeStructure(targetAbs) {
  const codeDirs = ["src", "lib", "app", "pkg", "internal", "cmd"];
  const found = [];
  for (const d of codeDirs) {
    if (await isDir(path.join(targetAbs, d))) found.push(d + "/");
  }
  // Monorepo markers
  const monorepo = [];
  for (const m of ["turbo.json", "lerna.json", "pnpm-workspace.yaml", "nx.json"]) {
    if (await isFile(path.join(targetAbs, m))) monorepo.push(m);
  }
  return { dirs: found, monorepoMarkers: monorepo };
}

async function checkLicense(targetAbs) {
  for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "COPYING"]) {
    if (await isFile(path.join(targetAbs, name))) return { exists: true, file: name };
  }
  return { exists: false, file: null };
}

async function checkSecurity(targetAbs) {
  return { exists: await isFile(path.join(targetAbs, "SECURITY.md")) };
}

async function checkGitignore(targetAbs) {
  const p = path.join(targetAbs, ".gitignore");
  if (!(await isFile(p))) return { exists: false, coversCommon: false, missing: [] };
  const content = await readText(p) || "";
  const common = ["node_modules", "__pycache__", "dist", "build", ".env", "coverage", "*.log"];
  const missing = common.filter(pat => !content.includes(pat));
  return { exists: true, coversCommon: missing.length === 0, missing };
}

// ---------------------------------------------------------------- scoring

function computeScore(checks) {
  let score = 0;
  const max = 100;

  // AI Config (0 pts): having existing config is neutral, not a bonus/penalty
  // Version Control (15 pts)
  if (checks.versionControl.exists) score += 15;
  // Build System (15 pts)
  if (checks.buildSystem.exists) score += 15;
  // Test Infra (15 pts)
  if (checks.testInfra.exists) score += 15;
  // CI/CD (10 pts)
  if (checks.cicd.exists) score += 10;
  // Documentation (15 pts)
  if (checks.documentation.readmeExists) score += 10;
  if (checks.documentation.hasContributing) score += 2;
  if (checks.documentation.hasDocs) score += 3;
  // Dependencies (10 pts)
  if (checks.dependencyLocks.exists) score += 10;
  // Code Structure (5 pts)
  if (checks.codeStructure.dirs.length > 0) score += 5;
  // License (5 pts)
  if (checks.license.exists) score += 5;
  // Security (2 pts)
  if (checks.security.exists) score += 2;
  // Gitignore (3 pts)
  if (checks.gitignore.exists) score += 2;
  if (checks.gitignore.coversCommon) score += 1;

  return Math.min(score, max);
}

function determineProcess(aiConfig) {
  // Process 2 if user-authored CLAUDE.md or AGENTS.md exists (not kit-generated)
  const hasUserClaude = aiConfig.claudeMd.exists && !aiConfig.claudeMd.hasKitFooter;
  const hasUserAgents = aiConfig.agentsMd.exists && !aiConfig.agentsMd.hasKitFooter;
  return (hasUserClaude || hasUserAgents) ? 2 : 1;
}

function determineLevel(score) {
  if (score >= 80) return "Mature";
  if (score >= 50) return "Developing";
  if (score >= 25) return "Early";
  return "Minimal";
}

// ---------------------------------------------------------------- public API

export async function checkMaturity(targetAbs) {
  const checks = {
    aiConfig: await checkAIConfig(targetAbs),
    versionControl: await checkVersionControl(targetAbs),
    buildSystem: await checkBuildSystem(targetAbs),
    testInfra: await checkTestInfra(targetAbs),
    cicd: await checkCICD(targetAbs),
    documentation: await checkDocumentation(targetAbs),
    dependencyLocks: await checkDependencyLocks(targetAbs),
    codeStructure: await checkCodeStructure(targetAbs),
    license: await checkLicense(targetAbs),
    security: await checkSecurity(targetAbs),
    gitignore: await checkGitignore(targetAbs),
  };

  const score = computeScore(checks);
  const processNum = determineProcess(checks.aiConfig);
  const level = determineLevel(score);

  return {
    _comment: "Generated by ai-fication-kit `check-repo-maturity` — deterministic " +
              "file-existence checks only, no LLM. Read-only: no files written.",
    kitVersion: KIT_VERSION,
    generated: new Date().toISOString(),
    target: targetAbs,
    score,
    level,
    process: processNum,
    existingAIConfig: checks.aiConfig,
    checks,
  };
}

export function printMaturityReport(result) {
  const c = result.checks;
  const bar = (score) => {
    const filled = Math.round(score / 100 * 16);
    return "█".repeat(filled) + "░".repeat(16 - filled);
  };

  const processLabel = result.process === 1
    ? "Legacy (Process 1) — create ai/ from scratch"
    : "Modern (Process 2) — backup existing config, then create ai/";

  info("");
  info("╔══════════════════════════════════════════════════════════╗");
  info("║            Repository Maturity Report                   ║");
  info(`║            ${path.basename(result.target).padEnd(20)} ${result.generated.slice(0, 10)}          ║`);
  info("╠══════════════════════════════════════════════════════════╣");
  info(`║  Overall Score:  ${bar(result.score)}  ${String(result.score).padStart(3)}/100      ║`);
  info(`║  AI Readiness:   ${processLabel.length > 38 ? processLabel.slice(0, 38) : processLabel.padEnd(38)} ║`);
  info("╠══════════════════════════════════════════════════════════╣");

  // AI Config
  const aiLabel = [];
  if (c.aiConfig.claudeMd.exists) {
    aiLabel.push(`CLAUDE.md (${c.aiConfig.claudeMd.hasKitFooter ? "kit-generated" : "user-authored"})`);
  }
  if (c.aiConfig.agentsMd.exists) {
    aiLabel.push(`AGENTS.md (${c.aiConfig.agentsMd.hasKitFooter ? "kit-generated" : "user-authored"})`);
  }
  if (c.aiConfig.otherTools.length) {
    aiLabel.push(`Other: ${c.aiConfig.otherTools.join(", ")}`);
  }
  if (aiLabel.length) {
    info(`║  ✓ AI Config         ${aiLabel[0].padEnd(35)}║`);
    for (let i = 1; i < aiLabel.length; i++) {
      info(`║                      ${aiLabel[i].padEnd(35)}║`);
    }
  } else {
    info("║  ✗ AI Config         None detected                      ║");
  }

  // Version control
  if (c.versionControl.exists) {
    info(`║  ✓ Version Control   git, branch: ${(c.versionControl.branch || "?").padEnd(21)}║`);
  } else {
    info("║  ✗ Version Control   Not a git repository                ║");
  }

  // Build system
  if (c.buildSystem.exists) {
    info(`║  ✓ Build System      ${c.buildSystem.markers.slice(0, 3).join(", ").padEnd(35)}║`);
  } else {
    info("║  ✗ Build System      No markers detected                 ║");
  }

  // Test infra
  if (c.testInfra.exists) {
    const parts = [];
    if (c.testInfra.dirs.length) parts.push(c.testInfra.dirs.join(", "));
    if (c.testInfra.hasTestScript) parts.push("test script");
    info(`║  ✓ Test Infra        ${parts.join("; ").padEnd(35)}║`);
  } else {
    info("║  ✗ Test Infra        None detected                       ║");
  }

  // CI/CD
  if (c.cicd.exists) {
    info(`║  ✓ CI/CD             ${c.cicd.systems.join(", ").padEnd(35)}║`);
  } else {
    info("║  ✗ CI/CD             None detected                       ║");
  }

  // Documentation
  if (c.documentation.readmeExists) {
    const size = c.documentation.readmeSize > 1024
      ? `${(c.documentation.readmeSize / 1024).toFixed(1)} KB`
      : `${c.documentation.readmeSize} B`;
    info(`║  ✓ Documentation     README (${size})`.padEnd(57) + "║");
  } else {
    info("║  ✗ Documentation     No README found                     ║");
  }

  // Dependencies
  if (c.dependencyLocks.exists) {
    info(`║  ✓ Dependencies      ${c.dependencyLocks.files.join(", ").padEnd(35)}║`);
  } else {
    info("║  ✗ Dependencies      No lock files                       ║");
  }

  // Code structure
  if (c.codeStructure.dirs.length) {
    info(`║  ✓ Code Structure    ${c.codeStructure.dirs.join(", ").padEnd(35)}║`);
  } else {
    info("║  ✗ Code Structure    No standard dirs (src/, lib/, etc.)  ║");
  }

  // License
  if (c.license.exists) {
    info(`║  ✓ License           ${c.license.file.padEnd(35)}║`);
  } else {
    info("║  ✗ License           None found                          ║");
  }

  // Gitignore
  if (c.gitignore.exists) {
    const note = c.gitignore.coversCommon ? "(comprehensive)" : `(missing: ${c.gitignore.missing.slice(0, 3).join(", ")})`;
    info(`║  ${c.gitignore.coversCommon ? "✓" : "△"} .gitignore         ${note.padEnd(35)}║`);
  } else {
    info("║  ✗ .gitignore        Not found                           ║");
  }

  info("╠══════════════════════════════════════════════════════════╣");

  // Process summary
  if (result.process === 2) {
    info("║  → Process 2 will run:                                  ║");
    if (c.aiConfig.claudeMd.exists && !c.aiConfig.claudeMd.hasKitFooter) {
      info("║    1. Back up CLAUDE.md → CLAUDE_bkp_<timestamp>.md     ║");
    }
    if (c.aiConfig.agentsMd.exists && !c.aiConfig.agentsMd.hasKitFooter) {
      info("║    2. Back up AGENTS.md → AGENTS_bkp_<timestamp>.md     ║");
    }
    info("║    3. Create ai/ knowledge layer from templates          ║");
    info("║    4. /cold-start will extract knowledge from backups    ║");
  } else {
    info("║  → Process 1 will run:                                  ║");
    info("║    1. Create ai/ knowledge layer from templates          ║");
    info("║    2. Create CLAUDE.md + AGENTS.md from templates        ║");
    info("║    3. /cold-start drafts ai/guide/ docs from code        ║");
  }

  info("╚══════════════════════════════════════════════════════════╝");
  info("");
}
