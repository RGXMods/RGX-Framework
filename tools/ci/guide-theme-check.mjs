#!/usr/bin/env node
// Framework settings page: the global Theme card (main colour, interface style, corners) appears only when an
// addon that follows the framework theme is loaded. Runs the real libraries/ui/guide.lua against recording stubs.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lua = await Lua.create();
lua.ctx.guide = readFileSync(join(ROOT, "libraries/ui/guide.lua"), "utf8");
try {
  lua.doStringSync(`
    local failures = {}
    local function check(ok, msg) if not ok then failures[#failures + 1] = msg end end
    local function build(loadedSet, useCAddOns)
      local titles = {}
      local panelOpts
      local function widget() return setmetatable({}, { __index = function() return function() end end }) end
      local UI = {}
      function UI:CreateColumns() return widget(), widget() end
      function UI:CreateCard(_, opts)
        titles[#titles + 1] = opts.title
        local card = { content = widget(), flow = { Add = function() end, AddSpacer = function() end } }
        function card:AutoHeight() end
        function card:ClearAllPoints() end
        function card:SetPoint() end
        return card
      end
      function UI:CreateLabel() return widget() end
      function UI:CreateButtonGroup() return { buttons = { widget(), widget() }, SetPoint = function() end } end
      function UI:CreateOptionsPanel(opts) panelOpts = opts return widget() end
      local Design = { THEME_PRESETS = { cyan = {} }, STYLES = {}, STYLE_ORDER = {}, GetThemePreset = function() return "cyan" end }
      local events = {}
      local RGX = {
        GetUI = function() return UI end, GetDesign = function() return Design end,
        RegisterEvent = function(_, e, fn) events[e] = fn end,
        IsLoginMessagesEnabled = function() return true end,
        GetLoadedModules = function() return {} end, db = {},
      }
      local isLoaded = function(name) return loadedSet[name] == true end
      _G.C_AddOns = useCAddOns and { IsAddOnLoaded = isLoaded } or nil
      _G.IsAddOnLoaded = (not useCAddOns) and isLoaded or nil
      assert(loadstring(guide, "guide.lua"))("RGX-Framework", RGX)
      events.PLAYER_LOGIN()
      -- the settings page is tabbed: build every tab and report the cards and the tab names
      local tabNames = {}
      for _, tab in ipairs(panelOpts.tabs or {}) do
        tabNames[#tabNames + 1] = tab.text
        tab.content(widget())
      end
      titles.__tabs = tabNames
      return titles
    end
    local function has(titles, name) for _, t in ipairs(titles) do if t == name then return true end end return false end

    local none = build({}, true)
    check(#none.__tabs == 2 and none.__tabs[1] == "About" and none.__tabs[2] == "Build with RGX", "no theme-following addon: the page has the About and Build with RGX tabs (" .. table.concat(none.__tabs, ",") .. ")")
    check(not has(none, "Theme"), "no theme-following addon loaded: no Theme card")
    check(has(none, "About RGX-Framework"), "the About card is still there without the Theme card")
    local withBlu = build({ BLU = true }, true)
    check(#withBlu.__tabs == 3 and withBlu.__tabs[3] == "Theme", "a theme-following addon adds a Theme tab (" .. table.concat(withBlu.__tabs, ",") .. ")")
    for _, name in ipairs({ "BLU", "BLU_Classic", "BLU_Forever", "SimpleQuestPlates", "SimpleQuestPlates_Classic" }) do
      check(has(build({ [name] = true }, true), "Theme"), name .. " loaded: the Theme card shows")
    end
    check(has(build({ BLU = true }, false), "Theme"), "the older IsAddOnLoaded global is honoured")
    check(not has(build({ RGXProfessions = true, ["RGX-Hello"] = true }, true), "Theme"), "other RGX addons do not bring the Theme card")
    __failures = table.concat(failures, "\\n - ")
  `);
  if (lua.ctx.__failures) {
    console.error("guide-theme-check FAILED:\n - " + lua.ctx.__failures);
    process.exit(1);
  }
  console.log("GUIDE THEME OK  the Theme card shows only when BLU or SQP is loaded");
} finally {
  lua.global.close();
}
