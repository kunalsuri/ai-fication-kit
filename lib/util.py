# Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
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
