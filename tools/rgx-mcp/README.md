# rgx-mcp source conformance fixture

Temporary MCP fixture for [RGX-Framework](https://github.com/RGXMods/RGX-Framework) source-tree CI. It lets contributors validate, audit, and generate declarative RGX addons against the framework's frozen **Simplicity Contract**. It is private package metadata, not a separately published product.

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
| `rgx_audit_lua` | Scan a `.lua` file or addon directory for the unsafe patterns the framework prevents: raw `C_Timer`, manual `OnEvent` frames, `SLASH_` globals, unguarded `SetAttribute`, raw aura event/API plumbing, and hook reassignment. Deterministic |
| `rgx_generate_addon` | Emit a contract-congruent addon Lua file using shipped keys (`RGXAddon "Name" { ... }`), including named `every` timers |
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

`test/test-rgx-hello.mjs` drives the real server over the real MCP client SDK (stdio transport, no protocol reimplementation) against [RGX-Hello](https://github.com/RGXMods/RGX-Hello). It parses and validates the actual curried `RGXAddon` table, generates the matching supported surface with named timers, and audits the actual Lua tree. It verifies that `every` is shipped while `on` remains Tier 4, and uses paired fixtures to require RGXAuras consumer code to pass while raw aura plumbing fails. Unknown or Tier 4 keys fail directly.

```bash
node test/test-rgx-hello.mjs /path/to/RGX-Hello
```

## Status

v0.1.0 — transition fixture for the framework roadmap. Verified over live stdio JSON-RPC: initialize handshake and `tools/list`; generate, validate, and audit are exercised end-to-end against RGX-Hello, while `rgx_get_contract` exposes the same schema/docs used by those checks.

## Distribution

The MCP source is maintained temporarily with the framework contract for CI but
is not included in the published Framework archive. Run it only from a source
checkout with its tracked lockfile. Future public MCP/API/editor distribution
belongs to RGX Studio. Update runtime, schema, docs, and conformance tests together.

## License

MIT
