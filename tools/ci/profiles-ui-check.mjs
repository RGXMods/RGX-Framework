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
      function w:SetTextColor(r, g, b) self.color = { r, g, b } end
      function w:SetWidth(width) self.width = width end
      function w:GetWidth() return self.width end
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
      function w:Show()
        self.shown = true
        if self.scripts.OnShow then self.scripts.OnShow(self) end
      end
      function w:Hide() self.shown = false end
      function w:IsShown() return self.shown == true end
      for _, key in ipairs({ "ClearAllPoints", "SetAllPoints", "SetAutoFocus",
        "SetMaxLetters", "ClearFocus", "SetBackdrop", "SetBackdropBorderColor",
        "SetColorTexture", "SetFontObject", "SetJustifyH", "SetBackdropColor",
        "SetJustifyV", "SetWordWrap", "SetFrameStrata", "SetClampedToScreen",
        "EnableMouse", "SetMovable", "RegisterForDrag", "SetNormalTexture",
        "SetPushedTexture", "SetHighlightTexture", "SetCheckedTexture" }) do w[key] = function() end end
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
    assert(card.dropdown and card.status, "panel must expose dropdown and status")
    assert(card.intro and card.intro.points and card.intro.points[4] == 16,
      "intro must clear the card border")
    assert(card.buttons.create and card.buttons.copy and card.buttons.rename
      and card.buttons.reset and card.buttons.delete, "panel must expose all five actions")
    assert(card.buttons.delete:IsEnabled() == false
      and card.buttons.rename:IsEnabled() == false, "Default profile is not protected")
    -- Create/Rename go through the name dialog: button opens it, OK commits.
    card.buttons.create:Click()
    assert(card.openNameDialog and card._nameDialog,
      "Create did not open the name dialog (status: " .. tostring(card.status:GetText()) .. ")")
    card._nameDialog.input:SetText("Raid")
    card._nameDialog.okButton:Click()
    assert(db:GetActiveProfile() == "Raid" and card.dropdown.value == "Raid",
      "create did not switch to the new profile (active=" .. tostring(db:GetActiveProfile())
        .. ", dropdown=" .. tostring(card.dropdown.value)
        .. ", status=" .. tostring(card.status:GetText()) .. ")")
    -- Empty name and duplicates are rejected at the dialog without changing state.
    card.buttons.create:Click()
    card._nameDialog.input:SetText("")
    card._nameDialog.okButton:Click()
    assert(card.status:GetText() == "Enter a profile name.", "empty name accepted")
    card._nameDialog.input:SetText("Raid")
    card._nameDialog.okButton:Click()
    assert(card.status:GetText() == "That profile already exists."
      and db:GetActiveProfile() == "Raid", "duplicate overwrote data")
    -- Copy: auto-generates its name; settings deep-copied, never aliased.
    view.enabled = false; view.nested.amount = 42
    card.buttons.copy:Click()
    assert(db:GetActiveProfile() == "Copy" and view.enabled == false
      and view.nested.amount == 42, "copy lost settings or shared nested data")
    view.nested.amount = 9
    db:LoadProfile("Raid")
    assert(view.nested.amount == 42, "copy aliased nested data")
    -- Rename goes through the same dialog.
    card.buttons.rename:Click()
    card._nameDialog.input:SetText("Renamed")
    card._nameDialog.okButton:Click()
    assert(db:GetActiveProfile() == "Renamed" and view.enabled == false, "rename failed")
    -- Reset and Delete act directly on the current profile.
    card.buttons.reset:Click()
    assert(view.enabled == true and view.nested.amount == 10, "reset missed defaults")
    card.buttons.delete:Click()
    assert(db:GetActiveProfile() ~= "Renamed", "delete did not leave the profile")
    card.dropdown.opts.onChange("Default")
    assert(db:GetActiveProfile() == "Default", "dropdown did not switch profiles")
    assert(card.buttons.delete:IsEnabled() == false
      and card.buttons.rename:IsEnabled() == false, "returned Default is not protected")
    assert(RGXFramework.errors > 0, "observer failures were not isolated")
    -- Active info: name in the theme primary color with the character key line.
    assert(card.activeInfo and card.activeInfo.character, "active info missing character line")
    assert(card.activeInfo.character:GetText() == "Character: " .. tostring(db:GetCharKey()),
      "character line mismatch")
    card.dropdown.opts.onChange("Renamed")
    assert(card.activeInfo.character:GetText() == "Character: " .. tostring(db:GetCharKey())
      and card.activeInfo.value.color and card.activeInfo.value.color[1] == 1,
      "active info did not refresh with selection")
    assert(card.dropdown.opts.width == 220, "dropdown width drift from reference layout")
    card.dropdown.opts.onChange("Default")
    assert(card.buttons.create:GetWidth() == 84
      and card.buttons.reset:GetWidth() == 84, "action button width drift from reference layout")
    local pdb = RGXFramework:NewDatabase("PresetUITestDB", { enabled = true }, { profileIsGlobal = true })
    local applied = {}
    local pcard = UI:CreateProfilesPanel(widget("Frame"), { db = pdb,
      presets = { { name = "Classic", mode = "icon" }, { name = "Forever", mode = "chip" } },
      onPreset = function(preset, passedDb)
        assert(preset and passedDb == pdb, "preset applier got wrong arguments")
        applied[#applied + 1] = preset.name
      end })
    assert(pcard.presetsCard and #pcard.presetButtons == 2, "presets card or buttons missing")
    pcard.presetButtons[1]:Click()
    pcard.presetButtons[2]:Click()
    assert(applied[1] == "Classic" and applied[2] == "Forever", "preset clicks did not apply in order")
    local errorsBefore = RGXFramework.errors
    local fcard = UI:CreateProfilesPanel(widget("Frame"), { db = pdb,
      presets = { { name = "Boom" } },
      onPreset = function() error("expected preset failure") end })
    fcard.presetButtons[1]:Click()
    assert(RGXFramework.errors > errorsBefore
      and fcard.status:GetText() == "Preset could not be applied.", "preset failure was not isolated")
    local ncard = UI:CreateProfilesPanel(widget("Frame"), { db = pdb })
    assert(ncard.presetsCard == nil and ncard.presetButtons == nil, "presets card built without presets")
  `);
  console.log("PROFILES UI OK real factories/DB CRUD, duplicate/protected names, deep copy, live settings view, callback isolation, preset grid");
} finally {
  lua.global.close();
}
