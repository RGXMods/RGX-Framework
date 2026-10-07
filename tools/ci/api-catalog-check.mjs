#!/usr/bin/env node
// CI architecture gate: the RGX module API catalog stays congruent with the
// shipped runtime (issue #7).
//
// contract/schemas/rgx-api.catalog.json is the approved-capability catalog for
// Studio/MCP authoring. This check derives every machine-derivable field from
// the loader manifest (RGX-Framework.xml), the module registrations,
// core/core.lua's moduleAliases map and RGX:GetX() shortcuts, then fails if
// the checked-in catalog disagrees. Fields that need human review (introduced,
// docs, approval flags) are preserved as authored; docs values must resolve to
// a heading anchor in their target file, and the rest is validated for shape.
//
// Methods are derived too: every non-underscore function definition on the
// module's registered table (lifecycle Init excluded) with its raw parameter
// names. A file may only contribute methods when its receiver is verifiably
// bound to the module table (owner declaration, addon vararg slot, addon
// handoff, published RGX global, or RGX getter); name collisions fail loudly
// instead of mis-attributing. The list is a complete static enumeration of
// shipped definitions, not yet a per-method approval.
//
// Usage:
//   node tools/ci/api-catalog-check.mjs            # verify
//   node tools/ci/api-catalog-check.mjs --write    # regenerate derived fields
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CATALOG_PATH = join(ROOT, "contract/schemas/rgx-api.catalog.json");
const CATALOG_VERSION = 1;
const CATEGORIES = ["library", "game", "runtime"];
const STABILITIES = ["stable", "experimental", "deprecated", "internal"];
const PREVIEW_MODES = ["simulate", "fixture-driven", "placeholder", "unavailable"];
const ENTRY_FIELDS = [
  "module", "getter", "global", "owner", "category", "stability", "flavors",
  "methods", "introduced", "authorable", "preview", "docs",
];
const write = process.argv.includes("--write");

const xml = readFileSync(join(ROOT, "RGX-Framework.xml"), "utf8");
const entries = [...xml.matchAll(/<Script file="([^"]+)"/g)].map((m) => m[1].replace(/\\/g, "/"));
const sources = new Map(entries.map((entry) => [entry, readFileSync(join(ROOT, entry), "utf8")]));

// Registered modules straight from XML order, same parse module-graph uses.
// The registration receiver (second argument, or the enclosing table when the
// call passes `self`) is how method definitions are attributed to a module.
const registered = new Map();
const receivers = new Map();
for (const entry of entries) {
  const src = sources.get(entry);
  for (const match of src.matchAll(/RGX:RegisterModule\(\s*"([^"]+)"\s*,\s*([^),]+)\s*(,[^)]*)?\)/gs)) {
    const name = match[1];
    assert(!registered.has(name), `duplicate module name '${name}' (${registered.get(name)?.owner} and ${entry})`);
    const target = match[2].trim();
    let receiver = target;
    if (target === "self") {
      const enclosing = [...src.slice(0, match.index).matchAll(/^function (\w+)[:.]/gm)].pop();
      assert(enclosing, `${entry}: module '${name}' registers self outside any method`);
      receiver = enclosing[1];
    }
    assert(!receivers.has(receiver), `receiver '${receiver}' claimed by both '${receivers.get(receiver)}' and '${name}'`);
    receivers.set(receiver, name);
    const opts = match[3] ? match[3].trim() : "";
    const category = opts.match(/category\s*=\s*"([^"]+)"/)?.[1];
    assert(category, `${entry}: module '${name}' declares no category`);
    assert(CATEGORIES.includes(category), `${entry}: module '${name}' has unknown category '${category}'`);
    const stability = opts.match(/stability\s*=\s*"([^"]+)"/)?.[1] ?? "stable";
    assert(STABILITIES.includes(stability), `${entry}: module '${name}' has unknown stability '${stability}'`);
    const flavors = opts.match(/flavors\s*=\s*\{([^}]*)\}/)?.[1]
      ? [...opts.match(/flavors\s*=\s*\{([^}]*)\}/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
      : null;
    registered.set(name, { owner: entry, category, stability, flavors, receiver, target });
  }
}
assert(registered.size > 0, "no RGX:RegisterModule calls found");

// Global aliases the registry publishes: core.lua's moduleAliases map plus any
// direct _G.RGX* write in the module's own registration file. Exactly one
// distinct name must be derivable, otherwise the catalog cannot be generated.
const coreSrc = readFileSync(join(ROOT, "core/core.lua"), "utf8");
const aliasBlock = coreSrc.match(/moduleAliases\s*=\s*\{([\s\S]*?)\n\}/);
assert(aliasBlock, "core/core.lua: moduleAliases map not found");
const aliasMap = new Map(
  [...aliasBlock[1].matchAll(/(\w+)\s*=\s*"(RGX\w+)"/g)].map((m) => [m[1], m[2]]),
);
for (const [name, info] of registered) {
  const src = sources.get(info.owner);
  const direct = new Set([...src.matchAll(/_G\.(RGX\w+)\s*=/g)].map((m) => m[1]));
  if (aliasMap.has(name)) direct.add(aliasMap.get(name));
  assert.equal(direct.size, 1, `module '${name}': expected one public global, derivable candidates: ${[...direct].join(", ") || "none"}`);
  info.global = [...direct][0];
}

// RGX:GetX() shortcuts in core.lua map a module to its supported getter call.
const getters = new Map();
for (const match of coreSrc.matchAll(/function RGX:(Get\w+)\(\)\s+return self:GetModule\("([^"]+)"\)/g)) {
  assert(!getters.has(match[2]), `duplicate getter for module '${match[2]}'`);
  getters.set(match[2], `RGX:${match[1]}()`);
}

// Methods: definitions on the module's registered table across every file the
// loader ships. Receiver names repeat across the codebase (core's NewDatabase
// method table is also called DB), so a file contributes only when it
// verifiably binds that receiver to the module table: owner declaration,
// addon vararg slot, addon handoff, published RGX global, or RGX getter.
const METHOD_DEF = /^\s*(?:function\s+([A-Za-z_]\w*)[:.](\w+)\s*\(([^)]*)\)|([A-Za-z_]\w*)\.(\w+)\s*=\s*function\s*\(([^)]*)\))/;
const methods = new Map();
const redefinitions = [];
const bindCache = new Map();

function fileBinds(receiver, file) {
  const key = `${file}::${receiver}`;
  if (bindCache.has(key)) return bindCache.get(key);
  const src = sources.get(file);
  const module = receivers.get(receiver);
  const info = registered.get(module);
  const vararg = new RegExp(`local\\s+[^,\\n]+,\\s*${receiver}\\s*=\\s*\\.\\.\\.`);
  let bound = false;
  if (vararg.test(src)) {
    assert.equal(info.target, "self",
      `${file}: binds '${receiver}' from the addon vararg, but module '${module}' registers an explicit table instead`);
    bound = true;
  } else {
    const patterns = [
      `local\\s+${receiver}\\s*=\\s*addon\\._\\w+`,
      `local\\s+${receiver}\\s*=\\s*_G\\.RGX\\w+`,
      `local\\s+${receiver}\\s*=\\s*RGX:Get(?:Module\\(|\\w+\\()`,
      `addon\\._\\w+\\s*=\\s*${receiver}\\b`,
    ];
    if (file === info.owner) patterns.push(`local\\s+${receiver}\\s*=\\s*\\{`);
    bound = patterns.some((pattern) => new RegExp(pattern).test(src));
  }
  bindCache.set(key, bound);
  return bound;
}

function paramsOf(text) {
  return text.split(",").map((param) => param.trim()).filter((param) => param.length > 0);
}

for (const entry of entries) {
  const lines = sources.get(entry).split("\n");
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(METHOD_DEF);
    if (!match) continue;
    const receiver = match[1] ?? match[4];
    const name = match[2] ?? match[5];
    const module = receivers.get(receiver);
    if (!module || name.startsWith("_") || name === "Init") continue;
    if (!fileBinds(receiver, entry)) continue;
    if (!methods.has(module)) methods.set(module, new Map());
    const bucket = methods.get(module);
    const params = paramsOf(match[3] ?? match[6] ?? "");
    const prior = bucket.get(name);
    if (prior) {
      // Identical redefinition is harmless for the catalog (flavor branches);
      // different parameters make the shipped signature ambiguous.
      redefinitions.push({ module, name, prior, next: { params, file: entry, line: index + 1 } });
    }
    bucket.set(name, { params, file: entry, line: index + 1 });
  }
}

const ambiguous = redefinitions.filter((entry) => JSON.stringify(entry.prior.params) !== JSON.stringify(entry.next.params));
assert.equal(ambiguous.length, 0,
  `ambiguous method redefinitions (same name, different parameters):\n  - ${ambiguous
    .map((entry) => `'${entry.module}:${entry.name}' (${entry.prior.params.join(", ")}) at ${entry.prior.file}:${entry.prior.line} vs (${entry.next.params.join(", ")}) at ${entry.next.file}:${entry.next.line}`)
    .join("\n  - ")}`);

function deriveEntry(name) {
  const info = registered.get(name);
  return {
    module: name,
    getter: getters.get(name) ?? null,
    global: info.global,
    owner: info.owner,
    category: info.category,
    stability: info.stability,
    flavors: info.flavors,
    methods: [...(methods.get(name) ?? new Map()).entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([methodName, method]) => ({ name: methodName, params: method.params })),
    introduced: null,
    authorable: false,
    preview: "unavailable",
    docs: null,
  };
}

const anchorCache = new Map();
function headingAnchors(file) {
  if (!anchorCache.has(file)) {
    const src = readFileSync(join(ROOT, file), "utf8");
    const anchors = new Set();
    for (const match of src.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) {
      anchors.add(match[1].toLowerCase().replace(/[^\w\- ]/g, "").replace(/ /g, "-"));
    }
    anchorCache.set(file, anchors);
  }
  return anchorCache.get(file);
}

function checkEntryField(entry, field, problems) {
  const value = entry[field];
  const at = `entry '${entry.module ?? "?"}'.${field}`;
  switch (field) {
    case "module":
    case "owner":
      if (typeof value !== "string" || value.length === 0) problems.push(`${at} must be a non-empty string`);
      break;
    case "getter":
      if (value !== null && (typeof value !== "string" || !/^RGX:Get\w+\(\)$/.test(value))) problems.push(`${at} must be null or an RGX:GetX() call`);
      break;
    case "global":
      if (value !== null && (typeof value !== "string" || !/^RGX\w+$/.test(value))) problems.push(`${at} must be null or an RGX* global name`);
      break;
    case "category":
      if (!CATEGORIES.includes(value)) problems.push(`${at} must be one of ${CATEGORIES.join(", ")}`);
      break;
    case "stability":
      if (!STABILITIES.includes(value)) problems.push(`${at} must be one of ${STABILITIES.join(", ")}`);
      break;
    case "flavors":
      if (value !== null) {
        if (!Array.isArray(value) || value.length === 0 || value.some((f) => typeof f !== "string" || f.length === 0)) {
          problems.push(`${at} must be null or a non-empty string array`);
        }
      }
      break;
    case "methods": {
      // Derived: every non-underscore function definition on the module's
      // registered table (lifecycle Init excluded) with raw parameter names.
      if (!Array.isArray(value)) {
        problems.push(`${at} must be an array of {name, params} objects`);
        break;
      }
      const names = new Set();
      for (const method of value) {
        if (typeof method !== "object" || method === null || Array.isArray(method)) {
          problems.push(`${at} entries must be {name, params} objects (found: ${JSON.stringify(method)})`);
          continue;
        }
        const keys = Object.keys(method).sort().join(",");
        if (keys !== "name,params") {
          problems.push(`${at} entry has unknown shape (found keys: ${keys || "none"})`);
          continue;
        }
        if (typeof method.name !== "string" || !/^[A-Za-z]\w*$/.test(method.name)) {
          problems.push(`${at} entry name must be a Lua identifier (found: ${JSON.stringify(method.name)})`);
        } else {
          if (names.has(method.name)) problems.push(`${at} lists '${method.name}' twice`);
          names.add(method.name);
        }
        if (!Array.isArray(method.params) || method.params.some((param) => typeof param !== "string" || param.length === 0)) {
          problems.push(`${at} entry '${method.name ?? "?"}'.params must be a non-empty string array (varargs as '...')`);
        }
      }
      break;
    }
    case "introduced":
      if (value !== null && (typeof value !== "string" || value.length === 0)) problems.push(`${at} must be null or a version string`);
      break;
    case "authorable":
      if (typeof value !== "boolean") problems.push(`${at} must be a boolean`);
      break;
    case "preview":
      if (!PREVIEW_MODES.includes(value)) problems.push(`${at} must be one of ${PREVIEW_MODES.join(", ")}`);
      break;
    case "docs":
      if (value !== null) {
        const [file, anchor, extra] = typeof value === "string" ? value.split("#") : [];
        if (typeof value !== "string" || value.length === 0) problems.push(`${at} must be null or a docs path`);
        else if (!file || !anchor || extra !== undefined) problems.push(`${at} must be <docs path>#<heading anchor> (found: ${value})`);
        else if (!existsSync(join(ROOT, file))) problems.push(`${at} points at a missing file: ${value}`);
        else if (!headingAnchors(file).has(anchor)) problems.push(`${at} anchor '#${anchor}' matches no heading in '${file}'`);
      }
      break;
    default:
      problems.push(`${at} has no validation rule`);
  }
}

function buildFromExisting(existingByName) {
  return [...registered.keys()].sort((a, b) => a.localeCompare(b)).map((name) => {
    const derived = deriveEntry(name);
    const prior = existingByName.get(name);
    if (prior) {
      for (const field of ["introduced", "authorable", "preview", "docs"]) {
        if (field in prior) derived[field] = prior[field];
      }
    }
    return derived;
  });
}

let existing = null;
if (existsSync(CATALOG_PATH)) existing = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
const existingByName = new Map((existing?.entries ?? []).map((entry) => [entry.module, entry]));

if (write) {
  const catalog = {
    catalogVersion: CATALOG_VERSION,
    description: existing?.description
      ?? "Approved RGX module API catalog (issue #7). Module, getter, global, owner, category, stability, flavors and methods are generated by tools/ci/api-catalog-check.mjs from RGX-Framework.xml, the module registrations and core/core.lua; --write regenerates them. null flavors = no flavor restriction declared (the centralized compat gate still applies). methods lists every non-underscore function definition on the module's registered table (lifecycle Init excluded) with raw parameter names; it is a complete static enumeration of shipped definitions, not yet a per-method approval. docs points at the module's docs/API.md heading anchor where one exists; CI resolves every anchor. null docs = not yet documented in docs/API.md; null introduced and authorable=false / preview=unavailable = pending catalog review.",
    entries: buildFromExisting(existingByName),
  };
  writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n");
}

const problems = [];
const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
const topKeys = Object.keys(catalog).sort();
assert(topKeys.join(",") === "catalogVersion,description,entries", `catalog must contain exactly catalogVersion, description, entries (found: ${topKeys.join(", ")})`);
assert(catalog.catalogVersion === CATALOG_VERSION, `catalogVersion must be ${CATALOG_VERSION}`);
assert(typeof catalog.description === "string" && catalog.description.length > 0, "description must be a non-empty string");
assert(Array.isArray(catalog.entries), "entries must be an array");

const seen = new Set();
for (const entry of catalog.entries) {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    problems.push(`entries must be objects (found: ${JSON.stringify(entry)})`);
    continue;
  }
  const keys = Object.keys(entry);
  const missing = ENTRY_FIELDS.filter((field) => !keys.includes(field));
  const extra = keys.filter((field) => !ENTRY_FIELDS.includes(field));
  if (missing.length) problems.push(`entry '${entry.module ?? "?"}' missing fields: ${missing.join(", ")}`);
  if (extra.length) problems.push(`entry '${entry.module ?? "?"}' has unknown fields: ${extra.join(", ")}`);
  for (const field of ENTRY_FIELDS) {
    if (keys.includes(field)) checkEntryField(entry, field, problems);
  }
  if (typeof entry.module === "string") {
    if (seen.has(entry.module)) problems.push(`duplicate catalog entry '${entry.module}'`);
    seen.add(entry.module);
    if (!registered.has(entry.module)) problems.push(`catalog entry '${entry.module}' is not a registered module`);
  }
}

for (const name of registered.keys()) {
  if (!seen.has(name)) problems.push(`registered module '${name}' is missing from the catalog`);
}

// Derivable fields must match the shipped runtime exactly.
for (const entry of catalog.entries) {
  if (!registered.has(entry.module)) continue;
  const derived = deriveEntry(entry.module);
  for (const field of ["getter", "global", "owner", "category", "stability", "flavors", "methods"]) {
    const expected = JSON.stringify(derived[field]);
    const actual = JSON.stringify(entry[field]);
    if (expected !== actual) problems.push(`entry '${entry.module}'.${field} is ${actual}, derived from the runtime: ${expected}`);
  }
}

const order = catalog.entries.map((entry) => entry.module);
const sorted = [...order].sort((a, b) => a.localeCompare(b));
if (JSON.stringify(order) !== JSON.stringify(sorted)) problems.push("catalog entries must be sorted by module name");

assert.equal(problems.length, 0, `api catalog drift:\n  - ${problems.join("\n  - ")}`);

const library = catalog.entries.filter((entry) => entry.category === "library").length;
const game = catalog.entries.filter((entry) => entry.category === "game").length;
const totalMethods = catalog.entries.reduce((sum, entry) => sum + (Array.isArray(entry.methods) ? entry.methods.length : 0), 0);
console.log(`API CATALOG OK ${catalog.entries.length} modules (libraries ${library}, game ${game}), ${totalMethods} enumerated method(s)`);
