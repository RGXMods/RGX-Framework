#!/usr/bin/env node
// Panel style: runs the real libraries/ui/options.lua. opts.style builds a panel and its lazily built tab content in
// that interface style without changing the global choice; a panel created inside WithStyle keeps the style for its tabs.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = (p) => readFileSync(join(ROOT, p), "utf8");
const lua = await Lua.create();
lua.ctx.design = src("libraries/design/design.lua");
lua.ctx.controls = src("libraries/ui/controls.lua");
lua.ctx.layout = src("libraries/ui/layout.lua");
lua.ctx.options = src("libraries/ui/options.lua");
try {
  lua.doStringSync(String.raw`

    local errors = {}
    local function noop() end
    local widget
    local mt = {}
    mt.__index = function(t, k)
      if k == "GetWidth" then return function(self) return rawget(self, "w") or 400 end end
      if k == "GetHeight" then return function(self) return rawget(self, "h") or 20 end end
      if k == "SetWidth" then return function(self, v) rawset(self, "w", v) end end
      if k == "SetHeight" then return function(self, v) rawset(self, "h", v) end end
      if k == "SetSize" then return function(self, w, h) rawset(self, "w", w) rawset(self, "h", h) end end
      if k == "SetScript" then return function(self, n, f) local sc = rawget(self, "scripts") or {} rawset(self, "scripts", sc) sc[n] = f end end
      if k == "HookScript" then return function(self, n, f) local sc = rawget(self, "scripts") or {} rawset(self, "scripts", sc) local p = sc[n] sc[n] = function(...) if p then p(...) end f(...) end end end
      if k == "GetScript" then return function(self, n) local sc = rawget(self, "scripts") return sc and sc[n] end end
      if k == "Hide" then return function(self) rawset(self, "hidden", true) end end
      if k == "Show" then return function(self) rawset(self, "hidden", false) end end
      if k == "IsShown" or k == "IsVisible" then return function(self) return rawget(self, "hidden") ~= true end end
      if k == "GetFont" then return function() return "f", 12, "" end end
      if k == "GetStringWidth" then return function() return 80 end end
      if k == "GetStringHeight" then return function() return 12 end end
      if k == "CreateTexture" or k == "CreateFontString" or k == "CreateAnimationGroup" or k == "CreateLine" or k == "CreateMaskTexture" then return function(self) return widget() end end
      if type(k) == "string" and k:match("^Get%u%l*Texture$") then return function(self) return widget() end end
      if k == "GetParent" then return function(self) return rawget(self, "parent") end end
      if k == "GetText" then return function(self) return rawget(self, "text") or "" end end
      if k == "SetText" then return function(self, v) rawset(self, "text", v) end end
      if k == "GetChildren" or k == "GetRegions" then return function() end end
      if k == "GetNumPoints" then return function() return 0 end end
      if k == "GetLeft" or k == "GetTop" or k == "GetRight" or k == "GetBottom" then return function() return 0 end end
      if type(k) == "string" and k:match("^%u") then return noop end
      return nil
    end
    widget = function(parent) return setmetatable({ parent = parent }, mt) end
    function CreateFrame(kind, name, parent) return widget(parent) end
    UIParent = widget(); GameTooltip = widget(); Settings = nil
    function InCombatLockdown() return false end
    function hooksecurefunc() end
    function strtrim(s) return (tostring(s or ""):gsub("^%s+", ""):gsub("%s+$", "")) end
    function wipe(t) for k in pairs(t) do t[k] = nil end return t end
    tinsert = table.insert; tremove = table.remove; format = string.format; strfind = string.find; strsub = string.sub; strlen = string.len; strlower = string.lower; strupper = string.upper; strmatch = string.match; gsub = string.gsub; max = math.max; min = math.min; floor = math.floor; ceil = math.ceil; abs = math.abs
    function strsplit(d, s) local out = {} for p in (s .. d):gmatch('(.-)' .. d:gsub('%p','%%%0')) do out[#out+1] = p end return unpack(out) end
    function GetTime() return 0 end
    function CopyTable(t) local c = {} for k, v in pairs(t) do c[k] = v end return c end
    function Mixin(o, ...) for _, m in ipairs({...}) do for k, v in pairs(m) do o[k] = v end end return o end
    function issecurevalue() return false end
    function GetCursorPosition() return 0, 0 end
    function IsShiftKeyDown() return false end
    function GetLocale() return "enUS" end
    C_Timer = { After = function(_, f) f() end }
    local modules = {}
    RGXFramework = { errors = 0 }
    function RGXFramework:RegisterModule(name, m) modules[name] = m end
    function RGXFramework:GetModule(name) return modules[name] end
    function RGXFramework:GetDesign() return modules.design end
    function RGXFramework:GetUI() return modules.ui end
    function RGXFramework:Error(...) errors[#errors + 1] = table.concat({ tostring((...)) }, " ") end
    function RGXFramework:Debug() end
    function RGXFramework:RegisterEvent() end
    function RGXFramework:UnregisterEvent() end
    function RGXFramework:After(_, f) f() end
    function RGXFramework:DismissColorPicker() end
    function RGXFramework:GetDropdowns() return nil end
    function RGXFramework:Print(...) end
    local RGX = RGXFramework
    assert(loadstring(design))('RGX-Framework', RGX)
    assert(loadstring(controls))('RGX-Framework', RGX)
    assert(loadstring(layout))('RGX-Framework', _G.RGXUI)
    assert(loadstring(options))('RGX-Framework', RGX)
    assert(_G.RGXUI.CreateStandardCard, "options.lua did not inject CreateStandardCard")

    local UI = _G.RGXUI
    local D = _G.RGXDesign
    local failures = {}
    local function check(ok, msg) if not ok then failures[#failures + 1] = msg end end
    local function build(opts)
      local seen = {}
      opts.addonName = opts.addonName or "T"
      opts.tabs = { { text = "Page", content = function(frame) seen.content = D:GetStyleId() end } }
      local panel = opts.__make and opts.__make(opts) or UI:CreateOptionsPanel(opts)
      panel:SelectTab(1)
      return panel, seen
    end
    check(D:GetStyleId() == "framework", "the global style starts as framework (" .. tostring(D:GetStyleId()) .. ")")

    -- opts.style builds the panel and its lazily built tab in that style, then restores the global choice.
    local _, a = build({ style = "materialround" })
    check(a.content == "materialround", "opts.style: tab content is built in materialround (" .. tostring(a.content) .. ")")
    check(D:GetStyleId() == "framework", "opts.style leaves the global style alone (" .. tostring(D:GetStyleId()) .. ")")

    -- A panel created inside WithStyle keeps that style for tab content built after the scope has ended.
    local _, b = build({ __make = function(o) local p; D:WithStyle("materialround", function() p = UI:CreateOptionsPanel(o) end); return p end })
    check(b.content == "materialround", "built inside WithStyle: later tab content keeps materialround (" .. tostring(b.content) .. ")")
    check(D:GetStyleId() == "framework", "the global style is restored afterwards (" .. tostring(D:GetStyleId()) .. ")")

    -- Default: the style active at creation.
    local _, c = build({})
    check(c.content == "framework", "default: content is built in the current style (" .. tostring(c.content) .. ")")

    -- Every listed style builds a full options panel with the standard controls, so every framework addon works in all of them.
    for _, id in ipairs(D.STYLE_ORDER) do
      local made = {}
      local okAll, err = pcall(function()
        local p = UI:CreateOptionsPanel({
          addonName = "T", style = id, theme = { primary = { 0.2, 0.6, 0.9 }, accent = { 0.9, 0.7, 0.2 } },
          tabs = { { text = "Page", content = function(frame)
            local store = {}
            made.sw = UI:CreateSwitch(frame, { label = "S", storage = store, key = "a", default = true })
            made.sl = UI:CreateSlider(frame, { label = "L", storage = store, key = "b", min = 0, max = 10, default = 3 })
            made.ti = UI:CreateTextInput(frame, { label = "T", storage = store, key = "c", default = "x" })
            made.cb = UI.CreateCheckbox and UI:CreateCheckbox(frame, { label = "C", storage = store, key = "d", default = false })
            made.style = D:GetStyleId()
          end } },
        })
        p:SelectTab(1)
      end)
      check(okAll, id .. ": options panel and standard controls build (" .. tostring(err) .. ")")
      check(made.style == id and made.sw and made.sl and made.ti, id .. ": controls were built in the style")
    end
    check(D:GetStyleId() == "framework", "global style untouched after the all-styles loop")

    -- An unknown style is ignored, not an error.
    local ok = pcall(build, { style = "no-such-style" })
    check(ok, "an unknown opts.style does not raise")
    check(#errors == 0, "no framework errors: " .. table.concat(errors, "; "))
    __failures = table.concat(failures, "\\n - ")
  `);
  if (lua.ctx.__failures) {
    console.error("panel-style-check FAILED:\n - " + lua.ctx.__failures);
    process.exit(1);
  }
  console.log("PANEL STYLE OK  opts.style and WithStyle scopes carry into lazily built tabs; the global style is restored");
} finally {
  lua.global.close();
}
