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

local function attempts(event)
    return (RGX.eventFrame and RGX.eventFrame.attempts and RGX.eventFrame.attempts[event]) or 0
end

local function driverTick()
    local driver = RGX._registrationDriver
    assert(driver and driver.scripts and driver.scripts.OnUpdate, "anonymous registration driver missing")
    driver.scripts.OnUpdate(driver)
end

RGX.timerBudget.maxPerFrame = 1000
RGX.timerBudget.maxSeconds = 60
RGX.timerBudget.slowSeconds = 60

-- ── 1/2/3: registrations made inside an event handler queue, never register
--          natively on Blizzard's dispatch stack, and flush on the next frame.
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
check(pending("QUEST_ACCEPTED") == true, "QUEST_ACCEPTED must STAY pending after FireEvent returns (no dispatch-tail flush)")
check(native("QUEST_ACCEPTED") ~= true, "QUEST_ACCEPTED must not be native yet")
check(attempts("QUEST_ACCEPTED") == 0, "no native RegisterEvent attempt may occur on the event-dispatch stack")
check(RGX._registrationDriver._shown == true, "registration driver must be armed while pending events exist")
driverTick()
check(not pending("QUEST_ACCEPTED"), "next-frame driver should flush QUEST_ACCEPTED")
check(native("QUEST_ACCEPTED") == true, "QUEST_ACCEPTED should become a native frame event on the driver tick")
check(tracked("QUEST_ACCEPTED") == true, "QUEST_ACCEPTED should be tracked as registered")
check(attempts("QUEST_ACCEPTED") == 1, "driver should perform exactly one native attempt")
check(RGX._registrationDriver._shown == false, "driver must disarm once the queue is empty")
check((RGX._dispatchDepth or 0) == 0, "dispatch depth should return to zero")

-- ── 4: nested dispatch performs no flush at all; the single driver tick does
--       exactly one native attempt.
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
check(pending("QUEST_TURNED_IN") == true, "outermost dispatch return must not flush anymore")
check(attempts("QUEST_TURNED_IN") == 0, "no native attempt may happen during nested dispatch unwind")
driverTick()
check(not pending("QUEST_TURNED_IN"), "driver should flush QUEST_TURNED_IN")
check(native("QUEST_TURNED_IN") == true, "QUEST_TURNED_IN should become a native frame event")
check(attempts("QUEST_TURNED_IN") == 1, "nested flow must produce exactly one safe native attempt")
driverTick()
check(attempts("QUEST_TURNED_IN") == 1, "a second tick on an empty queue must attempt nothing")

-- ── Unit events follow the same deferred lifecycle.
local unitPending, unitNative
RGX:RegisterEvent("RGX_UNIT_BOOTSTRAP", function()
    RGX:RegisterUnitEvent("UNIT_AURA", "player", function() end, "test-unit-aura")
    unitPending = pending("UNIT_AURA")
    unitNative = native("UNIT_AURA")
end, "test-unit-bootstrap")
RGX:FireEvent("RGX_UNIT_BOOTSTRAP")
check(unitPending == true, "UNIT_AURA should queue during dispatch")
check(unitNative ~= true, "UNIT_AURA should not register natively during dispatch")
check(pending("UNIT_AURA") == true, "UNIT_AURA must stay pending until a driver tick")
driverTick()
check(native("UNIT_AURA") == true, "UNIT_AURA should become a native frame event on the driver tick")

-- ── 5: timer-created registrations flush through the driver, not at timer tail.
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
check(pending("QUEST_COMPLETE") == true, "QUEST_COMPLETE must stay pending after UpdateTimers returns")
check(attempts("QUEST_COMPLETE") == 0, "no native attempt may happen on the timer stack")
check((RGX._timerDispatchDepth or 0) == 0, "timer dispatch depth should return to zero")
driverTick()
check(native("QUEST_COMPLETE") == true, "driver should flush timer-created registrations")

-- ── 6/7: combat keeps registrations pending across driver ticks; leaving
--         combat lets the driver flush.
_G.__inCombat = true
RGX:RegisterEvent("CHAT_MSG_LOOT", function() end, "test-loot")
check(pending("CHAT_MSG_LOOT") == true, "combat registration should be pending")
check(native("CHAT_MSG_LOOT") ~= true, "combat registration should not touch the frame")
driverTick()
check(pending("CHAT_MSG_LOOT") == true, "driver must keep events pending while in combat")
check(native("CHAT_MSG_LOOT") ~= true, "driver must not register while in combat")
check(RGX._registrationDriver._shown == true, "driver stays armed while combat blocks the queue")
RGX:FireEvent("PLAYER_REGEN_ENABLED")
check(pending("CHAT_MSG_LOOT") == true, "firing a wake event must not synchronously flush")
check(native("CHAT_MSG_LOOT") ~= true, "still no native registration from the dispatch tail")
_G.__inCombat = false
driverTick()
check(not pending("CHAT_MSG_LOOT"), "leaving combat should let the driver flush")
check(native("CHAT_MSG_LOOT") == true, "CHAT_MSG_LOOT should register after combat")

-- ── 8: removed-before-flush events never register natively.
RGX:RegisterEvent("RGX_REMOVE_BOOTSTRAP", function()
    local id = RGX:RegisterEvent("QUEST_REMOVED_TEST", function() end, "test-remove")
    check(pending("QUEST_REMOVED_TEST") == true, "test event should start pending")
    RGX:UnregisterEvent("QUEST_REMOVED_TEST", id)
    check(not pending("QUEST_REMOVED_TEST"), "unregister should remove the pending marker")
end, "test-remove-bootstrap")
RGX:FireEvent("RGX_REMOVE_BOOTSTRAP")
driverTick()
check(native("QUEST_REMOVED_TEST") ~= true, "removed pending event must never become native")
check(attempts("QUEST_REMOVED_TEST") == 0, "removed pending event must never be attempted")

-- ── Unit-event cleanup is symmetric with normal event cleanup.
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

-- ── 9/10: a silently denied registration (protection-layer style: no Lua
--          error, IsEventRegistered stays false) is bounded, never marked.
RGX.eventFrame.deny["CHAT_MSG_SAY"] = true
RGX:RegisterEvent("CHAT_MSG_SAY", function() end, "test-denied")
check(attempts("CHAT_MSG_SAY") == 1, "denied event should be attempted once at registration time")
check(tracked("CHAT_MSG_SAY") ~= true, "denied event must NOT be tracked as registered (IsEventRegistered false)")
check(pending("CHAT_MSG_SAY") == true, "denied event should stay pending for the driver")
for _ = 1, 12 do
    driverTick()
end
check(tracked("CHAT_MSG_SAY") ~= true, "denied event must never become tracked")
-- 1 direct attempt at registration time + 10 capped driver attempts = 11 total
check(attempts("CHAT_MSG_SAY") == 11, "denied event must stop at the bounded attempt cap, got " .. attempts("CHAT_MSG_SAY"))
check(pending("CHAT_MSG_SAY") ~= true, "denied event must be dropped after the attempt cap (no infinite retry)")
driverTick()
check(attempts("CHAT_MSG_SAY") == 11, "after dropping, ticks must not attempt the event again")
check(RGX._registrationDriver._shown == false, "driver disarms once the queue is fully drained")

-- A native Lua error from the C API is likewise bounded.
RGX.eventFrame.throws["CHAT_MSG_EMOTE"] = true
RGX:RegisterEvent("CHAT_MSG_EMOTE", function() end, "test-throws")
for _ = 1, 12 do
    driverTick()
end
check(tracked("CHAT_MSG_EMOTE") ~= true, "erroring event must never become tracked")
check(attempts("CHAT_MSG_EMOTE") == 11, "erroring event must stop at the bounded attempt cap, got " .. attempts("CHAT_MSG_EMOTE"))
check(pending("CHAT_MSG_EMOTE") ~= true, "erroring event must be dropped after the attempt cap")

-- ── Unsupported events are known-invalid and never enter a retry cycle.
RGX:RegisterEvent("RGX_UNSUPPORTED_EVENT", function() end, "test-unsupported")
check(native("RGX_UNSUPPORTED_EVENT") ~= true, "unsupported event must never be native")
driverTick()
check(attempts("RGX_UNSUPPORTED_EVENT") == 0, "unsupported event must never be attempted natively")
check(pending("RGX_UNSUPPORTED_EVENT") ~= true, "unsupported event must be dropped as permanently invalid")
driverTick()
check(attempts("RGX_UNSUPPORTED_EVENT") == 0, "unsupported event must not be retried")

_G.__rgxEventsCheckCount = checks
_G.__rgxEventsTestResult = string.format(
    "LUA RUNTIME OK  event lifecycle (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
