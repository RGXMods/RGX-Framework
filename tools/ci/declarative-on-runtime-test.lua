-- Declarative `on`: plain trigger words subscribe through framework modules, UPPER_CASE keys are raw events,
-- unknown words and non-functions are rejected at declaration, handlers run as handler(addon, ...) and are
-- failure-isolated, and a trigger whose module the client lacks is skipped without error.
local RGX = assert(_G.RGXFramework, "RGX framework did not load")
local checks = 0
local function check(c, m) if not c then error("CHECK FAILED: " .. m, 2) end checks = checks + 1 end
local function contains(h, n) return string.find(tostring(h), tostring(n), 1, true) ~= nil end

-- Stand-in gameplay modules with the real subscription shape: On*(fn) keeps fn and returns an unsubscribe.
local function fakeModule(...)
  local m = { _subs = {} }
  for _, method in ipairs({ ... }) do
    m[method] = function(self, fn) self._subs[method] = fn return function() self._subs[method] = nil end end
  end
  return m
end
local levelup = fakeModule("OnLevelUp")
local quest = fakeModule("OnTurnedIn", "OnAccepted")
RGX:RegisterModule("levelup", levelup, { category = "game" })
RGX:RegisterModule("quest", quest, { category = "game" })

-- Rejected at declaration, before anything is registered.
local function invalid(name, on, expected)
  local ok, err = pcall(function() RGXAddon(name, { on = on }) end)
  check(not ok and contains(err, expected), name .. " is rejected: " .. tostring(err))
  check(RGX:GetAddon(name) == nil, name .. " leaves no addon behind")
end
invalid("OnNotTable", true, "'on' must be a table")
invalid("OnUnknownWord", { ["level.up"] = function() end }, "unknown trigger 'on.level.up'")
invalid("OnLowerEvent", { player_login = function() end }, "unknown trigger")
invalid("OnNotFunction", { levelup = 5 }, "must be a function")

-- Bound on ADDON_LOADED, with the addon as self and the module's arguments.
local seen = {}
RGXAddon("OnAddon", {
  on = {
    levelup = function(self, level) seen.level = { self.name, level } end,
    ["quest.turnin"] = function(self, questID) seen.quest = questID end,
    ["quest.accepted"] = function() error("boom") end,
    ["housing.favor"] = function() seen.housing = true end,     -- no housing module on this client
    PLAYER_REGEN_DISABLED = function(self) seen.raw = self.name end,
  },
})
check(levelup._subs.OnLevelUp == nil, "nothing subscribes before the addon loads")
RGX:FireEvent("ADDON_LOADED", "OnAddon")
check(type(levelup._subs.OnLevelUp) == "function" and type(quest._subs.OnTurnedIn) == "function", "trigger words subscribe through their modules")
levelup._subs.OnLevelUp(42)
check(seen.level and seen.level[1] == "OnAddon" and seen.level[2] == 42, "the handler runs as handler(addon, ...) with the module's arguments")
quest._subs.OnTurnedIn(1234)
check(seen.quest == 1234, "quest.turnin reaches its handler")
local okIsolated = pcall(quest._subs.OnAccepted, 1)
check(okIsolated, "a failing handler is isolated and reported, not thrown into the module")
RGX:FireEvent("PLAYER_REGEN_DISABLED")
check(seen.raw == "OnAddon", "an UPPER_CASE key is a raw event, dispatched through the framework")
check(seen.housing == nil, "a trigger whose module this client lacks is skipped without error")

_G.__rgxRuntimeOnTestResult = string.format("LUA RUNTIME OK  declarative on (%d checks)", checks)
