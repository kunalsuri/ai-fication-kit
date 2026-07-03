<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Adversarial audit R2 — concrete defects (2026-07-03) `[inferred]`

> Second adversarial pass, run against HEAD `b6d17e0`. Context: PR #21 merged
> `ADVERSARIAL_AUDIT_2026-07-03.md` (20 findings) but **no fix commits followed
> it — every one of its findings is still live**. This report re-verifies the
> highest-impact ones with fresh live reproductions on today's HEAD and adds
> **7 new findings** (marked NEW). Everything here is `[inferred]` until a
> human confirms it.
>
> Tags: `VERIFIED` = execution path traced and/or reproduced live today;
> `SUSPECTED` = pattern-level, needs a human/environment to confirm.

---

## P0 — silent data loss (reproduced live today)

### 1. [CRITICAL] [VERIFIED] `lib/installer.mjs:144` + `lib/installer.mjs:200-205` + `install.mjs:283-284`
**Issue:** Bare `install` re-runs reuse the stale on-disk profile, whose pre-install snapshot (`maturity.process === 2`, `hasKitFooter === false`) re-triggers the Process-2 backup branch; the resulting `"overwrite-backed-up"` action bypasses `classifyAction` entirely, so a human-edited, `[verified]`-tagged `CLAUDE.md` is replaced by the pristine template **without `--force`**.
**Evidence:**
```js
const action = posix(destRel) === PROGRESS_PAGE_DEST
  ? (diskText === null ? "new" : "up-to-date")
  : backedUpFiles.has(destRel)
  ? (diskText === null ? "new" : "overwrite-backed-up")
  : classifyAction({ diskText, recordedHash: prevHashes[posix(destRel)], newText: out,
```
and `install.mjs:283-284`:
```js
const existingProfile = await readText(path.join(targetAbs, PROFILE_REL));
const profile = existingProfile ? JSON.parse(existingProfile) : await orient(targetAbs, flags);
```
**Failure scenario (reproduced 2026-07-03):** `shazam --yes` on a repo with a user CLAUDE.md → human appends a `[verified]` line to the stamped CLAUDE.md → plain `install --yes` → output shows `overwrite (backed up above)  CLAUDE.md` and the `[verified]` content is gone. Directly contradicts `install.mjs:47` ("It NEVER overwrites a file you have edited") and `install.mjs:51` ("files carrying a human [verified] tag are never overwritten, even with --force").
**Fix:** Decide Process 2 from *current* disk state (re-test `KIT_FOOTER_MARKER` in `install()`), or strip `maturity`/`existingAIConfig` from the profile the installer persists; route backed-up files through `classifyAction` so the `[verified]` child-lock still applies.

### 2. [CRITICAL] [VERIFIED] `lib/util.mjs:25-31` + `lib/installer.mjs:153`, `lib/installer.mjs:273`, `lib/audit.mjs:193`
**Issue:** Backup names are unique only per clock second, and every backup writer overwrites an existing same-named file unchecked — two backups in one second silently destroy the first.
**Evidence:** `lib/util.mjs`:
```js
export function backupName(base, ext = ".md") {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}_` +
             `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  return `${base}_bkp_${ts}${ext}`;
}
```
`lib/installer.mjs:153`: `await fs.copyFile(srcAbs, bkpAbs);` (no `COPYFILE_EXCL`).
**Failure scenario (reproduced 2026-07-03):** edit stamped CLAUDE.md, then run `install --yes` twice back-to-back (scripted onboarding, CI, a retry loop). Run 1 backs the edit up to `CLAUDE_bkp_<T>.md` and overwrites the file (finding 1); run 2, in the same second, backs the now-pristine template up **onto the same backup name**. The human's content is gone from every file on disk. README.md:386 claims the timestamped name "never conflicts".
**Fix:** open backups with `fs.copyFile(src, dst, fs.constants.COPYFILE_EXCL)` and append `_2`, `_3`… (or add millisecond precision + PID) on collision.

---

## P1 — broken/false trust signals on common paths

### 3. [HIGH] [VERIFIED] [NEW] `CHECKSUMS.txt:1` (vs. current `install.mjs`, `lib/`, `templates/`)
**Issue:** The shipped integrity manifest is stale — 9 of the checksummed files no longer match. Commits after the v0.2.0 release (`e28482e`, PRs #19/#20 template edits, etc.) changed `install.mjs`, `lib/drift.mjs`, `lib/installer.mjs`, `lib/intake.mjs`, `lib/util.mjs`, `lib/verify.mjs` and three templates without regenerating.
**Evidence:** file header:
```
# SHA-256 checksums for ai-fication-kit — regenerate with ./make-checksums.sh
```
`sha256sum -c CHECKSUMS.txt` on HEAD `b6d17e0` (2026-07-03):
```
install.mjs: FAILED
lib/drift.mjs: FAILED
lib/installer.mjs: FAILED
...
sha256sum: WARNING: 9 computed checksums did NOT match
```
**Failure scenario:** a security-conscious user follows `make-checksums.sh`'s stated purpose ("verify the kit was not tampered with"), gets 9 FAILURES on a pristine clone, and either (a) concludes the kit is compromised, or (b) learns to ignore the check — which defeats it exactly when real tampering happens. `docs/RELEASE-CHECKLIST.md:23` only regenerates at release time; nothing gates interim commits.
**Fix:** regenerate `CHECKSUMS.txt` now, and add a CHECKSUMS-match check to `test/release-check.mjs` (or a CI job) so any commit touching `install.mjs`/`lib/`/`templates/` without regenerating fails.

### 4. [HIGH] [VERIFIED] `lib/status.mjs:57-64`
**Issue:** `TRUSTED` verdict for a never-cold-started repo: a scaffolded MODULE_MAP parses to zero rows, all counters are 0, and the verdict falls through to `TRUSTED`.
**Evidence:**
```js
  let verdict;
  if (brokenClaims > 0 || driftItems > 0) {
    verdict = "DRIFTING";
  } else if (mapText === null || rows.inferred > 0 || rows.unknown > 0 ||
    (daysSinceAudit !== null && daysSinceAudit > STALE_AUDIT_DAYS)) {
    verdict = "NEEDS AUDIT";
  } else {
    verdict = "TRUSTED";
  }
```
**Failure scenario (reproduced 2026-07-03):** fresh `shazam --yes` on a repo whose code lives in root files → `status` prints `Verdict: TRUSTED` (and writes a `brightgreen` badge with `--json`) while `doctor` on the same tree says "step 2 of 5 — MODULE_MAP.md is still the empty scaffolded template".
**Fix:** add `rows.verified + rows.inferred + rows.unknown === 0` (or `mapText.includes(MODULE_MAP_PLACEHOLDER)`) to the `NEEDS AUDIT` arm.

### 5. [HIGH] [VERIFIED] `lib/indepth.mjs:488`
**Issue:** Unescaped module (top-level directory) name interpolated into `new RegExp()` — a directory named `c++`, `a+b`, `foo(bar)` crashes `indepth`, `orient --indepth`, and `shazam` at the indepth level.
**Evidence:**
```js
if (other !== name && (line.includes(`/${other}/`) || line.includes(`/${other}"`) || line.includes(`/${other}'`) || line.match(new RegExp(`\\b${other}\\b`)))) {
```
**Failure scenario (reproduced 2026-07-03):** repo with a `c++/` directory plus any other module containing an `import`/`require` line that doesn't mention `c++` → `SyntaxError: Invalid regular expression: /\bc++\b/: Nothing to repeat` — full stack-trace abort.
**Fix:** escape the name (`other.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`) before `new RegExp`.

### 6. [HIGH] [VERIFIED] `templates/github/workflows/ai-check.yml.tmpl:21-24`
**Issue:** The stamped CI workflow installs `ai-fication-kit` from npm; the package is not published (`npm view ai-fication-kit` → E404, re-confirmed 2026-07-03).
**Evidence:**
```yaml
      - name: Install ai-fication-kit
        run: npm install -g ai-fication-kit
```
**Failure scenario:** every target repo that commits the stamped `.github/workflows/ai-check.yml` gets a permanently red "AI Knowledge-Base Check" on every push/PR.
**Fix:** publish the package, or stamp `npm install -g github:kunalsuri/ai-fication-kit#v{{KIT_VERSION}}` until then.

### 7. [HIGH] [VERIFIED] `templates/CLAUDE.md.tmpl:23`, `templates/AGENTS.md.tmpl:25`, `templates/claude/commands/check-drift.md:9-11`, `templates/github/prompts/check-drift.prompt.md:10-12`, `templates/cursor/rules/check-drift.mdc:10-12`, `templates/agents/workflows/check-drift.md:6-7`, + 8 siblings
**Issue:** 14 stamped agent docs order the agent to run `node install.mjs …` inside a target repo where `install.mjs` does not exist (the kit stamps only `templates/`, `.claude/`, `ai/`, etc. — never itself).
**Evidence (`templates/CLAUDE.md.tmpl:23`):
```md
- **Verify claims:** Before declaring a task finished, run `node install.mjs verify . --strict` (or your repo's verify script) to ensure no file paths in the knowledge documents are broken.
```
**Failure scenario:** an agent obeying the stamped hard rule gets `Cannot find module …/install.mjs` on every task — or silently skips verification. The mechanical `verify` can never flag this claim because it contains spaces (`extractClaims`, `lib/verify.mjs:32`, skips it) — the exact mechanical-vs-semantic gap.
**Fix:** stamp a `{{KIT_INVOCATION}}` placeholder resolved at install time (absolute kit path or `npx ai-fication-kit` once published).

### 8. [MEDIUM] [VERIFIED] [NEW] `lib/doctor.mjs:72` (+ `lib/drift.mjs:219-222`)
**Issue:** Doctor's step-4 prescription launders stale-drift findings. When the last `drift --git` recorded `stale > 0`, doctor tells the user to re-run `drift` **without** `--git`; that run always computes `stale: []` and overwrites `DRIFT_MANIFEST.json`, so the next `doctor` reaches step 5 ("nothing wrong") with the stale rows never re-audited.
**Evidence:**
```js
      action: `node install.mjs verify "${targetAbs}" --strict && node install.mjs drift "${targetAbs}" --strict`,
```
and `lib/drift.mjs`:
```js
  const stale = [];
  const git = { requested: Boolean(gitRequested), available: false, headSha: null, verifiedSha, note: null };
  if (!gitRequested) {
    git.note = "stale check is opt-in — re-run with --git to compare against the last verified commit (local, read-only git).";
```
**Failure scenario:** CI runs `drift --git --strict` → 3 stale rows recorded → developer runs `doctor` → pastes the suggested command → drift exits 0, manifest now says `stale: 0` → `doctor` reports "Every ai/guide/MODULE_MAP.md row is [verified], and the last verify/drift runs found nothing wrong." Trust silently restored without re-audit.
**Fix:** include `--git` in the suggested command when the failing manifest's `git.requested` was true, or make `doctor` treat a `stale > 0` manifest as unresolved until an `audit`/anchor update follows it.

### 9. [MEDIUM] [VERIFIED] [NEW] `lib/verify.mjs:15-17` + `lib/verify.mjs:64-65`
**Issue:** `buildFileIndex` never walks `bin`, `obj`, `out`, or `target` (treated purely as build output), so truthful doc claims pointing into a *source* `bin/` (Node CLIs, Rails, Go projects) are reported `missing` and `--strict` fails CI on correct docs.
**Evidence:**
```js
const VERIFY_IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", "out",
  "target", "vendor", "coverage", "__pycache__", ".venv", "venv", ".next", ".turbo",
  ".gradle", ".idea", ".cache", "bin", "obj"]);
```
```js
      if (e.isDirectory()) {
        if (!VERIFY_IGNORED_DIRS.has(e.name.toLowerCase())) await walk(rel);
```
**Failure scenario (reproduced 2026-07-03):** repo with `bin/cli.js` on disk and CLAUDE.md claiming `` `bin/cli.js` `` → `verify` prints `✗ missing  bin/cli.js  (CLAUDE.md:2)`; the stamped `ai-check.yml` then keeps CI red until the user deletes a *correct* claim.
**Fix:** for `path`-type claims, fall back to a direct `isFile`/`isDir` probe when the index misses (the probe is one stat), or don't prune ignored dirs when a claim's first segment names them.

### 10. [MEDIUM] [VERIFIED] [NEW] `lib/indepth.mjs:48-50`
**Issue:** Rooted `.gitignore` patterns can never match: metacharacter escaping runs first, so `/dist` becomes `\/dist...`, and `pattern.slice(1)` then strips the backslash — leaving `^/dist(...)`, anchored to a leading slash that repo-relative paths never have.
**Evidence:**
```js
        if (line.startsWith("/")) {
          pattern = "^" + pattern.slice(1);
        } else {
```
Verified: `toRule("/dist").test("dist/bundle.js") === false`.
**Failure scenario:** any repo ignoring build output with rooted patterns (`/dist`, `/coverage`, `/generated`) gets those trees fully counted by `indepth` — LOC, module structure, docstring %, architecture inference all silently skewed by generated code. (Negation `!` patterns are also silently inert, same block.)
**Fix:** escape after handling the leading `/` (or `slice(2)` the escaped `\/`), and skip/handle `!` lines explicitly.

---

## P2 — cross-module consistency rot (all re-verified current)

### 11. [MEDIUM] [VERIFIED] `lib/audit.mjs:104-116`
**Issue:** The guided audit flips rows to `[verified]` but never updates the `Last verified: … @ commit <sha>` anchor that `drift --git` diffs against.
**Evidence:**
```js
export function applyEdits(mapText, edits) {
  const lines = mapText.split("\n");
  const appliedLines = [];
  for (const [lineNo, { stability, timestamp }] of edits) {
```
(only table row lines are rewritten; no code path touches the anchor line parsed at `lib/drift.mjs:68`).
**Failure scenario:** human completes a full `audit` today → `drift --git` still diffs from the old anchor sha → freshly audited rows flagged `stale` → `--strict` CI fails immediately after a completed audit.
**Fix:** after a successful `--git` audit, rewrite `Last verified:` to today + `HEAD` sha; without `--git`, print an explicit reminder.

### 12. [MEDIUM] [VERIFIED] `lib/status.mjs:24` vs `docs/AUDIT-GUIDE.md:57`, `docs/GETTING-STARTED.md:101`
**Issue:** `newestAuditDate` parses only `DD/MM/YYYY` (the `audit` command's format), while both docs and every worked example instruct ISO `[verified] (2026-06-12)` — hand-audited maps read "Last audit: unknown" forever and the 90-day staleness gate never fires.
**Evidence:**
```js
  for (const m of mapText.matchAll(/\[verified\]\s*\((\d{2})\/(\d{2})\/(\d{4})/g)) {
```
vs `docs/AUDIT-GUIDE.md:57`: ``Add the date when you flip: `[verified] (2026-06-12)`.``
**Fix:** accept both formats (add a `(\d{4})-(\d{2})-(\d{2})` alternative) and align docs on one canonical format.

### 13. [MEDIUM] [VERIFIED] `lib/installer.mjs:200-201` + `lib/installer.mjs:206`→`296`
**Issue:** `ai/START-HERE.html` short-circuits to `"up-to-date"` whenever it exists (even under `--force-verified`), so a redesigned kit dashboard can never reach installed repos; and the manifest hash recorded for it is `sha256(template)`, which never matches disk once `refreshProgressPage` injects live data — a permanently false provenance entry.
**Evidence:**
```js
    const action = posix(destRel) === PROGRESS_PAGE_DEST
      ? (diskText === null ? "new" : "up-to-date")
```
**Fix:** compare disk-vs-template with the `progress-data` block stripped from both (reuse `DATA_BLOCK_RE`); refresh the shell when the stripped template changed, then re-inject data; record the hash of what's actually on disk.

### 14. [MEDIUM] [VERIFIED] [NEW] `lib/intake.mjs:74`, `lib/maturity.mjs:67-68`, `lib/orient.mjs:45`
**Issue:** Git worktrees and submodules use a `.git` **file** (`gitdir: …`), not a directory. `checkVersionControl` requires `isDir(".git")` and `detectBranch`/`detectFork` read `.git/HEAD` / `.git/config` as paths under a directory — all three misreport on a worktree, while `drift --git` (real git) works fine on the same tree.
**Evidence (`lib/maturity.mjs:67-68`):**
```js
  const gitDir = path.join(targetAbs, ".git");
  if (!(await isDir(gitDir))) return { exists: false, branch: null };
```
`lib/intake.mjs:74`:
```js
  const head = await readText(path.join(targetAbs, ".git", "HEAD"));
  if (head === null) return { versionControlled: false, name: null };
```
**Failure scenario:** user runs `shazam` inside a `git worktree add` checkout (a natural way to follow the wizard's own "use a throwaway branch" advice): the wizard warns "⚠️ This folder is not a git repository", the maturity score silently drops 15 points, branch safety checks are skipped, and fork detection is dead — yet `drift --git` on the same tree succeeds. Cross-module contradiction and a wrong safety warning at the exact moment the kit claims to "keep users safe".
**Fix:** when `.git` is a file, parse the `gitdir:` line and resolve `HEAD`/`config` there (still pure file inspection).

### 15. [MEDIUM] [VERIFIED] `install.mjs:43-46` + `docs/CLI-REFERENCE.md:18-19`
**Issue:** Both trust headers are stale on two counts: (a) "Two exceptions run LOCAL, READ-ONLY git" — `audit --git` (`lib/audit.mjs:78`, documented in the same files) is a third; (b) "It does NOT write anywhere outside the target folder you pass in" — `demo` writes a whole tree under `os.tmpdir()` (`lib/demo.mjs:34`) and `--github-summary` appends to `$GITHUB_STEP_SUMMARY` (`lib/util.mjs:95`).
**Evidence:**
```
//   - It does NOT execute any code or open any network connection. (Two exceptions
//     run LOCAL, READ-ONLY git: `drift --git` computes the stale set, and `indepth`
//     reads commit/contributor history. Everything else is pure file inspection.)
//   - It does NOT write anywhere outside the target folder you pass in.
```
**Fix:** three git exceptions; carve out `demo` and the step-summary file explicitly in both documents.

### 16. [LOW] [VERIFIED] `lib/doctor.mjs:39-41`
**Issue:** Step-2 diagnosis says "The kit is installed" when only bare `orient` has run (step 1 keys on `ai/repo-profile.json`, which orient writes without installing anything); the prescribed `/cold-start` doesn't exist yet.
**Evidence:**
```js
      diagnosis: mapText === null
        ? "The kit is installed, but ai/guide/MODULE_MAP.md doesn't exist yet."
        : "ai/guide/MODULE_MAP.md is still the empty scaffolded template.",
      action: "Run /cold-start in your agent (it fills in ai/guide/MODULE_MAP.md).",
```
**Fix:** if `ai/install-manifest.json` is absent, diagnose "profiled but not installed" and prescribe `install`/`shazam`.

---

## P3 — robustness / platform / cosmetic

### 17. [LOW] [VERIFIED] `lib/doctor.mjs:28`, `:53`, `:72`
**Issue:** Suggested commands interpolate the absolute path into **double** quotes — `$`, `` ` ``, `"` in the path expand/execute/break when pasted into a POSIX shell; the suggestion also assumes cwd is the kit checkout.
**Evidence:** `` action: `node install.mjs shazam "${targetAbs}"`, ``
**Fix:** single-quote (escaping embedded `'`); derive the invocation from how the process was started.

### 18. [LOW] [VERIFIED] `test/release-check.mjs:148`, `:154`
**Issue:** With git not installed, `spawnSync` returns `stdout: null` → `.stdout.trim()` throws a raw TypeError, despite the header's "Skipped (stated, never silent)" promise (line 23).
**Evidence:** `` const lastTag = git("describe", "--tags", "--abbrev=0").stdout.trim(); ``
**Fix:** `(r.stdout || "")` as `lib/drift.mjs:162` already does.

### 19. [LOW] [SUSPECTED] `test/release-check.mjs:217`
**Issue:** `shell: true` on Windows with an args array joins without quoting — a checkout under `C:\Users\John Doe\…` mangles the `--full` gate command line (same class as the fixed `e28482e` incident, one call site over).
**Evidence:** `` const r = spawnSync(cmd, args, { encoding: "utf8", cwd: root, shell: process.platform === "win32" }); ``
**Fix:** only `npm` needs the shell; run the node gate with `shell: false` and quote args where a shell is required.

### 20. [LOW] [VERIFIED] `test/run-deep-test.mjs:89`
**Issue:** The drift retry branch tests `out.includes("SKIPPED")`, but drift only emits lowercase "skipped" (`lib/drift.mjs:222-234`) and exits 0 when git is unavailable — the documented fallback is dead code.
**Evidence:** `` if (driftRes.code !== 0 && driftRes.out.includes("SKIPPED")) { ``
**Fix:** match the real note text or drop the branch.

### 21. [LOW] [VERIFIED] `lib/progress.mjs:44`
**Issue:** Live data (including the absolute target path via `doctorAction`) is injected into an HTML `<script>` block with plain `JSON.stringify` — a path containing `</script>` breaks out of the JSON block into the page DOM.
**Evidence:** `` const updated = existing.replace(DATA_BLOCK_RE, (_m, open, close) => open + JSON.stringify(data) + close); ``
**Fix:** `JSON.stringify(data).replace(/</g, "\\u003c")`.

### 22. [LOW] [VERIFIED] `install.mjs:284`
**Issue:** Unguarded `JSON.parse` of `ai/repo-profile.json` — a corrupt profile makes bare `install` die with a raw stack trace; the sibling `indepth` path (`install.mjs:246-250`) already guards this.
**Evidence:** `` const profile = existingProfile ? JSON.parse(existingProfile) : await orient(targetAbs, flags); ``
**Fix:** try/catch → fall back to `orient()`.

### 23. [LOW] [VERIFIED] `lib/installer.mjs:300-301`
**Issue:** The manifest always records `ai/repo-indepth.json` as installed, even when indepth never ran — `uninstall` then lists a file the installer never wrote, in a document whose contract is "exactly what install wrote".
**Evidence:**
```js
    files: [...new Set([...prevFiles, ...plan.map(p => posix(p.destRel)),
      posix(PROFILE_REL), posix(MANIFEST_REL), posix(path.join("ai", "repo-indepth.json"))])].sort(),
```
**Fix:** add it only when the file exists.

### 24. [LOW] [VERIFIED] `lib/demo.mjs:56`
**Issue:** Cleanup suggestion `rm -rf "<tmpdir>"` is invalid on Windows (`cmd.exe` has no `rm`; PowerShell's `rm` alias rejects `-rf`).
**Evidence:** `` info("When you're done: " + style.dim(`rm -rf "${demoDir}"`)); ``
**Fix:** branch on `process.platform`.

### 25. [LOW] [VERIFIED] `lib/verify.mjs:81-99`
**Issue:** `ai/INDEX.md` — the kit's densest path-claim document (the role→path manifest) — is never scanned by `verify`; if any quoted path moves, `--strict` stays green while the primary navigation doc lies.
**Evidence:** sources list covers only `CLAUDE.md`, `AGENTS.md`, `ai/guide/*.md`, `ai/analysis/FEATURE_CATALOG*`:
```js
  for (const f of ["CLAUDE.md", "AGENTS.md"]) {
    if (await isFile(path.join(targetAbs, f))) sources.push(f);
  }
```
**Fix:** add `ai/INDEX.md` to the sources list.

### 26. [LOW] [VERIFIED] [NEW] `lib/installer.mjs:152-156`
**Issue:** In `--dry-run`, the Process-2 branch skips the copy but still prints "ℹ Backed up CLAUDE.md → …", then later prints "--dry-run: nothing written" — the transcript claims a write that never happened.
**Evidence:**
```js
        if (!flags.dryRun) {
          await fs.copyFile(srcAbs, bkpAbs);
        }
        backups.push({ source: srcFile, backup: bkpRel });
        info(`  ℹ Backed up ${srcFile} → ${bkpRel} (knowledge preserved for /cold-start)`);
```
**Fix:** print "would back up" under `--dry-run`.

### 27. [LOW] [SUSPECTED] [NEW] `lib/indepth.mjs:694`
**Issue:** `topContributors` labels the value `email`, but `git shortlog -sn` emits **names**; the JSON consumed by agents states a wrong fact about its own field.
**Evidence:**
```js
        result.topContributors.push({ email: parts[1], commitCount: parseInt(parts[0], 10) || 0 });
```
**Fix:** rename the field to `name` (or use `-sne` and parse the actual email).

---

## Category coverage

| Audit category | Findings |
|---|---|
| 1. Stale cross-references | 1 (guarantee text), 3, 6, 7, 12, 15, 16, 18, 20, 27 |
| 2. Unquoted/unescaped interpolation | 5, 17, 19, 21 |
| 3. Platform-specific gaps | 14, 19, 24 |
| 4. Ownership conflicts on generated files | 1, 2, 3 (CHECKSUMS), 13 |
| 5. Mechanical vs semantic validation gaps | 7, 9, 12, 25 |
| 6. Cross-module consistency | 4, 8, 10, 11, 14, 23, 26 |

No findings were discarded for lack of quotable evidence.
