// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// orient — deterministic stack detection.
// Every check in this file is a file-existence or file-content test; nothing
// is executed and nothing is inferred by a model. The output is
// ai/repo-profile.json, which a human confirms during the audit.

import { promises as fs } from "node:fs";
import path from "node:path";
import { KIT_VERSION, info, isDir, isFile, listWorkspaceMembers, readText, style } from "./util.mjs";
import { checkMaturity } from "./maturity.mjs";

export const DETECTORS = [
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

async function detectFork(targetAbs, flags) {
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

async function detectDescription(targetAbs, flags) {
  if (flags.description) return flags.description;
  for (const name of ["README.md", "README.adoc", "README.rst", "README.txt", "README"]) {
    const text = await readText(path.join(targetAbs, name));
    if (!text) continue;
    // First non-empty line that is not a heading marker, badge, or HTML — a crude
    // but deterministic guess; the human confirms it in the audit.
    let firstListItem = null;
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      if (/^(#|=|!\[|\[!|<|:|-{3,}|\*{3,})/.test(line)) continue;
      if (/^[-*+]\s/.test(line)) {
        if (!firstListItem && line.length >= 10) firstListItem = line;
        continue;
      }
      if (line.length < 10) continue;
      return line.length > 160 ? line.slice(0, 157) + "..." : line;
    }
    // Second pass: no plain prose line found — normalize the first list item
    // (strip the bullet marker, flatten [text](url) links, drop emphasis) so a
    // README whose lead sentence is a markdown bullet still yields clean prose.
    if (firstListItem) {
      const normalized = firstListItem
        .replace(/^[-*+]\s+/, "")
        .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
        .replace(/[*`]/g, "")
        .trim();
      if (normalized.length >= 10) {
        return normalized.length > 160 ? normalized.slice(0, 157) + "..." : normalized;
      }
    }
  }
  return "<one line: what this project does — fill in>";
}

export async function orient(targetAbs, flags) {
  // Run maturity check first — drives Process 1 vs 2 decision.
  const maturityResult = await checkMaturity(targetAbs);

  const found = [];
  for (const d of DETECTORS) {
    if (await isFile(path.join(targetAbs, d.marker))) found.push({ ...d, dir: "" });
  }
  // Glob-based markers (no fixed filename). C#/.NET projects are named
  // <Project>.csproj / <Solution>.sln, so we scan the root for the extension.
  let rootEntries = [];
  try { rootEntries = await fs.readdir(targetAbs); } catch { /* unreadable dir */ }
  if (rootEntries.some(f => /\.(sln|csproj|fsproj|vbproj)$/i.test(f))) {
    found.push({ marker: "*.sln/*.csproj", language: "C#/.NET", buildSystem: "dotnet",
      build: "dotnet build", test: "dotnet test", dir: "" });
  }
  // Fallback: a bare Makefile (common for C/C++) only when nothing else matched,
  // so we never mislabel a JS/Python repo that happens to ship a Makefile.
  if (found.length === 0 && rootEntries.some(f => /^(GNUmakefile|[Mm]akefile)$/.test(f))) {
    found.push({ marker: "Makefile", language: "C/C++", buildSystem: "Make",
      build: "make", test: "make test", dir: "" });
  }

  // Workspace members: one level deep, same marker table as the root scan. A
  // member hit is a detector clone tagged with its directory so build/test
  // commands can later be scoped to `cd <dir> && …` instead of lying about
  // where the manifest actually lives.
  const memberDirs = new Set();
  for (const member of await listWorkspaceMembers(targetAbs)) {
    for (const d of DETECTORS) {
      if (await isFile(path.join(targetAbs, member, d.marker))) {
        found.push({ ...d, dir: member });
        memberDirs.add(member);
      }
    }
  }

  // Refinements (still pure observation):
  const hasTsconfig = await isFile(path.join(targetAbs, "tsconfig.json"));
  const hasTurbo = await isFile(path.join(targetAbs, "turbo.json"));

  // Package-manager lock files and scripts are resolved PER DETECTOR DIRECTORY
  // (root = "", or a workspace member) so a monorepo's members don't inherit
  // the root's package manager or script set by accident.
  async function jsLockFlags(dirAbs) {
    return {
      hasPnpm: await isFile(path.join(dirAbs, "pnpm-lock.yaml")),
      hasYarn: await isFile(path.join(dirAbs, "yarn.lock")),
      hasBun: (await isFile(path.join(dirAbs, "bun.lockb"))) || (await isFile(path.join(dirAbs, "bun.lock"))),
    };
  }
  async function pyLockFlags(dirAbs) {
    return {
      hasUv: await isFile(path.join(dirAbs, "uv.lock")),
      hasPoetry: await isFile(path.join(dirAbs, "poetry.lock")),
      hasPipenv: await isFile(path.join(dirAbs, "Pipfile")),
    };
  }
  async function pkgScriptsFor(dirAbs) {
    const raw = await readText(path.join(dirAbs, "package.json"));
    if (!raw) return {};
    try { return JSON.parse(raw).scripts || {}; } catch { return {}; }
  }

  for (const d of found) {
    const dirAbs = path.join(targetAbs, d.dir);
    if (d.marker === "package.json") {
      if (!d.dir && hasTsconfig) {
        d.language = "TypeScript/JavaScript";
      }
      const { hasPnpm, hasYarn, hasBun } = await jsLockFlags(dirAbs);
      let install = "npm install", run = "npm run build";
      if (hasPnpm) {
        d.buildSystem = "pnpm"; install = "pnpm install"; run = "pnpm build"; d.test = "pnpm test";
      } else if (hasYarn) {
        d.buildSystem = "Yarn"; install = "yarn install"; run = "yarn build"; d.test = "yarn test";
      } else if (hasBun) {
        d.buildSystem = "Bun"; install = "bun install"; run = "bun run build"; d.test = "bun test";
      }
      const pkgScripts = await pkgScriptsFor(dirAbs);
      d.build = pkgScripts.build ? `${install} && ${run}` : install;
      if (!pkgScripts.test) d.test = "<no test script in package.json — fill in>";
    }
    if (d.marker === "pyproject.toml" || d.marker === "requirements.txt") {
      const { hasUv, hasPoetry, hasPipenv } = await pyLockFlags(dirAbs);
      if (hasUv) {
        d.buildSystem = "uv";
        d.build = "uv sync";
        d.test = "uv run pytest";
      } else if (hasPoetry) {
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

  // De-duplicate found detectors by buildSystem to prevent redundant chained
  // commands. When every detector sharing a buildSystem came from the SAME
  // non-root workspace member, prefix that representative's commands with
  // `cd <dir> && ` so the composed command runs where the manifest lives.
  const uniqueFound = [];
  const dirsByBuildSystem = new Map();
  for (const d of found) {
    if (!dirsByBuildSystem.has(d.buildSystem)) {
      dirsByBuildSystem.set(d.buildSystem, new Set());
      uniqueFound.push(d);
    }
    dirsByBuildSystem.get(d.buildSystem).add(d.dir);
  }
  for (const d of uniqueFound) {
    const dirs = dirsByBuildSystem.get(d.buildSystem);
    if (dirs.size === 1) {
      const [onlyDir] = dirs;
      if (onlyDir) {
        d.build = `cd ${onlyDir} && ${d.build}`;
        d.test = `cd ${onlyDir} && ${d.test}`;
      }
    }
  }

  const languages = [...new Set(uniqueFound.map(d => d.language))];
  const buildSystems = [...new Set(uniqueFound.map(d => d.buildSystem))];
  if (hasTurbo && !buildSystems.includes("Turborepo")) buildSystems.push("Turborepo");

  const testDirs = [];
  for (const t of TEST_DIR_CANDIDATES) {
    if (await isDir(path.join(targetAbs, t))) testDirs.push(t + "/");
  }
  for (const member of memberDirs) {
    for (const t of TEST_DIR_CANDIDATES) {
      if (await isDir(path.join(targetAbs, member, t))) testDirs.push(member + "/" + t + "/");
    }
  }

  const fork = await detectFork(targetAbs, flags);
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
    description: await detectDescription(targetAbs, flags),
    languages,
    buildSystems,
    buildCmd: flags.build || (uniqueFound.map(d => d.build).join("  &&  ") || "<fill in>"),
    testCmd: flags.test || (uniqueFound.map(d => d.test).join("  &&  ") || "<fill in>"),
    fork,
    testDirs,
    notes,
    maturity: {
      score: maturityResult.score,
      level: maturityResult.level,
      process: maturityResult.process,
    },
    existingAIConfig: maturityResult.existingAIConfig,
  };
  return profile;
}

export function printProfile(p) {
  // Dim, fixed-width (13-col) label so values line up; identity when color is off,
  // which keeps the plain output byte-for-byte what the test suite already asserts on.
  const L = (s) => style.dim(s.padEnd(13));
  info("");
  info(`  ${L("Project")}${style.bold(p.projectName)}`);
  info(`  ${L("Description")}${p.description}`);
  info(`  ${L("Languages")}${p.languages.join(", ") || "(none detected)"}`);
  info(`  ${L("Build")}${p.buildCmd}`);
  info(`  ${L("Test")}${p.testCmd}`);
  info(`  ${L("Fork")}${p.fork.isFork ? `yes — upstream ${p.fork.upstream}` : "no"} (${p.fork.evidence})`);
  info(`  ${L("Test dirs")}${p.testDirs.join(", ") || "(none found)"}`);
  for (const n of p.notes) info(`  ${L("Note")}${n}`);
  info("");
}
