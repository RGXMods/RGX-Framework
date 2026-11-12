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
    local RED = { 0.545, 0.082, 0.220 }
    local function hex(c) return string.format("%02x%02x%02x", math.floor(c[1] * 255 + 0.5), math.floor(c[2] * 255 + 0.5), math.floor(c[3] * 255 + 0.5)) end
    for _, id in ipairs({ "forever", "classic", "materialround", "framework" }) do
      local sw
      D:WithTheme({ primary = RED, accent = { 0.74, 0.76, 0.78 } }, function()
        D:WithStyle(id, function()
          sw = UI:CreateSwitch(widget(), { label = "S", storage = { k = true }, key = "k" })
        end)
      end)
      local text = sw.status.text or ""
      check(text:find("|cff" .. hex(RED) .. "ON|r", 1, true) ~= nil, id .. ": the ON text is the addon's primary (" .. text .. ")")
      -- another mod takes over the shared theme: an already built switch keeps its owner's colour
      D:SetTheme({ primary = { 0.1, 0.8, 0.2 } })
      sw:Refresh()
      check((sw.status.text or ""):find("|cff" .. hex(RED) .. "ON|r", 1, true) ~= nil, id .. ": a later theme from another mod does not recolour a built switch")
      D:SetTheme({ primary = { 0, 0.902, 1 }, accent = { 0.737, 0.435, 0.659 } })
      local off
      D:WithTheme({ primary = RED }, function() D:WithStyle(id, function()
        off = UI:CreateSwitch(widget(), { label = "S", storage = { k = false }, key = "k" })
      end) end)
      check((off.status.text or ""):find("OFF|r", 1, true) ~= nil and not (off.status.text or ""):find("ff0000", 1, true), id .. ": OFF uses the style's muted text, not a fixed red")
      -- the header switch and tick boxes build in the style too
      local card, tick
      D:WithTheme({ primary = RED }, function() D:WithStyle(id, function()
        card = UI:CreateCard(widget(), { title = "C", switch = { storage = { on = true }, key = "on", default = true } })
        tick = UI:CreateCheckbox(widget(), "T", { storage = {}, key = "t", default = true })
      end) end)
      check(card.moduleSwitch ~= nil and tick.checkbox ~= nil, id .. ": header switch and tick box build")
    end
    check(D:GetStyleId() == "framework", "the global style is untouched")
    __failures = table.concat(failures, "\\n - ")
  `);
  if (lua.ctx.__failures) {
    console.error("style-brand-check FAILED:\n - " + lua.ctx.__failures);
    process.exit(1);
  }
  console.log("STYLE BRAND OK  forever, classic, material round and framework: switches carry the addon primary");
} finally {
  lua.global.close();
}
