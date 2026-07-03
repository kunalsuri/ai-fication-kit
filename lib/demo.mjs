// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// demo — zero-risk playground run. Copies the bundled example into a fresh
// OS-temp directory and runs the same in-process pipeline `shazam --yes`
// runs, so a first-timer can see the whole before/after without pointing
// the kit at any repo of their own. The only sanctioned write outside a
// user-supplied target: always under os.tmpdir(), never the cwd or the kit.

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { die, info, isDir, kitRoot, style } from "./util.mjs";
import { orient } from "./orient.mjs";
import { install } from "./installer.mjs";

const EXAMPLE_REL = ["examples", "legacy-calculator"];

async function copyDir(srcAbs, destAbs) {
  await fs.mkdir(destAbs, { recursive: true });
  for (const e of await fs.readdir(srcAbs, { withFileTypes: true })) {
    const s = path.join(srcAbs, e.name);
    const d = path.join(destAbs, e.name);
    if (e.isDirectory()) await copyDir(s, d);
    else await fs.copyFile(s, d);
  }
}

export async function demo() {
  const exampleAbs = path.join(kitRoot, ...EXAMPLE_REL);
  if (!(await isDir(exampleAbs))) {
    die(`Demo example not found at ${EXAMPLE_REL.join("/")}/ — if you installed this kit ` +
      `via npm, please report this (the packaged files list should include it).`);
  }

  const demoDir = path.join(os.tmpdir(), `ai-fication-demo-${Date.now()}`);
  await copyDir(exampleAbs, demoDir);

  const flags = { yes: true };
  const profile = await orient(demoDir, flags);
  await fs.mkdir(path.join(demoDir, "ai"), { recursive: true });
  await fs.writeFile(path.join(demoDir, "ai", "repo-profile.json"),
    JSON.stringify(profile, null, 2) + "\n", "utf8");
  await install(demoDir, profile, flags);

  info("");
  info(style.bold("Demo repo created:") + " " + demoDir);
  info("");
  info("What just got created there:");
  info(`  1. ${style.dim("ai/repo-profile.json")}     — detected stack facts (pure file inspection)`);
  info(`  2. ${style.dim("ai/guide/, ai/analysis/")}   — the knowledge-layer scaffold (starts empty/[inferred])`);
  info(`  3. ${style.dim("CLAUDE.md, AGENTS.md")}      — stamped agent instructions, pointing at ai/`);
  info(`  4. ${style.dim(".claude/ commands")}         — /cold-start and friends, ready to run`);
  info(`  5. ${style.dim("ai/install-manifest.json")}  — exact record of what was written (for uninstall)`);
  info("");
  info("Next: open it in your agent and run " + style.bold("/cold-start") + " to see the map get drafted.");
  info("");
  info("When you're done: " + style.dim(`rm -rf "${demoDir}"`));
  info("");
}
