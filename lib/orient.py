# Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
"""orient — deterministic stack detection.

Every check in this file is a file-existence or file-content test; nothing
is executed and nothing is inferred by a model. The output is
ai/repo-profile.json, which a human confirms during the audit.
"""

import json
import re
from datetime import datetime, timezone

from .util import KIT_VERSION
from .maturity import check_maturity

DETECTORS = [
    ("pom.xml",          "Java",                    "Maven",
     "mvn -B clean install -DskipTests", "mvn -B test"),
    ("build.gradle",     "Java/Kotlin",             "Gradle",
     "./gradlew build -x test", "./gradlew test"),
    ("build.gradle.kts", "Kotlin/Java",             "Gradle",
     "./gradlew build -x test", "./gradlew test"),
    ("package.json",     "JavaScript/TypeScript",   "npm",
     "npm install && npm run build", "npm test"),
    ("pyproject.toml",   "Python",                  "pyproject",
     "pip install -e .", "pytest"),
    ("requirements.txt", "Python",                  "pip",
     "pip install -r requirements.txt", "pytest"),
    ("go.mod",           "Go",                      "go",
     "go build ./...", "go test ./..."),
    ("Cargo.toml",       "Rust",                    "Cargo",
     "cargo build", "cargo test"),
    ("Gemfile",          "Ruby",                    "Bundler",
     "bundle install", "bundle exec rake test"),
    ("composer.json",    "PHP",                     "Composer",
     "composer install", "composer test"),
    ("CMakeLists.txt",   "C/C++",                   "CMake",
     "cmake -B build && cmake --build build", "ctest --test-dir build"),
]

TEST_DIR_CANDIDATES = ["test", "tests", "spec", "__tests__",
                       "integration-tests", "e2e", "cypress", "playwright"]


def detect_fork(target, flags):
    # Observation only: a remote literally named "upstream" in .git/config,
    # or an explicit --upstream flag. We do not call any API.
    if flags.get("upstream"):
        return {"isFork": True, "upstream": flags["upstream"], "evidence": "--upstream flag"}
    git_config = target / ".git" / "config"
    if git_config.is_file():
        text = git_config.read_text(encoding="utf-8", errors="replace")
        m = re.search(r'\[remote "upstream"\][^\[]*?url\s*=\s*(\S+)', text)
        if m:
            url = m.group(1)
            gh = re.search(r'[:/]([^/:]+/[^/]+?)(?:\.git)?$', url)
            return {"isFork": True, "upstream": gh.group(1) if gh else url,
                    "evidence": f'git remote "upstream" -> {url}'}
    return {"isFork": False, "upstream": None, "evidence": 'no remote named "upstream"'}


def detect_description(target, flags):
    if flags.get("description"):
        return flags["description"]
    for name in ["README.md", "README.adoc", "README.rst", "README.txt", "README"]:
        p = target / name
        if not p.is_file():
            continue
        # First non-empty line that is not a heading marker, badge, or HTML — a
        # crude but deterministic guess; the human confirms it in the audit.
        for raw in p.read_text(encoding="utf-8", errors="replace").split("\n"):
            line = raw.strip()
            if not line:
                continue
            if re.match(r'^(#|=|!\[|\[!|<|:|-{3}|\*{3})', line):
                continue
            if len(line) < 10:
                continue
            return line[:157] + "..." if len(line) > 160 else line
    return "<one line: what this project does — fill in>"


def orient(target, flags):
    # Run maturity check first — drives Process 1 vs 2 decision.
    maturity_result = check_maturity(target)

    found = []
    for d in DETECTORS:
        if (target / d[0]).is_file():
            found.append({
                "marker": d[0],
                "language": d[1],
                "buildSystem": d[2],
                "build": d[3],
                "test": d[4]
            })

    # Glob-based markers (no fixed filename). C#/.NET projects are named
    # <Project>.csproj / <Solution>.sln, so we scan the root for the extension.
    try:
        root_entries = [p.name for p in target.iterdir()]
    except OSError:
        root_entries = []
    if any(re.search(r"\.(sln|csproj|fsproj|vbproj)$", f, re.I) for f in root_entries):
        found.append({"marker": "*.sln/*.csproj", "language": "C#/.NET",
                      "buildSystem": "dotnet", "build": "dotnet build", "test": "dotnet test"})
    # Fallback: a bare Makefile (common for C/C++) only when nothing else matched,
    # so we never mislabel a JS/Python repo that happens to ship a Makefile.
    if not found and any(re.match(r"^(GNUmakefile|[Mm]akefile)$", f) for f in root_entries):
        found.append({"marker": "Makefile", "language": "C/C++",
                      "buildSystem": "Make", "build": "make", "test": "make test"})

    has_tsconfig = (target / "tsconfig.json").is_file()
    has_turbo = (target / "turbo.json").is_file()
    has_pnpm = (target / "pnpm-lock.yaml").is_file()
    has_yarn = (target / "yarn.lock").is_file()
    has_bun = (target / "bun.lockb").is_file()
    has_poetry = (target / "poetry.lock").is_file()
    has_pipenv = (target / "Pipfile").is_file()

    # Does package.json actually define a build script? If not, promising
    # `npm run build` is a lie that fails on the first run (libraries, CLIs).
    pkg_scripts = {}
    pkg_path = target / "package.json"
    if pkg_path.is_file():
        try:
            pkg_scripts = json.loads(pkg_path.read_text(encoding="utf-8", errors="replace")).get("scripts") or {}
        except (ValueError, OSError):
            pkg_scripts = {}

    for d in found:
        if d["marker"] == "package.json":
            if has_tsconfig:
                d["language"] = "TypeScript/JavaScript"
            install, run = "npm install", "npm run build"
            if has_pnpm:
                d["buildSystem"] = "pnpm"; install = "pnpm install"; run = "pnpm build"; d["test"] = "pnpm test"
            elif has_yarn:
                d["buildSystem"] = "Yarn"; install = "yarn install"; run = "yarn build"; d["test"] = "yarn test"
            elif has_bun:
                d["buildSystem"] = "Bun"; install = "bun install"; run = "bun run build"; d["test"] = "bun test"
            d["build"] = f"{install} && {run}" if pkg_scripts.get("build") else install
            if not pkg_scripts.get("test"):
                d["test"] = "<no test script in package.json — fill in>"
        elif d["marker"] in ("pyproject.toml", "requirements.txt"):
            if has_poetry:
                d["buildSystem"] = "Poetry"
                d["build"] = "poetry install"
                d["test"] = "poetry run pytest"
            elif has_pipenv:
                d["buildSystem"] = "Pipenv"
                d["build"] = "pipenv install"
                d["test"] = "pipenv run pytest"

    # De-duplicate found detectors by buildSystem to prevent redundant chained commands
    unique_found = []
    seen_build_systems = set()
    for d in found:
        bs = d["buildSystem"]
        if bs not in seen_build_systems:
            seen_build_systems.add(bs)
            unique_found.append(d)

    languages, seen = [], set()
    for d in unique_found:
        lang = d["language"]
        if lang not in seen:
            seen.add(lang)
            languages.append(lang)

    build_systems = []
    for d in unique_found:
        bs = d["buildSystem"]
        if bs not in build_systems:
            build_systems.append(bs)
    if has_turbo and "Turborepo" not in build_systems:
        build_systems.append("Turborepo")

    test_dirs = [t + "/" for t in TEST_DIR_CANDIDATES if (target / t).is_dir()]

    notes = []
    if not unique_found:
        notes.append("No known build-system marker found — set --build and --test manually.")
    if len(unique_found) > 1:
        notes.append("Multiple build systems detected — build/test commands chained; review them.")

    build_cmd = flags.get("build") or ("  &&  ".join(d["build"] for d in unique_found) or "<fill in>")
    test_cmd = flags.get("test") or ("  &&  ".join(d["test"] for d in unique_found) or "<fill in>")

    return {
        "_comment": "Generated by ai-fication-kit `orient` — deterministic observation only. "
                    "A human should confirm every field during the audit.",
        "kitVersion": KIT_VERSION,
        "generated": datetime.now(timezone.utc).isoformat(),
        "projectName": flags.get("name") or target.name,
        "description": detect_description(target, flags),
        "languages": languages,
        "buildSystems": build_systems,
        "buildCmd": build_cmd,
        "testCmd": test_cmd,
        "fork": detect_fork(target, flags),
        "testDirs": test_dirs,
        "notes": notes,
        "maturity": {
            "score": maturity_result["score"],
            "level": maturity_result["level"],
            "process": maturity_result["process"],
        },
        "existingAIConfig": maturity_result["existingAIConfig"],
    }


def print_profile(p):
    fork = p["fork"]
    print(f"\n  Project      {p['projectName']}")
    print(f"  Description  {p['description']}")
    print(f"  Languages    {', '.join(p['languages']) or '(none detected)'}")
    print(f"  Build        {p['buildCmd']}")
    print(f"  Test         {p['testCmd']}")
    fork_str = f"yes — upstream {fork['upstream']}" if fork["isFork"] else "no"
    print(f"  Fork         {fork_str} ({fork['evidence']})")
    print(f"  Test dirs    {', '.join(p['testDirs']) or '(none found)'}")
    for n in p["notes"]:
        print(f"  Note         {n}")
    print()
