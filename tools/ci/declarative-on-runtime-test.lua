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

-- ── Advanced form: on.X = { handler = fn, unit = ..., throttle = seconds }.
invalid("OnTableNoHandler", { levelup = { throttle = 1 } }, "must have a handler function")
invalid("OnTableBadHandler", { levelup = { handler = 5 } }, "must have a handler function")
invalid("OnTableUnknownKey", { levelup = { handler = function() end, speed = 1 } }, "unknown option 'speed'")
invalid("OnTableBadThrottle", { levelup = { handler = function() end, throttle = 0 } }, "throttle must be a number above 0")
invalid("OnTableBadThrottleType", { levelup = { handler = function() end, throttle = "1" } }, "throttle must be a number above 0")
invalid("OnUnitOnWord", { levelup = { handler = function() end, unit = "player" } }, "unit only applies to a raw event")
invalid("OnBadUnit", { UNIT_AURA = { handler = function() end, unit = 5 } }, "unit must be a unit token or a list of them")
invalid("OnEmptyUnits", { UNIT_AURA = { handler = function() end, unit = {} } }, "unit must be a unit token or a list of them")
invalid("OnThrottleLogin", { login = { handler = function() end, throttle = 1 } }, "throttle does not apply to login")

-- Unit events dispatch through the framework's access gate; this harness has no client, so supply the predicates.
local savedApi = RGX.API
RGX.API = { CanAccessValue = function(v) return v ~= nil end, CanAccessTable = function(v) return type(v) == "table" end }
local clock = 100
_G.GetTime = function() return clock end
local unitSeen, throttled, listSeen, bare = {}, 0, {}, 0
RGXAddon("OnAdvanced", {
  on = {
    UNIT_AURA = { handler = function(self, unit) unitSeen[#unitSeen + 1] = unit end, unit = "player" },
    UNIT_HEALTH = { handler = function(self, unit) listSeen[#listSeen + 1] = unit end, unit = { "player", "target" } },
    levelup = { handler = function() throttled = throttled + 1 end, throttle = 5 },
    PLAYER_REGEN_ENABLED = { handler = function() bare = bare + 1 end },
  },
})
RGX:FireEvent("ADDON_LOADED", "OnAdvanced")
RGX:FireEvent("UNIT_AURA", "player")
RGX:FireEvent("UNIT_AURA", "target")
check(#unitSeen == 1 and unitSeen[1] == "player", "unit = 'player' delivers only the player's event (got " .. #unitSeen .. ")")
RGX:FireEvent("UNIT_HEALTH", "player"); RGX:FireEvent("UNIT_HEALTH", "target"); RGX:FireEvent("UNIT_HEALTH", "focus")
check(#listSeen == 2 and listSeen[1] == "player" and listSeen[2] == "target", "a unit list delivers each listed unit and no other")
levelup._subs.OnLevelUp(1); levelup._subs.OnLevelUp(2); levelup._subs.OnLevelUp(3)
check(throttled == 1, "throttle drops calls inside the window (ran " .. throttled .. ")")
clock = 104.9; levelup._subs.OnLevelUp(4)
check(throttled == 1, "still inside the 5 second window")
clock = 105.1; levelup._subs.OnLevelUp(5)
check(throttled == 2, "the first call after the window runs (ran " .. throttled .. ")")
RGX:FireEvent("PLAYER_REGEN_ENABLED")
check(bare == 1, "the table form without options behaves like a bare handler")
_G.GetTime = nil
RGX.API = savedApi

_G.__rgxRuntimeOnTestResult = string.format("LUA RUNTIME OK  declarative on (%d checks)", checks)
