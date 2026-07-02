# Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
"""install / uninstall — template stamping and manifest-based removal.

install only copies and stamps text files inside the target directory and
records every path it writes (plus its content hash, for re-run provenance)
in ai/install-manifest.json; uninstall deletes exactly the files listed
there, never following a path outside the target. Re-runs are incremental:
see classify_action below for the child-lock that protects human edits.
"""

import json
import re
import time
from datetime import date, datetime, timezone
from pathlib import Path

from .util import (KIT_VERSION, MANIFEST_REL, PROFILE_REL, TEMPLATES_ROOT,
                   backup_name, confirm, die, sha256_text)

# Retry budget for transient filesystem locks (Windows AV, etc.).
_UNINSTALL_RETRY_COUNT = 5
_UNINSTALL_RETRY_DELAY_S = 0.05


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
    elif parts and parts[0] == "github":
        parts[0] = ".github"
    elif parts and parts[0] == "agents":
        parts[0] = ".agents"
    dest = Path(*parts)
    if dest.suffix == ".tmpl":
        dest = dest.with_suffix("")
    return dest


# The human audit signature. A modified file carrying this tag holds verification
# work a human spent real time on — the installer refuses to overwrite it, even
# under --force (the "child-lock"). Remove the file yourself if you truly mean it.
VERIFIED_TAG = "[verified]"


def classify_action(disk_text, recorded_hash, new_text, force):
    """Decide what a (re-)install may do to one file. Provenance is the hash
    recorded in ai/install-manifest.json when the kit last wrote the file.
    Three-way compare (recorded / on disk / freshly stamped):
      "new"        — not on disk: write it (this is how new kit features arrive)
      "up-to-date" — disk already equals the stamped template: nothing to do
      "update"     — kit-owned (disk == recorded hash, never edited): safe refresh
      "locked"     — edited AND carries [verified]: kept, even under --force
      "keep"       — edited (or provenance unknown, e.g. pre-hash manifest): kept
      "overwrite"  — edited, --force given, no [verified] tag: backup then overwrite
    """
    if disk_text is None:
        return "new"
    disk_hash = sha256_text(disk_text)
    if disk_hash == sha256_text(new_text):
        return "up-to-date"
    if recorded_hash and disk_hash == recorded_hash:
        return "update"
    if VERIFIED_TAG in disk_text:
        return "locked"
    return "overwrite" if force else "keep"


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

    # Provenance from the previous install: content hashes recorded when the kit
    # last wrote each file. Manifests older than this feature have no hashes; their
    # existing files classify as "keep" (unknown provenance — same as the old skip).
    prev_files, prev_hashes = [], {}
    manifest_path = target / MANIFEST_REL
    if manifest_path.is_file():
        try:
            parsed = json.loads(manifest_path.read_text(encoding="utf-8"))
            if isinstance(parsed, dict):
                if isinstance(parsed.get("files"), list):
                    prev_files = parsed["files"]
                if isinstance(parsed.get("fileHashes"), dict):
                    prev_hashes = parsed["fileHashes"]
        except json.JSONDecodeError:
            pass  # corrupt — start fresh

    plan = []        # dicts: will be written (action: new | update | overwrite | overwrite-backed-up)
    kept = []        # untouched: action in (keep, locked)
    up_to_date = []  # disk already equals the stamped template
    all_leftovers = set()
    for rel in installable:
        dest_rel = destination_for(rel)
        dest_abs = target / dest_rel
        raw = (TEMPLATES_ROOT / rel).read_text(encoding="utf-8")
        if rel.suffix == ".tmpl":
            content, leftover = stamp(raw, variables)
        else:
            content, leftover = raw, []
        disk_text = dest_abs.read_text(encoding="utf-8") if dest_abs.is_file() else None
        # Files backed up in Process 2 were preserved already — write unconditionally.
        if str(dest_rel) in backed_up_files:
            action = "new" if disk_text is None else "overwrite-backed-up"
        else:
            action = classify_action(disk_text, prev_hashes.get(dest_rel.as_posix()),
                                     content, flags.get("force"))
        if action == "up-to-date":
            up_to_date.append({"dest_rel": dest_rel, "hash": sha256_text(content)})
            continue
        if action in ("keep", "locked"):
            kept.append({"dest_rel": dest_rel, "action": action})
            continue
        all_leftovers.update(leftover)
        # Plain "overwrite" targets a human-edited file — take a timestamped backup first.
        backup = None
        if action == "overwrite":
            backup = dest_rel.parent / backup_name(dest_rel.stem, dest_rel.suffix)
        plan.append({"dest_rel": dest_rel, "dest_abs": dest_abs, "content": content,
                     "action": action, "backup": backup})

    print(f"\nPlan for {target}:")
    for p in plan:
        if p["action"] == "new":
            print(f"  write (new)        {p['dest_rel'].as_posix()}")
        elif p["action"] == "update":
            print(f"  update (kit-owned, never edited)  {p['dest_rel'].as_posix()}")
        elif p["action"] == "overwrite":
            print(f"  overwrite (--force; backup: {p['backup'].as_posix()})  {p['dest_rel'].as_posix()}")
        else:
            print(f"  overwrite (backed up above)  {p['dest_rel'].as_posix()}")
    for k in kept:
        if k["action"] == "locked":
            print(f"  keep (child-lock: human {VERIFIED_TAG} content — never overwritten)  {k['dest_rel'].as_posix()}")
        else:
            hint = "" if flags.get("force") else "; --force to overwrite with backup"
            print(f"  keep (edited since install{hint})  {k['dest_rel'].as_posix()}")
    if up_to_date:
        print(f"  {len(up_to_date)} file(s) already up to date — untouched.")
    print(f"  write      {PROFILE_REL.as_posix()}   (the orient profile)")
    print(f"  write      {MANIFEST_REL.as_posix()}  (for clean uninstall + re-run provenance)")
    if all_leftovers:
        print(f"  ⚠ unresolved placeholders left for you to fill: {', '.join(sorted(all_leftovers))}")

    if flags.get("dry_run"):
        print("\n--dry-run: nothing written.")
        return
    if not confirm(f"Write {len(plan) + 2} file(s) into {target}?", flags):
        print("Aborted; nothing written.")
        return

    for p in plan:
        if p["backup"] is not None:
            import shutil
            shutil.copy2(str(p["dest_abs"]), str(target / p["backup"]))
            print(f"  ℹ Backed up {p['dest_rel'].as_posix()} → {p['backup'].as_posix()}")
        p["dest_abs"].parent.mkdir(parents=True, exist_ok=True)
        p["dest_abs"].write_text(p["content"], encoding="utf-8")
    # A re-run must never erase the intake wizard's answers: if the fresh profile has
    # no humanContext but the one on disk does, carry it forward.
    if not profile.get("humanContext"):
        profile_path = target / PROFILE_REL
        if profile_path.is_file():
            try:
                prev_profile = json.loads(profile_path.read_text(encoding="utf-8"))
                if isinstance(prev_profile, dict) and prev_profile.get("humanContext"):
                    profile["humanContext"] = prev_profile["humanContext"]
            except (json.JSONDecodeError, OSError):
                pass  # no usable prior profile
    (target / "ai").mkdir(parents=True, exist_ok=True)
    (target / PROFILE_REL).write_text(
        json.dumps(profile, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    # Merge with any existing manifest so re-installs never lose track of files.
    # fileHashes records the content the kit wrote, so the next run can tell
    # kit-owned from human-edited.
    file_hashes = dict(prev_hashes)
    for p in plan:
        file_hashes[p["dest_rel"].as_posix()] = sha256_text(p["content"])
    for u in up_to_date:
        file_hashes[u["dest_rel"].as_posix()] = u["hash"]
    manifest = {
        "kitVersion": KIT_VERSION,
        "installed": datetime.now(timezone.utc).isoformat(),
        "files": sorted(list(set(prev_files)
                         | {p["dest_rel"].as_posix() for p in plan}
                         | {PROFILE_REL.as_posix(), MANIFEST_REL.as_posix(), "ai/repo-indepth.json"})),
        "fileHashes": {k: file_hashes[k] for k in sorted(file_hashes)},
    }
    (target / MANIFEST_REL).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    print(f"\n✓ Installed {len(plan) + 2} file(s).")
    locked_count = sum(1 for k in kept if k["action"] == "locked")
    if kept:
        lock_note = f", {locked_count} of them {VERIFIED_TAG}-locked" if locked_count else ""
        print(f"  ({len(kept)} edited file(s) kept{lock_note} — your audit work is untouched)")
    if up_to_date:
        print(f"  ({len(up_to_date)} file(s) were already up to date)")
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
            for attempt in range(_UNINSTALL_RETRY_COUNT):
                try:
                    abs_path.unlink()
                    break
                except OSError as e:
                    if attempt == _UNINSTALL_RETRY_COUNT - 1:
                        raise e
                    time.sleep(_UNINSTALL_RETRY_DELAY_S)
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
    bkp_files = []
    try:
        for name in sorted(target.iterdir()):
            if re.match(r"^(CLAUDE|AGENTS)_bkp_\d{8}_\d{6}\.md$", name.name):
                bkp_files.append(name.name)
    except OSError:
        pass
    if bkp_files:
        print("\nℹ The following backup files were NOT removed (your prior knowledge):")
        for b in bkp_files:
            print(f"  → {target / b}")
        print("  Restore manually if needed, or delete them when no longer useful.")
    print("\n✓ Uninstalled.")
