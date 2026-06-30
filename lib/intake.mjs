// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// intake — the friendly first-run wizard for `shazam`.
//
// This is the ONE interactive part of the kit, and it exists to keep users safe:
// before any files are written we capture who is driving (maturity), make sure they
// are NOT on their production branch, and let them confirm/correct the stack. The
// answers are recorded under `humanContext` in ai/repo-profile.json so /cold-start
// starts from real context instead of guessing.
//
// It never executes anything — branch detection reads .git/HEAD as a plain file, the
// same no-execution discipline as the rest of the kit. It self-disables for
// non-interactive runs (no TTY) and whenever `--yes` is passed, so npx/CI is untouched.

import path from "node:path";
import { KIT_VERSION, ask, choose, confirm, info, isInteractive, readText, style } from "./util.mjs";

const SKILL_LEVELS = [
  "Junior / new to development",
  "Still learning",
  "Experienced / expert",
  "Prefer not to say",
];
const FAMILIARITY = [
  "New to this codebase",
  "I know parts of it",
  "I know it well",
  "Not sure",
];

async function detectBranch(targetAbs) {
  // .git/HEAD is "ref: refs/heads/<branch>" on a normal checkout. Reading it is
  // file inspection, not a git command — we never shell out.
  const head = await readText(path.join(targetAbs, ".git", "HEAD"));
  if (head === null) return { versionControlled: false, name: null };
  const m = head.match(/ref:\s*refs\/heads\/(.+)/);
  return { versionControlled: true, name: m ? m[1].trim() : "(detached HEAD)" };
}

// Returns a humanContext object, or null when the wizard is skipped (CI/--yes/no TTY).
// May exit(0) if the user chooses to stop and set up version control / a branch first.
export async function runFirstRunWizard(targetAbs, profile, flags) {
  if (flags.yes || !isInteractive()) return null;

  info("\n  " + style.bold("👋 Welcome to ai-fication-kit.") + " A few quick questions so we set you up safely.\n");

  // 1 — Maturity: two quick signals (general experience + this-repo familiarity).
  const skillLevel = await choose("How would you describe your development experience?", SKILL_LEVELS, flags, 1);
  const codebaseFamiliarity = await choose("How well do you know THIS codebase?", FAMILIARITY, flags, 0);

  // 2 — Branch safety: warn, then let them confirm. We guide; we never run git.
  const branch = await detectBranch(targetAbs);
  let isDefaultBranch = false;
  let acknowledgedRisk = true;
  if (!branch.versionControlled) {
    info("\n" + style.amber("⚠️  This folder is not a git repository.") + " We strongly recommend version control");
    info(style.amber("    before letting any agent edit code") + " — it is your undo button.");
    acknowledgedRisk = await confirm("Proceed without version control?", flags);
    if (!acknowledgedRisk) {
      info("\nGood call. Run `git init`, commit your code, then re-run shazam. 👋");
      process.exit(0);
    }
  } else {
    isDefaultBranch = /^(main|master)$/i.test(branch.name || "");
    info(`\nYou are on branch: ${style.bold(branch.name)}`);
    if (isDefaultBranch) {
      info(style.amber("⚠️  That looks like your production/default branch.") + " Setup and the agent edits");
      info("    that follow can disturb live code. Best practice is a throwaway branch:");
      info("       " + style.coral("git checkout -b ai-fication-setup"));
      acknowledgedRisk = await confirm(`Continue on '${branch.name}' anyway?`, flags);
      if (!acknowledgedRisk) {
        info("\nSmart. Create a working branch and re-run shazam. 👋");
        process.exit(0);
      }
    }
  }

  // 2.5 — AI config awareness (based on maturity check)
  if (profile.maturity?.process === 2) {
    info("\n" + style.bold("📋 This repo already has AI configuration files:"));
    if (profile.existingAIConfig?.claudeMd?.exists && !profile.existingAIConfig.claudeMd.hasKitFooter) {
      info("   • CLAUDE.md (user-authored)");
    }
    if (profile.existingAIConfig?.agentsMd?.exists && !profile.existingAIConfig.agentsMd.hasKitFooter) {
      info("   • AGENTS.md (user-authored)");
    }
    info("\n   → Process 2 will run:");
    info("     1. Back up existing files with a timestamp (e.g. CLAUDE_bkp_20260617_221847.md)");
    info("     2. Create the ai/ knowledge layer with kit templates");
    info("     3. /cold-start will extract knowledge from your backups to seed ai/guide/");
    info("   Nothing is lost — your prior configuration becomes seed knowledge.");
    const proceed = await confirm("Proceed with backup and install?", flags);
    if (!proceed) {
      info("\nNo changes made. You can run `check-repo-maturity` to see the report again. 👋");
      process.exit(0);
    }
  } else {
    info("\n" + style.bold("📋 Legacy / fresh repo detected") + " — Process 1 will create everything from scratch.");
  }

  // 3 — Stack: show what orient detected, then confirm or augment (incl. front/back split).
  const detected = profile.languages.length ? profile.languages.join(", ") : "(none detected)";
  info(`\nWe detected this stack: ${style.bold(detected)}`);
  const shape = await choose("How is your codebase structured?", [
    "That's right — single stack",
    "Single stack, but let me correct it",
    "Split: separate frontend and backend",
    "Not sure / mixed",
  ], flags, 0);

  let stack;
  if (shape.startsWith("That's right")) {
    stack = { kind: "single", detected: profile.languages, source: "confirmed-detection" };
  } else if (shape.startsWith("Single stack, but")) {
    const description = await ask("What is the stack? (e.g. 'Go', 'Python + Django')", flags, detected);
    stack = { kind: "single", detected: profile.languages, description };
  } else if (shape.startsWith("Split")) {
    const frontend = await ask("Frontend stack? (e.g. 'React + TypeScript')", flags, "");
    const backend = await ask("Backend stack? (e.g. 'Java / Spring', 'Python / FastAPI')", flags, "");
    stack = { kind: "split", detected: profile.languages, frontend, backend };
  } else {
    stack = { kind: "unknown", detected: profile.languages, note: "Resolve during /cold-start + human audit." };
  }

  info("\n" + style.green("✓ Thanks") + " — recording this in ai/repo-profile.json to guide /cold-start.\n");

  return {
    _comment: "Human-supplied context from the shazam first-run wizard — NOT deterministic " +
      "detection. These are the user's own answers, recorded to orient /cold-start and the audit.",
    firstRunAt: new Date().toISOString(),
    kitVersion: KIT_VERSION,
    developer: { skillLevel, codebaseFamiliarity },
    branch: {
      name: branch.name,
      versionControlled: branch.versionControlled,
      isDefaultBranch,
      acknowledgedRisk,
    },
    stack,
  };
}
