<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# templates/ — the installable kit

Everything in this folder is stamped into a target repo by `install.mjs` / `install.py`.

Rules:
- Files ending `.tmpl` have `{{PLACEHOLDERS}}` substituted and lose the `.tmpl` suffix.
- All other files are copied verbatim.
- `templates/claude/**` installs to `.claude/**` (kept visible here so the kit's own
  tree is browsable).
- This README is documentation for kit developers and is **not** installed.

Placeholders (filled by the `orient` step; confirm them in your audit):

| Placeholder | Source |
|---|---|
| `{{PROJECT_NAME}}` | `--name` flag, else target folder name |
| `{{DESCRIPTION}}` | `--description` flag, else first prose line of README |
| `{{LANGUAGES}}` | detected from marker files |
| `{{BUILD_CMD}}` / `{{TEST_CMD}}` | flags, else detected defaults |
| `{{UPSTREAM}}` | `--upstream` flag, else git remote named `upstream` |
| `{{FORK_LINE}}` / `{{FORK_RULE}}` | computed from fork status |
| `{{TEST_DIRS}}` | detected test directories |
| `{{DATE}}` / `{{KIT_VERSION}}` | install time / kit version |
