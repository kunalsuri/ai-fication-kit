# Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
"""drift -- deterministic drift detection: where has the repository moved away
from the knowledge layer since it was last mapped/verified?

`verify` answers one question: do the paths the docs QUOTE still exist?
`drift` answers the reverse and the time question:
  unmapped -- a code-bearing top-level directory that NO MODULE_MAP row covers
              (the agent is back to crawling/guessing there).
  vanished -- a directory or entry point quoted in MODULE_MAP that is gone.
  stale    -- a [verified] row whose code changed since the verified commit
              (trust silently rotting).

Structural drift (unmapped, vanished) is pure file inspection: no execution,
no network -- the same guarantee as orient/install/verify. The stale check is
the single exception and is OPT-IN: only with --git does this command shell out
to a LOCAL, READ-ONLY `git` to see what changed since the verified commit.
Identical behavior to lib/drift.mjs -- pick whichever runtime you have.
"""

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from lib.util import KIT_VERSION, die

MODULE_MAP_REL = Path("ai") / "guide" / "MODULE_MAP.md"
DRIFT_MANIFEST_REL = Path("ai") / "analysis" / "audit-reports" / "DRIFT_MANIFEST.json"
DRIFT_REPORT_REL = Path("ai") / "analysis" / "audit-reports" / "DRIFT_REPORT.md"

# Never crawled and never flagged: build output, tooling, and the kit's own layer.
DRIFT_IGNORED_DIRS = {".git", "node_modules", "dist", "build", "out", "target",
                      "vendor", "coverage", "__pycache__", ".venv", "venv", ".next",
                      ".turbo", ".gradle", ".idea", ".cache", "bin", "obj", "ai", ".claude"}

# A directory "bears code" if it holds at least one file with a source extension.
SOURCE_EXTS = {"js", "mjs", "cjs", "jsx", "ts", "tsx", "py", "java", "kt", "kts",
               "go", "rs", "rb", "php", "c", "cc", "cpp", "cxx", "h", "hpp", "cs",
               "swift", "scala", "clj", "ex", "exs", "sh", "bash", "vue", "svelte",
               "m", "mm", "dart", "lua", "r", "jl", "pl"}

_BACKTICK = re.compile(r"`([^`]+)`")


def _backticks(cell):
    """Extract `backtick-quoted` tokens from one Markdown table cell, normalized."""
    out = []
    if not cell:
        return out
    for m in _BACKTICK.finditer(cell):
        s = m.group(1).strip().replace("\\", "/")
        if s.startswith("./"):
            s = s[2:]
        if s:
            out.append(s)
    return out


def _first_segment(p):
    return p.lstrip("/").split("/")[0]


def _parse_module_map(text):
    rows = []
    verified_sha = None
    m = re.search(r"Last verified:[^\n]*@\s*commit\s+([0-9a-fA-F]{7,40})\b", text, re.I)
    if m:
        verified_sha = m.group(1)

    for i, line in enumerate(text.split("\n")):
        if not line.strip().startswith("|"):
            continue
        if re.fullmatch(r"[\s|:-]+", line):  # separator row (---|---)
            continue
        cells = [c.strip() for c in line.split("|")]
        if cells and cells[0] == "":
            cells.pop(0)
        if cells and cells[-1] == "":
            cells.pop()
        if len(cells) < 3:
            continue
        joined = " ".join(cells).lower()
        if "directory" in joined and "entry point" in joined:  # header
            continue
        dir_claims = _backticks(cells[0])
        entry_claims = _backticks(cells[2])
        if not dir_claims and not entry_claims:  # placeholder (<fill in>)
            continue
        status_cell = cells[-1] or ""
        if re.search(r"\[verified\]", status_cell, re.I):
            status = "verified"
        elif re.search(r"\[inferred\]", status_cell, re.I):
            status = "inferred"
        else:
            status = "unknown"
        rows.append({
            "dirClaims": dir_claims, "entryClaims": entry_claims,
            "status": status, "line": i + 1,
            "label": dir_claims[0] if dir_claims else entry_claims[0],
        })
    return rows, verified_sha


def _has_source_file(dir_abs):
    """Recursively answer 'does this directory contain any source file?'"""
    stack = [dir_abs]
    while stack:
        current = stack.pop()
        try:
            entries = list(current.iterdir())
        except OSError:
            continue
        for e in entries:
            if e.is_symlink():
                continue
            if e.is_dir():
                if e.name.lower() not in DRIFT_IGNORED_DIRS and not e.name.startswith("."):
                    stack.append(e)
            elif e.is_file():
                ext = e.suffix[1:].lower() if e.suffix else ""
                if ext in SOURCE_EXTS:
                    return True
    return False


def _run_git(cwd, args):
    try:
        r = subprocess.run(["git", "-C", str(cwd), *args],
                           capture_output=True, text=True)
    except (OSError, ValueError):
        return False, ""
    return r.returncode == 0, r.stdout or ""


def drift(target, flags):
    map_path = target / MODULE_MAP_REL
    try:
        map_text = map_path.read_text(encoding="utf-8")
    except OSError:
        die(f"No {MODULE_MAP_REL.as_posix()} found. Run install (or shazam) first, then /cold-start.")
        return
    rows, verified_sha = _parse_module_map(map_text)

    mapped_segments = set()
    for row in rows:
        for c in row["dirClaims"] + row["entryClaims"]:
            seg = _first_segment(c)
            if seg:
                mapped_segments.add(seg)

    # 1. UNMAPPED -- code-bearing top-level directories no row covers.
    unmapped = []
    for e in sorted(target.iterdir(), key=lambda p: p.name):
        if not e.is_dir() or e.is_symlink():
            continue
        if e.name.startswith(".") or e.name.lower() in DRIFT_IGNORED_DIRS:
            continue
        if e.name in mapped_segments:
            continue
        if _has_source_file(e):
            unmapped.append({"path": e.name + "/", "kind": "dir"})

    # 2. VANISHED -- directories / entry points the map quotes that are gone.
    vanished = []
    for row in rows:
        for d in row["dirClaims"]:
            clean = d.rstrip("/")
            if not clean or clean == "/":
                continue
            if not (target / clean).is_dir():
                vanished.append({"claim": d, "kind": "dir", "line": row["line"], "status": row["status"]})
        for f in row["entryClaims"]:
            clean = f.rstrip("/")
            if not clean or clean == "/":
                continue
            p = target / clean
            if not p.is_file() and not p.is_dir():
                vanished.append({"claim": f, "kind": "file", "line": row["line"], "status": row["status"]})

    # 3. STALE -- [verified] rows whose code changed since the verified commit.
    #    Opt-in (--git): the one place this command shells out to local git.
    stale = []
    git = {"requested": bool(flags.get("git")), "available": False,
           "headSha": None, "verifiedSha": verified_sha, "note": None}
    if not flags.get("git"):
        git["note"] = ("stale check is opt-in -- re-run with --git to compare against "
                       "the last verified commit (local, read-only git).")
    else:
        ok, out = _run_git(target, ["rev-parse", "HEAD"])
        if not ok:
            git["note"] = "git not available, or target is not a git repository; stale check skipped."
        elif not verified_sha:
            git["available"] = True
            git["headSha"] = out.strip()
            git["note"] = ("MODULE_MAP records no verified commit "
                           "(`Last verified: ... @ commit <sha>`); stale check skipped.")
        else:
            git["available"] = True
            git["headSha"] = out.strip()
            dok, dout = _run_git(target, ["diff", "--name-only", verified_sha, "HEAD"])
            if not dok:
                git["note"] = (f"could not diff {verified_sha}..HEAD "
                               "(unknown commit / shallow clone?); stale check skipped.")
            else:
                changed = [s.strip() for s in dout.split("\n") if s.strip()]
                for row in [r for r in rows if r["status"] == "verified"]:
                    owned = [p.rstrip("/") for p in row["dirClaims"] + row["entryClaims"]]
                    owned = [p for p in owned if p and p != "/"]
                    hits = [cf for cf in changed
                            if any(cf == o or cf.startswith(o + "/") for o in owned)]
                    if hits:
                        stale.append({"row": row["label"], "line": row["line"],
                                      "changedFiles": hits[:50]})

    total = len(unmapped) + len(vanished) + len(stale)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%fZ")
    manifest = {
        "_comment": ("Generated by ai-fication-kit `drift` -- deterministic structural "
                     "checks (no execution). The optional --git stale check uses local read-only git."),
        "kitVersion": KIT_VERSION,
        "generated": generated_at,
        "modulesScanned": len(rows),
        "git": git,
        "summary": {"unmapped": len(unmapped), "vanished": len(vanished), "stale": len(stale)},
        "unmapped": unmapped, "vanished": vanished, "stale": stale,
    }

    lines = [
        "# Drift report",
        "",
        f"> Generated mechanically by ai-fication-kit `drift` on {generated_at[:10]}.",
        "> Drift is where the repository has moved away from the knowledge layer. The",
        "> statuses are facts; closing the gap (re-map, fix the docs, re-audit) is your call.",
        "",
        "| Drift | Count | Meaning |",
        "|---|---|---|",
        f"| unmapped | {len(unmapped)} | code-bearing directory no MODULE_MAP row covers |",
        f"| vanished | {len(vanished)} | directory / entry point the map quotes is gone |",
        f"| stale | {len(stale)} | `[verified]` row whose code changed since the verified commit |",
        "",
    ]
    if unmapped:
        lines += ["## Unmapped (agents will crawl/guess here)", "", "| Directory |", "|---|"]
        lines += [f"| `{u['path']}` |" for u in unmapped]
        lines.append("")
    if vanished:
        lines += ["## Vanished (the map points at code that is gone)", "",
                  "| Claim | Kind | Status | MODULE_MAP line |", "|---|---|---|---|"]
        lines += [f"| `{v['claim']}` | {v['kind']} | {v['status']} | {v['line']} |" for v in vanished]
        lines.append("")
    if stale:
        lines += ["## Stale verified rows (re-audit these)", "",
                  "| Row | MODULE_MAP line | Changed files since verified commit |", "|---|---|---|"]
        lines += [f"| `{s['row']}` | {s['line']} | "
                  + ", ".join("`" + f + "`" for f in s["changedFiles"]) + " |" for s in stale]
        lines.append("")
    if not total:
        lines += ["No drift detected. The map matches the tree.", ""]
    if git["note"]:
        lines += [f"> Stale check: {git['note']}", ""]

    print(f"\nScanned {len(rows)} mapped module(s):")
    print(f"  unmapped {len(unmapped)}   vanished {len(vanished)}   stale {len(stale)}")
    for u in unmapped[:20]:
        print(f"  + unmapped  {u['path']}")
    for v in vanished[:20]:
        print(f"  ✗ vanished  {v['claim']}  (MODULE_MAP:{v['line']})")
    for s in stale[:20]:
        print(f"  ~ stale     {s['row']}  (MODULE_MAP:{s['line']})")
    if git["note"]:
        print(f"  note: {git['note']}")

    if flags.get("dry_run"):
        print("\n--dry-run: manifest and report not written.")
    else:
        (target / DRIFT_MANIFEST_REL).parent.mkdir(parents=True, exist_ok=True)
        (target / DRIFT_MANIFEST_REL).write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        (target / DRIFT_REPORT_REL).write_text("\n".join(lines), encoding="utf-8")
        print(f"\n✓ Wrote {DRIFT_MANIFEST_REL.as_posix()}")
        print(f"✓ Wrote {DRIFT_REPORT_REL.as_posix()}")

    if flags.get("strict") and total:
        die(f"--strict: {total} drift finding(s).")
