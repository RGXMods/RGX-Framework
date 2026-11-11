#!/usr/bin/env node
// Standard options gate: the real core/systems/utils.lua (RGX:CreateChat) and libraries/ui/options.lua
// (UI:CreateStandardCard) run in a Lua 5.1 VM (wasmoon) against recording mocks. Asserts the shared storage
// keys, defaults, minimap and Addons-menu wiring, and every chat rule: output off, custom prefix, default
// brand, login switches, tag stripping and lazy storage.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const source = (path) => readFileSync(join(ROOT, path), "utf8");
const lua = await Lua.create();
try {
  lua.ctx.__utils = source("core/systems/utils.lua");
  lua.ctx.__options = source("libraries/ui/options.lua");
  lua.doStringSync(`
    local failures = {}
    local function check(ok, message) if not ok then failures[#failures + 1] = message end end

    -- WoW and framework stand-ins ------------------------------------------------------------------
    strtrim = function(s) return (tostring(s or ""):gsub("^%s+", ""):gsub("%s+$", "")) end
    local printed = {}
    print = function(...) local t = {} for i = 1, select("#", ...) do t[#t + 1] = tostring((select(i, ...))) end printed[#printed + 1] = table.concat(t, " ") end
    local RGX = { GetDesign = function() return nil end, RegisterEvent = function() end, UnregisterEvent = function() end }
    local utils = assert(loadstring(__utils, "utils.lua"))
    utils("RGX-Framework", RGX)

    -- 1. RGX:CreateChat -----------------------------------------------------------------------------
    local BRAND = "|cff8B1538RGX|r |cffffffff|||r |cffffffffAQoL|r"
    local db = {}
    local chat = RGX:CreateChat({ storage = db, name = "RGX AQoL", brand = BRAND, tag = "[RGXQoL]" })
    chat:Print("hello")
    check(printed[#printed] == BRAND .. ": hello", "default prefix is the branded title: " .. tostring(printed[#printed]))
    chat:Print("|cff112233[RGXQoL]|r tagged")
    check(printed[#printed] == BRAND .. ": tagged", "a coloured leading tag is dropped: " .. tostring(printed[#printed]))
    chat:Print("[RGXQoL] plain tag")
    check(printed[#printed] == BRAND .. ": plain tag", "a plain leading tag is dropped")
    db.chatPrefix = "Mine"
    chat:Print("custom")
    check(printed[#printed] == "|cff4ecdc4Mine|r: custom", "a typed prefix is used as written: " .. tostring(printed[#printed]))
    db.chatPrefix = "RGX AQoL"
    chat:Print("named")
    check(printed[#printed] == BRAND .. ": named", "a prefix equal to the addon name still uses the brand")
    db.chatPrefix = ""
    local before = #printed
    db.chatOutput = false
    chat:Print("silent"); chat:Login("silent login")
    check(#printed == before, "chatOutput = false silences Print and Login")
    db.chatOutput = nil
    db.loginMessage = false
    chat:Login("no login"); chat:Print("still prints")
    check(#printed == before + 1 and printed[#printed]:find("still prints", 1, true), "loginMessage = false silences only Login")
    db.loginMessage = nil
    chat:Login("welcome")
    check(printed[#printed]:find("welcome", 1, true), "Login prints by default")
    RGXFrameworkDB = { showLoginMessages = false }
    local n = #printed
    chat:Login("blocked by the framework switch")
    check(#printed == n, "the framework-wide login switch silences Login")
    RGXFrameworkDB = nil
    local late
    local lazy = RGX:CreateChat({ storage = function() return late end, name = "X", brand = "X" })
    lazy:Print("before load")
    check(printed[#printed] == "X: before load", "storage may not exist yet (function form, no error)")
    late = { chatOutput = false }
    n = #printed; lazy:Print("after load")
    check(#printed == n, "storage function is read on every call")

    -- 2. UI:CreateStandardCard ----------------------------------------------------------------------
    local created = { switches = {}, inputs = {}, labels = {}, cards = {} }
    local function widget(extra) local w = extra or {} return w end
    _G.RGXUI = {
      CreateCard = function(_, parent, o)
        local card = { content = {}, added = {}, autoHeight = 0, opts = o }
        card.flow = { Add = function(_, w, itemOpts) card.added[#card.added + 1] = w; w.fill = itemOpts and itemOpts.fill end }
        function card:AutoHeight() self.autoHeight = self.autoHeight + 1 return self end
        created.cards[#created.cards + 1] = card
        return card
      end,
      CreateSwitch = function(_, parent, o) local w = widget({ opts = o }) created.switches[#created.switches + 1] = w return w end,
      CreateLabel = function(_, parent, o) local w = widget({ opts = o }) created.labels[#created.labels + 1] = w return w end,
      CreateTextInput = function(_, parent, o) local w = widget({ opts = o }) created.inputs[#created.inputs + 1] = w return w end,
    }
    local options = assert(loadstring(__options, "options.lua"))
    options("RGX-Framework", RGX)
    check(type(_G.RGXUI.CreateStandardCard) == "function", "options.lua publishes UI:CreateStandardCard")

    local function keys(list) local out = {} for _, w in ipairs(list) do out[#out + 1] = w.opts.key end return table.concat(out, ",") end
    local store = {}
    local visible, menu, menuResult = nil, nil, true
    local button = { SetVisible = function(_, v) visible = v end, SetCompartmentVisible = function(_, v) menu = v return menuResult end }
    local changes = {}
    local card = _G.RGXUI:CreateStandardCard({}, { storage = store, minimap = button, defaultPrefix = "RGX AQoL",
        onChange = function(k, v) changes[#changes + 1] = k .. "=" .. tostring(v) end })
    check(keys(created.switches) == "minimapIconEnabled,addonMenu,chatOutput,loginMessage", "switches use the shared keys in order: " .. keys(created.switches))
    check(created.inputs[1].opts.key == "chatPrefix" and created.inputs[1].opts.placeholder == "RGX AQoL", "the prefix box is bound to chatPrefix with the default as placeholder")
    for _, s in ipairs(created.switches) do
      check(s.opts.storage == store and s.opts.default == true, "switch " .. s.opts.key .. " is bound to the addon storage and defaults on")
    end
    local allFill = true
    for _, w in ipairs(card.added) do if w.fill ~= true then allFill = false end end
    check(allFill, "every row fills the card width, so long labels do not run into the ON/OFF text")
    check(#card.added == 6 and card.autoHeight == 1, "all rows join the card flow and the card sizes itself once (" .. #card.added .. " rows)")
    created.switches[1].opts.onChange(false)
    check(visible == false, "the minimap switch hides the button")
    created.switches[2].opts.onChange(false)
    check(menu == false, "the Addons-menu switch removes the entry")
    local n2 = #printed; menuResult = false
    created.switches[2].opts.onChange(true)
    check(#printed == n2 + 1 and printed[#printed]:find("reload", 1, true), "a client that cannot change the menu tells the player to reload")
    created.switches[3].opts.onChange(false)
    check(table.concat(changes, ";") == "minimapIconEnabled=false;addonMenu=false;addonMenu=true;chatOutput=false", "onChange reports each change: " .. table.concat(changes, ";"))

    -- the button may not exist yet (function form), and a pure-chat addon can omit the minimap rows
    created.switches, created.inputs = {}, {}
    local lateButton
    _G.RGXUI:CreateStandardCard({}, { storage = store, minimap = function() return lateButton end })
    local ok = pcall(created.switches[1].opts.onChange, true)
    check(ok, "a minimap function that returns nil is tolerated")
    created.switches, created.inputs = {}, {}
    _G.RGXUI:CreateStandardCard({}, { storage = store, minimap = false })
    check(keys(created.switches) == "chatOutput,loginMessage", "minimap = false omits the minimap rows: " .. keys(created.switches))
    check(not pcall(_G.RGXUI.CreateStandardCard, _G.RGXUI, {}, {}), "storage is required")
    created.switches = {}
    _G.RGXUI:CreateStandardCard({}, { storage = store, minimap = false, labels = { chat = "Chat on" } })
    check(created.switches[1].opts.label == "Chat on", "labels can be overridden for localisation")

    __failures = table.concat(failures, "\\n - ")
  `);
  const failures = lua.ctx.__failures;
  if (failures) {
    console.error("standard-options-check FAILED:\n - " + failures);
    process.exit(1);
  }
  console.log("STANDARD OPTIONS OK  RGX:CreateChat (9 rules) and UI:CreateStandardCard (shared keys, minimap and Addons menu wiring, localisation)");
} finally {
  lua.global.close();
}
