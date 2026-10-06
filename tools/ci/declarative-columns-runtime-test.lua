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

-- UI seams: capture hosts and flows without emulating rendering.
local capturedPanels = {}
local function widget(host, kind, opts)
    return { host = host, kind = kind, opts = opts }
end
local stubUI = {}
function stubUI:CreateScrollPage(frame)
    local canvas = { width = 300, height = 0, scripts = {} }
    function canvas:GetWidth() return self.width end
    function canvas:SetHeight(h) self.height = h end
    function canvas:HookScript(name, fn) self.scripts[name] = fn end
    return canvas
end
function stubUI:CreateFlowLayout(host)
    local flow = { host = host, added = {} }
    function flow:Add(w) self.added[#self.added + 1] = w end
    function flow:Apply() return #self.added * 10 end
    return flow
end
function stubUI:CreateColumns(canvas, count)
    local columns = {}
    for i = 1, count do columns[i] = { column = i } end
    return unpack(columns)
end
function stubUI:CreateOptionsPanel(opts)
    capturedPanels[#capturedPanels + 1] = opts
    return { ready = true }
end
function stubUI:CreateToggle(host, opts) return widget(host, "toggle", opts) end
function stubUI:CreateSlider(host, opts) return widget(host, "slider", opts) end
function stubUI:CreateColorPicker(host, opts) return widget(host, "color", opts) end
function stubUI:CreateButton(host, opts) return widget(host, "button", opts) end
function stubUI:CreateLabel(host, opts) return widget(host, "label", opts) end
function RGX:GetUI() return stubUI end
function RGX:GetDropdowns() return nil end
function RGX:GetFonts() return nil end
function RGX:NewDatabase()
    return {}
end

local function toggles(n)
    local controls = {}
    for i = 1, n do controls[i] = { toggle = "opt" .. i } end
    return controls
end

-- columns renders through the tab content function; the panel stub captures
-- the tabs, and the test drives the captured content directly.
local function buildTab(name, options)
    local addon = RGXAddon(name, { db = {}, options = options })
    RGX:FireEvent("ADDON_LOADED", name)
    check(#capturedPanels == 1, name .. " should build exactly one panel")
    local tabs = capturedPanels[1].tabs
    capturedPanels = {}
    return addon, tabs
end

-- Track flows per content build by wrapping the stub factory for one build.
local builtFlows
local realCreateFlowLayout = stubUI.CreateFlowLayout
function stubUI:CreateFlowLayout(host)
    local flow = realCreateFlowLayout(self, host)
    builtFlows[#builtFlows + 1] = flow
    return flow
end

local function buildFlows(name, options, tabText)
    builtFlows = {}
    local _, tabs = buildTab(name, options)
    for _, tab in ipairs(tabs) do
        if tab.text == tabText then tab.content({}) end
    end
    return builtFlows
end

-- columns = 2 with five controls fills 3 + 2 in declaration order.
local flows2 = buildFlows("ColumnsTwo", { columns = 2, General = toggles(5) }, "General")
check(#flows2 == 2, "columns = 2 should create two flows")
check(#flows2[1].added == 3 and #flows2[2].added == 2, "five controls should fill 3 + 2")
check(flows2[1].added[1].opts.key == "opt1", "first control should lead column one")
check(flows2[1].added[3].opts.key == "opt3", "third control should end column one")
check(flows2[2].added[1].opts.key == "opt4", "fourth control should lead column two")

-- Omitted columns keeps today's single column.
local flows1 = buildFlows("ColumnsDefault", { General = toggles(5) }, "General")
check(#flows1 == 1, "omitted columns should keep a single flow")
check(#flows1[1].added == 5, "single flow should receive every control")

-- Explicit columns = 1 matches the default.
local flowsExplicit = buildFlows("ColumnsOne", { columns = 1, General = toggles(3) }, "General")
check(#flowsExplicit == 1 and #flowsExplicit[1].added == 3, "columns = 1 should match the default")

-- columns = 3 balances 2 + 1 + 1.
local flows3 = buildFlows("ColumnsThree", { columns = 3, General = toggles(4) }, "General")
check(#flows3 == 3, "columns = 3 should create three flows")
check(#flows3[1].added == 2 and #flows3[2].added == 1 and #flows3[3].added == 1, "four controls should fill 2 + 1 + 1")

-- The reserved key is never treated as a tab.
local _, tabsNoColumns = buildTab("ColumnsNoTab", { columns = 2, General = toggles(1) })
for _, tab in ipairs(tabsNoColumns) do
    check(tab.text ~= "columns", "columns must not become a tab")
end

-- Invalid counts fail before registration without leaking resources.
local function expectInvalidColumns(name, columns)
    local handlerCount = loadHandlerCount()
    local ok, err = pcall(function()
        RGXAddon(name, { db = {}, options = { columns = columns, General = {} } })
    end)
    check(not ok, name .. " should be rejected")
    check(contains(err, "options.columns must be 1, 2, or 3"), name .. " should explain the validation failure")
    check(RGX:GetAddon(name) == nil, name .. " should not mutate the addon registry")
    check(loadHandlerCount() == handlerCount, name .. " should not register a load handler")
end

expectInvalidColumns("ColumnsZero", 0)
expectInvalidColumns("ColumnsFour", 4)
expectInvalidColumns("ColumnsString", "two")
expectInvalidColumns("ColumnsTrue", true)

_G.__rgxRuntimeColumnsTestResult = string.format(
    "LUA RUNTIME OK  declarative columns (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
