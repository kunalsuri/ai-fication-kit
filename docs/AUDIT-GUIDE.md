<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# The 30-minute audit — a field guide

The kit's whole promise rests on one human act: you reading the agent's draft and
signing what's true. The `[inferred]` → `[verified]` flip is your signature; this
guide makes the signing concrete. Time-box it — thirty minutes of focused judgement
beats three hours of skimming.

## What you are auditing

After `/cold-start`, three kinds of claims carry `[inferred]` tags:

1. **`ai/guide/MODULE_MAP.md` rows** — directory, one-line responsibility, entry
   point, and a Stability guess. *This is the one that matters most:* Stability is
   what gates every future agent edit.
2. **Build/test commands** stamped into `CLAUDE.md` / `AGENTS.md` (detected by
   `orient`, possibly refined by the agent).
3. **Prose claims** in `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `FEATURE_MAP.md`.

Work them in that order. If you only have ten minutes, audit the module map.

## Deciding Stability — the questions to ask per row

**`frozen` — hands off.** Say `frozen` when any of these is true:
- The code is inherited from an upstream fork, a vendor, or a departed team.
- It is load-bearing and you could not confidently review a diff against it.
- It is generated output that a tool will overwrite.

**`stable` — change carefully, with tests.** It works, it has (some) tests, you
could review a diff against it, but it is not where new work should land by default.

**`ours` — the active development surface.** You (or your team) wrote it or own it
now, you understand its tests, and you expect agents to modify it routinely.

**`?` — leave it.** Not sure? Leave the `?`. Agents treat `?` as `frozen`, so an
unaudited row is safe by construction. Never resolve a `?` just to make the table
look finished.

**The costs are asymmetric.** A wrong `frozen` costs you an occasional "the agent
refused to touch X" and a follow-up approval. A wrong `ours` lets an agent edit
load-bearing code it doesn't understand. When torn between two values, pick the
more conservative one.

## The evidence bar for flipping `[inferred]` → `[verified]`

Flip a tag only after at least one of:
- You **opened the entry-point file** and the responsibility line matches what you read.
- You **ran the stated command** (build/test) and watched it succeed.
- You **already know this module first-hand** — you've shipped changes to it.

"Sounds plausible" is not evidence; plausible is exactly what a model is best at
producing. Add the date when you flip: `[verified] (2026-06-12)`.

## Three worked rows

| Directory | Responsibility (one line) | Entry point | Stability |
|---|---|---|---|
| `legacy-billing/` | Invoice generation inherited from the v1 system | `BillingMain.java` | frozen |
| `src/notifications/` | Email/webhook dispatch; we wrote it last year | `dispatcher.ts` | ours |
| `etl/` | Nightly data sync — runs in prod, author left, no tests | `sync.py` | ? → frozen |

Reasoning, row by row:
- **`legacy-billing/`** — the agent guessed `frozen` because the git history is old
  and the style differs from the rest. You confirm: nobody on the team can review a
  billing diff. Flip to `[verified]`, keep `frozen`.
- **`src/notifications/`** — you shipped code here last month; the entry point and
  responsibility line match what you know. First-hand knowledge: flip to
  `[verified]`, set `ours`.
- **`etl/`** — it *works*, which tempts you toward `stable`. But no tests and no
  owner means you could not catch a bad agent diff. Leave it `?` (or set `frozen`
  explicitly); either way agents will not touch it without asking you.

## Common mistakes

1. **Verifying by vibes.** Reading the agent's confident summary and nodding is not
   an audit. Open the file, run the command, or leave the tag alone.
2. **Marking too much `ours`.** Generosity here is how agents end up "improving"
   code nobody dares review. `ours` should be the smallest of the three sets in any
   legacy repo.
3. **Auditing once, forever.** Code moves. Re-run `/post-cold-start-verification`
   after big merges; it flags rows whose paths no longer exist.
4. **Letting the agent "help" with the flip.** If you ever find a `[verified]` tag
   you didn't write, treat it as a bug in your process: agents are instructed never
   to flip tags, and the instruction only means something if you enforce it.

## When you're done

- Set the "Last verified" line at the top of `MODULE_MAP.md` (date + commit sha).
- Optionally run `/verify-ai-readiness` — a Level 3 rating ("Verified") is the
  minimum bar before letting an agent build features.
- Before the first real feature, consider `/perform-feature-add-simulation` — it
  pressure-tests your audit without writing a line of code.

## Visualizing the End State

Here is what the primary artifacts should look like after a successful cold start and your human audit:

### 1. Audited `MODULE_MAP.md` Example
Notice how Stability is set, rows are verified with dates, and the unaudited row defaults to `?` (which agents treat as `frozen`):

```markdown
# Module map — directory → responsibility → entry point

> Last verified: 2026-06-12 @ commit a1b2c3d4

| Directory | Responsibility (one line) | Entry point | Stability | Status / Provenance |
|---|---|---|---|---|
| `src/auth/` | JWT token validation and local storage | `authService.ts` | stable | [verified] (2026-06-12) |
| `src/components/` | Reusable shared UI layout components | `index.ts` | ours | [verified] (2026-06-12) |
| `legacy-billing/` | Old invoice generation backend module | `BillingMain.java` | frozen | [verified] (2026-06-12) |
| `src/analytics/` | Event tracking dashboard logic | `tracker.ts` | ? | [inferred] |
```

### 2. Generated `FEATURE_CATALOG.md` Example
This file is generated automatically by `/create-feature-catalog` and maps the full touch list of features across layers:

```markdown
# Feature Catalog — Master Index

## §1 Feature Index
| ID | Feature | What it does | Backend Entry Point | Frontend Entry Point | Status |
|---|---|---|---|---|---|
| F1 | **User Auth** | Authenticate users via email/pass | `authController.ts` | `LoginForm.tsx` | [verified] |
| F2 | **Invoice Export** | Download billing PDF history | `invoicePdfGenerator.java` | `BillingHistory.tsx` | [inferred] |

## §3 Full-Stack Touch Lists
### F1 — User Auth
| What to change | File / Component | Confidence |
|---|---|---|
| UI Page | `frontend/src/pages/Login.tsx` | [verified] |
| Service logic | `backend/src/services/auth.ts` | [verified] |
| DB Schema | `backend/src/models/user.ts` | [verified] |
```

