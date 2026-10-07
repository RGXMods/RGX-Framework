#!/usr/bin/env node
// CI architecture gate: every RGX.API.<name> has exactly one defining file,
// and runtime code never calls an RGX.API name nothing defines.
//
// RGX.API is the framework-owned mapping surface over the WoW client API.
// Two files defining the same name means the winner depends on XML load
// order: core/compat_api.lua loading after core/compat.lua silently replaced
// its normalized GetItemInfo/GetItemIcon with raw aliases until this check
// existed. One name, one owner.
//
// Usage: node tools/ci/api-ownership-check.mjs [rootDir]
import assert from "node:assert/strict";
import luaparse from "luaparse";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), "../..");
const xml = readFileSync(join(ROOT, "RGX-Framework.xml"), "utf8");
const runtimeFiles = [...xml.matchAll(/<Script[^>]*file="([^"]+\.lua)"/g)].map((m) => m[1]);
assert(runtimeFiles.length > 0, "no <Script> entries found in RGX-Framework.xml");

// RGX.API.<name> as a complete dotted member chain, or null for anything
// else (RGX.API itself, dynamic indexing, unrelated expressions).
function chainName(node) {
  if (!node || typeof node !== "object") return null;
  if (node.type === "Identifier") return node.name;
  if (
    node.type === "MemberExpression" &&
    node.indexer === "." &&
    node.identifier &&
    node.identifier.type === "Identifier"
  ) {
    const base = chainName(node.base);
    return base ? `${base}.${node.identifier.name}` : null;
  }
  return null;
}

function definedName(chain) {
  if (!chain || !chain.startsWith("RGX.API.")) return null;
  const rest = chain.slice("RGX.API.".length);
  if (!rest || rest.includes(".")) return null;
  return rest;
}

function referencedName(chain) {
  if (!chain || !chain.startsWith("RGX.API.")) return null;
  const rest = chain.slice("RGX.API.".length);
  if (!rest) return null;
  return rest.split(".")[0];
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
    return;
  }
  if (typeof node.type === "string") visit(node);
  for (const value of Object.values(node)) walk(value, visit);
}

// name -> file -> definition count (repeat definitions in one file are also
// an ownership failure).
const definitions = new Map();
const references = new Map();
function recordDefinition(name, rel) {
  if (!definitions.has(name)) definitions.set(name, new Map());
  const files = definitions.get(name);
  files.set(rel, (files.get(rel) || 0) + 1);
}
for (const rel of runtimeFiles) {
  const ast = luaparse.parse(readFileSync(join(ROOT, rel), "utf8"), { luaVersion: "5.1" });
  walk(ast, (node) => {
    if (node.type === "AssignmentStatement") {
      for (const variable of node.variables) {
        const name = definedName(chainName(variable));
        if (name) recordDefinition(name, rel);
      }
    }
    // `function RGX.API.name() end` parses as a FunctionDeclaration whose
    // identifier is the member chain, not as an AssignmentStatement.
    if (node.type === "FunctionDeclaration" && !node.isLocal) {
      const name = definedName(chainName(node.identifier));
      if (name) recordDefinition(name, rel);
    }
    if (node.type === "MemberExpression") {
      const name = referencedName(chainName(node));
      if (name) {
        if (!references.has(name)) references.set(name, new Set());
        references.get(name).add(rel);
      }
    }
  });
}

const duplicates = [];
for (const [name, files] of definitions) {
  const owners = [...files.entries()].filter(([, count]) => count > 0);
  if (owners.length > 1 || owners.some(([, count]) => count > 1)) {
    duplicates.push(`${name} defined in ${owners.map(([file, count]) => (count > 1 ? `${file} (${count}x)` : file)).join(", ")}`);
  }
}

const undefinedRefs = [];
for (const [name, files] of references) {
  if (!definitions.has(name)) undefinedRefs.push(`RGX.API.${name} referenced in ${[...files].join(", ")} but never defined`);
}

assert.equal(duplicates.length, 0, `RGX.API names with more than one owner: ${duplicates.join("; ")}`);
assert.equal(undefinedRefs.length, 0, `undefined RGX.API references: ${undefinedRefs.join("; ")}`);
console.log(`API OK ${definitions.size} RGX.API names, one owner each; ${runtimeFiles.length} runtime files scanned`);
