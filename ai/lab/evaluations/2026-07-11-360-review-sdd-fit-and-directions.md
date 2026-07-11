<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# EVAL: 360° review — SDD fit, repo-intelligence evidence, small-model enablement, future-proofing
> **Status:** `[inferred]` — AI-drafted research review; every claim below awaits the human audit
> **Author:** AI draft (research session, branch claude/aification-kit-review-4wvn3h) · **Date:** 2026-07-11
> **Method:** full internal read (README, `docs/METHODOLOGY.md`, `docs/IMPLEMENT-SPEC.md`, `ai/lab/ROADMAP.md`, `ai/lab/WORKLOG.md` W-001–W-034, specs, lessons-learnt) cross-examined against the July-2026 external landscape (GitHub Spec Kit, AWS Kiro, Tessl, OpenSpec/BMAD, IBM Bob, the ETH Zurich AGENTS.md evaluation, agent-memory and model-routing literature). External sources are linked in §8; none of their claims are re-verified first-hand.

---

## 0. The one-paragraph verdict

The kit is sound where the branded SDD tools are weak, and unproven exactly where it claims the most. Its three ideas — a human-verified map with provenance, a closed engineering loop with durable artifacts, and deterministic no-LLM verification — are each independently validated by where the field moved in 2025–2026. But the kit is **three products wearing one name**, its central quantitative claim (context savings on real repos) is still unmeasured by its own eval protocol, and the single most SDD-valuable component (`/implement-spec`) is still not shipped to target repos. The highest-leverage moves are measurement, promotion, and a ceremony ladder — not new features.

## 1. What the kit actually is: three planes, one name

The maintainer's own framing ("I'm doing many things at once and it can be confusing") is accurate, and the fix is naming, not re-architecture. The kit is three separable planes:

| Plane | Contents | Competes with / is compared to | Value independent of the others? |
|---|---|---|---|
| **The Map** (knowledge plane) | `ai/guide/`, `ai/INDEX.md`, `ai/repo-profile.json`, orient/indepth, verify/drift, provenance tags, Stability | AGENTS.md conventions, llms.txt, memory layers (Cognee, Mem0, Memorix) | Yes — onboarding + navigation alone |
| **The Loop** (process plane) | `ai/lab/` (specs, decisions, reviews, evaluations, `ai/lab/WORKLOG.md`), add-feature / fix-bug / implement-spec / review-change skills | GitHub Spec Kit, AWS Kiro, Tessl, OpenSpec, BMAD | Yes — SDD substrate alone |
| **The Stamp** (distribution plane) | `install.mjs` + `lib/`, templates ×4 tool surfaces, manifest, child-lock, update | Nothing directly — closest to a package manager for agent harnesses | Yes — but it is plumbing, not the pitch |

Almost every documented confusion (the README interleaving all three, the "eleven workflows" table mixing map-building with loop-running with diagnostics) traces to presenting the planes as one thing. **Recommendation R7:** restructure the README's top around the three planes, one sentence and one diagram each, then let each plane have its own depth section. The elevator pitch that survives all three: *a trust substrate for AI-agent work on brownfield repositories*.

## 2. Q1 — Is this a real SDD backbone? Yes, and it is the part the branded tools lack

The July-2026 SDD landscape, briefly: every major vendor shipped an SDD flavor (Spec Kit, Kiro, Tessl, OpenSpec, BMAD, Claude Code, Antigravity). The honest critique matured too — Fowler's tool review and the practitioner literature converge on four failure modes: **problem-size misfit** (Kiro generating 16 acceptance criteria for a bugfix), **iteration hostility** (upfront specs tax exploratory work), **brownfield weakness** (the tools assume the agent already understands the codebase), and the **"sea of markdown"** (specs rot after merge; "reinvented waterfall"). IBM's enterprise entry (Bob, updated 2026-07-09) frames the same premise from the top down: as agents take over implementation, output quality becomes proportional to instruction quality, and the platform's job is coordinating multi-agent work with model-to-task matching and cost analytics.

Where this kit stands in that field:

- **It is a substrate, not a ritual.** Spec Kit and Kiro own a spec *dialect* and a workflow UI; the kit owns what they all lack: durable artifact locations with provenance, mechanical link-checking (`verify` fails CI on a ledger row whose spec vanished), a fresh-context review gate, and an append-only ledger. Any spec dialect can sit on top. The maintainer's instinct — "online SDD skills need a background infrastructure" — is exactly right and is the defensible wedge.
- **It is brownfield-first.** The branded tools' weakest documented flank is legacy code; the kit's whole Step 0–5 pipeline (map before loop, audit before trust) is the missing precondition they skip. No other SDD tool has an answer to "the agent edits the wrong module because it never knew what was load-bearing."
- **It already anticipates the waterfall critique** — partially. The spec-vs-map split (specs are episodic, `ai/guide/FEATURE_MAP.md` is the living layer) is the correct answer to spec rot, and it is stated in `ai/lab/README.md`. But the loop as documented still implies the full artifact chain per unit of work, and the kit's own ledger shows reality diverging: W-004, W-007, W-009, W-017, W-025 all shipped with "no spec" or "review waived" annotations. Those waivers are honest, but they are ad-hoc.

**Gaps against the state of the art:**

1. **No ceremony ladder (R5, P1).** The loop needs an explicit spec-weight tier — e.g. *trivial* (WORKLOG row only), *small* (goal + touch list + test note inline), *full* (the whole `ai/lab/specs/SPEC_TEMPLATE.md` + review + eval). The template's scale-down comment (W-008) is guidance; the ladder should be a rule the skills enforce, so a waiver is a documented tier choice instead of a process violation. This pre-empts the exact failure mode that made Kiro's reviews longer than the code review it replaced.
2. **`/implement-spec` is not distributed (R2, P1).** It is the loop's execution engine and the model-tiering enabler, promotion-path proven in W-014, still local-only. Until it ships in templates, target repos get the SDD *filing cabinet* but not the SDD *engine*.
3. **Traceability is path-level, not requirement-level (R6, P3).** `verify` checks that artifacts exist; nothing checks that each acceptance criterion maps to a test ID and a commit. Kiro's requirement-to-task traceability is its one idea worth stealing — a review-stage checklist line ("each §7 criterion names the §6 test that proves it") would capture most of the value at zero tooling cost.
4. **Spec lifecycle vocabulary (R8, P3).** Add a terminal Status value (e.g. superseded) and state in the template that a shipped spec is frozen history — the living truth lives in the maps. This makes the anti-"sea of markdown" stance explicit instead of implicit.

## 3. Q2 — Does the repo intelligence actually help on complex codebases? Plausible, unproven, and now contested by published evidence

This is the question where the kit must be most honest with itself. The strongest published challenge is the ETH Zurich / LogicStar study ([arXiv 2602.11988](https://arxiv.org/abs/2602.11988), Feb 2026): across agents and models, repository context files **did not generally improve** task success on SWE-bench-style tasks, **added over 20% inference cost**, and — most pointedly — **repository overviews were unhelpful**, while **instruction-type content (build/test commands, non-standard practices) was followed and useful**.

Three reasons the kit is not refuted, and one reason it cannot claim victory:

1. **Distribution mismatch.** SWE-bench repos are popular OSS — in-distribution for frontier models, which need no map. The kit's target (legacy, private, polyglot, unfamiliar) is precisely the setting the study does not cover, and where priors are absent a verified map plausibly changes outcomes. This is a hypothesis, not a result.
2. **Navigational vs dumped context.** The study largely evaluates static context prepended to the session. The kit's architecture is deliberately the other thing: a thin root file, role→path manifest, locate-via-map-then-read, token-discipline rules. That is closer to the study's "instructions" (which worked) than its "overviews" (which did not). The kit should still audit its own templates against this finding: anything overview-shaped that is loaded unconditionally is cost without evidence; commands and constraints should stay first (roadmap C1 already touches the command-correctness half).
3. **Success-rate is not the only outcome.** The kit's claims include never-edit-frozen-code safety, cross-session consistency, audit cost, and human onboarding — none measured by SWE-bench. These need their own metrics: wrong-file-opens per task, Stability-violation rate, tokens-to-first-correct-edit, review-blocker rate.
4. **But the burden of proof is on the kit, by its own rules.** `ai/lab/evaluations/2026-06-15-value-demo-context-budget.md` Part B (live A/B, real tokens) is still marked not-yet-run; the headline 3.1×/68% figure is a deterministic byte proxy on a toy app, and the README's "30 minutes to a few hours to a trustworthy map" is unmeasured on the repo class the pitch leads with. W-020's full-stack simulation is excellent *process* validation (it found 10 real defects) but it measured the kit's mechanics, not the map's effect on task outcomes.

**Recommendation R1 (P1, the single most important item in this review):** run the live A/B on a mid-size repo the models do not know, with three arms — no `ai/` layer, `[inferred]`-only layer, human-`[verified]` layer. The third arm is the kit's unique claim (nobody else can even produce that arm), and the ETH study supplies both the methodology to borrow and the published null result to argue against. Report tokens, success, wrong-file-opens, and Stability violations. As a CEA LIST research artifact with a Zenodo DOI already minted, this is a publishable experiment — and if the result comes back null, better to learn it now and let the value story stand on safety, onboarding, and the loop (which the study does not test).

## 4. Q3 — Can it let smaller models build features? Yes — this is the kit's strongest emergent property

The 2026 field consensus is exactly the pattern the kit codified in `docs/dev/lessons-learnt/model-tiering-plan-heavy-implement-light.md`: an executive-worker split (frontier model for scoping/planning/critique, small models for execution) with roughly order-of-magnitude cost reduction; IBM Bob productizes the same idea as model-to-task matching with cost analytics.

The kit's contribution is that it makes the pattern *safe* rather than merely cheap. Small models' documented failure mode is not bad code but plausible-but-inconsistent judgement calls. The kit's constraint surface — implementation-grade spec (decisions pre-made), contractual touch list, stop-and-report rule (no silent improvisation), deterministic gates (`npm test`, `node install.mjs verify . --strict`, drift), and a fresh-context review that may run on a heavy model over a small diff — converts judgement failures into mechanically checkable ones. That is precisely the harness a light implementer needs, and no branded SDD tool ships it.

What is missing to make the claim real for adopters:

1. **Ship the engine (R2, shared with §2).** Without `/implement-spec` in templates, target repos cannot run the tiering pattern the docs describe.
2. **A deterministic spec-lint (R3, P2).** A no-LLM `speclint` check (seconds, stdlib-only — perfectly on-identity) that gates light-model implementation: constraints table present, touch list non-empty with Stability column, numbered test plan, out-of-scope section, no unresolved placeholders. `docs/IMPLEMENT-SPEC.md` §"what makes a spec implementation-grade" is prose today; make it a gate. Every gap it catches is one fewer human round-trip mid-implementation.
3. **Record the implementing model tier in the ledger (R4, P2 — one column).** `ai/lab/WORKLOG.md` rows do not capture which model class implemented the work. One cell (e.g. heavy-planned/light-implemented) turns the ledger into the local, no-telemetry equivalent of Bob's cost analytics and creates the dataset for the kit's own future eval: "what spec quality does a light model need before its review-blocker rate matches a heavy model's?"
4. **Route by the roadmap's existing Effort column.** `ai/lab/ROADMAP.md` already sizes features S/M/L; a one-line convention (S defaults to light model under `/implement-spec`; L plans heavy) operationalizes routing with zero new machinery.

## 5. Q4 — If SDD fades, does the kit survive? Yes, if it keeps betting on the substrate

SDD is a process fashion; the kit's durable core is process-agnostic, and it happens to align with where the research is converging:

- **The memory-kinds split holds up.** Semantic memory (`ai/guide/` — what the repo *is*), episodic memory (`ai/lab/` — what happened and why), procedural memory (the skills — how work is done) is the same taxonomy the 2026 agent-memory literature and the compounding-engineering pattern converged on. Any post-SDD process (continuous agent swarms, TDD-for-agents, intent-driven pipelines) still needs a trusted map, a ledger, and gates. The lab directory is a generic artifact store; specs are just one artifact type in it.
- **Keep process in skills, substrate in files+CLI.** The skills are the swappable layer (a future process = a new skill set writing to the same `ai/` substrate); the CLI and the `ai/` contract are the stable layer. This boundary already exists — name it in the docs so future decisions respect it.
- **The MCP knowledge-base server is the right structural bet (R9, P2).** `ai/lab/specs/SPEC_mcp-kb-server.md` is already implementation-grade. Serving the KB over MCP moves enforcement from prose conventions (four stamped tool surfaces, combinatorial doc-drift, agents choosing to honor CLAUDE.md) to a protocol every 2026 agent speaks — `lookup_module`, check-Stability-before-edit as a *tool call*. It also collapses the long-term cost of the Stamp plane: as agent tools multiply, per-tool template surfaces scale linearly; one MCP server scales constant.
- **RAG-readiness costs almost nothing now (R10, P3).** The future "RAG over decisions" ambition needs stable IDs and metadata, not a vector store today. Adding YAML front-matter (id, date, type, files, model, status) to new `ai/lab/` artifacts makes the corpus indexable by any external tool later, without violating the no-LLM-in-CLI identity. The W-numbered ledger and SPEC_/ADR_/REVIEW_ naming already do half of this.
- **The AGENTS.md bet was correct.** The convention is now Linux-Foundation-stewarded with adoption reported across 30+ tools and tens of thousands of repos; nested per-package AGENTS.md is emerging monorepo practice, which dovetails with the federated-map need below.

## 6. Cross-cutting risks (the engineer's list, severity-ordered)

1. **The audit cliff is the adoption cliff.** On the 400-directory monolith the pitch targets, "your 30-minute audit" is not credible; an unaudited map leaves everything `?` = frozen, and the kit reads as a blocker rather than an accelerator. Mitigation (R11): *blast-radius auditing* — the audit command proposes only the rows the next planned unit of work touches; plus verification-by-usage, where a row touched by a shipped, review-approved change is queued as a one-click audit candidate. The human flip stays sacred; the queue just orders it by value.
2. **Monorepo/polyglot scale is existential, not P2.** The kit's motivating example (React front, Java back) is the case a single flat MODULE_MAP handles worst, and W-020 proved the detection layer stumbles there today. C4/C9 should be treated as the price of admission for the stated audience; the natural shape is federated maps (per-workspace MODULE_MAP + root index), matching nested-AGENTS.md practice.
3. **drift --git cannot fire until C3 ships.** Without an audit-stamped baseline commit, `[verified]` rows can silently rot — the one hole in the trust story's mechanics, already on the roadmap; the 8 stale rows sitting in the kit's own map since W-025 illustrate the cost.
4. **Freshness economics.** Every unit of work taxes map+ledger upkeep; without the ceremony ladder (R5) small changes pay full fare — the identical critique that hit Kiro. The ladder is as much an economics fix as a process fix.
5. **Evidence debt.** README headline numbers (3×, 30 minutes) currently outrun the measurements (§3). Either measure (R1) or hedge the copy; a research-branded kit is held to its own provenance standard.
6. **Surface-count drift.** 26 SKILL.md files across 4 tool surfaces is a combinatorial doc-drift machine; checksums and check-docs manage it today, but each new workflow multiplies cost. The MCP bet (R9) is also the long-term exit from this.

## 7. Recommendations, prioritized

| # | Recommendation | Priority | Effort | Roadmap linkage |
|---|---|---|---|---|
| R1 | Run the 3-arm live A/B eval (none / inferred / verified) on an unfamiliar mid-size repo; publish the numbers whatever they say | P1 | M | extends C6; eval Part B already scaffolded |
| R2 | Promote `/implement-spec` into templates (all four surfaces) | P1 | S–M | blockers already recorded in W-014 |
| R3 | Deterministic speclint gate (no-LLM spec-hardness check before light-model implementation) | P2 | S | new; pure-stdlib, on-identity |
| R4 | Model-tier column in `ai/lab/WORKLOG.md` rows | P2 | S | new; feeds future evals |
| R5 | Ceremony ladder: trivial/small/full spec tiers, enforced by the loop skills | P1 | S–M | template comment (W-008) → rule |
| R6 | Review-stage requirement→test→commit traceability checklist line | P3 | S | new; borrow from Kiro |
| R7 | Restructure README around the three planes (Map / Loop / Stamp); pitch = trust substrate for brownfield agent work | P2 | S | docs only |
| R8 | Spec lifecycle vocabulary (superseded status; shipped specs are frozen history, maps are living truth) | P3 | S | docs + template |
| R9 | Implement the MCP KB server | P2 | M–L | `ai/lab/specs/SPEC_mcp-kb-server.md` ready |
| R10 | YAML front-matter metadata on new lab artifacts (RAG-readiness) | P3 | S | new |
| R11 | Blast-radius auditing + verification-by-usage queue | P2 | M | extends A1 audit command |
| — | Ship C3 (audit baseline → drift --git fires) and C4/C9 (monorepo detection + federated maps) as planned; this review only raises their urgency | P1 | — | C3, C4, C9 |

Sequencing note: R1 needs nothing and informs everything — run it first. R2+R3+R5 together make the small-model story shippable and honest. R9 after C9 (the server's parsers benefit from the detection fixes).

## 8. External sources consulted (July 2026)

- Martin Fowler — [Understanding Spec-Driven Development: Kiro, spec-kit, and Tessl](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html) (problem-size, iteration, brownfield critiques)
- [Spec-Driven Development in 2026 — DEV Community](https://dev.to/krlz/spec-driven-development-in-2026-what-it-is-the-tooling-and-how-teams-actually-use-it-2fk2) · [BCMS definitive guide](https://thebcms.com/blog/spec-driven-development) · [GitHub Spec Kit docs](https://github.github.com/spec-kit/) · [funDesk Spec Kit guide](https://www.fundesk.io/spec-driven-development-github-spec-kit-guide) (landscape + "sea of markdown" critique)
- IBM — [What is Spec-Driven Development?](https://www.ibm.com/think/topics/spec-driven-development) · [IBM Bob multi-agent announcement, 2026-07-09](https://newsroom.ibm.com/2026-07-09-ibm-advances-enterprise-ai-software-development-with-multi-agent-capabilities-and-specialized-modernization-workflows)
- ETH Zurich / LogicStar.ai — [Evaluating AGENTS.md: Are Repository-Level Context Files Helpful for Coding Agents?](https://arxiv.org/abs/2602.11988) (context files: no general success gain, +20% cost; overviews unhelpful; instructions followed)
- [Augment Code — AI model routing guide 2026](https://www.augmentcode.com/guides/ai-model-routing-guide) · [Unblocked — Model routing for coding agents](https://getunblocked.com/blog/model-routing-coding-agents/) (executive-worker consensus, cost math)
- [Augment Code — How to build your AGENTS.md (2026)](https://www.augmentcode.com/guides/how-to-build-agents-md) · [AGENTS.md field guide 2026](https://www.iuriio.com/blog/posts/2026/05/agents-md-field-guide-2026) (standardization, Linux Foundation stewardship, adoption)
- Agent-memory landscape: [Zylos — AI agent memory architectures](https://zylos.ai/research/2026-04-05-ai-agent-memory-architectures-persistent-knowledge/) · [Cognee — persistent codebase memory](https://www.cognee.ai/blog/guides/ai-coding-agent-persistent-codebase-memory) · [Rethinking memory mechanisms survey](https://arxiv.org/pdf/2602.06052) (semantic/episodic/procedural taxonomy)
