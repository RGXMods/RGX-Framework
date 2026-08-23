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
    C_EventUtils = { IsEventValid = function(event) return event ~= "RGX_UNSUPPORTED_EVENT" end }
    SlashCmdList = {}
    geterrorhandler = function()
        return function(message) error(message, 0) end
    end

    -- Mock frame models the client accurately for this suite:
    --  - attempts[event] counts every native RegisterEvent attempt
    --  - deny[event] emulates a protection-layer rejection: RegisterEvent
    --    returns silently WITHOUT registering (like ADDON_ACTION_FORBIDDEN,
    --    which is not a Lua error), so IsEventRegistered stays false
    --  - throws[event] emulates a plain Lua error from the C API
    function CreateFrame()
        local frame = { scripts = {}, registered = {}, attempts = {}, deny = {}, throws = {} }
        function frame:SetScript(script, handler) self.scripts[script] = handler end
        function frame:Show() self._shown = true end
        function frame:Hide() self._shown = false end
        function frame:RegisterEvent(event)
            self.attempts[event] = (self.attempts[event] or 0) + 1
            if self.throws[event] then error("mock C error for " .. event, 2) end
            if self.deny[event] then return end
            self.registered[event] = true
        end
        function frame:RegisterAllEvents() self.allEvents = true end
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

  if ((lua.ctx.__rgxEventsCheckCount ?? 0) < 60) {
    throw new Error(`event lifecycle harness ran too few checks: ${lua.ctx.__rgxEventsCheckCount}`);
  }
  console.log(lua.ctx.__rgxEventsTestResult);
} finally {
  lua.global.close();
}
