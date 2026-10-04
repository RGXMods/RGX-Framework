#!/usr/bin/env node
// Real database + profiles-panel factories against widget mocks (no client
// rendering). Asserts CRUD wiring, duplicate/protected handling, deep-copy
// independence, and callback isolation through UI:CreateProfilesPanel.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const lua = await Lua.create();
lua.ctx.__database = readFileSync(join(ROOT, "core/systems/database.lua"), "utf8");
lua.ctx.__controls = readFileSync(join(ROOT, "modules/ui/controls.lua"), "utf8");
lua.ctx.__profiles = readFileSync(join(ROOT, "modules/ui/profiles.lua"), "utf8");
try {
  lua.doStringSync(`
    local function widget(kind, parent)
      local w = { kind = kind, parent = parent, scripts = {}, enabled = true }
      function w:SetScript(key, fn) self.scripts[key] = fn end
      function w:HookScript(key, fn)
        local previous = self.scripts[key]
        self.scripts[key] = function(...) if previous then previous(...) end fn(...) end
      end
      function w:SetText(text) self.text = text end
      function w:GetText() return self.text end
      function w:SetWidth(width) self.width = width end
      function w:SetHeight(height) self.height = height end
      function w:SetSize(width, height) self.width, self.height = width, height end
      function w:Enable() self.enabled = true end
      function w:Disable() self.enabled = false end
      function w:IsEnabled() return self.enabled end
      function w:Click()
        if self.enabled and self.scripts.OnClick then self.scripts.OnClick(self, "LeftButton") end
      end
      function w:CreateFontString() return widget("FontString", self) end
      function w:CreateTexture() return widget("Texture", self) end
      function w:SetPoint(point, relative, relativePoint, x, y)
        self.points = { point, relative, relativePoint, x, y }
      end
      for _, key in ipairs({ "ClearAllPoints", "SetAllPoints", "SetAutoFocus",
        "SetMaxLetters", "ClearFocus", "SetBackdrop", "SetBackdropBorderColor",
        "SetColorTexture", "SetTextColor", "SetFontObject", "SetJustifyH",
        "SetJustifyV", "SetWordWrap" }) do w[key] = function() end end
      return w
    end
    function CreateFrame(kind, _, parent) return widget(kind, parent) end
    function UnitName() return "Tester" end
    function GetRealmName() return "Realm" end
    local modules = {}
    RGXFramework = { errors = 0 }
    function RGXFramework:Print() end
    function RGXFramework:Debug() end
    function RGXFramework:Error() self.errors = self.errors + 1 end
    function RGXFramework:RegisterModule(name, module) modules[name] = module end
    function RGXFramework:GetModule(name) return modules[name] end
    function RGXFramework:GetDesign()
      return {
        Unpack = function() return 1, 1, 1 end,
        ApplyBackdrop = function() end,
        CreateSectionHeader = function(_, parent) return widget("Frame", parent) end,
      }
    end
    function RGXFramework:DeepCopy(value)
      local function copy(v, seen)
        if type(v) ~= "table" then return v end
        seen = seen or {}
        if seen[v] then return seen[v] end
        local out = {}
        seen[v] = out
        for k, x in pairs(v) do out[copy(k, seen)] = copy(x, seen) end
        return out
      end
      return copy(value)
    end
    assert(loadstring(__database))("RGX-Framework", RGXFramework)
    assert(loadstring(__controls))("RGX-Framework", {})
    local UI = modules.ui
    -- Card shell is covered by layout-card-check; here the panel wiring is
    -- under test, so the shell is a documented seam.
    function UI:CreateCard(parent)
      local card = widget("Frame", parent)
      card.headerBand = {}
      card.content = widget("Frame", card)
      return card
    end
    modules.dropdowns = { CreateNestedDropdown = function(_, parent, opts)
      local picker = widget("Frame", parent)
      picker.opts = opts
      function picker:Refresh(value) self.value = value end
      return picker
    end }
    assert(loadstring(__profiles))("RGX-Framework", UI)
    local db = RGXFramework:NewDatabase("ProfileUITestDB",
      { enabled = true, nested = { amount = 10 } }, { profileIsGlobal = true })
    local view = db.global
    local card = UI:CreateProfilesPanel(widget("Frame"), { db = db,
      title = "Profiles", icon = "icon", description = "desc",
      onChange = function() error("expected observer failure") end })
    assert(card.input and card.dropdown and card.status, "panel must expose input, dropdown, status")
    assert(card.intro and card.intro.points and card.intro.points[4] == 16,
      "intro must clear the card border")
    assert(card.buttons.create and card.buttons.copy and card.buttons.rename
      and card.buttons.reset and card.buttons.delete, "panel must expose all five actions")
    assert(card.buttons.delete:IsEnabled() == false
      and card.buttons.rename:IsEnabled() == false, "Default profile is not protected")
    card.input:SetText("Raid"); card.buttons.create:Click()
    assert(db:GetActiveProfile() == "Raid" and card.dropdown.value == "Raid",
      "create did not switch to the new profile")
    view.enabled = false; view.nested.amount = 42
    card.input:SetText("Quiet"); card.buttons.copy:Click()
    assert(db:GetActiveProfile() == "Quiet" and view.enabled == false
      and view.nested.amount == 42, "copy lost settings or shared nested data")
    view.nested.amount = 9
    db:LoadProfile("Raid")
    assert(view.nested.amount == 42, "copy aliased nested data")
    card:Refresh(); card.input:SetText("Raid"); card.buttons.create:Click()
    assert(view.enabled == false
      and card.status:GetText() == "That profile already exists.", "duplicate overwrote data")
    card.input:SetText(""); card.buttons.create:Click()
    assert(card.status:GetText() == "Enter a profile name.", "empty name accepted")
    card.input:SetText("Renamed"); card.buttons.rename:Click()
    assert(db:GetActiveProfile() == "Renamed" and view.enabled == false, "rename failed")
    card.buttons.reset:Click()
    assert(view.enabled == true and view.nested.amount == 10, "reset missed defaults")
    card.buttons.delete:Click()
    assert(db:GetActiveProfile() ~= "Renamed", "delete did not leave the profile")
    card.dropdown.opts.onChange("Default")
    assert(db:GetActiveProfile() == "Default", "dropdown did not switch profiles")
    assert(card.buttons.delete:IsEnabled() == false
      and card.buttons.rename:IsEnabled() == false, "returned Default is not protected")
    assert(RGXFramework.errors > 0, "observer failures were not isolated")
  `);
  console.log("PROFILES UI OK real factories/DB CRUD, duplicate/protected names, deep copy, live settings view, callback isolation");
} finally {
  lua.global.close();
}
