#!/usr/bin/env node
// Copyright (c) 2026 CEA LIST / Kunal Suri. All rights reserved.
// ai-fication-kit installer (Node ≥ 18, zero dependencies).
//
// WHAT THIS DOES, IN FULL:
//   orient    — reads marker files (package.json, pom.xml, pyproject.toml, ...) in a
//               target repo and writes ai/repo-profile.json. Pure file inspection.
//   install   — stamps the kit's templates/ into the target repo, substituting
//               detected facts ({{PROJECT_NAME}}, {{BUILD_CMD}}, ...). Records every
//               file it writes in ai/install-manifest.json.
//   shazam    — orient + install + prints your next steps. The magic stops exactly
//               where inference begins: this tool never guesses, never runs your
//               code, and hands the thinking to you and your agent.
//   uninstall — deletes exactly the files listed in ai/install-manifest.json.
//   verify    — extracts every backtick-quoted path claim from the knowledge docs
//               (CLAUDE.md, AGENTS.md, ai/guide/*.md, ai/analysis/FEATURE_CATALOG*.md)
//               and checks each against the real file tree. Writes a machine-readable
//               manifest and a human-readable report into ai/analysis/audit-reports/.
//               Deterministic: a claim is either on disk or it is not. No LLM.
//   drift     — the reverse of verify: reports code-bearing directories the MODULE_MAP
//               does not cover (unmapped), map entries that are gone (vanished), and —
//               only with --git — [verified] rows whose code changed since the verified
//               commit (stale). Writes a manifest + report into ai/analysis/audit-reports/.
//
// WHAT THIS DOES NOT DO (by design, so it cannot harm you):
//   - It does NOT execute any code or open any network connection. (The single
//     exception: `drift --git` runs LOCAL, READ-ONLY git to compute the stale set;
//     without --git, drift is pure file inspection like everything else here.)
//   - It does NOT write anywhere outside the target folder you pass in.
//   - It does NOT overwrite existing files unless you pass --force.
//   - It has NO dependencies, so there is nothing else to trust.
//
// This file is only the command-line interface. The implementation is split into
// small single-purpose modules so a human can audit each in one sitting:
//   lib/util.mjs       — shared fs probes, prompts, and constants
//   lib/orient.mjs     — deterministic stack detection
//   lib/installer.mjs  — template stamping (install) and manifest-based uninstall
//   lib/verify.mjs     — mechanical claim verification
// You are encouraged to read them all before running this.
//
// USAGE:
//   node install.mjs shazam   <path-to-your-repo> [options]
//   node install.mjs orient   <path-to-your-repo> [--dry-run]
//   node install.mjs install  <path-to-your-repo> [options]
//   node install.mjs uninstall <path-to-your-repo> [--dry-run]
//   node install.mjs verify   <path-to-your-repo> [--dry-run] [--strict]
//   node install.mjs drift    <path-to-your-repo> [--dry-run] [--strict] [--git]
//
// OPTIONS:
//   --dry-run            show the plan, write nothing
//   --strict             verify/drift only: exit 1 if any claim is unconfirmed / drifted
//   --git                drift only: include the stale check (local, read-only git)
//   --force              overwrite existing files
//   --yes                skip the confirmation prompt
//   --name "X"           project name        (default: target folder name)
//   --description "X"    one-line description (default: first line of README, or placeholder)
//   --build "X"          build command        (default: detected)
//   --test "X"           test command         (default: detected)
//   --upstream "org/repo" fork upstream       (default: detected from git remotes)

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

import { KIT_VERSION, PROFILE_REL, die, exists, info, readText } from "./lib/util.mjs";
import { orient, printProfile } from "./lib/orient.mjs";
import { install, uninstall } from "./lib/installer.mjs";
import { verify } from "./lib/verify.mjs";
import { drift } from "./lib/drift.mjs";
import { runFirstRunWizard } from "./lib/intake.mjs";

// ---------------------------------------------------------------- CLI parsing

const argv = process.argv.slice(2);
if (argv.includes("--version") || argv.includes("-v")) {
  console.log(KIT_VERSION);
  process.exit(0);
}
const COMMANDS = new Set(["orient", "install", "shazam", "uninstall", "verify", "drift", "check-repo-maturity"]);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry-run") flags.dryRun = true;
  else if (a === "--strict") flags.strict = true;
  else if (a === "--force") flags.force = true;
  else if (a === "--git") flags.git = true;
  else if (a === "--yes") flags.yes = true;
  else if (["--name", "--description", "--build", "--test", "--upstream"].includes(a)) {
    const v = argv[++i];
    if (v === undefined) die(`${a} requires a value`);
    flags[a.slice(2)] = v;
  } else if (a.startsWith("--")) die(`Unknown option: ${a}`);
  else positional.push(a);
}
const command = COMMANDS.has(positional[0]) ? positional.shift() : null;
const target = positional.shift();

if (!command || !target) {
  console.log(`ai-fication-kit ${KIT_VERSION} — make any repo AI-native, with a human in the loop.

Usage:
  node install.mjs shazam    <path-to-your-repo>   one-shot: orient + install + next steps
  node install.mjs orient    <path-to-your-repo>   detect stack, write ai/repo-profile.json
  node install.mjs install   <path-to-your-repo>   stamp templates into the repo
  node install.mjs uninstall <path-to-your-repo>   remove exactly what install wrote
  node install.mjs verify    <path-to-your-repo>   mechanically check every path claim
                                                   in the knowledge docs against the tree
  node install.mjs drift     <path-to-your-repo>   report where the code has drifted from
                                                   the map (unmapped/vanished; --git: stale)
  node install.mjs check-repo-maturity <path>      read-only AI readiness diagnostic
                                                   (no LLM, no writes, just a report)

Options: --dry-run --force --yes --strict --git --name --description --build --test --upstream
         --version, -v   print the kit version and exit
`);
  process.exit(command ? 1 : 0);
}

// ----------------------------------------------------------------- main flow

const targetAbs = path.resolve(target);
if (!(await exists(targetAbs))) die(`Target does not exist: ${targetAbs}`);
if (!(await fs.stat(targetAbs)).isDirectory()) die(`Target is not a directory: ${targetAbs}`);

if (command === "orient") {
  const profile = await orient(targetAbs, flags);
  printProfile(profile);
  if (flags.dryRun) { info("--dry-run: profile not written."); }
  else {
    await fs.mkdir(path.join(targetAbs, "ai"), { recursive: true });
    await fs.writeFile(path.join(targetAbs, PROFILE_REL),
      JSON.stringify(profile, null, 2) + "\n", "utf8");
    info(`✓ Wrote ${PROFILE_REL}`);
  }
} else if (command === "check-repo-maturity") {
  const { checkMaturity, printMaturityReport } = await import("./lib/maturity.mjs");
  const result = await checkMaturity(targetAbs);
  printMaturityReport(result);
  if (!flags.dryRun) {
    const reportDir = path.join(targetAbs, "ai", "analysis", "audit-reports");
    await fs.mkdir(reportDir, { recursive: true });
    await fs.writeFile(path.join(reportDir, "MATURITY_REPORT.json"),
      JSON.stringify(result, null, 2) + "\n", "utf8");
    info(`✓ Wrote ai/analysis/audit-reports/MATURITY_REPORT.json`);
  } else {
    info("--dry-run: report not written.");
  }
} else if (command === "install") {
  const existingProfile = await readText(path.join(targetAbs, PROFILE_REL));
  const profile = existingProfile ? JSON.parse(existingProfile) : await orient(targetAbs, flags);
  await install(targetAbs, profile, flags);
} else if (command === "shazam") {
  info("⚡ shazam — orient, install, and hand you the audit. No magic past this point.");

  // Step 1: Maturity check (read-only diagnostic, always runs first)
  const { checkMaturity, printMaturityReport } = await import("./lib/maturity.mjs");
  const maturityResult = await checkMaturity(targetAbs);
  printMaturityReport(maturityResult);

  // Step 2: Orient (embeds maturity results in profile)
  const profile = await orient(targetAbs, flags);
  printProfile(profile);

  // Step 3: First-run wizard (interactive only)
  if (!flags.dryRun) {
    const existing = await readText(path.join(targetAbs, PROFILE_REL));
    let alreadyOnboarded = false;
    try { alreadyOnboarded = Boolean(existing && JSON.parse(existing).humanContext); } catch { /* ignore */ }
    if (!alreadyOnboarded) {
      const humanContext = await runFirstRunWizard(targetAbs, profile, flags);
      if (humanContext) profile.humanContext = humanContext;
    }
  }

  // Step 4: Install (process-aware: backs up on Process 2)
  await install(targetAbs, profile, flags);

  if (!flags.dryRun) {
    const isProcess2 = profile.maturity?.process === 2;
    info(`
Next steps (the part that needs a brain):
  1. Open the repo in Claude Code and run  /cold-start
     The agent drafts ai/guide/MODULE_MAP.md and friends — everything tagged [inferred].${isProcess2 ? `
     ↳ Backup files exist — the agent will extract and reuse knowledge from
       your prior CLAUDE.md / AGENTS.md to seed the ai/guide/ documents.` : ""}
     (Not using Claude Code? See docs/FAQ.md#cursor-copilot-codex for other tools.)
  2. Audit (~30 min): set each module's Stability (frozen / stable / ours),
     flip [inferred] -> [verified] on rows you confirm.
  3. Optional: node install.mjs verify <repo>  (mechanical claim check, no LLM),
     then /post-cold-start-verification, /verify-ai-readiness.
  4. Build: /add-feature.
`);
  }
} else if (command === "uninstall") {
  await uninstall(targetAbs, flags);
} else if (command === "verify") {
  await verify(targetAbs, flags);
} else if (command === "drift") {
  await drift(targetAbs, flags);
}
