# Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
"""intake — the friendly first-run wizard for `shazam`.

This is the ONE interactive part of the kit, and it exists to keep users safe:
before any files are written we capture who is driving (maturity), make sure they
are NOT on their production branch, and let them confirm/correct the stack. The
answers are recorded under `humanContext` in ai/repo-profile.json so /cold-start
starts from real context instead of guessing.

It never executes anything — branch detection reads .git/HEAD as a plain file, the
same no-execution discipline as the rest of the kit. It self-disables for
non-interactive runs (no TTY) and whenever `--yes` is passed, so CI is untouched.
"""

import re
import sys
from datetime import datetime, timezone

from .util import KIT_VERSION, ask, choose, confirm, is_interactive

SKILL_LEVELS = [
    "Junior / new to development",
    "Still learning",
    "Experienced / expert",
    "Prefer not to say",
]
FAMILIARITY = [
    "New to this codebase",
    "I know parts of it",
    "I know it well",
    "Not sure",
]


def _detect_branch(target):
    # .git/HEAD is "ref: refs/heads/<branch>" on a normal checkout. Reading it is
    # file inspection, not a git command — we never shell out.
    head = target / ".git" / "HEAD"
    if not head.is_file():
        return {"versionControlled": False, "name": None}
    text = head.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"ref:\s*refs/heads/(.+)", text)
    return {"versionControlled": True, "name": m.group(1).strip() if m else "(detached HEAD)"}


def run_first_run_wizard(target, profile, flags):
    """Return a humanContext dict, or None when skipped (CI/--yes/no TTY).

    May exit(0) if the user chooses to stop and set up version control / a branch first.
    """
    if flags.get("yes") or not is_interactive():
        return None

    print("\n👋 Welcome to ai-fication-kit. A few quick questions so we set you up safely.\n")

    # 1 — Maturity: two quick signals (general experience + this-repo familiarity).
    skill_level = choose("How would you describe your development experience?", SKILL_LEVELS, flags, 1)
    codebase_familiarity = choose("How well do you know THIS codebase?", FAMILIARITY, flags, 0)

    # 2 — Branch safety: warn, then let them confirm. We guide; we never run git.
    branch = _detect_branch(target)
    is_default_branch = False
    acknowledged_risk = True
    if not branch["versionControlled"]:
        print("\n⚠️  This folder is not a git repository. We strongly recommend version control")
        print("    before letting any agent edit code — it is your undo button.")
        acknowledged_risk = confirm("Proceed without version control?", flags)
        if not acknowledged_risk:
            print("\nGood call. Run `git init`, commit your code, then re-run shazam. 👋")
            sys.exit(0)
    else:
        is_default_branch = bool(re.match(r"^(main|master)$", branch["name"] or "", re.I))
        print(f"\nYou are on branch: {branch['name']}")
        if is_default_branch:
            print("⚠️  That looks like your production/default branch. Setup and the agent edits")
            print("    that follow can disturb live code. Best practice is a throwaway branch:")
            print("       git checkout -b ai-fication-setup")
            acknowledged_risk = confirm(f"Continue on '{branch['name']}' anyway?", flags)
            if not acknowledged_risk:
                print("\nSmart. Create a working branch and re-run shazam. 👋")
                sys.exit(0)

    # 2.5 — AI config awareness (based on maturity check)
    maturity = profile.get("maturity") or {}
    ai_config = profile.get("existingAIConfig") or {}
    if maturity.get("process") == 2:
        print("\n📋 This repo already has AI configuration files:")
        claude_cfg = ai_config.get("claudeMd") or {}
        agents_cfg = ai_config.get("agentsMd") or {}
        if claude_cfg.get("exists") and not claude_cfg.get("hasKitFooter"):
            print("   • CLAUDE.md (user-authored)")
        if agents_cfg.get("exists") and not agents_cfg.get("hasKitFooter"):
            print("   • AGENTS.md (user-authored)")
        print("\n   → Process 2 will run:")
        print("     1. Back up existing files with a timestamp (e.g. CLAUDE_bkp_20260617_221847.md)")
        print("     2. Create the ai/ knowledge layer with kit templates")
        print("     3. /cold-start will extract knowledge from your backups to seed ai/guide/")
        print("   Nothing is lost — your prior configuration becomes seed knowledge.")
        proceed = confirm("Proceed with backup and install?", flags)
        if not proceed:
            print("\nNo changes made. You can run `check-repo-maturity` to see the report again. 👋")
            sys.exit(0)
    else:
        print("\n📋 Legacy / fresh repo detected — Process 1 will create everything from scratch.")

    # 3 — Stack: show what orient detected, then confirm or augment (incl. front/back split).
    detected = ", ".join(profile["languages"]) if profile["languages"] else "(none detected)"
    print(f"\nWe detected this stack: {detected}")
    shape = choose("How is your codebase structured?", [
        "That's right — single stack",
        "Single stack, but let me correct it",
        "Split: separate frontend and backend",
        "Not sure / mixed",
    ], flags, 0)

    if shape.startswith("That's right"):
        stack = {"kind": "single", "detected": profile["languages"], "source": "confirmed-detection"}
    elif shape.startswith("Single stack, but"):
        description = ask("What is the stack? (e.g. 'Go', 'Python + Django')", flags, detected)
        stack = {"kind": "single", "detected": profile["languages"], "description": description}
    elif shape.startswith("Split"):
        frontend = ask("Frontend stack? (e.g. 'React + TypeScript')", flags, "")
        backend = ask("Backend stack? (e.g. 'Java / Spring', 'Python / FastAPI')", flags, "")
        stack = {"kind": "split", "detected": profile["languages"], "frontend": frontend, "backend": backend}
    else:
        stack = {"kind": "unknown", "detected": profile["languages"],
                 "note": "Resolve during /cold-start + human audit."}

    print("\n✓ Thanks — recording this in ai/repo-profile.json to guide /cold-start.\n")

    return {
        "_comment": "Human-supplied context from the shazam first-run wizard — NOT deterministic "
                    "detection. These are the user's own answers, recorded to orient /cold-start and the audit.",
        "firstRunAt": datetime.now(timezone.utc).isoformat(),
        "kitVersion": KIT_VERSION,
        "developer": {"skillLevel": skill_level, "codebaseFamiliarity": codebase_familiarity},
        "branch": {
            "name": branch["name"],
            "versionControlled": branch["versionControlled"],
            "isDefaultBranch": is_default_branch,
            "acknowledgedRisk": acknowledged_risk,
        },
        "stack": stack,
    }
