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
local stubUI = { _BuildAddonOptionTabs = __rgxBuildAddonOptionTabs }
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
function stubUI:CreateSwitch(host, opts)
    local w = widget(host, "switch", opts)
    w.scripts = {}
    function w:HookScript(name, fn) self.scripts[name] = fn end
    function w:Refresh() self.refreshCount = (self.refreshCount or 0) + 1 end
    return w
end
function stubUI:CreateTextInput(host, opts) return widget(host, "textbox", opts) end
function stubUI:CreatePanelAlpha(host, opts) return widget(host, "panel_alpha", opts) end
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

-- Table-form textbox rows dispatch through the factory with the db binding.
local flowsTextbox = buildFlows("TextboxRow", { General = { { textbox = "keyword", label = "Keyword", default = "seed", placeholder = "Hint" } } }, "General")
check(#flowsTextbox == 1 and #flowsTextbox[1].added == 1, "textbox row should produce one control")
local textbox = flowsTextbox[1].added[1]
check(textbox.kind == "textbox" and textbox.opts.key == "keyword", "textbox row must forward the db key")
check(textbox.opts.label == "Keyword" and textbox.opts.default == "seed" and textbox.opts.placeholder == "Hint", "textbox row must forward label, default, and placeholder")
check(type(textbox.opts.storage) == "table", "textbox row must bind the addon db")
local flowsTextboxDefault = buildFlows("TextboxDefaultLabel", { General = { { textbox = "keyword" } } }, "General")
check(flowsTextboxDefault[1].added[1].opts.label == "Keyword", "textbox label should default to the capitalized key")

-- Panel transparency rows bind the reusable 0-100 slider factory.
local flowsAlpha = buildFlows("PanelAlphaRow", { General = { { panel_alpha = "overlay", default = 90, presets = { { label = "Low", value = 25 } } } } }, "General")
check(flowsAlpha[1].added[1].kind == "panel_alpha" and flowsAlpha[1].added[1].opts.key == "overlay", "panel_alpha row must bind CreatePanelAlpha")
check(flowsAlpha[1].added[1].opts.label == "Overlay", "panel_alpha label should default to the capitalized key")
check(flowsAlpha[1].added[1].opts.default == 90 and #flowsAlpha[1].added[1].opts.presets == 1, "panel_alpha default and presets must pass through")
local flowsAlphaString = buildFlows("PanelAlphaRowString", { General = { "panel_alpha overlay 'Panel Opacity'" } }, "General")
check(flowsAlphaString[1].added[1].kind == "panel_alpha" and flowsAlphaString[1].added[1].opts.key == "overlay", "one-line panel_alpha grammar must bind CreatePanelAlpha")
check(flowsAlphaString[1].added[1].opts.default == 100, "one-line panel_alpha must default to 100")

-- Table-form and one-line toggle rows bind the canonical switch widget.
local flowsSwitch = buildFlows("SwitchRow", { General = { { toggle = "enabled", label = "Enable" } } }, "General")
check(#flowsSwitch == 1 and #flowsSwitch[1].added == 1, "toggle row should produce one control")
local sw = flowsSwitch[1].added[1]
check(sw.kind == "switch" and sw.opts.key == "enabled" and sw.opts.label == "Enable", "toggle row must bind CreateSwitch with key and label")
check(type(sw.opts.storage) == "table", "switch row must bind the addon db")
check(sw.opts.default == nil, "omitted toggle default must stay nil for the switch's own true default")
check(type(sw.scripts.OnShow) == "function", "switch row must re-project storage when the panel reopens")
sw.scripts.OnShow()
check(sw.refreshCount == 1, "panel reopen must call the switch Refresh")
local flowsSwitchString = buildFlows("SwitchRowString", { General = { "toggle notify 'Notify'" } }, "General")
check(flowsSwitchString[1].added[1].kind == "switch" and flowsSwitchString[1].added[1].opts.key == "notify", "one-line toggle grammar must also bind CreateSwitch")
check(flowsSwitchString[1].added[1].opts.label == "Notify", "one-line toggle label must survive the switch binding")

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
