// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// doctor — read-only "what do I do next?" stage detector. Five workflow stages
// are all mechanically detectable from files already on disk; this command
// finds the first one whose condition holds and prints the exact next step in
// plain language. Writes nothing, ever.

import path from "node:path";
import { PROFILE_REL, info, isFile, readText, style } from "./util.mjs";
import { MODULE_MAP_REL, MODULE_MAP_PLACEHOLDER, parseModuleMap } from "./drift.mjs";

const VERIFY_MANIFEST_REL = ["ai", "analysis", "audit-reports", "VERIFICATION_MANIFEST.json"];
const DRIFT_MANIFEST_REL = ["ai", "analysis", "audit-reports", "DRIFT_MANIFEST.json"];

async function readJson(abs) {
  const text = await readText(abs);
  if (text === null) return null;
  try { return JSON.parse(text); } catch { return null; }
}

// Returns the doctor's diagnosis: { step, diagnosis, action }. Pure file reads.
export async function diagnose(targetAbs) {
  // Step 1: no ai/repo-profile.json.
  const profilePath = path.join(targetAbs, PROFILE_REL);
  if (!(await isFile(profilePath))) {
    return {
      step: 1,
      diagnosis: "You haven't scanned this repository yet.",
      action: `node install.mjs shazam ${targetAbs}`,
    };
  }

  // Step 2: MODULE_MAP.md missing, or still the scaffolded template.
  const mapPath = path.join(targetAbs, ...MODULE_MAP_REL);
  const mapText = await readText(mapPath);
  if (mapText === null || mapText.includes(MODULE_MAP_PLACEHOLDER)) {
    return {
      step: 2,
      diagnosis: mapText === null
        ? "The kit is installed, but ai/guide/MODULE_MAP.md doesn't exist yet."
        : "ai/guide/MODULE_MAP.md is still the empty scaffolded template.",
      action: "Run /cold-start in your agent (it fills in ai/guide/MODULE_MAP.md).",
    };
  }

  // Step 3: MODULE_MAP has [inferred] rows awaiting a human audit.
  const { rows } = parseModuleMap(mapText);
  const inferredRows = rows.filter(r => r.status === "inferred");
  if (inferredRows.length) {
    return {
      step: 3,
      diagnosis: `ai/guide/MODULE_MAP.md has ${inferredRows.length} row(s) still ` +
        "tagged [inferred] — drafted, but not yet confirmed by a human.",
      action: "Do a human audit: see docs/AUDIT-GUIDE.md (or run the audit command, once available).",
    };
  }

  // Step 4: no verification/drift manifests, or the latest ones recorded failures.
  const verifyManifest = await readJson(path.join(targetAbs, ...VERIFY_MANIFEST_REL));
  const driftManifest = await readJson(path.join(targetAbs, ...DRIFT_MANIFEST_REL));
  const verifyBad = !verifyManifest || (verifyManifest.summary?.moved ?? 0) + (verifyManifest.summary?.missing ?? 0) > 0;
  const driftBad = !driftManifest ||
    (driftManifest.summary?.unmapped ?? 0) + (driftManifest.summary?.vanished ?? 0) + (driftManifest.summary?.stale ?? 0) > 0;
  if (verifyBad || driftBad) {
    const missing = [];
    if (!verifyManifest) missing.push("verify has never been run");
    else if (verifyBad) missing.push("verify found unconfirmed claims");
    if (!driftManifest) missing.push("drift has never been run");
    else if (driftBad) missing.push("drift found unmapped/vanished/stale items");
    return {
      step: 4,
      diagnosis: missing.join("; ") + ".",
      action: `node install.mjs verify ${targetAbs} --strict  (then)  node install.mjs drift ${targetAbs} --strict`,
    };
  }

  // Step 5: all rows [verified], manifests clean.
  return {
    step: 5,
    diagnosis: "Every ai/guide/MODULE_MAP.md row is [verified], and the last verify/drift runs found nothing wrong.",
    action: "Your map is trusted — you're in maintenance mode. Re-run drift after big changes.",
  };
}

export function printDoctorReport(result) {
  info("");
  info(style.bold(`You are at step ${result.step} of 5.`));
  info(result.diagnosis);
  info("");
  info(style.bold("Next: ") + result.action);
  info("");
}
