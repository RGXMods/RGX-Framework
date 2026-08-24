#!/usr/bin/env node
// Login-message runtime gate: exercises the framework chat prefix, the
// persisted login-message toggle, declarative welcome routing, and the single
// framework startup line inside a Lua 5.1 VM (wasmoon).
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
    __utilsSource: source("core/systems/utils.lua"),
    __initializationSource: source("core/initialization.lua"),
    __commandsSource: source("core/commands.lua"),
    __testSource: source("tools/ci/login-runtime-test.lua"),
  });

  lua.doStringSync(`
    _G.RGXFrameworkDB = {}
    C_AddOns = { GetAddOnMetadata = function(name, field)
        if field == "Version" then return "2.7.4" end
        return nil
    end }
    strtrim = function(s) return (tostring(s or ""):gsub("^%s+", ""):gsub("%s+$", "")) end
    InCombatLockdown = function() return false end
    UnitAffectingCombat = function() return false end
    C_EventUtils = { IsEventValid = function() return true end }
    SlashCmdList = {}
    geterrorhandler = function()
        return function(message) error(message, 0) end
    end

    function CreateFrame()
        local frame = { scripts = {}, registered = {}, attempts = {}, deny = {}, throws = {} }
        function frame:SetScript(script, handler) self.scripts[script] = handler end
        function frame:Show() self._shown = true end
        function frame:Hide() self._shown = false end
        function frame:RegisterEvent(event) self.registered[event] = true end
        function frame:UnregisterEvent(event) self.registered[event] = nil end
        function frame:IsEventRegistered(event) return self.registered[event] == true end
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
    loadSource(__runtimeSource, "core/systems/runtime.lua")("RGX-Framework", RGX)
    loadSource(__utilsSource, "core/systems/utils.lua")("RGX-Framework", RGX)
    loadSource(__initializationSource, "core/initialization.lua")("RGX-Framework", RGX)
    loadSource(__commandsSource, "core/commands.lua")("RGX-Framework", RGX)
    _G.RGX = RGX
    loadSource(__testSource, "tools/ci/login-runtime-test.lua")()
  `);

  if ((lua.ctx.__rgxLoginCheckCount ?? 0) < 25) {
    throw new Error(`login harness ran too few checks: ${lua.ctx.__rgxLoginCheckCount}`);
  }
  console.log(lua.ctx.__rgxLoginTestResult);
} finally {
  lua.global.close();
}
