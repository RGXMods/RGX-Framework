# rgx-mcp

MCP server for [RGX-Framework](https://github.com/DonnieDice/RGX-Framework) addon development. Lets AI agents (Claude Code, etc.) validate, audit, and generate declarative RGX addons against the framework's frozen **Simplicity Contract**.

**Read-only by design.** This tool inspects and generates — it never edits repos, never commits, never touches the game.

## Dependency direction (hard rule)

```
rgx-mcp            depends on →  RGX-Framework docs + schema (read at runtime)
consumer addons    depend on  →  RGX-Framework
RGX-Framework      depends on →  nothing (and never on rgx-mcp)
```

This tool lives at `tools/rgx-mcp/` **inside the framework repo** — anyone with the checkout has it — and is excluded from the packaged addon zip via `.pkgmeta`, so players never download it. The schema and API reference are read live from the enclosing checkout (one source of truth); set `RGX_FRAMEWORK_PATH` only when running against a different framework tree.

## Tools

| Tool | What it does |
|---|---|
| `rgx_validate_addon` | Validate an RGXAddon opts table (JSON; Lua functions as `{"$lua":"function"}`) against `schemas/rgx-addon.schema.json`; flags contract-frozen `tier4` keys that don't run yet |
| `rgx_audit_lua` | Scan a `.lua` file or addon directory for the unsafe patterns the framework prevents: raw `C_Timer`, manual `OnEvent` frames, `SLASH_` globals, unguarded `SetAttribute`, secret-aura field comparisons, raw hook reassignment. Deterministic |
| `rgx_generate_addon` | Emit a complete contract-congruent addon file using only shipped keys (`RGXAddon "Name" { ... }`) |
| `rgx_get_contract` | Return the schema + shipped-surface reference for agent context |

## Resources

- `rgx://schemas/addon` — the annotated JSON Schema
- `rgx://docs/declarative-api` — the shipped declarative surface reference

## Setup

```bash
npm install
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

The framework repo ships this in `.mcp.json` already — Claude Code sessions in the repo get the `rgx_*` tools automatically after `npm install` in `tools/rgx-mcp/`.

## Status

v0.1.0 — Tier 5 #15 of the framework roadmap. Verified over live stdio JSON-RPC: initialize handshake, `tools/list`, and `rgx_validate_addon` (schema rejects unknown keys; `tier4` keys are flagged as contract-frozen-but-not-implemented). The audit detectors mirror the manual audits performed on the framework, BLU, and BPU.

## License

MIT
