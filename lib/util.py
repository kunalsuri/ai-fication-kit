# Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
"""Shared helpers and constants for the ai-fication-kit installer.

Everything here is a thin wrapper over the filesystem and the console —
no network, no execution, no state beyond the constants below.
"""

import sys
from pathlib import Path

KIT_VERSION = "0.1.0"

# lib/ lives one level under the kit root.
KIT_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_ROOT = KIT_ROOT / "templates"
PROFILE_REL = Path("ai") / "repo-profile.json"
MANIFEST_REL = Path("ai") / "install-manifest.json"
KIT_FOOTER_MARKER = "<!-- Installed by ai-fication-kit"


def backup_name(base, ext=".md"):
    """Generate a timestamped backup filename, e.g. CLAUDE_bkp_20260617_221847.md"""
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    ts = now.strftime("%Y%m%d_%H%M%S")
    return f"{base}_bkp_{ts}{ext}"


def die(msg):
    print("✗ " + msg, file=sys.stderr)
    sys.exit(1)


def confirm(question, flags):
    if flags.get("yes"):
        return True
    try:
        answer = input(f"{question} [y/N] ")
    except EOFError:
        return False
    return answer.strip().lower() in ("y", "yes")


def is_interactive():
    # Only a real human at a terminal should be prompted; automation/CI must flow through.
    return sys.stdin.isatty() and sys.stdout.isatty()


def ask(question, flags, fallback=""):
    """Free-text prompt. Returns `fallback` for non-interactive runs or empty input."""
    if flags.get("yes") or not is_interactive():
        return fallback
    try:
        answer = input(f"{question} ").strip()
    except EOFError:
        return fallback
    return answer or fallback


def choose(question, options, flags, default_index=0):
    """Numbered single-choice menu. Returns the chosen option string."""
    if flags.get("yes") or not is_interactive():
        return options[default_index]
    print(question)
    for i, o in enumerate(options):
        print(f"  {i + 1}) {o}")
    try:
        answer = input(f"Choose 1-{len(options)} [{default_index + 1}]: ").strip()
    except EOFError:
        return options[default_index]
    if answer.isdigit() and 1 <= int(answer) <= len(options):
        return options[int(answer) - 1]
    return options[default_index]
