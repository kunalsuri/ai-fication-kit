<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Security

The installer in this kit is deliberately boring:

- **No dependencies.** Node stdlib only — there is nothing else to trust.
- **No network access.** Nothing is downloaded, fetched, or phoned home.
- **No code execution.** The kit copies and stamps text files; it never runs your code
  or anyone else's.
- **No writes outside the target.** Only the directory you pass in is touched, and
  `--dry-run` shows the full plan first.
- **Clean removal.** `uninstall` deletes exactly the files recorded in
  `ai/install-manifest.json`.

**Documented exceptions** (every other command/flag keeps the guarantees above exactly):
- `drift --git`, `audit --git`, and `indepth` shell out to a **local, read-only**
  `git` (commit/diff/log inspection only — never a write, never a network fetch).
- `demo` (no target argument) writes a copy of `examples/legacy-calculator/` to a
  fresh directory under the OS temp dir (`os.tmpdir()`), never to your project or
  the kit's own repo, so you can see the whole pipeline run without pointing it at
  real code.

You are encouraged to read the installer in full before running it.
It is a thin CLI (`install.mjs`) over small single-purpose
modules in `lib/` (`util`, `orient`, `installer`, `intake`, `verify`, `drift`,
`maturity`, `doctor`, `status`, `audit`, `demo`) — every file is commented and
short enough to audit in one sitting.

To report a vulnerability, open a private security advisory on GitHub:
**Security tab → "Report a vulnerability"**, or go directly to
<https://github.com/kunalsuri/ai-fication-kit/security/advisories/new>.
Please do not open public issues for security reports.
