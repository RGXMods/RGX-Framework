#!/usr/bin/env node
// Layered styles: the WoW Forever look is built from one brand colour. The palette steps through layers of depth
// (frame, panel, header, row, selected row, border, title, text, muted); the style's colours are derived from the
// live primary when a window is built, so the theme override and every addon's own brand keep working live; the
// client's metal frame stays and its rock and marble backgrounds give way to flat fills with a tinted border.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lua = await Lua.create();
lua.ctx.design = readFileSync(join(ROOT, "libraries/design/design.lua"), "utf8");
try {
  lua.doStringSync(String.raw`
    local function noop() end
    local widget
    local mt = {}
    mt.__index = function(t, k)
      if k == "SetColorTexture" then return function(self, r, g, b, a) rawset(self, "color", { r, g, b, a }) end end
      if k == "SetTexture" then return function(self, f) rawset(self, "file", f) end end
      if k == "SetBackdrop" then return function(self, b) rawset(self, "backdrop", b) end end
      if k == "SetBackdropBorderColor" then return function(self, r, g, b, a) rawset(self, "borderColor", { r, g, b, a }) end end
      if k == "CreateTexture" then return function(self) local w = widget(self); local kids = rawget(self, "kids") or {}; rawset(self, "kids", kids); kids[#kids + 1] = w; return w end end
      if k == "GetFrameLevel" then return function() return 1 end end
      if type(k) == "string" and k:match("^%u") then return noop end
      return nil
    end
    widget = function(parent) return setmetatable({ parent = parent }, mt) end
    local made = {}
    function CreateFrame(kind, name, parent) local w = widget(parent); made[#made + 1] = w; return w end
    NineSliceUtil = { ApplyLayout = function() return true end }
    NineSliceLayouts = { ButtonFrameTemplateNoPortrait = { piece = { atlas = "a" } }, InsetFrameTemplate = { piece = { atlas = "a" } } }
    C_Texture = { GetAtlasInfo = function() return {} end }
    UIParent = widget()
    local modules = {}
    RGXFramework = {}
    function RGXFramework:RegisterModule(name, m) modules[name] = m end
    function RGXFramework:GetModule(name) return modules[name] end
    function RGXFramework:GetDesign() return modules.design end
    function RGXFramework:Error() end
    function RGXFramework:Debug() end
    assert(loadstring(design))('RGX-Framework', RGXFramework)
    local D = _G.RGXDesign
    local failures = {}
    local function check(ok, msg) if not ok then failures[#failures + 1] = msg end end
    local function near(a, b, eps) return math.abs(a - b) <= (eps or 0.001) end
    local function same(c, d) return c and d and near(c[1], d[1]) and near(c[2], d[2]) and near(c[3], d[3]) end
    local function lum(c) return 0.2126 * c[1] + 0.7152 * c[2] + 0.0722 * c[3] end
    local function hue(c)
      local mx, mn = math.max(c[1], c[2], c[3]), math.min(c[1], c[2], c[3])
      if mx == mn then return nil end
      local d = mx - mn
      local h
      if mx == c[1] then h = ((c[2] - c[3]) / d) % 6 elseif mx == c[2] then h = (c[3] - c[1]) / d + 2 else h = (c[1] - c[2]) / d + 4 end
      return h * 60
    end
    local RED, BLUE, GREY = { 0.545, 0.082, 0.220 }, { 0.10, 0.35, 0.90 }, { 0.5, 0.5, 0.5 }

    -- The palette: depth steps, hue, neutrality ------------------------------------------------------------------
    local p = D:LayeredPalette(RED)
    for _, key in ipairs({ "frame", "panel", "header", "row", "rowSelected", "border", "title", "text", "muted" }) do
      check(type(p[key]) == "table" and #p[key] >= 3, "palette has " .. key)
    end
    check(lum(p.frame) < lum(p.row) and lum(p.row) < lum(p.panel) and lum(p.panel) < lum(p.header), "depth: frame < row < panel < header")
    check(lum(p.header) < lum(p.rowSelected) and lum(p.rowSelected) < lum(p.border) and lum(p.border) < lum(p.title), "depth: header < selected row < border < title")
    check(lum(p.frame) < 0.04, "the window frame is near black")
    check(lum(p.muted) < lum(p.text) and lum(p.muted) > lum(p.border) * 0.9, "muted text sits between the border and the text")
    for _, key in ipairs({ "panel", "header", "row", "rowSelected", "border" }) do
      check(near(hue(p[key]), hue(RED), 6), key .. " keeps the brand hue (" .. tostring(hue(p[key])) .. ")")
    end
    local g = D:LayeredPalette(GREY)
    for _, key in ipairs({ "frame", "panel", "header", "row", "border", "text" }) do
      check(math.max(g[key][1], g[key][2], g[key][3]) - math.min(g[key][1], g[key][2], g[key][3]) < 0.02, "a grey brand stays neutral (" .. key .. ")")
    end
    check(D:LayeredPalette(nil).panel ~= nil, "no primary falls back to the active one")
    check(select("#", unpack(p.panel)) == 3, "tokens are plain {r, g, b}")

    -- The Forever style derives its colours from the live primary ----------------------------------------------------
    D.Theme.primary = RED
    check(D:SetStyle("forever"), "forever is a style")
    local pr = D:LayeredPalette(RED)
    check(same(D.Colors.background, pr.frame), "background is the frame layer")
    check(same(D.Colors.surface, pr.panel), "surface is the panel layer")
    check(same(D.Colors.headerFill, pr.header), "header fill is the header layer")
    check(same(D.Colors.panelAlt, pr.row), "alternate panel is the row layer")
    check(same(D.Colors.border, pr.border) and same(D.Colors.ring, pr.border), "border and ring are the border layer")
    check(same(D.Colors.text, pr.text) and same(D.Colors.subtext, pr.muted), "text and subtext follow the palette")
    check(D.Colors.success and D.Colors.warning and D.Colors.error, "status colours are kept")
    check(D.styleOptions.titleFrom == "layered", "card titles use the palette title")
    local redSurface = { D.Colors.surface[1], D.Colors.surface[2], D.Colors.surface[3] }
    D.Theme.primary = BLUE
    D:SetStyle("forever")
    check(not same(D.Colors.surface, redSurface) and same(D.Colors.surface, D:LayeredPalette(BLUE).panel), "a new brand colour re-derives the colours")
    D:WithTheme({ primary = RED }, function() D:WithStyle("forever", function() check(same(D.Colors.surface, pr.panel), "a scoped build uses its own brand") end) end)

    -- Other styles are unchanged ------------------------------------------------------------------------------------
    local table0 = D.STYLES.framework.colors.surface
    D:SetStyle("framework")
    check(same(D.Colors.surface, table0), "the framework style keeps its own colours")
    D:SetStyle("classic")
    check(same(D.Colors.surface, D.STYLES.classic.colors.surface), "the classic style keeps its own colours")
    check(D.styleOptions.titleFrom == "client", "classic keeps the client's gold title")

    -- Frames: flat fill and tinted border instead of the rock and marble ------------------------------------------------
    D.Theme.primary = RED
    D:SetStyle("forever")
    local fp = D:LayeredPalette(RED)
    local window = widget()
    check(D:ApplyBlizzardFrame(window, "frame", {}), "the forever window applies")
    check(window._clientBackground == nil, "no rock background on a layered window")
    local fill
    for _, t in ipairs(window.kids or {}) do if t.color then fill = t.color end end
    check(fill and same(fill, fp.frame), "the window fills with the frame layer")
    local card = widget()
    check(D:ApplyBlizzardFrame(card, "card", {}), "the forever card applies")
    check(card._clientBackground == nil, "no marble background on a layered card")
    local cardFill
    for _, t in ipairs(card.kids or {}) do if t.color then cardFill = t.color end end
    check(cardFill and same(cardFill, fp.panel), "the card fills with the panel layer")
    local tinted
    for _, f in ipairs(made) do if f.borderColor and f.backdrop and f.backdrop.edgeFile then tinted = f.borderColor end end
    check(tinted and same(tinted, fp.border), "the card border takes the border layer's tint")

    D:SetStyle("classic")
    local old = widget()
    check(D:ApplyBlizzardFrame(old, "frame", {}), "the classic window still applies")
    check(old._clientBackground ~= nil, "classic keeps the game's tiled background")

    if #failures > 0 then error(table.concat(failures, "\n")) end
    result = "LAYERED OK"
  `);
  console.log(lua.ctx.result);
} catch (error) {
  console.error(`LAYERED FAIL\n${error.message}`);
  process.exitCode = 1;
} finally {
  lua.global.close();
}
