# Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
"""verify — deterministic claim verification.

The mechanical half of "kept mechanically honest". Every backtick-quoted
token in the knowledge docs that looks like a path is a CLAIM; a claim is
either on disk or it is not. No model, no execution, no judgement — the
human (and the agent commands) interpret the report; this code only states
facts.
"""

import json
import re
from datetime import datetime, timezone
from pathlib import Path

from .util import KIT_VERSION, die

VERIFY_MANIFEST_REL = Path("ai") / "analysis" / "audit-reports" / "VERIFICATION_MANIFEST.json"
VERIFY_REPORT_REL = Path("ai") / "analysis" / "audit-reports" / "VERIFICATION_REPORT.md"
VERIFY_IGNORED_DIRS = {".git", "node_modules", "dist", "build", "out", "target",
                       "vendor", "coverage", "__pycache__", ".venv", "venv", ".next",
                       ".turbo", ".gradle", ".idea", ".cache", "bin", "obj"}
# Tokens that look like filenames but never are: product names and code idioms.
VERIFY_NON_FILES = {"node.js", "vue.js", "react.js", "next.js", "express.js",
                    "nest.js", "three.js", "d3.js", "elk.js", "p5.js",
                    "module.exports", "process.env", "process.argv", "import.meta",
                    "console.log", "console.error", "window.location",
                    "document.body", "this.props", "this.state"}

_CLAIM_RE = re.compile(r"`([^`\n]+)`")
_BAD_CHARS_RE = re.compile(r"[\s{}<>*$()|&;\"']")
_FILENAME_RE = re.compile(r"^[\w.\-]+\.[A-Za-z][A-Za-z0-9_]{0,11}$", re.ASCII)


def extract_claims(text, source_file):
    claims = []
    for i, line in enumerate(text.split("\n"), start=1):
        for m in _CLAIM_RE.finditer(line):
            s = m.group(1).strip()
            # Commands, prose, templates, globs: anything with whitespace or
            # shell/placeholder characters is not a path claim.
            if not s or _BAD_CHARS_RE.search(s):
                continue
            # URLs, CLI flags, slash commands, absolute paths: not repo-relative.
            if s.startswith(("http:", "https:", "-", "/", "~")):
                continue
            s = s.replace("\\", "/")
            if s.startswith("./"):
                s = s[2:]
            s = re.sub(r":\d+(-\d+)?$", "", s)
            is_dir_claim = s.endswith("/")
            s = s.rstrip("/")
            if not s or s in (".", ".."):
                continue
            if is_dir_claim or "/" in s:
                claim_type = "path"
            elif _FILENAME_RE.match(s) and s.lower() not in VERIFY_NON_FILES:
                claim_type = "filename"
            else:
                continue  # bare words, tags like [inferred], tool names, commands
            claims.append({"claim": s + "/" if is_dir_claim else s, "lookup": s,
                           "type": claim_type, "sourceFile": source_file, "line": i})
    return claims


def build_file_index(root):
    by_path = {}  # lowercased rel path -> actual rel path (files AND dirs)
    by_name = {}  # lowercased basename  -> [actual rel file paths]

    def walk(rel_dir):
        abs_dir = root / rel_dir if rel_dir else root
        try:
            entries = sorted(abs_dir.iterdir(), key=lambda p: p.name)
        except OSError:
            return
        for e in entries:
            if e.is_symlink():
                continue
            rel = f"{rel_dir}/{e.name}" if rel_dir else e.name
            by_path[rel.lower()] = rel
            if e.is_dir():
                if e.name.lower() not in VERIFY_IGNORED_DIRS:
                    walk(rel)
            elif e.is_file():
                by_name.setdefault(e.name.lower(), []).append(rel)

    walk("")
    return by_path, by_name


def verify(target, flags):
    # 1. Which docs make claims? Entry files + the guide + the feature catalogs.
    sources = [f for f in ("CLAUDE.md", "AGENTS.md") if (target / f).is_file()]
    guide_dir = target / "ai" / "guide"
    if guide_dir.is_dir():
        sources += ["ai/guide/" + p.name for p in sorted(guide_dir.iterdir())
                    if p.is_file() and p.name.endswith(".md")]
    analysis_dir = target / "ai" / "analysis"
    if analysis_dir.is_dir():
        sources += ["ai/analysis/" + p.name for p in sorted(analysis_dir.iterdir())
                    if p.is_file() and p.name.startswith("FEATURE_CATALOG")
                    and p.name.endswith(".md")]
    if not sources:
        die("Nothing to verify: no CLAUDE.md/AGENTS.md/ai/ docs found. "
            "Run install (or shazam) first.")

    # 2. Extract claims (deduplicated per source file).
    seen, claims = set(), []
    for src in sources:
        text = (target / src).read_text(encoding="utf-8", errors="replace")
        for c in extract_claims(text, src):
            key = c["lookup"].lower() + "|" + src
            if key in seen:
                continue
            seen.add(key)
            claims.append(c)

    # 3. One walk of the tree, then check every claim against the index.
    by_path, by_name = build_file_index(target)
    confirmed = moved = missing = 0
    for c in claims:
        if c["type"] == "path":
            hit = by_path.get(c["lookup"].lower())
            if hit:
                c["status"], c["foundAt"] = "confirmed", hit
                confirmed += 1
            else:
                alt = by_name.get(c["lookup"].rsplit("/", 1)[-1].lower(), [])
                if alt:
                    c["status"], c["foundAt"] = "moved", alt[0]
                    moved += 1
                    if len(alt) > 1:
                        c["note"] = f"{len(alt)} files share this basename"
                else:
                    c["status"], c["foundAt"] = "missing", None
                    missing += 1
        else:  # filename claim: confirmed if the basename exists anywhere
            alt = by_name.get(c["lookup"].lower(), [])
            if alt:
                c["status"], c["foundAt"] = "confirmed", alt[0]
                confirmed += 1
                if len(alt) > 1:
                    c["note"] = f"{len(alt)} matches"
            else:
                c["status"], c["foundAt"] = "missing", None
                missing += 1
        del c["lookup"]

    # 4. Report.
    generated_at = datetime.now(timezone.utc).isoformat()
    manifest = {
        "_comment": "Generated by ai-fication-kit `verify` — deterministic "
                    "file-existence checks only, no LLM. Safe to edit manually; "
                    "regenerate any time.",
        "kitVersion": KIT_VERSION,
        "generated": generated_at,
        "sourcesScanned": sources,
        "totalClaims": len(claims),
        "summary": {"confirmed": confirmed, "moved": moved, "missing": missing},
        "claims": claims,
    }
    bad = [c for c in claims if c["status"] != "confirmed"]
    report_lines = [
        "# Claim verification report",
        "",
        f"> Generated mechanically by ai-fication-kit `verify` on {generated_at[:10]}.",
        "> A claim is a backtick-quoted path in the knowledge docs; verification is a",
        "> file-existence check against the repository tree. No model involved — treat",
        "> the statuses as facts, the fix as your judgement.",
        "",
        "| Status | Count | Meaning |",
        "|---|---|---|",
        f"| confirmed | {confirmed} | claim found on disk |",
        f"| moved | {moved} | path is stale; a file with that name exists elsewhere |",
        f"| missing | {missing} | nothing on disk matches the claim |",
        "",
    ]
    if bad:
        report_lines += ["## Stale or missing claims (fix the docs, or the docs lie)", "",
                         "| Claim | Status | Found at | Source | Line |",
                         "|---|---|---|---|---|"]
        for c in bad:
            found = f"`{c['foundAt']}`" if c["foundAt"] else "—"
            report_lines.append(
                f"| `{c['claim']}` | {c['status']} | {found} | {c['sourceFile']} | {c['line']} |")
        report_lines.append("")
    else:
        report_lines += ["All claims confirmed. The knowledge docs match the tree.", ""]
    report_lines += [f"{confirmed} confirmed claim(s) — full list in "
                     "VERIFICATION_MANIFEST.json.", ""]

    print(f"\nScanned {len(sources)} doc(s), checked {len(claims)} claim(s):")
    print(f"  confirmed {confirmed}   moved {moved}   missing {missing}")
    for c in bad[:20]:
        mark = "✗ missing" if c["status"] == "missing" else "→ moved  "
        at = f" — found at {c['foundAt']}" if c["foundAt"] else ""
        print(f"  {mark}  {c['claim']}  ({c['sourceFile']}:{c['line']}{at})")
    if len(bad) > 20:
        print(f"  … and {len(bad) - 20} more — see the report.")

    if flags.get("dry_run"):
        print("\n--dry-run: manifest and report not written.")
    else:
        (target / VERIFY_MANIFEST_REL).parent.mkdir(parents=True, exist_ok=True)
        (target / VERIFY_MANIFEST_REL).write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        (target / VERIFY_REPORT_REL).write_text(
            "\n".join(report_lines), encoding="utf-8")
        print(f"\n✓ Wrote {VERIFY_MANIFEST_REL.as_posix()}")
        print(f"✓ Wrote {VERIFY_REPORT_REL.as_posix()}")
    if flags.get("strict") and bad:
        die(f"--strict: {len(bad)} claim(s) not confirmed.")
