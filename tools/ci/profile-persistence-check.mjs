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
const first = await vm();
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
