#!/usr/bin/env node
// rgx-mcp — MCP server for RGX-Framework addon development.
//
// Read-only by design (Tier 5 of the framework roadmap): validates declarative
// addon tables against the shipped JSON schema, audits Lua source for the
// unsafe patterns the framework exists to prevent, generates contract-congruent
// addon skeletons, and serves the Simplicity Contract plus the approved module
// API catalog as context.
//
// Lives in the framework repo at tools/rgx-mcp/ (excluded from the packaged
// addon zip) so anyone with the framework checkout has the tool. Dependency
// direction (hard rule): the tool reads the framework's docs/schema; the
// addon runtime never references tools/. Override the framework root with
// RGX_FRAMEWORK_PATH if running from elsewhere (default: this checkout).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

function compareUtf8(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}
import { z } from "zod";
import Ajv2020 from "ajv/dist/2020.js";

import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createDefinitionEngine } from "../../../contract/engine/definition.mjs";
import { generateAddonLua } from "../../../contract/engine/generate-addon.mjs";
import { createValidateAddon } from "../../../contract/engine/validate-addon.mjs";
import { createAuditLua } from "../../../contract/engine/audit-lua.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const definitionSchema = JSON.parse(readFileSync(join(HERE, "../../../contract/schemas/rgx-definition.schema.json"), "utf8"));
const { normalizeDefinition, importDefinition, exportDefinition, createDefinitionSession }
  = createDefinitionEngine(definitionSchema);
// tools/rgx-mcp/src/ -> the framework repo root is three levels up
const FRAMEWORK = resolve(
  process.env.RGX_FRAMEWORK_PATH ?? join(HERE, "..", "..", "..")
);

function frameworkFile(rel) {
  return readFileSync(join(FRAMEWORK, rel), "utf8");
}

// ── WoW API dump search (synced local reference, deterministic; no live data) ─

const DUMP_ROOT = join(FRAMEWORK, ".reference", "wow-api-dump");
const dumpCaches = new Map();

function loadDumpFlavor(flavorId) {
  const manifest = JSON.parse(readFileSync(join(DUMP_ROOT, "manifest.json"), "utf8"));
  const entry = manifest.flavors.find((flavor) => flavor.id === flavorId);
  if (!entry || !entry.dumpRef || !entry.path) {
    throw new Error(`Dump flavor '${flavorId}' is unavailable upstream (documented gap) or not synced.`);
  }
  const flavorRoot = join(DUMP_ROOT, flavorId);
  let statsRoot;
  try {
    statsRoot = lstatSync(flavorRoot);
  } catch {
    throw new Error(`Dump flavor '${flavorId}' is not synced. Run tools/reference/sync-wow-api-dump.mjs.`);
  }
  const stamp = Number(statSafeMtime(flavorRoot));
  const cached = dumpCaches.get(flavorId);
  if (cached && cached.stamp === stamp) return cached;

  const resources = join(flavorRoot, "Resources");
  const catalog = { stamp, meta: { flavor: flavorId, build: entry.build, dumpRef: entry.dumpRef, commit: entry.commit }, lines: [] };
  const stack = [resources];
  for (let dir; (dir = stack.pop());) {
    for (const file of readdirSync(dir)) {
      const full = join(dir, file);
      const st = lstatSync(full);
      if (st.isDirectory()) { stack.push(full); continue; }
      if (!file.endsWith(".lua")) continue;
      const body = readFileSync(full, "utf8");
      catalog.lines.push({ file: relative(flavorRoot, full).replaceAll("\\", "/"), body });
    }
  }
  catalog.lines.sort((a, b) => compareUtf8(a.file, b.file));
  dumpCaches.set(flavorId, catalog);
  return catalog;
}

function statSafeMtime(path) {
  try { return lstatSync(path).mtimeMs; } catch { return 0; }
}

// ── Schema (loaded from the framework checkout — single source of truth) ─────

let schemaCache = null;
function getSchema() {
  if (!schemaCache) {
    schemaCache = JSON.parse(frameworkFile("contract/schemas/rgx-addon.schema.json"));
  }
  return schemaCache;
}

let validatorCache = null;
function getValidator() {
  if (!validatorCache) {
    validatorCache = createValidateAddon({ schema: getSchema(), Ajv: Ajv2020 });
  }
  return validatorCache;
}

// ── Approved module API catalog (issue #7; checked in, CI-verified) ─────────

let apiCatalogCache = null;
function getApiCatalog() {
  if (!apiCatalogCache) {
    apiCatalogCache = JSON.parse(frameworkFile("contract/schemas/rgx-api.catalog.json"));
  }
  return apiCatalogCache;
}

// Audit detectors live in contract/engine/audit-lua.mjs (verbatim copy; no behavior change).

// Generation moved to contract/engine/generate-addon.mjs (verbatim copy, no behavior change).

// ── Server ────────────────────────────────────────────────────────────────────

import luaparse from "luaparse";
const { auditLuaSource, walkLuaFiles } = createAuditLua(luaparse.parse);
const server = new McpServer({ name: "rgx-mcp", version: "0.1.0" });

function selectedDefinitionSchema() {
  const selected = JSON.parse(frameworkFile("contract/schemas/rgx-definition.schema.json"));
  if (!isDeepStrictEqual(selected, definitionSchema)) {
    throw new Error("Definition engine does not match the selected framework contract");
  }
  return selected;
}

server.tool(
  "rgx_edit_definition",
  "Normalize, import, patch, or export one version-1 label definition using shared authoring logic. Source-development slice; not evidence of support in a released addon. Data only: never executes Lua or writes files.",
  { operation: z.enum(["normalize", "import", "patch", "export"]),
    definition: z.record(z.any()).optional(), wire: z.string().optional(), changes: z.record(z.any()).optional() },
  async ({ operation, definition, wire, changes }) => {
    try {
      selectedDefinitionSchema();
      let normalized;
      if (operation === "import") normalized = importDefinition(wire);
      else if (operation === "patch") {
        const session = createDefinitionSession(definition);
        normalized = session.patch(changes);
      } else normalized = normalizeDefinition(definition);
      return { content: [{ type: "text", text: JSON.stringify({ definition: normalized,
        wire: exportDefinition(normalized), sourceOnly: true, kinds: ["label"], version: 1 }) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error.message }] };
    }
  }
);

server.resource("rgx-definition-schema", "rgx://schemas/definition",
  { description: "Version-1 source-development label definition schema", mimeType: "application/json" },
  async () => ({ contents: [{ uri: "rgx://schemas/definition", mimeType: "application/json",
    text: JSON.stringify(selectedDefinitionSchema(), null, 2) }] }));

server.tool(
  "rgx_validate_addon",
  "Validate a declarative RGXAddon opts table (as JSON; Lua functions as {\"$lua\":\"function\"}) against the framework's shipped schema. Reports schema errors and flags tier4-only keys.",
  { opts: z.record(z.any()).describe("The RGXAddon opts table as JSON") },
  async ({ opts }) => {
    const validate = getValidator();
    const result = validate(opts);
    const report = {
      ...result,
      note: result.tier4KeysUsed.length
        ? "tier4 keys are contract-frozen but NOT implemented yet — they validate but will not run on the current framework."
        : undefined,
    };
    return { content: [{ type: "text", text: JSON.stringify(report, null, 2) }] };
  }
);

server.tool(
  "rgx_audit_lua",
  "Audit a Lua file or directory for unsafe WoW patterns RGX-Framework exists to prevent (raw C_Timer, manual event frames, SLASH_ globals, unguarded SetAttribute, raw aura plumbing, raw hook reassignment). Deterministic; read-only.",
  { path: z.string().describe("Absolute path to a .lua file or an addon directory") },
  async ({ path }) => {
    const st = lstatSync(path);
    if (st.isSymbolicLink()) throw new Error("symbolic-link audit roots are not supported");
    const findings = [];
    if (st.isDirectory()) {
      for (const f of walkLuaFiles(path)) {
        findings.push(...auditLuaSource(readFileSync(f, "utf8"), relative(path, f)));
      }
    } else {
      findings.push(...auditLuaSource(readFileSync(path, "utf8"), path));
    }
    findings.sort((a, b) => compareUtf8(a.file, b.file)
      || a.line - b.line
      || compareUtf8(a.detector, b.detector));
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            { findings, total: findings.length, clean: findings.length === 0 },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.tool(
  "rgx_generate_addon",
  "Generate a complete, contract-congruent RGX addon Lua file using ONLY shipped keys (RGXAddon curried form, table-form controls).",
  {
    name: z.string().describe("Addon name, e.g. MyAddon"),
    dbName: z.string().optional()
      .describe("SavedVariables global override. Defaults to `${name}DB` with non-identifier characters stripped (e.g. \"RGX-Hello\" -> \"RGXHelloDB\") -- only pass this to use something else."),
    slash: z.string().optional().describe("Slash command (default: lowercase name)"),
    minimap: z.boolean().optional(),
    every: z.record(
      z.string().regex(/^(?=.*[^ ])[^\x00-\x1f\x7f]+$/, "timer name must be printable and contain a non-space character"),
      z.number().positive().finite()
    ).optional().describe("Named repeating timers as timer name -> seconds"),
    db: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
      .describe("Saved-setting defaults"),
    toggles: z.array(z.string()).optional().describe("db keys to expose as toggles"),
    columns: z.number().int().min(1).max(3).optional()
      .describe("Local option column-flow count (1-3); full declarative cards/pages remain target work"),
    sliders: z
      .array(z.object({
        key: z.string(),
        label: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        suffix: z.string().optional().describe('Appended to the displayed value, e.g. "%"'),
        valueDisplay: z.enum(["always", "hover", "none"]).optional(),
        progress: z.boolean().optional(),
      }))
      .optional(),
  },
  async (spec) => {
    const validate = getValidator();
    const opts = {};
    if (spec.every) {
      opts.every = Object.fromEntries(
        Object.entries(spec.every).map(([name, seconds]) => [name, [seconds, { $lua: "function" }]])
      );
    }
    if (spec.columns !== undefined) {
      opts.options = { columns: spec.columns };
    }
    const report = validate(opts);
    if (!report.valid || report.tier4KeysUsed.length) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: "Generation spec is not supported by the shipped RGX contract:\n" + JSON.stringify(report, null, 2),
        }],
      };
    }

    return { content: [{ type: "text", text: generateAddonLua(spec) }] };
  }
);

server.tool(
  "rgx_get_contract",
  "Return the Simplicity Contract source of truth: the JSON schema plus the shipped-surface reference (DECLARATIVE-API.md).",
  {},
  async () => ({
    content: [
      { type: "text", text: "== contract/schemas/rgx-addon.schema.json ==\n" + JSON.stringify(getSchema(), null, 2) },
      { type: "text", text: "== docs/DECLARATIVE-API.md ==\n" + frameworkFile("docs/DECLARATIVE-API.md") },
    ],
  })
);

server.tool(
  "rgx_get_api_catalog",
  "Return the approved RGX module API catalog (issue #7): per-module getter, global, owner, category, stability, flavors, enumerated methods, and review fields. Optional exact module id filters to one entry. Read-only; the catalog is checked in and verified by framework CI.",
  { module: z.string().optional().describe('Exact module id (for example "auras") to return a single entry') },
  async ({ module: moduleId }) => {
    const catalog = getApiCatalog();
    if (moduleId === undefined) {
      return { content: [{ type: "text", text: JSON.stringify(catalog, null, 2) }] };
    }
    const entries = catalog.entries.filter((entry) => entry.module === moduleId);
    if (!entries.length) {
      const known = catalog.entries.map((entry) => entry.module).sort().join(", ");
      return { isError: true, content: [{ type: "text", text: `Unknown module '${moduleId}'. Known modules: ${known}` }] };
    }
    return { content: [{ type: "text", text: JSON.stringify({ ...catalog, entries }, null, 2) }] };
  }
);

server.resource(
  "rgx-schema",
  "rgx://schemas/addon",
  { description: "RGXAddon opts JSON Schema (x-rgx-ships annotated)", mimeType: "application/json" },
  async () => ({
    contents: [
      { uri: "rgx://schemas/addon", mimeType: "application/json", text: JSON.stringify(getSchema(), null, 2) },
    ],
  })
);

server.resource(
  "rgx-declarative-api",
  "rgx://docs/declarative-api",
  { description: "Shipped declarative surface reference", mimeType: "text/markdown" },
  async () => ({
    contents: [
      { uri: "rgx://docs/declarative-api", mimeType: "text/markdown", text: frameworkFile("docs/DECLARATIVE-API.md") },
    ],
  })
);

server.resource(
  "rgx-api-catalog",
  "rgx://schemas/api-catalog",
  { description: "Approved module API catalog (getters, methods, review fields); checked in and CI-verified", mimeType: "application/json" },
  async () => ({
    contents: [
      { uri: "rgx://schemas/api-catalog", mimeType: "application/json", text: frameworkFile("contract/schemas/rgx-api.catalog.json") },
    ],
  })
);

server.tool(
  "rgx_search_wow_api",
  "Deterministic substring search of the synced WoW API dumps (.reference/wow-api-dump/): globals, widget tables, templates, mixins, events, enums. Evidence-bearing output includes flavor, client build, dump branch and commit. Deterministic; never live-game state; confirm conclusions in the wow-ui-source mirror before runtime use.",
  { pattern: z.string().min(2).describe("Substring (case-insensitive by default) to search for"),
    flavor: z.enum(["retail", "classic-era", "tbc", "mists", "forever"]).optional(),
    case_sensitive: z.boolean().optional(), limit: z.number().int().min(1).max(100).optional() },
  async ({ pattern, flavor, case_sensitive, limit = 20 }) => {
    const manifest = JSON.parse(readFileSync(join(DUMP_ROOT, "manifest.json"), "utf8"));
    const flavors = flavor ? [flavor] : manifest.flavors.filter((entry) => entry.dumpRef).map((entry) => entry.id);
    const needle = case_sensitive ? pattern : pattern.toLowerCase();
    const results = [];
    for (const flavorId of flavors) {
      const catalog = loadDumpFlavor(flavorId);
      const { meta } = catalog;
      for (const page of catalog.lines) {
        const fileLines = page.body.split(/\r?\n/);
        for (let index = 0; index < fileLines.length; index += 1) {
          const text = fileLines[index];
          const hay = case_sensitive ? text : text.toLowerCase();
          if (!hay.includes(needle)) continue;
          results.push({ flavor: meta.flavor, build: meta.build, ref: `${meta.dumpRef}@${String(meta.commit).slice(0, 12)}`,
            location: `${page.file}:${index + 1}`, line: text.trim().slice(0, 200) });
          if (results.length >= limit) break;
        }
        if (results.length >= limit) break;
      }
      if (results.length >= limit) break;
    }
    return { content: [{ type: "text", text: JSON.stringify({
      query: pattern, results, limit,
      synced_from: "Ketho/BlizzardInterfaceResources (client-state dump; confirmation in wow-ui-source before runtime use)",
      missing_flavors: manifest.flavors.filter((entry) => !entry.dumpRef).map((entry) => entry.id),
    }, null, 2) }] };
  }
);

server.resource(
  "rgx-wow-api-dump-manifest",
  "rgx://frames/wow-api-dump",
  { description: "Synced WoW API dump provenance (branch/commit/build per flavor)", mimeType: "application/json" },
  async () => ({
    contents: [{
      uri: "rgx://frames/wow-api-dump", mimeType: "application/json",
      text: readFileSync(join(DUMP_ROOT, "manifest.json"), "utf8"),
    }],
  })
);

const transport = new StdioServerTransport();
await server.connect(transport);
