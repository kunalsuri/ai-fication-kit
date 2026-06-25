<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# Conventions — how to write code that fits ai-fication-kit

> [!NOTE]
> **This is a scaffolded template.** Run the `/cold-start` slash command in Claude Code (or see [docs/FAQ.md#cursor-copilot-codex](../../docs/FAQ.md#cursor-copilot-codex) for other tools) to have the agent explore your repository and automatically populate this file.

> Status: skeleton (2026-06-17). /cold-start drafts observations `[inferred]`; humans
> confirm and add the rules that live only in heads.

## Languages & style  `[inferred]`
- JavaScript/TypeScript
- <formatter/linter and config file, if found>

## Patterns to follow  `[inferred]`
<2–6 bullets: error handling, naming, layering, DI, test placement — each pointing to
one exemplar file an agent can imitate.>

## Things that look wrong but are right  `[verified] required`
<Only humans add rows. The institutional knowledge that prevents "helpful" breakage.>

## Definition of done
- Builds: `npm install`
- Tests pass: `npm test`
- License headers match neighbors; diffs are surgical; ai/ knowledge updated if the
  change moved or added modules/features.
