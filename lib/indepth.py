# Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
"""indepth — comprehensive repo deep analysis and architectural inference in Python.
"""

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from .util import KIT_VERSION


def run_cmd(cmd, cwd):
    try:
        r = subprocess.run(cmd, shell=True, cwd=str(cwd), capture_output=True, text=True, encoding="utf-8", errors="replace")
        return {"code": r.returncode, "out": r.stdout + r.stderr, "success": r.returncode == 0}
    except Exception as e:
        return {"code": 1, "out": str(e), "success": False}


def parse_gitignore(target):
    rules = []
    gitignore_path = target / ".gitignore"
    if gitignore_path.is_file():
        try:
            content = gitignore_path.read_text(encoding="utf-8", errors="replace")
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue

                # Escape special characters, convert * to .* and ? to .
                pattern = re.escape(line)
                pattern = pattern.replace(r"\*", ".*").replace(r"\?", ".")

                if line.endswith("/"):
                    pattern += "?.*"
                else:
                    pattern += "($|/)"

                if line.startswith("/"):
                    pattern = "^" + pattern[1:]
                else:
                    pattern = "(^|/)" + pattern

                try:
                    rules.append(re.compile(pattern))
                except re.error:
                    pass
        except OSError:
            pass
    return rules


def count_loc_and_comments(content, filename):
    ext = Path(filename).suffix.lower()
    lines = content.splitlines()
    is_block_comment = False
    loc = 0
    has_docstring = False

    is_python = ext == ".py"
    is_sql = ext == ".sql"
    is_latex = ext == ".tex"

    for line in lines:
        trimmed = line.strip()
        if not trimmed:
            continue

        if is_block_comment:
            if "*/" in trimmed and not is_python:
                is_block_comment = False
            elif is_python and ('"""' in trimmed or "'''" in trimmed):
                is_block_comment = False
            continue

        if not is_python and trimmed.startswith("/*"):
            has_docstring = has_docstring or trimmed.startswith("/**")
            if "*/" not in trimmed:
                is_block_comment = True
            continue

        if is_python and (trimmed.startswith('"""') or trimmed.startswith("'''")):
            has_docstring = True
            quotes = '"""' if trimmed.startswith('"""') else "'''"
            second_quote_idx = trimmed.find(quotes, len(quotes))
            if second_quote_idx == -1:
                is_block_comment = True
            continue

        # Line comments
        if not is_python and not is_sql and not is_latex and trimmed.startswith("//"):
            has_docstring = has_docstring or trimmed.startswith("///")
            continue
        if is_python and trimmed.startswith("#"):
            continue
        if trimmed.startswith("#") and (ext in (".rb", ".sh", ".pl") or filename.lower() == "makefile"):
            continue
        if is_sql and trimmed.startswith("--"):
            continue
        if is_latex and trimmed.startswith("%"):
            continue

        loc += 1

    return loc, has_docstring


def walk_repository(dir_path, root_dir, gitignore_rules, files_info, warnings):
    try:
        entries = list(dir_path.iterdir())
    except OSError as err:
        warnings.append({
            "category": "filesystem",
            "message": f"Failed to read directory {dir_path.relative_to(root_dir)}: {str(err)}",
            "severity": "medium"
        })
        return

    base_ignores = {"node_modules", ".git", ".venv", ".env", "dist", "build", "target", "bin", "obj", "__pycache__", ".claude", "ai"}
    binary_extensions = {"png", "jpg", "jpeg", "gif", "ico", "webp", "mp4", "mp3", "zip", "tar", "gz", "exe", "dll", "so", "dylib", "woff", "woff2", "eot", "ttf", "pdf", "pyc"}

    for entry in entries:
        if entry.name in base_ignores:
            continue

        try:
            rel_path = entry.relative_to(root_dir).as_posix()
        except ValueError:
            rel_path = entry.name

        is_ignored = False
        for rule in gitignore_rules:
            if rule.search(rel_path) or rule.search(entry.name):
                is_ignored = True
                break
        if is_ignored:
            continue

        if entry.is_dir():
            walk_repository(entry, root_dir, gitignore_rules, files_info, warnings)
        elif entry.is_file():
            ext = entry.suffix.lower()[1:]
            if ext in binary_extensions:
                continue

            try:
                size = entry.stat().st_size
            except OSError:
                size = 0

            files_info.append({
                "path": rel_path,
                "name": entry.name,
                "ext": ext,
                "size": size
            })


# ---------------------------------------------------- Detectors
def detect_dependencies(target, files_info):
    result = {
        "total": 0,
        "direct": 0,
        "transitive": 0,
        "byCategory": {"production": 0, "development": 0, "optional": 0},
        "topLevelDeps": []
    }

    # Node dependencies
    pkg_path = target / "package.json"
    if pkg_path.is_file():
        try:
            pkg = json.loads(pkg_path.read_text(encoding="utf-8", errors="replace"))
            deps = pkg.get("dependencies") or {}
            dev_deps = pkg.get("devDependencies") or {}
            opt_deps = pkg.get("optionalDependencies") or {}

            for name, version in deps.items():
                result["byCategory"]["production"] += 1
                result["topLevelDeps"].append({"name": name, "version": version, "category": "prod"})
            for name, version in dev_deps.items():
                result["byCategory"]["development"] += 1
                result["topLevelDeps"].append({"name": name, "version": version, "category": "dev"})
            for name, version in opt_deps.items():
                result["byCategory"]["optional"] += 1
                result["topLevelDeps"].append({"name": name, "version": version, "category": "optional"})
            result["direct"] = len(result["topLevelDeps"])
        except (ValueError, OSError):
            pass

        lock_path = target / "package-lock.json"
        yarn_lock_path = target / "yarn.lock"
        pnpm_lock_path = target / "pnpm-lock.yaml"

        if lock_path.is_file():
            try:
                lock = json.loads(lock_path.read_text(encoding="utf-8", errors="replace"))
                if "packages" in lock:
                    result["total"] = len([k for k in lock["packages"].keys() if k != ""])
                elif "dependencies" in lock:
                    result["total"] = len(lock["dependencies"].keys())
            except (ValueError, OSError):
                pass
        elif yarn_lock_path.is_file():
            try:
                txt = yarn_lock_path.read_text(encoding="utf-8", errors="replace")
                matches = re.findall(r"^\S+.*:$", txt, re.M)
                result["total"] = len([l for l in matches if not l.startswith("#") and "@" in l])
            except OSError:
                pass
        elif pnpm_lock_path.is_file():
            try:
                txt = pnpm_lock_path.read_text(encoding="utf-8", errors="replace")
                matches = re.findall(r"""^\s{2}['"]?\/[^'"]+['"]?:""", txt, re.M)
                result["total"] = len(matches)
            except OSError:
                pass

    # Python dependencies
    pyproject_path = target / "pyproject.toml"
    req_path = target / "requirements.txt"
    poetry_lock_path = target / "poetry.lock"
    pipfile_lock_path = target / "Pipfile.lock"

    if pyproject_path.is_file():
        try:
            txt = pyproject_path.read_text(encoding="utf-8", errors="replace")
            poetry_deps_section = False
            for line in txt.splitlines():
                line = line.strip()
                if line.startswith("[tool.poetry.dependencies]"):
                    poetry_deps_section = True
                    continue
                if line.startswith("["):
                    poetry_deps_section = False
                if poetry_deps_section:
                    m = re.match(r"^\s*([^=\s#]+)\s*=\s*", line)
                    if m and m.group(1) != "python":
                        result["direct"] += 1
                        result["byCategory"]["production"] += 1
                        result["topLevelDeps"].append({"name": m.group(1), "version": "*", "category": "prod"})
        except OSError:
            pass
    elif req_path.is_file():
        try:
            txt = req_path.read_text(encoding="utf-8", errors="replace")
            for line in txt.splitlines():
                line = line.strip()
                if line and not line.startswith("#") and not line.startswith("-"):
                    parts = re.split(r"[==,>=,<=,~=]", line)
                    if parts[0]:
                        result["direct"] += 1
                        result["byCategory"]["production"] += 1
                        result["topLevelDeps"].append({
                            "name": parts[0].strip(),
                            "version": parts[1].strip() if len(parts) > 1 else "*",
                            "category": "prod"
                        })
        except OSError:
            pass

    if poetry_lock_path.is_file():
        try:
            txt = poetry_lock_path.read_text(encoding="utf-8", errors="replace")
            packages = re.findall(r"^\[\[package\]\]", txt, re.M)
            result["total"] = max(result["total"], len(packages))
        except OSError:
            pass
    elif pipfile_lock_path.is_file():
        try:
            lock = json.loads(pipfile_lock_path.read_text(encoding="utf-8", errors="replace"))
            count = len(lock.get("default", {}).keys()) + len(lock.get("develop", {}).keys())
            result["total"] = max(result["total"], count)
        except (ValueError, OSError):
            pass

    # Go dependencies
    go_mod_path = target / "go.mod"
    go_sum_path = target / "go.sum"
    if go_mod_path.is_file():
        try:
            txt = go_mod_path.read_text(encoding="utf-8", errors="replace")
            in_require = False
            for line in txt.splitlines():
                line = line.strip()
                if line.startswith("require ("):
                    in_require = True
                    continue
                if line.startswith(")"):
                    in_require = False
                    continue
                if in_require or line.startswith("require "):
                    if "// indirect" not in line:
                        parts = line.replace("require ", "").strip().split()
                        if parts:
                            result["direct"] += 1
                            result["byCategory"]["production"] += 1
                            result["topLevelDeps"].append({
                                "name": parts[0],
                                "version": parts[1] if len(parts) > 1 else "*",
                                "category": "prod"
                            })
        except OSError:
            pass

        if go_sum_path.is_file():
            try:
                sum_txt = go_sum_path.read_text(encoding="utf-8", errors="replace")
                pkgs = set()
                for line in sum_txt.splitlines():
                    parts = line.strip().split()
                    if parts:
                        pkgs.add(parts[0])
                result["total"] = max(result["total"], len(pkgs))
            except OSError:
                pass

    # Rust dependencies
    cargo_toml_path = target / "Cargo.toml"
    cargo_lock_path = target / "Cargo.lock"
    if cargo_toml_path.is_file():
        try:
            txt = cargo_toml_path.read_text(encoding="utf-8", errors="replace")
            in_deps = False
            for line in txt.splitlines():
                line = line.strip()
                if line.startswith("[dependencies]") or line.startswith("[dev-dependencies]"):
                    in_deps = True
                    continue
                if line.startswith("["):
                    in_deps = False
                if in_deps:
                    m = re.match(r"^([^=\s]+)\s*=\s*", line)
                    if m:
                        result["direct"] += 1
                        result["byCategory"]["production"] += 1
                        result["topLevelDeps"].append({"name": m.group(1), "version": "*", "category": "prod"})
        except OSError:
            pass

        if cargo_lock_path.is_file():
            try:
                lock_txt = cargo_lock_path.read_text(encoding="utf-8", errors="replace")
                matches = re.findall(r"^\[\[package\]\]", lock_txt, re.M)
                result["total"] = max(result["total"], len(matches))
            except OSError:
                pass

    # Ruby dependencies
    gemfile_path = target / "Gemfile"
    gemfile_lock_path = target / "Gemfile.lock"
    if gemfile_path.is_file():
        try:
            txt = gemfile_path.read_text(encoding="utf-8", errors="replace")
            for line in txt.splitlines():
                m = re.match(r"""^gem\s+['"]([^'"]+)['"]""", line.strip())
                if m:
                    result["direct"] += 1
                    result["byCategory"]["production"] += 1
                    result["topLevelDeps"].append({"name": m.group(1), "version": "*", "category": "prod"})
        except OSError:
            pass

        if gemfile_lock_path.is_file():
            try:
                lock_txt = gemfile_lock_path.read_text(encoding="utf-8", errors="replace")
                in_specs = False
                gems = set()
                for line in lock_txt.splitlines():
                    if "specs:" in line:
                        in_specs = True
                        continue
                    if line and not line.startswith("    "):
                        in_specs = False
                    if in_specs and line.startswith("    "):
                        m = re.match(r"^([^(\s]+)", line.strip())
                        if m:
                            gems.add(m.group(1))
                result["total"] = max(result["total"], len(gems))
            except OSError:
                pass

    # Composer PHP dependencies
    composer_path = target / "composer.json"
    composer_lock_path = target / "composer.lock"
    if composer_path.is_file():
        try:
            comp = json.loads(composer_path.read_text(encoding="utf-8", errors="replace"))
            req = comp.get("require") or {}
            req_dev = comp.get("require-dev") or {}
            for name, version in req.items():
                if name != "php":
                    result["byCategory"]["production"] += 1
                    result["topLevelDeps"].append({"name": name, "version": version, "category": "prod"})
            for name, version in req_dev.items():
                result["byCategory"]["development"] += 1
                result["topLevelDeps"].append({"name": name, "version": version, "category": "dev"})
            result["direct"] = len(result["topLevelDeps"])
        except (ValueError, OSError):
            pass

        if composer_lock_path.is_file():
            try:
                lock = json.loads(composer_lock_path.read_text(encoding="utf-8", errors="replace"))
                result["total"] = max(result["total"], len(lock.get("packages") or []) + len(lock.get("packages-dev") or []))
            except (ValueError, OSError):
                pass

    result["total"] = max(result["total"], result["direct"])
    result["transitive"] = max(0, result["total"] - result["direct"])

    return result


def analyze_code_structure_and_docs(target, files_info):
    file_count = len(files_info)
    lines_of_code = 0
    source_files_only = 0
    test_file_count = 0
    documentation_files = 0

    doc_exts = {"md", "txt", "adoc", "rst"}
    src_exts = {"js", "mjs", "cjs", "ts", "tsx", "py", "java", "go", "rs", "rb", "php", "cs", "c", "cpp", "h", "hpp"}

    docstring_files_count = 0
    modules_map = {}
    
    max_depth = 0
    dir_counts = {}
    dir_files = {}

    code_distribution = {"src": 0, "test": 0, "docs": 0, "config": 0, "other": 0}

    for file in files_info:
        parts = file["path"].split("/")
        depth = len(parts) - 1
        if depth > max_depth:
            max_depth = depth

        for i in range(len(parts) - 1):
            parent = "/".join(parts[:i + 1])
            child = "/".join(parts[:i + 2])
            if parent not in dir_counts:
                dir_counts[parent] = set()
            if i < len(parts) - 2:
                dir_counts[parent].add(child)

        parent_dir = "/".join(parts[:-1])
        if parent_dir:
            dir_files[parent_dir] = dir_files.get(parent_dir, 0) + 1

        is_test = "/test" in file["path"] or "/spec" in file["path"] or "__tests__" in file["path"] or "test" in file["name"] or "spec" in file["name"]

        category = "other"
        if file["ext"] in doc_exts:
            category = "docs"
            documentation_files += 1
        elif is_test:
            category = "test"
            test_file_count += 1
        elif file["ext"] in src_exts:
            category = "src"
            source_files_only += 1
        elif file["ext"] in {"json", "yaml", "yml", "toml", "xml", "ini", "config", "gitignore"} or file["name"].startswith("."):
            category = "config"

        file_loc = 0
        if file["size"] < 500 * 1024 and category in ("src", "test", "docs"):
            full_path = target / file["path"]
            try:
                text = full_path.read_text(encoding="utf-8", errors="replace")
                loc, has_docstring = count_loc_and_comments(text, file["name"])
                file_loc = loc
                if has_docstring:
                    docstring_files_count += 1
            except OSError:
                pass
        else:
            file_loc = round(file["size"] / 40)

        lines_of_code += file_loc
        code_distribution[category] += file_loc

        mod_name = None
        if parts[0] == "src" and len(parts) > 1:
            mod_name = parts[1]
        elif parts[0] != "src" and parts[0] and len(parts) > 1:
            if parts[0] not in ("docs", "test", "tests", "spec", ".github"):
                mod_name = parts[0]

        if mod_name:
            if mod_name not in modules_map:
                modules_map[mod_name] = {"fileCount": 0, "files": []}
            modules_map[mod_name]["fileCount"] += 1
            modules_map[mod_name]["files"].append(file["path"])

    branch_sum = 0
    branch_count = 0
    for subdirs in dir_counts.values():
        if len(subdirs) > 0:
            branch_sum += len(subdirs)
            branch_count += 1
    avg_branching_factor = branch_sum / branch_count if branch_count else 0.0

    standard_dirs = []
    try:
        root_entries = [p for p in target.iterdir() if p.is_dir()]
    except OSError:
        root_entries = []

    for entry in root_entries:
        purpose = ""
        if entry.name in ("src", "lib", "app", "pkg"):
            purpose = "Source Code"
        elif entry.name in ("test", "tests", "spec", "__tests__"):
            purpose = "Test Suite"
        elif entry.name == "docs":
            purpose = "Documentation"
        elif entry.name == ".github":
            purpose = "CI/CD and GitHub Configuration"
        elif entry.name in ("config", "configs"):
            purpose = "Configuration Files"
        elif entry.name == "bin":
            purpose = "Binaries / Scripts"

        if purpose:
            rel = entry.name
            f_count = len([f for f in files_info if f["path"].startswith(rel + "/")])
            standard_dirs.append({"name": entry.name, "purpose": purpose, "fileCount": f_count})

    module_structure = []
    mod_names = list(modules_map.keys())
    for name, info in modules_map.items():
        deps = set()
        for file_path in info["files"]:
            full_path = target / file_path
            try:
                content = full_path.read_text(encoding="utf-8", errors="replace")
                for line in content.splitlines():
                    if any(k in line for k in ("import", "require", "use", "using")):
                        for other in mod_names:
                            if other != name and (f"/{other}/" in line or f"/{other}\"" in line or f"/{other}'" in line or re.search(r"\b" + re.escape(other) + r"\b", line)):
                                deps.add(other)
            except OSError:
                pass
        module_structure.append({"name": name, "fileCount": info["fileCount"], "dependencies": sorted(list(deps))})

    docstring_percent = (docstring_files_count / source_files_only * 100) if source_files_only else 0.0

    return {
        "codeMetrics": {
            "fileCount": file_count,
            "linesOfCode": lines_of_code,
            "sourceFilesOnly": source_files_only,
            "testFileCount": test_file_count,
            "documentationFiles": documentation_files
        },
        "directoryStructure": {
            "depth": max_depth,
            "avgBranchingFactor": avg_branching_factor,
            "standardDirs": standard_dirs
        },
        "moduleStructure": module_structure,
        "codeDistribution": code_distribution,
        "docstringPercent": docstring_percent
    }


def infer_architecture(target, files_info, code_struct):
    pattern = "monolithic"
    confidence = 0.85

    layered_folders = ["controllers", "services", "models", "views", "routes", "handlers", "dao", "repository"]
    has_layers = any(any(f"/{lf}/" in f["path"] for lf in layered_folders) for f in files_info)
    plugin_folders = ["plugins", "extensions", "addons"]
    has_plugins = any(any(f"/{pf}/" in f["path"] for pf in plugin_folders) for f in files_info)

    subprojects = len([f for f in files_info if f["name"] == "package.json" and "/" in f["path"]]) + \
                  len([f for f in files_info if f["name"] == "pom.xml" and "/" in f["path"]])

    if subprojects > 2:
        pattern = "microservices"
        confidence = 0.90
    elif has_plugins:
        pattern = "plugin"
        confidence = 0.88
    elif has_layers:
        pattern = "layered"
        confidence = 0.92
    elif len(code_struct["moduleStructure"]) > 3:
        pattern = "modular"
        confidence = 0.88

    layers = []
    if pattern in ("layered", "hybrid"):
        for lf in layered_folders:
            dirs = sorted(list(set(str(Path(f["path"]).parent) for f in files_info if f"/{lf}/" in f["path"])))
            if dirs:
                resp = "Handles data persistent operations"
                if lf in ("controllers", "routes", "handlers"):
                    resp = "Handles incoming HTTP requests and routing"
                elif lf == "services":
                    resp = "Implements business logic"
                layers.append({"name": lf, "directories": dirs, "responsibility": resp})

    http_server = False
    message_queue = False
    database_access = False
    external_apis = False
    comm_evidence = []

    has_load_balancing = False
    has_caching = False
    has_async = False
    scal_evidence = []

    check_keywords = [
        {"key": "express", "category": "httpServer", "label": "Express server import", "isScal": False},
        {"key": "fastapi", "category": "httpServer", "label": "FastAPI import", "isScal": False},
        {"key": "flask", "category": "httpServer", "label": "Flask import", "isScal": False},
        {"key": "django", "category": "httpServer", "label": "Django import", "isScal": False},
        {"key": "spring", "category": "httpServer", "label": "Spring Boot configuration", "isScal": False},
        {"key": "celery", "category": "messageQueue", "label": "Celery message queue", "isScal": False},
        {"key": "kafka", "category": "messageQueue", "label": "Kafka client", "isScal": False},
        {"key": "rabbitmq", "category": "messageQueue", "label": "RabbitMQ amqp protocol", "isScal": False},
        {"key": "prisma", "category": "databaseAccess", "label": "Prisma ORM schema", "isScal": False},
        {"key": "sequelize", "category": "databaseAccess", "label": "Sequelize ORM", "isScal": False},
        {"key": "mongoose", "category": "databaseAccess", "label": "Mongoose MongoDB schema", "isScal": False},
        {"key": "sqlalchemy", "category": "databaseAccess", "label": "SQLAlchemy database model", "isScal": False},
        {"key": "redis", "category": "hasCaching", "label": "Redis client cache", "isScal": True},
        {"key": "memcached", "category": "hasCaching", "label": "Memcached cache client", "isScal": True},
        {"key": "nginx", "category": "hasLoadBalancing", "label": "Nginx proxy configuration", "isScal": True},
        {"key": "haproxy", "category": "hasLoadBalancing", "label": "HAProxy load balancer", "isScal": True},
        {"key": "asyncio", "category": "hasAsync", "label": "asyncio async patterns", "isScal": True},
        {"key": "tokio", "category": "hasAsync", "label": "Tokio Rust runtime", "isScal": True},
        {"key": "axios", "category": "externalAPIs", "label": "Axios client", "isScal": False},
        {"key": "requests", "category": "externalAPIs", "label": "requests library", "isScal": False}
    ]

    for file in files_info:
        if "nginx" in file["name"] or "docker-compose" in file["name"]:
            if "nginx" in file["name"]:
                has_load_balancing = True
                if "Nginx config" not in scal_evidence:
                    scal_evidence.append("Nginx config")

        if file["size"] < 200 * 1024 and (Path(file["name"]).suffix == ".json" or Path(file["name"]).suffix == ".toml" or file["ext"] in ("js", "ts", "py", "go")):
            full_path = target / file["path"]
            try:
                text = full_path.read_text(encoding="utf-8", errors="replace")
                lower_text = text.lower()
                for ck in check_keywords:
                    if ck["key"] in lower_text:
                        if ck["isScal"]:
                            if ck["category"] == "hasCaching":
                                has_caching = True
                            if ck["category"] == "hasLoadBalancing":
                                has_load_balancing = True
                            if ck["category"] == "hasAsync":
                                has_async = True
                            if ck["label"] not in scal_evidence:
                                scal_evidence.append(ck["label"])
                        else:
                            if ck["category"] == "httpServer":
                                http_server = True
                            if ck["category"] == "messageQueue":
                                message_queue = True
                            if ck["category"] == "databaseAccess":
                                database_access = True
                            if ck["category"] == "externalAPIs":
                                external_apis = True
                            if ck["label"] not in comm_evidence:
                                comm_evidence.append(ck["label"])

                if "Promise" in text or "async " in text or "await " in text:
                    has_async = True
                    if "async/await keywords" not in scal_evidence:
                        scal_evidence.append("async/await keywords")
                if "db.pool" in text or "connectionLimit" in text or "max_overflow" in text:
                    if "DB Pool settings" not in scal_evidence:
                        scal_evidence.append("DB Pool settings")
            except OSError:
                pass

    env_example = any(f["name"] == ".env.example" for f in files_info)
    if env_example:
        external_apis = True
        if ".env.example variables" not in comm_evidence:
            comm_evidence.append(".env.example variables")

    return {
        "inferredArchitecture": {"pattern": pattern, "confidence": confidence, "layers": layers},
        "communicationPatterns": {
            "httpServer": http_server,
            "messageQueue": message_queue,
            "databaseAccess": database_access,
            "externalAPIs": external_apis,
            "evidence": comm_evidence
        },
        "scalabilityIndicators": {
            "hasLoadBalancing": has_load_balancing,
            "hasCaching": has_caching,
            "hasAsync": has_async,
            "evidence": scal_evidence
        }
    }


def analyze_git_history(target, warnings):
    result = {
        "commitCount": 0,
        "contributorCount": 0,
        "commitFrequency": "low",
        "lastCommitDate": None,
        "topContributors": [],
        "activeBranches": [],
        "tagCount": 0,
        "releases": []
    }

    git_dir = target / ".git"
    if not git_dir.is_dir():
        warnings.append({
            "category": "git",
            "message": "Git directory not found. Skipping git history insights.",
            "severity": "medium"
        })
        return None

    if (git_dir / "shallow").is_file():
        warnings.append({
            "category": "git",
            "message": "Repository is a shallow clone; statistics are limited to local commits.",
            "severity": "medium"
        })

    git_check = run_cmd("git rev-parse --is-inside-work-tree", target)
    if not git_check["success"]:
        warnings.append({
            "category": "git",
            "message": "Target is not a valid git repository or Git binary is missing.",
            "severity": "medium"
        })
        return None

    # Total commits
    count_cmd = run_cmd("git rev-list --count --all", target)
    if count_cmd["success"]:
        try:
            result["commitCount"] = int(count_cmd["out"].strip())
        except ValueError:
            result["commitCount"] = 0

    # Last commit date
    last_cmd = run_cmd("git log -1 --format=%cI", target)
    if last_cmd["success"] and last_cmd["out"].strip():
        result["lastCommitDate"] = last_cmd["out"].strip()

    shortlog_cmd = run_cmd("git shortlog -sn --all --mailmap", target)
    if not shortlog_cmd["success"]:
        shortlog_cmd = run_cmd("git shortlog -sn --all", target)
    if shortlog_cmd["success"]:
        lines = [l for l in shortlog_cmd["out"].strip().split("\n") if l]
        result["contributorCount"] = len(lines)
        for line in lines[:5]:
            parts = line.strip().split("\t")
            if len(parts) > 1:
                try:
                    result["topContributors"].append({"email": parts[1], "commitCount": int(parts[0])})
                except ValueError:
                    pass
            else:
                space_parts = line.strip().split()
                if len(space_parts) > 1:
                    try:
                        result["topContributors"].append({"email": " ".join(space_parts[1:]), "commitCount": int(space_parts[0])})
                    except ValueError:
                        pass

    # Active branches
    branches_cmd = run_cmd("git branch -a --format='%(refname:short)'", target)
    if branches_cmd["success"]:
        list_branches = [b.replace("'", "").strip() for b in branches_cmd["out"].strip().split("\n") if b]
        seen_branches = []
        for b in list_branches:
            if b not in seen_branches:
                seen_branches.append(b)
        result["activeBranches"] = seen_branches[:10]

    # Tags and Releases
    tags_cmd = run_cmd("git for-each-ref --sort=-taggerdate --format='%(refname:short)|%(taggerdate:iso8601)|%(subject)' refs/tags", target)
    if tags_cmd["success"]:
        lines = [l for l in tags_cmd["out"].strip().split("\n") if l]
        result["tagCount"] = len(lines)
        for line in lines[:5]:
            parts = line.replace("'", "").split("|")
            if parts:
                result["releases"].append({
                    "tag": parts[0],
                    "date": parts[1] if len(parts) > 1 else None,
                    "message": parts[2] if len(parts) > 2 else ""
                })

    if result["commitCount"] > 500:
        result["commitFrequency"] = "high"
    elif result["commitCount"] > 100:
        result["commitFrequency"] = "medium"
    else:
        result["commitFrequency"] = "low"

    return result


def analyze_configuration(target, files_info):
    result = {
        "configurationFiles": {
            "present": [],
            "byCategory": {"build": [], "testing": [], "linting": [], "ci_cd": [], "deployment": [], "security": []}
        },
        "environmentConfiguration": {
            "hasEnvExample": False,
            "envVariablesCount": 0,
            "secretsManagement": "none",
            "evidence": []
        }
    }

    configs_map = [
        {"name": "package.json", "category": "build", "tool": "npm/yarn/pnpm", "purpose": "Node project manifest"},
        {"name": "tsconfig.json", "category": "build", "tool": "TypeScript", "purpose": "TypeScript compiler config"},
        {"name": "webpack.config.js", "category": "build", "tool": "Webpack", "purpose": "JS bundler configuration"},
        {"name": "vite.config.ts", "category": "build", "tool": "Vite", "purpose": "Vite dev and bundle config"},
        {"name": "pom.xml", "category": "build", "tool": "Maven", "purpose": "Java Maven build file"},
        {"name": "build.gradle", "category": "build", "tool": "Gradle", "purpose": "Java Gradle build file"},
        {"name": "pyproject.toml", "category": "build", "tool": "Poetry/pip", "purpose": "Python package config"},
        {"name": "Cargo.toml", "category": "build", "tool": "Cargo", "purpose": "Rust crate configuration"},
        {"name": "go.mod", "category": "build", "tool": "Go", "purpose": "Go module definition"},
        {"name": "Makefile", "category": "build", "tool": "Make", "purpose": "Universal build automator"},
        {"name": "CMakeLists.txt", "category": "build", "tool": "CMake", "purpose": "C/C++ project cmake file"},
        {"name": "jest.config.js", "category": "testing", "tool": "Jest", "purpose": "JS test runner configuration"},
        {"name": "vitest.config.ts", "category": "testing", "tool": "Vitest", "purpose": "JS test framework configuration"},
        {"name": "pytest.ini", "category": "testing", "tool": "pytest", "purpose": "Python test configuration"},
        {"name": "cypress.config.ts", "category": "testing", "tool": "Cypress", "purpose": "E2E testing configuration"},
        {"name": "playwright.config.ts", "category": "testing", "tool": "Playwright", "purpose": "E2E testing configuration"},
        {"name": ".eslintrc.json", "category": "linting", "tool": "ESLint", "purpose": "JS/TS linter rules"},
        {"name": ".eslintrc.js", "category": "linting", "tool": "ESLint", "purpose": "JS/TS linter rules"},
        {"name": ".eslintrc", "category": "linting", "tool": "ESLint", "purpose": "JS/TS linter rules"},
        {"name": "eslint.config.js", "category": "linting", "tool": "ESLint", "purpose": "Flat ESLint configuration"},
        {"name": ".prettierrc", "category": "linting", "tool": "Prettier", "purpose": "Code formatter rules"},
        {"name": ".gitignore", "category": "build", "tool": "Git", "purpose": "Git ignored file patterns"},
        {"name": "Dockerfile", "category": "deployment", "tool": "Docker", "purpose": "Docker image definition"},
        {"name": "docker-compose.yml", "category": "deployment", "tool": "Docker Compose", "purpose": "Multi-container app runner"},
        {"name": "serverless.yml", "category": "deployment", "tool": "Serverless", "purpose": "Serverless Framework configuration"},
        {"name": "SECURITY.md", "category": "security", "tool": "Security", "purpose": "Project security disclosure guidelines"},
        {"name": "dependabot.yml", "category": "security", "tool": "Dependabot", "purpose": "Automated dependency updates"}
    ]

    for file in files_info:
        match = next((c for c in configs_map if c["name"] == file["name"]), None)
        if match:
            result["configurationFiles"]["present"].append({"file": file["path"], "purpose": match["purpose"], "tool": match["tool"]})
            result["configurationFiles"]["byCategory"][match["category"]].append(file["path"])
        
        if file["path"].startswith(".github/workflows/"):
            result["configurationFiles"]["present"].append({"file": file["path"], "purpose": "GitHub Actions workflow", "tool": "GitHub Actions"})
            if file["path"] not in result["configurationFiles"]["byCategory"]["ci_cd"]:
                result["configurationFiles"]["byCategory"]["ci_cd"].append(file["path"])

    env_example = next((f for f in files_info if f["name"] in (".env.example", "env.example")), None)
    if env_example:
        result["environmentConfiguration"]["hasEnvExample"] = True
        try:
            content = (target / env_example["path"]).read_text(encoding="utf-8", errors="replace")
            vars_list = [line for line in content.splitlines() if line.strip() and not line.strip().startswith("#") and "=" in line]
            result["environmentConfiguration"]["envVariablesCount"] = len(vars_list)
            
            lower_txt = content.lower()
            if "vault" in lower_txt or "hcvault" in lower_txt:
                result["environmentConfiguration"]["secretsManagement"] = "vault"
                result["environmentConfiguration"]["evidence"].append("Vault references in .env.example")
            elif "secret" in lower_txt or "token" in lower_txt or "key" in lower_txt:
                result["environmentConfiguration"]["secretsManagement"] = "env"
                result["environmentConfiguration"]["evidence"].append("Key/Token strings in .env.example")
        except OSError:
            pass

    for file in files_info:
        if file["size"] < 100 * 1024 and file["ext"] in ("js", "ts", "py", "go"):
            try:
                txt = (target / file["path"]).read_text(encoding="utf-8", errors="replace")
                if "SecretsManagerClient" in txt or "secretsmanager" in txt:
                    result["environmentConfiguration"]["secretsManagement"] = "secrets-manager"
                    if "AWS SecretsManager code references" not in result["environmentConfiguration"]["evidence"]:
                        result["environmentConfiguration"]["evidence"].append("AWS SecretsManager code references")
            except OSError:
                pass

    return result


def analyze_documentation(target, files_info, code_struct):
    result = {
        "readme": {
            "exists": False,
            "sizeBytes": 0,
            "sections": [],
            "hasGettingStarted": False,
            "hasContributing": False,
            "hasLicense": False
        },
        "architectureDocs": {
            "hasArchitecturemd": False,
            "hasAdrDirectory": False,
            "adrCount": 0,
            "hasSystemDiagrams": False
        },
        "apiDocs": {
            "hasOpenapi": False,
            "hasSwagger": False,
            "hasJsdoc": False,
            "hasPydoc": False
        },
        "completionScore": 0
    }

    readme_file = None
    for name in ["README.md", "README.adoc", "README.rst", "README.txt", "README"]:
        readme_file = next((f for f in files_info if f["path"].lower() == name.lower()), None)
        if readme_file:
            break

    readme_score = 0
    if readme_file:
        result["readme"]["exists"] = True
        result["readme"]["sizeBytes"] = readme_file["size"]
        readme_score += 10
        if readme_file["size"] >= 2048:
            readme_score += 10

        try:
            txt = (target / readme_file["path"]).read_text(encoding="utf-8", errors="replace")
            for line in txt.splitlines():
                m = re.match(r"^(#+)\s+(.+)$", line)
                if m:
                    result["readme"]["sections"].append({"heading": m.group(2).strip(), "level": len(m.group(1))})
        except OSError:
            pass
        
        headings_text = " ".join(s["heading"].lower() for s in result["readme"]["sections"])
        if re.search(r"getting[- ]started", headings_text) or "install" in headings_text:
            result["readme"]["hasGettingStarted"] = True
            readme_score += 10
        if re.search(r"contribut", headings_text) or "license" in headings_text:
            result["readme"]["hasContributing"] = True
            result["readme"]["hasLicense"] = "license" in headings_text
            readme_score += 10

    arch_score = 0
    arch_file = next((f for f in files_info if f["name"].lower() == "architecture.md"), None)
    if arch_file:
        result["architectureDocs"]["hasArchitecturemd"] = True
        arch_score += 15

    adr_dirs = ["docs/adr", "adr", ".github/adr"]
    has_adr_dir = any(any(f["path"].startswith(d + "/") for d in adr_dirs) for f in files_info)
    adr_files = [f for f in files_info if f["name"].startswith("ADR_") or "/adr/" in f["path"]]
    if has_adr_dir or adr_files:
        result["architectureDocs"]["hasAdrDirectory"] = True
        result["architectureDocs"]["adrCount"] = len(adr_files)
        arch_score += 15

    diag_dirs = ["docs/diagrams", "docs/system-diagrams", "ai/analysis/diagrams"]
    if any(any(f["path"].startswith(d + "/") for d in diag_dirs) for f in files_info):
        result["architectureDocs"]["hasSystemDiagrams"] = True

    api_score = 0
    if any(f["name"].lower() in ("openapi.yaml", "openapi.json", "openapi.yml") for f in files_info):
        result["apiDocs"]["hasOpenapi"] = True
        api_score += 15
    elif any(f["name"].lower() in ("swagger.json", "swagger.yaml", "swagger.yml") for f in files_info):
        result["apiDocs"]["hasSwagger"] = True
        api_score += 15

    if code_struct["docstringPercent"] >= 20.0:
        result["apiDocs"]["hasJsdoc"] = any(f["ext"] in ("js", "ts") for f in files_info)
        result["apiDocs"]["hasPydoc"] = any(f["ext"] == "py" for f in files_info)
        api_score += 15

    result["completionScore"] = readme_score + arch_score + api_score
    return result


def analyze_testing(target, files_info):
    result = {
        "testFileCount": 0,
        "testDirectories": [],
        "frameworks": [],
        "hasCI": False,
        "hasCoverage": False,
        "coverageThreshold": None,
        "e2eTests": False,
        "integrationTests": False,
        "unitTests": False
    }

    test_dirs = ["test", "tests", "spec", "__tests__", "integration-tests", "e2e", "cypress", "playwright"]
    for d in test_dirs:
        if (target / d).is_dir():
            result["testDirectories"].append(d + "/")
            if d in ("e2e", "cypress", "playwright"):
                result["e2eTests"] = True
            if d == "integration-tests":
                result["integrationTests"] = True

    for file in files_info:
        is_test = "/test" in file["path"] or "/spec" in file["path"] or "__tests__" in file["path"] or "test" in file["name"] or "spec" in file["name"]
        if is_test:
            result["testFileCount"] += 1

        if file["name"] == "package.json":
            try:
                raw = (target / file["path"]).read_text(encoding="utf-8", errors="replace")
                pkg = json.loads(raw)
                all_deps = list((pkg.get("dependencies") or {}).keys()) + list((pkg.get("devDependencies") or {}).keys())
                for f in ("jest", "vitest", "mocha", "playwright", "cypress"):
                    if any(f in d for d in all_deps):
                        result["frameworks"].append(f)
            except (ValueError, OSError):
                pass
        elif file["name"] == "pyproject.toml":
            try:
                raw = (target / file["path"]).read_text(encoding="utf-8", errors="replace")
                if "pytest" in raw:
                    result["frameworks"].append("pytest")
            except OSError:
                pass
        elif file["name"] == "pom.xml":
            try:
                raw = (target / file["path"]).read_text(encoding="utf-8", errors="replace")
                if "junit" in raw:
                    result["frameworks"].append("junit")
            except OSError:
                pass

    result["frameworks"] = sorted(list(set(result["frameworks"])))
    result["hasCI"] = any(f["path"].startswith(".github/workflows/") or f["path"] == ".gitlab-ci.yml" for f in files_info)
    result["hasCoverage"] = any(f["path"].startswith("coverage/") or f["path"].startswith(".nyc_output/") or f["name"] == "coverage.xml" for f in files_info)

    jest_conf = next((f for f in files_info if "jest.config" in f["name"]), None)
    if jest_conf:
        try:
            txt = (target / jest_conf["path"]).read_text(encoding="utf-8", errors="replace")
            m = re.search(r"thresholds?.*?(\d+)", txt, re.I) or re.search(r"branches.*?(\d+)", txt, re.I)
            if m:
                result["coverageThreshold"] = int(m.group(1))
        except OSError:
            pass

    result["unitTests"] = result["testFileCount"] > 0 and not result["e2eTests"]

    return result


# ---------------------------------------------------- Main Entry
def indepth(target, flags):
    start_time = datetime.now()
    warnings = []
    recommendations = []

    gitignore_rules = parse_gitignore(target)
    files_info = []
    
    walk_repository(target, target, gitignore_rules, files_info, warnings)

    dependencies = detect_dependencies(target, files_info)
    code_struct = analyze_code_structure_and_docs(target, files_info)
    arch_result = infer_architecture(target, files_info, code_struct)
    git_history = analyze_git_history(target, warnings)
    configuration = analyze_configuration(target, files_info)
    documentation = analyze_documentation(target, files_info, code_struct)
    testing = analyze_testing(target, files_info)

    scalability = {
        "hasDocker": any(f["name"] == "Dockerfile" for f in files_info),
        "hasKubernetes": any(f["path"].startswith("k8s/") or f["path"].startswith("kubernetes/") for f in files_info),
        "hasLoadBalancing": arch_result["scalabilityIndicators"]["hasLoadBalancing"],
        "hasWorkerPool": any("worker" in e.lower() or "thread" in e.lower() for e in arch_result["scalabilityIndicators"]["evidence"]),
        "hasCaching": arch_result["scalabilityIndicators"]["hasCaching"],
        "hasAsyncPatterns": arch_result["scalabilityIndicators"]["hasAsync"],
        "databaseConnectionPooling": "DB Pool settings" in arch_result["scalabilityIndicators"]["evidence"],
        "evidence": arch_result["scalabilityIndicators"]["evidence"]
    }

    build_system = any(f["name"] in ("package.json", "pom.xml", "pyproject.toml", "Cargo.toml", "go.mod") for f in files_info)
    has_git = (target / ".git").is_dir()
    
    if not build_system:
        warnings.append({"category": "build", "message": "Build system marker files are completely absent (e.g., no package.json, pyproject.toml).", "severity": "critical"})
    if not has_git:
        warnings.append({"category": "version_control", "message": "Version control (.git) is completely absent.", "severity": "critical"})
    if testing["testFileCount"] == 0:
        warnings.append({"category": "testing", "message": "Test directories and files are missing entirely.", "severity": "high"})
        recommendations.append({"area": "Testing", "suggestion": "Introduce unit and integration testing suite", "rationale": "Adding tests prevents regression and maps repository reliability."})
    
    has_gitignore = any(f["name"] == ".gitignore" for f in files_info)
    if not has_gitignore:
        warnings.append({"category": "gitignore", "message": ".gitignore is missing or is empty.", "severity": "high"})
    
    env_example = any(f["name"] == ".env.example" for f in files_info)
    uses_env = any(f["name"] == ".env" for f in files_info)
    if not env_example and uses_env:
        warnings.append({"category": "config", "message": ".env.example is missing but code utilizes .env settings.", "severity": "medium"})
        recommendations.append({"area": "Configuration", "suggestion": "Create a .env.example file", "rationale": "Helps contributors configure local environments without leaking real secrets."})
    
    has_license = any(f["name"] in ("LICENSE", "LICENSE.md", "LICENSE.txt", "LICENCE", "COPYING") for f in files_info)
    if not has_license:
        warnings.append({"category": "license", "message": "No LICENSE or COPYING file is found.", "severity": "medium"})

    if not documentation["architectureDocs"]["hasArchitecturemd"]:
        recommendations.append({"area": "Documentation", "suggestion": "Create an ARCHITECTURE.md outlining system components", "rationale": "Provides onboarding agents and human developers an entry point structure map."})
    if git_history and any("shallow clone" in w["message"] for w in warnings):
        recommendations.append({"area": "Git", "suggestion": "Perform a full clone to enable complete commit history analysis", "rationale": "Enables deeper analysis of code ownership, change patterns, and key files."})
    
    has_linter = any(f["name"] in (".eslintrc", ".prettierrc", "ruff.toml") or ".eslintrc" in f["name"] or ".prettierrc" in f["name"] for f in files_info)
    if not has_linter:
        recommendations.append({"area": "Configuration", "suggestion": "Add standard linting and formatting configuration to maintain code quality", "rationale": "Prevents code drift and style anomalies across contributions."})

    execution_time_ms = round((datetime.now() - start_time).total_seconds() * 1000)

    return {
        "_comment": "Generated by ai-fication-kit `indepth` — deterministic analysis with heuristic inference. Human verification recommended for architecture inference.",
        "kitVersion": KIT_VERSION,
        "generated": datetime.now(timezone.utc).isoformat(),
        "analysisLevel": "indepth",
        "executionTime": execution_time_ms,
        "dependencies": dependencies,
        "codeStructure": {
            "codeMetrics": code_struct["codeMetrics"],
            "directoryStructure": code_struct["directoryStructure"],
            "moduleStructure": code_struct["moduleStructure"],
            "codeDistribution": code_struct["codeDistribution"]
        },
        "architecture": arch_result["inferredArchitecture"],
        "communicationPatterns": arch_result["communicationPatterns"],
        "gitHistory": git_history,
        "configuration": configuration["configurationFiles"],
        "environmentConfiguration": configuration["environmentConfiguration"],
        "documentation": {
            "readme": documentation["readme"],
            "architectureDocs": documentation["architectureDocs"],
            "apiDocs": documentation["apiDocs"],
            "completionScore": documentation["completionScore"]
        },
        "testing": testing,
        "scalability": scalability,
        "warnings": warnings,
        "recommendations": recommendations
    }


def print_indepth_report(r):
    L = lambda s: f"{s:<20}"
    heading = lambda s: print(f"\n=== {s} ===")

    heading("INDEPTH ANALYSIS SUMMARY")
    print(f"  {L('Execution time')}{r['executionTime']}ms")
    print(f"  {L('Files & LOC')}{r['codeStructure']['codeMetrics']['fileCount']} files, {r['codeStructure']['codeMetrics']['linesOfCode']} lines of code")
    
    heading("DEPENDENCY ANALYSIS")
    print(f"  {L('Total Dependencies')}{r['dependencies']['total']}")
    print(f"  {L('Direct / Transitive')}{r['dependencies']['direct']} / {r['dependencies']['transitive']}")
    print(f"  {L('Production / Dev')}{r['dependencies']['byCategory']['production']} / {r['dependencies']['byCategory']['development']}")

    heading("ARCHITECTURE & SCALABILITY")
    print(f"  {L('Inferred Pattern')}{r['architecture']['pattern']} (Confidence: {round(r['architecture']['confidence'] * 100)}%)")
    if r['architecture']['layers']:
        print(f"  {L('Layers Detected')}{', '.join(l['name'] for l in r['architecture']['layers'])}")
    print(f"  {L('Http Server')}{'Yes' if r['communicationPatterns']['httpServer'] else 'No'}")
    print(f"  {L('Database Access')}{'Yes' if r['communicationPatterns']['databaseAccess'] else 'No'}")
    print(f"  {L('Caching')}{'Yes' if r['scalability']['hasCaching'] else 'No'}")

    if r['gitHistory']:
        heading("GIT HISTORY")
        print(f"  {L('Commit Count')}{r['gitHistory']['commitCount']}")
        print(f"  {L('Contributors')}{r['gitHistory']['contributorCount']}")
        print(f"  {L('Last Commit')}{r['gitHistory']['lastCommitDate'] or 'N/A'}")

    heading("DOCUMENTATION")
    print(f"  {L('Completion Score')}{r['documentation']['completionScore']}/100")
    print(f"  {L('README Exists')}{'Yes' if r['documentation']['readme']['exists'] else 'No'}")
    print(f"  {L('Architecture Map')}{'Yes' if r['documentation']['architectureDocs']['hasArchitecturemd'] else 'No'}")
    print(f"  {L('ADR Log')}{'Yes' if r['documentation']['architectureDocs']['hasAdrDirectory'] else 'No'}")

    if r['warnings']:
        heading("WARNINGS")
        for w in r['warnings']:
            sev = w['severity'].upper()
            print(f"  [{sev}] {w['message']}")

    if r['recommendations']:
        heading("RECOMMENDATIONS")
        for rec in r['recommendations']:
            print(f"  • [{rec['area']}] {rec['suggestion']}")
            print(f"    Rationale: {rec['rationale']}")
    print()
