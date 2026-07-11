// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// migrations — the declarative registry of template relocations between kit
// versions. When a release renames or moves an installed file, add one row
// here; the installer's obsolete-file pass uses it to tell the user WHERE the
// replacement went instead of just "this file is no longer shipped".
//
// Deliberately data, not code: a migration can only describe a rename, never
// run arbitrary logic — that keeps update runs deterministic and auditable.
// Deletion of the old path still follows the normal obsolete-file rules
// (hash-proven kit-owned + explicit interactive consent; edited files are
// never touched).

/** @type {{ sinceVersion: string, from: string, to: string }[]}
 * Paths are install-relative with forward slashes (manifest convention).
 * Example (for a future release):
 *   { sinceVersion: "0.3.0", from: "ai/guide/OLD_NAME.md", to: "ai/guide/NEW_NAME.md" }
 */
export const RENAMES = [
  // v0.4.0 — Claude Code merged custom commands into skills, so the kit ships the
  // Claude surface as .claude/skills/<name>/SKILL.md instead of .claude/commands/<name>.md.
  // (Cursor/Copilot/Antigravity surfaces are unchanged.)
  { sinceVersion: "0.4.0", from: ".claude/commands/add-feature.md", to: ".claude/skills/add-feature/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/fix-bug.md", to: ".claude/skills/fix-bug/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/cold-start.md", to: ".claude/skills/cold-start/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/review-change.md", to: ".claude/skills/review-change/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/check-drift.md", to: ".claude/skills/check-drift/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/create-feature-catalog.md", to: ".claude/skills/create-feature-catalog/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/adversarial-audit.md", to: ".claude/skills/adversarial-audit/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/review-agent-config.md", to: ".claude/skills/review-agent-config/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/post-cold-start-verification.md", to: ".claude/skills/post-cold-start-verification/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/verify-ai-readiness.md", to: ".claude/skills/verify-ai-readiness/SKILL.md" },
  { sinceVersion: "0.4.0", from: ".claude/commands/perform-feature-add-simulation.md", to: ".claude/skills/perform-feature-add-simulation/SKILL.md" },
];

/** Where rel's replacement lives in the current kit version, or null when the
 * file was removed outright (no successor). */
export function renameTargetFor(rel) {
  const hit = RENAMES.find(r => r.from === rel);
  return hit ? hit.to : null;
}
