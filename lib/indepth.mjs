// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// indepth — comprehensive repo deep analysis and architectural inference.

import { promises as fs } from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { KIT_VERSION, isFile, isDir, readText, style } from "./util.mjs";

// Helper for running commands
function runCmd(cmd, cwd) {
  return new Promise((resolve) => {
    exec(cmd, { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ code: error.code || 1, out: stdout + stderr, success: false });
      } else {
        resolve({ code: 0, out: stdout, success: true });
      }
    });
  });
}

// Simplified glob-to-regex gitignore matching
async function parseGitignore(targetAbs) {
  const gitignorePath = path.join(targetAbs, ".gitignore");
  const rules = [];
  if (await isFile(gitignorePath)) {
    const content = await readText(gitignorePath);
    if (content) {
      for (let line of content.split(/\r?\n/)) {
        line = line.trim();
        if (!line || line.startsWith("#")) continue;
        
        let pattern = line.replace(/[-\/\\^$*+?.()|[\]{}]/g, (ch) => {
          if (ch === "*") return ".*";
          if (ch === "?") return ".";
          return "\\" + ch;
        });

        if (line.endsWith("/")) {
          pattern += "?.*";
        } else {
          pattern += "($|/)";
        }

        if (line.startsWith("/")) {
          pattern = "^" + pattern.slice(1);
        } else {
          pattern = "(^|/)" + pattern;
        }

        try {
          rules.push(new RegExp(pattern));
        } catch {}
      }
    }
  }
  return rules;
}

// Count LOC and strip comments (heuristics)
function countLOCAndComments(content, filename) {
  const ext = path.extname(filename).toLowerCase();
  const lines = content.split(/\r?\n/);
  let isBlockComment = false;
  let loc = 0;
  let hasDocstring = false;

  const isPython = ext === ".py";
  const isSql = ext === ".sql";
  const isLatex = ext === ".tex";

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isBlockComment) {
      if (trimmed.includes("*/") && !isPython) {
        isBlockComment = false;
      } else if (isPython && (trimmed.includes('"""') || trimmed.includes("'''"))) {
        isBlockComment = false;
      }
      continue;
    }

    if (!isPython && trimmed.startsWith("/*")) {
      hasDocstring = hasDocstring || trimmed.startsWith("/**");
      if (!trimmed.includes("*/")) {
        isBlockComment = true;
      }
      continue;
    }

    if (isPython && (trimmed.startsWith('"""') || trimmed.startsWith("'''"))) {
      hasDocstring = true;
      const quotes = trimmed.startsWith('"""') ? '"""' : "'''";
      const secondQuoteIdx = trimmed.indexOf(quotes, quotes.length);
      if (secondQuoteIdx === -1) {
        isBlockComment = true;
      }
      continue;
    }

    // Line comments
    if (!isPython && !isSql && !isLatex && trimmed.startsWith("//")) {
      hasDocstring = hasDocstring || trimmed.startsWith("///");
      continue;
    }
    if (isPython && trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("#") && (ext === ".rb" || ext === ".sh" || ext === ".pl" || filename.toLowerCase() === "makefile")) continue;
    if (isSql && trimmed.startsWith("--")) continue;
    if (isLatex && trimmed.startsWith("%")) continue;

    loc++;
  }

  return { loc, hasDocstring };
}

// ---------------------------------------------------- Detectors
// 2a. Dependency Analysis
async function detectDependencies(targetAbs, filesInfo) {
  const result = {
    total: 0,
    direct: 0,
    transitive: 0,
    byCategory: { production: 0, development: 0, optional: 0 },
    topLevelDeps: []
  };

  // Node dependencies
  const pkgPath = path.join(targetAbs, "package.json");
  if (await isFile(pkgPath)) {
    const raw = await readText(pkgPath);
    try {
      const pkg = JSON.parse(raw);
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      const optDeps = pkg.optionalDependencies || {};

      Object.entries(deps).forEach(([name, version]) => {
        result.byCategory.production++;
        result.topLevelDeps.push({ name, version, category: "prod" });
      });
      Object.entries(devDeps).forEach(([name, version]) => {
        result.byCategory.development++;
        result.topLevelDeps.push({ name, version, category: "dev" });
      });
      Object.entries(optDeps).forEach(([name, version]) => {
        result.byCategory.optional++;
        result.topLevelDeps.push({ name, version, category: "optional" });
      });
      result.direct = result.topLevelDeps.length;
    } catch {}

    // Total/Transitive from locks
    const lockPath = path.join(targetAbs, "package-lock.json");
    const yarnLockPath = path.join(targetAbs, "yarn.lock");
    const pnpmLockPath = path.join(targetAbs, "pnpm-lock.yaml");

    if (await isFile(lockPath)) {
      try {
        const lock = JSON.parse(await readText(lockPath));
        if (lock.packages) {
          result.total = Object.keys(lock.packages).filter(k => k !== "").length;
        } else if (lock.dependencies) {
          result.total = Object.keys(lock.dependencies).length;
        }
      } catch {}
    } else if (await isFile(yarnLockPath)) {
      const txt = await readText(yarnLockPath);
      const matches = txt.match(/^\S+.*:$/gm) || [];
      result.total = matches.filter(l => !l.startsWith("#") && l.includes("@")).length;
    } else if (await isFile(pnpmLockPath)) {
      const txt = await readText(pnpmLockPath);
      const matches = txt.match(/^\s{2}['"]?\/[^'"]+['"]?:/gm) || [];
      result.total = matches.length;
    }
  }

  // Python dependencies
  const pyprojectPath = path.join(targetAbs, "pyproject.toml");
  const reqPath = path.join(targetAbs, "requirements.txt");
  const poetryLockPath = path.join(targetAbs, "poetry.lock");
  const pipfileLockPath = path.join(targetAbs, "Pipfile.lock");

  if (await isFile(pyprojectPath)) {
    const txt = await readText(pyprojectPath) || "";
    let poetryDepsSection = false;
    for (const line of txt.split("\n")) {
      if (line.trim().startsWith("[tool.poetry.dependencies]")) {
        poetryDepsSection = true;
        continue;
      }
      if (line.trim().startsWith("[")) {
        poetryDepsSection = false;
      }
      if (poetryDepsSection) {
        const m = line.match(/^\s*([^=\s#]+)\s*=\s*/);
        if (m && m[1] !== "python") {
          result.direct++;
          result.byCategory.production++;
          result.topLevelDeps.push({ name: m[1], version: "*", category: "prod" });
        }
      }
    }
  } else if (await isFile(reqPath)) {
    const txt = await readText(reqPath) || "";
    for (let line of txt.split("\n")) {
      line = line.trim();
      if (line && !line.startsWith("#") && !line.startsWith("-")) {
        const parts = line.split(/(?:===|==|~=|!=|>=|<=|>|<)/);
        if (parts[0]) {
          result.direct++;
          result.byCategory.production++;
          result.topLevelDeps.push({ name: parts[0].trim(), version: parts[1] ? parts[1].trim() : "*", category: "prod" });
        }
      }
    }
  }

  if (await isFile(poetryLockPath)) {
    const txt = await readText(poetryLockPath) || "";
    const packages = txt.match(/^\[\[package\]\]/gm) || [];
    result.total = Math.max(result.total, packages.length);
  } else if (await isFile(pipfileLockPath)) {
    try {
      const lock = JSON.parse(await readText(pipfileLockPath));
      const count = Object.keys(lock.default || {}).length + Object.keys(lock.develop || {}).length;
      result.total = Math.max(result.total, count);
    } catch {}
  }

  // Go dependencies
  const goModPath = path.join(targetAbs, "go.mod");
  const goSumPath = path.join(targetAbs, "go.sum");
  if (await isFile(goModPath)) {
    const txt = await readText(goModPath) || "";
    let inRequire = false;
    for (let line of txt.split("\n")) {
      line = line.trim();
      if (line.startsWith("require (")) { inRequire = true; continue; }
      if (line.startsWith(")")) { inRequire = false; continue; }
      if (inRequire || line.startsWith("require ")) {
        if (!line.includes("// indirect")) {
          const parts = line.replace("require ", "").trim().split(/\s+/);
          if (parts[0]) {
            result.direct++;
            result.byCategory.production++;
            result.topLevelDeps.push({ name: parts[0], version: parts[1] || "*", category: "prod" });
          }
        }
      }
    }
    if (await isFile(goSumPath)) {
      const sumTxt = await readText(goSumPath) || "";
      const pkgs = new Set();
      for (let line of sumTxt.split("\n")) {
        const parts = line.trim().split(/\s+/);
        if (parts[0]) pkgs.add(parts[0]);
      }
      result.total = Math.max(result.total, pkgs.size);
    }
  }

  // Rust dependencies
  const cargoTomlPath = path.join(targetAbs, "Cargo.toml");
  const cargoLockPath = path.join(targetAbs, "Cargo.lock");
  if (await isFile(cargoTomlPath)) {
    const txt = await readText(cargoTomlPath) || "";
    let inDeps = false;
    for (let line of txt.split("\n")) {
      line = line.trim();
      if (line.startsWith("[dependencies]") || line.startsWith("[dev-dependencies]")) {
        inDeps = true;
        continue;
      }
      if (line.startsWith("[")) { inDeps = false; }
      if (inDeps) {
        const m = line.match(/^([^=\s]+)\s*=\s*/);
        if (m) {
          result.direct++;
          result.byCategory.production++;
          result.topLevelDeps.push({ name: m[1], version: "*", category: "prod" });
        }
      }
    }
    if (await isFile(cargoLockPath)) {
      const lockTxt = await readText(cargoLockPath) || "";
      const matches = lockTxt.match(/^\[\[package\]\]/gm) || [];
      result.total = Math.max(result.total, matches.length);
    }
  }

  // Ruby dependencies
  const gemfilePath = path.join(targetAbs, "Gemfile");
  const gemfileLockPath = path.join(targetAbs, "Gemfile.lock");
  if (await isFile(gemfilePath)) {
    const txt = await readText(gemfilePath) || "";
    for (let line of txt.split("\n")) {
      const m = line.trim().match(/^gem\s+['"]([^'"]+)['"]/);
      if (m) {
        result.direct++;
        result.byCategory.production++;
        result.topLevelDeps.push({ name: m[1], version: "*", category: "prod" });
      }
    }
    if (await isFile(gemfileLockPath)) {
      const lockTxt = await readText(gemfileLockPath) || "";
      let inSpecs = false;
      const gems = new Set();
      for (let line of lockTxt.split("\n")) {
        if (line.includes("specs:")) { inSpecs = true; continue; }
        if (line && !line.startsWith("    ")) { inSpecs = false; }
        if (inSpecs && line.startsWith("    ")) {
          const m = line.trim().match(/^([^(\s]+)/);
          if (m) gems.add(m[1]);
        }
      }
      result.total = Math.max(result.total, gems.size);
    }
  }

  // Composer PHP dependencies
  const composerPath = path.join(targetAbs, "composer.json");
  const composerLockPath = path.join(targetAbs, "composer.lock");
  if (await isFile(composerPath)) {
    try {
      const comp = JSON.parse(await readText(composerPath));
      const req = comp.require || {};
      const reqDev = comp["require-dev"] || {};
      Object.entries(req).forEach(([name, version]) => {
        if (name !== "php") {
          result.byCategory.production++;
          result.topLevelDeps.push({ name, version, category: "prod" });
        }
      });
      Object.entries(reqDev).forEach(([name, version]) => {
        result.byCategory.development++;
        result.topLevelDeps.push({ name, version, category: "dev" });
      });
      result.direct += Object.keys(req).filter(n => n !== "php").length + Object.keys(reqDev).length;
    } catch {}

    if (await isFile(composerLockPath)) {
      try {
        const lock = JSON.parse(await readText(composerLockPath));
        result.total = Math.max(result.total, (lock.packages || []).length + (lock["packages-dev"] || []).length);
      } catch {}
    }
  }

  result.total = Math.max(result.total, result.direct);
  result.transitive = Math.max(0, result.total - result.direct);

  return result;
}

// 2b & 2f (Code Structure & Doc completeness support)
async function analyzeCodeStructureAndDocs(targetAbs, filesInfo) {
  let fileCount = filesInfo.length;
  let linesOfCode = 0;
  let sourceFilesOnly = 0;
  let testFileCount = 0;
  let documentationFiles = 0;

  const docExts = new Set(["md", "txt", "adoc", "rst"]);
  const srcExts = new Set(["js", "mjs", "cjs", "ts", "tsx", "py", "java", "go", "rs", "rb", "php", "cs", "c", "cpp", "h", "hpp"]);

  let docstringFilesCount = 0;
  const modulesMap = {};
  
  let maxDepth = 0;
  const dirCounts = {};
  const dirFiles = {};

  const codeDistribution = { src: 0, test: 0, docs: 0, config: 0, other: 0 };

  for (const file of filesInfo) {
    const parts = file.path.split("/");
    const depth = parts.length - 1;
    if (depth > maxDepth) maxDepth = depth;

    for (let i = 0; i < parts.length - 1; i++) {
      const parent = parts.slice(0, i + 1).join("/");
      const child = parts.slice(0, i + 2).join("/");
      if (!dirCounts[parent]) dirCounts[parent] = new Set();
      if (i < parts.length - 2) {
        dirCounts[parent].add(child);
      }
    }
    const parentDir = parts.slice(0, -1).join("/");
    if (parentDir) {
      dirFiles[parentDir] = (dirFiles[parentDir] || 0) + 1;
    }

    const isTest = file.path.includes("/test") || file.path.includes("/spec") || file.path.includes("__tests__") || file.name.includes("test") || file.name.includes("spec");

    let category = "other";
    if (docExts.has(file.ext)) {
      category = "docs";
      documentationFiles++;
    } else if (isTest) {
      category = "test";
      testFileCount++;
    } else if (srcExts.has(file.ext)) {
      category = "src";
      sourceFilesOnly++;
    } else if (["json", "yaml", "yml", "toml", "xml", "ini", "config", "gitignore"].includes(file.ext) || file.name.startsWith(".")) {
      category = "config";
    }

    let fileLOC = 0;
    if (file.size < 500 * 1024 && (category === "src" || category === "test" || category === "docs")) {
      const fullPath = path.join(targetAbs, file.path);
      const text = await readText(fullPath);
      if (text) {
        const { loc, hasDocstring } = countLOCAndComments(text, file.name);
        fileLOC = loc;
        if (hasDocstring) docstringFilesCount++;
      }
    } else {
      fileLOC = Math.round(file.size / 40);
    }

    linesOfCode += fileLOC;
    codeDistribution[category] += fileLOC;

    let modName = null;
    if (parts[0] === "src" && parts[1]) {
      modName = parts[1];
    } else if (parts[0] !== "src" && parts[0] && parts.length > 1) {
      if (!["docs", "test", "tests", "spec", ".github"].includes(parts[0])) {
        modName = parts[0];
      }
    }
    if (modName) {
      if (!modulesMap[modName]) modulesMap[modName] = { fileCount: 0, files: [] };
      modulesMap[modName].fileCount++;
      modulesMap[modName].files.push(file.path);
    }
  }

  let branchSum = 0;
  let branchCount = 0;
  Object.values(dirCounts).forEach(subdirs => {
    if (subdirs.size > 0) {
      branchSum += subdirs.size;
      branchCount++;
    }
  });
  const avgBranchingFactor = branchCount ? branchSum / branchCount : 0;

  const standardDirs = [];
  let rootEntries = [];
  try { rootEntries = await fs.readdir(targetAbs, { withFileTypes: true }); } catch {}
  for (const entry of rootEntries) {
    if (entry.isDirectory()) {
      let purpose = "";
      if (["src", "lib", "app", "pkg"].includes(entry.name)) purpose = "Source Code";
      else if (["test", "tests", "spec", "__tests__"].includes(entry.name)) purpose = "Test Suite";
      else if (entry.name === "docs") purpose = "Documentation";
      else if (entry.name === ".github") purpose = "CI/CD and GitHub Configuration";
      else if (["config", "configs"].includes(entry.name)) purpose = "Configuration Files";
      else if (entry.name === "bin") purpose = "Binaries / Scripts";

      if (purpose) {
        const rel = entry.name;
        const fCount = filesInfo.filter(f => f.path.startsWith(rel + "/")).length;
        standardDirs.push({ name: entry.name, purpose, fileCount: fCount });
      }
    }
  }

  const moduleStructure = [];
  const modNames = Object.keys(modulesMap);
  for (const [name, info] of Object.entries(modulesMap)) {
    const deps = new Set();
    for (const filePath of info.files) {
      const fullPath = path.join(targetAbs, filePath);
      const content = await readText(fullPath);
      if (content) {
        for (const line of content.split("\n")) {
          if (line.includes("import") || line.includes("require") || line.includes("use") || line.includes("using")) {
            for (const other of modNames) {
              if (other !== name && (line.includes(`/${other}/`) || line.includes(`/${other}"`) || line.includes(`/${other}'`) || line.match(new RegExp(`\\b${other}\\b`)))) {
                deps.add(other);
              }
            }
          }
        }
      }
    }
    moduleStructure.push({ name, fileCount: info.fileCount, dependencies: [...deps] });
  }

  return {
    codeMetrics: { fileCount, linesOfCode, sourceFilesOnly, testFileCount, documentationFiles },
    directoryStructure: { depth: maxDepth, avgBranchingFactor, standardDirs },
    moduleStructure,
    codeDistribution,
    docstringPercent: sourceFilesOnly ? (docstringFilesCount / sourceFilesOnly) * 100 : 0
  };
}

// 2c & 2h. Architecture & Scalability
async function inferArchitecture(targetAbs, filesInfo, codeStruct) {
  let pattern = "monolithic";
  let confidence = 0.85;

  const layeredFolders = ["controllers", "services", "models", "views", "routes", "handlers", "dao", "repository"];
  const hasLayers = filesInfo.some(f => layeredFolders.some(lf => f.path.includes(`/${lf}/`)));
  const pluginFolders = ["plugins", "extensions", "addons"];
  const hasPlugins = filesInfo.some(f => pluginFolders.some(pf => f.path.includes(`/${pf}/`)));

  const subprojects = filesInfo.filter(f => f.name === "package.json" && f.path.includes("/")).length +
                      filesInfo.filter(f => f.name === "pom.xml" && f.path.includes("/")).length;

  if (subprojects > 2) {
    pattern = "microservices";
    confidence = 0.90;
  } else if (hasPlugins) {
    pattern = "plugin";
    confidence = 0.88;
  } else if (hasLayers) {
    pattern = "layered";
    confidence = 0.92;
  } else if (codeStruct.moduleStructure.length > 3) {
    pattern = "modular";
    confidence = 0.88;
  }

  const layers = [];
  if (pattern === "layered" || pattern === "hybrid") {
    layeredFolders.forEach(lf => {
      const dirs = [...new Set(filesInfo.filter(f => f.path.includes(`/${lf}/`)).map(f => path.dirname(f.path)))];
      if (dirs.length > 0) {
        let resp = "Handles data persistent operations";
        if (["controllers", "routes", "handlers"].includes(lf)) resp = "Handles incoming HTTP requests and routing";
        else if (lf === "services") resp = "Implements business logic";
        layers.push({ name: lf, directories: dirs, responsibility: resp });
      }
    });
  }

  let httpServer = false;
  let messageQueue = false;
  let databaseAccess = false;
  let externalAPIs = false;
  const commEvidence = [];

  let hasLoadBalancing = false;
  let hasCaching = false;
  let hasAsync = false;
  const scalEvidence = [];

  const checkKeywords = [
    { key: "express", category: "httpServer", label: "Express server import", isScal: false },
    { key: "fastapi", category: "httpServer", label: "FastAPI import", isScal: false },
    { key: "flask", category: "httpServer", label: "Flask import", isScal: false },
    { key: "django", category: "httpServer", label: "Django import", isScal: false },
    { key: "spring", category: "httpServer", label: "Spring Boot configuration", isScal: false },
    { key: "celery", category: "messageQueue", label: "Celery message queue", isScal: false },
    { key: "kafka", category: "messageQueue", label: "Kafka client", isScal: false },
    { key: "rabbitmq", category: "messageQueue", label: "RabbitMQ amqp protocol", isScal: false },
    { key: "prisma", category: "databaseAccess", label: "Prisma ORM schema", isScal: false },
    { key: "sequelize", category: "databaseAccess", label: "Sequelize ORM", isScal: false },
    { key: "mongoose", category: "databaseAccess", label: "Mongoose MongoDB schema", isScal: false },
    { key: "sqlalchemy", category: "databaseAccess", label: "SQLAlchemy database model", isScal: false },
    { key: "redis", category: "hasCaching", label: "Redis client cache", isScal: true },
    { key: "memcached", category: "hasCaching", label: "Memcached cache client", isScal: true },
    { key: "nginx", category: "hasLoadBalancing", label: "Nginx proxy configuration", isScal: true },
    { key: "haproxy", category: "hasLoadBalancing", label: "HAProxy load balancer", isScal: true },
    { key: "asyncio", category: "hasAsync", label: "asyncio async patterns", isScal: true },
    { key: "tokio", category: "hasAsync", label: "Tokio Rust runtime", isScal: true },
    { key: "axios", category: "externalAPIs", label: "Axios client", isScal: false },
    { key: "requests", category: "externalAPIs", label: "requests library", isScal: false }
  ];

  for (const file of filesInfo) {
    if (file.name.includes("nginx") || file.name.includes("docker-compose")) {
      if (file.name.includes("nginx")) {
        hasLoadBalancing = true;
        if (!scalEvidence.includes("Nginx config")) scalEvidence.push("Nginx config");
      }
    }

    if (file.size < 200 * 1024 && (path.extname(file.name) === ".json" || path.extname(file.name) === ".toml" || ["js", "ts", "py", "go"].includes(file.ext))) {
      const fullPath = path.join(targetAbs, file.path);
      const text = await readText(fullPath) || "";
      checkKeywords.forEach(ck => {
        if (text.toLowerCase().includes(ck.key)) {
          if (ck.isScal) {
            if (ck.category === "hasCaching") hasCaching = true;
            if (ck.category === "hasLoadBalancing") hasLoadBalancing = true;
            if (ck.category === "hasAsync") hasAsync = true;
            if (!scalEvidence.includes(ck.label)) scalEvidence.push(ck.label);
          } else {
            if (ck.category === "httpServer") httpServer = true;
            if (ck.category === "messageQueue") messageQueue = true;
            if (ck.category === "databaseAccess") databaseAccess = true;
            if (ck.category === "externalAPIs") externalAPIs = true;
            if (!commEvidence.includes(ck.label)) commEvidence.push(ck.label);
          }
        }
      });
      if (text.includes("Promise") || text.includes("async ") || text.includes("await ")) {
        hasAsync = true;
        if (!scalEvidence.includes("async/await keywords")) scalEvidence.push("async/await keywords");
      }
      if (text.includes("db.pool") || text.includes("connectionLimit") || text.includes("max_overflow")) {
        if (!scalEvidence.includes("DB Pool settings")) scalEvidence.push("DB Pool settings");
      }
    }
  }

  const envExample = filesInfo.find(f => f.name === ".env.example");
  if (envExample) {
    externalAPIs = true;
    if (!commEvidence.includes(".env.example variables")) commEvidence.push(".env.example variables");
  }

  return {
    inferredArchitecture: { pattern, confidence, layers },
    communicationPatterns: { httpServer, messageQueue, databaseAccess, externalAPIs, evidence: commEvidence },
    scalabilityIndicators: { hasLoadBalancing, hasCaching, hasAsync, evidence: scalEvidence }
  };
}

// 2d. Git History Insights
async function analyzeGitHistory(targetAbs, warnings) {
  const result = {
    commitCount: 0,
    contributorCount: 0,
    commitFrequency: "low",
    lastCommitDate: null,
    topContributors: [],
    activeBranches: [],
    tagCount: 0,
    releases: []
  };

  const hasGitDir = await isDir(path.join(targetAbs, ".git"));
  if (!hasGitDir) {
    warnings.push({
      category: "git",
      message: "Git directory not found. Skipping git history insights.",
      severity: "medium"
    });
    return null;
  }

  if (await isFile(path.join(targetAbs, ".git", "shallow"))) {
    warnings.push({
      category: "git",
      message: "Repository is a shallow clone; statistics are limited to local commits.",
      severity: "medium"
    });
  }

  const gitCheck = await runCmd("git rev-parse --is-inside-work-tree", targetAbs);
  if (!gitCheck.success) {
    warnings.push({
      category: "git",
      message: "Target is not a valid git repository or Git binary is missing.",
      severity: "medium"
    });
    return null;
  }

  const countCmd = await runCmd("git rev-list --count --all", targetAbs);
  if (countCmd.success) {
    result.commitCount = parseInt(countCmd.out.trim(), 10) || 0;
  }

  const lastCmd = await runCmd("git log -1 --format=%cI", targetAbs);
  if (lastCmd.success && lastCmd.out.trim()) {
    result.lastCommitDate = lastCmd.out.trim();
  }

  let shortlogCmd = await runCmd("git shortlog -sn --all --mailmap", targetAbs);
  if (!shortlogCmd.success) {
    shortlogCmd = await runCmd("git shortlog -sn --all", targetAbs);
  }
  if (shortlogCmd.success) {
    const lines = shortlogCmd.out.trim().split("\n");
    result.contributorCount = lines.filter(Boolean).length;
    
    lines.slice(0, 5).forEach(line => {
      const parts = line.trim().split(/\t+/);
      if (parts[1]) {
        result.topContributors.push({ email: parts[1], commitCount: parseInt(parts[0], 10) || 0 });
      } else {
        const spaceParts = line.trim().split(/\s+/);
        if (spaceParts[1]) {
          result.topContributors.push({ email: spaceParts.slice(1).join(" "), commitCount: parseInt(spaceParts[0], 10) || 0 });
        }
      }
    });
  }

  const branchesCmd = await runCmd("git branch -a --format='%(refname:short)'", targetAbs);
  if (branchesCmd.success) {
    const list = branchesCmd.out.trim().split("\n").map(b => b.replace(/'/g, "").trim()).filter(Boolean);
    result.activeBranches = [...new Set(list)].slice(0, 10);
  }

  const tagsCmd = await runCmd("git for-each-ref --sort=-taggerdate --format='%(refname:short)|%(taggerdate:iso8601)|%(subject)' refs/tags", targetAbs);
  if (tagsCmd.success) {
    const lines = tagsCmd.out.trim().split("\n").filter(Boolean);
    result.tagCount = lines.length;
    lines.slice(0, 5).forEach(line => {
      const parts = line.replace(/'/g, "").split("|");
      if (parts[0]) {
        result.releases.push({
          tag: parts[0],
          date: parts[1] || null,
          message: parts[2] || ""
        });
      }
    });
  }

  if (result.commitCount > 500) result.commitFrequency = "high";
  else if (result.commitCount > 100) result.commitFrequency = "medium";
  else result.commitFrequency = "low";

  return result;
}

// 2e. Configuration
async function analyzeConfiguration(targetAbs, filesInfo) {
  const result = {
    configurationFiles: {
      present: [],
      byCategory: { build: [], testing: [], linting: [], ci_cd: [], deployment: [], security: [] }
    },
    environmentConfiguration: {
      hasEnvExample: false,
      envVariablesCount: 0,
      secretsManagement: "none",
      evidence: []
    }
  };

  const configsMap = [
    { name: "package.json", category: "build", tool: "npm/yarn/pnpm", purpose: "Node project manifest" },
    { name: "tsconfig.json", category: "build", tool: "TypeScript", purpose: "TypeScript compiler config" },
    { name: "webpack.config.js", category: "build", tool: "Webpack", purpose: "JS bundler configuration" },
    { name: "vite.config.ts", category: "build", tool: "Vite", purpose: "Vite dev and bundle config" },
    { name: "pom.xml", category: "build", tool: "Maven", purpose: "Java Maven build file" },
    { name: "build.gradle", category: "build", tool: "Gradle", purpose: "Java Gradle build file" },
    { name: "pyproject.toml", category: "build", tool: "Poetry/pip", purpose: "Python package config" },
    { name: "Cargo.toml", category: "build", tool: "Cargo", purpose: "Rust crate configuration" },
    { name: "go.mod", category: "build", tool: "Go", purpose: "Go module definition" },
    { name: "Makefile", category: "build", tool: "Make", purpose: "Universal build automator" },
    { name: "CMakeLists.txt", category: "build", tool: "CMake", purpose: "C/C++ project cmake file" },
    { name: "jest.config.js", category: "testing", tool: "Jest", purpose: "JS test runner configuration" },
    { name: "vitest.config.ts", category: "testing", tool: "Vitest", purpose: "JS test framework configuration" },
    { name: "pytest.ini", category: "testing", tool: "pytest", purpose: "Python test configuration" },
    { name: "cypress.config.ts", category: "testing", tool: "Cypress", purpose: "E2E testing configuration" },
    { name: "playwright.config.ts", category: "testing", tool: "Playwright", purpose: "E2E testing configuration" },
    { name: ".eslintrc.json", category: "linting", tool: "ESLint", purpose: "JS/TS linter rules" },
    { name: ".eslintrc.js", category: "linting", tool: "ESLint", purpose: "JS/TS linter rules" },
    { name: ".eslintrc", category: "linting", tool: "ESLint", purpose: "JS/TS linter rules" },
    { name: "eslint.config.js", category: "linting", tool: "ESLint", purpose: "Flat ESLint configuration" },
    { name: ".prettierrc", category: "linting", tool: "Prettier", purpose: "Code formatter rules" },
    { name: ".gitignore", category: "build", tool: "Git", purpose: "Git ignored file patterns" },
    { name: "Dockerfile", category: "deployment", tool: "Docker", purpose: "Docker image definition" },
    { name: "docker-compose.yml", category: "deployment", tool: "Docker Compose", purpose: "Multi-container app runner" },
    { name: "serverless.yml", category: "deployment", tool: "Serverless", purpose: "Serverless Framework configuration" },
    { name: "SECURITY.md", category: "security", tool: "Security", purpose: "Project security disclosure guidelines" },
    { name: "dependabot.yml", category: "security", tool: "Dependabot", purpose: "Automated dependency updates" }
  ];

  for (const file of filesInfo) {
    const match = configsMap.find(c => c.name === file.name);
    if (match) {
      result.configurationFiles.present.push({ file: file.path, purpose: match.purpose, tool: match.tool });
      result.configurationFiles.byCategory[match.category].push(file.path);
    }
    
    if (file.path.startsWith(".github/workflows/")) {
      result.configurationFiles.present.push({ file: file.path, purpose: "GitHub Actions workflow", tool: "GitHub Actions" });
      if (!result.configurationFiles.byCategory.ci_cd.includes(file.path)) {
        result.configurationFiles.byCategory.ci_cd.push(file.path);
      }
    }
  }

  const envExample = filesInfo.find(f => f.name === ".env.example" || f.name === "env.example");
  if (envExample) {
    result.environmentConfiguration.hasEnvExample = true;
    const content = await readText(path.join(targetAbs, envExample.path));
    if (content) {
      const vars = content.split("\n").filter(line => line.trim() && !line.startsWith("#") && line.includes("="));
      result.environmentConfiguration.envVariablesCount = vars.length;
      
      const text = content.toLowerCase();
      if (text.includes("vault") || text.includes("hcvault")) {
        result.environmentConfiguration.secretsManagement = "vault";
        result.environmentConfiguration.evidence.push("Vault references in .env.example");
      } else if (text.includes("secret") || text.includes("token") || text.includes("key")) {
        result.environmentConfiguration.secretsManagement = "env";
        result.environmentConfiguration.evidence.push("Key/Token strings in .env.example");
      }
    }
  }

  for (const file of filesInfo) {
    if (file.size < 100 * 1024 && ["js", "ts", "py", "go"].includes(file.ext)) {
      const txt = await readText(path.join(targetAbs, file.path)) || "";
      if (txt.includes("SecretsManagerClient") || txt.includes("secretsmanager")) {
        result.environmentConfiguration.secretsManagement = "secrets-manager";
        if (!result.environmentConfiguration.evidence.includes("AWS SecretsManager code references")) {
          result.environmentConfiguration.evidence.push("AWS SecretsManager code references");
        }
      }
    }
  }

  return result;
}

// 2f. Documentation Completeness
async function analyzeDocumentation(targetAbs, filesInfo, codeStruct) {
  const result = {
    readme: {
      exists: false,
      sizeBytes: 0,
      sections: [],
      hasGettingStarted: false,
      hasContributing: false,
      hasLicense: false
    },
    architectureDocs: {
      hasArchitecturemd: false,
      hasAdrDirectory: false,
      adrCount: 0,
      hasSystemDiagrams: false
    },
    apiDocs: {
      hasOpenapi: false,
      hasSwagger: false,
      hasJsdoc: false,
      hasPydoc: false
    },
    completionScore: 0
  };

  let readmeFile = null;
  for (const name of ["README.md", "README.adoc", "README.rst", "README.txt", "README"]) {
    readmeFile = filesInfo.find(f => f.path.toLowerCase() === name.toLowerCase());
    if (readmeFile) break;
  }

  let readmeScore = 0;
  if (readmeFile) {
    result.readme.exists = true;
    result.readme.sizeBytes = readmeFile.size;
    readmeScore += 10;
    if (readmeFile.size >= 2048) readmeScore += 10;

    const txt = await readText(path.join(targetAbs, readmeFile.path)) || "";
    for (let line of txt.split("\n")) {
      const m = line.match(/^(#+)\s+(.+)$/);
      if (m) {
        result.readme.sections.push({ heading: m[2].trim(), level: m[1].length });
      }
    }
    
    const headingsText = result.readme.sections.map(s => s.heading.toLowerCase()).join(" ");
    if (/getting[- ]started/i.test(headingsText) || /install/i.test(headingsText)) {
      result.readme.hasGettingStarted = true;
      readmeScore += 10;
    }
    if (/contribut/i.test(headingsText) || /license/i.test(headingsText)) {
      result.readme.hasContributing = true;
      result.readme.hasLicense = headingsText.includes("license");
      readmeScore += 10;
    }
  }

  let archScore = 0;
  const archFile = filesInfo.find(f => f.name.toLowerCase() === "architecture.md");
  if (archFile) {
    result.architectureDocs.hasArchitecturemd = true;
    archScore += 15;
  }

  const adrDirs = ["docs/adr", "adr", ".github/adr"];
  const hasAdrDir = filesInfo.some(f => adrDirs.some(d => f.path.startsWith(d + "/")));
  const adrFiles = filesInfo.filter(f => f.name.startsWith("ADR_") || f.path.includes("/adr/"));
  if (hasAdrDir || adrFiles.length > 0) {
    result.architectureDocs.hasAdrDirectory = true;
    result.architectureDocs.adrCount = adrFiles.length;
    archScore += 15;
  }

  const diagDirs = ["docs/diagrams", "docs/system-diagrams", "ai/analysis/diagrams"];
  if (filesInfo.some(f => diagDirs.some(d => f.path.startsWith(d + "/")))) {
    result.architectureDocs.hasSystemDiagrams = true;
  }

  let apiScore = 0;
  if (filesInfo.some(f => ["openapi.yaml", "openapi.json", "openapi.yml"].includes(f.name.toLowerCase()))) {
    result.apiDocs.hasOpenapi = true;
    apiScore += 15;
  } else if (filesInfo.some(f => ["swagger.json", "swagger.yaml", "swagger.yml"].includes(f.name.toLowerCase()))) {
    result.apiDocs.hasSwagger = true;
    apiScore += 15;
  }

  if (codeStruct.docstringPercent >= 20) {
    result.apiDocs.hasJsdoc = filesInfo.some(f => ["js", "ts"].includes(f.ext));
    result.apiDocs.hasPydoc = filesInfo.some(f => f.ext === "py");
    apiScore += 15;
  }

  result.completionScore = readmeScore + archScore + apiScore;
  return result;
}

// 2g. Testing Coverage
async function analyzeTesting(targetAbs, filesInfo) {
  const result = {
    testFileCount: 0,
    testDirectories: [],
    frameworks: [],
    hasCI: false,
    hasCoverage: false,
    coverageThreshold: null,
    e2eTests: false,
    integrationTests: false,
    unitTests: false
  };

  const testDirs = ["test", "tests", "spec", "__tests__", "integration-tests", "e2e", "cypress", "playwright"];
  for (const d of testDirs) {
    if (await isDir(path.join(targetAbs, d))) {
      result.testDirectories.push(d + "/");
      if (["e2e", "cypress", "playwright"].includes(d)) result.e2eTests = true;
      if (d === "integration-tests") result.integrationTests = true;
    }
  }

  for (const file of filesInfo) {
    const isTest = file.path.includes("/test") || file.path.includes("/spec") || file.path.includes("__tests__") || file.name.includes("test") || file.name.includes("spec");
    if (isTest) result.testFileCount++;

    if (file.name === "package.json") {
      const raw = await readText(path.join(targetAbs, file.path));
      try {
        const pkg = JSON.parse(raw);
        const allDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        ["jest", "vitest", "mocha", "playwright", "cypress"].forEach(f => {
          if (allDeps.some(d => d.includes(f))) result.frameworks.push(f);
        });
      } catch {}
    } else if (file.name === "pyproject.toml") {
      const raw = await readText(path.join(targetAbs, file.path)) || "";
      if (raw.includes("pytest")) result.frameworks.push("pytest");
    } else if (file.name === "pom.xml") {
      const raw = await readText(path.join(targetAbs, file.path)) || "";
      if (raw.includes("junit")) result.frameworks.push("junit");
    }
  }

  result.frameworks = [...new Set(result.frameworks)];
  result.hasCI = filesInfo.some(f => f.path.startsWith(".github/workflows/") || f.path === ".gitlab-ci.yml");
  result.hasCoverage = filesInfo.some(f => f.path.startsWith("coverage/") || f.path.startsWith(".nyc_output/") || f.name === "coverage.xml");

  const jestConf = filesInfo.find(f => f.name.includes("jest.config"));
  if (jestConf) {
    const txt = await readText(path.join(targetAbs, jestConf.path)) || "";
    const m = txt.match(/thresholds?.*?(\d+)/i) || txt.match(/branches.*?(\d+)/i);
    if (m) result.coverageThreshold = parseInt(m[1], 10);
  }

  result.unitTests = result.testFileCount > 0;

  return result;
}

// Single-pass Walk function
async function walk(dir, rootDir, gitignoreRules, filesInfo, warnings) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    warnings.push({
      category: "filesystem",
      message: `Failed to read directory ${path.relative(rootDir, dir) || "."}: ${err.message}`,
      severity: "medium"
    });
    return;
  }

  const baseIgnores = new Set(["node_modules", ".git", ".venv", "dist", "build", "target", "bin", "obj", "__pycache__", ".claude", "ai"]);
  const binaryExtensions = new Set(["png", "jpg", "jpeg", "gif", "ico", "webp", "mp4", "mp3", "zip", "tar", "gz", "exe", "dll", "so", "dylib", "woff", "woff2", "eot", "ttf", "pdf", "pyc"]);

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    if (baseIgnores.has(entry.name)) continue;

    let isIgnored = false;
    for (const rule of gitignoreRules) {
      if (rule.test(relPath) || rule.test(entry.name)) {
        isIgnored = true;
        break;
      }
    }
    if (isIgnored) continue;

    if (entry.isDirectory()) {
      await walk(fullPath, rootDir, gitignoreRules, filesInfo, warnings);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase().slice(1);
      if (binaryExtensions.has(ext)) continue;
      
      let size = 0;
      try {
        const st = await fs.stat(fullPath);
        size = st.size;
      } catch {}

      filesInfo.push({
        path: relPath,
        name: entry.name,
        ext,
        size
      });
    }
  }
}

// ---------------------------------------------------- Main Entry
export async function indepth(targetAbs, flags) {
  const startTime = Date.now();
  const warnings = [];
  const recommendations = [];

  const gitignoreRules = await parseGitignore(targetAbs);
  const filesInfo = [];
  
  await walk(targetAbs, targetAbs, gitignoreRules, filesInfo, warnings);

  const dependencies = await detectDependencies(targetAbs, filesInfo);
  const codeStruct = await analyzeCodeStructureAndDocs(targetAbs, filesInfo);
  const archResult = await inferArchitecture(targetAbs, filesInfo, codeStruct);
  const gitHistory = await analyzeGitHistory(targetAbs, warnings);
  const configuration = await analyzeConfiguration(targetAbs, filesInfo);
  const documentation = await analyzeDocumentation(targetAbs, filesInfo, codeStruct);
  const testing = await analyzeTesting(targetAbs, filesInfo);

  const scalability = {
    hasDocker: filesInfo.some(f => f.name === "Dockerfile"),
    hasKubernetes: filesInfo.some(f => f.path.startsWith("k8s/") || f.path.startsWith("kubernetes/")),
    hasLoadBalancing: archResult.scalabilityIndicators.hasLoadBalancing,
    hasWorkerPool: archResult.scalabilityIndicators.evidence.some(e => e.toLowerCase().includes("worker") || e.toLowerCase().includes("thread")),
    hasCaching: archResult.scalabilityIndicators.hasCaching,
    hasAsyncPatterns: archResult.scalabilityIndicators.hasAsync,
    databaseConnectionPooling: archResult.scalabilityIndicators.evidence.includes("DB Pool settings"),
    evidence: archResult.scalabilityIndicators.evidence
  };

  const buildSystem = filesInfo.some(f => ["package.json", "pom.xml", "pyproject.toml", "Cargo.toml", "go.mod"].includes(f.name));
  const hasGit = await isDir(path.join(targetAbs, ".git"));
  
  if (!buildSystem) {
    warnings.push({ category: "build", message: "Build system marker files are completely absent (e.g., no package.json, pyproject.toml).", severity: "critical" });
  }
  if (!hasGit) {
    warnings.push({ category: "version_control", message: "Version control (.git) is completely absent.", severity: "critical" });
  }
  if (testing.testFileCount === 0) {
    warnings.push({ category: "testing", message: "Test directories and files are missing entirely.", severity: "high" });
    recommendations.push({ area: "Testing", suggestion: "Introduce unit and integration testing suite", rationale: "Adding tests prevents regression and maps repository reliability." });
  }
  const hasGitignore = filesInfo.some(f => f.name === ".gitignore");
  if (!hasGitignore) {
    warnings.push({ category: "gitignore", message: ".gitignore is missing or is empty.", severity: "high" });
  }
  
  const envExample = filesInfo.some(f => f.name === ".env.example");
  const usesEnv = await isFile(path.join(targetAbs, ".env"));
  if (!envExample && usesEnv) {
    warnings.push({ category: "config", message: ".env.example is missing but code utilizes .env settings.", severity: "medium" });
    recommendations.push({ area: "Configuration", suggestion: "Create a .env.example file", rationale: "Helps contributors configure local environments without leaking real secrets." });
  }
  const hasLicense = filesInfo.some(f => ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "COPYING"].includes(f.name));
  if (!hasLicense) {
    warnings.push({ category: "license", message: "No LICENSE or COPYING file is found.", severity: "medium" });
  }

  if (!documentation.architectureDocs.hasArchitecturemd) {
    recommendations.push({ area: "Documentation", suggestion: "Create an ARCHITECTURE.md outlining system components", rationale: "Provides onboarding agents and human developers an entry point structure map." });
  }
  if (gitHistory && warnings.some(w => w.message.includes("shallow clone"))) {
    recommendations.push({ area: "Git", suggestion: "Perform a full clone to enable complete commit history analysis", rationale: "Enables deeper analysis of code ownership, change patterns, and key files." });
  }
  const hasLinter = filesInfo.some(f => f.name.includes(".eslintrc") || f.name.startsWith("eslint.config") || f.name.includes(".prettierrc") || f.name.includes("ruff.toml"));
  if (!hasLinter) {
    recommendations.push({ area: "Configuration", suggestion: "Add standard linting and formatting configuration to maintain code quality", rationale: "Prevents code drift and style anomalies across contributions." });
  }

  const executionTime = Date.now() - startTime;

  return {
    _comment: "Generated by ai-fication-kit `indepth` — deterministic analysis with heuristic inference. Human verification recommended for architecture inference.",
    kitVersion: KIT_VERSION,
    generated: new Date().toISOString(),
    analysisLevel: "indepth",
    executionTime,
    dependencies,
    codeStructure: {
      codeMetrics: codeStruct.codeMetrics,
      directoryStructure: codeStruct.directoryStructure,
      moduleStructure: codeStruct.moduleStructure,
      codeDistribution: codeStruct.codeDistribution
    },
    architecture: archResult.inferredArchitecture,
    communicationPatterns: archResult.communicationPatterns,
    gitHistory,
    configuration: configuration.configurationFiles,
    environmentConfiguration: configuration.environmentConfiguration,
    documentation: {
      readme: documentation.readme,
      architectureDocs: documentation.architectureDocs,
      apiDocs: documentation.apiDocs,
      completionScore: documentation.completionScore
    },
    testing,
    scalability,
    warnings,
    recommendations
  };
}

export function printIndepthReport(r) {
  const L = (s) => style.dim(s.padEnd(20));
  const heading = (s) => console.log("\n" + style.bold(style.coral(`=== ${s} ===`)));

  heading("INDEPTH ANALYSIS SUMMARY");
  console.log(`  ${L("Execution time")}${r.executionTime}ms`);
  console.log(`  ${L("Files & LOC")}${r.codeStructure.codeMetrics.fileCount} files, ${r.codeStructure.codeMetrics.linesOfCode} lines of code`);
  
  heading("DEPENDENCY ANALYSIS");
  console.log(`  ${L("Total Dependencies")}${r.dependencies.total}`);
  console.log(`  ${L("Direct / Transitive")}${r.dependencies.direct} / ${r.dependencies.transitive}`);
  console.log(`  ${L("Production / Dev")}${r.dependencies.byCategory.production} / ${r.dependencies.byCategory.development}`);

  heading("ARCHITECTURE & SCALABILITY");
  console.log(`  ${L("Inferred Pattern")}${style.bold(r.architecture.pattern)} (Confidence: ${Math.round(r.architecture.confidence * 100)}%)`);
  if (r.architecture.layers && r.architecture.layers.length > 0) {
    console.log(`  ${L("Layers Detected")}${r.architecture.layers.map(l => l.name).join(", ")}`);
  }
  console.log(`  ${L("Http Server")}${r.communicationPatterns.httpServer ? style.green("Yes") : style.gray("No")}`);
  console.log(`  ${L("Database Access")}${r.communicationPatterns.databaseAccess ? style.green("Yes") : style.gray("No")}`);
  console.log(`  ${L("Caching")}${r.scalability.hasCaching ? style.green("Yes") : style.gray("No")}`);

  if (r.gitHistory) {
    heading("GIT HISTORY");
    console.log(`  ${L("Commit Count")}${r.gitHistory.commitCount}`);
    console.log(`  ${L("Contributors")}${r.gitHistory.contributorCount}`);
    console.log(`  ${L("Last Commit")}${r.gitHistory.lastCommitDate || "N/A"}`);
  }

  heading("DOCUMENTATION");
  console.log(`  ${L("Completion Score")}${r.documentation.completionScore}/100`);
  console.log(`  ${L("README Exists")}${r.documentation.readme.exists ? style.green("Yes") : style.red("No")}`);
  console.log(`  ${L("Architecture Map")}${r.documentation.architectureDocs.hasArchitecturemd ? style.green("Yes") : style.red("No")}`);
  console.log(`  ${L("ADR Log")}${r.documentation.architectureDocs.hasAdrDirectory ? style.green("Yes") : style.red("No")}`);

  if (r.warnings.length > 0) {
    heading("WARNINGS");
    r.warnings.forEach(w => {
      const sev = w.severity === "critical" ? style.red("CRITICAL") : w.severity === "high" ? style.amber("HIGH") : style.dim("MEDIUM");
      console.log(`  [${sev}] ${w.message}`);
    });
  }

  if (r.recommendations.length > 0) {
    heading("RECOMMENDATIONS");
    r.recommendations.forEach(rec => {
      console.log(`  ${style.bold(`• [${rec.area}]`)} ${rec.suggestion}`);
      console.log(`    ${style.gray(`Rationale: ${rec.rationale}`)}`);
    });
  }
  console.log("");
}
