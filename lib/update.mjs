// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// update — the deterministic brain behind "shazam on an already-installed repo".
// Everything here is hashes, semver comparison, and CHANGELOG.md parsing: no
// heuristics, no LLM, no network. The module answers four questions:
//   1. What version is installed, and when? (readInstallManifest)
//   2. How does it relate to the running kit? (compareSemver)
//   3. What changed in between?              (parseChangelog / changelogDigest)
//   4. Is the repo healthier after the update than before? (health snapshot
//      helpers reusing status.mjs's pure computeStatus)
// The file-level truth (which files get refreshed / kept / locked) stays where
// it always lived: classifyAction in lib/installer.mjs.

import path from "node:path";
import { KIT_VERSION, MANIFEST_REL, info, readText, style } from "./util.mjs";
import { kitRoot } from "./util.mjs";
import { computeStatus } from "./status.mjs";

/** Reads and parses ai/install-manifest.json. Returns null when absent/corrupt. */
export async function readInstallManifest(targetAbs) {
  const text = await readText(path.join(targetAbs, MANIFEST_REL));
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Numeric x.y.z comparison: negative when a < b, 0 when equal, positive when a > b.
 * Unknown/malformed versions compare as 0.0.0 (older than everything real). */
export function compareSemver(a, b) {
  const parse = (v) => {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? ""));
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  };
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  return (a1 - b1) || (a2 - b2) || (a3 - b3);
}

// How much of a changelog bullet the digest shows. Headline = the bold lead-in
// before the first " — " (how CHANGELOG.md entries are written here); longer
// free-form bullets are truncated to this many characters.
const HEADLINE_MAX = 88;
// Cap per version so a huge release doesn't scroll the plan off screen.
const BULLETS_PER_VERSION = 12;

/** Parses a Keep-a-Changelog document into ordered release entries:
 * [{ version, date, bullets: [{ category, headline }] }], newest first.
 * Only released sections (## [x.y.z]) count — [Unreleased] is skipped, and
 * only top-level bullets ("- " at column 0) become headlines. Pure text work. */
export function parseChangelog(text) {
  const releases = [];
  let current = null;
  let category = "";
  for (const line of String(text ?? "").split("\n")) {
    const section = /^## \[([^\]]+)\](?:\s*[—–-]\s*(\S+))?/.exec(line);
    if (section) {
      current = /^\d+\.\d+\.\d+$/.test(section[1])
        ? { version: section[1], date: section[2] ?? "", bullets: [] }
        : null; // [Unreleased] or anything non-semver
      if (current) releases.push(current);
      category = "";
      continue;
    }
    if (!current) continue;
    const cat = /^### (\w+)/.exec(line);
    if (cat) { category = cat[1]; continue; }
    if (line.startsWith("- ")) {
      const flat = line.slice(2).replace(/\*\*/g, "").trim();
      const cut = flat.indexOf(" — ");
      let headline = cut > 0 ? flat.slice(0, cut) : flat;
      if (headline.length > HEADLINE_MAX) headline = headline.slice(0, HEADLINE_MAX - 1) + "…";
      current.bullets.push({ category, headline });
    }
  }
  return releases;
}

/** Releases strictly newer than fromVersion and no newer than toVersion,
 * oldest first — exactly the versions the user is jumping across. */
export function changelogDigest(releases, fromVersion, toVersion) {
  return releases
    .filter(r => compareSemver(r.version, fromVersion) > 0 && compareSemver(r.version, toVersion) <= 0)
    .sort((a, b) => compareSemver(a.version, b.version));
}

/** Loads the kit's own CHANGELOG.md (shipped in the npm package). Null if absent. */
export async function readKitChangelog() {
  const text = await readText(path.join(kitRoot, "CHANGELOG.md"));
  return text === null ? null : parseChangelog(text);
}

function fmtDate(iso) {
  return typeof iso === "string" && iso.length >= 10 ? iso.slice(0, 10) : "unknown";
}

/** Prints the update-mode header: version transition, install dates, and the
 * changelog digest for every version being jumped across. Read-only. */
export async function printUpdateHeader(prevManifest) {
  const from = prevManifest.kitVersion ?? null;
  const cmp = compareSemver(from ?? "0.0.0", KIT_VERSION);
  const transition = from === KIT_VERSION
    ? `already on v${KIT_VERSION} — checking your install for new/repairable files`
    : `v${from ?? "unknown"} → v${KIT_VERSION}`;
  info("  " + style.amber("⚡ shazam") + style.gray(" — update mode: ") + style.bold(transition));
  const first = fmtDate(prevManifest.firstInstalled ?? prevManifest.installed);
  const last = fmtDate(prevManifest.installed);
  info("     " + style.gray(`first installed ${first} · last updated ${last}` +
    (from ? ` (v${from})` : "")));

  if (from === KIT_VERSION || cmp > 0) return; // same version or downgrade: no digest
  const releases = await readKitChangelog();
  if (releases === null) {
    info("     " + style.gray("(CHANGELOG.md not found in this kit copy — skipping the what-changed digest)"));
    return;
  }
  const digest = changelogDigest(releases, from ?? "0.0.0", KIT_VERSION);
  if (!digest.length) return;
  info("");
  info("  " + style.bold(`What changed since v${from ?? "your install"}:`));
  for (const rel of digest) {
    info(`    ${style.coral(`v${rel.version}`)}${rel.date ? style.gray(` (${rel.date})`) : ""}`);
    for (const b of rel.bullets.slice(0, BULLETS_PER_VERSION)) {
      const cat = b.category ? style.gray(b.category.padEnd(7)) : style.gray(" ".repeat(7));
      info(`      ${cat} · ${b.headline}`);
    }
    if (rel.bullets.length > BULLETS_PER_VERSION) {
      info(style.gray(`              … and ${rel.bullets.length - BULLETS_PER_VERSION} more — see CHANGELOG.md`));
    }
  }
}

/** Read-only health snapshot (verdict + broken claims + drift items) reusing
 * status.mjs's pure compute. Used before and after an update so the run can
 * prove it left the repo no worse than it found it. */
export async function healthSnapshot(targetAbs) {
  return computeStatus(targetAbs);
}

export function printPreflight(snap) {
  info("");
  info("  " + style.gray("Preflight (read-only): ") +
    `verdict ${style.bold(snap.verdict)} · ${snap.brokenClaims} broken claim(s) · ${snap.driftItems} drift item(s)`);
}

/** Compares post-update health to preflight and reports. Returns true when the
 * repo is no worse than before (the update's success criterion). */
export function printPostflight(pre, post) {
  const worse = post.brokenClaims > pre.brokenClaims || post.driftItems > pre.driftItems;
  const verdictNote = post.verdict === pre.verdict ? `${post.verdict} (unchanged)` : `${pre.verdict} → ${post.verdict}`;
  info("");
  if (worse) {
    info("  " + style.amber("⚠ Postflight: ") + `verdict ${verdictNote} · ` +
      `broken claims ${pre.brokenClaims} → ${post.brokenClaims} · drift items ${pre.driftItems} → ${post.driftItems}`);
    info("    " + style.amber("The update left more open findings than before. Nothing was lost —"));
    info("    " + style.amber("edited files were kept and overwrites were backed up. Run:"));
    info("      node install.mjs verify <repo> --strict   (which claims broke)");
    info("      node install.mjs drift  <repo>            (what the map no longer covers)");
  } else {
    info("  " + style.green("✓ Postflight: ") + `verdict ${verdictNote} · ` +
      `${post.brokenClaims} broken claim(s) · ${post.driftItems} drift item(s) — no worse than preflight`);
  }
  return !worse;
}
