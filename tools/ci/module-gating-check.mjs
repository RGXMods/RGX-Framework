#!/usr/bin/env node
// Module gating regression: build two surfaces inside the real compat.lua and
// prove gated modules register only where their Blizzard namespace exists.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const compat = readFileSync(join(ROOT, "core/compat.lua"), "utf8");

async function probe(globals, moduleName, extraPrelude) {
  const lua = await Lua.create();
  try {
    lua.doStringSync(`
      RGX = {}
      WOW_PROJECT_MAINLINE=1 WOW_PROJECT_CLASSIC=2 WOW_PROJECT_BURNING_CRUSADE_CLASSIC=3
      WOW_PROJECT_WRATH_CLASSIC=4 WOW_PROJECT_CATACLYSM_CLASSIC=5 WOW_PROJECT_MISTS_CLASSIC=6
      WOW_PROJECT_ID=1
      C_EventUtils = { IsEventValid = function() return true end }
      C_UnitAuras = {}
      function RGX:Debug() end
    `);
    lua.ctx.__compat = compat;
    Object.assign(lua.ctx, globals);
    if (extraPrelude) lua.doStringSync(extraPrelude);
    lua.doStringSync(`assert(loadstring(__compat))("RGX-Framework", RGX)`);
    return lua.doStringSync(`return tostring(RGX:ModuleSupported("${moduleName}"))`) === "true";
  } finally { lua.global.close(); }
}

const gated = ["housing", "delves", "tradingpost", "collectibles", "prey"];
for (const name of gated) {
  assert.equal(await probe({}, name), false, `${name} must be unsupported without its namespace`);
}
// Retail-shaped surfaces: namespace present.
for (const [name, prelude] of [
  ["housing", "C_Housing = { placeholder = true }"],
  ["delves", "C_DelvesUI = { GetFactionForCompanion = function() end }"],
  ["tradingpost", "C_PerksProgram = { GetCurrencyAmount = function() end }"],
  ["collectibles", "C_ToyBox = { placeholder = true }"],
]) {
  assert.equal(await probe({}, name, prelude), true, `${name} must load with its namespace`);
}
assert.equal(await probe({}, "prey", 'C_QuestLog = C_QuestLog or {}; C_QuestLog.GetActivePreyQuest = function() return nil end'), true, "prey with GetActivePreyQuest");
assert.equal(await probe({}, "prey"), false, "prey without the prey API");
for (const universal of ["petbattles", "sound", "quest", "combat"]) {
  assert.equal(await probe({}, universal), true, `${universal} is framework-structural`);
}
console.log("MODULE GATING OK gated modules honor the client surface; structural modules always load");