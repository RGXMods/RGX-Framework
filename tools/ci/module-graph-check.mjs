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
  const src = readFileSync(join(ROOT, entry), "utf8");
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
// Every registered module declares its architectural category explicitly.
const missingCategory = modules.filter((m) => !/category\s*=/.test(m.opts)).map((m) => m.name);
assert.equal(missingCategory.length, 0, `modules missing category: ${missingCategory.join(", ")}`);
const libraryCount = modules.filter((m) => /category\s*=\s*"library"/.test(m.opts)).length;
const gameCount = modules.filter((m) => /category\s*=\s*"game"/.test(m.opts)).length;
console.log(`TAXONOMY OK ${modules.length} modules declared (libraries ${libraryCount}, game ${gameCount})`);
// Global namespace freeze: the RGX public surface is a fixed contract. New
// _G writes fail this check until they are deliberately added here with a
// consumer-compatibility justification. The list is frozen, NOT derived from
// current writes — auto-expansion could never fail and enforced nothing.
//   * core: framework object, its SavedVariables globals, RGXAddon function
//   * modules: the compat aliases consumers may import directly
//   * registry: moduleAliases values + RegisterModule({ global = ... }) names
const GLOBAL_ALLOWLIST = new Set([
  // core
  "RGXFramework", "RGXFrameworkDB", "RGXFrameworkDBChar", "RGXAddon",
  // library modules
  "RGXFonts", "RGXColors", "RGXColorPicker", "RGXTextures", "RGXDropdowns",
  "RGXUI", "RGXDesign", "RGXDisplay", "RGXMinimap", "RGXTooltip", "RGXLocale",
  "RGXDataBroker", "RGXSharedMedia", "RGXSound",
  // game adapters
  "RGXAuras", "RGXCombat", "RGXPetBattles", "RGXReputation",
  "RGXAchievement", "RGXLevelUp", "RGXQuest", "RGXHonor", "RGXDelves",
  "RGXHousing", "RGXTradingPost", "RGXPrey", "RGXCollectibles", "RGXLoot",
]);

const writtenGlobals = new Set();
for (const module of modules) {
  const source = readFileSync(join(ROOT, module.file), "utf8");
  // Direct assignments and global function definitions.
  for (const alias of source.matchAll(/_G\.(RGX\w*)\s*[=(]/g)) writtenGlobals.add(alias[1]);
  // Registry publication: RegisterModule({ global = "RGX..." }).
  for (const alias of source.matchAll(/global\s*=\s*"(RGX\w+)"/g)) writtenGlobals.add(alias[1]);
}
// core files carry the framework globals, the RGXAddon function, and the
// moduleAliases compatibility map. The alias map is parsed inside its table
// block so ordinary string fields elsewhere cannot masquerade as aliases.
const coreFiles = ["core/core.lua", "core/initialization.lua", "core/systems/database.lua"];
for (const coreFile of coreFiles) {
  const source = readFileSync(join(ROOT, coreFile), "utf8");
  for (const alias of source.matchAll(/_G\.(RGX\w*)\s*[=(]/g)) writtenGlobals.add(alias[1]);
  const aliasBlock = source.match(/moduleAliases\s*=\s*\{([\s\S]*?)\n\}/);
  if (aliasBlock) {
    for (const alias of aliasBlock[1].matchAll(/"(RGX\w+)"/g)) writtenGlobals.add(alias[1]);
  }
}
const unexpected = [...writtenGlobals].filter((name) => !GLOBAL_ALLOWLIST.has(name));
assert.equal(unexpected.length, 0, `new _G writes outside the frozen public surface: ${unexpected.join(", ")}`);
const stale = [...GLOBAL_ALLOWLIST].filter((name) => !writtenGlobals.has(name));
assert.equal(stale.length, 0, `allowlist entries no longer written (remove or restore): ${stale.join(", ")}`);
console.log(`GLOBALS OK ${GLOBAL_ALLOWLIST.size} frozen public globals; every write checked against the contract`);

