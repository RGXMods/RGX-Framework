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
      if k == "CreateTexture" or k == "CreateFontString" or k == "CreateLine" or k == "CreateMaskTexture" then
        return function(self)
          local w = widget(self)
          local regs = rawget(self, "__regions") or {}
          rawset(self, "__regions", regs)
          regs[#regs + 1] = w
          return w
        end
      end
      if k == "CreateAnimationGroup" then return function(self) return widget() end end
      if type(k) == "string" and k:match("^Get%u%l*Texture$") then return function(self) return widget() end end
      if k == "GetFrameLevel" then return function() return 5 end end
      if k == "GetParent" then return function(self) return rawget(self, "parent") end end
      if k == "GetText" then return function(self) return rawget(self, "text") or "" end end
      if k == "SetText" then return function(self, v) rawset(self, "text", v) end end
      if k == "GetRegions" then return function(self) return unpack(rawget(self, "__regions") or {}) end end
      if k == "GetChildren" then return function(self) return unpack(rawget(self, "__children") or {}) end end
      if k == "SetParent" then return function(self, p)
        local old = rawget(self, "parent")
        if old then
          local kids = rawget(old, "__children") or {}
          for i = #kids, 1, -1 do if kids[i] == self then table.remove(kids, i) end end
        end
        rawset(self, "parent", p)
        if p then local kids = rawget(p, "__children") or {}; rawset(p, "__children", kids); kids[#kids + 1] = self end
      end end
      if k == "SetBackdrop" then return function(self, info) rawset(self, "backdropInfo", info) end end
      if k == "GetAlpha" then return function(self) return rawget(self, "alpha") or 1 end end
      if k == "SetAlpha" then return function(self, a) rawset(self, "alpha", a) end end
      if k == "GetNumPoints" then return function() return 0 end end
      if k == "GetLeft" or k == "GetTop" or k == "GetRight" or k == "GetBottom" then return function() return 0 end end
      if type(k) == "string" and k:match("^%u") then return noop end
      return nil
    end
    widget = function(parent) return setmetatable({ parent = parent }, mt) end
    CREATED = {}
    function CreateFrame(kind, name, parent, template)
      local w = widget(parent) rawset(w, "template", template) CREATED[#CREATED + 1] = w
      if parent then local kids = rawget(parent, "__children") or {}; rawset(parent, "__children", kids); kids[#kids + 1] = w end
      return w
    end
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
    -- Before any style is applied the framework is in its default style, RGX Framework, which is square.
    check(D.cornerStyle == "square", "the default corner treatment is RGX Framework's square (" .. tostring(D.cornerStyle) .. ")")
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
      forever       = { card = "client",   button = "blizzard", shaped = false, frameArt = "forever" },   -- layered: tinted tooltip border on a flat fill
    }
    for _, id in ipairs(D.STYLE_ORDER) do
      local e = EXPECT[id]
      check(e ~= nil, id .. " is in the matrix")
      if e then
        -- The options page chrome (outer box, page header, tab content) follows the style: shaped like the
        -- cards wherever the style shapes its header bands, the flat square backdrop in the framework style.
        local before = #CREATED
        local okp, perr = pcall(function()
          build(id, function() return UI:CreateOptionsPanel({ addonName = "T", title = "T", tabs = { { text = "A", content = function() end } } }) end)
        end)
        check(okp, id .. " options panel builds (" .. tostring(perr) .. ")")
        local shapedChrome = 0
        for i = before + 1, #CREATED do if rawget(CREATED[i], "_rgxShapedChrome") then shapedChrome = shapedChrome + 1 end end
        local wantShaped = id ~= "framework"
        check((shapedChrome >= 3) == wantShaped, id .. " options container, header and content are " .. (wantShaped and "shaped like the cards" or "the flat square backdrop") .. " (" .. shapedChrome .. " shaped)")
        -- UI:SkinTab gives an addon's own tab button the style's tab look; PaintTab colours it by state.
        local tabBtn = build(id, function() local b = CreateFrame("Button", nil, host); b.text = b:CreateFontString(); return UI:SkinTab(b) end)
        check(tabBtn and tabBtn.bg and tabBtn.border, id .. " SkinTab gives the button colour targets")
        check((tabBtn.shape ~= nil) == e.shaped, id .. " SkinTab is " .. (e.shaped and "a rounded chip" or "not a chip") .. " (shape=" .. tostring(tabBtn.shape ~= nil) .. ")")
        local okPaint = pcall(function() build(id, function() UI:PaintTab(tabBtn, "active") UI:PaintTab(tabBtn, "hover", { 1, 0, 0 }) UI:PaintTab(tabBtn, "idle") end) end)
        check(okPaint, id .. " PaintTab paints every state")
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
        -- client-art styles: the card title sits over the client's divider line, and the reset button is the client's icon
        local hdr = build(id, function() return D:CreateSectionHeader(host, "T") end)
        if id == "forever" then
          check(rawget(hdr, "layeredBar") == true and rawget(hdr, "divider") == nil, "forever card header is a flat band in the header layer")
        else
          check((rawget(hdr, "divider") ~= nil) == (e.button == "blizzard"), id .. " card header " .. (e.button == "blizzard" and "is a title over the client divider" or "is a band"))
        end
        local reset = build(id, function() return UI:CreateResetButton(host, function() end) end)
        check((rawget(reset, "clientArt") == true) == (e.button == "blizzard"), id .. " reset button " .. (e.button == "blizzard" and "is the client's reset icon" or "is a chip"))
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
          if trig then check((rawget(trig, "clientArt") == true) == (e.button == "blizzard"), id .. " dropdown trigger " .. (e.button == "blizzard" and "uses the client's input frame and arrow" or "draws its own box")) end
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
    for _, n in ipairs({ "Dialog", "InsetFrameTemplate", "TooltipDefaultLayout", "ButtonFrameTemplateNoPortrait" }) do NineSliceLayouts[n] = { __name = n, TopLeftCorner = { atlas = n .. "-corner" } } have[n .. "-corner"] = true end
    C_Texture = { GetAtlasInfo = function(a) return have[a] and { width = 8 } or nil end }
    local function drawn(style, make) applied = {}; local f = build(style, make); return f, applied[1] end
    local cardF, cardLayout = drawn("forever", function() return UI:CreateCard(host, { title = "T" }) end)
    -- WoW Forever is layered: a card is a flat panel in the brand's panel layer with a tinted tooltip border, no
    -- tiled client background; the metal window frame stays.
    check(cardLayout == nil and cardF._blizzardFrame ~= nil and rawget(cardF._blizzardFrame, "template") == "BackdropTemplate", "forever card draws the tooltip border (" .. tostring(cardLayout) .. ")")
    check(rawget(cardF, "_clientBackground") == nil, "a forever card is a flat panel: no tiled background art")
    local cardC, cardLayoutC = drawn("classic", function() return UI:CreateCard(host, { title = "T" }) end)
    check(cardLayoutC == "InsetFrameTemplate" and cardC._blizzardFrame ~= nil, "classic card is the client's inset frame inside the gold dialog window (" .. tostring(cardLayoutC) .. ")")
    local winC, winLayoutC = drawn("classic", function() return D:CreateFrame(host, { width = 100, height = 50 }) end)
    check(winLayoutC == nil and winC._blizzardFrame ~= nil, "classic window uses the client's gold-edged dialog border file")
    local winF, winLayout = drawn("forever", function() return D:CreateFrame(host, { width = 100, height = 50 }) end)
    check(winLayout == "ButtonFrameTemplateNoPortrait" and winF._blizzardFrame ~= nil, "forever window uses the client's metal window frame (" .. tostring(winLayout) .. ")")
    have["ButtonFrameTemplateNoPortrait-corner"] = nil
    local winF2, winLayout2 = drawn("forever", function() return D:CreateFrame(host, { width = 100, height = 50 }) end)
    check(winLayout2 == "Dialog" and winF2._blizzardFrame ~= nil, "without the metal frame, a forever window falls back to the dialog frame (" .. tostring(winLayout2) .. ")")
    have["InsetFrameTemplate-corner"] = nil
    local cardC2, cardLayoutC2 = drawn("classic", function() return UI:CreateCard(host, { title = "T" }) end)
    check(cardLayoutC2 == nil and cardC2._blizzardFrame ~= nil and rawget(cardC2._blizzardFrame, "template") == "BackdropTemplate", "without the inset frame, a classic card falls back to the tooltip border (" .. tostring(cardLayoutC2) .. ")")
    have["InsetFrameTemplate-corner"] = true
    local plainF, plainLayout = drawn("framework", function() return UI:CreateCard(host, { title = "T" }) end)
    check(plainLayout == nil and plainF._blizzardFrame == nil, "the framework style never uses the Blizzard layouts")
    local mrF, mrLayout = drawn("materialround", function() return UI:CreateCard(host, { title = "T" }) end)
    check(mrLayout == nil, "material round never uses the Blizzard layouts")
    have["InsetFrameTemplate-corner"] = nil
    local fbC, fbCLayout = drawn("forever", function() return UI:CreateCard(host, { title = "T" }) end)
    check(fbCLayout == nil and fbC._blizzardFrame ~= nil, "a forever card needs no client atlas: it keeps the tooltip border")
    have["Dialog-corner"] = nil
    have["ButtonFrameTemplateNoPortrait-corner"] = nil
    local fbF, fbLayout = drawn("forever", function() return D:CreateFrame(host, { width = 100, height = 50 }) end)
    check(fbLayout == nil and fbF._blizzardFrame == nil and rawget(fbF, "_panelBorder") ~= nil, "a missing window atlas falls back to the style's own art")
    NineSliceUtil, NineSliceLayouts, C_Texture = nil, nil, nil
    -- Live theme change: a panel built by an addon brand redraws in the new style and rebuilds its content when
    -- the framework announces a change, without a reload.
    do
      _G.RGXFrameworkDB = { themeOverride = false, style = "forever", themePreset = "gold" }
      local brand = D:RegisterBrand("MatrixAddon", { primary = { 0.5, 0.1, 0.2 }, accent = { 0.7, 0.7, 0.7 } }, "materialround")
      local builds, seenStyle, seenPrimary = 0, nil, nil
      local panel = UI:CreateOptionsPanel({ addonBrand = brand, brand = "|cff8b4b5cRGX|r Mods", addonName = "MatrixAddon", title = function() return brand:Hex() .. "RGX|r" end,
        tabs = { { text = "A", content = function() builds = builds + 1; seenStyle = D:GetStyleId(); seenPrimary = D:GetColor("primary")[1] end } } })
      panel:SelectTab(1)
      check(builds == 1 and seenStyle == "materialround" and seenPrimary == 0.5, "brand panel builds in its own style and colour (" .. tostring(seenStyle) .. ", " .. tostring(seenPrimary) .. ")")
      check(panel.style == "materialround", "panel remembers the brand style")
      _G.RGXFrameworkDB.themeOverride = true
      D:NotifyThemeChanged()
      check(panel.style == "forever", "after the override turns on, the panel takes the chosen style (" .. tostring(panel.style) .. ")")
      check(builds == 2 and seenStyle == "forever" and seenPrimary == D.THEME_PRESETS.gold.primary[1], "the open tab is rebuilt live in the new style and colour (" .. builds .. ", " .. tostring(seenStyle) .. ")")
      check(brand:Hex():lower() == "|cffffd700", "brand hex follows the override (" .. brand:Hex() .. ")")
      _G.RGXFrameworkDB.themeOverride = false
      D:NotifyThemeChanged()
      check(panel.style == "materialround" and builds == 3 and seenPrimary == 0.5, "turning the override off restores the brand live")
      local Drops = _G.RGXDropdowns
      if Drops and Drops.CreateNestedDropdown then
        -- The harness has no client menu widgets: stub the low-level builder, keep the real dispatcher.
        local realLegacy = Drops.CreateNestedDropdown_Legacy
        Drops.CreateNestedDropdown_Legacy = function() local h = widget(host); h.dropdown = widget(h); h.Refresh = function() end; return h end
        local dd = brand:Build(function() return Drops:CreateNestedDropdown(host, { label = "X", items = { { text = "a", value = "a" } } }) end)
        check(dd and rawget(dd, "_rgxBrand") == brand, "a dropdown built in a brand remembers it, so its open menu follows the brand live")
        local plain = Drops:CreateNestedDropdown(host, { label = "Y", items = { { text = "a", value = "a" } } })
        check(plain and rawget(plain, "_rgxBrand") == nil, "a dropdown built outside a brand has none")
        Drops.CreateNestedDropdown_Legacy = realLegacy
      end
      -- A brand registered without a style returns to the default style when the override turns off.
      local plainBrand = D:RegisterBrand("MatrixPlain", { primary = { 0.2, 0.6, 0.4 } }, nil)
      local plainPanel = UI:CreateOptionsPanel({ addonBrand = plainBrand, addonName = "MatrixPlain", tabs = { { text = "A", content = function() end } } })
      plainPanel:SelectTab(1)
      _G.RGXFrameworkDB.themeOverride = true
      D:NotifyThemeChanged()
      check(plainPanel.style == "forever", "styleless brand: the override's style while it is on (" .. tostring(plainPanel.style) .. ")")
      _G.RGXFrameworkDB.themeOverride = false
      D:NotifyThemeChanged()
      check(plainPanel.style == "framework", "styleless brand: back to the default style when the override turns off (" .. tostring(plainPanel.style) .. ")")
      -- Opening records where the time went (#49/#61): category lookup, the open itself, showing, and the tab build.
      do
        local clock = 0
        debugprofilestop = function() clock = clock + 5; return clock end
        local slowBuild = function() clock = clock + 300 end
        local tp = UI:CreateOptionsPanel({ addonName = "MatrixTiming", tabs = { { text = "A", content = slowBuild } } })
        tp:Open()
        local t = tp.openTimings
        check(type(t) == "table" and type(t.category) == "number" and type(t.open) == "number" and type(t.total) == "number",
          "an open records category, open and total times")
        tp:SelectTab(1)
        check(type(tp.tabBuildTimings) == "table" and (tp.tabBuildTimings[1] or 0) >= 300, "a tab build records its time (" .. tostring(tp.tabBuildTimings and tp.tabBuildTimings[1]) .. ")")
        debugprofilestop = nil
      end
      -- A theme change in the same style re-uses the tab buttons instead of making (and leaking) a new set.
      do
        local before = plainPanel.tabs[1]
        D:NotifyThemeChanged()
        check(plainPanel.tabs[1] == before, "a same-style theme change re-uses the tab button")
        check(before:IsShown(), "the re-used tab button is shown again")
        _G.RGXFrameworkDB.themeOverride = true
        D:NotifyThemeChanged()
        local forever = plainPanel.tabs[1]
        check(forever ~= before, "a style change makes the new style's tab button")
        _G.RGXFrameworkDB.themeOverride = false
        D:NotifyThemeChanged()
        check(plainPanel.tabs[1] == before, "switching back re-uses the first style's tab button")
      end
      -- The restyle really swaps the chrome: the old style's pieces are hidden and the new style's are drawn.
      do
        local mark = #CREATED
        local rb = D:RegisterBrand("MatrixChrome", { primary = { 0.5, 0.1, 0.2 } }, "materialround")
        _G.RGXFrameworkDB.themeOverride = false
        local cp = UI:CreateOptionsPanel({ addonBrand = rb, addonName = "MatrixChrome", tabs = { { text = "A", content = function() end } } })
        cp:SelectTab(1)
        local boxes, oldPieces = {}, {}
        for i = mark + 1, #CREATED do
          local f = CREATED[i]
          if rawget(f, "_rgxChromeSet") then boxes[#boxes + 1] = f; for o in pairs(f._rgxChromeSet) do oldPieces[#oldPieces + 1] = o end end
        end
        check(#boxes >= 3 and #oldPieces > 0, "the panel's chrome boxes record what they draw (" .. #boxes .. " boxes, " .. #oldPieces .. " pieces)")
        _G.RGXFrameworkDB.themeOverride = true
        _G.RGXFrameworkDB.style = "framework"
        D:NotifyThemeChanged()
        local allHidden = true
        for _, o in ipairs(oldPieces) do if rawget(o, "hidden") ~= true then allHidden = false end end
        check(allHidden, "the old style's chrome pieces are hidden after the change")
        -- Every box draws the new style: visible new pieces, or the square backdrop (the client builds its
        -- textures from backdropInfo; the harness only records the info).
        local drawn = 0
        for _, f in ipairs(boxes) do
          local visible = false
          for o in pairs(f._rgxChromeSet or {}) do if rawget(o, "hidden") ~= true then visible = true end end
          if visible or rawget(f, "backdropInfo") then drawn = drawn + 1 end
        end
        check(drawn == #boxes, "every chrome box draws the new style (" .. drawn .. "/" .. #boxes .. ")")
        local square = 0
        for _, f in ipairs(boxes) do if rawget(f, "backdropInfo") then square = square + 1 end end
        check(square >= 1, "RGX Framework's chrome is the square backdrop after the change (" .. square .. ")")
        _G.RGXFrameworkDB.themeOverride = false
        D:NotifyThemeChanged()
        local leftover = 0
        for _, f in ipairs(boxes) do if rawget(f, "backdropInfo") then leftover = leftover + 1 end end
        check(leftover == 0, "going back to Material Round takes the square backdrop off again (" .. leftover .. " left)")
        _G.RGXFrameworkDB.style = "forever"
      end
      -- A pooled client menu gets the brand's skin when it opens and is handed back clean when released.
      do
        local Drops = _G.RGXDropdowns
        if Drops and Drops._SkinMenu then
          local menu = CreateFrame("Frame", nil, UIParent)
          local bg = menu:CreateTexture()
          local owner = widget(host); rawset(owner, "_rgxBrand", brand)
          Drops._SkinMenu(menu, owner)
          check(rawget(menu, "_rgxMenuSkin") ~= nil and bg:GetAlpha() == 0, "an opened menu gets the brand skin and the client's background is hidden")
          Drops._UnskinMenu(menu)
          check(rawget(menu, "_rgxMenuSkin") == nil and bg:GetAlpha() == 1, "a released menu is handed back as the client made it")
          _G.RGXFrameworkDB.themeOverride = true
          _G.RGXFrameworkDB.style = "forever"
          Drops._SkinMenu(menu, owner)
          check(rawget(menu, "_rgxMenuSkin") == nil and bg:GetAlpha() == 1, "in WoW Forever the client's own menu is left as it is")
          _G.RGXFrameworkDB.themeOverride = false
        end
      end
      local legacyBuilds = 0
      local legacy = UI:CreateOptionsPanel({ addonName = "Legacy", theme = { primary = { 0.1, 0.2, 0.3 } }, style = "materialround",
        tabs = { { text = "A", content = function() legacyBuilds = legacyBuilds + 1 end } } })
      legacy:SelectTab(1)
      D:NotifyThemeChanged()
      check(legacyBuilds == 1 and legacy.style == "materialround", "a panel with its own theme and no brand is left alone")
      _G.RGXFrameworkDB = nil
    end
    -- Declarative pages: a card without columns parents its controls to the card's content frame (a layout
    -- object as parent fails in the client with "Wrong object type").
    do
      local parents = {}
      local realSwitch, realSlider = UI.CreateSwitch, UI.CreateSlider
      UI.CreateSwitch = function(self, parent, o) parents[#parents + 1] = parent return realSwitch(self, parent, o) end
      UI.CreateSlider = function(self, parent, o) parents[#parents + 1] = parent return realSlider(self, parent, o) end
      local addon = { db = { enabled = true, volume = 50 } }
      local tabs = UI:_BuildAddonOptionTabs(addon, { General = { { page = "Basics", grid = 2, cards = {
        { card = "Core", controls = { { toggle = "enabled", label = "Enable Addon" } } },
        { card = "Audio", columns = 1, controls = { { slider = "volume", label = "Volume", min = 0, max = 100 } } },
      } } } }, 1, function(c) return c end)
      local okBuild, errBuild = pcall(tabs[1].content, CreateFrame("Frame", nil, host))
      UI.CreateSwitch, UI.CreateSlider = realSwitch, realSlider
      check(okBuild, "a declarative page with cards builds (" .. tostring(errBuild) .. ")")
      local allFrames = #parents == 2
      for _, p in ipairs(parents) do if rawget(p, "Apply") or rawget(p, "Add") then allFrames = false end end
      check(allFrames, "every declarative control is parented to a frame, never to a layout (" .. #parents .. " controls)")
    end
    -- Declarative flat lists keep each section heading in the same column as its controls.
    do
      local placed = {}
      local realSwitch, realLabel = UI.CreateSwitch, UI.CreateLabel
      UI.CreateSwitch = function(self, parent, o) placed[#placed + 1] = { "toggle", parent } return realSwitch(self, parent, o) end
      UI.CreateLabel = function(self, parent, o)
        if type(o) == "table" and (o.text == "Behavior" or o.text == "Feedback") then placed[#placed + 1] = { "section", parent } end
        return realLabel(self, parent, o)
      end
      local addon = { db = { enabled = true, showWelcome = true, minimapIconEnabled = true } }
      local tabs = UI:_BuildAddonOptionTabs(addon, { General = {
        { section = "Behavior" }, { toggle = "enabled" }, { section = "Feedback" }, { toggle = "showWelcome" }, { toggle = "minimapIconEnabled" },
      } }, 2, function(c) return c end)
      pcall(tabs[1].content, CreateFrame("Frame", nil, host))
      UI.CreateSwitch, UI.CreateLabel = realSwitch, realLabel
      local okGroups = #placed == 5 and placed[1][2] == placed[2][2] and placed[3][2] == placed[4][2] and placed[4][2] == placed[5][2]
        and placed[1][2] ~= placed[3][2]
      local dbg = {} for i, p in ipairs(placed) do dbg[#dbg + 1] = p[1] .. ":" .. tostring(p[2]):sub(-6) end
      check(okGroups, "each section heading sits in the same column as its own controls (" .. table.concat(dbg, " ") .. ")")
    end
    do
      local page
      local panel = UI:CreateOptionsPanel({ tabs = {
        { text = "Grid", content = function(content)
          page = content
          if type(rawget(content, "SetContentHeight")) == "function" then content:SetContentHeight(640) end
        end },
        { text = "Other", content = function() end },
      } })
      panel:SelectTab(1)
      local supported = page and type(rawget(page, "SetContentHeight")) == "function"
      check(supported, "custom tab builders declare content height through a public helper")
      if supported then
        local canvas = rawget(page, "_rgxCanvas")
        check(rawget(canvas, "h") == 640, "initial framework reflow preserves a custom grid's extent")
        panel:SelectTab(2)
        page.Refresh = function() end
        panel:SelectTab(1)
        check(rawget(canvas, "h") == 640, "tab refresh preserves custom content height")
        for _, bad in ipairs({ -1, math.huge, 0 / 0, "700" }) do
          check(page:SetContentHeight(bad) == false and rawget(canvas, "h") == 640,
            "invalid content height cannot corrupt the current extent")
        end
        check(page:SetContentHeight(0) == true and rawget(canvas, "h") == 1,
          "zero clears a custom extent")
        local row = page:Text("Managed row")
        row:SetHeight(700)
        page:SetContentHeight(300)
        check((rawget(canvas, "h") or 0) >= 700,
          "managed content larger than the declared extent is never clipped")
      end
    end
    check(#errors == 0, "no framework errors while building (" .. tostring(errors[1]) .. ")")
    __failures = table.concat(failures, "\\n - ")
  `);
  if (lua.ctx.__failures) {
    console.error("style-matrix-check FAILED:\n - " + lua.ctx.__failures);
    process.exit(1);
  }
  console.log("STYLE MATRIX OK  framework, material round, classic and forever each build their options page chrome, card, button, tick box, switch and dropdown trigger in their own skin");
} finally {
  lua.global.close();
}
