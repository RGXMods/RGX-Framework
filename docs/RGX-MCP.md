# RGX-MCP - Temporary Source Conformance Fixture

`tools/rgx-mcp/` is a temporary read-only [MCP](https://modelcontextprotocol.io) (Model Context Protocol) fixture used by source-tree CI to validate, audit, and generate declarative RGX addons against the framework's frozen Simplicity Contract. It is never part of the Lua/XML/media addon archive.

## Runtime API, Contract, And MCP

| Layer | Purpose | Used by |
|---|---|---|
| Runtime API | Lua calls such as `RGXAddon`, `addon:After`, and `RGX:GetUI()`; shared behavior runs inside WoW | Dependent addons; see [[API Reference]] |
| Compatibility adapters | `RGX.API` normalizes Blizzard client differences internally; it is not an external service | Framework modules; documented consumer methods remain the front door |
| Declarative contract | Canonical schema plus [[Declarative API]] describe addon definitions and shipped versus planned keys | Framework contributors, validation/generation tools, future Studio |
| MCP adapter | Exposes four developer tools and two resources using stdio JSON-RPC | MCP-capable AI/developer clients and the source conformance test |
| Studio application | Planned editor, project workflow, and preview UI consuming the shared contract | Future authors; see [[Studio Roadmap]] |

The runtime API is essential; MCP is optional. MCP cannot query the live WoW
client, provide combat information, or replace framework runtime methods. The
current server has no HTTP endpoint. Studio can consume reusable contract logic
directly; it does not inherently require an MCP server.

Keep the in-tree fixture today because existing CI/release workflows exercise
its validation, generation, and audits against the actual RGX-Hello source. The
implementation currently lives inside `src/server.js` alongside protocol code.
Extracting a transport-independent shared engine is tracked in
[framework #8](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/8),
not a shipped package. Preserve equivalent coverage before relocating or replacing
the fixture. Runtime correctness and contract congruence take priority over new
MCP transport features.

## Tools

| Tool | What it does |
|---|---|
| `rgx_validate_addon` | Validate an `RGXAddon` opts table (as JSON; Lua functions as `{"$lua":"function"}`) against `contract/schemas/rgx-addon.schema.json`; flags contract-frozen `tier4` keys that don't run yet |
| `rgx_audit_lua` | Scan a `.lua` file or addon directory for unsafe patterns: raw `C_Timer`, manual `OnEvent` frames, `SLASH_` globals, unguarded `SetAttribute`, raw aura plumbing, and hook reassignment; RGXAuras consumers remain clean |
| `rgx_generate_addon` | Emit a contract-congruent addon Lua file using shipped keys, including deterministically ordered named `every` timers |
| `rgx_get_contract` | Return the schema + shipped-surface reference for agent context |
| `rgx_edit_definition` | Normalize/import/patch/export a version-1 label definition through shared pure logic; returns data and canonical transfer text, explicitly marked source-only |
| `rgx_search_wow_api` | Deterministic substring search of the synced client dumps under `.reference/wow-api-dump/`, with per-result flavor/build/branch/commit/line provenance. Never live-game state; confirm runtime-driving conclusions in the wow-ui-source mirror |

## Resources

- `rgx://schemas/addon` — the annotated JSON Schema
- `rgx://docs/declarative-api` — the shipped declarative surface reference
- `rgx://schemas/definition` — the source-development label definition schema
- `rgx://frames/wow-api-dump` — synced dump provenance (fails closed with a sync instruction when dumps are absent; the main capability reference per the root agent guide)

The definition tool delegates to `contract/engine/definition.mjs`, the same pure
engine used by the external editor. It does not execute Lua, write files, require
an AI provider, or connect to the live client. Unsupported versions, kinds, and
fields fail explicitly; overrides via `RGX_FRAMEWORK_PATH` must match the engine's
canonical schema. The new tool is not present in the published `v2.7.9` snapshot.
See [[UI Controls]] for the editor round-trip slice; the existing addon-generator
engine extraction remains separate work under framework #8.

## Setup

From a framework source checkout:

```bash
npm --prefix tools/rgx-mcp ci --no-audit --no-fund
```

Run the transition implementation only from a source checkout. RGX-Framework
publishes its runtime API as part of the WoW addon, not a separate MCP service.
Framework source owns the shared contract and reusable authoring logic. A future
Studio application may distribute its own shell and downstream adapters separately.

Node.js 20 or newer is required.

For a harness supporting this configuration shape, run the command from the
framework repository root (other harnesses use their own MCP configuration):

```json
{
  "mcpServers": {
    "rgx": { "command": "node", "args": ["tools/rgx-mcp/src/server.js"] }
  }
}
```

The source checkout includes a `.mcp.json` example; automatic discovery depends
on the harness and is not required for framework development. The schema and API
reference are read from that checkout; set `RGX_FRAMEWORK_PATH` only to run
against a different framework tree. The published Framework addon contains no
MCP server. See [[Distribution]].

## The tandem loop

`tools/rgx-mcp/test/test-rgx-hello.mjs` drives the real server over the real MCP client SDK against the real [RGX-Hello](https://github.com/RGXMods/RGX-Hello) repo. It parses the actual curried `RGXAddon` table as Lua 5.1, validates that complete options object, generates the matching supported surface including named timers, and audits the actual Lua tree. It also verifies that `every` is shipped while `on` remains Tier 4, and proves with paired fixtures that RGXAuras consumer code passes while raw aura event/API references are reported, including references passed through `pcall` or stored for later use. An unparseable Lua source fails the audit closed. The validator separately reports `tier4KeysUsed`: schema validity alone does not establish runtime availability. The generator emits only its supported shipped forms.

```bash
node tools/rgx-mcp/test/test-rgx-hello.mjs "<RGX-Hello-checkout>"
```

Source: [`tools/rgx-mcp/`](https://github.com/RGXMods/RGX-Framework/tree/main/tools/rgx-mcp).

## Contract Congruence

Easy for humans to write is easy for agents to generate. `RGXAddon` is the
shared front door; the MCP must not invent a separate agent-only authoring
surface. When functionality ships, update the runtime, schema, declarative
docs, MCP validation/generation, and RGX-Hello coverage in the same change.
