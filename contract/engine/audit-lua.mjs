import { readFileSync, readdirSync, lstatSync } from "node:fs";
import { join, relative } from "node:path";

function compareUtf8(a, b) {
  return Buffer.compare(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

// Transport-independent Lua audit — verbatim move from tools/rgx-mcp/src/server.js.
// The detector policy belongs to the shared contract layer so MCP, CI, and the
// editor agree on what an unsafe pattern is.

// ── Lua audit detectors (deterministic, mirror the framework audits) ─────────

let _parseLua;
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
    // Lua strings contain bytes. Decode UTF-8 as a one-byte representation
    // for the parser; raw JS Unicode is not x-user-defined encoded input.
    // Keep excerpts in the original source and scope/range comparisons in
    // this consistent byte coordinate space.
    ast = _parseLua(Buffer.from(source, "utf8").toString("latin1"), {
      luaVersion: "5.1",
      locations: true,
      ranges: true,
      scope: true,
      encodingMode: "pseudo-latin1",
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

const _wrap = { auditLuaSource };
export function createAuditLua(parseLua) { _parseLua = parseLua; return { auditLuaSource: _wrap.auditLuaSource, walkLuaFiles }; }
