# rgx-mcp source conformance fixture

Temporary MCP fixture for [RGX-Framework](https://github.com/RGXMods/RGX-Framework) source-tree CI. It lets contributors validate, audit, and generate declarative RGX addons against the framework's frozen **Simplicity Contract**. It is private package metadata, not a separately published product.

**Read-only by design.** This tool inspects and generates — it never edits repos, never commits, never touches the game.

## Dependency direction (hard rule)

```
rgx-mcp            depends on →  RGX-Framework docs + schema (read at runtime)
consumer addons    depend on  →  RGX-Framework
RGX-Framework      depends on →  nothing (and never on rgx-mcp)
```

This transition tool lives at `tools/rgx-mcp/` **inside the framework source repo** for contract-conformance CI. It is not distributed as a Framework product. The framework owns the runtime Lua API and reusable contract/authoring logic; a future Studio application consumes that foundation and may package its own downstream adapters. Set `RGX_FRAMEWORK_PATH` only when intentionally running against a different framework tree.

The MCP is an optional stdio adapter, not the API addons use inside WoW and not
a live-game or HTTP service. It is useful today because validation, generation,
and audit coverage run against RGX-Hello. A transport-independent shared contract
engine is planned in framework issue #8; it has not yet been extracted from
`src/server.js`. See [the layer comparison](../../docs/RGX-MCP.md#runtime-api-contract-and-mcp)
and [scoped agent guidance](AGENTS.md).

## Tools

| Tool | What it does |
|---|---|
| `rgx_validate_addon` | Validate an RGXAddon opts table (JSON; Lua functions as `{"$lua":"function"}`) against `schemas/rgx-addon.schema.json`; flags contract-frozen `tier4` keys that don't run yet |
| `rgx_audit_lua` | Scan a `.lua` file or addon directory for the unsafe patterns the framework prevents: raw `C_Timer`, manual `OnEvent` frames, `SLASH_` globals, unguarded `SetAttribute`, raw aura event/API plumbing, and hook reassignment. Deterministic |
| `rgx_generate_addon` | Emit a contract-congruent addon Lua file using shipped keys (`RGXAddon "Name" { ... }`), including named `every` timers |
| `rgx_get_contract` | Return the schema + shipped-surface reference for agent context |
| `rgx_edit_definition` | Source-development label definition normalize/import/patch/export; delegates to the pure shared engine and returns data only |
| `rgx_search_wow_api` | Search the synced WoW API dumps (main capability reference) with flavor/build/commit provenance; deterministic, offline after `sync-wow-api-dump.mjs` |

## Resources

- `rgx://schemas/addon` — the annotated JSON Schema
- `rgx://docs/declarative-api` — the shipped declarative surface reference
- `rgx://schemas/definition` — the source-development version-1 label schema
- `rgx://frames/wow-api-dump` — synced dump provenance (main capability reference)

The optional external editor (`node tools/editor/serve.mjs` from the framework
root) and this new definition tool use the same browser-compatible
`tools/contract/definition.mjs`. Imports/updates are strictly validated, unknown
versions/kinds/fields fail, and responses identify `sourceOnly`. No AI key enters
the runtime or browser. See [UI Controls](../../docs/UI-CONTROLS.md#definition-round-trip-source-development-slice).

## Setup

Node.js 20 or newer is required.

```bash
npm ci --no-audit --no-fund
```

Example for an MCP-capable harness, with its working directory set to the
framework repository root (configuration/discovery varies by harness):

```json
{
  "mcpServers": {
    "rgx": {
      "command": "node",
      "args": ["tools/rgx-mcp/src/server.js"]
    }
  }
}
```

The framework source checkout includes `.mcp.json`; published artifacts do not. A harness must support/configure the server and its dependencies before exposing the `rgx_*` tools. Framework development does not require MCP. The MCP follows the same simplicity rule as the runtime: agents should generate and validate the one-call `RGXAddon` form, not invent a more complex consumer pattern.

## Testing

`test/test-rgx-hello.mjs` drives the real server over the real MCP client SDK (stdio transport, no protocol reimplementation) against [RGX-Hello](https://github.com/RGXMods/RGX-Hello). It parses and validates the actual curried `RGXAddon` table, generates the matching supported surface with named timers, and audits the actual Lua tree. It verifies that `every` is shipped while `on` remains Tier 4, and uses paired fixtures to require RGXAuras consumer code to pass while raw aura plumbing fails. Validation reports `tier4KeysUsed` separately; schema-valid future keys are not evidence of shipped behavior. Generation is limited to supported shipped forms.

```bash
node test/test-rgx-hello.mjs /path/to/RGX-Hello
```

## Status

v0.1.0 — transition fixture for the framework roadmap. Verified over live stdio JSON-RPC: initialize handshake and `tools/list`; generate, validate, and audit are exercised end-to-end against RGX-Hello, while `rgx_get_contract` exposes the same schema/docs used by those checks.

## Distribution

The MCP source is maintained temporarily with the framework contract for CI but
is not included in the published Framework archive. Run it only from a source
checkout with its tracked lockfile. Future Studio-specific services and app
integrations remain separate from the framework runtime; shared contract logic
remains framework-owned. Update runtime, schema, docs, and conformance tests together.

## License

MIT
