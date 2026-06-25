<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# FAQ & troubleshooting

## What is the first-run wizard, and can I skip it?

The first time you run `shazam` on a repo (interactively), a short wizard runs before
anything is written. It exists to keep you safe and to give `/cold-start` real context:

1. **Maturity** — your general experience and how well you know *this* codebase. A
   junior / "new here" answer makes `/cold-start` explain more and stay more conservative
   on Stability.
2. **Branch safety** — it reads `.git/HEAD` (a file read, never a git command) and, if
   you're on `main`/`master`, warns you about disturbing production and asks you to
   confirm. It will *not* run `git` for you — it points you to `git checkout -b …`.
3. **Stack** — it shows what `orient` detected and lets you confirm, correct, or declare
   a frontend/backend split (e.g. React + Java).

Answers are saved under a `humanContext` block in `ai/repo-profile.json` (clearly marked
as human-supplied, separate from `orient`'s deterministic facts). The wizard **self-skips**
when there's no interactive terminal or when you pass `--yes` — so `npx … --yes` and CI
behave exactly as before. `orient` itself is never interactive.

## Which stacks does `orient` detect natively?

Out of the box, by marker file at the repo root:

| Stack | Detected from | Default build / test |
|---|---|---|
| Java | `pom.xml` (Maven), `build.gradle(.kts)` (Gradle) | `mvn` / `gradle` commands |
| JS/TS | `package.json` (+ `tsconfig.json`, pnpm/yarn/bun lockfiles) | package-manager `install` / `test` — the `build` step is only added if `package.json` actually defines a `build` script |
| Python | `pyproject.toml`, `requirements.txt` (+ Poetry/Pipenv) | `pip`/`poetry`/`pipenv` + `pytest` |
| C#/.NET | any `*.csproj` / `*.sln` / `*.fsproj` (no fixed filename) | `dotnet build` / `dotnet test` |
| C/C++ | `CMakeLists.txt`; or a bare `Makefile` as fallback | `cmake` / `ctest`, or `make` / `make test` |
| Go, Rust, Ruby, PHP | `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json` | the ecosystem's standard commands |

Every value is a deterministic guess tagged for your audit — if anything is wrong,
override it with `--build` / `--test` (see below). Multiple stacks (e.g. a polyglot
repo) are detected together and the commands are chained for you to review.

## `orient` detected the wrong stack / commands

`orient` is deliberately dumb: it reads marker files (`package.json`, `pom.xml`, …)
and applies defaults. When it guesses wrong, override it — the flags win over
detection:

```bash
node install.mjs shazam /path/to/repo --build "make all" --test "make check" --name "MyApp"
```

Already installed? Edit `ai/repo-profile.json` and the commands in `CLAUDE.md` /
`AGENTS.md` by hand — they are plain text, and your audit is supposed to confirm
them anyway.

## My repo is a monorepo — detection looks incomplete

Known limitation: `orient` only inspects **the root** of the target for marker
files. A workspace like `packages/*` with per-package manifests detects as a single
npm project, and nested build systems (say, a `backend/pom.xml` next to a
`frontend/package.json`) are invisible unless the markers sit at the root.

Workarounds, in order of preference:
1. Pass explicit `--build` / `--test` commands that drive the whole workspace.
2. Treat sub-projects in the audit: the MODULE_MAP rows are where per-package
   responsibility and stability live — `/cold-start` explores subdirectories even
   though `orient` does not.
3. For truly independent sub-repos, install the kit into each one separately.

## `/cold-start` wrote something wrong

Expected — that is what the tags are for. Everything it writes is `[inferred]`, and
your audit is the filter. Fix the row (or delete it), and only flip to `[verified]`
what you confirmed yourself. If it wrote *outside* `ai/` (it is instructed not to
touch source), discard those changes via git and re-run; that instruction failing is
worth an issue report.

## Can I re-run `/cold-start` later?

Yes. It is required to leave `[verified]` rows untouched and only fill rows that are
still `?` or contain placeholder text. After significant code movement, prefer
running `/post-cold-start-verification` first — it tells you which rows went stale.

## How do I update the kit in a repo where it's already installed?

Re-run `install` from a newer kit checkout. Without `--force` it skips every file
that already exists (your edited maps are safe); with `--force` it overwrites —
so don't `--force` anything a human has audited. The manifest merges across
installs, so `uninstall` still removes everything cleanly.

<a id="cursor-copilot-codex"></a>
## What do Cursor / Copilot / Codex users actually get?

The knowledge layer (`ai/`) and the rules (`AGENTS.md`) — those are tool-agnostic.
The slash commands, subagents, and the `add-feature` skill are Claude Code-specific.
With other tools, run the workflow manually: paste the contents of `.claude/commands/cold-start.md` (or any other command file) into the tool as a prompt. 

> [!TIP]
> **Important tip for manual pasting:** The command files under `.claude/commands/` contain metadata headers called YAML frontmatter (lines starting and ending with `---`, such as `description: ...`). Before pasting these prompts into Cursor, Copilot, or Codex, **delete the `---` delimiters and everything between them**. Start pasting from the actual instructions (e.g., "Run the cold-start bootstrap..."). This prevents the LLM from getting confused by the configuration headers.

The provenance discipline works the same; only the automation is missing.

## Is the `ai/` folder only for AI agents, or can people use it to onboard?

Both — and the human side is a first-class use case. After `/cold-start` populates
`ai/` and you verify it, that folder is a **human-approved knowledge-base**: a single
source of truth about the repo. A new teammate can onboard almost instantly by reading
`ai/guide/MODULE_MAP.md` (every module, its responsibility, and whether it's
`frozen` / `stable` / `ours`), then `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, and
`FEATURE_MAP.md`. They can also ask their AI agent questions against the knowledge-base
and trust the answers, because a human signed every `[verified]` claim. Keep it honest
over time with the `verify` command so onboarding stays accurate as the code evolves.

## Does the installer ever touch my source code?

No. It writes `CLAUDE.md`, `AGENTS.md`, `ai/**`, and `.claude/**` — nothing else —
and records every path in `ai/install-manifest.json`. `--dry-run` shows the exact
plan; `uninstall` deletes exactly the recorded files. See `SECURITY.md` for the full
guarantees.

## The agent flipped a tag to `[verified]` itself

That's a process violation worth treating as a bug: revert the flip, remind the
agent of the rule (it is stated in `CLAUDE.md`, `AGENTS.md`, and `ai/INDEX.md`), and
please open an issue describing which agent/model did it — prompt hardening against
real cases is exactly the kind of contribution the project wants.
