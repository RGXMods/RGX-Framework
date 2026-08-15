#!/usr/bin/env node
// Restricted-aura boundary checks in a real Lua 5.1 VM. Poison tables and
// instrumented predicates prove ordering/suppression; real taint still requires
// the documented in-game Retail check.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const EXPECTED_CHECKS = 86;
const source = (path) => readFileSync(join(ROOT, path), "utf8");

const lua = await Lua.create();
try {
  Object.assign(lua.ctx, {
    __coreSource: source("core/core.lua"),
    __eventsSource: source("core/systems/events.lua"),
    __compatSource: source("core/compat.lua"),
    __aurasSource: source("modules/auras/auras.lua"),
    __testSource: source("tools/ci/aura-runtime-test.lua"),
  });

  lua.doStringSync(`
    WOW_PROJECT_MAINLINE = 1
    WOW_PROJECT_CLASSIC = 2
    WOW_PROJECT_BURNING_CRUSADE_CLASSIC = 3
    WOW_PROJECT_WRATH_CLASSIC = 4
    WOW_PROJECT_CATACLYSM_CLASSIC = 5
    WOW_PROJECT_MISTS_CLASSIC = 6
    WOW_PROJECT_ID = WOW_PROJECT_MAINLINE

    __deniedValues = {}
    __deniedTables = {}
    __secretIndexes = {}
    __secretInstances = {}
    __auraEventSecret = false
    __valueAccessCalls = 0
    __tableAccessCalls = 0
    __secretValueCalls = 0
    __secretTableCalls = 0
    __indexGetterCalls = 0
    __instanceGetterCalls = 0
    __indexPredicateCalls = 0
    __instancePredicateCalls = 0
    __auras = { player = { HELPFUL = {}, HARMFUL = {} }, target = { HELPFUL = {}, HARMFUL = {} } }
    __instances = {}
    __playerAura = nil
    __unitSpellAura = nil

    canaccessvalue = function(value)
        __valueAccessCalls = __valueAccessCalls + 1
        return __deniedValues[value] ~= true
    end
    issecretvalue = function(value)
        __secretValueCalls = __secretValueCalls + 1
        return __deniedValues[value] == true
    end
    canaccesstable = function(value)
        __tableAccessCalls = __tableAccessCalls + 1
        return type(value) == "table" and __deniedTables[value] ~= true
    end
    issecrettable = function(value)
        __secretTableCalls = __secretTableCalls + 1
        return __deniedTables[value] == true
    end

    C_Secrets = {
        HasSecretRestrictions = function() return true end,
        ShouldAurasBeSecret = function() return __auraEventSecret end,
        ShouldUnitAuraIndexBeSecret = function(unit, index, filter)
            __indexPredicateCalls = __indexPredicateCalls + 1
            return __secretIndexes[tostring(unit) .. ":" .. tostring(index) .. ":" .. tostring(filter)] == true
        end,
        ShouldUnitAuraInstanceBeSecret = function(unit, id)
            __instancePredicateCalls = __instancePredicateCalls + 1
            return __secretInstances[tostring(unit) .. ":" .. tostring(id)] == true
        end,
    }

    C_UnitAuras = {
        GetAuraDataByIndex = function(unit, index, filter)
            __indexGetterCalls = __indexGetterCalls + 1
            local byUnit = __auras[unit]
            local list = byUnit and byUnit[filter]
            return list and list[index] or nil
        end,
        GetAuraDataByAuraInstanceID = function(_, id)
            __instanceGetterCalls = __instanceGetterCalls + 1
            return __instances[id]
        end,
        GetPlayerAuraBySpellID = function(spellID)
            local aura = __playerAura
            if type(aura) == "table" and aura.spellId == spellID then return aura end
        end,
        GetUnitAuraBySpellID = function(_, spellID)
            local aura = __unitSpellAura
            if type(aura) == "table" and aura.spellId == spellID then return aura end
        end,
    }

    C_EventUtils = { IsEventValid = function() return true end }
    SlashCmdList = {}
    __errors = {}
    geterrorhandler = function()
        return function(message) __errors[#__errors + 1] = message end
    end
    InCombatLockdown = function() return false end
    UnitAffectingCombat = function() return false end
    function CreateFrame()
        local frame = { scripts = {}, registered = {} }
        function frame:SetScript(script, handler) self.scripts[script] = handler end
        function frame:RegisterEvent(event) self.registered[event] = true end
        function frame:RegisterAllEvents() self.allEvents = true end
        function frame:UnregisterEvent(event) self.registered[event] = nil end
        return frame
    end

    local function loadSource(text, path)
        local chunk, err = loadstring(text, "@" .. path)
        assert(chunk, err)
        return chunk
    end

    local RGX = {}
    loadSource(__coreSource, "core/core.lua")("RGX-Framework", RGX)
    loadSource(__eventsSource, "core/systems/events.lua")("RGX-Framework", RGX)
    loadSource(__compatSource, "core/compat.lua")("RGX-Framework", RGX)
    loadSource(__aurasSource, "modules/auras/auras.lua")("RGX-Framework", RGX)
    _G.RGX = RGX
    loadSource(__testSource, "tools/ci/aura-runtime-test.lua")()
  `);

  if (lua.ctx.__rgxAuraCheckCount !== EXPECTED_CHECKS) {
    throw new Error(`restricted aura check count changed: expected ${EXPECTED_CHECKS}, got ${lua.ctx.__rgxAuraCheckCount}`);
  }
  console.log(lua.ctx.__rgxAuraTestResult);
} finally {
  lua.global.close();
}
