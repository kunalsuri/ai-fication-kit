<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Drift Detection Blindspots and Automation Bias

## Metadata

| Field | Value |
|---|---|
| **Timestamp** | 2026-06-30T21:40:11+02:00 |
| **Category** | Codebase Drift / Automation Bias |

This document records key lessons learnt about the limitations of mechanical repo intelligence tools and the risks of automation bias during repository audits.

## Context

When running verification and drift checks via the `check-drift` slash command, the automated tools reported zero errors/warnings. However, the repository maps (`MODULE_MAP.md`) were actually missing critical information about a newly added script: `test/run-deep-test.mjs`.

## 1. Mechanical Blindspots in Drift Detection

The mechanical checks (`verify` and `drift`) have specific design trade-offs that create blindspots:

- **Directory-Level Mapping in `drift`**:
  `drift` scans directory segments. If a directory (e.g., `test/`) is already mapped via one row in `MODULE_MAP.md` (e.g., quoting `test/run-tests.mjs`), the top-level segment `"test"` is marked as mapped. Any other new files or scripts added inside that directory (such as `test/run-deep-test.mjs`) are ignored by the `drift` command.
- **Ignored Folders**:
  Directories like `.claude/` or `.github/` are in the drift ignored list or contain non-source extensions, meaning changes to commands or workflows inside them are never flagged as unmapped by the script.
- **Forward-Only Checking in `verify`**:
  `verify` is a path-existence checker. It verifies that every file path quoted in the documentation exists on disk (forward references). It does not perform reverse reference checking (checking if files on disk are quoted in the documentation).

## 2. Automation Bias

As an AI agent, relying purely on the green/successful output of CLI tools can lead to "tool blindness." If `verify` and `drift` report success, an agent might conclude that the documentation maps are perfectly up-to-date and complete, failing to inspect git status or the actual directory tree for new additions.

## 3. Solution: Procedural Safeguard (Option B)

To prevent these blindspots from leading to stale documentation:

1. Updated [.claude/commands/check-drift.md](../../.claude/commands/check-drift.md) and its source template [templates/claude/commands/check-drift.md](../../templates/claude/commands/check-drift.md) to explicitly direct agents to run `git status`.
2. Instructed agents to cross-reference untracked/modified files in `git status` with `MODULE_MAP.md` and `FEATURE_MAP.md` to ensure any new scripts, workflows, or commands are properly mapped.
