<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Adversarial audit — concrete defects (2026-07-03) `[inferred]`

> Produced by an adversarial code audit of the kit itself. Every finding is
> `[inferred]` until a human confirms it. Findings 1–4 were **reproduced live**
> (repro steps inline); the rest were verified by reading the current code.
> Format: `path:line — issue — failure scenario — suggested fix`.

## P0 — data loss / guarantee violations (reproduced)

### 1. `lib/installer.mjs:144-161` + `lib/installer.mjs:200-205` + `install.mjs:283-284` — stale Process-2 state bypasses the child-lock and overwrites human-edited, `[verified]` files without `--force`
- **Issue.** `install` (the bare command) reuses the on-disk `ai/repo-profile.json`. That profile permanently records the *pre-install* snapshot: `maturity.process === 2` and `existingAIConfig.claudeMd.hasKitFooter === false`. On every later `node install.mjs install <repo>`, installer.mjs:144 re-enters the Process-2 branch, re-backs-up CLAUDE.md/AGENTS.md, and installer.mjs:203 assigns action `"overwrite-backed-up"`, which **skips `classifyAction` entirely** — no `keep`, no `locked`, no `--force` required.
- **Failure scenario (reproduced).** `shazam --yes` on a repo with a user CLAUDE.md (Process 2) → human edits the stamped CLAUDE.md, adds a `[verified]` line → plain `install --yes` (no `--force`) → the `[verified]` content is silently replaced by the pristine template. This directly contradicts install.mjs:47 ("It NEVER overwrites a file you have edited"), install.mjs:51 ("files carrying a human `[verified]` tag are never overwritten, even with --force"), README.md:500 and README.md:518.
- **Fix.** Decide Process 2 from the *current* file state, not the recorded profile: in `install()`, re-check `hasKitFooter` on disk (the `KIT_FOOTER_MARKER` test is 3 lines) before entering the backup branch; or scrub `maturity`/`existingAIConfig` from the profile the installer persists at installer.mjs:288. Additionally route backed-up files through `classifyAction` so `[verified]` still locks.

### 2. `lib/util.mjs:25-31` (`backupName`) + `lib/installer.mjs:153`, `lib/installer.mjs:273` — second-granularity backup names + unchecked `fs.copyFile` silently destroy an earlier backup
- **Issue.** Backup names are unique only per second, and every backup writer (`copyFile` at installer.mjs:153 and 273, `writeFile` at audit.mjs:194) overwrites an existing file of the same name without checking.
- **Failure scenario (reproduced).** Two installs of the same target within one clock second (scripted onboarding, CI, test harnesses, a retry loop): the second run's backup **replaces** the first — in the repro, the user's original pre-kit `CLAUDE.md` was permanently lost; the only surviving "backup" was the kit's own template. README.md:386 claims the timestamped name "never conflicts".
- **Fix.** In `backupName` callers, probe with `fs.access`/`copyFile(..., COPYFILE_EXCL)` and append a `_2`, `_3` suffix (or millisecond precision + PID) on collision.

### 3. `lib/indepth.mjs:488` — unescaped module name interpolated into `new RegExp()` crashes `indepth`, `orient --indepth`, and `shazam` (indepth level)
- **Issue.** `new RegExp(`\\b${other}\\b`)` where `other` is a top-level directory name. Regex metacharacters are not escaped.
- **Failure scenario (reproduced).** A repo containing a directory named `c++/` (or `foo(bar)/`, `a+b/`) plus one other module with any `import`/`require` line → `SyntaxError: Invalid regular expression: /\bc++\b/: Nothing to repeat` — the whole analysis aborts with a stack trace.
- **Fix.** Escape the name (`other.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`) or drop the word-boundary regex in favor of the existing string `includes` checks.

### 4. `lib/status.mjs:57-64` — `TRUSTED` verdict for a never-cold-started repo (0 mapped rows), directly contradicting `doctor` on the same tree
- **Issue.** The verdict logic only demotes on `inferred > 0 || unknown > 0`; a scaffolded MODULE_MAP parses to **zero rows**, so all counters are 0 and the verdict falls through to `TRUSTED`.
- **Failure scenario (reproduced).** Fresh `shazam` on a repo whose code lives in root files (e.g. the bundled `examples/legacy-calculator` shape): `status` prints **Verdict: TRUSTED** (green badge) while `doctor` on the same tree says "step 2 of 5 — MODULE_MAP.md is still the empty scaffolded template". A CI badge consumer sees green on an unmapped repo.
- **Fix.** Add `rows.verified + rows.inferred + rows.unknown === 0` (or `mapText.includes(MODULE_MAP_PLACEHOLDER)`) to the `NEEDS AUDIT` condition.

## P1 — broken instructions shipped into every target repo

### 5. `templates/github/workflows/ai-check.yml.tmpl:22-28` — stamped CI installs `ai-fication-kit` from npm, but the package is not published
- **Issue.** The workflow runs `npm install -g ai-fication-kit` then invokes the `ai-fication-kit` binary. `npm view ai-fication-kit` returns **E404** (not in the registry) as of 2026-07-03.
- **Failure scenario.** Every target repo that commits the stamped `.github/workflows/ai-check.yml` gets a permanently red "AI Knowledge-Base Check" on every push/PR. `demo.mjs:30-31`'s "if you installed this kit via npm" message makes the same false assumption.
- **Fix.** Publish the package, or stamp a workflow that installs from the GitHub repo (`npm install -g github:kunalsuri/ai-fication-kit#v{{KIT_VERSION}}`) until then.

### 6. 12+ stamped agent docs tell the agent to run `node install.mjs …` inside a target repo where `install.mjs` does not exist
- **Locations.** `templates/CLAUDE.md.tmpl:23`, `templates/AGENTS.md.tmpl:25`, `templates/claude/commands/check-drift.md:9-11`, `templates/claude/commands/post-cold-start-verification.md:12`, `templates/github/prompts/check-drift.prompt.md:10-12`, `templates/cursor/rules/check-drift.mdc:10-12`, `templates/agents/workflows/check-drift.md:6-7`, and siblings.
- **Issue.** The kit is *not* stamped into targets (only `templates/`, `.claude/`, `ai/` are). In any target repo, `node install.mjs verify . --strict` fails with `Cannot find module`. Note the mechanical `verify` can never catch this: the claim contains spaces, so `extractClaims` (lib/verify.mjs:32) skips it — exactly the mechanical-vs-semantic gap.
- **Failure scenario.** An agent following the stamped hard rule "Verify claims: run `node install.mjs verify . --strict`" errors out on every task, or worse, silently skips verification.
- **Fix.** Stamp the real invocation (`npx ai-fication-kit verify . --strict` once published, or a `{{KIT_INVOCATION}}` placeholder resolved at install time to the absolute kit path).

## P2 — cross-module consistency rot

### 7. `lib/audit.mjs:104-116`, `lib/audit.mjs:167` — the guided audit flips rows to `[verified]` but never updates the `Last verified: … @ commit <sha>` anchor that `drift --git` and the whole re-anchoring workflow depend on
- **Issue.** `applyEdits` rewrites only table rows. docs/AUDIT-GUIDE.md:93 defines updating the anchor as part of the audit; the automated audit skips it.
- **Failure scenario.** Human runs `audit`, confirms every row today → `drift --git` still diffs from the *old* anchor sha → freshly audited rows whose code changed *before* the audit are flagged `stale` → `doctor` drops back to step 4 → `--strict` CI fails right after a completed audit.
- **Fix.** After a successful audit with `--git`, rewrite the `Last verified:` line to today's date + `HEAD` sha (git is already available in that mode); without `--git`, print an explicit reminder.

### 8. `lib/status.mjs:24` vs `docs/AUDIT-GUIDE.md:57,113-115`, `docs/GETTING-STARTED.md:101` — `[verified]` date-format mismatch silently disables the 90-day staleness gate
- **Issue.** `newestAuditDate` only parses `DD/MM/YYYY` (the `audit` command's format, audit.mjs:21-24). Both docs instruct humans to write ISO `[verified] (2026-06-12)`; the worked examples in AUDIT-GUIDE and `examples/legacy-calculator/README.md:80-81` all use ISO.
- **Failure scenario.** A team audits by hand per the guide → `status` shows "Last audit: unknown" forever and `daysSinceAudit > STALE_AUDIT_DAYS` (status.mjs:60) can never fire → a 2-year-old fully-`[verified]` map still reads `TRUSTED`.
- **Fix.** Accept both formats in `newestAuditDate` (add a `(\d{4})-(\d{2})-(\d{2})` alternative), and align the docs on one canonical format.

### 9. `lib/doctor.mjs:33-43` — step-2 diagnosis says "The kit is installed" when only `orient` has run
- **Issue.** Step 1 keys on `ai/repo-profile.json`, which bare `orient` writes without installing anything. Step 2 then claims the kit is installed and prescribes `/cold-start` — but `.claude/commands/cold-start.md` and the MODULE_MAP scaffold don't exist yet.
- **Failure scenario.** `node install.mjs orient <repo>` → `doctor` → user opens their agent and `/cold-start` is an unknown command; the actually-needed step (`install`/`shazam`) is never suggested.
- **Fix.** Distinguish the states: if `ai/install-manifest.json` is absent, diagnose "profiled but not installed" and prescribe `install`/`shazam`.

### 10. `install.mjs:43-45` + `docs/CLI-REFERENCE.md:18-19` — "Two exceptions run LOCAL, READ-ONLY git" is stale; `audit --git` (lib/audit.mjs:78) is a third
- **Issue.** The count predates the `audit` command; the same files describe `audit --git` themselves (install.mjs:33-34, CLI-REFERENCE.md:384,432), so both documents are internally inconsistent.
- Also stale in the same block: install.mjs:46 "It does NOT write anywhere outside the target folder you pass in" — `--github-summary` appends to `$GITHUB_STEP_SUMMARY` (lib/util.mjs:95), and `demo` writes an entire tree under `os.tmpdir()` (demo.mjs:34-35).
- **Fix.** Update both headers: three git exceptions; carve out the summary file and `demo` explicitly.

### 11. `lib/installer.mjs:200-202` — `ai/START-HERE.html` can never be upgraded, and its recorded provenance hash is wrong
- **Issue.** Any existing progress page short-circuits to `"up-to-date"` (even under `--force`/`--force-verified`), so a redesigned kit template never reaches installed repos — contradicting install.mjs:48 "untouched kit files are refreshed". The hash recorded at installer.mjs:206→296 is `sha256(template)`, which never matches disk once `refreshProgressPage` (lib/progress.mjs:44) rewrites the data block — a permanently false entry in `fileHashes`.
- **Failure scenario.** Kit v0.3 ships a fixed dashboard (e.g. an XSS or rendering fix); every existing install keeps the old shell forever with no way to refresh short of deleting the file by hand.
- **Fix.** Compare disk-vs-template *outside* the `progress-data` block (strip `DATA_BLOCK_RE` from both before hashing); refresh the shell when the stripped template changed, then re-inject live data.

## P3 — robustness / platform / minor

### 12. `test/release-check.mjs:148,154` — crashes with a TypeError when `git` is not installed, despite the header's "Skipped (stated, never silent)" promise (line 23)
- `spawnSync` on ENOENT returns `stdout: null`; `git("describe", …).stdout.trim()` throws. **Fix:** guard `(r.stdout || "")` as `lib/drift.mjs:162` already does.

### 13. `test/release-check.mjs:217` — `shell: true` on Windows with an args array breaks on paths containing spaces
- With `shell:true`, Node joins command+args without quoting; a checkout under `C:\Users\John Doe\…` makes the `--full` gate run a mangled command line. This is the same class as the already-fixed e28482e incident, one call site over. **Fix:** only `npm` needs the shell; run the node gate with `shell:false`, and quote args when shell is required.

### 14. `lib/doctor.mjs:29,53,72` — suggested commands interpolate the absolute target path into double quotes
- A path containing `$`, `` ` ``, or `"` produces a suggestion that expands/executes/breaks when pasted into a POSIX shell (`node install.mjs shazam "/home/u/$repo"`). The suggestions also assume the user's cwd is the kit checkout — wrong for the npm-global install path the CI template prescribes. **Fix:** print single-quoted paths (escaping embedded `'`) and derive the invocation (`ai-fication-kit` vs `node install.mjs`) from how the process was started.

### 15. `test/run-deep-test.mjs:89` — the drift retry branch tests `out.includes("SKIPPED")`, but drift only ever emits lowercase "skipped" (lib/drift.mjs:226-234)
- The documented "retry without --git" fallback is dead code; it also can't trigger via exit codes because drift exits 0 when git is unavailable. **Fix:** match the real note text or drop the branch.

### 16. `lib/progress.mjs:44` — live data is injected into an HTML `<script>` block via plain `JSON.stringify` with no `<` escaping
- `doctorAction` embeds the absolute target path (doctor.mjs:29); a path containing `</script>` breaks out of the JSON block into the page DOM. Obscure, but it is the kit's only HTML injection surface. **Fix:** `JSON.stringify(data).replace(/</g, "\\u003c")`.

### 17. `install.mjs:284` — unguarded `JSON.parse` of `ai/repo-profile.json`
- A corrupt/truncated profile makes bare `install` die with a raw stack trace instead of `die()`; the sibling `indepth` path (install.mjs:246-250) already guards this. **Fix:** try/catch → fall back to `orient()`.

### 18. `lib/installer.mjs:301` — the manifest always records `ai/repo-indepth.json` as an installed file, even when indepth never ran
- `uninstall` then lists ("Will remove …") a file the installer never wrote. Cosmetic lie in a document whose stated contract is "exactly what install wrote". **Fix:** add it only when the file exists.

### 19. `lib/demo.mjs:56` — cleanup suggestion `rm -rf "<tmpdir>"` is invalid on Windows
- `cmd.exe` has no `rm`; PowerShell's `rm` alias rejects `-rf`. **Fix:** branch on `process.platform` (`rmdir /s /q` / `Remove-Item -Recurse -Force`).

### 20. `lib/verify.mjs:83-99` — `ai/INDEX.md` is never scanned, though it is the kit's densest path-claim document
- The stamped INDEX.md (templates/ai/INDEX.md.tmpl) is a role→path manifest of backticked paths (`ai/guide/`, `ai/lab/decisions/`, `ai/analysis/FEATURE_CATALOG.md`, …). If any of those move, `verify --strict` stays green while the primary navigation document lies. **Fix:** add `ai/INDEX.md` to the sources list.
