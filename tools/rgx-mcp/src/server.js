#!/usr/bin/env node
// rgx-mcp — MCP server for RGX-Framework addon development.
//
// Read-only by design (Tier 5 of the framework roadmap): validates declarative
// addon tables against the shipped JSON schema, audits Lua source for the
// unsafe patterns the framework exists to prevent, generates contract-congruent
// addon skeletons, and serves the Simplicity Contract as context.
//
// Lives in the framework repo at tools/rgx-mcp/ (excluded from the packaged
// addon zip) so anyone with the framework checkout has the tool. Dependency
// direction (hard rule): the tool reads the framework's docs/schema; the
// addon runtime never references tools/. Override the framework root with
// RGX_FRAMEWORK_PATH if running from elsewhere (default: this checkout).

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Ajv2020 from "ajv/dist/2020.js";
import luaparse from "luaparse";
import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { createDefinitionEngine } from "../../../contract/engine/definition.mjs";
import { generateAddonLua } from "../../../contract/engine/generate-addon.mjs";

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
    const ajv = new Ajv2020({ allErrors: true, strict: false, strictNumbers: true });
    validatorCache = ajv.compile(getSchema());
  }
  return validatorCache;
}

// ── Lua audit detectors (deterministic, mirror the framework audits) ─────────

const DETECTORS = [
  {
    id: "raw_c_timer",
    pattern: /C_Timer\.(After|NewTimer|NewTicker)\s*\(/,
    advice:
      "Use RGX:After / RGX:Every instead of raw C_Timer — framework timers are budgeted and diagnosable. (Inside RGX-Framework itself, a guarded `elseif C_Timer` fallback after RGX:After is the one allowed exception.)",
  },
  {
    id: "manual_event_frame",
    pattern: /SetScript\s*\(\s*["']OnEvent["']/,
    advice:
      "Do not hand-roll event frames. Register through RGX:RegisterEvent / RGX:RegisterUnitEvent — dispatch is pcall-wrapped and frame registration is combat-lockdown safe.",
  },
  {
    id: "raw_slash_global",
    pattern: /(^|\s)SLASH_[A-Z0-9_]+\d+\s*=|_G\[\s*["']SLASH_/,
    advice:
      "Use RGX:RegisterSlashCommand (or the `slash` key of RGXAddon) instead of writing SLASH_ globals.",
  },
  {
    id: "setattribute_combat_risk",
    pattern: /:SetAttribute\s*\(/,
    advice:
      "SetAttribute on secure frames taints during combat lockdown, and pcall does NOT prevent taint. Guard with InCombatLockdown() and defer to PLAYER_REGEN_ENABLED (see BPU's SafeSetButtonAttribute pattern).",
  },
  {
    id: "raw_hook_reassignment",
    pattern: /_G\.[A-Za-z_]+\s*=\s*function|_G\[["'][A-Za-z_]+["']\]\s*=\s*function/,
    advice:
      "Reassigning a global function is a raw hook and can taint secure paths. Use hooksecurefunc via RGX:Hook for post-hooks.",
  },
];

const SECRET_AURA_ADVICE =
  "Use RGXAuras queries/watchers instead of raw UNIT_AURA, UnitAura, AuraUtil, or C_UnitAuras plumbing. RGXAuras fails closed and withholds restricted AuraData; raw event payloads remain unsanitized. pcall catches errors but does not prevent taint.";

function walkLuaAst(node, visit) {
  if (!node || typeof node !== "object") return;
  if (typeof node.type === "string") visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) walkLuaAst(child, visit);
    } else if (value && typeof value === "object" && value !== node.loc) {
      walkLuaAst(value, visit);
    }
  }
}

function auditSecretAuraSource(source, file) {
  let ast;
  try {
    ast = luaparse.parse(source, {
      luaVersion: "5.1",
      locations: true,
      ranges: true,
      scope: true,
      encodingMode: "x-user-defined",
    });
  } catch (error) {
    const line = Number.isInteger(error?.line) ? error.line : 1;
    return [{
      file,
      line,
      detector: "lua_parse_error",
      excerpt: (source.split(/\r?\n/)[line - 1] ?? "").trim().slice(0, 160),
      advice: "Fix the Lua 5.1 syntax error; the source audit fails closed when it cannot parse a file.",
    }];
  }

  let nextDeclarationId = 1;
  const nodeScopes = new WeakMap();
  const declarationKeys = new WeakMap();
  const createScope = (parent) => ({ parent, declarations: new Map() });
  const rootScope = createScope(null);
  const declare = (scope, node, position = node.range?.[0] ?? 0) => {
    const key = `local:${nextDeclarationId++}:${node.name}`;
    const declarations = scope.declarations.get(node.name) ?? [];
    declarations.push({ key, position });
    scope.declarations.set(node.name, declarations);
    declarationKeys.set(node, key);
    nodeScopes.set(node, scope);
  };
  const annotate = (node, scope) => {
    if (!node || typeof node !== "object") return;
    nodeScopes.set(node, scope);

    if (node.type === "Chunk") {
      for (const statement of node.body ?? []) annotate(statement, scope);
      return;
    }
    if (node.type === "LocalStatement") {
      for (const value of node.init ?? []) annotate(value, scope);
      for (const variable of node.variables ?? []) declare(scope, variable, node.range?.[1] ?? 0);
      return;
    }
    if (node.type === "FunctionDeclaration") {
      if (node.identifier) {
        if (node.isLocal) declare(scope, node.identifier);
        else annotate(node.identifier, scope);
      }
      const functionScope = createScope(scope);
      for (const parameter of node.parameters ?? []) {
        if (parameter.type === "Identifier") declare(functionScope, parameter, node.range?.[0] ?? 0);
        else annotate(parameter, functionScope);
      }
      for (const statement of node.body ?? []) annotate(statement, functionScope);
      return;
    }
    if (node.type === "NumericForStatement" || node.type === "GenericForStatement") {
      annotate(node.start, scope);
      annotate(node.end, scope);
      annotate(node.step, scope);
      for (const iterator of node.iterators ?? []) annotate(iterator, scope);
      const loopScope = createScope(scope);
      if (node.variable) declare(loopScope, node.variable, node.range?.[0] ?? 0);
      for (const variable of node.variables ?? []) declare(loopScope, variable, node.range?.[0] ?? 0);
      for (const statement of node.body ?? []) annotate(statement, loopScope);
      return;
    }
    if (node.type === "WhileStatement") {
      annotate(node.condition, scope);
      const bodyScope = createScope(scope);
      for (const statement of node.body ?? []) annotate(statement, bodyScope);
      return;
    }
    if (node.type === "RepeatStatement") {
      const bodyScope = createScope(scope);
      for (const statement of node.body ?? []) annotate(statement, bodyScope);
      annotate(node.condition, bodyScope);
      return;
    }
    if (node.type === "DoStatement") {
      const bodyScope = createScope(scope);
      for (const statement of node.body ?? []) annotate(statement, bodyScope);
      return;
    }
    if (node.type === "IfStatement") {
      for (const clause of node.clauses ?? []) {
        nodeScopes.set(clause, scope);
        annotate(clause.condition, scope);
        const clauseScope = createScope(scope);
        for (const statement of clause.body ?? []) annotate(statement, clauseScope);
      }
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === "loc" || key === "range") continue;
      if (Array.isArray(value)) {
        for (const child of value) annotate(child, scope);
      } else if (value && typeof value === "object") {
        annotate(value, scope);
      }
    }
  };
  annotate(ast, rootScope);

  const identifierKey = (node) => {
    if (node?.type !== "Identifier") return undefined;
    if (declarationKeys.has(node)) return declarationKeys.get(node);
    if (node.isLocal !== true) return `global:${node.name}`;
    const position = node.range?.[0] ?? Number.MAX_SAFE_INTEGER;
    let scope = nodeScopes.get(node);
    while (scope) {
      const declarations = scope.declarations.get(node.name) ?? [];
      for (let index = declarations.length - 1; index >= 0; index--) {
        if (declarations[index].position < position) return declarations[index].key;
      }
      scope = scope.parent;
    }
    return `local:unresolved:${node.name}`;
  };

  const directPath = (node) => {
    if (node?.type === "Identifier") return [identifierKey(node)];
    if (node?.type === "MemberExpression") {
      const base = directPath(node.base);
      return base && node.identifier?.name ? [...base, node.identifier.name] : undefined;
    }
    if (node?.type === "IndexExpression" && node.index?.type === "StringLiteral") {
      const base = directPath(node.base);
      return base ? [...base, node.index.value] : undefined;
    }
    return undefined;
  };
  const syntaxPath = (node) => {
    if (node?.type === "Identifier") return [node.name];
    if (node?.type === "MemberExpression") {
      const base = syntaxPath(node.base);
      return base && node.identifier?.name ? [...base, node.identifier.name] : undefined;
    }
    if (node?.type === "IndexExpression" && node.index?.type === "StringLiteral") {
      const base = syntaxPath(node.base);
      return base ? [...base, node.index.value] : undefined;
    }
    return undefined;
  };

  const assignments = [];
  walkLuaAst(ast, (node) => {
    if (node.type === "LocalStatement" || node.type === "AssignmentStatement") {
      const variables = node.variables ?? [];
      const values = node.init ?? [];
      for (let index = 0; index < Math.min(variables.length, values.length); index++) {
        const path = directPath(variables[index]);
        if (path) {
          assignments.push({
            key: path.join("."),
            value: values[index],
            position: node.range?.[0] ?? 0,
          });
        }
      }
    }
  });

  const latestAssignment = (key, before) => {
    let latest;
    for (const assignment of assignments) {
      if (assignment.key === key && assignment.position < before
          && (!latest || assignment.position >= latest.position)) {
        latest = assignment;
      }
    }
    return latest;
  };

  const staticStrings = (node, before, seen = new Set()) => {
    if (node?.type === "StringLiteral") return new Set([node.value]);
    const key = directPath(node)?.join(".");
    if (!key || seen.has(key)) return new Set();
    const assignment = latestAssignment(key, before);
    if (!assignment) return new Set();
    const nextSeen = new Set(seen);
    nextSeen.add(key);
    return staticStrings(assignment.value, assignment.position, nextSeen);
  };

  const resolvedPath = (node, before, seen = new Set()) => {
    if (node?.type === "Identifier") {
      const key = identifierKey(node);
      if (seen.has(key)) return [key];
      const assignment = latestAssignment(key, before);
      if (!assignment) return [key];
      const nextSeen = new Set(seen);
      nextSeen.add(key);
      return resolvedPath(assignment.value, assignment.position, nextSeen) ?? [key];
    }
    if (node?.type === "MemberExpression") {
      const base = resolvedPath(node.base, before, seen);
      return base && node.identifier?.name ? [...base, node.identifier.name] : undefined;
    }
    if (node?.type === "IndexExpression") {
      const base = resolvedPath(node.base, before, seen);
      const indexes = [...staticStrings(node.index, before)];
      return base && indexes.length === 1 ? [...base, indexes[0]] : undefined;
    }
    return undefined;
  };

  const riskyLines = new Set();
  walkLuaAst(ast, (node) => {
    if (node.type === "Identifier" && node.isLocal === false
        && (node.name === "C_UnitAuras" || node.name === "UnitAura" || node.name === "AuraUtil")) {
      riskyLines.add(node.loc.start.line);
    }
    if (node.type === "MemberExpression" || node.type === "IndexExpression") {
      const path = syntaxPath(node);
      let root = node;
      while (root?.type === "MemberExpression" || root?.type === "IndexExpression") root = root.base;
      if (root?.type === "Identifier" && root.name === "_G" && root.isLocal === false
          && ["C_UnitAuras", "UnitAura", "AuraUtil"].includes(path?.[1])) {
        riskyLines.add(node.loc.start.line);
      }
    }

    if (node.type !== "CallExpression"
        && node.type !== "StringCallExpression"
        && node.type !== "TableCallExpression") return;
    const position = node.range?.[0] ?? Number.MAX_SAFE_INTEGER;
    const path = resolvedPath(node.base, position);
    if (!path) return;
    const last = path[path.length - 1];
    const args = node.type === "StringCallExpression" ? [node.argument] : (node.arguments ?? []);
    const rawAuraEvent = (last === "RegisterEvent" || last === "RegisterUnitEvent")
      && args.some((argument) => staticStrings(argument, position).has("UNIT_AURA"));
    if (rawAuraEvent) riskyLines.add(node.loc.start.line);
  });

  const lines = source.split(/\r?\n/);
  return [...riskyLines].sort((a, b) => a - b).map((line) => ({
    file,
    line,
    detector: "raw_aura_plumbing",
    excerpt: (lines[line - 1] ?? "").trim().slice(0, 160),
    advice: SECRET_AURA_ADVICE,
  }));
}

function auditLuaSource(source, file) {
  const findings = auditSecretAuraSource(source, file);
  const lines = source.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*--/.test(line)) continue; // skip comments
    for (const d of DETECTORS) {
      if (d.pattern.test(line)) {
        findings.push({
          file,
          line: i + 1,
          detector: d.id,
          excerpt: line.trim().slice(0, 160),
          advice: d.advice,
        });
      }
    }
  }
  return findings;
}

function* walkLuaFiles(root) {
  const skip = new Set([".git", "graphify-out", "node_modules", "docs"]);
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of readdirSync(dir).sort(compareUtf8).reverse()) {
      if (skip.has(name)) continue;
      const p = join(dir, name);
      const st = lstatSync(p);
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) stack.push(p);
      else if (name.endsWith(".lua")) yield p;
    }
  }
}

// ── Addon generation (shipped keys only — contract-congruent) ────────────────

// Generation moved to contract/engine/generate-addon.mjs (verbatim copy, no behavior change).

// ── Server ────────────────────────────────────────────────────────────────────

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
    const valid = validate(opts);
    const tier4Used = ["on"].filter((k) => k in opts);
    if (opts.options && typeof opts.options === "object" && "columns" in opts.options) {
      tier4Used.push("options.columns");
    }
    if (opts.options && typeof opts.options === "object") {
      for (const [tab, controls] of Object.entries(opts.options)) {
        if (!Array.isArray(controls)) continue;
        controls.forEach((control, index) => {
          if (typeof control === "string") tier4Used.push(`options.${tab}[${index}]`);
        });
      }
    }
    const report = {
      valid,
      errors: validate.errors ?? [],
      tier4KeysUsed: tier4Used,
      note: tier4Used.length
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
    sliders: z
      .array(z.object({
        key: z.string(),
        label: z.string().optional(),
        min: z.number().optional(),
        max: z.number().optional(),
        suffix: z.string().optional().describe('Appended to the displayed value, e.g. "%"'),
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
    if (!validate(opts)) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: "Generation spec is not supported by the shipped RGX contract:\n" + JSON.stringify(validate.errors, null, 2),
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
