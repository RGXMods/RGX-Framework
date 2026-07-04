# RGX-MCP — the framework's MCP server

`tools/rgx-mcp/` is a read-only [MCP](https://modelcontextprotocol.io) (Model Context Protocol) server that lets AI agents (Claude Code, etc.) validate, audit, and generate declarative RGX addons against the framework's frozen Simplicity Contract. **It ships inside the packaged addon zip** — anyone who installs RGX-Framework and wants to learn addon development already has it on hand.

## Tools

| Tool | What it does |
|---|---|
| `rgx_validate_addon` | Validate an `RGXAddon` opts table (as JSON; Lua functions as `{"$lua":"function"}`) against `schemas/rgx-addon.schema.json`; flags contract-frozen `tier4` keys that don't run yet |
| `rgx_audit_lua` | Scan a `.lua` file or addon directory for the unsafe patterns the framework prevents: raw `C_Timer`, manual `OnEvent` frames, `SLASH_` globals, unguarded `SetAttribute`, secret-aura field comparisons, raw hook reassignment |
| `rgx_generate_addon` | Emit a complete contract-congruent addon file using only shipped keys (`dbName` override, `label`/`suffix` on sliders supported) |
| `rgx_get_contract` | Return the schema + shipped-surface reference for agent context |

## Resources

- `rgx://schemas/addon` — the annotated JSON Schema
- `rgx://docs/declarative-api` — the shipped declarative surface reference

## Setup

```bash
cd Interface/AddOns/RGX-Framework/tools/rgx-mcp   # or your repo checkout
npm install
```

Claude Code (`.mcp.json` or `claude mcp add`):

```json
{
  "mcpServers": {
    "rgx": { "command": "node", "args": ["tools/rgx-mcp/src/server.js"] }
  }
}
```

The framework repo ships this in `.mcp.json` already. The schema and API reference are read live from the enclosing checkout; set `RGX_FRAMEWORK_PATH` to run against a different framework tree.

## The tandem loop

`tools/rgx-mcp/test/test-rgx-hello.mjs` drives the real server over the real MCP client SDK against the real [RGX-Hello](https://github.com/DonnieDice/RGX-Hello) repo — generate, validate, audit. If the reference addon drifts from the contract, the framework's own test fails. This loop has caught real shipped bugs (the declarative slider's `suffix` being silently dropped; the generator's hyphenated-name SavedVariables mismatch).

```bash
node test/test-rgx-hello.mjs /path/to/RGX-Hello
```

Source: [`tools/rgx-mcp/`](https://github.com/DonnieDice/RGX-Framework/tree/main/tools/rgx-mcp).
