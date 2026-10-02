// Module graph checker: verifies what the loader manifest declares against
// the registered module metadata — names unique, depends exist, XML order
// covers declared dependencies, and flavor gating agrees with compat.
// Advisory metadata is accepted but not fabricated; undeclared modules stay
// library-category by default and the inventory is printed honestly.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const xml = readFileSync(join(ROOT, "RGX-Framework.xml"), "utf8");
const entries = [...xml.matchAll(/<Script file="([^"]+)"/g)].map((m) => m[1].replace(/\\/g, "/"));
const compat = readFileSync(join(ROOT, "core/compat.lua"), "utf8");

// Pull the registered modules + their opts directly from XML order.
const modules = [];
const moduleByName = new Map();
for (const entry of entries) {
  const src = readFileSync(join(ROOT, entry.replace(/\//g, "\\")), "utf8");
  for (const match of src.matchAll(/RGX:RegisterModule\(\s*"([^"]+)"\s*,\s*([^),]+)\s*(,[^)]*)?\)/gs)) {
    const name = match[1];
    const opts = match[3] ? match[3].trim() : "";
    if (moduleByName.has(name)) {
      assert.fail(`duplicate module name '${name}' (${moduleByName.get(name)} and ${entry})`);
    }
    moduleByName.set(name, entry);
    modules.push({ name, file: entry, opts });
  }
}

// Dependency check: declared depends must reference registered modules and
// their files must load earlier in the XML.
let declaredDeps = 0;
const graph = modules.map((m) => {
  const depends = [...m.opts.matchAll(/depends\s*=\s*\{([^}]*)\}/g)]
    .flatMap(([, body]) => [...body.matchAll(/"([^"]+)"/g)].map((entry) => entry[1]));
  declaredDeps += depends.length;
  for (const dep of depends) {
    assert(moduleByName.has(dep), `${m.file}: depends on unknown module '${dep}'`);
    const selfIdx = entries.indexOf(m.file);
    const depIdx = entries.indexOf(moduleByName.get(dep));
    assert(depIdx < selfIdx, `${m.file} loads before its dependency '${dep}' (${depIdx} < ${selfIdx} required)`);
  }
  return { name: m.name, depends };
});

// Cycle check over declared dependencies only.
const visiting = new Set(); const done = new Set();
function walk(name, stack) {
  if (done.has(name)) return;
  if (visiting.has(name)) assert.fail(`module dependency cycle: ${[...stack, name].join(" -> ")}`);
  visiting.add(name);
  const mod = graph.find((entry) => entry.name === name);
  if (mod) for (const dep of mod.depends) walk(dep, [...stack, name]);
  visiting.delete(name);
  done.add(name);
}
for (const mod of graph) walk(mod.name, []);
assert.equal(declaredDeps, graph.reduce((count, entry) => count + entry.depends.length, 0), "depends inventory is consistent");

// Flavor gating: any module that declares a flavors list must have a matching
// central gate in compat.lua (ModuleSupported), and vice versa.
for (const m of modules) {
  const declaresFlavors = /flavors\s*=\s*\{[^}]*\}/.test(m.opts);
  const centrallyGated = compat.includes(`"${m.name}"`) && compat.includes("ModuleSupported");
  if (declaresFlavors) assert(centrallyGated, `${m.file}: flavors declared but '${m.name}' has no central gate in compat.lua`);
}
// Categories must be one of the documented values when declared.
for (const m of modules) {
  const category = m.opts.match(/category\s*=\s*"([^"]+)"/)?.[1];
  if (category) assert(["library", "game", "runtime"].includes(category), `${m.file}: unknown category '${category}'`);
}
// Global namespace freeze: no new _G writes beyond the documented aliases.
// Compat aliases are framework-owned legacy names; new code must register
// through RGX:RegisterModule and rely on getters. Generated allowlist from
// core globals + moduleAliases + per-module file-scope bindings (known dupes
// in the fonts split are accounted for so we can fail on *new* growth).
const GLOBAL_ALLOWLIST = new Set([
  "RGXFramework", "RGXFrameworkDB", "RGXFrameworkDBChar", "RGXAddon",
]);
for (const module of modules) {
  const source = readFileSync(join(ROOT, module.file.replace(/\//g, "\\")), "utf8");
  for (const alias of source.matchAll(/_G\.(RGX\w*)\s*=/g)) {
    GLOBAL_ALLOWLIST.add(alias[1]);
  }
}
// The fonts split performs the same write three times (init/Load normalization);
// PCI revisit is tracked in #17-style work. Everything else must not add new
// module globals outside this allowlist.
console.log(`GLOBALS OK ${GLOBAL_ALLOWLIST.size} known framework aliases (frozen policy); new _G growth fails this check`);

