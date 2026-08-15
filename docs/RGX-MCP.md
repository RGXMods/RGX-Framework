# RGX-MCP - Temporary Source Conformance Fixture

`tools/rgx-mcp/` is a temporary read-only [MCP](https://modelcontextprotocol.io) (Model Context Protocol) fixture used by source-tree CI to validate, audit, and generate declarative RGX addons against the framework's frozen Simplicity Contract. It is never part of the Lua/XML/media addon archive.

## Tools

| Tool | What it does |
|---|---|
| `rgx_validate_addon` | Validate an `RGXAddon` opts table (as JSON; Lua functions as `{"$lua":"function"}`) against `schemas/rgx-addon.schema.json`; flags contract-frozen `tier4` keys that don't run yet |
| `rgx_audit_lua` | Scan a `.lua` file or addon directory for unsafe patterns: raw `C_Timer`, manual `OnEvent` frames, `SLASH_` globals, unguarded `SetAttribute`, raw aura plumbing, and hook reassignment; RGXAuras consumers remain clean |
| `rgx_generate_addon` | Emit a contract-congruent addon Lua file using shipped keys, including deterministically ordered named `every` timers |
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

Run the transition implementation only from a source checkout. RGX-Framework
never publishes this fixture or any tooling archive. Public API/MCP/editor
tooling belongs to RGX Studio.

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
against a different framework tree. The published Framework addon contains no
MCP server. See [[Distribution]].

## The tandem loop

`tools/rgx-mcp/test/test-rgx-hello.mjs` drives the real server over the real MCP client SDK against the real [RGX-Hello](https://github.com/DonnieDice/RGX-Hello) repo. It parses the actual curried `RGXAddon` table as Lua 5.1, validates that complete options object, generates the matching supported surface including named timers, and audits the actual Lua tree. It also verifies that `every` is shipped while `on` remains Tier 4, and proves with paired fixtures that RGXAuras consumer code passes while raw aura event/API references are reported, including references passed through `pcall` or stored for later use. An unparseable Lua source fails the audit closed. Unknown or Tier 4 keys therefore fail instead of hiding behind a hand-maintained transcription.

```bash
node test/test-rgx-hello.mjs /path/to/RGX-Hello
```

Source: [`tools/rgx-mcp/`](https://github.com/DonnieDice/RGX-Framework/tree/main/tools/rgx-mcp).

## Contract Congruence

Easy for humans to write is easy for agents to generate. `RGXAddon` is the
shared front door; the MCP must not invent a separate agent-only authoring
surface. When functionality ships, update the runtime, schema, declarative
docs, MCP validation/generation, and RGX-Hello coverage in the same change.
