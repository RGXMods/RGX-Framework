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

-- ── A throwing error-display addon must not wedge dispatch. The harness
--        installs geterrorhandler() -> error(), the exact hostile condition.
--        Before the fix: the first failing handler aborted the dispatch loop,
--        remaining handlers were skipped, and _dispatchDepth latched above 0,
--        leaving every later RegisterEvent pending forever.
local throwSecondRan, throwLogBefore = false, RGX._errorLog and #RGX._errorLog or 0
RGX:RegisterEvent("RGX_THROW_DISPATCH", function()
    error("expected handler failure")
end, "test-throw-first")
RGX:RegisterEvent("RGX_THROW_DISPATCH", function()
    throwSecondRan = true
end, "test-throw-second")
RGX:FireEvent("RGX_THROW_DISPATCH")
check(throwSecondRan == true, "a failing handler must not stop the remaining handlers")
check((RGX._dispatchDepth or -1) == 0, "dispatch depth must return to zero after a failing handler")
check(RGX._errorLog and #RGX._errorLog > throwLogBefore,
    "a throwing error handler must fall back to the internal error log")
RGX:RegisterEvent("RGX_THROW_AFTERMATH", function() end, "test-throw-aftermath")
check(not pending("RGX_THROW_AFTERMATH"), "post-failure registration must not stay wedged pending")
driverTick()
check(native("RGX_THROW_AFTERMATH") == true, "post-failure registration must reach the frame")

-- ── Unit dispatch snapshots like the plain path: a handler registered
--        mid-dispatch runs on the NEXT dispatch, not the current one.
local unitReentrantRan = false
local unitReentrancyArmed = false
RGX:RegisterUnitEvent("UNIT_ENERGY", "player", function()
    if not unitReentrancyArmed then
        unitReentrancyArmed = true
        RGX:RegisterUnitEvent("UNIT_ENERGY", "player", function()
            unitReentrantRan = true
        end, "test-unit-late")
    end
end, "test-unit-first")
RGX:FireEvent("UNIT_ENERGY", "player")
check(unitReentrantRan == false,
    "a unit handler registered mid-dispatch must not run in the same dispatch")
check(native("UNIT_ENERGY") == true, "UNIT_ENERGY must already be registered natively")
RGX:FireEvent("UNIT_ENERGY", "player")
check(unitReentrantRan == true, "the late unit handler runs on the next dispatch")


-- ── Registration at rest (fresh session, nil dispatch depth) must not defer.
RGX:RegisterEvent("RGX_EARLY_AT_REST", function() end, "test-early-rest")
check(not pending("RGX_EARLY_AT_REST"), "a registration at rest must not defer")

-- ── Registration API refusal contracts.
check(RGX:RegisterEvent(nil, function() end) == false, "a nil event name must refuse")
check(RGX:RegisterEvent("", function() end) == false, "an empty event name must refuse")
check(RGX:RegisterEvent("RGX_REFUSALS", nil) == false, "a non-function callback must refuse")
check(RGX:RegisterUnitEvent("", "player", function() end) == false, "an empty unit-event name must refuse")
check(RGX:RegisterUnitEvent("RGX_REFUSALS", nil, function() end) == false, "a nil unit must refuse")
check(RGX:RegisterUnitEvent("RGX_REFUSALS", 123, function() end) == false,
    "a non-string non-table unit must refuse")
check(RGX:RegisterUnitEvent("RGX_REFUSALS", {}, function() end) == false,
    "an empty units list must refuse")
local stringOwnerNoMethod = {}
check(RGX:RegisterEvent("RGX_REFUSALS", "NoSuchMethod", "str-no", stringOwnerNoMethod) == false,
    "a string callback with no owner method must refuse")
function stringOwnerNoMethod:RealMethod() end
check(RGX:RegisterEvent("RGX_REFUSALS", "RealMethod", "str-ok", stringOwnerNoMethod) ~= false,
    "a string callback with a resolvable owner method must register")

-- A units table registers exactly its listed tokens.
local multiSaw = {}
RGX:RegisterUnitEvent("RGX_UNIT_MULTI", { "player", "target" }, function(_, token)
    multiSaw[#multiSaw + 1] = token
end, "test-multi")
RGX:FireEvent("RGX_UNIT_MULTI", "player")
RGX:FireEvent("RGX_UNIT_MULTI", "target")
RGX:FireEvent("RGX_UNIT_MULTI", "pet")
check(#multiSaw == 2 and multiSaw[1] == "player" and multiSaw[2] == "target",
    "a units table must match exactly its listed tokens, fired " .. #multiSaw)
check(RGX:RegisterUnitEvent("RGX_UNIT_SKIP", { 123, "player" }, function() end, "test-skip") == false,
    "a units table with a non-string candidate must refuse the whole registration")
check(RGX:RegisterUnitEvent("RGX_UNIT_SKIP", { "player", "" }, function() end, "test-skip") == false,
    "a units table with an empty-string candidate must refuse the whole registration")

-- ── Registration-deferral signals are independent: each alone must defer.
local realUAC = UnitAffectingCombat
UnitAffectingCombat = function() return false end
_G.__inCombat = true
RGX:RegisterEvent("CHAT_MSG_ICL_SIGNAL", function() end, "test-icl-signal")
check(pending("CHAT_MSG_ICL_SIGNAL") == true,
    "InCombatLockdown alone must defer registration")
_G.__inCombat = false
UnitAffectingCombat = function() return true end
RGX:RegisterEvent("CHAT_MSG_UAC_SIGNAL", function() end, "test-uac-signal")
check(pending("CHAT_MSG_UAC_SIGNAL") == true,
    "UnitAffectingCombat alone must defer registration")
UnitAffectingCombat = function() return false end
C_PetBattles = { IsInBattle = function() return true end }
RGX:RegisterEvent("CHAT_MSG_PET_SIGNAL", function() end, "test-pet-signal")
check(pending("CHAT_MSG_PET_SIGNAL") == true,
    "an active pet battle alone must defer registration")
C_PetBattles = nil
UnitAffectingCombat = realUAC
driverTick()
check(not pending("CHAT_MSG_ICL_SIGNAL") and not pending("CHAT_MSG_UAC_SIGNAL")
    and not pending("CHAT_MSG_PET_SIGNAL"),
    "cleared deferral signals must let the driver flush")

-- ── Unregister contracts: exact id match, unknown ids refuse.
local unregId = RGX:RegisterEvent("RGX_UNREG_TARGET", function() end, "test-unreg")
check(type(unregId) == "string", "RegisterEvent must return the handler id")
-- Unregistering only validates the id SHAPE: unknown-but-well-formed ids
-- return true (bucket cleanup is idempotent); malformed ids refuse.
check(RGX:UnregisterEvent("RGX_UNREG_TARGET", 123) == false,
    "a non-string handler id must refuse")
check(RGX:UnregisterEvent("RGX_UNREG_TARGET", "") == false,
    "an empty handler id must refuse")
check(RGX:UnregisterEvent("RGX_UNREG_TARGET", unregId) == true,
    "unregistering the exact handler id must succeed")
check(RGX:UnregisterEvent("RGX_NO_SUCH_EVENT_BUCKET", unregId) == false,
    "unregistering from an event with no handlers must refuse")

-- ── Restricted-value boundary: canAccessValue delegates to RGX.API and a
--        denied token must never reach a handler.
local realCanAccess = RGX.API and RGX.API.CanAccessValue
assert(type(realCanAccess) == "function", "harness must provide RGX.API.CanAccessValue")
local deniedToken = "RESTRICTED_UNIT_TOKEN"
-- Lua prefixes error(string) values with chunk:line:, so the denial must
-- pattern-match the token rather than compare exact strings.
RGX.API.CanAccessValue = function(value)
    if type(value) == "string"
        and string.find(value, deniedToken, 1, true) then
        return false
    end
    return realCanAccess(value)
end
local restrictedSaw = false
RGX:RegisterUnitEvent("UNIT_RESTRICTED_TEST", "player", function()
    restrictedSaw = true
end, "test-restricted")
RGX:FireEvent("UNIT_RESTRICTED_TEST", deniedToken)
check(restrictedSaw == false, "a denied unit token must not reach unit handlers")
RGX:FireEvent("UNIT_RESTRICTED_TEST", "player")
check(restrictedSaw == true, "an accessible token must still reach the handler")

-- A restricted error VALUE reports as inaccessible text, never its content.
local logBeforeSecret = #RGX._errorLog
RGX:RegisterEvent("RGX_SECRET_ERR", function()
    error(deniedToken)
end, "test-secret-err")
RGX:FireEvent("RGX_SECRET_ERR")
check(#RGX._errorLog == logBeforeSecret + 1, "a restricted error must still be reported")
check(string.find(RGX._errorLog[#RGX._errorLog], "<inaccessible error>", 1, true) ~= nil,
    "a restricted error value must never render its text")
RGX.API.CanAccessValue = realCanAccess

-- ── The internal error log is bounded and drops the OLDEST entries.
RGX._errorLog = {}
local capCount = 0
RGX:RegisterEvent("RGX_CAP_ERR", function()
    capCount = capCount + 1
    error("cap fault " .. capCount)
end, "test-cap")
for _ = 1, 55 do
    RGX:FireEvent("RGX_CAP_ERR")
end
check(#RGX._errorLog == 50, "the error log must cap at 50 entries, got " .. #RGX._errorLog)
check(string.find(RGX._errorLog[1], "cap fault 6", 1, true) ~= nil,
    "the cap must drop the OLDEST entries and keep the newest")
check(string.find(RGX._errorLog[50], "cap fault 55", 1, true) ~= nil,
    "the newest report must be the last entry")

-- ── A healthy error handler receives reports; the log must not grow.
local handlerSeen = {}
local savedHandlerFactory = geterrorhandler
geterrorhandler = function()
    return function(message) handlerSeen[#handlerSeen + 1] = message end
end
local logBeforeHealthy = #RGX._errorLog
RGX:RegisterEvent("RGX_HEALTHY_ERR", function()
    error("healthy fault")
end, "test-healthy")
RGX:FireEvent("RGX_HEALTHY_ERR")
RGX.eventFrame.throws["RGX_HEALTHY_REG"] = true
RGX:RegisterEvent("RGX_HEALTHY_REG", function() end, "test-healthy-reg")
for _ = 1, 11 do
    driverTick()
end
geterrorhandler = savedHandlerFactory
check(#handlerSeen >= 1, "a healthy error handler must receive dispatch reports")
check(#RGX._errorLog == logBeforeHealthy,
    "the log must not grow while the installed handler is healthy")
local sawDispatch = false
for _, message in ipairs(handlerSeen) do
    if string.find(message, "RGX_HEALTHY_ERR", 1, true) then sawDispatch = true end
end
check(sawDispatch, "the dispatch report must name the failing event")

-- ── Wake events stay natively registered when their last handler leaves.
RGX:RegisterEvent("PLAYER_LOGIN", function() end, "test-wake-reg")
driverTick()
check(native("PLAYER_LOGIN") == true, "wake events register natively like any other")
RGX:UnregisterEvent("PLAYER_LOGIN", "test-login")
RGX:UnregisterEvent("PLAYER_LOGIN", "test-wake-reg")
-- The wake branch skips BOTH the native UnregisterEvent and the tracking
-- clear: the shared frame keeps broadcasting wake events for everyone.
check(tracked("PLAYER_LOGIN") == true,
    "unregistering a wake event's last handler keeps the tracking marker")
check(native("PLAYER_LOGIN") == true,
    "wake events must NOT be natively unregistered (the shared frame keeps them)")

-- ── The internal message bus round-trips and unregisters cleanly.
local messageSeen, messagePayload
RGX:RegisterMessage("RGX_TEST_PING", function(message, payload)
    messageSeen = message
    messagePayload = payload
end, "test-message")
RGX:SendMessage("RGX_TEST_PING", { flag = true })
check(messageSeen == "RGX_TEST_PING" and messagePayload and messagePayload.flag == true,
    "SendMessage must deliver the message name and payload")
local secondMessageRuns = 0
RGX:RegisterMessage("RGX_TEST_ONCE", function() secondMessageRuns = secondMessageRuns + 1 end, "test-once")
RGX:UnregisterMessage("RGX_TEST_ONCE", "test-once")
RGX:SendMessage("RGX_TEST_ONCE")
check(secondMessageRuns == 0, "an unregistered message handler must not fire")

-- ── A non-callback error inside dispatch cannot latch _dispatchDepth.
-- Corrupt a registered bucket with a non-table entry: the snapshot loop
-- faults outside any per-handler pcall, which used to skip the decrement
-- and wedge every later registration pending for the whole session.
RGX:RegisterEvent("RGX_POISON_BODY", function() end, "test-poison-body")
RGX.events["RGX_POISON_BODY"]["corrupt-entry"] = 5
RGX:FireEvent("RGX_POISON_BODY")
check((RGX._dispatchDepth or -1) == 0,
    "a non-callback dispatch error must not latch _dispatchDepth, got " .. tostring(RGX._dispatchDepth))
-- The log may already be at its 50-entry cap, so assert on CONTENT: the
-- newest report must name the poisoned event.
check(RGX._errorLog
    and string.find(RGX._errorLog[#RGX._errorLog], "RGX_POISON_BODY", 1, true) ~= nil,
    "a non-callback dispatch error must be reported, not swallowed silently")

-- The pipeline stays healthy and registration never wedges.
local poisonHealthy = 0
RGX:RegisterEvent("RGX_POISON_AFTER", function() poisonHealthy = poisonHealthy + 1 end, "test-poison-after")
RGX:FireEvent("RGX_POISON_AFTER")
check(poisonHealthy == 1, "dispatch must stay healthy after a non-callback dispatch error")
RGX:RegisterEvent("RGX_POISON_REG", function() end, "test-poison-reg")
check(not pending("RGX_POISON_REG"), "registration must not be wedged after a dispatch error")
driverTick()
check(native("RGX_POISON_REG") == true, "post-error registration must reach the frame")

-- A string-method owner that breaks AFTER registration (method resolution
-- faults at dispatch) is a handler fault: per-handler pcall isolation must
-- let the other unit handlers in the same dispatch run and the depth must
-- return to zero. registerHandler validates the method at registration,
-- so the corruption happens afterwards to simulate the late breakage.
local poisonGoodOwner = {}
function poisonGoodOwner:RealMethod() end
local poisonBrokenOwner = setmetatable({}, { __index = function() error("poisoned owner index") end })
local poisonSurvivorRuns = 0
RGX:RegisterUnitEvent("RGX_POISON_UNIT", "player", "RealMethod", "test-poison-unit", poisonGoodOwner)
RGX:RegisterUnitEvent("RGX_POISON_UNIT", "player", function() poisonSurvivorRuns = poisonSurvivorRuns + 1 end, "test-poison-survivor")
RGX.unitEvents["RGX_POISON_UNIT"]["test-poison-unit"].owner = poisonBrokenOwner
RGX:FireEvent("RGX_POISON_UNIT", "player")
check(poisonSurvivorRuns == 1,
    "a string-method owner broken after registration must not stop the other unit handlers, ran " .. poisonSurvivorRuns)
check((RGX._dispatchDepth or -1) == 0,
    "unit dispatch depth must return to zero after handler faults, got " .. tostring(RGX._dispatchDepth))


-- ── State initialization: a fresh RGX table must self-initialize (the
--        `or {}` inits are load-order defense, not dead code).
local fresh = {}
local freshChunk, freshErr = loadstring(__eventsSource, "@core/systems/events.lua")
assert(freshChunk, freshErr)
freshChunk("RGX-Framework", fresh)
check(type(fresh.events) == "table" and type(fresh.messages) == "table"
    and type(fresh.pendingFrameEvents) == "table",
    "an isolated reload must initialize the event state tables")
local freshSeen = false
fresh:RegisterMessage("RGX_FRESH_TEST", function() freshSeen = true end)
fresh:SendMessage("RGX_FRESH_TEST")
check(freshSeen == true, "an isolated reload must round-trip messages end to end")

_G.__rgxEventsCheckCount = checks
_G.__rgxEventsTestResult = string.format(
    "LUA RUNTIME OK  event lifecycle (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
