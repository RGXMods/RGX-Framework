# RGX-MCP — the framework's MCP server

`tools/rgx-mcp/` is a read-only [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server that lets AI agents (Claude Code, etc.) validate, audit, and generate declarative RGX addons against the framework's frozen Simplicity Contract. It is developer tooling and is deliberately separate from the Lua/XML/media player archive.

## Tools

| Tool | What it does |
|---|---|
| `rgx_validate_addon` | Validate an `RGXAddon` opts table (as JSON; Lua functions as `{"$lua":"function"}`) against `schemas/rgx-addon.schema.json`; flags contract-frozen `tier4` keys that don't run yet |
| `rgx_audit_lua` | Scan a `.lua` file or addon directory for the unsafe patterns the framework prevents: raw `C_Timer`, manual `OnEvent` frames, `SLASH_` globals, unguarded `SetAttribute`, secret-aura field comparisons, raw hook reassignment |
| `rgx_generate_addon` | Emit a contract-congruent addon Lua file using shipped keys, including human `on` triggers and named `every` timers |
| `rgx_get_contract` | Return the schema + shipped-surface reference for agent context |

## Resources

- `rgx://schemas/addon` — the annotated JSON Schema
- `rgx://docs/declarative-api` — the shipped declarative surface reference

## Setup

From a framework source checkout:

```bash
cd /path/to/RGX-Framework/tools/rgx-mcp
npm ci --no-audit --no-fund
```

The separately downloadable contract SDK does not include this server or any
executable MCP transport. Run the transition implementation only from a source
checkout. Public API/MCP/editor tooling belongs to RGX Studio after gate #30.

Node.js 20 or newer is required.

Claude Code (`.mcp.json` or `claude mcp add`):

```json
{
  "mcpServers": {
    "rgx": { "command": "node", "args": ["tools/rgx-mcp/src/server.js"] }
  }
}
```

Only the framework source checkout includes `.mcp.json`. The schema and API
reference are read from that checkout; set `RGX_FRAMEWORK_PATH` only to run
against a different framework tree. Published player and contract SDK artifacts
contain no MCP server. See [[Distribution]].

## The tandem loop

`tools/rgx-mcp/test/test-rgx-hello.mjs` drives the real server over the real MCP client SDK against the real [RGX-Hello](https://github.com/DonnieDice/RGX-Hello) repo — generate, validate, audit. If the reference addon drifts from the contract, the framework's own test fails. This loop has caught real shipped bugs (the declarative slider's `suffix` being silently dropped; the generator's hyphenated-name SavedVariables mismatch).

```bash
node test/test-rgx-hello.mjs /path/to/RGX-Hello
```

Source: [`tools/rgx-mcp/`](https://github.com/DonnieDice/RGX-Framework/tree/main/tools/rgx-mcp).

## Build MCP With The Runtime

Easy for humans to write is easy for agents to generate. `RGXAddon` is the
shared front door; the MCP must not invent a separate agent-only authoring
surface. When functionality ships, update the runtime, schema, declarative
docs, MCP validation/generation, and RGX-Hello coverage in the same change.
