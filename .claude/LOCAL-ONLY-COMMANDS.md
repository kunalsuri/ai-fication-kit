<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Local-only commands — not distributed to target repos

Some slash commands in `.claude/commands/` are **kit-maintainer tools**: useful
for developing *this* repository, but deliberately **not** shipped to the repos
the kit installs into. This note lives one level up from `commands/` on purpose,
so it is a plain policy doc rather than an invocable command.

## The mechanism (no special machinery)

The installer only ever stamps files that exist under `templates/`. A command
here is distributed **iff** it has a twin at
`templates/claude/commands/<name>.md` (and its per-tool siblings under
`templates/agents/workflows/`, `templates/github/prompts/`,
`templates/cursor/rules/`). A command with **no** `templates/` twin is
local-only by construction — it is never stamped, never listed in
`ai/install-manifest.json`, and never checksummed in `CHECKSUMS.txt`.

- **To keep a command local:** create it only in `.claude/commands/` (and,
  optionally, `.agents/workflows/` for local Antigravity use). Do not add it to
  `templates/`.
- **To promote it later:** copy the file into `templates/claude/commands/` (plus
  the per-tool siblings), refresh `CHECKSUMS.txt` via `make-checksums.sh`, and
  remove its row from the table below.

## Currently local-only

| Command | Also in | Why it's local-only | Distributed twin? |
|---|---|---|---|
| `/implement-spec` | `.agents/workflows/` | Kit-repo dogfood of the spec-faithful implementation loop; promotion into `templates/` is a deferred product decision (see `docs/IMPLEMENT-SPEC.md`) | none — intentional |
| `/check-docs` | — | Maintainer doc-drift audit for *this kit's* README/docs; target repos guard their own docs with `verify`/`drift`/`/check-drift` | none — intentional |

Keep this table in sync when you add or promote a local-only command. The
`/check-docs` command reads it to know which entries to exclude from the
distributed-roster counts.
