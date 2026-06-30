# Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
"""install / uninstall — template stamping and manifest-based removal.

install only copies and stamps text files inside the target directory and
records every path it writes in ai/install-manifest.json; uninstall deletes
exactly the files listed there, never following a path outside the target.
"""

import json
import re
from datetime import date, datetime, timezone
from pathlib import Path

from .util import (KIT_VERSION, MANIFEST_REL, PROFILE_REL, TEMPLATES_ROOT,
                   backup_name, confirm, die)


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
        # NOTE: the upstream is an org/repo slug, not a repo-relative path — keep it
        # OUT of backticks so the deterministic `verify` does not flag it as a missing file.
        "FORK_LINE": f" This is a FORK of **{upstream}** (upstream)." if fork else "",
        "FORK_RULE": (
            f"**Frozen upstream.** Code inherited from **{upstream}** is off-limits unless "
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
    # ---- Process 2: back up user-authored CLAUDE.md / AGENTS.md ----
    backups = []
    maturity = profile.get("maturity") or {}
    if maturity.get("process") == 2:
        ai_config = profile.get("existingAIConfig") or {}
        for src_file, base in [("CLAUDE.md", "CLAUDE"), ("AGENTS.md", "AGENTS")]:
            key = "claudeMd" if src_file == "CLAUDE.md" else "agentsMd"
            cfg = ai_config.get(key) or {}
            if cfg.get("exists") and not cfg.get("hasKitFooter"):
                src_abs = target / src_file
                bkp_rel = backup_name(base)
                bkp_abs = target / bkp_rel
                if not flags.get("dry_run"):
                    import shutil
                    shutil.copy2(str(src_abs), str(bkp_abs))
                backups.append({"source": src_file, "backup": bkp_rel})
                print(f"  ℹ Backed up {src_file} → {bkp_rel} (knowledge preserved for /cold-start)")

    # Files backed up in Process 2 must be overwritten even without --force.
    backed_up_files = {b["source"] for b in backups}

    variables = placeholders(profile)
    installable = [r for r in list_template_files() if r != Path("README.md")]

    plan, skipped, all_leftovers = [], [], set()
    for rel in installable:
        dest_rel = destination_for(rel)
        dest_abs = target / dest_rel
        already = dest_abs.exists()
        force_this = str(dest_rel) in backed_up_files
        if already and not flags.get("force") and not force_this:
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
        "files": sorted(list(set(prev_files)
                         | {d.as_posix() for d, *_ in plan}
                         | {PROFILE_REL.as_posix(), MANIFEST_REL.as_posix(), "ai/repo-indepth.json"})),
    }
    (target / MANIFEST_REL).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"\n✓ Installed {len(plan) + 2} file(s).")
    if skipped:
        print(f"  ({len(skipped)} existing file(s) left untouched — use --force to overwrite)")
    if backups:
        print(f"  ({len(backups)} existing file(s) backed up with timestamp)")


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
    # Report backup files if any exist.
    import re as _re
    bkp_files = []
    try:
        for name in sorted(target.iterdir()):
            if _re.match(r"^(CLAUDE|AGENTS)_bkp_\d{8}_\d{6}\.md$", name.name):
                bkp_files.append(name.name)
    except OSError:
        pass
    if bkp_files:
        print("\nℹ The following backup files were NOT removed (your prior knowledge):")
        for b in bkp_files:
            print(f"  → {target / b}")
        print("  Restore manually if needed, or delete them when no longer useful.")
    print("\n✓ Uninstalled.")
