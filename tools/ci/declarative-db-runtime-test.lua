-- Declarative database adoption and control callbacks:
--   * legacyFlat = true reaches RGX:NewDatabase so an addon that already has a flat SavedVariables table keeps
--     its settings (and anything else is rejected before registration);
--   * controls accept onChange(addon, value) with the new value already stored, failures are isolated and
--     reported, and a non-function onChange is rejected at declaration.
local RGX = assert(_G.RGXFramework, "RGX framework did not load")
local checks = 0
local function check(c, m) if not c then error("CHECK FAILED: " .. m, 2) end checks = checks + 1 end
local function contains(h, n) return string.find(tostring(h), tostring(n), 1, true) ~= nil end

local reported = {}
function _G.geterrorhandler() return function(message) reported[#reported + 1] = tostring(message) end end

-- Capture how the declarative front door builds its database.
local dbCalls = {}
function RGX:NewDatabase(name, defaults, opts)
  dbCalls[#dbCalls + 1] = { name = name, defaults = defaults, opts = opts }
  return setmetatable({}, { __index = defaults })
end

-- UI seams: capture the widgets the real compositor asks for.
local panels = {}
local stub = { _BuildAddonOptionTabs = __rgxBuildAddonOptionTabs }
function stub:CreateScrollPage() return { GetWidth = function() return 300 end, SetHeight = function() end, HookScript = function() end } end
function stub:CreateFlowLayout() return { Add = function() end, Apply = function() return 0 end } end
function stub:CreateColumns(_, n) local c = {} for i = 1, n do c[i] = {} end return unpack(c) end
function stub:CreateOptionsPanel(opts) panels[#panels + 1] = opts return { ready = true } end
local made = {}
local function make(kind)
  return function(_, _, opts)
    local w = { kind = kind, opts = opts }
    function w:HookScript() end
    function w:Refresh() end
    made[#made + 1] = w
    return w
  end
end
for method, kind in pairs({ CreateSwitch = "switch", CreateSlider = "slider", CreateTextInput = "textbox",
    CreatePanelAlpha = "panel_alpha", CreateColorPicker = "color", CreateButton = "button", CreateLabel = "label" }) do
  stub[method] = make(kind)
end
function RGX:GetUI() return stub end
function RGX:GetDropdowns() return nil end
function RGX:GetFonts() return nil end

-- legacyFlat ---------------------------------------------------------------------------------------------
local function invalid(name, opts, expected)
  local ok, err = pcall(function() RGXAddon(name, opts) end)
  check(not ok and contains(err, expected), name .. " is rejected: " .. tostring(err))
  check(RGX:GetAddon(name) == nil, name .. " leaves no addon behind")
end
invalid("LegacyString", { db = {}, legacyFlat = "yes" }, "'legacyFlat' must be a boolean")
invalid("LegacyNumber", { db = {}, legacyFlat = 1 }, "'legacyFlat' must be a boolean")

RGXAddon("LegacyYes", { dbName = "LegacyYesDB", db = { enabled = true }, legacyFlat = true })
RGX:FireEvent("ADDON_LOADED", "LegacyYes")
check(#dbCalls == 1 and dbCalls[1].name == "LegacyYesDB", "the database is created under the declared name")
check(dbCalls[1].opts.legacyFlat == true, "legacyFlat = true reaches RGX:NewDatabase")

RGXAddon("LegacyNo", { dbName = "LegacyNoDB", db = { enabled = true } })
RGX:FireEvent("ADDON_LOADED", "LegacyNo")
check(dbCalls[2].opts.legacyFlat ~= true, "without legacyFlat the existing behaviour is unchanged")

-- onChange ---------------------------------------------------------------------------------------------
invalid("OnChangeString", { db = {}, options = { General = { { toggle = "a", onChange = "nope" } } } }, "onChange")
invalid("OnChangeInPage", { db = {}, options = { General = { { page = "P", cards = { { card = "C", controls = {
  { toggle = "a", onChange = 5 } } } } } } } }, "onChange")

local seen = {}
local addon = RGXAddon("ChangeAddon", {
  db = { enabled = true, volume = 5, keyword = "x" },
  options = { General = {
    { toggle = "enabled", label = "On", onChange = function(self, value) seen.toggle = { self.name, value } end },
    { slider = "volume", min = 0, max = 10, onChange = function(self, value) seen.slider = value end },
    { textbox = "keyword", onChange = function(self, value) seen.text = value end },
    { toggle = "plain" },
    { toggle = "broken", onChange = function() error("boom") end },
  } },
})
RGX:FireEvent("ADDON_LOADED", "ChangeAddon")
check(#panels == 1, "the panel is built")
panels[1].tabs[1].content({})
local byKey = {}
for _, w in ipairs(made) do if w.opts and w.opts.key then byKey[w.opts.key] = w end end

check(type(byKey.enabled.opts.onChange) == "function", "a toggle passes its callback to the switch")
byKey.enabled.opts.onChange(false)
check(seen.toggle and seen.toggle[1] == "ChangeAddon" and seen.toggle[2] == false, "the callback runs as onChange(addon, value)")
byKey.volume.opts.onChange(7)
check(seen.slider == 7, "a slider reports its new value")
byKey.keyword.opts.onChange("abc")
check(seen.text == "abc", "a textbox reports its new text")
check(byKey.plain.opts.onChange == nil, "a control without a callback is built exactly as before")

local ok = pcall(byKey.broken.opts.onChange, true)
check(ok, "a failing callback is isolated, not thrown into the widget")
check(#reported == 1 and contains(reported[1], "ChangeAddon") and contains(reported[1], "broken") and contains(reported[1], "boom"),
  "the failure is reported with the addon and control: " .. tostring(reported[1]))

_G.__rgxRuntimeDbTestResult = string.format("LUA RUNTIME OK  declarative db + onChange (%d checks)", checks)
