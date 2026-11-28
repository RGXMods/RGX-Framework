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
    __testSource: source("tools/ci/event-bucketing-test.lua"),
  });
  lua.doStringSync(`
    __inCombat = false
    InCombatLockdown = function() return __inCombat == true end
    UnitAffectingCombat = function() return __inCombat == true end
    C_EventUtils = { IsEventValid = function(event) return event ~= "RGX_UNSUPPORTED_EVENT" end }
    SlashCmdList = {}
    geterrorhandler = function() return function(message) error(message, 0) end end
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
    _G.RGXFramework = RGX
    loadSource(__testSource, "tools/ci/event-bucketing-test.lua")()
  `);
  const count = lua.ctx.__rgxEventBucketCheckCount ?? 0;
  if (count < 25) throw new Error(`event bucket harness ran too few checks: ${count}`);
  console.log(lua.ctx.__rgxEventBucketMetrics);
} finally {
  lua.global.close();
}
