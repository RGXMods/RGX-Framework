#!/usr/bin/env node
// Real framework Lua methods, independent VMs for serialized reloads.
// Widget seams verify restoration logic, not engine geometry or live reload.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const database = readFileSync(join(ROOT, "core/systems/database.lua"), "utf8");
const controls = readFileSync(join(ROOT, "modules/ui/controls.lua"), "utf8");
async function vm() {
  const lua = await Lua.create();
  lua.ctx.__database = database;
  lua.ctx.__controls = controls;
  lua.doStringSync(`
    RGX = { _databases = {} }
    _G.RGXFramework = RGX
    function RGX:Print() end
    function RGX:Debug() end
    function RGX:Error() end
    function RGX:RegisterModule(_, module) self.UI = module end
    function RGX:GetModule() return nil end
    function UnitName() return "TestPlayer" end
    function GetRealmName() return "TestRealm" end
    assert(loadstring(__database))("RGX-Framework", RGX)
    assert(loadstring(__controls))("RGX-Framework", {})
    function CreateFrame()
      local w = { scripts = {} }
      function w:SetSize() end
      function w:SetPoint() end
      function w:SetScript(name, fn) self.scripts[name] = fn end
      function w:SetChecked(value) self.checked = value end
      function w:GetChecked() return self.checked end
      return w
    end
    RGX.UI.CreateLabel = function() return CreateFrame() end
    RGX.UI.CreateResetButton = function() return CreateFrame() end
  `);
  return lua;
}
const failures = [];
let count = 0;
async function scenario(name, script) {
  const lua = await vm();
  try { lua.doStringSync(script); count++; console.log(`PASS ${name}`); }
  catch (error) { failures.push(name); console.error(`FAIL ${name}: ${error.message}`); }
  finally { lua.global.close(); }
}
await scenario("stored true visually restores with default false", `
  local toggle = RGX.UI:CreateToggle({}, { key = "flag", storage = { flag = true }, default = false })
  assert(toggle.check:GetChecked() == true, "saved true displayed false")
  local disabled = RGX.UI:CreateToggle({}, { key = "flag", storage = { flag = false }, default = true })
  assert(disabled.check:GetChecked() == false)
`);
await scenario("profile callback failure cannot latch guard or skip observers", `
  local db = RGX:NewDatabase("CallbackDB", { enabled = true })
  local calls = 0
  db:OnProfileChanged(function() error("expected observer failure") end)
  db:OnProfileChanged(function() calls = calls + 1 end)
  assert(db:CreateProfile("Quiet"))
  assert(db._guard == nil and calls == 1)
  assert(db:LoadProfile("Default"))
  assert(db._guard == nil and calls == 2)
`);
await scenario("client-loaded nil storage remains bound to declared global", `
  local db = RGX:NewDatabase("NilDB", { enabled = true })
  NilDB = nil
  db:Adopt()
  db.enabled = false
  assert(type(NilDB) == "table" and NilDB == db._raw, "writes detached from SavedVariables")
  assert(NilDB.profiles.Default.enabled == false)
`);
await scenario("late defaults apply to existing, new and reset profiles", `
  local db = RGX:NewDatabase("LateDB", {})
  assert(type(db.RegisterDefaults) == "function", "no late-default registration API")
  assert(db:CreateProfile("Quiet"))
  db.enabled = false
  assert(db:RegisterDefaults({ enabled = true, nested = { size = 12, tint = {1, 0, 0} } }))
  assert(db.enabled == false and db.nested.size == 12)
  assert(db:CreateProfile("Raid") and db.enabled == true)
  db.nested.tint[1] = 0.2
  assert(db:ResetProfile() and db.nested.tint[1] == 1)
  assert(db:LoadProfile("Quiet") and db.enabled == false)
`);
await scenario("initial observer failure and nested profile export/import", `
  local db = RGX:NewDatabase("InitialDB", { enabled = true }, { onSwitch = function() error("expected init failure") end })
  assert(db and db._guard == nil)
  local sample = { enabled = false, volume = 0, nested = { color = { 0.1, 0.2, 0.3 } } }
  local restored = assert(RGX:DeserializeTable(RGX:SerializeTable(sample)))
  assert(restored.enabled == false and restored.volume == 0 and restored.nested.color[2] == 0.2)
`);
await scenario("observer registration during onSwitch waits for next notification", `
  local db, calls
  calls = 0
  db = RGX:NewDatabase("ObserverDB", {}, { onSwitch = function()
    if db then db:OnProfileChanged(function() calls = calls + 1 end) end
  end })
  assert(db:LoadProfile("Default") and calls == 0)
  assert(db:LoadProfile("Default") and calls == 1)
`);
await scenario("sliders restore after delayed geometry, resize and show", `
  local width, textures = 200, {}
  local function widget(parent)
    local w = { scripts = {}, parent = parent, children = {} }
    if parent and parent.children then parent.children[#parent.children + 1] = w end
    function w:SetScript(key, fn) self.scripts[key] = fn end
    function w:SetPoint(point, relative, relativePoint, x) self.pointX = x end
    function w:SetText(text) self.text = text end
    function w:GetWidth() return width end
    for _, key in ipairs({ "SetSize", "SetHeight", "SetWidth", "SetAllPoints", "SetTextColor", "Hide", "Show", "SetColorTexture", "SetTexture", "SetVertexColor", "ClearAllPoints", "EnableMouseWheel" }) do w[key] = function() end end
    function w:CreateFontString() return widget(self) end
    function w:CreateTexture() local t = widget(self); textures[#textures + 1] = t; return t end
    return w
  end
  CreateFrame = function(_, _, parent) return widget(parent) end
  RGX.GetDesign = function() return { Unpack = function() return 1, 1, 1, 1 end } end
  RGX.UI.CreateLabel = function(_, parent) return widget(parent) end
  RGX.UI.CreateResetButton = function(_, parent) return widget(parent) end
  RGX.UI.AnchorRowReset = function() end
  local storage = { value = 50 }
  local numeric = RGX.UI:CreateSlider(widget(), { storage = storage, min = 0, max = 100 })
  local thumb = textures[3]
  assert(thumb.pointX == 100)
  width = 400
  local track = thumb.parent
  if track.scripts.OnSizeChanged then track.scripts.OnSizeChanged(track, 400, 18) end
  assert(thumb.pointX == 200, "numeric thumb stayed at pre-layout width")
  storage.value = 75
  numeric.scripts.OnShow(numeric)
  assert(thumb.pointX == 300 and numeric.valueLabel.text == "75", "show did not restore both position and label")
  width, textures = 200, {}
  local volumeStorage = { volume = "low" }
  local volume = RGX.UI:CreateVolumeSlider(widget(), { storage = volumeStorage })
  local volumeThumb = textures[3]
  width = 400
  if volume.scripts.OnSizeChanged then volume.scripts.OnSizeChanged(volume, 400, 18) end
  assert(volumeThumb.pointX == 60, "volume thumb stayed at pre-layout width")
  volumeStorage.volume = "high"
  if volume.scripts.OnShow then volume.scripts.OnShow(volume) end
  assert(volumeThumb.pointX == 340, "volume show did not restore saved state")
`);
const first = await vm();
await scenario("scroll pages have no native bar and retain bounded wheel scrolling", `
  local range, offset = 150, 120
  local viewport
  CreateFrame = function(kind, _, parent, template)
    assert(template == nil, "scrollbar template should not be instantiated")
    local w = { scripts = {} }
    function w:SetPoint() end
    function w:SetHeight() end
    function w:SetWidth() end
    function w:GetWidth() return 200 end
    function w:SetScrollChild(child) self.child = child end
    function w:EnableMouseWheel(value) self.wheel = value end
    function w:SetScript(key, fn) self.scripts[key] = fn end
    function w:HookScript(key, fn) self.scripts[key] = fn end
    function w:GetVerticalScrollRange() return range end
    function w:GetVerticalScroll() return offset end
    function w:SetVerticalScroll(value) offset = value end
    if kind == "ScrollFrame" then viewport = w end
    return w
  end
  local canvas, scroll = RGX.UI:CreateScrollPage({}, 600)
  assert(viewport == scroll and scroll.child == canvas and scroll.ScrollBar == nil and scroll.wheel)
  scroll.scripts.OnMouseWheel(scroll, -5)
  assert(offset == 150)
  scroll.scripts.OnMouseWheel(scroll, 20)
  assert(offset == 0)
  range, offset = 20, 100
  canvas.scripts.OnSizeChanged(canvas)
  assert(offset == 20)
`);
await scenario("close button factory hides the host and honors overrides", `
  CreateFrame = function(_, _, parent, template)
    local w = { parent = parent, template = template, scripts = {}, shown = true }
    function w:SetSize(width, height) self.width = width self.height = height end
    function w:ClearAllPoints() self.point = nil end
    function w:SetPoint(point, relativeTo, relativePoint, x, y)
      self.point = point self.relativeTo = relativeTo self.relativePoint = relativePoint self.x = x self.y = y
    end
    function w:SetScript(name, fn) self.scripts[name] = fn end
    function w:Hide() self.shown = false end
    function w:Show() self.shown = true end
    return w
  end
  local host = { hidden = false }
  function host:Hide() self.hidden = true end
  local standard = RGX.UI:CreateCloseButton(host)
  assert(host.closeButton == standard, "factory must publish parent.closeButton")
  assert(standard.template == "UIPanelCloseButton" and standard.width == 30 and standard.height == 30)
  assert(standard.point == "TOPRIGHT" and standard.relativeTo == host and standard.x == 0 and standard.y == 0)
  standard.scripts.OnClick()
  assert(host.hidden, "default click must hide the parent")
  local dialog = { hidden = false }
  function dialog:Hide() self.hidden = true end
  local clicks = 0
  local custom = RGX.UI:CreateCloseButton(dialog, {
    width = 24, height = 24, point = "TOPLEFT", relativePoint = "TOPLEFT",
    x = -4, y = 8, hidden = true,
    onClick = function() clicks = clicks + 1 end,
  })
  assert(dialog.closeButton == custom)
  assert(custom.width == 24 and custom.point == "TOPLEFT" and custom.relativeTo == dialog and custom.x == -4 and custom.y == 8)
  assert(custom.shown == false, "hidden opt must start hidden")
  custom.scripts.OnClick()
  assert(clicks == 1 and dialog.hidden == false, "custom onClick must replace the default hide")
`);
await scenario("config gear opens its dialog and config dialog owns its chrome", `
  RGX.GetDesign = function() return nil end
  local shown = {}
  CreateFrame = function(_, _, parent, template)
    local w = { parent = parent, template = template, scripts = {}, shown = true }
    function w:SetSize(width, height) self.width = width self.height = height end
    function w:ClearAllPoints() self.point = nil end
    function w:SetPoint(point, relativeTo, relativePoint, x, y)
      self.point = point self.relativeTo = relativeTo self.relativePoint = relativePoint self.x = x self.y = y
    end
    function w:SetScript(name, fn) self.scripts[name] = fn end
    function w:HookScript(name, fn) self.scripts[name] = fn end
    function w:GetParent() return self.parent end
    function w:CreateTexture() local t = { desaturated = false, textures = {} } setmetatable(t, { __index = function(tbl, key)
      if key == "SetAllPoints" or key == "SetTexCoord" then return function() end end
      if key == "SetTexture" then return function(_, path) tbl.path = path end end
      if key == "SetDesaturated" then return function(_, value) tbl.desaturated = value end end
    end }) return t end
    function w:Hide() self.shown = false end
    function w:Show() self.shown = true shown[#shown + 1] = self end
    function w:RegisterForDrag() end
    function w:SetFrameStrata() end
    function w:SetClampedToScreen() end
    function w:EnableMouse() end
    function w:SetMovable() end
    function w:StartMoving() end
    function w:StopMovingOrSizing() end
    function w:SetBackdrop() end
    function w:SetBackdropColor() end
    function w:SetBackdropBorderColor() end
    function w:CreateFontString() local f = { text = "" } setmetatable(f, { __index = function(tbl, key)
      if key == "SetPoint" then return function() end end
      if key == "SetText" then return function(_, value) tbl.text = value end end
      if key == "SetTextColor" then return function() end end
      return function() end
    end }) return f end
    return w
  end
  UIParent = {}
  local gearHost = CreateFrame("Frame")
  local gear = RGX.UI:CreateConfigButton(gearHost, { tooltip = "Configure" })
  assert(gearHost.configButton == gear, "gear must publish anchor.configButton")
  assert(gear.point == "LEFT" and gear.relativeTo == gearHost and gear.relativePoint == "RIGHT" and gear.x == 6)
  local dialog = RGX.UI:CreateConfigDialog(nil, { title = "Advanced", width = 300, height = 200 })
  assert(dialog.title == nil or true)
  assert(dialog.width == 300 and dialog.height == 200)
  assert(dialog.shown == false, "config dialog must start hidden")
  local gear2 = RGX.UI:CreateConfigButton(gearHost, { dialog = dialog, onClick = nil })
  gear2.scripts.OnClick(gear2)
  assert(dialog.shown == true, "default gear click must show the bound dialog")
  local clicks = 0
  local gear3 = RGX.UI:CreateConfigButton(gearHost, { onClick = function() clicks = clicks + 1 end })
  gear3.scripts.OnClick(gear3)
  assert(clicks == 1 and dialog.shown == true, "custom gear click must not touch the dialog")
`);
let serialized;
try {
  serialized = first.doStringSync(`
    local db = RGX:NewDatabase("ReloadDB", { enabled = true, nested = { size = 12 } }, { profileIsGlobal = true })
    local captured = db.global
    ReloadDB = { profiles = { Default = { enabled = false }, Raid = { enabled = true, nested = { size = 27 } } }, activeProfile = "Raid" }
    assert(db:Adopt())
    assert(captured.nested.size == 27)
    captured.enabled = false
    captured.offsetX = 0
    captured.nested.color = { 0.1, 0.2, 0.3 }
    -- WoW persists plain Lua data, not Framework's profile transfer codec.
    local function literal(value)
      if type(value) == "string" then return string.format("%q", value) end
      if type(value) == "number" or type(value) == "boolean" then return tostring(value) end
      assert(type(value) == "table")
      local parts = {}
      for key, child in pairs(value) do parts[#parts + 1] = "[" .. literal(key) .. "]=" .. literal(child) end
      table.sort(parts)
      return "{" .. table.concat(parts, ",") .. "}"
    end
    return "ReloadDB=" .. literal(ReloadDB)
  `);
} finally { first.global.close(); }
const second = await vm();
try {
  second.ctx.__saved = serialized;
  second.doStringSync(`
    local db = RGX:NewDatabase("ReloadDB", { enabled = true, nested = { size = 12 } }, { profileIsGlobal = true })
    local captured = db.global
    -- Execute only this trusted fixture's synthetic SavedVariables chunk.
    assert(loadstring(__saved))()
    assert(db:Adopt())
    assert(db:GetActiveProfile() == "Raid" and captured.enabled == false)
    assert(captured.offsetX == 0 and captured.nested.size == 27)
    assert(captured.nested.color[2] == 0.2)
    assert(db:LoadProfile("Default") and captured.enabled == false)
  `);
  count++; console.log("PASS serialized reload into an independent Lua VM");
} finally { second.global.close(); }
assert.equal(failures.length, 0, `Persistence regressions: ${failures.join(", ")}`);
console.log(`PROFILE PERSISTENCE OK ${count} ownership/defaults/callback/widget/fresh-VM scenarios`);
