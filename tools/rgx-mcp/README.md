# rgx-mcp

MCP server for [RGX-Framework](https://github.com/DonnieDice/RGX-Framework) addon development. Lets AI agents (Claude Code, etc.) validate, audit, and generate declarative RGX addons against the framework's frozen **Simplicity Contract**.

**Read-only by design.** This tool inspects and generates — it never edits repos, never commits, never touches the game.

## Dependency direction (hard rule)

```
rgx-mcp            depends on →  RGX-Framework docs + schema (read at runtime)
consumer addons    depend on  →  RGX-Framework
RGX-Framework      depends on →  nothing (and never on rgx-mcp)
```

This transition tool lives at `tools/rgx-mcp/` **inside the framework source repo** for contract-conformance CI. It is not distributed as a Framework product. Public MCP/API/editor tooling belongs to RGX Studio. Set `RGX_FRAMEWORK_PATH` only when intentionally running against a different framework tree.

## Tools

| Tool | What it does |
|---|---|
| `rgx_validate_addon` | Validate an RGXAddon opts table (JSON; Lua functions as `{"$lua":"function"}`) against `schemas/rgx-addon.schema.json`; flags contract-frozen `tier4` keys that don't run yet |
| `rgx_audit_lua` | Scan a `.lua` file or addon directory for the unsafe patterns the framework prevents: raw `C_Timer`, manual `OnEvent` frames, `SLASH_` globals, unguarded `SetAttribute`, secret-aura field comparisons, raw hook reassignment. Deterministic |
| `rgx_generate_addon` | Emit a contract-congruent addon Lua file using shipped keys (`RGXAddon "Name" { ... }`) |
| `rgx_get_contract` | Return the schema + shipped-surface reference for agent context |

## Resources

- `rgx://schemas/addon` — the annotated JSON Schema
- `rgx://docs/declarative-api` — the shipped declarative surface reference

## Setup

Node.js 20 or newer is required.

```bash
npm ci --no-audit --no-fund
```

Claude Code (`.mcp.json` or `claude mcp add`):

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

Only the framework source checkout ships `.mcp.json`; published artifacts do not. Source-checkout agent sessions get the `rgx_*` tools after `npm ci` in `tools/rgx-mcp/`. The MCP follows the same simplicity rule as the runtime: agents should generate and validate the one-call `RGXAddon` form, not invent a more complex consumer pattern.

## Testing

`test/test-rgx-hello.mjs` drives the real server over the real MCP client SDK (stdio transport, no protocol reimplementation) and points it at the actual [RGX-Hello](https://github.com/DonnieDice/RGX-Hello) reference addon: generates a spec matching it, validates its real opts table, and audits its real Lua. This is how the `suffix` schema gap (sliders silently dropped it) and the generator's `dbName` blind spot on hyphenated names were both found and fixed.

```bash
node test/test-rgx-hello.mjs /path/to/RGX-Hello
```

## Status

v0.1.0 — Tier 5 #15 of the framework roadmap. Verified over live stdio JSON-RPC: initialize handshake, `tools/list`, and all three tools exercised end-to-end against a real shipped addon (see Testing above). The audit detectors mirror the manual audits performed on the framework, BLU, and BPU.

## Distribution

The MCP source is maintained temporarily with the framework contract for CI but
is not included in the published Framework archive. Run it only from a source
checkout with its tracked lockfile. Future public MCP/API/editor distribution
belongs to RGX Studio. Update runtime, schema, docs, and conformance tests together.

## License

MIT
