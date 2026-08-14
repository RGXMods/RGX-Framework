local RGX = assert(_G.RGXFramework, "RGX framework did not load")

local errors = {}
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

local function tableCount(tbl)
    local count = 0
    for _ in pairs(tbl or {}) do count = count + 1 end
    return count
end

local function loadHandlerCount()
    return tableCount(RGX.events and RGX.events.ADDON_LOADED)
end

function _G.geterrorhandler()
    return function(message)
        errors[#errors + 1] = tostring(message)
    end
end

RGX.timerBudget.maxPerFrame = 1000
RGX.timerBudget.maxSeconds = 60
RGX.timerBudget.slowSeconds = 60

local function expectInvalid(name, every, expected)
    local timerCount = #RGX.timers
    local handlerCount = loadHandlerCount()
    local slashCount = tableCount(RGX.slashCommands)
    local slashCounter = RGX._slashCommandCounter
    local ok, err = pcall(function()
        RGXAddon(name, { every = every, slash = name:lower() })
    end)
    check(not ok, name .. " should be rejected")
    check(contains(err, expected), name .. " should explain the validation failure")
    check(#RGX.timers == timerCount, name .. " should not create timers")
    check(RGX:GetAddon(name) == nil, name .. " should not mutate the addon registry")
    check(loadHandlerCount() == handlerCount, name .. " should not register a load handler")
    check(tableCount(RGX.slashCommands) == slashCount, name .. " should not register a slash command")
    check(RGX._slashCommandCounter == slashCounter, name .. " should not advance slash state")
end

expectInvalid("EveryNotTable", true, "'every' must be a table")
expectInvalid("EveryNumericName", { [1] = { 1, function() end } }, "non-empty name")
expectInvalid("EveryEmptyName", { [""] = { 1, function() end } }, "printable non-empty name")
expectInvalid("EveryWhitespaceName", { ["   "] = { 1, function() end } }, "printable non-empty name")
expectInvalid("EveryControlName", { ["tick\nname"] = { 1, function() end } }, "printable non-empty name")
expectInvalid("EveryDefinitionNotTable", { tick = true }, "must be { seconds, function }")
expectInvalid("EveryZero", { tick = { 0, function() end } }, "finite number greater than zero")
expectInvalid("EveryNegative", { tick = { -1, function() end } }, "finite number greater than zero")
expectInvalid("EveryNaN", { tick = { 0 / 0, function() end } }, "finite number greater than zero")
expectInvalid("EveryInfinite", { tick = { math.huge, function() end } }, "finite number greater than zero")
expectInvalid("EveryStringInterval", { tick = { "1", function() end } }, "finite number greater than zero")
expectInvalid("EveryMissingInterval", { tick = { [2] = function() end } }, "finite number greater than zero")
expectInvalid("EveryMissingHandler", { tick = { 1 } }, "must be a function")
expectInvalid("EveryWrongHandler", { tick = { 1, "handler" } }, "must be a function")
expectInvalid("EveryExtraField", { tick = { 1, function() end, "extra" } }, "exactly seconds and handler")
expectInvalid("EveryNamedField", { tick = { 1, function() end, label = "extra" } }, "exactly seconds and handler")
expectInvalid("EveryMetatableHandler", {
    tick = setmetatable({ [1] = 1 }, { __index = function(_, key)
        if key == 2 then return function() end end
    end }),
}, "must be a function")

local unicodeTimerName = "\194\160"
local unicodeAddon = RGXAddon("EveryUnicodeName", {
    every = { [unicodeTimerName] = { 10, function() end } },
})
RGX:FireEvent("ADDON_LOADED", "EveryUnicodeName")
check(#RGX.timers == 1 and RGX.timers[1].name == unicodeTimerName, "runtime and tooling should agree on non-ASCII printable names")
unicodeAddon:CancelTimer(RGX.timers[1])
RGX:UpdateTimers(0)

local optsOk, optsErr = pcall(function() RGXAddon("InvalidOpts", false) end)
check(not optsOk and contains(optsErr, "options must be a table"), "non-table addon options should be rejected")
check(RGX:GetAddon("InvalidOpts") == nil, "invalid addon options should not register an addon")
local tableOk, tableErr = pcall(function() RGXAddon("InvalidAddonTable", { table = true }) end)
check(not tableOk and contains(tableErr, "'table' must be a table"), "non-table addon objects should be rejected")
check(RGX:GetAddon("InvalidAddonTable") == nil, "invalid addon objects should not register an addon")

local duplicate = RGXAddon("EveryDuplicate", { slash = "everyduplicate" })
local duplicateHandlers = loadHandlerCount()
local duplicateSlashes = tableCount(RGX.slashCommands)
local duplicateCounter = RGX._slashCommandCounter
local duplicateOk, duplicateErr = pcall(function()
    RGXAddon("EveryDuplicate", {
        slash = "leaked",
        every = { leaked = { 1, function() end } },
    })
end)
check(not duplicateOk, "duplicate addon declarations should be rejected")
check(contains(duplicateErr, "already registered"), "duplicate rejection should name the problem")
check(RGX:GetAddon("EveryDuplicate") == duplicate, "duplicate declarations should preserve the original addon")
check(loadHandlerCount() == duplicateHandlers, "duplicate declarations should preserve load handlers")
check(tableCount(RGX.slashCommands) == duplicateSlashes, "duplicate declarations should not leak slash commands")
check(RGX._slashCommandCounter == duplicateCounter, "duplicate declarations should not advance slash state")
check(#RGX.timers == 0, "duplicate declarations should not leak timers")
RGX:FireEvent("ADDON_LOADED", "EveryDuplicate")

local lifecycleAddon
local lifecycleRegistrations = 0
function RGX:NewDatabase()
    return { ready = true }
end
function RGX:GetMinimap()
    return {
        Create = function(_, opts)
            check(opts.storage == lifecycleAddon.db, "minimap setup should receive the addon database")
            return { ready = true }
        end,
    }
end
function RGX:GetUI()
    return {
        CreateOptionsPanel = function(_, opts)
            check(opts.addonName == "EveryOrder", "options should be built before timer binding")
            return { ready = true }
        end,
    }
end
function RGX:GetDropdowns() return nil end

local originalEvery = RGX.Every
function RGX:Every(duration, callback, label)
    if label and contains(label, "EveryOrder:every:") then
        lifecycleRegistrations = lifecycleRegistrations + 1
        check(lifecycleAddon.db and lifecycleAddon.db.ready, "database should exist before timer binding")
        check(lifecycleAddon.minimapButton and lifecycleAddon.minimapButton.ready, "minimap should exist before timer binding")
        check(lifecycleAddon.panel and lifecycleAddon.panel.ready, "options should exist before timer binding")
    end
    return originalEvery(self, duration, callback, label)
end

local order = {}
lifecycleAddon = RGXAddon("EveryOrder", {
    db = {},
    minimap = true,
    options = { General = {} },
    every = {
        zeta = { 1, function(self, timer)
            check(self == lifecycleAddon, "zeta should receive the addon")
            check(timer.owner == self, "zeta should own its timer")
            check(timer.name == "zeta" and timer.declarativeName == "zeta", "zeta should retain its name")
            order[#order + 1] = "zeta"
        end },
        alpha = { 1, function(self, timer)
            check(self == lifecycleAddon, "alpha should receive the addon")
            check(timer.label == "EveryOrder:every:alpha", "alpha should have a stable label")
            order[#order + 1] = "alpha"
        end },
        ["middle.timer"] = { 1, function(_, timer)
            check(timer.name == "middle.timer", "punctuated timer names should survive")
            order[#order + 1] = "middle.timer"
        end },
    },
    onInit = function(self)
        check(#RGX.timers == 3, "onInit should see bound declarative timers")
    end,
})

check(#RGX.timers == 0, "declarative timers should wait for ADDON_LOADED")
RGX:FireEvent("ADDON_LOADED", "AnotherAddon")
check(#RGX.timers == 0, "another addon's load should not start timers")
RGX:FireEvent("ADDON_LOADED", "EveryOrder")
check(#RGX.timers == 3 and lifecycleRegistrations == 3, "matching ADDON_LOADED should start every timer once")
RGX:FireEvent("ADDON_LOADED", "EveryOrder")
check(#RGX.timers == 3 and lifecycleRegistrations == 3, "repeated ADDON_LOADED should not duplicate timers")
RGX:UpdateTimers(0.5)
check(#order == 0, "a repeating timer should not fire before its interval")
RGX:UpdateTimers(0.5)
check(table.concat(order, ",") == "alpha,middle.timer,zeta", "same-tick timers should dispatch by name")
for _, timer in ipairs(RGX.timers) do
    if timer.owner == lifecycleAddon then lifecycleAddon:CancelTimer(timer) end
end
RGX:UpdateTimers(0)
check(#RGX.timers == 0, "cancelled named timers should leave the scheduler")

local selfCancelTicks = 0
local selfCancelAddon
selfCancelAddon = RGXAddon("EverySelfCancel", {
    every = {
        once = { 1, function(self, timer)
            selfCancelTicks = selfCancelTicks + 1
            self:CancelTimer(timer)
        end },
    },
})
RGX:FireEvent("ADDON_LOADED", "EverySelfCancel")
RGX:UpdateTimers(1)
check(selfCancelTicks == 1, "a declarative timer should be able to cancel itself")
check(#RGX.timers == 0, "self-cancellation should remove the named timer")
RGX:UpdateTimers(2)
check(selfCancelTicks == 1, "a cancelled declarative timer should not fire again")

local healthyTicks = 0
local failingAddon = RGXAddon("EveryFailureIsolation", {
    every = {
        broken = { 1, function()
            error("expected timer failure")
        end },
        healthy = { 1, function()
            healthyTicks = healthyTicks + 1
        end },
    },
})
RGX:FireEvent("ADDON_LOADED", "EveryFailureIsolation")
RGX:UpdateTimers(1)
RGX:UpdateTimers(1)
check(healthyTicks == 2, "one failing timer should not stop another timer")
check(#errors == 2, "a failing repeating timer should remain active and report each failure")
check(contains(errors[1], "EveryFailureIsolation:every:broken"), "timer errors should include the stable label")
for _, timer in ipairs(RGX.timers) do
    if timer.owner == failingAddon then failingAddon:CancelTimer(timer) end
end
RGX:UpdateTimers(0)

local fairSeen = {}
local fairTimers = {}
local clockTimerFired = false
RGX:After(0.1, function() clockTimerFired = true end, "budget-clock-test")
for index = 1, 257 do
    local name = string.format("timer%03d", index)
    fairTimers[name] = { 0.001, function(_, timer)
        fairSeen[timer.name] = true
    end }
end
local fairAddon = RGXAddon("EveryBudgetFair", { every = fairTimers })
RGX:FireEvent("ADDON_LOADED", "EveryBudgetFair")
RGX.timerBudget.maxPerFrame = 256
RGX:UpdateTimers(0.016)
check(not fairSeen.timer257, "the first budgeted update should defer the last timer")
RGX:UpdateTimers(0.016)
check(fairSeen.timer257 == true, "the persistent cursor should prevent timer starvation")
for _ = 3, 10 do RGX:UpdateTimers(0.016) end
check(clockTimerFired, "budget deferral should not dilate another timer's clock")
for _, timer in ipairs(RGX.timers) do
    if timer.owner == fairAddon then fairAddon:CancelTimer(timer) end
end
RGX:UpdateTimers(0)
RGX.timerBudget.maxPerFrame = 1000

local imperativeAddon = RGXAddon("EveryOwner", {})
local afterTimer = imperativeAddon:After(10, function() end, "owned-after")
local everyTimer = imperativeAddon:Every(10, function() end, "owned-every")
check(afterTimer.owner == imperativeAddon and everyTimer.owner == imperativeAddon, "addon timer wrappers should set ownership metadata")
imperativeAddon:CancelTimer(afterTimer)
imperativeAddon:CancelTimer(everyTimer)
RGX:UpdateTimers(0)

_G.__rgxRuntimeTestResult = string.format(
    "LUA RUNTIME OK  declarative every (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
