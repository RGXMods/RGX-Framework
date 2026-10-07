#!/usr/bin/env node
// CI architecture gate: the RGX module API catalog stays congruent with the
// shipped runtime (issue #7).
//
// contract/schemas/rgx-api.catalog.json is the approved-capability catalog for
// Studio/MCP authoring. This check derives every machine-derivable field from
// the loader manifest (RGX-Framework.xml), the module registrations,
// core/core.lua's moduleAliases map and RGX:GetX() shortcuts, then fails if
// the checked-in catalog disagrees. Fields that need human review (methods,
// introduced, docs, approval flags) are preserved as authored and validated
// for shape only.
//
// Unknown is not absent: `methods: null` means "not yet enumerated" and is
// treated as fail-closed (no method may be generated) until reviewed; an empty
// array is rejected because it would claim the module has no public methods.
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

// Registered modules straight from XML order, same parse module-graph uses.
const registered = new Map();
for (const entry of entries) {
  const src = readFileSync(join(ROOT, entry), "utf8");
  for (const match of src.matchAll(/RGX:RegisterModule\(\s*"([^"]+)"\s*,\s*([^),]+)\s*(,[^)]*)?\)/gs)) {
    const name = match[1];
    assert(!registered.has(name), `duplicate module name '${name}' (${registered.get(name)?.owner} and ${entry})`);
    const opts = match[3] ? match[3].trim() : "";
    const category = opts.match(/category\s*=\s*"([^"]+)"/)?.[1];
    assert(category, `${entry}: module '${name}' declares no category`);
    assert(CATEGORIES.includes(category), `${entry}: module '${name}' has unknown category '${category}'`);
    const stability = opts.match(/stability\s*=\s*"([^"]+)"/)?.[1] ?? "stable";
    assert(STABILITIES.includes(stability), `${entry}: module '${name}' has unknown stability '${stability}'`);
    const flavors = opts.match(/flavors\s*=\s*\{([^}]*)\}/)?.[1]
      ? [...opts.match(/flavors\s*=\s*\{([^}]*)\}/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
      : null;
    registered.set(name, { owner: entry, category, stability, flavors });
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
  const src = readFileSync(join(ROOT, info.owner), "utf8");
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
    methods: null,
    introduced: null,
    authorable: false,
    preview: "unavailable",
    docs: null,
  };
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
    case "methods":
      // null = not yet reviewed (fail-closed). An empty array would claim the
      // module has no public methods; only reviewed non-empty lists may land.
      if (value !== null) {
        if (!Array.isArray(value) || value.length === 0 || value.some((m) => typeof m !== "string" || m.length === 0)) {
          problems.push(`${at} must be null (unreviewed) or a non-empty string array`);
        }
      }
      break;
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
        if (typeof value !== "string" || value.length === 0) problems.push(`${at} must be null or a docs path`);
        else if (!existsSync(join(ROOT, value.split("#")[0]))) problems.push(`${at} points at a missing file: ${value}`);
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
      for (const field of ["methods", "introduced", "authorable", "preview", "docs"]) {
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
      ?? "Approved RGX module API catalog (issue #7). Module, getter, global, owner, category, stability and flavors are generated by tools/ci/api-catalog-check.mjs from RGX-Framework.xml, the module registrations and core/core.lua; --write regenerates them. null flavors = no flavor restriction declared (the centralized compat gate still applies). null methods = not yet enumerated and fail-closed for authoring. null introduced/docs and authorable=false / preview=unavailable = not yet reviewed; filled during catalog review.",
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
  for (const field of ["getter", "global", "owner", "category", "stability", "flavors"]) {
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
const reviewed = catalog.entries.filter((entry) => entry.methods !== null).length;
console.log(`API CATALOG OK ${catalog.entries.length} modules (libraries ${library}, game ${game}), ${reviewed} reviewed method list(s)`);
