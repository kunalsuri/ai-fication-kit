// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// status — one-command health snapshot. Combines verify's and drift's core
// scans (in-process, structural only — never git) with a MODULE_MAP row/date
// read, and reduces it all to one verdict line. No writes unless --json.

import { promises as fs } from "node:fs";
import path from "node:path";
import { KIT_VERSION, info, readText, style } from "./util.mjs";
import { MODULE_MAP_REL, parseModuleMap, computeDrift } from "./drift.mjs";
import { computeVerification } from "./verify.mjs";
import { refreshProgressPage } from "./progress.mjs";

const STATUS_JSON_REL = ["ai", "analysis", "audit-reports", "STATUS.json"];

// Thresholds — documented here, not buried in the verdict logic below.
// A stale audit (no re-check in this many days) keeps the verdict out of
// TRUSTED even when every row is [verified] and nothing is broken.
const STALE_AUDIT_DAYS = 90;

function newestAuditDate(mapText) {
  let newest = null;
  for (const m of mapText.matchAll(/\[verified\]\s*\((\d{2})\/(\d{2})\/(\d{4})/g)) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    if (!newest || d > newest) newest = d;
  }
  return newest;
}

// Pure compute — no console output, no writes (verify/drift's own compute
// functions are pure; the MODULE_MAP read here is a read-only fs call).
export async function computeStatus(targetAbs) {
  const mapPath = path.join(targetAbs, ...MODULE_MAP_REL);
  const mapText = await readText(mapPath);

  let rows = { verified: 0, inferred: 0, unknown: 0 };
  let daysSinceAudit = null;
  if (mapText !== null) {
    const parsed = parseModuleMap(mapText);
    for (const row of parsed.rows) {
      if (row.status === "verified") rows.verified++;
      else if (row.status === "inferred") rows.inferred++;
      else rows.unknown++;
    }
    const newest = newestAuditDate(mapText);
    if (newest) daysSinceAudit = Math.floor((Date.now() - newest.getTime()) / 86400000);
  }

  const verification = await computeVerification(targetAbs);
  const drift = await computeDrift(targetAbs, { git: false }); // structural only, never git

  const brokenClaims = verification ? verification.moved + verification.missing : 0;
  const driftItems = drift ? drift.unmapped.length + drift.vanished.length + drift.stale.length : 0;

  let verdict;
  if (brokenClaims > 0 || driftItems > 0) {
    verdict = "DRIFTING";
  } else if (mapText === null || rows.inferred > 0 || rows.unknown > 0 ||
    (daysSinceAudit !== null && daysSinceAudit > STALE_AUDIT_DAYS)) {
    verdict = "NEEDS AUDIT";
  } else {
    verdict = "TRUSTED";
  }

  const badgeColor = verdict === "TRUSTED" ? "brightgreen" : verdict === "NEEDS AUDIT" ? "yellow" : "red";

  return {
    hasModuleMap: mapText !== null,
    rows,
    daysSinceAudit,
    verification: verification
      ? { confirmed: verification.confirmed, moved: verification.moved, missing: verification.missing }
      : null,
    drift: drift ? { unmapped: drift.unmapped.length, vanished: drift.vanished.length, stale: drift.stale.length } : null,
    brokenClaims,
    driftItems,
    verdict,
    badge: { schemaVersion: 1, label: "ai-ready", message: verdict.toLowerCase(), color: badgeColor },
  };
}

export function printStatusReport(result) {
  const verdictColor = result.verdict === "TRUSTED" ? style.green
    : result.verdict === "NEEDS AUDIT" ? style.amber : style.red;
  info("");
  info(style.bold("ai-fication-kit status"));
  info("");
  if (result.hasModuleMap) {
    info(`  MODULE_MAP rows:   ${result.rows.verified} [verified], ${result.rows.inferred} [inferred]` +
      (result.rows.unknown ? `, ${result.rows.unknown} unaudited` : ""));
    info(`  Last audit:        ${result.daysSinceAudit === null ? "unknown" : `${result.daysSinceAudit} day(s) ago`}`);
  } else {
    info(`  MODULE_MAP rows:   ai/guide/MODULE_MAP.md not found`);
  }
  info(`  Broken claims:     ${result.brokenClaims}` + (result.verification ? "" : " (verify has never run)"));
  info(`  Drift items:       ${result.driftItems}` + (result.drift ? "" : " (no MODULE_MAP.md to scan)"));
  info("");
  info("  Verdict: " + verdictColor(style.bold(result.verdict)));
  info("");
}

export async function status(targetAbs, flags) {
  const result = await computeStatus(targetAbs);
  printStatusReport(result);
  if (flags.json) {
    const dir = path.join(targetAbs, ...STATUS_JSON_REL.slice(0, -1));
    await fs.mkdir(dir, { recursive: true });
    const payload = { kitVersion: KIT_VERSION, generated: new Date().toISOString(), ...result };
    await fs.writeFile(path.join(targetAbs, ...STATUS_JSON_REL), JSON.stringify(payload, null, 2) + "\n", "utf8");
    info(`✓ Wrote ${STATUS_JSON_REL.join("/")}`);
  }
  await refreshProgressPage(targetAbs);
}
