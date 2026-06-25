<!-- Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved. -->
# Security

The installers in this kit are deliberately boring:

- **No dependencies.** Node stdlib / Python stdlib only — there is nothing else to trust.
- **No network access.** Nothing is downloaded, fetched, or phoned home.
- **No code execution.** The kit copies and stamps text files; it never runs your code
  or anyone else's.
- **No writes outside the target.** Only the directory you pass in is touched, and
  `--dry-run` shows the full plan first.
- **Clean removal.** `uninstall` deletes exactly the files recorded in
  `ai/install-manifest.json`.

You are encouraged to read both installers in full before running them.
Each is a thin CLI (`install.mjs`, `install.py`) over four small single-purpose
modules in `lib/` (`util`, `orient`, `installer`, `verify`) — every file is
commented and short enough to audit in one sitting.

To report a vulnerability, open a private security advisory on GitHub:
**Security tab → "Report a vulnerability"**, or go directly to
<https://github.com/kunalsuri/ai-fication-kit/security/advisories/new>.
Please do not open public issues for security reports.
