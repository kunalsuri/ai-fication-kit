#!/usr/bin/env node
// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
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
//   doctor    — read-only "what do I do next?": detects which of the 5 workflow stages
//               the repo is at from files already on disk, and prints the next step
//               in plain language. Writes nothing.
//   status    — one-command health snapshot: runs verify's and drift's core scans
//               in-process (structural only, never git), counts MODULE_MAP
//               [verified]/[inferred] rows, and prints a single verdict (TRUSTED /
//               NEEDS AUDIT / DRIFTING). Writes ai/analysis/audit-reports/STATUS.json
//               only with --json.
//   audit     — interactive-only guided human audit of MODULE_MAP.md: gathers
//               deterministic evidence per row (fs stat; --git adds the last commit
//               touching that area) and only writes a [verified] tag after an
//               explicit per-row human confirmation. --yes does NOT unlock this
//               command — automation must never manufacture a human signature.
//
// WHAT THIS DOES NOT DO (by design, so it cannot harm you):
//   - It does NOT execute any code or open any network connection. (Two exceptions
//     run LOCAL, READ-ONLY git: `drift --git` computes the stale set, and `indepth`
//     reads commit/contributor history. Everything else is pure file inspection.)
//   - It does NOT write anywhere outside the target folder you pass in.
//   - It NEVER overwrites a file you have edited. Re-runs are incremental: new kit
//     files are added, untouched kit files are refreshed (told apart by the content
//     hashes recorded in ai/install-manifest.json), and anything you changed is kept.
//     --force overwrites edited files only after a timestamped backup — and files
//     carrying a human [verified] tag are never overwritten, even with --force.
//     Only the dedicated --force-verified flag can unlock those, and it first shows
//     you every signature that will be lost and asks you to type "overwrite".
//   - It has NO dependencies, so there is nothing else to trust.
//
// This file is only the command-line interface. The implementation is split into
// small single-purpose modules so a human can audit each in one sitting:
//   lib/util.mjs       — shared fs probes, prompts, and constants
//   lib/orient.mjs     — deterministic stack detection
//   lib/indepth.mjs    — comprehensive Tier-2 analysis (deps, metrics, git history)
//   lib/maturity.mjs   — read-only AI-readiness diagnostic
//   lib/intake.mjs     — first-run wizard (the one interactive part)
//   lib/installer.mjs  — template stamping (install) and manifest-based uninstall
//   lib/verify.mjs     — mechanical claim verification
//   lib/drift.mjs      — structural drift detection (unmapped/vanished/stale)
//   lib/doctor.mjs     — read-only stage detector ("what do I do next?")
//   lib/status.mjs     — one-command health snapshot (TRUSTED/NEEDS AUDIT/DRIFTING)
//   lib/audit.mjs      — interactive guided human audit of MODULE_MAP.md
// You are encouraged to read them all before running this.
//
// USAGE:
//   node install.mjs shazam   <path-to-your-repo> [options]
//   node install.mjs orient   <path-to-your-repo> [--dry-run]
//   node install.mjs indepth  <path-to-your-repo> [--dry-run]
//   node install.mjs install  <path-to-your-repo> [options]
//   node install.mjs uninstall <path-to-your-repo> [--dry-run]
//   node install.mjs verify   <path-to-your-repo> [--dry-run] [--strict]
//   node install.mjs drift    <path-to-your-repo> [--dry-run] [--strict] [--git]
//   node install.mjs check-repo-maturity <path-to-your-repo> [--dry-run]
//   node install.mjs doctor   <path-to-your-repo>
//   node install.mjs status   <path-to-your-repo> [--json]
//   node install.mjs audit    <path-to-your-repo> [--dry-run] [--git]
//
// OPTIONS:
//   --dry-run            show the plan, write nothing
//   --strict             verify/drift only: exit 1 if any claim is unconfirmed / drifted
//   --git                drift only: include the stale check (local, read-only git)
//   --suggest            drift only: append ready-to-paste MODULE_MAP fixes to the report
//   --github-summary     verify/drift only: append a plain-English summary to
//                        $GITHUB_STEP_SUMMARY if set (silent no-op otherwise)
//   --json               status only: also write ai/analysis/audit-reports/STATUS.json
//   --force              overwrite files you edited (timestamped backup taken first);
//                        files carrying a human [verified] tag are still kept
//   --force-verified     implies --force AND unlocks [verified] files too — shows
//                        exactly which signatures will be lost, then asks you to
//                        type "overwrite" to confirm (backups still taken)
//   --yes                skip the confirmation prompt
//   --name "X"           project name        (default: target folder name)
//   --description "X"    one-line description (default: first line of README, or placeholder)
//   --build "X"          build command        (default: detected)
//   --test "X"           test command         (default: detected)
//   --upstream "org/repo" fork upstream       (default: detected from git remotes)

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

import { KIT_VERSION, PROFILE_REL, banner, die, exists, info, readText, style, choose, isInteractive } from "./lib/util.mjs";
import { orient, printProfile } from "./lib/orient.mjs";
import { install, uninstall } from "./lib/installer.mjs";
import { verify } from "./lib/verify.mjs";
import { drift } from "./lib/drift.mjs";
import { runFirstRunWizard } from "./lib/intake.mjs";
import { diagnose, printDoctorReport } from "./lib/doctor.mjs";
import { status } from "./lib/status.mjs";
import { audit } from "./lib/audit.mjs";

// ---------------------------------------------------------------- CLI parsing

const argv = process.argv.slice(2);
if (argv.includes("--version") || argv.includes("-v")) {
  console.log(KIT_VERSION);
  process.exit(0);
}
const COMMANDS = new Set(["orient", "install", "shazam", "uninstall", "verify", "drift", "check-repo-maturity", "indepth", "doctor", "status", "audit"]);
const flags = {};
const positional = [];
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--dry-run") flags.dryRun = true;
  else if (a === "--strict") flags.strict = true;
  else if (a === "--force") flags.force = true;
  else if (a === "--force-verified") { flags.forceVerified = true; flags.force = true; }
  else if (a === "--git") flags.git = true;
  else if (a === "--suggest") flags.suggest = true;
  else if (a === "--github-summary") flags.githubSummary = true;
  else if (a === "--json") flags.json = true;
  else if (a === "--yes") flags.yes = true;
  else if (a === "--skip-prompt") flags.skipPrompt = true;
  else if (a === "--interactive" || a === "-i") flags.interactive = true;
  else if (a === "--indepth") flags.analysisLevel = "indepth";
  else if (a === "--analysis-level") {
    const v = argv[++i];
    if (v === undefined) die(`${a} requires a value`);
    if (v !== "general" && v !== "indepth") die(`${a} must be 'general' or 'indepth'`);
    flags.analysisLevel = v;
  }
  else if (["--name", "--description", "--build", "--test", "--upstream"].includes(a)) {
    const v = argv[++i];
    if (v === undefined) die(`${a} requires a value`);
    flags[a.slice(2)] = v;
  } else if (a.startsWith("--")) die(`Unknown option: ${a}`);
  else positional.push(a);
}
const command = COMMANDS.has(positional[0]) ? positional.shift() : null;
const target = positional.shift();

async function chooseAnalysisLevel(flags) {
  if (flags.analysisLevel) return flags.analysisLevel;
  if (flags.yes || flags.skipPrompt || !isInteractive()) return "general";
  const options = [
    "General (quick profile)\n       → Detects language, build system, frameworks, code quality\n       → Output: ai/repo-profile.json\n       → Time: ~200ms\n       → Best for: Quick onboarding, CI/CD pipelines",
    "Indepth (comprehensive analysis)\n       → Includes: dependency graph, code metrics, architecture inference\n       → Output: ai/repo-profile.json + ai/repo-indepth.json\n       → Time: ~2-5s\n       → Best for: Full codebase understanding, refactoring planning"
  ];
  const chosen = await choose("Analysis level?", options, flags, 0);
  return chosen.startsWith("General") ? "general" : "indepth";
}

if (!command || !target) {
  banner();
  console.log(`make any repo AI-native, with a human in the loop.

Usage:
  node install.mjs shazam    <path-to-your-repo>   one-shot: orient + install + next steps
  node install.mjs orient    <path-to-your-repo>   detect stack, write ai/repo-profile.json
  node install.mjs indepth   <path-to-your-repo>   run comprehensive indepth analysis
  node install.mjs install   <path-to-your-repo>   stamp templates into the repo
  node install.mjs uninstall <path-to-your-repo>   remove exactly what install wrote
  node install.mjs verify    <path-to-your-repo>   mechanically check every path claim
                                                   in the knowledge docs against the tree
  node install.mjs drift     <path-to-your-repo>   report where the code has drifted from
                                                   the map (unmapped/vanished; --git: stale;
                                                   --suggest: ready-to-paste fixes)
  node install.mjs check-repo-maturity <path>      read-only AI readiness diagnostic
                                                   (no LLM, no writes, just a report)
  node install.mjs doctor    <path-to-your-repo>   "what do I do next?" — read-only,
                                                   writes nothing
  node install.mjs status    <path-to-your-repo>   one-command health snapshot + verdict
                                                   (TRUSTED / NEEDS AUDIT / DRIFTING)
  node install.mjs audit     <path-to-your-repo>   guided human audit of MODULE_MAP.md
                                                   (interactive only — --yes refuses)

Options: --dry-run --force --force-verified --yes --strict --git --suggest
         --github-summary --json --name --description --build --test --upstream
         --analysis-level general|indepth --indepth --skip-prompt --interactive, -i
         --version, -v   print the kit version and exit
`);
  process.exit(command ? 1 : 0);
}

// ----------------------------------------------------------------- main flow

const targetAbs = path.resolve(target);
if (!(await exists(targetAbs))) die(`Target does not exist: ${targetAbs}`);
if (!(await fs.stat(targetAbs)).isDirectory()) die(`Target is not a directory: ${targetAbs}`);

if (command === "orient") {
  const level = flags.interactive ? await chooseAnalysisLevel(flags) : (flags.analysisLevel || "general");
  const profile = await orient(targetAbs, flags);
  printProfile(profile);
  if (!flags.dryRun) {
    await fs.mkdir(path.join(targetAbs, "ai"), { recursive: true });
    await fs.writeFile(path.join(targetAbs, PROFILE_REL),
      JSON.stringify(profile, null, 2) + "\n", "utf8");
    info(`✓ Wrote ${PROFILE_REL}`);
  }
  if (level === "indepth") {
    const { indepth, printIndepthReport } = await import("./lib/indepth.mjs");
    const indepthResult = await indepth(targetAbs, flags);
    printIndepthReport(indepthResult);
    if (!flags.dryRun) {
      const indepthPath = path.join(targetAbs, "ai", "repo-indepth.json");
      await fs.writeFile(indepthPath, JSON.stringify(indepthResult, null, 2) + "\n", "utf8");
      info(`✓ Wrote ai/repo-indepth.json`);
    }
  }
  if (flags.dryRun) { info("--dry-run: profile not written."); }
} else if (command === "indepth") {
  const profilePath = path.join(targetAbs, PROFILE_REL);
  let profile;
  if (await exists(profilePath)) {
    try {
      profile = JSON.parse(await readText(profilePath));
    } catch {
      profile = await orient(targetAbs, flags);
    }
  } else {
    profile = await orient(targetAbs, flags);
    if (!flags.dryRun) {
      await fs.mkdir(path.join(targetAbs, "ai"), { recursive: true });
      await fs.writeFile(profilePath, JSON.stringify(profile, null, 2) + "\n", "utf8");
      info(`✓ Wrote ${PROFILE_REL}`);
    }
  }
  const { indepth, printIndepthReport } = await import("./lib/indepth.mjs");
  const indepthResult = await indepth(targetAbs, flags);
  printIndepthReport(indepthResult);
  if (!flags.dryRun) {
    const indepthPath = path.join(targetAbs, "ai", "repo-indepth.json");
    await fs.writeFile(indepthPath, JSON.stringify(indepthResult, null, 2) + "\n", "utf8");
    info(`✓ Wrote ai/repo-indepth.json`);
  } else {
    info("--dry-run: repo-indepth.json not written.");
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
  banner();
  info("  " + style.amber("⚡ shazam") + style.gray(" — orient · install · then hand you the audit. No magic past this point."));

  const level = await chooseAnalysisLevel(flags);

  // Step 1: Maturity check (read-only diagnostic, always runs first)
  const { checkMaturity, printMaturityReport } = await import("./lib/maturity.mjs");
  const maturityResult = await checkMaturity(targetAbs);
  printMaturityReport(maturityResult);

  // Step 2: Orient (embeds maturity results in profile)
  const profile = await orient(targetAbs, flags);
  printProfile(profile);

  if (level === "indepth") {
    const { indepth, printIndepthReport } = await import("./lib/indepth.mjs");
    const indepthResult = await indepth(targetAbs, flags);
    printIndepthReport(indepthResult);
    if (!flags.dryRun) {
      const indepthPath = path.join(targetAbs, "ai", "repo-indepth.json");
      await fs.mkdir(path.join(targetAbs, "ai"), { recursive: true });
      await fs.writeFile(indepthPath, JSON.stringify(indepthResult, null, 2) + "\n", "utf8");
      info(`✓ Wrote ai/repo-indepth.json`);
    }
  }

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
    const step = (n) => style.coral(`${n}.`);
    info("\n" + style.bold("Next steps") + style.gray(" (the part that needs a brain):"));
    info(`  ${step(1)} Open the repo in Claude Code and run  ${style.bold("/cold-start")}`);
    info(`     The agent drafts ai/guide/MODULE_MAP.md and friends — everything tagged ${style.dim("[inferred]")}.`);
    if (isProcess2) {
      info(`     ${style.amber("↳")} Backup files exist — the agent will extract and reuse knowledge from`);
      info(`       your prior CLAUDE.md / AGENTS.md to seed the ai/guide/ documents.`);
    }
    info(`     ${style.gray("(Not using Claude Code? See docs/FAQ.md#cursor-copilot-codex for other tools.)")}`);
    info(`  ${step(2)} Audit (~30 min): set each module's Stability (frozen / stable / ours),`);
    info(`     flip ${style.dim("[inferred]")} -> ${style.green("[verified]")} on rows you confirm.`);
    info(`  ${step(3)} Optional: node install.mjs verify <repo>  (mechanical claim check, no LLM),`);
    info(`     then /post-cold-start-verification, /verify-ai-readiness.`);
    info(`  ${step(4)} Build: ${style.bold("/add-feature")}.`);
    info("");
  }
} else if (command === "uninstall") {
  await uninstall(targetAbs, flags);
} else if (command === "verify") {
  await verify(targetAbs, flags);
} else if (command === "drift") {
  await drift(targetAbs, flags);
} else if (command === "doctor") {
  const result = await diagnose(targetAbs);
  printDoctorReport(result);
} else if (command === "status") {
  await status(targetAbs, flags);
} else if (command === "audit") {
  await audit(targetAbs, flags);
}
