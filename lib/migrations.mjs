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
export const RENAMES = [];

/** Where rel's replacement lives in the current kit version, or null when the
 * file was removed outright (no successor). */
export function renameTargetFor(rel) {
  const hit = RENAMES.find(r => r.from === rel);
  return hit ? hit.to : null;
}
