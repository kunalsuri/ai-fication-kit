#!/usr/bin/env python3
# Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
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
  verify    -- extracts every backtick-quoted path claim from the knowledge docs
               (CLAUDE.md, AGENTS.md, ai/guide/*.md, ai/analysis/FEATURE_CATALOG*.md)
               and checks each against the real file tree. Writes a machine-readable
               manifest and a human-readable report into ai/analysis/audit-reports/.
               Deterministic: a claim is either on disk or it is not. No LLM.
  drift     -- the reverse of verify: reports code-bearing directories the MODULE_MAP
               does not cover (unmapped), map entries that are gone (vanished), and --
               only with --git -- [verified] rows whose code changed since the verified
               commit (stale). Writes a manifest + report into ai/analysis/audit-reports/.

WHAT THIS DOES NOT DO (by design, so it cannot harm you):
  - It does NOT execute any code or open any network connection. (The single
    exception: `drift --git` runs LOCAL, READ-ONLY git to compute the stale set;
    without --git, drift is pure file inspection like everything else here.)
  - It does NOT write anywhere outside the target folder you pass in.
  - It does NOT overwrite existing files unless you pass --force.
  - It has NO dependencies, so there is nothing else to trust.

This file is only the command-line interface. The implementation is split into
small single-purpose modules so a human can audit each in one sitting:
  lib/util.py       -- shared helpers and constants
  lib/orient.py     -- deterministic stack detection
  lib/installer.py  -- template stamping (install) and manifest-based uninstall
  lib/verify.py     -- mechanical claim verification
You are encouraged to read them all before running this.

USAGE:
  python install.py shazam    <path-to-your-repo> [options]
  python install.py orient    <path-to-your-repo> [--dry-run]
  python install.py install   <path-to-your-repo> [options]
  python install.py uninstall <path-to-your-repo> [--dry-run]
  python install.py verify    <path-to-your-repo> [--dry-run] [--strict]
  python install.py drift     <path-to-your-repo> [--dry-run] [--strict] [--git]

OPTIONS:
  --dry-run --force --yes --strict --git
  --name X  --description X  --build X  --test X  --upstream org/repo
"""

import json
import sys
from pathlib import Path

# Prevent UnicodeEncodeError on Windows console by forcing UTF-8 output
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

from lib.util import KIT_VERSION, PROFILE_REL, die
from lib.orient import orient, print_profile
from lib.installer import install, uninstall
from lib.verify import verify
from lib.drift import drift
from lib.intake import run_first_run_wizard
from lib.maturity import check_maturity, print_maturity_report

VALUE_OPTS = {"--name": "name", "--description": "description",
              "--build": "build", "--test": "test", "--upstream": "upstream"}
COMMANDS = {"orient", "install", "shazam", "uninstall", "verify", "drift", "check-repo-maturity", "indepth"}

USAGE = f"""ai-fication-kit {KIT_VERSION} — make any repo AI-native, with a human in the loop.

Usage:
  python install.py shazam    <path-to-your-repo>   one-shot: orient + install + next steps
  python install.py orient    <path-to-your-repo>   detect stack, write ai/repo-profile.json
  python install.py indepth   <path-to-your-repo>   run comprehensive indepth analysis
  python install.py install   <path-to-your-repo>   stamp templates into the repo
  python install.py uninstall <path-to-your-repo>   remove exactly what install wrote
  python install.py verify    <path-to-your-repo>   mechanically check every path claim
                                                    in the knowledge docs against the tree
  python install.py drift     <path-to-your-repo>   report where the code has drifted from
                                                    the map (unmapped/vanished; --git: stale)
  python install.py check-repo-maturity <path>      read-only AI readiness diagnostic
                                                    (no LLM, no writes, just a report)

Options: --dry-run --force --yes --strict --git --name --description --build --test --upstream
         --analysis-level general|indepth --indepth --skip-prompt --interactive, -i
         --version, -v   print the kit version and exit
"""


def parse_args(argv):
    flags, positional = {}, []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--dry-run":
            flags["dry_run"] = True
        elif a == "--strict":
            flags["strict"] = True
        elif a == "--force":
            flags["force"] = True
        elif a == "--git":
            flags["git"] = True
        elif a == "--yes":
            flags["yes"] = True
        elif a == "--skip-prompt":
            flags["skip_prompt"] = True
        elif a in ("--interactive", "-i"):
            flags["interactive"] = True
        elif a == "--indepth":
            flags["analysis_level"] = "indepth"
        elif a == "--analysis-level":
            i += 1
            if i >= len(argv):
                die(f"{a} requires a value")
            v = argv[i]
            if v not in ("general", "indepth"):
                die(f"{a} must be 'general' or 'indepth'")
            flags["analysis_level"] = v
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


def choose_analysis_level(flags):
    from lib.util import choose, is_interactive
    if flags.get("analysis_level"):
        return flags["analysis_level"]
    if flags.get("yes") or flags.get("skip_prompt") or not is_interactive():
        return "general"
    options = [
        "General (quick profile)\n       → Detects language, build system, frameworks, code quality\n       → Output: ai/repo-profile.json\n       → Time: ~200ms\n       → Best for: Quick onboarding, CI/CD pipelines",
        "Indepth (comprehensive analysis)\n       → Includes: dependency graph, code metrics, architecture inference\n       → Output: ai/repo-profile.json + ai/repo-indepth.json\n       → Time: ~2-5s\n       → Best for: Full codebase understanding, refactoring planning"
    ]
    chosen = choose("Analysis level?", options, flags, 0)
    return "general" if chosen.startswith("General") else "indepth"


def main():
    if "--version" in sys.argv[1:] or "-v" in sys.argv[1:]:
        print(KIT_VERSION)
        sys.exit(0)
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
        level = choose_analysis_level(flags) if flags.get("interactive") else flags.get("analysis_level", "general")
        profile = orient(target, flags)
        print_profile(profile)
        if not flags.get("dry_run"):
            (target / "ai").mkdir(parents=True, exist_ok=True)
            (target / PROFILE_REL).write_text(
                json.dumps(profile, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print(f"✓ Wrote {PROFILE_REL.as_posix()}")
        
        if level == "indepth":
            from lib.indepth import indepth, print_indepth_report
            indepth_result = indepth(target, flags)
            print_indepth_report(indepth_result)
            if not flags.get("dry_run"):
                indepth_path = target / "ai" / "repo-indepth.json"
                indepth_path.write_text(
                    json.dumps(indepth_result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                print("✓ Wrote ai/repo-indepth.json")
        if flags.get("dry_run"):
            print("--dry-run: profile not written.")
    elif command == "indepth":
        profile_path = target / PROFILE_REL
        if profile_path.is_file():
            try:
                profile = json.loads(profile_path.read_text(encoding="utf-8"))
            except (ValueError, OSError):
                profile = orient(target, flags)
        else:
            profile = orient(target, flags)
            if not flags.get("dry_run"):
                (target / "ai").mkdir(parents=True, exist_ok=True)
                profile_path.write_text(
                    json.dumps(profile, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                print(f"✓ Wrote {PROFILE_REL.as_posix()}")
                
        from lib.indepth import indepth, print_indepth_report
        indepth_result = indepth(target, flags)
        print_indepth_report(indepth_result)
        if not flags.get("dry_run"):
            indepth_path = target / "ai" / "repo-indepth.json"
            indepth_path.write_text(
                json.dumps(indepth_result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print("✓ Wrote ai/repo-indepth.json")
        else:
            print("--dry-run: repo-indepth.json not written.")
    elif command == "check-repo-maturity":
        result = check_maturity(target)
        print_maturity_report(result)
        if not flags.get("dry_run"):
            report_dir = target / "ai" / "analysis" / "audit-reports"
            report_dir.mkdir(parents=True, exist_ok=True)
            (report_dir / "MATURITY_REPORT.json").write_text(
                json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
            print("✓ Wrote ai/analysis/audit-reports/MATURITY_REPORT.json")
        else:
            print("--dry-run: report not written.")
    elif command == "install":
        profile_path = target / PROFILE_REL
        if profile_path.is_file():
            profile = json.loads(profile_path.read_text(encoding="utf-8"))
        else:
            profile = orient(target, flags)
        install(target, profile, flags)
    elif command == "shazam":
        print("⚡ shazam — orient, install, and hand you the audit. No magic past this point.")
        level = choose_analysis_level(flags)

        # Step 1: Maturity check (read-only diagnostic, always runs first)
        maturity_result = check_maturity(target)
        print_maturity_report(maturity_result)

        # Step 2: Orient (embeds maturity results in profile)
        profile = orient(target, flags)
        print_profile(profile)

        if level == "indepth":
            from lib.indepth import indepth, print_indepth_report
            indepth_result = indepth(target, flags)
            print_indepth_report(indepth_result)
            if not flags.get("dry_run"):
                (target / "ai").mkdir(parents=True, exist_ok=True)
                indepth_path = target / "ai" / "repo-indepth.json"
                indepth_path.write_text(
                    json.dumps(indepth_result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                print("✓ Wrote ai/repo-indepth.json")

        # Step 3: First-run wizard (interactive only)
        if not flags.get("dry_run"):
            already_onboarded = False
            profile_path = target / PROFILE_REL
            if profile_path.is_file():
                try:
                    already_onboarded = bool(json.loads(
                        profile_path.read_text(encoding="utf-8")).get("humanContext"))
                except (ValueError, OSError):
                    already_onboarded = False
            if not already_onboarded:
                human_context = run_first_run_wizard(target, profile, flags)
                if human_context:
                    profile["humanContext"] = human_context

        # Step 4: Install (process-aware: backs up on Process 2)
        install(target, profile, flags)

        if not flags.get("dry_run"):
            is_process2 = (profile.get("maturity") or {}).get("process") == 2
            bkp_note = ""
            if is_process2:
                bkp_note = ("\n     ↳ Backup files exist — the agent will extract and reuse knowledge from"
                           "\n       your prior CLAUDE.md / AGENTS.md to seed the ai/guide/ documents.")
            print(f"""
Next steps (the part that needs a brain):
  1. Open the repo in Claude Code and run  /cold-start
     The agent drafts ai/guide/MODULE_MAP.md and friends — everything tagged [inferred].{bkp_note}
     (Not using Claude Code? See docs/FAQ.md#cursor-copilot-codex for other tools.)
  2. Audit (~30 min): set each module's Stability (frozen / stable / ours),
     flip [inferred] -> [verified] on rows you confirm.
  3. Optional: python install.py verify <repo>  (mechanical claim check, no LLM),
     then /post-cold-start-verification, /verify-ai-readiness.
  4. Build: /add-feature.
""")
    elif command == "uninstall":
        uninstall(target, flags)
    elif command == "verify":
        verify(target, flags)
    elif command == "drift":
        drift(target, flags)


if __name__ == "__main__":
    main()
