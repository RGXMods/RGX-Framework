#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const source = (path) => readFileSync(join(ROOT, path), "utf8");

const lua = await Lua.create();
try {
  Object.assign(lua.ctx, {
    __coreSource: source("core/core.lua"),
    __eventsSource: source("core/systems/events.lua"),
    __runtimeSource: source("core/systems/runtime.lua"),
    __initializationSource: source("core/initialization.lua"),
    __testSource: source("tools/ci/events-runtime-test.lua"),
  });

  lua.doStringSync(`
    __inCombat = false
    InCombatLockdown = function() return __inCombat == true end
    UnitAffectingCombat = function() return __inCombat == true end
    C_EventUtils = { IsEventValid = function() return true end }
    SlashCmdList = {}
    geterrorhandler = function()
        return function(message) error(message, 0) end
    end

    function CreateFrame()
        local frame = { scripts = {}, registered = {} }
        function frame:SetScript(script, handler) self.scripts[script] = handler end
        function frame:RegisterEvent(event) self.registered[event] = true end
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
    RGX.API = {
        CanAccessValue = function(value) return value ~= nil end,
        CanAccessTable = function(value) return type(value) == "table" end,
    }
    loadSource(__eventsSource, "core/systems/events.lua")("RGX-Framework", RGX)
    loadSource(__runtimeSource, "core/systems/runtime.lua")("RGX-Framework", RGX)
    loadSource(__initializationSource, "core/initialization.lua")("RGX-Framework", RGX)
    _G.RGX = RGX
    loadSource(__testSource, "tools/ci/events-runtime-test.lua")()
  `);

  if ((lua.ctx.__rgxEventsCheckCount ?? 0) < 30) {
    throw new Error(`event lifecycle harness ran too few checks: ${lua.ctx.__rgxEventsCheckCount}`);
  }
  console.log(lua.ctx.__rgxEventsTestResult);
} finally {
  lua.global.close();
}
