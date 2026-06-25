# Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
"""maturity — deterministic repo AI-readiness assessment.

Every check is a file-existence or file-content test; nothing is executed,
nothing is inferred by a model, and nothing is written to disk.
The output drives the Process 1 (legacy) vs Process 2 (modern) decision.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from .util import KIT_VERSION, KIT_FOOTER_MARKER


# ---------------------------------------------------------------- checks

def _check_ai_config(target):
    result = {"claudeMd": None, "agentsMd": None, "claudeDir": False,
              "aiDir": False, "otherTools": []}

    for filename, key in [("CLAUDE.md", "claudeMd"), ("AGENTS.md", "agentsMd")]:
        p = target / filename
        if p.is_file():
            content = p.read_text(encoding="utf-8", errors="replace")
            result[key] = {
                "exists": True,
                "sizeBytes": p.stat().st_size,
                "hasKitFooter": KIT_FOOTER_MARKER in content,
            }
        else:
            result[key] = {"exists": False, "sizeBytes": 0, "hasKitFooter": False}

    result["claudeDir"] = (target / ".claude").is_dir()
    result["aiDir"] = (target / "ai").is_dir()

    other_checks = [
        (".cursorrules", "cursor"),
        (str(Path(".cursor") / "rules"), "cursor"),
        ("copilot-instructions.md", "copilot"),
        (str(Path(".github") / "copilot-instructions.md"), "copilot"),
        (".windsurfrules", "windsurf"),
    ]
    seen = set()
    for rel, tool in other_checks:
        p = target / rel
        if p.is_file() or p.is_dir():
            seen.add(tool)
    result["otherTools"] = sorted(seen)
    return result


def _check_version_control(target):
    git_dir = target / ".git"
    if not git_dir.is_dir():
        return {"exists": False, "branch": None}
    head = git_dir / "HEAD"
    branch = None
    if head.is_file():
        text = head.read_text(encoding="utf-8", errors="replace")
        m = re.search(r"ref:\s*refs/heads/(.+)", text)
        branch = m.group(1).strip() if m else "(detached HEAD)"
    return {"exists": True, "branch": branch}


def _check_build_system(target):
    markers = [
        "package.json", "pom.xml", "build.gradle", "build.gradle.kts",
        "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml",
        "Gemfile", "composer.json", "CMakeLists.txt",
    ]
    found = [m for m in markers if (target / m).is_file()]
    try:
        for e in target.iterdir():
            if re.search(r"\.(sln|csproj|fsproj|vbproj)$", e.name, re.I):
                found.append(e.name)
                break
    except OSError:
        pass
    return {"exists": len(found) > 0, "markers": found}


def _check_test_infra(target):
    test_dirs = ["test", "tests", "spec", "__tests__", "e2e", "cypress", "playwright"]
    found_dirs = [d + "/" for d in test_dirs if (target / d).is_dir()]
    has_test_script = False
    pkg = target / "package.json"
    if pkg.is_file():
        try:
            scripts = json.loads(pkg.read_text(encoding="utf-8", errors="replace")).get("scripts") or {}
            has_test_script = bool(scripts.get("test"))
        except (ValueError, OSError):
            pass
    return {"exists": len(found_dirs) > 0 or has_test_script,
            "dirs": found_dirs, "hasTestScript": has_test_script}


def _check_cicd(target):
    checks = [
        (Path(".github") / "workflows", "github-actions"),
        (Path(".gitlab-ci.yml"), "gitlab-ci"),
        (Path("Jenkinsfile"), "jenkins"),
        (Path(".circleci") / "config.yml", "circleci"),
        (Path(".travis.yml"), "travis"),
        (Path("azure-pipelines.yml"), "azure-devops"),
        (Path("bitbucket-pipelines.yml"), "bitbucket"),
    ]
    found = []
    for rel, name in checks:
        p = target / rel
        if p.is_file() or p.is_dir():
            found.append(name)
    return {"exists": len(found) > 0, "systems": found}


def _check_documentation(target):
    readme_size = 0
    for name in ["README.md", "README.adoc", "README.rst", "README.txt", "README"]:
        p = target / name
        if p.is_file():
            readme_size = p.stat().st_size
            break
    has_contributing = (target / "CONTRIBUTING.md").is_file()
    has_docs = (target / "docs").is_dir()
    return {"readmeExists": readme_size > 0, "readmeSize": readme_size,
            "hasContributing": has_contributing, "hasDocs": has_docs}


def _check_dependency_locks(target):
    locks = [
        "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
        "poetry.lock", "Pipfile.lock", "Gemfile.lock", "composer.lock",
        "Cargo.lock", "go.sum",
    ]
    found = [l for l in locks if (target / l).is_file()]
    return {"exists": len(found) > 0, "files": found}


def _check_code_structure(target):
    code_dirs = ["src", "lib", "app", "pkg", "internal", "cmd"]
    found = [d + "/" for d in code_dirs if (target / d).is_dir()]
    monorepo = []
    for m in ["turbo.json", "lerna.json", "pnpm-workspace.yaml", "nx.json"]:
        if (target / m).is_file():
            monorepo.append(m)
    return {"dirs": found, "monorepoMarkers": monorepo}


def _check_license(target):
    for name in ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "COPYING"]:
        if (target / name).is_file():
            return {"exists": True, "file": name}
    return {"exists": False, "file": None}


def _check_security(target):
    return {"exists": (target / "SECURITY.md").is_file()}


def _check_gitignore(target):
    p = target / ".gitignore"
    if not p.is_file():
        return {"exists": False, "coversCommon": False, "missing": []}
    content = p.read_text(encoding="utf-8", errors="replace")
    common = ["node_modules", "__pycache__", "dist", "build", ".env", "coverage", "*.log"]
    missing = [pat for pat in common if pat not in content]
    return {"exists": True, "coversCommon": len(missing) == 0, "missing": missing}


# ---------------------------------------------------------------- scoring

def _compute_score(checks):
    score = 0
    if checks["versionControl"]["exists"]:
        score += 15
    if checks["buildSystem"]["exists"]:
        score += 15
    if checks["testInfra"]["exists"]:
        score += 15
    if checks["cicd"]["exists"]:
        score += 10
    if checks["documentation"]["readmeExists"]:
        score += 10
    if checks["documentation"]["hasContributing"]:
        score += 2
    if checks["documentation"]["hasDocs"]:
        score += 3
    if checks["dependencyLocks"]["exists"]:
        score += 10
    if checks["codeStructure"]["dirs"]:
        score += 5
    if checks["license"]["exists"]:
        score += 5
    if checks["security"]["exists"]:
        score += 2
    if checks["gitignore"]["exists"]:
        score += 2
    if checks["gitignore"].get("coversCommon"):
        score += 1
    return min(score, 100)


def _determine_process(ai_config):
    has_user_claude = ai_config["claudeMd"]["exists"] and not ai_config["claudeMd"]["hasKitFooter"]
    has_user_agents = ai_config["agentsMd"]["exists"] and not ai_config["agentsMd"]["hasKitFooter"]
    return 2 if (has_user_claude or has_user_agents) else 1


def _determine_level(score):
    if score >= 80:
        return "Mature"
    if score >= 50:
        return "Developing"
    if score >= 25:
        return "Early"
    return "Minimal"


# ---------------------------------------------------------------- public API

def check_maturity(target):
    """Run all deterministic maturity checks. Returns a result dict."""
    checks = {
        "aiConfig": _check_ai_config(target),
        "versionControl": _check_version_control(target),
        "buildSystem": _check_build_system(target),
        "testInfra": _check_test_infra(target),
        "cicd": _check_cicd(target),
        "documentation": _check_documentation(target),
        "dependencyLocks": _check_dependency_locks(target),
        "codeStructure": _check_code_structure(target),
        "license": _check_license(target),
        "security": _check_security(target),
        "gitignore": _check_gitignore(target),
    }
    score = _compute_score(checks)
    process_num = _determine_process(checks["aiConfig"])
    level = _determine_level(score)

    return {
        "_comment": "Generated by ai-fication-kit `check-repo-maturity` — deterministic "
                    "file-existence checks only, no LLM. Read-only: no files written.",
        "kitVersion": KIT_VERSION,
        "generated": datetime.now(timezone.utc).isoformat(),
        "target": str(target),
        "score": score,
        "level": level,
        "process": process_num,
        "existingAIConfig": checks["aiConfig"],
        "checks": checks,
    }


def print_maturity_report(result):
    """Pretty-print the maturity report to console."""
    c = result["checks"]
    score = result["score"]
    filled = round(score / 100 * 16)
    bar = "█" * filled + "░" * (16 - filled)

    target_name = Path(result["target"]).name
    date_str = result["generated"][:10]

    process_label = ("Legacy (Process 1) — create ai/ from scratch"
                     if result["process"] == 1
                     else "Modern (Process 2) — backup existing config, then create ai/")

    print("")
    print("╔══════════════════════════════════════════════════════════╗")
    print("║            Repository Maturity Report                   ║")
    print(f"║            {target_name:<20} {date_str}          ║")
    print("╠══════════════════════════════════════════════════════════╣")
    print(f"║  Overall Score:  {bar}  {score:>3}/100      ║")
    print(f"║  AI Readiness:   {process_label:<38} ║")
    print("╠══════════════════════════════════════════════════════════╣")

    # AI Config
    ai_labels = []
    if c["aiConfig"]["claudeMd"]["exists"]:
        kind = "kit-generated" if c["aiConfig"]["claudeMd"]["hasKitFooter"] else "user-authored"
        ai_labels.append(f"CLAUDE.md ({kind})")
    if c["aiConfig"]["agentsMd"]["exists"]:
        kind = "kit-generated" if c["aiConfig"]["agentsMd"]["hasKitFooter"] else "user-authored"
        ai_labels.append(f"AGENTS.md ({kind})")
    if c["aiConfig"]["otherTools"]:
        ai_labels.append(f"Other: {', '.join(c['aiConfig']['otherTools'])}")
    if ai_labels:
        print(f"║  ✓ AI Config         {ai_labels[0]:<35}║")
        for lbl in ai_labels[1:]:
            print(f"║                      {lbl:<35}║")
    else:
        print("║  ✗ AI Config         None detected                      ║")

    # Version control
    if c["versionControl"]["exists"]:
        print(f"║  ✓ Version Control   git, branch: {(c['versionControl']['branch'] or '?'):<21}║")
    else:
        print("║  ✗ Version Control   Not a git repository                ║")

    # Build system
    if c["buildSystem"]["exists"]:
        print(f"║  ✓ Build System      {', '.join(c['buildSystem']['markers'][:3]):<35}║")
    else:
        print("║  ✗ Build System      No markers detected                 ║")

    # Test infra
    if c["testInfra"]["exists"]:
        parts = []
        if c["testInfra"]["dirs"]:
            parts.append(", ".join(c["testInfra"]["dirs"]))
        if c["testInfra"]["hasTestScript"]:
            parts.append("test script")
        print(f"║  ✓ Test Infra        {'; '.join(parts):<35}║")
    else:
        print("║  ✗ Test Infra        None detected                       ║")

    # CI/CD
    if c["cicd"]["exists"]:
        print(f"║  ✓ CI/CD             {', '.join(c['cicd']['systems']):<35}║")
    else:
        print("║  ✗ CI/CD             None detected                       ║")

    # Documentation
    if c["documentation"]["readmeExists"]:
        sz = c["documentation"]["readmeSize"]
        size = f"{sz / 1024:.1f} KB" if sz > 1024 else f"{sz} B"
        line = f"║  ✓ Documentation     README ({size})"
        print(f"{line:<57}║")
    else:
        print("║  ✗ Documentation     No README found                     ║")

    # Dependencies
    if c["dependencyLocks"]["exists"]:
        print(f"║  ✓ Dependencies      {', '.join(c['dependencyLocks']['files']):<35}║")
    else:
        print("║  ✗ Dependencies      No lock files                       ║")

    # Code structure
    if c["codeStructure"]["dirs"]:
        print(f"║  ✓ Code Structure    {', '.join(c['codeStructure']['dirs']):<35}║")
    else:
        print("║  ✗ Code Structure    No standard dirs (src/, lib/, etc.)  ║")

    # License
    if c["license"]["exists"]:
        print(f"║  ✓ License           {c['license']['file']:<35}║")
    else:
        print("║  ✗ License           None found                          ║")

    # Gitignore
    if c["gitignore"]["exists"]:
        if c["gitignore"]["coversCommon"]:
            note = "(comprehensive)"
        else:
            note = f"(missing: {', '.join(c['gitignore']['missing'][:3])})"
        mark = "✓" if c["gitignore"]["coversCommon"] else "△"
        print(f"║  {mark} .gitignore         {note:<35}║")
    else:
        print("║  ✗ .gitignore        Not found                           ║")

    print("╠══════════════════════════════════════════════════════════╣")

    if result["process"] == 2:
        print("║  → Process 2 will run:                                  ║")
        if c["aiConfig"]["claudeMd"]["exists"] and not c["aiConfig"]["claudeMd"]["hasKitFooter"]:
            print("║    1. Back up CLAUDE.md → CLAUDE_bkp_<timestamp>.md     ║")
        if c["aiConfig"]["agentsMd"]["exists"] and not c["aiConfig"]["agentsMd"]["hasKitFooter"]:
            print("║    2. Back up AGENTS.md → AGENTS_bkp_<timestamp>.md     ║")
        print("║    3. Create ai/ knowledge layer from templates          ║")
        print("║    4. /cold-start will extract knowledge from backups    ║")
    else:
        print("║  → Process 1 will run:                                  ║")
        print("║    1. Create ai/ knowledge layer from templates          ║")
        print("║    2. Create CLAUDE.md + AGENTS.md from templates        ║")
        print("║    3. /cold-start drafts ai/guide/ docs from code        ║")

    print("╚══════════════════════════════════════════════════════════╝")
    print("")
