-- RGXTriggers runtime harness (wasmoon Lua 5.1).
-- Counts checks in __rgxTriggersCheckCount and prints one result line.

local function check(cond, msg)
    if not cond then error("TRIGGERS CHECK FAILED: " .. tostring(msg), 2) end
    __rgxTriggersCheckCount = __rgxTriggersCheckCount + 1
end

local RGX = _G.RGXFramework
check(RGX, "framework global present")

local Triggers = _G.RGXTriggers
check(Triggers, "RGXTriggers global present")
check(RGX:GetTriggers() == Triggers, "getter returns the module")

local notifications = {}
local unsubscribeAll = Triggers:OnChanged("lust", function(id, states)
    notifications[#notifications + 1] = { id = id, states = states }
end)
check(type(unsubscribeAll) == "function", "OnChanged returns unsubscribe")

-- ── Instance basics ────────────────────────────────────────────────────────────

local lust = Triggers:New("lust")
check(type(lust) == "table", "New returns an instance")
check(Triggers:Get("lust") == lust, "Get returns the same instance")
check(lust:Count() == 0, "fresh trigger has zero clones")

local ok, err = pcall(Triggers.New, Triggers, "lust")
check(not ok and err:find("already exists", 1, true), "duplicate id fails")
ok, err = pcall(Triggers.New, Triggers, "has space")
check(not ok, "id with space fails")
ok, err = pcall(Triggers.New, Triggers, "")
check(not ok, "empty id fails")
ok, err = pcall(Triggers.New, Triggers, 42)
check(not ok, "non-string id fails")

-- ── Update diffing ─────────────────────────────────────────────────────────────

local n0 = #notifications
local changed, state = lust:Update("player", { active = true, stacks = 2 })
check(changed == true, "new clone reports changed")
check(state.active == true and state.stacks == 2, "fields applied")
check(state.changed == true, "state.changed true for new clone")
check(lust:Count() == 1, "one clone live")
check(#notifications == n0 + 1, "new clone fired one notification")
check(notifications[#notifications].id == "lust", "notification carries the id")
check(notifications[#notifications].states == lust:States(), "notification carries the live states")

local n1 = #notifications
changed, state = lust:Update("player", { active = true, stacks = 2 })
check(changed == false, "identical values report unchanged")
check(#notifications == n1, "identical values fire no notification")

changed, state = lust:Update("player", { stacks = 3 })
check(changed == true and state.stacks == 3, "changed value applied")
check(state.active == true, "unrelated fields preserved")
check(#notifications == n1 + 1, "changed value fired one notification")

-- state.changed describes the last write, not a sticky flag
lust:Update("player", { stacks = 3 })
check(state.changed == false, "changed flag reflects the last write")

-- independent clones
changed = lust:Update("target", { active = true })
check(changed == true, "second clone is a change")
check(lust:Count() == 2, "two clones live")
check(lust:States()["target"].active == true, "target clone stored")

-- clone id validation
ok, err = pcall(lust.Update, lust, nil, {})
check(not ok, "nil clone id fails")
ok, err = pcall(lust.Update, lust, true, {})
check(not ok, "boolean clone id fails")
ok, err = pcall(lust.Update, lust, "player", nil)
check(not ok, "nil fields table fails")

-- ── Timed progress ─────────────────────────────────────────────────────────────

__rgxNow = 100
changed, state = lust:UpdateProgress("player", { duration = 40, autoHide = true })
check(changed == true, "timed progress is a change")
check(state.progressType == "timed", "timed progressType")
check(state.duration == 40, "timed duration")
check(state.expirationTime == 140, "expirationTime = now + duration")
check(state.autoHide == true, "autoHide applied")
check(state.value == nil and state.total == nil, "static fields cleared")

-- identical timed progress still bumps expirationTime (time moves) -> changed
__rgxNow = 101
changed = lust:UpdateProgress("player", { duration = 40, autoHide = true })
check(changed == true and state.expirationTime == 141, "expirationTime recomputed from GetTime")

-- boundary: duration 0 is valid timed progress; math.huge is not
__rgxNow = 100
changed, state = lust:UpdateProgress("player", { duration = 0 })
check(changed == true and state.expirationTime == 100, "zero duration accepted")
ok, err = pcall(lust.UpdateProgress, lust, "player", { duration = math.huge })
check(not ok, "infinite duration fails")
ok, err = pcall(lust.UpdateProgress, lust, "player", { duration = 40, autoHide = "yes" })
check(not ok, "non-boolean autoHide in the timed form fails")

ok, err = pcall(lust.UpdateProgress, lust, "player", { duration = -1 })
check(not ok, "negative duration fails")
ok, err = pcall(lust.UpdateProgress, lust, "player", { duration = "x" })
check(not ok, "non-numeric duration fails")
ok, err = pcall(lust.UpdateProgress, lust, "player", { autoHide = "yes" })
check(not ok, "non-boolean autoHide fails")

-- ── Static progress and form switching ─────────────────────────────────────────

changed, state = lust:UpdateProgress("player", { value = 3, total = 8, inverse = true })
check(changed == true, "static progress is a change")
check(state.progressType == "static", "static progressType")
check(state.value == 3 and state.total == 8, "value/total applied")
check(state.inverse == true, "inverse applied")
check(state.duration == nil and state.expirationTime == nil and state.autoHide == nil,
      "timed fields cleared on switch")

changed = lust:UpdateProgress("player", { value = 3, total = 8, inverse = true })
check(changed == false, "identical static progress unchanged")

ok, err = pcall(lust.UpdateProgress, lust, "player", { value = "3", total = 8 })
check(not ok, "non-numeric static value fails")
changed, state = lust:UpdateProgress("player", { value = 1, total = 1 })
check(changed == true and state.total == 1, "total of exactly 1 accepted")
ok, err = pcall(lust.UpdateProgress, lust, "player", { value = 3, total = 0 })
check(not ok, "zero total fails")
ok, err = pcall(lust.UpdateProgress, lust, "player", { value = 3, total = 8, inverse = 1 })
check(not ok, "non-boolean inverse fails")
ok, err = pcall(lust.UpdateProgress, lust, "player", "nope")
check(not ok, "non-table progress fails")

-- ── Remove / Sweep / Clear ─────────────────────────────────────────────────────

local n2 = #notifications
check(lust:Remove("ghost") == false, "removing an absent clone reports false")
check(#notifications == n2, "absent removal fires no notification")

check(lust:Remove("target") == true, "removing a live clone reports true")
check(lust:Count() == 1, "clone removed")
check(#notifications == n2 + 1, "removal fired one notification")

lust:Update("a", { active = true })
lust:Update("b", { active = true })
lust:Update("c", { active = true })

local n3 = #notifications
local removed = lust:Sweep({ player = true, b = true })
check(removed == 2, "sweep removed the unkept clones")
check(lust:Count() == 2, "kept clones survive")
check(lust:States()["player"] ~= nil and lust:States()["b"] ~= nil, "keep set honored")
check(#notifications == n3 + 1, "sweep coalesced into one notification")

removed = lust:Clear()
check(removed == 2, "clear removed the remainder")
check(lust:Count() == 0, "no clones left")

-- a sweep that removes nothing fires no notification
lust:Update("player", { active = true })
local nSweep = #notifications
local removedNone = lust:Sweep({ player = true })
check(removedNone == 0, "full keep set removes nothing")
check(#notifications == nSweep, "no-op sweep fires no notification")

-- clearing a stale cross-form field is itself a change even when the new
-- fields are identical
lust:UpdateProgress("player", { duration = 40 })
lust:Update("player", { value = 99 })
__rgxNow = 100
changed, state = lust:UpdateProgress("player", { duration = 40 })
check(changed == true and state.value == nil, "clearing a stale field reports changed")

ok, err = pcall(lust.Sweep, lust, "nope")
check(not ok, "non-table keep set fails")

-- ── Failure isolation ──────────────────────────────────────────────────────────

local secondCalls = 0
Triggers:OnChanged("isolation", function() error("handler one exploded") end)
Triggers:OnChanged("isolation", function() secondCalls = secondCalls + 1 end)
local iso = Triggers:New("isolation")
local debugCalls = 0
local realDebug = RGX.Debug
RGX.Debug = function(_, msg)
    if type(msg) == "string" then debugCalls = debugCalls + 1 end
    return realDebug and realDebug(RGX, msg)
end
iso:Update("x", { active = true })
RGX.Debug = realDebug
check(secondCalls == 1, "second handler still ran after the first errored")
check(debugCalls >= 1, "handler error surfaced through RGX:Debug")

-- a successful notification never reaches the error path
local healthyCalls = 0
local healthy = Triggers:New("healthy")
Triggers:OnChanged("healthy", function() healthyCalls = healthyCalls + 1 end)
debugCalls = 0
RGX.Debug = function(_, msg)
    if type(msg) == "string" then debugCalls = debugCalls + 1 end
    return realDebug and realDebug(RGX, msg)
end
healthy:Update("x", { active = true })
RGX.Debug = realDebug
check(healthyCalls == 1, "healthy handler ran once")
check(debugCalls == 0, "successful dispatch never logs a handler error")

-- ── Unsubscribe and registry removal ──────────────────────────────────────────

local dropNotified = 0
local unsub = Triggers:OnChanged("dropped", function() dropNotified = dropNotified + 1 end)
local dropped = Triggers:New("dropped")
dropped:Update("x", { active = true })
check(dropNotified == 1, "handler active before unsubscribe")
unsub()
dropped:Update("x", { active = false })
check(dropNotified == 1, "unsubscribed handler no longer fires")

local preRemoveNotified = 0
Triggers:OnChanged("removed", function() preRemoveNotified = preRemoveNotified + 1 end)
local removedTrigger = Triggers:New("removed")
removedTrigger:Update("x", { active = true })
check(preRemoveNotified == 1, "notification before registry removal")
check(Triggers:Remove("removed") == true, "registry removal reports true")
check(Triggers:Remove("removed") == false, "second registry removal reports false")
check(Triggers:Get("removed") == nil, "removed trigger no longer resolvable")
removedTrigger:Update("x", { active = true })
check(preRemoveNotified == 2, "post-removal update fires no handlers (dropped with the registry)")

ok, err = pcall(Triggers.OnChanged, Triggers, "", function() end)
check(not ok, "OnChanged rejects an empty id")
check(Triggers:Get(7) == nil, "Get rejects a non-string id")

__rgxTriggersTestResult = string.format(
    "RGXTRIGGERS RUNTIME OK (%d checks: diffed updates, guaranteed progress shapes, sweep, failure isolation)",
    __rgxTriggersCheckCount)
