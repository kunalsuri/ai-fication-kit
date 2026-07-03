---
description: Diagnostic gate that checks CLAUDE.md and AGENTS.md for completeness, consistency, and stale artifacts — run right after /cold-start and before /add-feature. Read-only; produces a findings report.
---
<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->

Run the **review-agent-config** diagnostic. Read-only. Produce a structured findings
report; do NOT edit any file.

1. **Read only these inputs:** `CLAUDE.md` (full), `AGENTS.md` (full), `package.json`
   (grep `"build"`/`"test"` script keys only), `pom.xml` if present (grep `<build>`
   section only), `ai/guide/MODULE_MAP.md` and `ai/INDEX.md` (existence check only),
   and any `ai/guide/*.md` paths referenced in the knowledge-map sections (existence
   check only).
2. **Check Section A — CLAUDE.md structure:**
   - C1 ❌ Contains the literal `@AGENTS.md` directive (not just a comment or a markdown link)
   - C2 ❌ Has a "Hard rules" or equivalent section
   - C3 ❌ Has a "Where to look"/knowledge-map section pointing into `ai/guide/`
   - C4 ⚠️ Has a token-discipline or subagent-delegation section
   - C5 ❌ No unfilled placeholders: `<[a-zA-Z ]{3,}>`, bare `TODO`, or literal `fill in`
   - C6 ❌ Build command present and not a placeholder
   - C7 ❌ Test command present and not a placeholder
   - C8 ❌ Test locations filled in (not `<fill in during cold start>` or equivalent)
   - C9 ⚠️ No reference to `CLAUDE_bkp_*.md` framed as active guidance (stale post-cold-start)
   - C10 ⚠️ No Claude-specific directives duplicated wholesale from AGENTS.md
3. **Check Section B — AGENTS.md structure:**
   - A1 ⚠️ Contains no tool-specific directives (`@import`, memory syntax, hook syntax)
   - A2 ❌ Hard rule: frozen upstream / don't touch inherited code
   - A3 ❌ Hard rule: test before done — with actual build and test commands
   - A4 ❌ Hard rule: surgical diffs
   - A5 ❌ Hard rule: provenance tagging (`[inferred]` / `[verified]`)
   - A6 ❌ Hard rule: no phantom bugs / config churn
   - A7 ❌ Hard rule: verify claims before declaring done
   - A8 ⚠️ Hard rule: license-header matching for new files
   - A9 ❌ Has a knowledge-map section pointing to `ai/guide/`
   - A10 ❌ No unfilled placeholders (same regex as C5)
   - A11 ⚠️ No reference to `AGENTS_bkp_*.md` framed as active guidance
4. **Check Section C — cross-file consistency:**
   - X1 ❌ Build command in CLAUDE.md matches AGENTS.md
   - X2 ❌ Test command in CLAUDE.md matches AGENTS.md
   - X3 ⚠️ Build/test commands match what `package.json`/`pom.xml` actually define
   - X4 ❌ At least one `ai/guide/` path in any knowledge-map section resolves on disk
   - X5 ❌ No rule in CLAUDE.md directly contradicts a rule in AGENTS.md
   - X6 ⚠️ "Repo intelligence"/ai-layer description is not copy-pasted verbatim into both files
5. **Emit the report directly to the user** (do NOT write a file), in this structure:
   ```
   review-agent-config — findings
   ══════════════════════════════════════════════════

   CLAUDE.md
   ─────────
   ✅/⚠️/❌  <check ID> <check name>
              → <one-line concrete fix>   ← omit this line for ✅

   AGENTS.md
   ─────────
   ✅/⚠️/❌  <check ID> <check name>
              → <one-line concrete fix>

   Cross-file
   ──────────
   ✅/⚠️/❌  <check ID> <check name>
              → <one-line concrete fix>

   Summary
   ───────
   X passed · Y warnings · Z errors
   Next step: <single highest-priority action — one sentence>
   ```
6. **Reporting discipline:** report every check, not just failures. For every ❌ or
   ⚠️, give a concrete one-line fix naming the exact line/section to change. "Next
   step" names only the single highest-priority action.
7. **Out of scope for this workflow:** do not auto-edit CLAUDE.md or AGENTS.md; do
   not check `ai/guide/` content quality (that's `/post-cold-start-verification`);
   do not assess overall AI-layer maturity (that's `/verify-ai-readiness`); do not
   run builds or tests.
