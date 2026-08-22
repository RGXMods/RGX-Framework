local RGX = assert(_G.RGXFramework, "RGX framework did not load")

local checks = 0
local function check(condition, message)
    if not condition then
        error("CHECK FAILED: " .. message, 2)
    end
    checks = checks + 1
end

local function pending(event)
    return RGX.pendingFrameEvents and RGX.pendingFrameEvents[event] == true
end

local function native(event)
    return RGX.eventFrame and RGX.eventFrame.registered and RGX.eventFrame.registered[event] == true
end

local function tracked(event)
    return RGX.registeredFrameEvents and RGX.registeredFrameEvents[event] == true
end

RGX.timerBudget.maxPerFrame = 1000
RGX.timerBudget.maxSeconds = 60
RGX.timerBudget.slowSeconds = 60

-- BLU initializes its feature modules from PLAYER_LOGIN / PLAYER_ENTERING_WORLD.
-- Registrations made there must be deferred only until the outermost dispatch ends.
local duringLoginPending, duringLoginNative, loginDepth
RGX:RegisterEvent("PLAYER_LOGIN", function()
    loginDepth = RGX._dispatchDepth
    RGX:RegisterEvent("QUEST_ACCEPTED", function() end, "test-quest-accepted")
    duringLoginPending = pending("QUEST_ACCEPTED")
    duringLoginNative = native("QUEST_ACCEPTED")
end, "test-login")
RGX:FireEvent("PLAYER_LOGIN")
check(loginDepth == 1, "PLAYER_LOGIN callback should execute at dispatch depth 1")
check(duringLoginPending == true, "QUEST_ACCEPTED should be queued during PLAYER_LOGIN")
check(duringLoginNative ~= true, "QUEST_ACCEPTED must not register natively during dispatch")
check(not pending("QUEST_ACCEPTED"), "QUEST_ACCEPTED should flush after PLAYER_LOGIN")
check(native("QUEST_ACCEPTED") == true, "QUEST_ACCEPTED should become a native frame event")
check(tracked("QUEST_ACCEPTED") == true, "QUEST_ACCEPTED should be tracked as registered")
check((RGX._dispatchDepth or 0) == 0, "dispatch depth should return to zero")

-- Nested dispatch must not flush until the outermost event returns.
local innerDepth, innerSawPending, innerSawNative
RGX:RegisterEvent("PLAYER_ENTERING_WORLD", function()
    RGX:RegisterEvent("QUEST_TURNED_IN", function() end, "test-quest-turned-in")
    RGX:RegisterEvent("RGX_TEST_INNER", function()
        innerDepth = RGX._dispatchDepth
        innerSawPending = pending("QUEST_TURNED_IN")
        innerSawNative = native("QUEST_TURNED_IN")
    end, "test-inner")
    RGX:FireEvent("RGX_TEST_INNER")
end, "test-world")
RGX:FireEvent("PLAYER_ENTERING_WORLD")
check(innerDepth == 2, "nested FireEvent should increment dispatch depth")
check(innerSawPending == true, "nested dispatch should leave outer registration pending")
check(innerSawNative ~= true, "nested dispatch should not register the pending event")
check(not pending("QUEST_TURNED_IN"), "outermost return should flush QUEST_TURNED_IN")
check(native("QUEST_TURNED_IN") == true, "QUEST_TURNED_IN should become a native frame event")

-- RegisterUnitEvent follows the same deferred lifecycle.
local unitPending, unitNative
RGX:RegisterEvent("RGX_UNIT_BOOTSTRAP", function()
    RGX:RegisterUnitEvent("UNIT_AURA", "player", function() end, "test-unit-aura")
    unitPending = pending("UNIT_AURA")
    unitNative = native("UNIT_AURA")
end, "test-unit-bootstrap")
RGX:FireEvent("RGX_UNIT_BOOTSTRAP")
check(unitPending == true, "UNIT_AURA should queue during dispatch")
check(unitNative ~= true, "UNIT_AURA should not register natively during dispatch")
check(not pending("UNIT_AURA"), "UNIT_AURA should flush after dispatch")
check(native("UNIT_AURA") == true, "UNIT_AURA should become a native frame event")

-- Timer-created registrations are flushed when the timer driver exits.
local timerDepth, timerPending, timerNative
RGX:After(0, function()
    timerDepth = RGX._timerDispatchDepth
    RGX:RegisterEvent("QUEST_COMPLETE", function() end, "test-quest-complete")
    timerPending = pending("QUEST_COMPLETE")
    timerNative = native("QUEST_COMPLETE")
end, "event-lifecycle-test")
RGX:UpdateTimers(1)
check(timerDepth == 1, "timer callback should execute at timer dispatch depth 1")
check(timerPending == true, "QUEST_COMPLETE should queue during timer dispatch")
check(timerNative ~= true, "QUEST_COMPLETE should not register natively during timer dispatch")
check(not pending("QUEST_COMPLETE"), "QUEST_COMPLETE should flush after UpdateTimers")
check(native("QUEST_COMPLETE") == true, "QUEST_COMPLETE should become a native frame event")
check((RGX._timerDispatchDepth or 0) == 0, "timer dispatch depth should return to zero")

-- Combat-created registrations stay pending until a safe PLAYER_REGEN_ENABLED.
_G.__inCombat = true
RGX:RegisterEvent("CHAT_MSG_LOOT", function() end, "test-loot")
check(pending("CHAT_MSG_LOOT") == true, "combat registration should be pending")
check(native("CHAT_MSG_LOOT") ~= true, "combat registration should not touch the frame")
RGX:FireEvent("PLAYER_REGEN_ENABLED")
check(pending("CHAT_MSG_LOOT") == true, "pending event should remain queued while combat is active")
_G.__inCombat = false
RGX:FireEvent("PLAYER_REGEN_ENABLED")
check(not pending("CHAT_MSG_LOOT"), "leaving combat should flush pending registrations")
check(native("CHAT_MSG_LOOT") == true, "CHAT_MSG_LOOT should register after combat")

-- Removing the last pending handler must not create a dead native registration.
RGX:RegisterEvent("RGX_REMOVE_BOOTSTRAP", function()
    local id = RGX:RegisterEvent("QUEST_REMOVED_TEST", function() end, "test-remove")
    check(pending("QUEST_REMOVED_TEST") == true, "test event should start pending")
    RGX:UnregisterEvent("QUEST_REMOVED_TEST", id)
    check(not pending("QUEST_REMOVED_TEST"), "unregister should remove the pending marker")
end, "test-remove-bootstrap")
RGX:FireEvent("RGX_REMOVE_BOOTSTRAP")
check(native("QUEST_REMOVED_TEST") ~= true, "removed pending event must never become native")

-- Unit-event cleanup is symmetric with normal event cleanup.
RGX:RegisterUnitEvent("UNIT_POWER_UPDATE", "player", function() end, "test-power")
check(native("UNIT_POWER_UPDATE") == true, "UNIT_POWER_UPDATE should register immediately when safe")
RGX:UnregisterUnitEvent("UNIT_POWER_UPDATE", "test-power")
check(native("UNIT_POWER_UPDATE") ~= true, "last unit handler removal should unregister the native event")
check(tracked("UNIT_POWER_UPDATE") ~= true, "last unit handler removal should clear tracking")

-- Shared normal + unit handlers keep the native event until both are removed.
RGX:RegisterEvent("UNIT_HEALTH", function() end, "test-health-normal")
RGX:RegisterUnitEvent("UNIT_HEALTH", "player", function() end, "test-health-unit")
RGX:UnregisterUnitEvent("UNIT_HEALTH", "test-health-unit")
check(native("UNIT_HEALTH") == true, "normal handler should keep shared native event registered")
RGX:UnregisterEvent("UNIT_HEALTH", "test-health-normal")
check(native("UNIT_HEALTH") ~= true, "last shared handler removal should unregister native event")

_G.__rgxEventsCheckCount = checks
_G.__rgxEventsTestResult = string.format(
    "LUA RUNTIME OK  event lifecycle (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
