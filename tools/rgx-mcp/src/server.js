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

const HERE = fileURLToPath(new URL(".", import.meta.url));
// tools/rgx-mcp/src/ -> the framework repo root is three levels up
const FRAMEWORK = resolve(
  process.env.RGX_FRAMEWORK_PATH ?? join(HERE, "..", "..", "..")
);

function frameworkFile(rel) {
  return readFileSync(join(FRAMEWORK, rel), "utf8");
}

// ── Schema (loaded from the framework checkout — single source of truth) ─────

let schemaCache = null;
function getSchema() {
  if (!schemaCache) {
    schemaCache = JSON.parse(frameworkFile("schemas/rgx-addon.schema.json"));
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

function luaQuote(s) {
  return '"' + String(s).replace(/[\\"\x00-\x1f\x7f]/g, (char) => {
    if (char === "\\") return "\\\\";
    if (char === '"') return '\\"';
    return `\\${char.charCodeAt(0).toString().padStart(3, "0")}`;
  }) + '"';
}

function luaComment(s) {
  return String(s).replace(/[\x00-\x1f\x7f]/g, " ");
}

function compareUtf8(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

const LUA_RESERVED = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true",
  "until", "while",
]);

function luaKey(key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !LUA_RESERVED.has(key)
    ? key
    : `[${luaQuote(key)}]`;
}

// A hyphen (or other non-identifier character) in the addon name is valid
// in the name itself but would produce an odd SavedVariables global if
// concatenated as-is (e.g. "RGX-Hello" -> "RGX-HelloDB"). Strip anything
// that isn't a safe Lua identifier character for the auto-derived default,
// matching the precedent set by RGX-Hello's own hand-written core.lua
// (dbName = "RGXHelloDB").
function defaultDbName(name) {
  return name.replace(/[^A-Za-z0-9_]/g, "") + "DB";
}

function generateAddonLua(spec) {
  const name = spec.name;
  const dbName = spec.dbName || defaultDbName(name);
  const needsExplicitDbName = Boolean(spec.dbName) || /[^A-Za-z0-9_]/.test(name);
  const out = [];
  out.push(`-- ${name}.lua — generated by rgx-mcp against the RGX Simplicity Contract`);
  out.push(`-- TOC needs: ## RequiredDeps: RGX-Framework` +
    (spec.db ? `  and  ## SavedVariables: ${dbName}` : ""));
  out.push(`RGXAddon ${luaQuote(name)} {`);
  if (needsExplicitDbName && spec.db) out.push(`    dbName  = ${luaQuote(dbName)},`);
  out.push(`    slash   = ${luaQuote(spec.slash ?? name.toLowerCase())},`);
  if (spec.minimap) out.push(`    minimap = true,`);
  if (spec.db) {
    const entries = Object.entries(spec.db)
      .map(([k, v]) => `${k} = ${typeof v === "string" ? luaQuote(v) : v}`)
      .join(", ");
    out.push(`    db      = { ${entries} },`);
  }
  const timers = Object.entries(spec.every ?? {}).sort(([a], [b]) => compareUtf8(a, b));
  if (timers.length) {
    out.push(`    every   = {`);
    for (const [timerName, seconds] of timers) {
      out.push(`        ${luaKey(timerName)} = { ${seconds}, function(self, timer)`);
      out.push(`            -- Run ${luaComment(timerName)} every ${seconds} second${seconds === 1 ? "" : "s"}.`);
      out.push(`        end },`);
    }
    out.push(`    },`);
  }
  const controls = [];
  for (const t of spec.toggles ?? []) {
    controls.push(`            { toggle = ${luaQuote(t)} },`);
  }
  for (const s of spec.sliders ?? []) {
    const parts = [`slider = ${luaQuote(s.key)}`];
    if (s.label) parts.push(`label = ${luaQuote(s.label)}`);
    parts.push(`min = ${s.min ?? 0}`, `max = ${s.max ?? 100}`);
    if (s.suffix) parts.push(`suffix = ${luaQuote(s.suffix)}`);
    controls.push(`            { ${parts.join(", ")} },`);
  }
  if (controls.length) {
    out.push(`    options = {`);
    out.push(`        General = {`);
    out.push(...controls);
    out.push(`        },`);
    out.push(`    },`);
  }
  out.push(`    welcome = ${luaQuote(`loaded — /${spec.slash ?? name.toLowerCase()} for options`)},`);
  out.push(`}`);
  return out.join("\n");
}

// ── Server ────────────────────────────────────────────────────────────────────

const server = new McpServer({ name: "rgx-mcp", version: "0.1.0" });

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
      { type: "text", text: "== schemas/rgx-addon.schema.json ==\n" + JSON.stringify(getSchema(), null, 2) },
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

const transport = new StdioServerTransport();
await server.connect(transport);
