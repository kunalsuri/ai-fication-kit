<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Two-Tier Analysis Architecture: Orient + Indepth

## High-level design

**Problem:** `orient` should stay lightweight. But users need deeper analysis for full onboarding.

**Solution:** Two-tier system with user choice at entry point.

```
User runs: npm run shazam  OR  npm run orient -- --interactive
    ↓
Interactive prompt:
  "What analysis level do you want?
   1) General (quick profile)
   2) Indepth (comprehensive)"
    ↓
    ├─→ Option 1: Run orient (existing)
    │   Output: ai/repo-profile.json (fast, ~200ms)
    │
    └─→ Option 2: Run orient + indepth (new)
        Output: ai/repo-profile.json + ai/repo-indepth.json (slower, ~2-5s)

User runs: npm run orient (no flags)
    ↓
Bypasses prompt (non-interactive)
    ↓
Runs General profile (existing behavior)
Output: ai/repo-profile.json (~200ms)
```

---

## Entry Point: Interactive Shazam/Orient Command

### New command: `npm run shazam` (Interactive default) or `npm run orient -- --interactive`

**Behavior:**

```
$ npm run shazam

╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ai-fication-kit                                      v0.1.0 ║
║     a trusted map for AI agents                             ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝

Analysis level?

  [1] General (quick profile)
      → Detects language, build system, frameworks, code quality
      → Output: ai/repo-profile.json
      → Time: ~200ms
      → Best for: Quick onboarding, CI/CD pipelines

  [2] Indepth (comprehensive analysis)
      → Includes: dependency graph, code metrics, architecture inference
      → Output: ai/repo-profile.json + ai/repo-indepth.json
      → Time: ~2-5s
      → Best for: Full codebase understanding, refactoring planning

Choose [1] or [2] (default: 1): _
```

**Implementation:**

- **Interactive Default:** `npm run shazam` triggers interactive mode by default.
- **Orient Compatibility:** `npm run orient` without flags runs Tier 1 General analysis directly and does **not** prompt (non-interactive by default, ensuring backward compatibility for automated scripts). It can be run interactively via `npm run orient -- --interactive` or `npm run orient -- -i`.
- Use Node's `readline` (already in `lib/util.mjs`) / Python's `input()`.
- Add flag `--analysis-level general|indepth` (or `--indepth`) to skip prompt and select the level directly.
- Add flag `--skip-prompt` to use defaults.
- **Interactive Check:** Use the existing helper `isInteractive()` in [util.mjs](file:///c:/Users/ks248120/Documents/GitHub/ai-fication-kit/lib/util.mjs) (Node) and `sys.stdin.isatty()` (Python) to check if the session is interactive. If `!isInteractive()`, or if `--skip-prompt` is provided, bypass the prompt completely and default to Tier 1 General analysis (unless `--analysis-level indepth` is explicitly specified).

---

## Tier 1: General (Existing `orient`)

**Output file:** `ai/repo-profile.json`

**Fields (no changes to existing orient):**

```json
{
  "projectName": string,
  "description": string,
  "languages": string[],
  "buildSystems": string[],
  "buildCmd": string,
  "testCmd": string,
  "fork": object,
  "testDirs": string[],
  "notes": string[],
  "maturity": {
    "score": number,
    "level": string,
    "process": number
  },
  "existingAIConfig": object
}
```

**Execution time:** ~200ms (file system only)

**Properties:**

- ✓ Zero execution
- ✓ Pure file-existence checks
- ✓ Deterministic
- ✓ 99.8% confidence

---

## Tier 2: Indepth (NEW UTILITY)

**Output file:** `ai/repo-indepth.json`

**Scope:** Comprehensive detective work on codebase structure, code metrics, and architectural patterns.

### 2a. Dependency Analysis

```json
{
  "dependencies": {
    "total": number,
    "direct": number,
    "transitive": number,
    "byCategory": {
      "production": number,
      "development": number,
      "optional": number
    }
  },
  "topLevelDeps": [
    { "name": string, "version": string, "category": "prod|dev|optional" }
  ]
}
```

**How detected:**

To satisfy the strict **zero-dependency** constraint (e.g., no external TOML or custom Yarn/Poetry parser packages), dependency analysis is split into:
1. **Direct (Top-Level) Dependencies:** Read from primary manifest files (which are either JSON or simple structures easily parsed with regex or standard string scanning).
2. **Total & Transitive Counts:** Counted via line/pattern heuristics in lock files rather than parsing their full AST.

- **JS/TS:**
  - *Direct:* Parse `package.json` (as JSON) to extract dependencies and devDependencies names/versions.
  - *Total/Transitive:* Parse `package-lock.json` (as JSON) if present, or count package blocks (e.g., matching indentation patterns) in `yarn.lock`/`pnpm-lock.yaml` using a line-by-line scanner to avoid pulling in external YAML/custom parsers.
- **Python:**
  - *Direct:* Read `pyproject.toml` or `setup.py` / `requirements.txt` via simple line regex (e.g., matching strings inside `dependencies = [...]`).
  - *Total/Transitive:* Scan `poetry.lock` or `Pipfile.lock` line-by-line, counting the occurrences of `[[package]]` or package-block indicators, avoiding the need for a full TOML parser.
- **Java:**
  - *Direct & Total:* Parse `pom.xml` or `build.gradle` using simple XML/text regex matchers (e.g., extracting `<dependency>` tags and nested `<scope>`).
- **Go:**
  - *Direct:* Parse `go.mod` (extract `require` blocks, distinguishing indirect dependencies).
  - *Total/Transitive:* Scan lines in `go.sum` and divide by two (since `go.sum` typically has two entries per module version), or count unique module lines.
- **Rust:**
  - *Direct:* Parse `Cargo.toml` dependencies tables using simple regex/string splits.
  - *Total/Transitive:* Scan `Cargo.lock` for occurrences of `[[package]]` lines.
- **Ruby:**
  - *Direct:* Parse `Gemfile` via regex.
  - *Total/Transitive:* Count package blocks/lines in `Gemfile.lock`.
- **PHP:**
  - *Direct & Total:* Parse `composer.json` and `composer.lock` (both are standard JSON files, parseable natively in Node.js and Python).
- **C/C++:**
  - *Direct:* Scan `CMakeLists.txt` for occurrences of `find_package()`.

**Vulnerability Audits Policy:** Under the zero-network and zero-dependency rule, vulnerability scanning (`knownVulnerabilities`, `outdated`, `vulnerable` counts) is **completely omitted** from the `indepth` tool to keep it fast, self-contained, and local.

**Confidence:** 99% (lock files are canonical)

### 2b. Code Structure Analysis

```json
{
  "codeMetrics": {
    "fileCount": number,
    "linesOfCode": number,
    "sourceFilesOnly": number,
    "testFileCount": number,
    "documentationFiles": number
  },
  "directoryStructure": {
    "depth": number,
    "avgBranchingFactor": number,
    "standardDirs": [
      { "name": string, "purpose": string, "fileCount": number }
    ]
  },
  "moduleStructure": [
    { "name": string, "fileCount": number, "dependencies": string[] }
  ],
  "codeDistribution": {
    "src": number,
    "test": number,
    "docs": number,
    "config": number,
    "other": number
  }
}
```

**How detected (language-independent):**

- **Recursive Walk constraints:**
  - **Ignore List:** Automatically skip large or build directories: `node_modules`, `.git`, `.venv`, `.env`, `dist`, `build`, `target`, `bin`, `obj`, and standard binary files (.png, .jpg, .zip, .exe, etc.).
  - **Gitignore Respect:** Parse and respect standard `.gitignore` rules in the repository to prevent analyzing uncommitted/generated files.
    - *Gitignore Parsing Shortcut:* Conforming to the full, formal `.gitignore` specification (including negations, subfolder overrides, and recursive wildcards) is highly complex. The parser is permitted to use a simplified glob-to-regex conversion or basic prefix/suffix matchers for the patterns defined in the root `.gitignore` file, prioritizing speed and simplicity over full specification compliance.
  - **Resource Limits:** Implement concurrency-limiting logic (e.g., chunked parsing queue) when reading files to avoid exceeding Node.js or OS file descriptor limits (`EMFILE` error).
- **Module and Cross-Module Imports:** For each module, extract imports by scanning file lines for common keywords (`import`, `require`, `use`, `using`, etc.).
- **LOC and Comment Stripping Heuristic:** Instead of writing complex language parsers, use a simplified, regex-based heuristic for major supported languages:
  - **Line Comments:** Skip lines starting with `//` (JS/TS, Go, Rust, Java, C/C++), `#` (Python, Ruby, Makefile, shell), `--` (SQL, Haskell), or `%` (LaTeX).
  - **Block Comments:** Naively skip multi-line blocks starting with `/*` and ending with `*/`, or Python triple quotes `"""` / `'''`.
  - **Blank Lines:** Exclude empty lines and lines consisting entirely of whitespace.

**Confidence:** 99.9% (file system is authoritative)

**Execution time:** ~1-2s for typical codebases (<100k files)

### 2c. Architecture Inference

```json
{
  "inferredArchitecture": {
    "pattern": "layered|microservices|monolithic|modular|plugin|hybrid",
    "confidence": number,
    "layers": [
      { "name": string, "directories": string[], "responsibility": string }
    ]
  },
  "communicationPatterns": {
    "httpServer": boolean,
    "messageQueue": boolean,
    "databaseAccess": boolean,
    "externalAPIs": boolean,
    "evidence": string[]
  },
  "scalabilityIndicators": {
    "hasLoadBalancing": boolean,
    "hasCaching": boolean,
    "hasAsync": boolean,
    "evidence": string[]
  }
}
```

**How detected:**

- **Layered:** Standard dir structure (src/controllers, src/services, src/models, src/database)
- **Microservices:** Multiple `package.json` at top level OR services/ subdirs with independent builds
- **Monolithic:** Single large src/ with many features
- **Plugin-based:** plugins/, extensions/, addons/ directories with common interface
- **HTTP server:** Express, FastAPI, Spring Boot detection + presence of route files
- **Message queue:** Celery, RabbitMQ, Kafka imports in code
- **Database:** SQLAlchemy, Prisma, Sequelize, GORM, Entity Framework config files
- **External APIs:** `.env.example` with API_KEY, requests/axios/http client imports
- **Async:** Tokio, asyncio, Promise/async-await usage
- **Caching:** Redis, Memcached, LRU cache imports

**Confidence:** 85-95% (heuristic-based, human verification recommended)

### 2d. Git History Insights

```json
{
  "gitAnalysis": {
    "commitCount": number,
    "contributorCount": number,
    "commitFrequency": "high|medium|low",
    "lastCommitDate": ISO8601,
    "topContributors": [
      { "email": string, "commitCount": number }
    ],
    "activeBranches": string[],
    "tagCount": number,
    "releases": [
      { "tag": string, "date": ISO8601, "message": string }
    ]
  }
}
```

**How detected:**

- **Git CLI Execution:** Run standard Git commands as subprocesses (e.g. `git log`, `git shortlog`, `git branch`, `git tag`) via process execution modules in Node.js (`child_process`) and Python (`subprocess`).
  - Total commits count: `git rev-list --count --all`
  - Contributor list and commit counts: `git shortlog -sn --all --mailmap`
  - Last commit date: `git log -1 --format=%cI`
  - Active branches: `git branch -a --format="%(refname:short)"`
  - Releases/Tags: `git for-each-ref --sort=-taggerdate --format="%(refname:short)|%(taggerdate:iso8601)|%(subject)" refs/tags`
- **Subprocess Permission:** Under this specification, calling local `git` CLI binaries as a subprocess is explicitly allowed.
- **Graceful Fallbacks:**
  - *No Git CLI or Non-Git Repository:* If the `git` executable is not installed or the target folder is not a Git repository, the execution must catch the error, set `gitAnalysis` to `null`, and append a notice to the global `warnings` array (e.g., `{"category": "git", "message": "Git is not installed or the target is not a git repository. Git history analysis was skipped.", "severity": "medium"}`).
  - *Shallow Clones:* Check for the presence of the `.git/shallow` file. If present, append a warning: `{"category": "git", "message": "Repository is a shallow clone; statistics are limited to local commits.", "severity": "medium"}`.

**Confidence:** 99.9% (when Git CLI is available and repository is fully cloned)

**Execution time:** ~300ms (via quick subprocess execution)

### 2e. Configuration Inventory

```json
{
  "configurationFiles": {
    "present": [
      { "file": string, "purpose": string, "tool": string }
    ],
    "byCategory": {
      "build": string[],
      "testing": string[],
      "linting": string[],
      "ci_cd": string[],
      "deployment": string[],
      "security": string[]
    }
  },
  "environmentConfiguration": {
    "hasEnvExample": boolean,
    "envVariablesCount": number,
    "secretsManagement": "env|vault|secrets-manager|none",
    "evidence": string[]
  }
}
```

**How detected:**

- Scan root and common dirs for config files: `.eslintrc*`, `tsconfig.json`, `.github/workflows/*.yml`, `Dockerfile`, `docker-compose.yml`, `.env.example`, etc.
- Count vars in `.env.example`
- Detect secrets management: `.env.example` → env; `HashiCorp/vault` in docs → vault; `aws-secrets` in code → secrets-manager

**Confidence:** 99.5% (file existence is deterministic)

### 2f. Documentation Completeness

```json
{
  "documentation": {
    "readme": {
      "exists": boolean,
      "sizeBytes": number,
      "sections": [
        { "heading": string, "level": number }
      ],
      "hasGettingStarted": boolean,
      "hasContributing": boolean,
      "hasLicense": boolean
    },
    "architectureDocs": {
      "hasArchitecturemd": boolean,
      "hasAdrDirectory": boolean,
      "adrCount": number,
      "hasSystemDiagrams": boolean
    },
    "apiDocs": {
      "hasOpenapi": boolean,
      "hasSwagger": boolean,
      "hasJsdoc": boolean,
      "hasPydoc": boolean
    },
    "completionScore": number
  }
}
```

**How detected:**

- Parse README.md headings via regex
- Check for CONTRIBUTING.md, LICENSE
- Count `.md` files in docs/adr/, ADR_*.md patterns
- Detect `openapi.yaml`, `swagger.json`, `swagger.yml`
- Grep for JSDoc (`/**`), Python docstrings (`"""`)

**Confidence:** 99% (file-based, no LLM analysis of content)

### 2g. Testing Coverage Signals

```json
{
  "testing": {
    "testFileCount": number,
    "testDirectories": string[],
    "frameworks": string[],
    "hasCI": boolean,
    "hasCoverage": boolean,
    "coverageThreshold": number | null,
    "e2eTests": boolean,
    "integrationTests": boolean,
    "unitTests": boolean
  }
}
```

**How detected:**

- Count `*test*.js`, `*spec*.js`, `test_*.py` files
- Grep for Jest, Vitest, Mocha, pytest, RSpec, xUnit config
- Detect `coverage/`, `.nyc_output/`, `coverage.xml` → has coverage
- Look for e2e/, cypress/, playwright/ → e2e tests
- Parse test files for describe/it vs unit-style assertions

**Confidence:** 95% (test patterns are common but not universal)

### 2h. Performance & Scalability Indicators

```json
{
  "scalabilitySignals": {
    "hasDocker": boolean,
    "hasKubernetes": boolean,
    "hasLoadBalancing": boolean,
    "hasWorkerPool": boolean,
    "hasCaching": boolean,
    "hasAsyncPatterns": boolean,
    "databaseConnectionPooling": boolean,
    "evidence": string[]
  }
}
```

**How detected:**

- `Dockerfile`, `docker-compose.yml`, `.dockerignore` → Docker
- `k8s/`, `kubernetes/`, `*.yaml` with `kind: Pod|Deployment` → Kubernetes
- Nginx, HAProxy, load-balancer config → load balancing
- Thread pools, worker processes, goroutine patterns → worker pool
- Redis, Memcached, caching middleware imports → caching
- `async/await`, Promise chains, asyncio, Tokio → async patterns
- Connection pool configs in SQLAlchemy, Sequelize, GORM → connection pooling

**Confidence:** 90% (heuristic, requires manual verification)

---

## 2i. Output Schema: Complete `repo-indepth.json`

```json
{
  "_comment": "Generated by ai-fication-kit `indepth` — deterministic analysis with heuristic inference. Human verification recommended for architecture inference.",
  "kitVersion": string,
  "generated": ISO8601,
  "analysisLevel": "indepth",
  "executionTime": number,
  "dependencies": {
    "total": number,
    "direct": number,
    "transitive": number,
    "byCategory": {
      "production": number,
      "development": number,
      "optional": number
    }
  },
  "codeStructure": { ...2b... },
  "architecture": { ...2c... },
  "gitHistory": { ...2d... },
  "configuration": { ...2e... },
  "documentation": { ...2f... },
  "testing": { ...2g... },
  "scalability": { ...2h... },
  "warnings": [
    { "category": string, "message": string, "severity": "critical|high|medium" }
  ],
  "recommendations": [
    { "area": string, "suggestion": string, "rationale": string }
  ]
}
```

## Rule Engine & Scoring Formulas

The two-tier analysis system utilizes two primary quantitative scoring mechanisms: the existing repository `maturity.score` (which drives high-level process configuration) and the new `documentation.completionScore` (which evaluates how ready the repository's docs are for AI agents).

### 1. Repository Maturity Score (`maturity.score`)
Calculated deterministically during the initial scanning phase. The total score is capped at `100` and determines the repository's AI readiness tier:
- **Mature:** score >= 80
- **Developing:** score >= 50
- **Early:** score >= 25
- **Minimal:** score < 25

**Weights Table:**
| Component | Criteria / Metric | Max Points |
| :--- | :--- | :---: |
| **Version Control** | `.git` directory exists and tracks a branch | 15 |
| **Build System** | Standard manifest file present (e.g. `package.json`, `pom.xml`, `pyproject.toml`) | 15 |
| **Test Infra** | Test directory exists or test command is registered in package/manifest | 15 |
| **CI/CD** | CI/CD pipelines defined (e.g. GitHub Actions, GitLab CI, Jenkins) | 10 |
| **Documentation** | README exists (10 pts) + has `CONTRIBUTING.md` (2 pts) + has `docs/` folder (3 pts) | 15 |
| **Dependency Locks** | Lock file exists (`package-lock.json`, `poetry.lock`, `Cargo.lock`, etc.) | 10 |
| **Code Structure** | Standard source/package directories present (e.g. `src/`, `lib/`, `pkg/`) | 5 |
| **License** | LICENSE or COPYING file present | 5 |
| **Security** | `SECURITY.md` file present | 2 |
| **Gitignore** | `.gitignore` file exists (2 pts) + covers standard directories (1 pt) | 3 |
| **Total Maximum** | | **100** |

---

### 2. Documentation Completion Score (`documentation.completionScore`)
Calculated specifically in the Tier 2 Indepth run to grade the quality and completeness of documentation for onboarding. The score is graded out of `100`:

- **README Quality (40 Points Max):**
  - *Existence:* README file is present (`+10` points).
  - *Size Heuristic:* README size is >= 2KB (`+10` points).
  - *Getting Started:* Heading matching `/getting[- ]started/i` or `/install/i` found (`+10` points).
  - *Contribution & License info:* Headings matching `/contribut/i` or `/license/i` found (`+10` points).
- **Architecture Documentation (30 Points Max):**
  - *Architecture Map:* File matching `ARCHITECTURE.md` (case-insensitive) present in the repository (`+15` points).
  - *ADR Log:* An ADR folder exists (`docs/adr/`, `adr/`, or `.github/adr/`) containing at least one markdown file, OR files matching `ADR_*.md` exist (`+15` points).
- **API & Code Annotation (30 Points Max):**
  - *API Schemas:* OpenAPI, Swagger, or other API schema files present (`openapi.yaml`, `swagger.json`, etc.) (`+15` points).
  - *Docstrings/Comments:* Heuristic scan detects standard code comments or docstrings (JSDoc `/**`, Python triple-quotes `"""`, Rust `///`) in at least 20% of source files (`+15` points).

---

### 3. Warnings and Recommendations Engine

The warning array tracks potential blockers or high-risk repository anomalies, while the recommendations list provides actionable onboarding improvements.

#### Warning Generation Rules
- **Critical (Action Required):**
  - *Rule:* Build system marker files are completely absent (e.g., no `package.json`, `pyproject.toml`, etc.).
  - *Rule:* Version control (`.git`) is completely absent.
- **High Severity:**
  - *Rule:* Test directories and files are missing entirely.
  - *Rule:* `.gitignore` is missing or is empty.
- **Medium Severity:**
  - *Rule:* `.env.example` is missing but code walk detects imports or utilization of `process.env` / `os.environ` / `.env`.
  - *Rule:* Repository clone is identified as a shallow clone (presence of `.git/shallow`).
  - *Rule:* No LICENSE or COPYING file is found.

#### Recommendation Generation Rules
- **Area: Testing:** If total test files is `0` -> Suggestion: "Introduce unit and integration testing suite".
- **Area: Documentation:** If `hasArchitecturemd` is false -> Suggestion: "Create an ARCHITECTURE.md outlining system components".
- **Area: Git:** If repository is a shallow clone -> Suggestion: "Perform a full clone to enable complete commit history analysis".
- **Area: Configuration:** If no linting configuration files (ESLint, Prettier, Ruff, etc.) are detected -> Suggestion: "Add standard linting and formatting configuration to maintain code quality".

---

## Command Interface

### Standalone Command Registration

To expose `indepth` as a standalone command:

1. **Register `indepth`:** Add `"indepth"` to the `COMMANDS` set in `install.mjs` and `install.py`.
2. **Define Standalone behavior:** Add a command block for `"indepth"` in `install.mjs` / `install.py` that:
    - Runs the standard `orient` module internally to generate `ai/repo-profile.json` (if not already present).
    - Runs all 8 indepth detector modules.
    - Writes the results to `ai/repo-indepth.json`.
    - Prints the indepth report to stdout.
3. **Register npm Script:** Add `"indepth": "node install.mjs indepth"` to the `scripts` block of `package.json`.

### Separate commands

```bash
npm run orient          # Run general profile only
npm run indepth         # Run indepth analysis (implies orient first)
```

---

## Implementation Steps

### Phase 1: Entry point + general tier

1. Add interactive prompt to `install.mjs` (uses existing readline)
2. Branch to existing `orient()` or new `indepth()`
3. Update help text

### Phase 2: Indepth utility

1. Create `lib/indepth.mjs` with 8 detector functions (2a–2h)
2. Each function returns one section of the output
3. Call `orient()` first, then run all indepth checks in parallel
4. Aggregate into `repo-indepth.json`

### Phase 3: Testing + polish

1. Validate on test fixtures (each language)
2. Measure execution time, optimize if >5s
3. Add warnings/recommendations engine

---

## Timing & Confidence

| Component               | Time      | Confidence | Notes                               |
| ----------------------- | --------- | ---------- | ----------------------------------- |
| Orient (existing)       | ~200ms    | 99.8%      | No changes                          |
| Dependency analysis     | ~500ms    | 99%        | Lock file parsing                   |
| Code structure          | ~1.5s     | 99.9%      | File walk + import grep             |
| Architecture inference  | ~800ms    | 85-95%     | Heuristic-based                     |
| Git history             | ~500ms    | 99.9%      | Git objects authoritative           |
| Configuration inventory | ~300ms    | 99.5%      | File existence checks               |
| Documentation           | ~400ms    | 99%        | File parsing + regex                |
| Testing signals         | ~600ms    | 95%        | File pattern matching               |
| Scalability indicators  | ~400ms    | 90%        | Code pattern heuristics             |
| **Total (Indepth)**     | **~5-6s** | **95%**    | Parallelizable; sequential fallback |

**Confidence hierarchy:**

- 99.9%+ = file system, git, lock files (authoritative)
- 95-99% = config file parsing, standard patterns
- 85-95% = heuristic inference (requires human review)

---

## User Experience

### General (quick path)

```
$ npm run shazam

Choose analysis level:
[1] General (fast) ← DEFAULT
[2] Indepth (comprehensive)

Enter choice [1]: 1

✓ Analyzing repository...
✓ Wrote ai/repo-profile.json (200ms)
✓ Ready for /cold-start

Next: npm run install
```

### Indepth (thorough path)

```
$ npm run shazam

Choose analysis level:
[1] General (fast)
[2] Indepth (comprehensive) ← YOU WANT THIS
  - Dependency analysis
  - Code metrics
  - Architecture inference
  - Git insights
  - Full configuration scan

Enter choice [1]: 2

✓ Analyzing repository...
✓ Wrote ai/repo-profile.json (200ms)
✓ Wrote ai/repo-indepth.json (5s)

Next: Review ai/repo-indepth.json, then npm run install
```

---

## Specification Points to Add

### 1. **Two-tier design principle**

- Tier 1 (General/Orient): Fast, deterministic, file-markers only.
- Tier 2 (Indepth): Thorough, heuristic-assisted, 5-6 second execution.

### 2. **Interactive entry point**

- User chooses analysis level at start.
- Defaults to General (respect time) when running `npm run orient` without flags to maintain backward compatibility.
- Runs interactively by default when calling `npm run shazam`, or explicitly passing `--interactive` flag.
- Can skip prompt with `--skip-prompt` flag.
- Uses `isInteractive()` to bypass prompt automatically in non-TTY or CI settings.

### 3. **Separate output files**

- `ai/repo-profile.json` = General profile (always generated).
- `ai/repo-indepth.json` = Comprehensive analysis (Indepth only).

### 4. **Eight detector modules in Indepth**

- Dependencies (strictly offline, zero-network, utilizing JSON parsing and simple line-by-line lock file count heuristics).
- Code structure (ignoring node_modules/git/venv, with concurrency limits, simple comment heuristic, and a simplified regex-based gitignore shortcut).
- Architecture inference.
- Git history (supporting subprocess Git CLI execution with fallback configurations for missing git binary, non-git directories, and shallow clones).
- Configuration, documentation, testing, scalability.

### 5. **Confidence hierarchy**

- 99.9%+ for file/lock-based checks and Git (when CLI available).
- 95-99% for config parsing and standard patterns.
- 85-95% for heuristic architecture inference (flagged for review).

### 6. **Parallelizable execution**

- Run 8 detectors concurrently in Node.js, and multi-threaded or optimized-sequential walk in Python where applicable.
- Sequential fallback if filesystem performance degrades.

### 7. **Warnings + recommendations**

- Flag missing configs, test gaps, missing gitignores, and shallow git histories.
- Defined explicit formulas/scoring weights for `maturity.score` and documentation `completionScore`.
- Suggest improvements (e.g., "add .env.example").

### 8. **No breaking changes**

- Existing `orient` command behaves identically (runs Tier 1 by default).
- New utility is additive only.

---

## Python Implementation Design

Strict parity must be maintained between the JS (`install.mjs`) and Python (`install.py`) runtime utilities.

### CLI and Interactive Prompts

- **Interactive Check:** Check if running in an interactive terminal using `sys.stdin.isatty() and sys.stdout.isatty()`.
- **Command line parser:** Update `parse_args` in `install.py` to register the new command `indepth` and flags (`--analysis-level`, `--skip-prompt`).
- **Interactive Wizard:** Implement prompt flow using standard `input()` matching Node's `choose()` utility layout. Bypass prompt if not a TTY or `--yes` / `--skip-prompt` is set.

### Directory Walk and File Parsing

- **Ignore list filter:** Filter scanned files and directories using a common block/extension filter.
- **Gitignore matching:** Implement simplified glob-to-regex matching or prefix checks for paths specified in root `.gitignore`.
- **Comment Stripper Heuristic:** Use Python regex matching (`re.match`) to drop comment lines (e.g., matching `#` and standard comment markers) and triple-quote docstring boundaries.
- **Git CLI Subprocess:** Execute standard Git commands via Python's `subprocess.run` (e.g., `git log`, `git shortlog`) to fetch history metrics. Catch `FileNotFoundError` (if `git` is missing) or `CalledProcessError` (if the directory is not a Git repo) to degrade gracefully, setting `gitAnalysis` to `None`. Check for `.git/shallow` to detect shallow clones.
