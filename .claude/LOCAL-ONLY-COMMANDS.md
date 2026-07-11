<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Local-only skills & commands — not distributed to target repos

Some skills in `.claude/skills/` (and their `.agents/` siblings) are
**kit-maintainer tools**: useful for developing *this* repository, but
deliberately **not** shipped to the repos the kit installs into. This note
lives at the `.claude/` root (not under `skills/`) on purpose, so it is a
plain policy doc rather than an invocable skill.

## The mechanism (no special machinery)

The installer only ever stamps files that exist under `templates/`. A workflow
here is distributed **iff** it has a twin under `templates/` — for the Claude
surface, `templates/claude/skills/<name>/SKILL.md` (plus its per-tool siblings
under `templates/agents/workflows/`, `templates/github/prompts/`,
`templates/cursor/rules/`), or a tool-agnostic
`templates/agents/skills/<name>/SKILL.md`. An item with **no** `templates/`
twin is local-only by construction — it is never stamped, never listed in
`ai/install-manifest.json`, and never checksummed in `CHECKSUMS.txt`.

- **To keep an item local:** create it only under `.claude/skills/` (and,
  optionally, `.agents/workflows/` or `.agents/skills/` for local Antigravity
  use). Do not add it to `templates/`.
- **To promote it later:** copy the file(s) into the matching `templates/`
  path (plus the per-tool siblings), refresh `CHECKSUMS.txt` via
  `make-checksums.sh`, and remove its row from the table below.

## Currently local-only

| Skill | Also in | Why it's local-only | Distributed twin? |
|---|---|---|---|
| `/implement-spec` (`.claude/skills/implement-spec/`) | `.agents/workflows/` | Kit-repo dogfood of the spec-faithful implementation loop; promotion into `templates/` is a deferred product decision (see `docs/IMPLEMENT-SPEC.md`) | none — intentional |
| `/check-docs` (`.claude/skills/check-docs/`) | — | Maintainer doc-drift audit for *this kit's* README/docs; target repos guard their own docs with `verify`/`drift`/`/check-drift` | none — intentional |
| `deep-test` | `.agents/skills/` only — no `.claude/skills/` mirror either | Wraps the kit's own release-health gate (`npm run deep-test`); not a target-repo concern | none — intentional |

Keep this table in sync when you add or promote a local-only skill.
The `/check-docs` skill reads it to know which entries to exclude from the
distributed-roster counts.
