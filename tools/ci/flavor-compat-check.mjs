#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const sources = {
  core: readFileSync(join(ROOT, "core", "core.lua"), "utf8"),
  compat: readFileSync(join(ROOT, "core", "compat.lua"), "utf8"),
  auras: readFileSync(join(ROOT, "modules", "auras", "auras.lua"), "utf8"),
  test: readFileSync(join(HERE, "flavor-compat-test.lua"), "utf8"),
};

const flavors = [
  ["retail", "WOW_PROJECT_MAINLINE", ["auras", "quest", "reputation", "achievement", "petbattles", "honor", "delves", "housing", "tradingpost", "prey"], []],
  ["classic_era", "WOW_PROJECT_CLASSIC", ["auras", "quest", "reputation", "achievement", "petbattles", "honor"], ["delves", "housing", "tradingpost", "prey"]],
  ["tbc", "WOW_PROJECT_BURNING_CRUSADE_CLASSIC", ["auras", "quest", "reputation", "achievement", "petbattles", "honor"], ["delves", "housing", "tradingpost", "prey"]],
  ["wrath", "WOW_PROJECT_WRATH_CLASSIC", ["auras", "quest", "reputation", "achievement", "petbattles", "honor"], ["delves", "housing", "tradingpost", "prey"]],
  ["cata", "WOW_PROJECT_CATACLYSM_CLASSIC", ["auras", "quest", "reputation", "achievement", "petbattles", "honor"], ["delves", "housing", "tradingpost", "prey"]],
  ["mists", "WOW_PROJECT_MISTS_CLASSIC", ["auras", "quest", "reputation", "achievement", "petbattles", "honor"], ["delves", "housing", "tradingpost", "prey"]],
];

for (const [flavor, projectConstant, available, unavailable] of flavors) {
  const lua = await Lua.create();
  try {
    Object.assign(lua.ctx, {
      __coreSource: sources.core,
      __compatSource: sources.compat,
      __aurasSource: sources.auras,
      __testSource: sources.test,
      __expectedFlavor: flavor,
      __expectedAvailable: available,
      __expectedUnavailable: unavailable,
      __projectConstant: projectConstant,
    });
    lua.doStringSync(`
      WOW_PROJECT_MAINLINE = 1
      WOW_PROJECT_CLASSIC = 2
      WOW_PROJECT_BURNING_CRUSADE_CLASSIC = 3
      WOW_PROJECT_WRATH_CLASSIC = 4
      WOW_PROJECT_CATACLYSM_CLASSIC = 5
      WOW_PROJECT_MISTS_CLASSIC = 6
      WOW_PROJECT_ID = _G[__projectConstant]
      C_EventUtils = { IsEventValid = function(event)
          return event ~= "CURRENT_HOUSE_INFO_RECIEVED"
              and event ~= "PERKS_PROGRAM_CURRENCY_REFRESH"
              and event ~= "UPDATE_UI_WIDGET"
              and event ~= "MAJOR_FACTION_RENOWN_LEVEL_CHANGED"
      end }
      C_PetBattles = { GetHealth = function() return 1 end }
      UnitHonorLevel = function() return 1 end
      if __expectedFlavor == "retail" then
          C_EventUtils.IsEventValid = function() return true end
          C_DelvesUI = { GetFactionForCompanion = function() return 1 end }
          C_Housing = {}
          C_PerksProgram = { GetCurrencyAmount = function() return 0 end }
          C_QuestLog = { GetActivePreyQuest = function() return 1 end }
      end
      C_UnitAuras = { GetAuraDataByIndex = function() return { spellId = 123, auraInstanceID = 1 } end,
          GetPlayerAuraBySpellID = function(id) if id == 123 then return { spellId = id } end end }
      GetNumQuestLogEntries = function() return 1 end
      GetQuestLogTitle = function() return "Quest", 10, 0, false, false, false, 1, 456 end
      GetNumFactions = function() return 1 end
      GetFactionInfo = function() return "Faction", "", 5, 3000, 9000, 4000, false, false, false, false, true, false, false, 789 end
      CreateFrame = function() return {} end
      local function loadSource(source, path)
          local chunk, err = loadstring(source, "@" .. path)
          assert(chunk, err)
          return chunk
      end
      local RGX = {}
      loadSource(__coreSource, "core/core.lua")("RGX-Framework", RGX)
      loadSource(__compatSource, "core/compat.lua")("RGX-Framework", RGX)
      loadSource(__aurasSource, "modules/auras/auras.lua")("RGX-Framework", RGX)
      RGX:RegisterModule("housing", {})
      _G.RGX = RGX
      loadSource(__testSource, "tools/ci/flavor-compat-test.lua")()
    `);
    console.log(lua.ctx.__flavorCompatResult);
  } finally {
    lua.global.close();
  }
}
