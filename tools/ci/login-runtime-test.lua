local RGX = assert(_G.RGXFramework, "RGX framework did not load")

local checks = 0
local function check(condition, message)
    if not condition then
        error("CHECK FAILED: " .. message, 2)
    end
    checks = checks + 1
end

local function contains(haystack, needle)
    return string.find(tostring(haystack), tostring(needle), 1, true) ~= nil
end

-- print capture
local realPrint = print
local captured = {}
local function startCapture()
    captured = {}
    _G.print = function(...)
        local parts = {}
        for i = 1, select("#", ...) do parts[#parts + 1] = tostring(select(i, ...)) end
        captured[#captured + 1] = table.concat(parts, " ")
    end
end
local function stopCapture()
    _G.print = realPrint
end

-- ── Framework version must come from TOC metadata (mocked: 2.7.5)
check(RGX.version == "2.7.5",
    "framework version must come from addon metadata, got " .. tostring(RGX.version))

-- ── 1: login messages default ON
check(RGX:IsLoginMessagesEnabled() == true, "login messages default ON")

-- ── framework startup: never announces itself to chat
startCapture()
RGX.eventFrame.scripts.OnEvent(RGX.eventFrame, "ADDON_LOADED", "RGX-Framework")
stopCapture()
check(#captured == 0, "framework init must not emit a startup line, got " .. #captured)

-- ── 6: CreateChatPrefix bare form = icon + spacer + [RGX]
local prefix = RGX:CreateChatPrefix()
check(contains(prefix, "[|r|cff58be81RGX|r|cffffffff]|r"), "bare prefix carries [RGX]")
check(contains(prefix, "logo.tga"), "bare prefix carries the framework icon")
check(contains(prefix, " - "), "bare prefix carries the spacer")
check(not contains(RGX:CreateChatPrefix({ icon = "" }), "|T"), "icon='' suppresses the icon")
check(contains(RGX:CreateChatPrefix({ tag = "RGXHELLO" }), "RGXHELLO"), "custom tag unlocks")

-- ── 2: SetLoginMessagesEnabled(false) persists false
RGX:SetLoginMessagesEnabled(false)
check(RGXFrameworkDB.showLoginMessages == false, "setting persists false in SavedVariables")
check(RGX:IsLoginMessagesEnabled() == false, "reports disabled after set")

-- ── 3: LoginMessage produces nothing when disabled
startCapture()
local loginReturn = RGX:LoginMessage("should not appear")
stopCapture()
check(#captured == 0, "LoginMessage prints nothing when disabled")
check(loginReturn == false, "LoginMessage returns false when suppressed")

-- ── declarative welcome obeys the login gate (7 + no duplicate output: 8)
-- The declarative init handler fires once per addon load, so use separate
-- addons for the disabled and enabled legs.
local welcomeDisabledAddon = RGXAddon("LoginWelcomeOff", { welcome = "welcome while off" })
startCapture()
RGX:FireEvent("ADDON_LOADED", "LoginWelcomeOff")
stopCapture()
check(#captured == 0, "welcome prints nothing while login messages are disabled")

-- ── 4: normal Print still prints while login messages are disabled
startCapture()
RGX:Print("normal output")
stopCapture()
check(#captured == 1 and contains(captured[1], "normal output"), "Print always works")

-- ── /rgxf login off confirmation is a normal command response (always prints)
local slash = RGX.slashCommands and RGX.slashCommands.RGXFRAMEWORK and RGX.slashCommands.RGXFRAMEWORK.callback
check(type(slash) == "function", "/rgxf slash handler registered")
startCapture()
slash("login off")
stopCapture()
check(#captured == 1 and contains(captured[1], "Login messages: OFF"),
    "/rgxf login off still prints its confirmation")

-- status with explicit boolean normalization
check(RGX:SetLoginMessagesEnabled(false) == false, "setter returns normalized false")
check(RGX:SetLoginMessagesEnabled(nil) == false, "setter normalizes nil to false")

-- ── 5: re-enable restores login output
startCapture()
slash("login on")
stopCapture()
check(#captured == 1 and contains(captured[1], "Login messages: ON"), "/rgxf login on confirms")
check(RGX:IsLoginMessagesEnabled() == true and RGXFrameworkDB.showLoginMessages == true,
    "re-enable persists true")
startCapture()
loginReturn = RGX:LoginMessage("hello again")
stopCapture()
check(#captured == 1, "LoginMessage prints after re-enable")
check(loginReturn == true, "LoginMessage returns true when printed")
check(contains(captured[1], "hello again"), "login output contains the message")

-- ── 7: welcome goes through LoginMessage when enabled
local welcomeAddon = RGXAddon("LoginWelcome", { welcome = "welcome when on" })
startCapture()
RGX:FireEvent("ADDON_LOADED", "LoginWelcome")
stopCapture()
check(#captured == 1, "welcome emits exactly one line when enabled, got " .. #captured)
check(contains(captured[1], "welcome when on"), "welcome text present")
check(contains(captured[1], "RGX") and contains(captured[1], "logo.tga"),
    "welcome uses the framework login prefix")

-- ── /rgxf login status
startCapture()
slash("login status")
stopCapture()
check(#captured == 1 and contains(captured[1], "Login messages:"), "/rgxf login status prints state")

check(welcomeAddon.name == "LoginWelcome", "addon object intact after welcome flow")


-- ── QueueForCombat returns distinguish queued from executed (issue #113).
local queuedFlag, queuedTag
queuedFlag, queuedTag = RGX:QueueForCombat(function() return "ran" end)
check(queuedFlag == "ran" and queuedTag == nil,
    "out of combat QueueForCombat runs immediately and returns the result")
_G.__inCombat = true
local executedNow = false
queuedFlag, queuedTag = RGX:QueueForCombat(function() executedNow = true end)
check(queuedFlag == false and queuedTag == "queued",
    "in combat QueueForCombat defers and reports false, 'queued'")
check(executedNow == false, "a queued function must not run during combat")
_G.__inCombat = false
RGX:ProcessCombatQueue()
check(executedNow == true, "the queued function runs when the queue flushes")


-- ── A timer fires exactly at the elapsed == duration boundary, and only once.
local boundaryFires = 0
RGX:After(1.0, function() boundaryFires = boundaryFires + 1 end, "boundary-exact-test")
RGX:UpdateTimers(0.5)
check(boundaryFires == 0, "half the interval must not fire the timer")
RGX:UpdateTimers(0.5)
check(boundaryFires == 1, "elapsed == duration must fire exactly at the boundary")
RGX:UpdateTimers(1.0)
check(boundaryFires == 1, "an expired timer must not fire a second time")

-- ── The Safe* guard family: every helper refuses invalid targets and
--        executes valid ones through the target's own method.
local safeCall = {}

local function guardCase(name, call, isValid)
    -- Invalid: nil target and a target missing the required method.
    check(call(nil) == false, name .. " must refuse a nil target")
    check(call({}) == false, name .. " must refuse a target without the method")
    if not isValid then return end
    local seen = {}
    local target = isValid(seen)
    check(call(target) == true, name .. " must accept a valid target")
    check(seen.called == true, name .. " must execute the target's own method")
    safeCall[#safeCall + 1] = name
end

guardCase("SafeSetPoint", function(t) return RGX:SafeSetPoint(t, "TOPLEFT", nil, "TOPLEFT", 0, 0) end,
    function(seen)
        local f = {}
        function f:SetPoint(...) seen.called = true end
        return f
    end)
guardCase("SafeSetSize", function(t) return RGX:SafeSetSize(t, 10, 20) end,
    function(seen)
        local f = {}
        function f:SetSize(w, h) seen.called = true; seen.w = w; seen.h = h end
        return f
    end)
guardCase("SafeSetText", function(t) return RGX:SafeSetText(t, "hi") end,
    function(seen)
        local f = {}
        function f:SetText(text) seen.called = true; seen.text = text end
        return f
    end)
check(safeCall[2] and true, "guard helper sanity")

-- Legacy dropdown guards: each refuses missing globals and calls through.
UIDropDownMenu_SetText = function(frame, text) _G.__ddSeen = { kind = "SetText", text = text } end
UIDropDownMenu_Initialize = function(frame, init) _G.__ddSeen = { kind = "Initialize" }; init() end
UIDropDownMenu_Refresh = function(frame) _G.__ddSeen = { kind = "Refresh" } end
UIDropDownMenu_EnableDropDown = function(frame) _G.__ddSeen = { kind = "Enable" } end
UIDropDownMenu_DisableDropDown = function(frame) _G.__ddSeen = { kind = "Disable" } end
UIDropDownMenu_Toggle = function(frame) _G.__ddSeen = { kind = "Toggle" } end
local ddFrame = {}
check(RGX:SafeUIDropDownMenu_SetText(ddFrame, "Title") == true, "dropdown SetText must run on a legacy client")
check(_G.__ddSeen and _G.__ddSeen.kind == "SetText" and _G.__ddSeen.text == "Title",
    "SafeUIDropDownMenu_SetText must forward the text")
check(RGX:SafeUIDropDownMenu_SetText(nil, "x") == false, "dropdown SetText must refuse nil")
check(RGX:SafeUIDropDownMenu_Initialize(ddFrame, function() end) == true,
    "dropdown Initialize must run on a legacy client")
check(RGX:SafeUIDropDownMenu_Initialize(nil, function() end) == false, "dropdown Initialize must refuse nil")
check(RGX:SafeUIDropDownMenu_Initialize(ddFrame, nil) == false, "dropdown Initialize must refuse a non-function initializer")
check(RGX:SafeUIDropDownMenu_Refresh(ddFrame) == true and _G.__ddSeen.kind == "Refresh",
    "dropdown Refresh must run on a legacy client")
check(RGX:SafeUIDropDownMenu_Refresh(nil) == false, "dropdown Refresh must refuse nil")
check(RGX:SafeUIDropDownMenu_EnableDropDown(ddFrame) == true and _G.__ddSeen.kind == "Enable",
    "dropdown Enable must run on a legacy client")
check(RGX:SafeUIDropDownMenu_EnableDropDown(nil) == false, "dropdown Enable must refuse nil")
check(RGX:SafeUIDropDownMenu_DisableDropDown(ddFrame) == true and _G.__ddSeen.kind == "Disable",
    "dropdown Disable must run on a legacy client")
check(RGX:SafeUIDropDownMenu_DisableDropDown(nil) == false, "dropdown Disable must refuse nil")
ToggleDropDownMenu = function(...) _G.__ddSeen = { kind = "ToggleMenu" } end
CloseDropDownMenus = function() _G.__ddSeen = { kind = "CloseMenus" } end
check(RGX:SafeToggleDropDownMenu(1, nil, nil, nil, 5) == true, "SafeToggleDropDownMenu must run on a legacy client")
check(_G.__ddSeen.kind == "ToggleMenu", "SafeToggleDropDownMenu must call the legacy global")
ToggleDropDownMenu = nil
check(RGX:SafeToggleDropDownMenu() == false, "SafeToggleDropDownMenu must refuse a missing global after removal")
check(RGX:SafeCloseDropDownMenus() == true and _G.__ddSeen.kind == "CloseMenus",
    "SafeCloseDropDownMenus must run on a legacy client")
check(RGX:SafeEnable(nil) == false and RGX:SafeDisable(nil) == false,
    "button Safe helpers must refuse nil targets")
local enableBtn = {}
function enableBtn:Enable() self.enabledNow = true end
function enableBtn:Disable() self.enabledNow = false end
check(RGX:SafeEnable(enableBtn) == true and enableBtn.enabledNow == true, "SafeEnable must run through the target")
check(RGX:SafeDisable(enableBtn) == true and enableBtn.enabledNow == false, "SafeDisable must run through the target")

-- ── Remaining Safe* guards and budget fallbacks (mutation coverage).
local guardWidget = {}
function guardWidget:SetChecked(v) self.checked = v end
function guardWidget:SetValue(v) self.value = v end
function guardWidget:SetMinMaxValues(lo, hi) self.minmax = { lo, hi } end
check(RGX:SafeSetChecked(nil, true) == false, "SafeSetChecked must refuse nil")
check(RGX:SafeSetChecked({}, true) == false, "SafeSetChecked must refuse a method-less checkbox")
check(RGX:SafeSetChecked(guardWidget, true) == true and guardWidget.checked == true,
    "SafeSetChecked must run through the checkbox's own method")
check(RGX:SafeSetValue(nil, 1) == false, "SafeSetValue must refuse nil")
check(RGX:SafeSetValue({}, 1) == false, "SafeSetValue must refuse a method-less slider")
check(RGX:SafeSetValue(guardWidget, 33) == true and guardWidget.value == 33,
    "SafeSetValue must run through the slider's own method")
check(RGX:SafeSetMinMaxValues(nil, 0, 1) == false, "SafeSetMinMaxValues must refuse nil")
check(RGX:SafeSetMinMaxValues({}, 0, 1) == false, "SafeSetMinMaxValues must refuse a method-less slider")
check(RGX:SafeSetMinMaxValues(guardWidget, 0, 100) == true and guardWidget.minmax[2] == 100,
    "SafeSetMinMaxValues must forward both bounds")

-- A stripped budget must fall back to safe defaults, and a nil queue
-- must not crash ProcessCombatQueue.
local savedBudget = RGX.timerBudget
RGX.timerBudget = nil
local budgetFired = 0
RGX:After(1.0, function() budgetFired = budgetFired + 1 end, "budget-fallback")
RGX:UpdateTimers(1.0)
RGX:UpdateTimers(1.0)
check(budgetFired == 1, "a nil timer budget must fall back to safe defaults and still fire")
RGX.timerBudget = savedBudget
local savedQueue = RGX.combatQueue
RGX.combatQueue = nil
check(RGX:ProcessCombatQueue() == true, "a nil combat queue must process as empty")
RGX.combatQueue = savedQueue

-- ── Timer lifecycle contracts (mutation coverage).
-- Documented budget defaults (see API.md Properties table).
check(RGX.timerBudget.maxPerFrame == 256
    and RGX.timerBudget.maxSeconds == 0.033
    and RGX.timerBudget.slowSeconds == 0.250,
    "documented timer budget defaults must hold")
check(RGX.timerBudget.slowByLabel["SharedMedia:QueueScan"] == 0.500,
    "the SharedMedia:QueueScan slow-by-label budget must stay documented")

local clampFired = 0
RGX:After(-1, function() clampFired = clampFired + 1 end, "clamp-test")
RGX:UpdateTimers(0.5)
check(clampFired == 1, "a negative duration clamps to zero and fires on the next tick")

local unlabeledTimer = RGX:After(5.0, function() end)
check(type(unlabeledTimer) == "table" and unlabeledTimer.label
    and string.sub(unlabeledTimer.label, 1, 6) == "timer#",
    "an unlabeled timer must derive a printable timer#N label")

-- CancelTimer: non-tables refuse; live timers cancel and never fire.
check(RGX:CancelTimer(nil) == false, "CancelTimer must refuse a non-table")
check(RGX:CancelTimer(unlabeledTimer) == true, "CancelTimer must accept a live timer")
local cancelledFires = 0
local cancelTarget = RGX:After(5.0, function() cancelledFires = cancelledFires + 1 end, "cancel-target")
RGX:CancelTimer(cancelTarget)
RGX:UpdateTimers(10)
check(cancelledFires == 0, "a cancelled timer must never fire")

-- CancelAllTimers counts only ACTIVE timers and returns the count.
local cancelAllWitness = 0
RGX:After(5.0, function() cancelAllWitness = cancelAllWitness + 1 end, "bulk-a")
RGX:After(5.0, function() cancelAllWitness = cancelAllWitness + 1 end, "bulk-b")
local staleTimer = RGX:After(5.0, function() cancelAllWitness = cancelAllWitness + 1 end, "bulk-stale")
RGX:CancelTimer(staleTimer)
local cancelledCount = RGX:CancelAllTimers()
check(cancelledCount == 2, "CancelAllTimers must count only active timers, got " .. cancelledCount)
check(RGX:CancelAllTimers() == 0, "a second CancelAllTimers must find nothing active")
RGX:UpdateTimers(10)
check(cancelAllWitness == 0, "bulk-cancelled timers must never fire")

-- Repeating timers repeat; one-shot timers do not.
local repeatFires = 0
RGX:Every(1.0, function() repeatFires = repeatFires + 1 end, "repeat-test")
RGX:UpdateTimers(1.0)
check(repeatFires == 1, "a repeating timer fires on its first interval")
RGX:UpdateTimers(1.0)
check(repeatFires == 2, "a repeating timer must fire again on the next interval")

-- ── Combat queue contracts (mutation coverage).
check(RGX:QueueForCombat(nil) == false, "QueueForCombat must refuse a non-function")
_G.__inCombat = true
local queuedArgs = nil
RGX:QueueForCombat(function(a, b, c) queuedArgs = { a, b, c } end, "x", 7, false)
_G.__inCombat = false
RGX:ProcessCombatQueue()
check(queuedArgs and queuedArgs[1] == "x" and queuedArgs[2] == 7
    and queuedArgs[3] == false,
    "queued functions must receive their arguments verbatim")
check(RGX:ProcessCombatQueue() == true, "processing an empty queue must report success")

-- ── Safe* guard symmetry.
check(RGX:SafeHide(nil) == false, "SafeHide must refuse a nil frame")
check(RGX:SafeHide({}) == false, "SafeHide must refuse a frame without a Hide method")

-- ── Safe* widget helpers and secureInvoke failure branches (mutation coverage).
local function spyFrame(throws)
    local f = { shown = false, points = nil }
    function f:Show()
        if throws then error("secure Show fault") end
        self.shown = true
    end
    function f:Hide() self.shown = false end
    function f:SetPoint(...) self.points = { ... } end
    return f
end

-- Non-frame guards: refuse without touching anything.
check(RGX:SafeShow(nil) == false, "SafeShow must refuse a nil frame")
check(RGX:SafeShow({}) == false, "SafeShow must refuse a frame without a Show method")

-- Out of combat: immediate execution through the frame's own methods.
local liveFrame = spyFrame(false)
check(RGX:SafeShow(liveFrame) == true, "SafeShow out of combat must report success")
check(liveFrame.shown == true, "SafeShow out of combat must actually show the frame")
RGX:SafeSetPoint(liveFrame, "TOPLEFT", "UIParent", "TOPLEFT", 4, -7)
check(liveFrame.points and liveFrame.points[1] == "TOPLEFT"
    and liveFrame.points[2] == "UIParent" and liveFrame.points[3] == "TOPLEFT"
    and liveFrame.points[4] == 4 and liveFrame.points[5] == -7,
    "SafeSetPoint must forward the anchor arguments verbatim")

-- In combat: queue, flush, and continue past a secure-invoke failure.
local brokenFrame, queuedFrame = spyFrame(true), spyFrame(false)
_G.__inCombat = true
RGX:SafeShow(brokenFrame)
RGX:SafeShow(queuedFrame)
check(queuedFrame.shown == false and brokenFrame.shown == false,
    "in combat SafeShow must defer, not run immediately")
_G.__inCombat = false
RGX:ProcessCombatQueue()
check(queuedFrame.shown == true,
    "the combat queue must continue past a secure-invoke failure")
check(brokenFrame.shown == false,
    "a throwing Show must not mark the frame shown")


-- ── Hook round-trip: guards, wrap, and duplicate refusal.
local hookTarget = {}
local hookOrder = {}
function hookTarget:Ping(x) hookOrder[#hookOrder + 1] = "orig" end
check(RGX:Hook(nil, "Ping", function() end) == false, "Hook must refuse a non-table target")
check(RGX:Hook(hookTarget, "", function() end) == false, "Hook must refuse an empty method")
check(RGX:Hook(hookTarget, "Ping", nil) == false, "Hook must refuse a non-function callback")
check(RGX:Hook(hookTarget, "Nope", function() end) == false, "Hook must refuse a missing method")
check(RGX:Hook(hookTarget, "Ping", function(self, x) hookOrder[#hookOrder + 1] = "hook" end) == true,
    "Hook must accept a valid target")
check(RGX:Hook(hookTarget, "Ping", function() end) == false,
    "Hook must refuse hooking the same method twice")
hookTarget:Ping()
check(hookOrder[1] == "orig" and hookOrder[2] == "hook",
    "a hooked method must run original then callback, in order")

-- ── RegisterSlashCommand normalization and token emission.
local slashCalls = {}
local token = RGX:RegisterSlashCommand({ "  /probe  ", "probe2", "", "/" }, function(msg)
    slashCalls[#slashCalls + 1] = msg
end, "ProbeCmd")
check(type(token) == "string" and token ~= "", "RegisterSlashCommand must return a token")
check(_G["SLASH_" .. token .. "1"] == "/probe",
    "the leading slash and surrounding spaces must be normalized away")
check(_G["SLASH_" .. token .. "2"] == "/probe2", "alias commands must be registered in order")
check(_G["SLASH_" .. token .. "3"] == nil, "empty and slash-only commands must be dropped")
SlashCmdList[token]("payload")
check(#slashCalls == 1 and slashCalls[1] == "payload", "the registered handler must receive the message")
check(RGX:RegisterSlashCommand({}, function() end) == false,
    "a command list with no valid entries must refuse")
check(RGX:RegisterSlashCommand("probe", nil) == false,
    "a non-function callback must refuse")

-- ── Sub-second timer boundaries and non-numeric durations.
local halfFired = 0
RGX:After(0.5, function() halfFired = halfFired + 1 end, "half-tick")
RGX:UpdateTimers(0.25)
check(halfFired == 0, "a quarter tick must not fire a half-second timer")
RGX:UpdateTimers(0.25)
check(halfFired == 1, "the second quarter tick must complete the half-second timer")

local nonNumericFired = 0
RGX:After("not-a-number", function() nonNumericFired = nonNumericFired + 1 end, "non-numeric")
-- UpdateTimers is cursor-driven (budget fairness): a call resumes from the
-- parked cursor, so drain with two calls to guarantee the newest timer is
-- visited regardless of where the cursor parked.
RGX:UpdateTimers(0)
RGX:UpdateTimers(0)
check(nonNumericFired == 1, "a non-numeric duration clamps to zero and fires on the next tick")
RGX:UpdateTimers(0)
RGX:UpdateTimers(0)
check(nonNumericFired == 1, "a fired one-shot must not fire again")

-- ── Isolated runtime reload: fresh state tables are load-order defense.
local freshRuntime = {}
local freshChunk, freshErr = loadstring(__runtimeSource, "@core/systems/runtime.lua")
assert(freshChunk, freshErr)
freshChunk("RGX-Framework", freshRuntime)
check(type(freshRuntime.timers) == "table" and type(freshRuntime.combatQueue) == "table",
    "an isolated runtime reload must initialize timers and the combat queue")
local freshFired = 0
freshRuntime:After(0, function() freshFired = freshFired + 1 end)
freshRuntime:UpdateTimers(1)
check(freshFired == 1, "an isolated runtime reload must run timers end to end")

_G.__rgxLoginCheckCount = checks
_G.__rgxLoginTestResult = string.format(
    "LUA RUNTIME OK  login messages (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
