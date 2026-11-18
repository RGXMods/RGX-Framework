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
    local captured = {}
    local function build(loadedSet, useCAddOns, design, db)
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
      function UI:CreateSwitch(_, opts) captured.switch = opts return widget() end
      function UI:CreateButtonGroup() return { buttons = { widget(), widget() }, SetPoint = function() end } end
      function UI:CreateOptionsPanel(opts) panelOpts = opts return widget() end
      local Design = design or { THEME_PRESETS = { cyan = {} }, STYLES = {}, STYLE_ORDER = {}, GetThemePreset = function() return "cyan" end }
      _G.RGXDropdowns = { CreateNestedDropdown = function(_, _, opts) captured[opts.label] = opts return widget() end }
      local events = {}
      local RGX = {
        GetUI = function() return UI end, GetDesign = function() return Design end,
        RegisterEvent = function(_, e, fn) events[e] = fn end,
        IsLoginMessagesEnabled = function() return true end,
        GetLoadedModules = function() return {} end, db = db or {}, Print = function() end,
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

    -- The Theme card's controls: saved always, applied live only while the beta override is on.
    do
      local applied = {}
      local D = { THEME_PRESETS = { cyan = {}, gold = {} }, STYLES = { framework = { label = "F" }, forever = { label = "W" } },
        STYLE_ORDER = { "framework", "forever" },
        ResolveStyle = function(_, n) return ({ framework = "framework", forever = "forever" })[n] end,
        SetStyle = function(_, n) applied.style = n return true end,
        SetThemePreset = function(_, n) applied.preset = n return true end,
        GetThemePreset = function() return nil end, GetStyleId = function() return "framework" end }
      local db = { themeOverride = false, style = "forever", themePreset = "gold" }
      build({ BLU = true }, true, D, db)
      local colour, style = captured["Main color"], captured["Interface style"]
      check(colour and colour.value == "gold", "the colour dropdown shows the saved colour (" .. tostring(colour and colour.value) .. ")")
      check(style and style.value == "forever", "the style dropdown shows the saved style (" .. tostring(style and style.value) .. ")")
      colour.onChange("cyan"); style.onChange("framework")
      check(db.themePreset == "cyan" and db.style == "framework", "choices are saved with the override off")
      check(applied.preset == nil and applied.style == nil, "nothing is applied live with the override off")
      db.themeOverride = true
      captured.switch.onChange(true)
      check(applied.style == "framework" and applied.preset == "cyan", "turning the override on applies the saved choices")
      colour.onChange("gold"); style.onChange("forever")
      check(applied.preset == "gold" and applied.style == "forever", "with the override on, choices apply live")
      captured.switch.onChange(false)
      check(applied.style == "framework" and applied.preset == "cyan", "turning the override off restores the defaults")
    end

    local none = build({}, true)
    check(#none.__tabs == 2 and none.__tabs[1] == "About" and none.__tabs[2] == "Build with RGX", "no theme-following addon: the page has the About and Build with RGX tabs (" .. table.concat(none.__tabs, ",") .. ")")
    check(not has(none, "Change framework addon theme options"), "no theme-following addon loaded: no Theme card")
    check(has(none, "About RGX-Framework"), "the About card is still there without the Theme card")
    local withBlu = build({ BLU = true }, true)
    check(#withBlu.__tabs == 3 and withBlu.__tabs[3] == "Theme", "a theme-following addon adds a Theme tab (" .. table.concat(withBlu.__tabs, ",") .. ")")
    for _, name in ipairs({ "BLU", "BLU_Classic", "BLU_Forever", "SimpleQuestPlates", "SimpleQuestPlates_Classic", "RGXProfessions", "RGXQoL" }) do
      check(has(build({ [name] = true }, true), "Change framework addon theme options"), name .. " loaded: the Theme card shows")
    end
    check(has(build({ BLU = true }, false), "Change framework addon theme options"), "the older IsAddOnLoaded global is honoured")
    check(not has(build({ ["RGX-Hello"] = true }, true), "Change framework addon theme options"), "an RGX addon that does not follow the framework theme (Hello) does not bring the Theme card")
    __failures = table.concat(failures, "\\n - ")
  `);
  if (lua.ctx.__failures) {
    console.error("guide-theme-check FAILED:\n - " + lua.ctx.__failures);
    process.exit(1);
  }
  console.log("GUIDE THEME OK  the Theme card shows when an addon that follows the framework theme is loaded");
} finally {
  lua.global.close();
}
