<!-- Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved. -->
# SPEC: MCP server for the ai/ knowledge-base (`mcp` command)
> **Status:** draft `[inferred]` — AI-drafted design, human must audit before implementation
> **Author:** AI draft (design session) · **Date:** 2026-07-04 · **Revision:** 2 (implementation-grade)

This spec is written to be implemented by an AI agent **without further design
decisions**. Every protocol message, tool schema, parsing rule, and test case is
specified. Where the implementer is tempted to improvise, the spec says what to do
instead. Read the whole spec before writing code. The design rationale lives in
`docs/dev/lessons-learnt/mcp-serving-layer-and-freshness.md` — read it once, then
implement from *this* document.

---

## 1. Goal

Any MCP-capable coding agent (Claude Code, Cursor, VS Code Copilot, Codex CLI,
Windsurf) connected to a kit-installed repo can query the `ai/` knowledge-base
through the Model Context Protocol — look up modules, check Stability before
editing, read provenance, run verify/drift/status — instead of relying on each
tool honouring the prose conventions in `CLAUDE.md`/`AGENTS.md`.

The markdown in `ai/` stays the **single source of truth**. The MCP server is a
**stateless serving layer** ("a window, not a warehouse"): it holds no snapshot,
cache, or index, and reads files from disk on every request.

## 2. Hard constraints (violating any of these fails the review)

| # | Constraint |
|---|---|
| C1 | **Zero runtime dependencies.** Node stdlib only (`node:fs`, `node:path`, `node:readline`, `node:process`). Do NOT add `@modelcontextprotocol/sdk` or anything else to `package.json` dependencies. |
| C2 | **No changes to existing `lib/*.mjs` logic.** The server imports the already-exported functions listed in §5.2. If something seems missing, implement it locally in `lib/mcp.mjs` — do not edit other modules (exception: the two surgical touches in §10). |
| C3 | **stdout is the protocol channel.** After the server starts, NOTHING is written to stdout except newline-delimited JSON-RPC messages. All diagnostics go to `process.stderr`. Never call `banner()`, `info()`, or `console.log` inside the server. |
| C4 | **No caching.** Every tool call / resource read re-reads the relevant files from disk. Do not memoize, do not read at startup, do not hold parsed tables in module state. |
| C5 | **Read-only.** Phase 1 tools never write to the target repo (exception: none — even the derived-staleness check in §7.2 only *reports*; it does not regenerate in phase 1). |
| C6 | **License header** on every new source file, copied from neighbours: `// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.` (JS) or `<!-- ... -->` (md/tmpl). |
| C7 | **ESM, Node >= 18**, same style as the rest of `lib/` (named exports, `import { promises as fs } from "node:fs"`). |
| C8 | **Surgical diffs.** Touch only the files in §10. No reformatting of untouched code. |

## 3. Glossary

- **Target repo** — the repository the server serves; the `<path>` argument. May be
  the kit repo itself (dogfooding) or any repo where the kit was installed.
- **KB** — the `ai/` folder of the target repo.
- **MODULE_MAP** — `ai/guide/MODULE_MAP.md` in the target repo. Table columns:
  `| Directory | Responsibility | Entry point | Stability | Status |`.
- **Provenance** — `[verified]` or `[inferred]` tag in a row's Status column.
- **Stability** — `frozen | stable | ours | ?` per the MODULE_MAP legend. `?` and
  anything unrecognized are treated as `frozen` ("treat as frozen until a human decides").

## 4. Transport & protocol (exact wire behaviour)

### 4.1 Framing
- Transport: **stdio**. Messages are **newline-delimited JSON-RPC 2.0**: each
  message is a single line of UTF-8 JSON terminated by `\n`. There are **no**
  `Content-Length` headers (that is LSP framing, not MCP stdio — do not add them).
- Read stdin line by line (`node:readline` interface over `process.stdin`).
  Empty lines are skipped. A line that fails `JSON.parse` gets JSON-RPC error
  `-32700` (Parse error) with `id: null`.
- Serialize every response with `JSON.stringify` (single line) + `"\n"` to
  `process.stdout`.

### 4.2 Message kinds
- **Request** (has `id`): must be answered with exactly one response carrying the
  same `id` — either `{ "jsonrpc": "2.0", "id": ..., "result": {...} }` or
  `{ "jsonrpc": "2.0", "id": ..., "error": { "code": <int>, "message": <string> } }`.
- **Notification** (no `id`): never answered. Unknown notifications are ignored
  silently.
- Unknown request method → error `-32601` (Method not found).
- Malformed params → error `-32602` (Invalid params).
- Internal exception while handling → error `-32603` with the exception message;
  the server logs the stack to stderr and keeps running (never crash on a bad request).

### 4.3 Lifecycle methods (implement all)

| Method | Kind | Behaviour |
|---|---|---|
| `initialize` | request | Respond as in §4.4. |
| `notifications/initialized` | notification | Ignore (mark handshake complete internally; no reply). |
| `ping` | request | Respond `{ "jsonrpc":"2.0", "id":..., "result": {} }`. |
| `tools/list` | request | §6 catalog. |
| `tools/call` | request | §6 dispatch. |
| `resources/list` | request | §5.3 catalog. |
| `resources/read` | request | §5.4. |
| `prompts/list` | request | §8. |
| `prompts/get` | request | §8. |
| `notifications/cancelled` | notification | Ignore. |
| anything else with `id` | request | Error `-32601`. |

The server runs until stdin closes (EOF), then exits 0.

### 4.4 `initialize` response (exact shape)

Request (from client — example):
```json
{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"claude-code","version":"x"}}}
```
Response the server MUST send:
```json
{"jsonrpc":"2.0","id":0,"result":{
  "protocolVersion":"2025-06-18",
  "capabilities":{"tools":{},"resources":{"subscribe":false,"listChanged":false},"prompts":{}},
  "serverInfo":{"name":"ai-fication-kit-kb","version":"<KIT_VERSION from lib/util.mjs>"},
  "instructions":"Read-only window onto this repo's ai/ knowledge-base. Call kb_check_stability(path) BEFORE editing any file; frozen means hands off. Data tagged [inferred] is unaudited — treat with care. Responses embed the current TRUSTED/NEEDS AUDIT/DRIFTING verdict; if DRIFTING, run kb_verify and kb_drift for details."
}}
```
Version negotiation: if the client's `protocolVersion` is `"2025-06-18"` or
`"2025-03-26"` or `"2024-11-05"`, echo it back; otherwise reply with
`"2025-06-18"`. Do not fail the handshake over version — clients disconnect if
they can't accept it.

## 5. Data sources and resources

### 5.1 Startup precondition
`serveMcp(targetAbs)` first checks that `ai/INDEX.md` exists under the target.
If not: print to **stderr**
`✗ No ai/ knowledge-base found in <path>. Run: npx ai-fication-kit shazam <path>`
and `process.exit(1)`. (This happens before any protocol I/O, so it is safe.)

### 5.2 Reused exports (import, do not reimplement)
```js
import { KIT_VERSION, readText, isFile } from "./util.mjs";
import { parseModuleMap, MODULE_MAP_REL, computeDrift } from "./drift.mjs";
import { computeVerification } from "./verify.mjs";
import { computeStatus } from "./status.mjs";
```
**Known pitfall (do not skip):** `parseModuleMap` returns per-row
`{ dirClaims, entryClaims, status, line, label }` — it does **NOT** return the
Stability column. `lib/mcp.mjs` must implement its own `parseStabilityRows(text)`
for `kb_check_stability` (§6.3), using the same cell-splitting rules as
`parseModuleMap` (split on `|`, trim, drop empty lead/tail cells, skip separator
and header rows) and reading the **4th data column** as stability.

### 5.3 Resource catalog (`resources/list`)
Return `{ "resources": [...] }` with one entry per file below **that exists on
disk at call time** (re-check existence per call — C4). Fields per entry:
`uri`, `name`, `description` (one line), `mimeType`.

| uri | file (relative to target) | mimeType |
|---|---|---|
| `kb://index` | `ai/INDEX.md` | `text/markdown` |
| `kb://guide/module-map` | `ai/guide/MODULE_MAP.md` | `text/markdown` |
| `kb://guide/architecture` | `ai/guide/ARCHITECTURE.md` | `text/markdown` |
| `kb://guide/project-overview` | `ai/guide/PROJECT_OVERVIEW.md` | `text/markdown` |
| `kb://guide/feature-map` | `ai/guide/FEATURE_MAP.md` | `text/markdown` |
| `kb://guide/conventions` | `ai/guide/CONVENTIONS.md` | `text/markdown` |
| `kb://profile` | `ai/repo-profile.json` | `application/json` |
| `kb://indepth` | `ai/repo-indepth.json` | `application/json` |
| `kb://analysis/feature-catalog` | `ai/analysis/FEATURE_CATALOG.md` | `text/markdown` |
| `kb://lab/worklog` | `ai/lab/WORKLOG.md` | `text/markdown` |

### 5.4 `resources/read`
Params: `{ "uri": "kb://..." }`. Look the uri up in the table above (exact string
match — **never** map arbitrary uris to paths; this is the path-traversal guard).
Unknown uri, and known uri whose file is missing, both return the MCP
resource-not-found error — code `-32002` (NOT `-32602`; the MCP spec reserves
`-32002` for this case), message `Resource not found`, and the uri echoed in
`error.data`:
```json
{"jsonrpc":"2.0","id":N,"error":{"code":-32002,"message":"Resource not found","data":{"uri":"<requested uri>"}}}
```
Success:
```json
{"jsonrpc":"2.0","id":N,"result":{"contents":[{"uri":"<uri>","mimeType":"<mimeType>","text":"<full file text>"}]}}
```

## 6. Tools

### 6.0 `tools/list` and calling convention
`tools/list` returns `{ "tools": [ ... ] }`, each entry
`{ "name", "description", "inputSchema" }` exactly as specified per tool below.
`tools/call` params are `{ "name": "<tool>", "arguments": { ... } }`.

**Every** successful tool result has this shape (MCP `CallToolResult`):
```json
{"jsonrpc":"2.0","id":N,"result":{"content":[{"type":"text","text":"<JSON string, see per-tool payload>"}],"isError":false}}
```
The `text` field is the **pretty-printed JSON** (`JSON.stringify(payload, null, 2)`)
of the per-tool payload. Tool-level failures (bad argument value, missing file)
are **not** JSON-RPC errors: return `"isError": true` with
`content[0].text = JSON.stringify({ error: "<human-readable message>" }, null, 2)`.
Reserve JSON-RPC errors for protocol problems (unknown tool name → `-32602`).

**Freshness envelope (applies to every tool payload):** each payload object
includes a `_kb` field computed fresh per call:
```json
"_kb": {
  "verdict": "TRUSTED | NEEDS AUDIT | DRIFTING",
  "generated": "<ISO timestamp of this response>",
  "note": "verdict from computeStatus at call time; [inferred] rows are unaudited"
}
```
Compute it via `computeStatus(targetAbs)` → use `result.verdict`. If
`computeStatus` throws, set `verdict: "UNKNOWN"` and continue — the envelope must
never break the tool.

### 6.1 `kb_lookup`
- **description:** `Search the module map and feature map for rows matching a query. Returns matching rows with paths, stability, and provenance. Use this to locate code before reading files.`
- **inputSchema:**
```json
{"type":"object","properties":{"query":{"type":"string","description":"Case-insensitive substring matched against every cell of every row of MODULE_MAP.md and FEATURE_MAP.md"}},"required":["query"]}
```
- **Behaviour:** read both files fresh. For each markdown table row (same
  row-detection rules as §5.2), if any cell contains the query
  (case-insensitive substring), emit a hit. Payload:
```json
{
  "query":"...",
  "module_map_hits":[{"line":27,"cells":["`lib/`","Implementation modules …","`lib/util.mjs`","ours","[verified] (03/07/2026 17:35 CEST)"],"stability":"ours","provenance":"verified"}],
  "feature_map_hits":[{"line":12,"cells":[...]}],
  "hint":"Call kb_check_stability(<path>) before editing anything listed here.",
  "_kb":{...}
}
```
  For module-map hits include `stability` (4th cell, normalized lowercase; empty
  or unrecognized → `"?"`), and `provenance` (`verified`/`inferred`/`unknown`
  from the last cell). If FEATURE_MAP.md is missing, set `feature_map_hits: []`
  and add `"feature_map_missing": true`. Zero total hits is a success (empty
  arrays), not an error.

### 6.2 `kb_status`
- **description:** `One-call health snapshot of the knowledge-base: row provenance counts, broken claims, drift items, and the TRUSTED / NEEDS AUDIT / DRIFTING verdict.`
- **inputSchema:** `{"type":"object","properties":{}}`
- **Behaviour:** payload is the object returned by `computeStatus(targetAbs)`
  verbatim, plus the `_kb` envelope (which will agree with it).

### 6.3 `kb_check_stability`
- **description:** `MANDATORY pre-edit gate. Given a repo-relative file or directory path, returns its Stability from MODULE_MAP.md: frozen (do not edit), stable (edit carefully with tests), ours (safe to modify), or unknown (treat as frozen).`
- **inputSchema:**
```json
{"type":"object","properties":{"path":{"type":"string","description":"Repo-relative path, e.g. lib/verify.mjs or src/payments/"}},"required":["path"]}
```
- **Behaviour:**
  1. Normalize the argument: strip leading `./` and `/`, convert `\` to `/`,
     strip trailing `/`. Empty after normalizing → `isError:true` payload.
  2. Parse MODULE_MAP.md with the local `parseStabilityRows` (§5.2). Each parsed
     row: `{ line, pathClaims, stability, provenance }` where `pathClaims` =
     backticked tokens from the Directory column (cell 1) and Entry-point column
     (cell 3), normalized the same way (also strip a trailing `/` and a leading
     `/`; the root row's claim `/` normalizes to the empty string and matches
     only root-level files).
  3. Matching: a row matches if any claim equals the query path, OR the query
     path starts with `<claim>/`, OR (for entry-point file claims) the claim
     equals the query. Pick the row with the **longest matching claim**
     (most-specific wins; e.g. `templates/ai/` beats `templates/`).
  4. Result mapping: matched row → its stability, lowercased; values outside
     `frozen|stable|ours` (including `?`) → report the raw value but set
     `effective: "frozen"`. No row matched → `stability: "unknown"`,
     `effective: "frozen"`.
  5. Payload:
```json
{
  "path":"lib/verify.mjs",
  "stability":"ours",
  "effective":"ours",
  "provenance":"verified",
  "matched_row":{"line":28,"claim":"lib/"},
  "rule":"frozen = do not edit; ? and unknown are treated as frozen until a human audits",
  "_kb":{...}
}
```
  MODULE_MAP.md missing entirely → `isError:true` with
  `error: "No MODULE_MAP.md — run /cold-start first; treat everything as frozen."`

### 6.4 `kb_verify`
- **description:** `Mechanically check every file-path claim in the knowledge docs against the working tree. Returns confirmed / moved / missing claims. Run before trusting the maps and after any refactor.`
- **inputSchema:** `{"type":"object","properties":{}}`
- **Behaviour:** call `computeVerification(targetAbs)`. Payload: the returned
  object (counts + per-claim details as provided) + `_kb`. If it returns
  `null`/throws because no docs exist, `isError:true` with a message pointing at
  `shazam`.

### 6.5 `kb_drift`
- **description:** `Report where the code has drifted from the module map: unmapped top-level areas, vanished paths, and (never git-based here) structural staleness.`
- **inputSchema:** `{"type":"object","properties":{}}`
- **Behaviour:** call `computeDrift(targetAbs, { git: false })` — **always**
  `git:false`; the server must not shell out to git. Payload: the returned
  object + `_kb`.

### 6.6 `kb_feature`
- **description:** `Feature-to-files lookup: search FEATURE_MAP.md (and FEATURE_CATALOG.md if present) for a named feature; returns its rows so an agent knows which files implement it and the gotchas.`
- **inputSchema:**
```json
{"type":"object","properties":{"name":{"type":"string","description":"Feature name or fragment, case-insensitive"}},"required":["name"]}
```
- **Behaviour:** same row-scan as `kb_lookup` but only over
  `ai/guide/FEATURE_MAP.md` and `ai/analysis/FEATURE_CATALOG.md`; payload mirrors
  `kb_lookup` with keys `feature_map_hits` / `catalog_hits`. Missing files →
  empty arrays + `*_missing: true` flags (both missing is still a success).

### 6.7 `kb_provenance`
- **description:** `Provenance census: how many MODULE_MAP rows are [verified] vs [inferred] vs untagged, with line numbers — shows how much of the map a human has actually audited.`
- **inputSchema:** `{"type":"object","properties":{}}`
- **Behaviour:** run `parseModuleMap` on a fresh read; payload:
```json
{"verified":[{"line":27,"label":"`/` (root)"}],"inferred":[],"unknown":[],"counts":{"verified":10,"inferred":0,"unknown":0},"rule":"[inferred] is unaudited AI output; only a human may flip it to [verified]","_kb":{...}}
```

## 7. Freshness model (contract, with acceptance tests in §11)

The kit's own workflows write into `ai/` after every feature/bugfix, so this
server serves a KB that is edited while it runs. Three staleness layers:

### 7.1 Server vs. disk — stateless by contract
No snapshot, cache, or index (C4). Every call reads current bytes; a WORKLOG
append or FEATURE_MAP edit is visible on the very next call with no restart.
Capabilities advertise `resources.subscribe: false` — phase 1 offers no change
notifications because clients re-read on demand anyway.

### 7.2 Derived artifacts vs. source docs
`ai/repo-profile.json` and `ai/repo-indepth.json` are compiled outputs that can
lag reality. On `resources/read` of `kb://profile` or `kb://indepth`, compare the
file's mtime with the mtimes of `package.json` and `ai/guide/MODULE_MAP.md` in
the target (use `fs.stat`; ignore files that don't exist). If the derived file is
older than either input, append a **second** entry to the `contents` array of
the `resources/read` result. That entry MUST use the §5.4 contents-item shape
(`uri` / `mimeType` / `text`) — NOT the tool-call `{"type":"text"}` content
shape, which is invalid inside `resources/read`:
```json
{"uri":"<requested uri>#derived_stale","mimeType":"text/plain","text":"WARNING derived_stale: <relative path> is older than its inputs — re-run: node install.mjs orient <path>"}
```
Do not regenerate (C5).

### 7.3 Docs vs. code reality
Surfaced in-band, not hidden: the `_kb` envelope (§6.0) puts the live
TRUSTED / NEEDS AUDIT / DRIFTING verdict inside every tool response, and
`kb_lookup`/`kb_check_stability` carry per-row provenance. Staleness is always
*declared* in the same payload the consumer reads. (Phase-3 write tools will
close the loop fully; explicitly out of scope here.)

## 8. Prompts

`prompts/list` → `{ "prompts": [...] }`. Serve the tool-agnostic workflow files
installed in the target repo at `.agents/workflows/*.md`. Enumerate that
directory fresh per call; each `NAME.md` becomes
`{ "name": "NAME", "description": "<first markdown heading line of the file, stripped of #>" }`.
Directory missing → `{ "prompts": [] }` (success).

`prompts/get` params `{ "name": "NAME" }` (ignore extra fields). Reject names
containing `/`, `\`, or `..` with `-32602` (traversal guard). Read
`.agents/workflows/<NAME>.md`; missing → `-32602` `Unknown prompt: <NAME>`.
Success:
```json
{"jsonrpc":"2.0","id":N,"result":{"description":"<same as list>","messages":[{"role":"user","content":{"type":"text","text":"<full file text>"}}]}}
```

## 9. CLI wiring and installer integration

### 9.1 `install.mjs` (two surgical edits)
1. Line ~136: add `"mcp"` to the `COMMANDS` set.
2. In the dispatch chain (after the `status` branch), add:
```js
} else if (command === "mcp") {
  const { serveMcp } = await import("./lib/mcp.mjs");
  await serveMcp(targetAbs);
}
```
Note: the generic pre-dispatch code already resolves/validates `targetAbs` and
prints nothing to stdout for valid invocations, so C3 holds. Also add one line to
the usage text (`node install.mjs mcp <path-to-your-repo>` — serve the ai/
knowledge-base over MCP stdio) and to the header comment block listing commands.

### 9.2 Installer stamps `.mcp.json` into target repos
- New template `templates/mcp.json.tmpl` (exact content):
```json
{
  "mcpServers": {
    "repo-kb": {
      "command": "npx",
      "args": ["--yes", "ai-fication-kit", "mcp", "."]
    }
  }
}
```
- `lib/installer.mjs`: stamp it to `<target>/.mcp.json` following the existing
  pattern for root-level stamped files, with one merge rule: if `.mcp.json`
  already exists and parses as JSON, **merge** — set
  `existing.mcpServers["repo-kb"]` to the object above and rewrite, preserving
  every other key; if it exists but does not parse, leave it untouched and warn
  on stderr. Record `.mcp.json` in the manifest `files` array (forward slashes)
  exactly like other stamped files so `uninstall` removes it. Honour `--dry-run`
  like every other write.
- README/template docs (one short section, mirrored in `templates/CLAUDE.md.tmpl`
  + `templates/AGENTS.md.tmpl`): Claude Code auto-detects `.mcp.json`; Cursor
  users copy the server block into `.cursor/mcp.json`; VS Code users into
  `.vscode/mcp.json`.

## 10. Touch list (complete — nothing else changes)

| Layer | Location | Change |
|---|---|---|
| backend | `lib/mcp.mjs` | **add** — transport loop, dispatch, 7 tools, resources, prompts, `parseStabilityRows` |
| CLI | `install.mjs` | modify — COMMANDS set + dispatch branch + usage/header text |
| backend | `lib/installer.mjs` | modify — stamp/merge `.mcp.json`, manifest entry |
| templates | `templates/mcp.json.tmpl` | **add** |
| tests | `test/run-tests.mjs` | modify — append MCP section (§11); or **add** `test/mcp-tests.mjs` invoked from the runner if the file would grow unwieldy |
| docs | `README.md`, `templates/CLAUDE.md.tmpl`, `templates/AGENTS.md.tmpl` | modify — one "Querying the knowledge-base over MCP" section each |

Stability check: all touched areas are `ours` in MODULE_MAP.md (root, `lib/`,
`templates/`, `test/`, `docs/`). No `frozen` files.

### 10.1 `lib/mcp.mjs` skeleton (follow this structure)
```js
// Copyright (c) 2026 Kunal Suri (CEA LIST). All rights reserved.
// mcp — stateless MCP stdio server over the ai/ knowledge-base.
// A window, not a warehouse: no cache, every request re-reads disk (spec §7.1).
// stdout carries ONLY newline-delimited JSON-RPC; diagnostics go to stderr.
import ...                                   // §5.2 imports only

const RESOURCES = [ ... ];                   // table from §5.3
const TOOLS = [ ... ];                       // name/description/inputSchema, §6

export function parseStabilityRows(text) { ... }        // §5.2 pitfall
export function matchStability(rows, relPath) { ... }   // §6.3 steps 1–4 (pure, tested)

async function kbEnvelope(targetAbs) { ... } // §6.0 _kb field
async function handleToolCall(targetAbs, name, args) { ... }
async function handleRequest(targetAbs, msg) { ... }    // returns response object or null (notification)

export async function serveMcp(targetAbs) {
  // §5.1 precondition, then readline loop over stdin → handleRequest → stdout
}
```
Keep `parseStabilityRows` and `matchStability` exported and pure so tests can
import them directly (mirrors how `parseModuleMap` is tested).

## 11. Test plan (all must pass via `npm test`)

Use the existing harness style in `test/run-tests.mjs` (`ok(cond, label)`,
fixtures under `test/tmp-*`). For protocol tests, spawn
`node install.mjs mcp <fixture>` with `child_process.spawn`, write one request
per line to stdin, collect stdout lines, `JSON.parse` each, match by `id`.
Target fixture: the repo produced by the existing `shazam --yes` fixture flow
(already built by the suite), plus the kit repo itself for map-dependent cases.

| # | Test | Assertion |
|---|---|---|
| T1 | handshake | `initialize` → result has `serverInfo.name === "ai-fication-kit-kb"`, `protocolVersion` echoed; `notifications/initialized` produces no output line |
| T2 | tools/list | exactly the 7 tool names of §6; every tool has an `inputSchema` object |
| T3 | resources/list + read | every listed uri reads back non-empty text; `resources/read` of `kb://guide/module-map` equals the file on disk byte-for-byte |
| T4 | unknown uri | `resources/read {uri:"kb://../etc/passwd"}` → JSON-RPC error `-32002` with `error.data.uri` echoed, server still answers a following `ping` |
| T5 | unknown method | request `foo/bar` → `-32601`; unknown notification → no output |
| T6 | kb_check_stability | on the kit repo: `lib/verify.mjs` → `stability:"ours"`; `no/such/path.js` → `stability:"unknown"`, `effective:"frozen"`; unit-test `matchStability` longest-claim precedence with a synthetic two-row map (`templates/` stable + `templates/ai/` frozen → query `templates/ai/x.md` returns frozen) |
| T7 | parity | `kb_verify` counts equal a direct `computeVerification(target)` call; `kb_status` verdict equals `computeStatus(target).verdict` |
| T8 | **freshness (no cache)** | with the server RUNNING: call `kb_lookup("zz-sentinel")` → 0 hits; append a row containing `zz-sentinel` to the fixture's MODULE_MAP.md; call again on the same process → ≥1 hit |
| T9 | derived_stale | touch the fixture's `package.json` mtime forward; `resources/read kb://profile` → `contents` has 2 entries; the 2nd is a §5.4 contents item (has `uri` ending `#derived_stale` and `mimeType`, no `type` field) whose `text` contains `derived_stale` |
| T10 | no-KB repo | `mcp` against an empty temp dir → exit code 1, stderr mentions `shazam`, stdout empty |
| T11 | installer round-trip | fresh install → `.mcp.json` exists with `mcpServers["repo-kb"]`, listed in `ai/install-manifest.json`; pre-existing `.mcp.json` with another server key survives merge; `uninstall --yes` removes the stamped file |
| T12 | tool error shape | `kb_check_stability` with `{"path":""}` → `isError:true` and `content[0].text` parses as JSON with an `error` key |
| T13 | stdout purity | across all of the above, every stdout line of the server process parses as JSON with `jsonrpc === "2.0"` |

Also run `node install.mjs verify . --strict` after updating docs (§13) — zero
missing claims.

## 12. Acceptance criteria (definition of done)

1. All hard constraints C1–C8 hold (reviewer checks `git diff --stat` against §10).
2. `npm test` passes with the §11 tests included; `node install.mjs verify . --strict` passes.
3. T8 (freshness) and T13 (stdout purity) pass — these two are the contract; a
   caching or logging shortcut that breaks them fails the whole change.
4. `node install.mjs mcp .` in the kit repo answers `initialize`, lists 7 tools
   and ≥ 8 resources, and `kb_check_stability("lib/verify.mjs")` returns `ours`.
5. Claude Code started in a freshly-installed fixture repo picks up `.mcp.json`
   and lists the `repo-kb` server (manual smoke check, noted in the review).
6. A repo without the kit gets the §5.1 error, never a crash or empty hang.
7. Every tool payload contains the `_kb` envelope; stability answers for `?`,
   unmatched, or missing-map cases all come back `effective: "frozen"`.

## 13. Knowledge update on completion (do these, they are part of the change)

- [ ] `ai/guide/MODULE_MAP.md`: add row for `lib/mcp.mjs` under `lib/` context —
      new/changed rows are `[inferred]` and `?` until a human audits (never
      self-flip to `[verified]`).
- [ ] `ai/guide/FEATURE_MAP.md`: entry "MCP knowledge-base server" → files, gotchas
      (stdout purity, no-cache contract, stability-column pitfall).
- [ ] `ai/analysis/FEATURE_CATALOG.md`: amend.
- [ ] `ai/INDEX.md` role table: add "KB over MCP | `lib/mcp.mjs` …" row.
- [ ] `ai/lab/WORKLOG.md`: entry under this spec.
- [ ] This spec's Status → `implemented` (human flips after audit).

## 14. Explicitly out of scope (do NOT build these now)

- Write tools (WORKLOG append, spec drafting) — separate spec; touches the
  human-in-the-loop contract.
- `ai/graph.json` derivation and `kb_related` — phase 2, separate spec. Rationale
  recorded in the lessons-learnt doc: derive, never store; no graph databases,
  no embeddings, ever, in this kit.
- HTTP/SSE/streamable transports, OAuth, multi-repo serving, `fs.watch`
  resource-update notifications, `resources/subscribe`.
- Any dependency additions, any regeneration of derived files from inside the
  server, any git invocation from inside the server.
