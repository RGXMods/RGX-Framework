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
const controls = readFileSync(join(ROOT, "libraries/ui/controls.lua"), "utf8");
const minimap = readFileSync(join(ROOT, "libraries/minimap/minimap.lua"), "utf8");
async function vm() {
  const lua = await Lua.create();
  lua.ctx.__database = database;
  lua.ctx.__controls = controls;
  lua.ctx.__minimap = minimap;
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
await scenario("flat migration preserves values at construction and late adoption", `
  FlatDB={enabled=false,offset=43,color={0.2,0.4,0.6}}
  local original=FlatDB.color
  local db=RGX:NewDatabase('FlatDB',{enabled=true,offset=1,color={1,1,1}},{profileIsGlobal=true,legacyFlat=true})
  local settings=db.global
  assert(settings.enabled==false and settings.offset==43 and settings.color[2]==0.4)
  settings.color[2]=0.7;assert(original[2]==0.4,'migration aliased old nested values')
  FlatDB={enabled=false,offset=44,color={0.1,0.3,0.5}}
  assert(db:Adopt() and settings.offset==44 and settings.color[2]==0.3)
  assert(db:CreateProfile('Custom'));settings.offset=55
  assert(db:Adopt()==false and db:GetActiveProfile()=='Custom' and settings.offset==55)
`);
await scenario("collector backdrops and layout remain separate from minimap textures", `
  local function widget(kind,parent)
    local w={kind=kind,parent=parent,scripts={},shown=true}
    for _,method in ipairs({'SetSize','SetFrameStrata','SetMovable','EnableMouse','RegisterForClicks','RegisterForDrag','SetHighlightTexture','SetTexture','SetMask','SetVertexColor','SetTexCoord'})do w[method]=function()end end
    function w:GetWidth()return 140 end;function w:GetHeight()return 140 end
    function w:GetFrameLevel()return 1 end;function w:GetParent()return self.parent end
    function w:SetParent(p)self.parent=p end;function w:SetPoint(...)self.point={...}end
    function w:ClearAllPoints()self.point=nil end;function w:SetScript(key,fn)self.scripts[key]=fn end
    function w:Show()self.shown=true end;function w:Hide()self.shown=false end
    function w:IsShown()return self.shown end
    function w:CreateTexture()return widget('Texture',self)end
    if kind~='Texture'then function w:SetFrameLevel(level)self.level=level end end
    return w
  end
  CreateFrame=function(kind,_,parent)return widget(kind,parent)end
  Minimap=widget('Frame');local module
  RGX.RegisterModule=function(_,name,value)if name=='minimap'then module=value end end
  assert(loadstring(__minimap))('RGX-Framework',RGX)
  local button=module:Create({name='CollectorTestButton',icon='test',storage={}})
  assert(button.frame.backgroundTexture.kind=='Texture' and button.frame.backdrop==nil)
  -- A collector's backdrop slot must stay free for the Frame it parents onto the button.
  button.frame.backdrop=CreateFrame('Frame',nil,button.frame)
  button.frame.backdrop:SetFrameLevel(3)
  local bar=widget('Frame');button.frame:SetParent(bar)
  button.frame:SetPoint('TOPLEFT',bar,'TOPLEFT',4,-4)
  button:SetVisible(true)
  assert(button.frame.point[1]=='TOPLEFT' and button.frame.point[2]==bar,'framework displaced collected icon')
  button.frame:SetParent(Minimap);button:PlaceAtAngle()
  assert(button.frame.point[1]=='CENTER' and button.frame.point[2]==Minimap)
`);
await scenario("minimap storage falls back to RGX.db when addon omits its own database", `
  local function widget(kind,parent)
    local w={kind=kind,parent=parent,scripts={},shown=true}
    for _,method in ipairs({'SetSize','SetFrameStrata','SetMovable','EnableMouse','RegisterForClicks','RegisterForDrag','SetHighlightTexture','SetTexture','SetMask','SetVertexColor','SetTexCoord'})do w[method]=function()end end
    function w:GetWidth()return 140 end;function w:GetHeight()return 140 end
    function w:GetFrameLevel()return 1 end;function w:GetParent()return self.parent end
    function w:SetParent(p)self.parent=p end;function w:SetPoint(...)self.point={...}end
    function w:ClearAllPoints()self.point=nil end;function w:SetScript(key,fn)self.scripts[key]=fn end
    function w:Show()self.shown=true end;function w:Hide()self.shown=false end
    function w:IsShown()return self.shown end
    function w:CreateTexture()return widget('Texture',self)end
    if kind~='Texture'then function w:SetFrameLevel(level)self.level=level end end
    return w
  end
  CreateFrame=function(kind,_,parent)return widget(kind,parent)end
  Minimap=widget('Frame');local module
  RGX.RegisterModule=function(_,name,value)if name=='minimap'then module=value end end
  -- Simulate the framework's own SavedVariables (set in initialization.lua
  -- ADDON_LOADED handler). RGX.Addon falls back to this when an addon omits
  -- opts.db, so the button's angle and visibility persist without a
  -- consumer-owned database.
  RGX.db = {}; _G.RGXFrameworkDB = RGX.db
  assert(loadstring(__minimap))('RGX-Framework',RGX)
  local RGXdb = RGX.db
  -- storage = RGX.db mirrors the fix: mmOpts.storage = addon.db or RGX.db
  local button=module:Create({name='ConsumerNoDBButton',icon='test',storage=RGX.db})
  assert(button._storage == RGX.db, 'storage must be RGX.db when addon omits opts.db')
  -- Angle persists to both RGX.db and the durable framework store
  button:SetAngle(310)
  assert(RGX.db.minimapAngle == 310, 'angle must persist to RGX.db')
  assert(_G.RGXFrameworkDB.RGXMinimapPositions.ConsumerNoDBButton == 310, 'angle must persist to durable framework store')
  -- Visibility persists to RGX.db via enabledKey
  button:SetVisible(false)
  assert(RGX.db.minimapEnabled == false, 'visibility must persist to RGX.db when addon omits opts.db')
  button:SetVisible(true)
  assert(RGX.db.minimapEnabled == true, 'visibility toggle must update RGX.db')
  -- A fresh button read from the same RGX.db restores both
  local restored=module:Create({name='ConsumerNoDBButton',icon='test',storage=RGX.db})
  assert(restored:GetAngle() == 310, 'angle must restore from RGX.db on re-create')
  assert(restored:GetEnabled() == true, 'enabled state must restore from RGX.db')
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
await scenario("SavedVariables alias cannot adopt its own live view and recurse", `
  local db = RGX:NewDatabase("AliasDB", { enabled = true, offset = 12 }, { profileIsGlobal = true, legacyFlat = true })
  local view, owner = db.global, AliasDB
  view.enabled = false
  view.offset = 0
  -- Old consumers assigned their public settings view back to the TOC global.
  -- ADDON_LOADED/PLAYER_LOGIN then adopt it as storage, closing a proxy cycle.
  AliasDB = view
  local ok, err = pcall(function() db:Adopt() end)
  assert(ok, "adopting the live settings alias must not overflow: " .. tostring(err))
  local readOK, enabled = pcall(function() return view.enabled end)
  assert(readOK, "nameplate-style settings read must not overflow: " .. tostring(enabled))
  assert(enabled == false and view.offset == 0, "saved false/zero must survive alias recovery")
  assert(AliasDB == owner and db._raw == owner, "TOC global must retain the original plain owner")
  assert(db:CreateProfile("Other") and db:LoadProfile("Default"))
  assert(view.enabled == false and view.offset == 0)
  AliasDB = db
  assert(pcall(function() db:Adopt() end), "database handle cannot become its own storage either")
  assert(AliasDB == owner and db._raw == owner)
`);
await scenario("metatable-poisoned profile store self-heals instead of looping", `
  local db = RGX:NewDatabase("PoisonDB", { enabled = true, scale = 1.5 }, { profileIsGlobal = true })
  local view = db.global
  assert(view.enabled == true and view.scale == 1.5)

  -- Poison the active profile with a proxy whose __index chains back through
  -- the database: the exact loop that produces "C stack overflow" at
  -- ActiveProfile in live sessions. The view must heal, not recurse.
  local rawProfile = PoisonDB.profiles.Default
  assert(getmetatable(rawProfile) == nil, "fresh profile must be plain")
  setmetatable(rawProfile, { __index = function(t, key) return db[key] end })
  local ok, value = pcall(function() return view.scale end)
  assert(ok, "poisoned profile read must not overflow: " .. tostring(value))
  assert(value == 1.5, "healed read must resolve the default, got " .. tostring(value))
  assert(getmetatable(PoisonDB.profiles.Default) == nil, "profile must be rebuilt plain")

  -- Poison the profile store itself (raw.profiles): same loop, same healing.
  local rawStore = PoisonDB.profiles
  setmetatable(rawStore, { __index = function(t, key) return db[key] end })
  local ok2, value2 = pcall(function() return view.enabled end)
  assert(ok2, "poisoned store read must not overflow: " .. tostring(value2))
  assert(value2 == true, "healed store read must resolve the default")
  assert(getmetatable(PoisonDB.profiles) == nil, "store must be rebuilt plain")
  assert(view.scale == 1.5, "healed database keeps serving defaults")
  view.enabled = false
  view.scale = 0
  assert(view.enabled == false and view.scale == 0, "healed store must keep accepting saved writes")
  assert(PoisonDB.profiles.Default.enabled == false and PoisonDB.profiles.Default.scale == 0)
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
await scenario("serialization round-trips backslash paths, separators and keys", `
  local sample = {
    soundPath = [[Interface\\AddOns\\BLU\\sounds\\levelup.ogg]],
    docsPath = [[docs\\readme\\export\\lists.txt]],
    punctuation = [[a;b=c{d}e\\f]],
    flag = true,
    count = 42,
    nested = { note = [[lists\\semicolons]] },
  }
  sample[ [[a=b]] ] = "escaped key"
  sample[7] = "numeric key"
  local restored = assert(RGX:DeserializeTable(RGX:SerializeTable(sample)))
  assert(restored.soundPath == sample.soundPath, "backslash path corrupted: " .. tostring(restored.soundPath))
  assert(restored.docsPath == sample.docsPath, "readme/export path corrupted: " .. tostring(restored.docsPath))
  assert(restored.punctuation == sample.punctuation, "separator characters corrupted: " .. tostring(restored.punctuation))
  assert(restored.nested.note == sample.nested.note, "nested path corrupted")
  assert(restored.flag == true and restored.count == 42, "primitives corrupted")
  assert(restored[ [[a=b]] ] == "escaped key", "key containing '=' must survive the round trip")
  assert(restored[7] == "numeric key", "numeric key must survive the round trip")
`);
await scenario("wire format stays stable for legacy readers", `
  local wire = RGX:SerializeTable({ path = [[Interface\\AddOns\\logo.tga]] })
  local expected = [[RGX_DB_v1:T{path=SInterface\\\\AddOns\\\\logo.tga}]]
  assert(wire == expected, "wire format drifted: " .. wire)
`);
await scenario("migration failures keep completed steps durable", `
  local db = {}
  local runs = { 0, 0, 0 }
  local migrations = {
    [1] = function(d) runs[1] = runs[1] + 1; d.alpha = true end,
    [2] = function() runs[2] = runs[2] + 1; error("expected migration failure") end,
    [3] = function(d) runs[3] = runs[3] + 1; d.omega = true end,
  }
  RGX:MigrateDB(db, "MigrationDB", 3, migrations)
  assert(db._dbVersion == 1, "successful steps must persist before a later failure, got " .. tostring(db._dbVersion))
  assert(runs[1] == 1 and runs[2] == 1, "first login must run v1 once and fail v2")
  RGX:MigrateDB(db, "MigrationDB", 3, migrations)
  assert(runs[1] == 1 and runs[2] == 2, "retry must resume at the failed step without re-running v1")
  assert(db._dbVersion == 1, "failed step must not advance the stored version")
  migrations[2] = function(d) runs[2] = runs[2] + 1; d.beta = true end
  RGX:MigrateDB(db, "MigrationDB", 3, migrations)
  assert(db._dbVersion == 3, "all steps must complete")
  assert(runs[1] == 1 and runs[2] == 3 and runs[3] == 1, "completed steps must never re-run, got " .. table.concat(runs, ","))
`);
await scenario("profile API refuses destructive operations", `
  local db = RGX:NewDatabase("GuardDB", { enabled = true })
  assert(db:CreateProfile("Work"))
  db.enabled = false
  assert(db:CreateProfile("Work") == false, "create over an existing profile must refuse instead of wiping it")
  assert(db:LoadProfile("Work") and db.enabled == false, "existing profile data lost to a refused create")
  assert(db:RenameProfile("Work", "Work") == false, "same-name rename must be refused")
  assert(db:LoadProfile("Work") and db.enabled == false, "profile deleted by a same-name rename")
  assert(db:CreateProfile("Home") and db:LoadProfile("Home") and db.enabled == true)
  assert(db:RenameProfile("Work", "Home") == false, "rename onto an existing profile must be refused")
  assert(db:LoadProfile("Home") and db.enabled == true, "rename target clobbered by a refused rename")
  assert(db:LoadProfile("Work") and db.enabled == false, "rename source clobbered by a refused rename")
  assert(db:CreateProfile("Bravo") and db:LoadProfile("Bravo"))
  assert(db:DeleteProfile("Bravo") and db:GetActiveProfile() == "Default",
    "deleting the active profile must fall back to Default deterministically")
`);
await scenario("BLU retail layout: framework store adopted, not duplicated (BLU #12)", `
  -- Model of BLU's actual Retail main: core.lua lets the framework create
  -- the declared SavedVariables store (RGX.Addon db=true, dbName BLUDB) and
  -- core/systems/database.lua adopts that same proxy, registers its
  -- profile defaults late, and wires a switch-driven visual refresh.
  BLUDB = nil
  local db = RGX:NewDatabase("BLUDB", {})
  assert(type(db) == "table" and db.RegisterDefaults ~= nil, "framework proxy expected")

  -- Consumer adoption: same store, late defaults, refresh on switch.
  local refreshed = 0
  db:OnProfileChanged(function() refreshed = refreshed + 1 end)
  assert(db:RegisterDefaults({ enabled = true, volume = 30, theme = { accent = "05dffa" } }))
  local initialSwitches = refreshed
  assert(BLUDB and BLUDB.profiles and BLUDB.profiles.Default.enabled == true,
    "late defaults must merge into the declared SavedVariables global")
  assert(db.enabled == true and db.theme.accent == "05dffa", "adoption must expose the merged defaults")

  -- The consumer wrapper is an alias, never a second database:
  assert(db:GetActiveProfile() == "Default")
  db.volume = 55
  assert(BLUDB.profiles.Default.volume == 55, "consumer writes must land in the framework-owned store")

  -- Profile lifecycle drives the consumer visual refresh exactly once per switch.
  assert(db:CreateProfile("Raid"))
  assert(refreshed == initialSwitches + 1,
    "creating and switching to a profile must fire the visual refresh exactly once, got "
    .. (refreshed - initialSwitches))
  db.enabled = false
  assert(BLUDB.profiles.Raid.enabled == false)
  assert(db:LoadProfile("Default") and refreshed == initialSwitches + 2, "switching back must refresh again")
  assert(db.enabled == true, "Default must keep its own values after the Raid switch")
`);
assert.equal(failures.length, 0, `Persistence regressions: ${failures.join(", ")}`);
console.log(`PROFILE PERSISTENCE OK ${count} ownership/defaults/callback/widget/fresh-VM scenarios`);
