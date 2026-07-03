// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// progress — regenerates the ai/START-HERE.html "living progress page" from
// live data (never the static shell — that is stamped once by install(), the
// same as any other template). Called at the end of install/verify/drift/
// status/audit. A no-op if the page doesn't exist (never installed, or the
// user deleted it) or doesn't carry the expected data block — this is a
// nice-to-have dashboard, never something a command should fail over.
//
// Uses dynamic imports for the compute functions on purpose: install.mjs /
// verify.mjs / drift.mjs / status.mjs / audit.mjs all import
// refreshProgressPage statically, and this module needs their compute
// functions — a static import here would create an import cycle. Dynamic
// imports resolve at call time, when every module is already loaded, so the
// cycle never has to be resolved by the module loader.

import { promises as fs } from "node:fs";
import path from "node:path";
import { readText } from "./util.mjs";

const PROGRESS_PAGE_REL = ["ai", "START-HERE.html"];
const DATA_BLOCK_RE = /(<script id="progress-data" type="application\/json">)[\s\S]*?(<\/script>)/;

export async function refreshProgressPage(targetAbs) {
  const dest = path.join(targetAbs, ...PROGRESS_PAGE_REL);
  const existing = await readText(dest);
  if (existing === null || !DATA_BLOCK_RE.test(existing)) return;

  const { computeStatus } = await import("./status.mjs");
  const { diagnose } = await import("./doctor.mjs");
  const status = await computeStatus(targetAbs);
  const doctor = await diagnose(targetAbs);

  const data = {
    generated: new Date().toISOString(),
    doctorStep: doctor.step,
    doctorDiagnosis: doctor.diagnosis,
    doctorAction: doctor.action,
    rows: status.rows,
    brokenClaims: status.verification ? status.brokenClaims : null,
    driftItems: status.drift ? status.driftItems : null,
    verdict: status.verdict,
  };

  const updated = existing.replace(DATA_BLOCK_RE, (_m, open, close) => open + JSON.stringify(data) + close);
  await fs.writeFile(dest, updated, "utf8");
}
