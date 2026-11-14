#!/usr/bin/env node
// Style matrix: every primitive built under every interface style, asserting which skin path it took (flat
// backdrop, rounded panel, or framed art) so a style can never silently fall back to another style's controls.
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
lua.ctx.dropdowns = src("libraries/dropdowns/dropdowns.lua");
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
      if k == "GetFrameLevel" then return function() return 5 end end
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
    CREATED = {}
    function CreateFrame(kind, name, parent, template) local w = widget(parent) rawset(w, "template", template) CREATED[#CREATED + 1] = w return w end
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
    local okd, derr = pcall(function() assert(loadstring(dropdowns))('RGX-Framework', RGX) end)
    if not okd then errors[#errors + 1] = "dropdowns: " .. tostring(derr) end
    assert(_G.RGXUI.CreateStandardCard, "options.lua did not inject CreateStandardCard")

    local UI = _G.RGXUI
    local failures = {}
    local function check(ok, msg) if not ok then failures[#failures + 1] = msg end end
    local host = widget()
    local D = RGX:GetDesign()
    -- Which skin a built frame carries: "art" (nine-slice panel pieces), "backdrop" (square template) or "plain".
    local function skin(f)
      if f == nil then return "none" end
      if rawget(f, "_blizzardFrame") then return "client" end
      if rawget(f, "_panelBorder") then return "art" end
      if rawget(f, "template") == "BackdropTemplate" then return "backdrop" end
      return "plain"
    end
    local function art(id) return D.styleOptions.frameArt end
    local function build(style, fn) local r; D:WithStyle(style, function() r = fn() end) return r end

    local EXPECT = {
      -- card/button are the skins when the client has no Blizzard layouts (the fallback art); "blizzard" buttons
      -- are the client's dialog button in every client. shaped = the controls are drawn as panels.
      --              card       button       controls shaped
      framework     = { card = "backdrop", button = "backdrop", shaped = false, frameArt = nil },
      materialround = { card = "art",      button = "art",      shaped = true,  frameArt = nil },
      classic       = { card = "client",   button = "blizzard", shaped = false, frameArt = "classic" },
      forever       = { card = "art",      button = "blizzard", shaped = false, frameArt = "forever" },
    }
    for _, id in ipairs(D.STYLE_ORDER) do
      local e = EXPECT[id]
      check(e ~= nil, id .. " is in the matrix")
      if e then
        local card = build(id, function() return UI:CreateCard(host, { title = "T" }) end)
        check(skin(card) == e.card, id .. " card body: " .. skin(card) .. " (want " .. e.card .. ")")
        local btn = build(id, function() return D:CreateButton(host, "B", 80, 22) end)
        local bs = rawget(btn, "_blizzardButton") and "blizzard" or (rawget(btn, "_panelBorder") and "art" or "backdrop")
        check((rawget(btn, "template") == "UIPanelButtonTemplate") == (e.button == "blizzard"), id .. " button " .. (e.button == "blizzard" and "is the client's UIPanelButtonTemplate" or "is not the client template") .. " (" .. tostring(rawget(btn, "template")) .. ")")
        check(bs == e.button, id .. " button: " .. bs .. " (want " .. e.button .. ")")
        local cb = build(id, function() return UI:CreateCheckbox(host, "Tick", {}) end)
        check((rawget(cb.checkbox, "template") == "UICheckButtonTemplate") == (e.button == "blizzard"), id .. " tick box " .. (e.button == "blizzard" and "is the client's UICheckButtonTemplate" or "is not the client template") .. " (" .. tostring(rawget(cb.checkbox, "template")) .. ")")
        check((cb.checkbox.shape ~= nil) == e.shaped, id .. " checkbox is " .. (e.shaped and "a shaped box" or "the native box") .. " (shape=" .. tostring(cb.checkbox.shape ~= nil) .. ")")
        -- the switch and slider draw their track and thumb as panels in a shaped style, as flat textures otherwise
        local function panels(fn) local before = #CREATED; build(id, fn); local n = 0 for i = before + 1, #CREATED do if rawget(CREATED[i], "_panelBorder") then n = n + 1 end end return n end
        local swPanels = panels(function() return UI:CreateSwitch(host, { label = "S", storage = {}, key = "k" }) end)
        check((swPanels >= 2) == e.shaped, id .. " switch track and thumb are " .. (e.shaped and "panels" or "flat textures") .. " (" .. swPanels .. " panels)")
        local slPanels = panels(function() return UI:CreateSlider(host, { label = "S", storage = {}, key = "k", min = 0, max = 10, default = 5 }) end)
        check((slPanels >= 2) == e.shaped, id .. " slider track and thumb are " .. (e.shaped and "panels" or "flat textures") .. " (" .. slPanels .. " panels)")
        local inPanels = panels(function() return UI:CreateTextInput(host, { label = "I", storage = {}, key = "k" }) end)
        check((inPanels >= 1) == e.shaped, id .. " text box is " .. (e.shaped and "a panel" or "the flat box") .. " (" .. inPanels .. " panels)")
        local seenArt = build(id, function() return D.styleOptions.frameArt end)
        check(seenArt == e.frameArt, id .. " frame art id is " .. tostring(e.frameArt) .. " (" .. tostring(seenArt) .. ")")
        -- art styles draw the style's own textures; no style borrows another's
        if e.card == "art" and e.frameArt then
          local tex = build(id, function() local c = UI:CreateCard(host, { title = "T" }) return rawget(c, "_panelBorder") end)
          check(tex ~= nil and #tex == 9, id .. " card draws a nine-slice frame")
        end
        -- the dropdown trigger takes the style's skin, never a fixed navy backdrop
        local DD = _G.RGXDropdowns
        if DD and DD.ApplyRetailTrigger then
          local holder = widget(host)
          holder.dropdown = widget(holder); holder.label = widget(holder)
          holder.GetValueText = function() return "v" end
          holder.Refresh = function() end
          holder.SetEnabled = function() end
          build(id, function() DD:ApplyRetailTrigger(holder, { buttonWidth = 100, label = "L" }) return true end)
          local trig = holder.retailTrigger
          check(trig ~= nil, id .. " dropdown trigger builds")
          if trig then check((trig.shape ~= nil) == e.shaped, id .. " dropdown trigger is " .. (e.shaped and "a shaped box" or "the flat backdrop") .. " (shape=" .. tostring(trig.shape ~= nil) .. ")") end
        end
      end
    end
    -- With the client's own Blizzard layouts present, classic and forever draw their cards and windows with them
    -- (the layout each style names), and fall back to the style's art when an atlas is missing.
    local applied = {}
    NineSliceUtil = { ApplyLayout = function(container, layout) applied[#applied + 1] = layout.__name end }
    NineSliceLayouts = {}
    local have = {}
    for _, n in ipairs({ "Dialog", "InsetFrameTemplate", "TooltipDefaultLayout" }) do NineSliceLayouts[n] = { __name = n, TopLeftCorner = { atlas = n .. "-corner" } } have[n .. "-corner"] = true end
    C_Texture = { GetAtlasInfo = function(a) return have[a] and { width = 8 } or nil end }
    local function drawn(style, make) applied = {}; local f = build(style, make); return f, applied[1] end
    local cardF, cardLayout = drawn("forever", function() return UI:CreateCard(host, { title = "T" }) end)
    check(cardLayout == "InsetFrameTemplate" and cardF._blizzardFrame ~= nil, "forever card uses the client inset frame (" .. tostring(cardLayout) .. ")")
    local cardC, cardLayoutC = drawn("classic", function() return UI:CreateCard(host, { title = "T" }) end)
    check(cardLayoutC == nil and cardC._blizzardFrame ~= nil and rawget(cardC._blizzardFrame, "template") == "BackdropTemplate", "classic card uses the client's classic tooltip border file (" .. tostring(cardLayoutC) .. ")")
    local winC, winLayoutC = drawn("classic", function() return D:CreateFrame(host, { width = 100, height = 50 }) end)
    check(winLayoutC == nil and winC._blizzardFrame ~= nil, "classic window uses the client's gold-edged dialog border file")
    local winF, winLayout = drawn("forever", function() return D:CreateFrame(host, { width = 100, height = 50 }) end)
    check(winLayout == "Dialog" and winF._blizzardFrame ~= nil, "forever window uses the client dialog frame (" .. tostring(winLayout) .. ")")
    local plainF, plainLayout = drawn("framework", function() return UI:CreateCard(host, { title = "T" }) end)
    check(plainLayout == nil and plainF._blizzardFrame == nil, "the framework style never uses the Blizzard layouts")
    local mrF, mrLayout = drawn("materialround", function() return UI:CreateCard(host, { title = "T" }) end)
    check(mrLayout == nil, "material round never uses the Blizzard layouts")
    have["InsetFrameTemplate-corner"] = nil
    local fbF, fbLayout = drawn("forever", function() return UI:CreateCard(host, { title = "T" }) end)
    check(fbLayout == nil and fbF._blizzardFrame == nil and rawget(fbF, "_panelBorder") ~= nil, "a missing atlas falls back to the style's own art")
    NineSliceUtil, NineSliceLayouts, C_Texture = nil, nil, nil
    check(#errors == 0, "no framework errors while building (" .. tostring(errors[1]) .. ")")
    __failures = table.concat(failures, "\\n - ")
  `);
  if (lua.ctx.__failures) {
    console.error("style-matrix-check FAILED:\n - " + lua.ctx.__failures);
    process.exit(1);
  }
  console.log("STYLE MATRIX OK  framework, material round, classic and forever each build their card, button, tick box, switch and dropdown trigger in their own skin");
} finally {
  lua.global.close();
}
