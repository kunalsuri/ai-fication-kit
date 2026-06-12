#!/usr/bin/env python3
# Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
"""ai-fication-kit installer (Python >= 3.8, stdlib only).

Identical behavior to install.mjs — pick whichever runtime you have.

WHAT THIS DOES, IN FULL:
  orient    -- reads marker files (package.json, pom.xml, pyproject.toml, ...) in a
               target repo and writes ai/repo-profile.json. Pure file inspection.
  install   -- stamps the kit's templates/ into the target repo, substituting
               detected facts ({{PROJECT_NAME}}, {{BUILD_CMD}}, ...). Records every
               file it writes in ai/install-manifest.json.
  shazam    -- orient + install + prints your next steps. The magic stops exactly
               where inference begins: this tool never guesses, never runs your
               code, and hands the thinking to you and your agent.
  uninstall -- deletes exactly the files listed in ai/install-manifest.json.

WHAT THIS DOES NOT DO (by design, so it cannot harm you):
  - It does NOT execute any code, run any command, or open any network connection.
  - It does NOT write anywhere outside the target folder you pass in.
  - It does NOT overwrite existing files unless you pass --force.
  - It has NO dependencies, so there is nothing else to trust.

USAGE:
  python install.py shazam    <path-to-your-repo> [options]
  python install.py orient    <path-to-your-repo> [--dry-run]
  python install.py install   <path-to-your-repo> [options]
  python install.py uninstall <path-to-your-repo> [--dry-run]

OPTIONS:
  --dry-run --force --yes
  --name X  --description X  --build X  --test X  --upstream org/repo
"""

import json
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

# Prevent UnicodeEncodeError on Windows console by forcing UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

KIT_VERSION = "0.1.0"
KIT_ROOT = Path(__file__).resolve().parent
TEMPLATES_ROOT = KIT_ROOT / "templates"
PROFILE_REL = Path("ai") / "repo-profile.json"
MANIFEST_REL = Path("ai") / "install-manifest.json"

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

VALUE_OPTS = {"--name": "name", "--description": "description",
              "--build": "build", "--test": "test", "--upstream": "upstream"}
COMMANDS = {"orient", "install", "shazam", "uninstall"}

USAGE = f"""ai-fication-kit {KIT_VERSION} — make a legacy repo AI-native, with a human in the loop.

Usage:
  python install.py shazam    <path-to-your-repo>   one-shot: orient + install + next steps
  python install.py orient    <path-to-your-repo>   detect stack, write ai/repo-profile.json
  python install.py install   <path-to-your-repo>   stamp templates into the repo
  python install.py uninstall <path-to-your-repo>   remove exactly what install wrote

Options: --dry-run --force --yes --name --description --build --test --upstream
"""


def die(msg):
    print("\u2717 " + msg, file=sys.stderr)
    sys.exit(1)


def parse_args(argv):
    flags, positional = {}, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--dry-run":
            flags["dry_run"] = True
        elif a == "--force":
            flags["force"] = True
        elif a == "--yes":
            flags["yes"] = True
        elif a in VALUE_OPTS:
            i += 1
            if i >= len(argv):
                die(f"{a} requires a value")
            flags[VALUE_OPTS[a]] = argv[i]
        elif a.startswith("--"):
            die(f"Unknown option: {a}")
        else:
            positional.append(a)
        i += 1
    command = positional.pop(0) if positional and positional[0] in COMMANDS else None
    target = positional.pop(0) if positional else None
    return command, target, flags


def confirm(question, flags):
    if flags.get("yes"):
        return True
    try:
        answer = input(f"{question} [y/N] ")
    except EOFError:
        return False
    return answer.strip().lower() in ("y", "yes")


# ---------------------------------------------------------------------- orient
# Deterministic observation only: file-existence and file-content tests.

def detect_fork(target, flags):
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

    has_tsconfig = (target / "tsconfig.json").is_file()
    has_turbo = (target / "turbo.json").is_file()
    has_pnpm = (target / "pnpm-lock.yaml").is_file()
    has_yarn = (target / "yarn.lock").is_file()
    has_bun = (target / "bun.lockb").is_file()
    has_poetry = (target / "poetry.lock").is_file()
    has_pipenv = (target / "Pipfile").is_file()

    for d in found:
        if d["marker"] == "package.json":
            if has_tsconfig:
                d["language"] = "TypeScript/JavaScript"
            if has_pnpm:
                d["buildSystem"] = "pnpm"
                d["build"] = "pnpm install && pnpm build"
                d["test"] = "pnpm test"
            elif has_yarn:
                d["buildSystem"] = "Yarn"
                d["build"] = "yarn install && yarn build"
                d["test"] = "yarn test"
            elif has_bun:
                d["buildSystem"] = "Bun"
                d["build"] = "bun install && bun run build"
                d["test"] = "bun test"
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


# --------------------------------------------------------------------- install

def placeholders(profile):
    fork = profile["fork"]["isFork"]
    upstream = profile["fork"]["upstream"] or ""
    return {
        "PROJECT_NAME": profile["projectName"],
        "DESCRIPTION": profile["description"],
        "LANGUAGES": ", ".join(profile["languages"]) or "<fill in>",
        "BUILD_CMD": profile["buildCmd"],
        "TEST_CMD": profile["testCmd"],
        "UPSTREAM": upstream,
        "FORK_LINE": f" This is a FORK of `{upstream}`." if fork else "",
        "FORK_RULE": (
            f"**Frozen upstream.** Code inherited from `{upstream}` is off-limits unless "
            "the task explicitly requires it. New work goes in our own modules."
            if fork else
            "**Respect existing boundaries.** Treat unfamiliar, load-bearing code as frozen "
            "until the module map says otherwise."
        ),
        "TEST_DIRS": ", ".join(profile["testDirs"]) or "<fill in during cold start>",
        "DATE": date.today().isoformat(),
        "KIT_VERSION": KIT_VERSION,
    }


def stamp(text, variables):
    leftover = set()

    def repl(m):
        key = m.group(1)
        if key in variables:
            return variables[key]
        leftover.add(key)
        return m.group(0)

    out = re.sub(r"\{\{([A-Z_]+)\}\}", repl, text)
    return out, sorted(leftover)


def list_template_files():
    out = []
    for p in sorted(TEMPLATES_ROOT.rglob("*")):
        if p.is_symlink():
            die(f"Refusing symlink in kit templates: {p}")
        if p.is_file():
            out.append(p.relative_to(TEMPLATES_ROOT))
    return out


def destination_for(rel):
    parts = list(rel.parts)
    if parts and parts[0] == "claude":
        parts[0] = ".claude"
    dest = Path(*parts)
    if dest.suffix == ".tmpl":
        dest = dest.with_suffix("")
    return dest


def install(target, profile, flags):
    variables = placeholders(profile)
    installable = [r for r in list_template_files() if r != Path("README.md")]

    plan, skipped, all_leftovers = [], [], set()
    for rel in installable:
        dest_rel = destination_for(rel)
        dest_abs = target / dest_rel
        already = dest_abs.exists()
        if already and not flags.get("force"):
            skipped.append(dest_rel)
            continue
        raw = (TEMPLATES_ROOT / rel).read_text(encoding="utf-8")
        if rel.suffix == ".tmpl":
            content, leftover = stamp(raw, variables)
            all_leftovers.update(leftover)
        else:
            content = raw
        plan.append((dest_rel, dest_abs, content, already))

    print(f"\nPlan for {target}:")
    for dest_rel, _, _, overwrites in plan:
        print(f"  {'overwrite' if overwrites else 'write    '}  {dest_rel.as_posix()}")
    for s in skipped:
        print(f"  skip (exists, no --force)  {s.as_posix()}")
    print(f"  write      {PROFILE_REL.as_posix()}   (the orient profile)")
    print(f"  write      {MANIFEST_REL.as_posix()}  (for clean uninstall)")
    if all_leftovers:
        print(f"  ⚠ unresolved placeholders left for you to fill: {', '.join(sorted(all_leftovers))}")

    if flags.get("dry_run"):
        print("\n--dry-run: nothing written.")
        return
    if not confirm(f"Write {len(plan) + 2} file(s) into {target}?", flags):
        print("Aborted; nothing written.")
        return

    for _, dest_abs, content, _ in plan:
        dest_abs.parent.mkdir(parents=True, exist_ok=True)
        dest_abs.write_text(content, encoding="utf-8")
    (target / "ai").mkdir(parents=True, exist_ok=True)
    (target / PROFILE_REL).write_text(
        json.dumps(profile, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    # Merge with any existing manifest so re-installs never lose track of files.
    prev_files = []
    manifest_path = target / MANIFEST_REL
    if manifest_path.is_file():
        try:
            parsed = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(parsed, dict) and isinstance(parsed.get("files"), list):
                prev_files = parsed["files"]
        except json.JSONDecodeError:
            pass  # corrupt — start fresh
    manifest = {
        "kitVersion": KIT_VERSION,
        "installed": datetime.now(timezone.utc).isoformat(),
        "files": sorted(set(prev_files)
                        | {d.as_posix() for d, *_ in plan}
                        | {PROFILE_REL.as_posix(), MANIFEST_REL.as_posix()}),
    }
    (target / MANIFEST_REL).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"\n✓ Installed {len(plan) + 2} file(s).")
    if skipped:
        print(f"  ({len(skipped)} existing file(s) left untouched — use --force to overwrite)")


# ------------------------------------------------------------------- uninstall

def uninstall(target, flags):
    manifest_path = target / MANIFEST_REL
    if not manifest_path.is_file():
        die(f"No {MANIFEST_REL.as_posix()} found in {target} — nothing to uninstall.")
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        die(f"Could not parse {MANIFEST_REL.as_posix()}.")
    if not isinstance(manifest, dict) or not isinstance(manifest.get("files"), list):
        die(f"Invalid or corrupted manifest format in {MANIFEST_REL.as_posix()}.")
    files = manifest["files"]

    print(f"\nWill remove {len(files)} file(s) recorded by the installer:")
    for f in files:
        print(f"  delete  {f}")
    if flags.get("dry_run"):
        print("\n--dry-run: nothing deleted.")
        return
    if not confirm("Proceed?", flags):
        print("Aborted; nothing deleted.")
        return

    target_resolved = target.resolve()
    for f in files:
        abs_path = (target / f).resolve()
        if target_resolved not in abs_path.parents:
            die(f"Refusing path outside target: {f}")
        if abs_path.is_file():
            abs_path.unlink()
    # Remove now-empty directories the kit created (best effort, deepest first).
    dirs_set = set()
    for f in files:
        p = Path(f).parent
        while p != Path("."):
            dirs_set.add(p)
            p = p.parent
    dirs = sorted(dirs_set, key=lambda d: len(d.as_posix()), reverse=True)
    for d in dirs:
        try:
            (target / d).rmdir()
        except OSError:
            pass  # not empty — keep
    print("\n✓ Uninstalled.")


# ------------------------------------------------------------------- main flow

def main():
    command, target_arg, flags = parse_args(sys.argv[1:])
    if not command or not target_arg:
        print(USAGE)
        sys.exit(1 if command else 0)

    target = Path(target_arg).resolve()
    if not target.exists():
        die(f"Target does not exist: {target}")
    if not target.is_dir():
        die(f"Target is not a directory: {target}")

    if command == "orient":
        profile = orient(target, flags)
        print_profile(profile)
        if flags.get("dry_run"):
            print("--dry-run: profile not written.")
        else:
            (target / "ai").mkdir(parents=True, exist_ok=True)
            (target / PROFILE_REL).write_text(
                json.dumps(profile, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"✓ Wrote {PROFILE_REL.as_posix()}")
    elif command == "install":
        profile_path = target / PROFILE_REL
        if profile_path.is_file():
            profile = json.loads(profile_path.read_text(encoding="utf-8"))
        else:
            profile = orient(target, flags)
        install(target, profile, flags)
    elif command == "shazam":
        print("⚡ shazam — orient, install, and hand you the audit. No magic past this point.")
        profile = orient(target, flags)
        print_profile(profile)
        install(target, profile, flags)
        if not flags.get("dry_run"):
            print("""
Next steps (the part that needs a brain):
  1. Open the repo in Claude Code and run  /cold-start
     The agent drafts ai/guide/MODULE_MAP.md and friends — everything tagged [inferred].
     (Not using Claude Code? See docs/FAQ.md#cursor-copilot-codex for other tools.)
  2. Audit (~30 min): set each module's Stability (frozen / stable / ours),
     flip [inferred] -> [verified] on rows you confirm.
  3. Optional: /post-cold-start-verification, /verify-ai-readiness.
  4. Build: /add-feature.
""")
    elif command == "uninstall":
        uninstall(target, flags)


if __name__ == "__main__":
    main()
