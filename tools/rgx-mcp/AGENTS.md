# Agent Guidance — tools/rgx-mcp

Scoped agent guidance for this tool. **Read [`../../AGENTS.md`](../../AGENTS.md)
first — it is the harness-independent project entry point.** These instructions
supplement its framework ownership, safety, contract, and verification rules.

## What this is

The temporary source-only MCP conformance fixture for RGX-Framework. It validates, audits, and generates declarative RGX addons against the human **Simplicity Contract** (`docs/DECLARATIVE-API.md`) and its machine form (`schemas/rgx-addon.schema.json`). It lives under `tools/` for source-tree CI, is private package metadata, and is excluded from Framework releases. RGX-Framework owns the reusable contract, validation, generation, and editor infrastructure; consumer tools use that foundation. Future Studio plans do not establish shipped support or transfer ownership of the shared contract.

## Hard rules

- **Runtime first.** The Lua interface consumed by addons is the framework's
  primary product. This stdio MCP adapter is optional developer tooling, not
  that runtime interface, a game bridge, or a public HTTP service.
- **Preserve current coverage.** The server currently contains validation,
  generation, and audit implementation as well as protocol handling. Extract
  reusable contract logic only with equivalent conformance tests; the shared
  engine is tracked in framework issue #8, not already shipped as a package.

- **Read-only first.** Tools inspect and generate text; they never write to repos, never commit, never call the game. Write-capable tools require an explicit roadmap decision.
- **Dependency direction is one-way.** The tool reads the framework's schema/docs at runtime (repo root by default; `RGX_FRAMEWORK_PATH` to override). Never duplicate the schema into `tools/` (one source of truth), and the addon runtime (`core/`, `modules/`, XML, TOC) must never reference `tools/`.
- **Congruence over invention.** Every tool behavior derives from the contract/schema. A new detector or generator feature must correspond to a rule the framework actually enforces. If the contract does not cover it, update runtime, `docs/DECLARATIVE-API.md`, schema, fixture, and RGX-Hello together.
- **Generated code uses shipped keys only** (`x-rgx-ships: "today"`), in `RGXAddon "Name" { }` form. Never generate tier4 syntax as if it runs.

## Structure

```
src/server.js   — the whole server (McpServer over stdio): 4 tools, 2 resources
package.json    — deps: @modelcontextprotocol/sdk, ajv (2020-12), luaparse, zod
```

## Conventions

- Plain Node ESM, no build step, no TypeScript — the simplicity ethos applies to the tooling too.
- Detectors are deterministic. Simple patterns use line regexes with comments skipped; restricted-aura plumbing uses a Lua 5.1 AST so aliases, scope, bare calls, and parse failures remain visible. Each finding carries actionable `advice` naming the RGX replacement.
- Keep the audit detector list in sync with the framework's "make the bug unrepresentable" thesis (raw C_Timer, manual OnEvent frames, SLASH_ globals, unguarded SetAttribute, raw aura plumbing, raw hook reassignment).
