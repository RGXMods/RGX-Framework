#!/usr/bin/env node
// Real compatibility owner, core registry, event emitter and inventory module.
// Headless fixtures do not establish native registration, bank access or taint safety.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const sources = {
  compat: "core/compat.lua", core: "core/core.lua",
  events: "core/systems/events.lua", runtime: "core/systems/runtime.lua",
  initialization: "core/initialization.lua",
  inventory: "modules/inventory/inventory.lua",
};
const scenarios = [
  ["registry and lifecycle use existing owners", `
    assert(RGX:GetInventory() == RGX:GetModule("inventory"))
    assert(rawget(_G, "RGXInventory") == nil, "registry-only inventory must not add a public global")
    assert(loadstring(initializationSource))("RGX-Framework", RGX)
    RGX:FireEvent("ADDON_LOADED", "RGX-Framework")
    assert(I._eventsInit == true, "registry-only inventory must initialize through the real lifecycle")
    RGX._registrationDriver.scripts.OnUpdate(RGX._registrationDriver)
    I:Init(); I:Init()
    assert(RGX.eventFrame.attempts.BAG_UPDATE_DELAYED == 1)
    assert(RGX.eventFrame.attempts.GET_ITEM_INFO_RECEIVED == 1)
    assert(RGX.eventFrame.attempts.BAG_UPDATE == nil)
  `],
  ["modern counts map bank flags without treating uses as a bank", `
    C_Item.GetItemCount = function(...)
      local id, bank, uses, reagent, account = ...
      assert(select("#", ...) == 4 and id == 12 and bank == true)
      assert(uses == false and reagent == true and account == nil)
      return 7
    end
    assert(I:GetItemCount(12, true, true) == 7)
  `],
  ["registry-only initialization faults cannot abort readiness", `
    I.Init = function() error("inventory initialization failed") end
    assert(loadstring(initializationSource))("RGX-Framework", RGX)
    RGX:FireEvent("ADDON_LOADED", "RGX-Framework")
    assert(RGX:IsReady(), "a registry-only diagnostic fault aborted framework readiness")
  `],
  ["denied or malformed storage flags never become known totals", `
    local queries = 0
    C_Item.GetItemCount = function() queries = queries + 1; return 8 end
    local access = RGX.API.CanAccessValue
    RGX.API.CanAccessValue = function(value) return value ~= true and access(value) end
    assert(I:GetItemCount(1, true, false) == nil)
    assert(I:GetItemCount(1, false, true) == nil)
    local m = I:GetRemainingMaterials({ { crafts = 1, reagents = { [1] = 2 } } }, { includeBank = true })
    assert(m[1].onHandCount == nil and m[1].stillNeeded == nil and queries == 0)
    RGX.API.CanAccessValue = access
    assert(I:GetItemCount(1, "bank") == nil and queries == 0)
  `],
  ["old two-argument compatibility calls retain their call shape", `
    C_Item.GetItemCount = function(...)
      assert(select("#", ...) == 2)
      local id, bank = ...; assert(id == 12 and bank == true)
      return 4
    end
    assert(RGX.API.GetItemCount(12, true) == 4)
  `],
  ["legacy counts retain established two-argument fallback", `
    C_Item = nil
    GetItemCount = function(...)
      assert(select("#", ...) == 2)
      local id, bank = ...; assert(id == 12 and bank == true)
      return 6
    end
    assert(I:GetItemCount(12, true, false) == 6)
    assert(I:GetItemCount(12, true, true) == nil)
  `],
  ["missing and failing providers remain unknown", `
    C_Item.GetItemCount = function() error("unavailable") end
    assert(I:GetItemCount(12) == nil)
    C_Item = nil; GetItemCount = nil
    assert(I:GetItemCount(12) == nil)
    assert(RGX.API.GetItemCount(12) == 0) -- existing shim's legacy default is preserved
  `],
  ["zero is known; invalid, nonfinite and denied values are not counts", `
    assert(I:GetItemCount(12) == 0)
    for _, value in ipairs({ -1, math.huge, 0/0, "7", {} }) do
      C_Item.GetItemCount = function() return value end
      assert(I:GetItemCount(12) == nil)
    end
    C_Item.GetItemCount = function() return 7 end
    local access = RGX.API.CanAccessValue
    RGX.API.CanAccessValue = function(value) return value ~= 7 and access(value) end
    assert(I:GetItemCount(12) == nil)
    RGX.API.CanAccessValue = function() error("predicate unavailable") end
    assert(I:GetItemCount(12) == nil)
  `],
  ["material plans merge duplicate reagents and count each item once", `
    local calls = {}
    C_Item.GetItemCount = function(id)
      calls[id] = (calls[id] or 0) + 1; return id == 1 and 5 or 10
    end
    local plan = { { crafts = 3, reagents = { [1] = 2, [2] = 1 } },
      { crafts = 2, reagents = { [1] = 4 } } }
    local m = I:GetRemainingMaterials(plan)
    assert(m[1].requiredCount == 14 and m[1].onHandCount == 5 and m[1].stillNeeded == 9)
    assert(m[2].requiredCount == 3 and m[2].stillNeeded == 0)
    assert(calls[1] == 1 and calls[2] == 1 and plan[1].reagents[1] == 2)
    m[1].requiredCount = 0
    assert(I:GetRemainingMaterials(plan)[1].requiredCount == 14)
  `],
  ["empty and zero-craft plans do not invent material rows", `
    assert(next(I:GetRemainingMaterials({})) == nil)
    assert(next(I:GetRemainingMaterials({ { crafts = 0, reagents = { [1] = 2 } } })) == nil)
  `],
  ["unknown counts do not masquerade as missing materials", `
    C_Item.GetItemCount = function() return nil end
    local m = I:GetRemainingMaterials({ { crafts = 2, reagents = { [1] = 3 } } })
    assert(m[1].requiredCount == 6 and m[1].onHandCount == nil and m[1].stillNeeded == nil)
  `],
  ["invalid plans fail before querying the client", `
    C_Item.GetItemCount = function() error("must not query") end
    for _, plan in ipairs({
      { { crafts = -1, reagents = {} } }, { { crafts = math.huge, reagents = {} } },
      { { crafts = 0/0, reagents = {} } }, { { crafts = 1, reagents = { [0] = 1 } } },
      { { crafts = 1, reagents = { [1] = -2 } } }, { { crafts = 1, reagents = { [1] = math.huge } } },
      { { crafts = 1 } }, { { crafts = 0.5, reagents = {} } },
    }) do assert(not pcall(I.GetRemainingMaterials, I, plan)) end
  `],
  ["modern item tuple preserves name/link/texture positions", `
    C_Item.GetItemInfo = function(id) return "Leaf", "item:1", 2, 3, 4, "Trade", "Herb", 20, "", 777, 6 end
    local name, link, quality, level, minLevel, kind, sub, stack, equip, icon, price = RGX.API.GetItemInfo(1)
    assert(name == "Leaf" and link == "item:1" and quality == 2 and icon == 777 and price == 6)
    local m = I:GetRemainingMaterials({ { crafts = 1, reagents = { [1] = 1 } } })
    assert(m[1].name == "Leaf" and m[1].icon == 777)
    assert(m[1].link == "item:1", "metadata links are retained without a second consumer query")
  `],
  ["existing table and legacy item-info compatibility survives", `
    C_Item.GetItemInfo = function() return { itemName = "Table item", iconFileID = 333 } end
    assert(RGX.API.GetItemInfo(1) == "Table item")
    C_Item.GetItemInfo = nil
    GetItemInfo = function() return "Legacy item", "item:1", nil, nil, nil, nil, nil, nil, nil, 444 end
    local m = I:GetRemainingMaterials({ { crafts = 1, reagents = { [1] = 1 } } })
    assert(m[1].name == "Legacy item" and m[1].icon == 444)
  `],
  ["cold metadata keeps identity/icon and makes one request per item", `
    local requested = 0
    C_Item.RequestLoadItemDataByID = function(id) assert(id == 1); requested = requested + 1 end
    C_Item.GetItemIconByID = function() return 222 end
    local m = I:GetRemainingMaterials({ { crafts = 1, reagents = { [1] = 1 } }, { crafts = 1, reagents = { [1] = 2 } } })
    assert(requested == 1 and m[1].itemID == 1 and m[1].name == nil and m[1].icon == 222)
    C_Item.RequestLoadItemDataByID = function() error("request unavailable") end
    assert(pcall(I.GetRemainingMaterials, I, { { crafts = 1, reagents = { [1] = 1 } } }))
  `],
  ["shared emitter retains payloads, detach and failure isolation", `
    local seen = 0
    local detach = I:OnChanged(function(event, id, success)
      assert(event == "GET_ITEM_INFO_RECEIVED" and id == 1 and success == true); seen = seen + 1
    end)
    I:OnChanged(function() error("consumer failed") end)
    geterrorhandler = function() return function() error("reporter failed") end end
    RGX:FireEvent("GET_ITEM_INFO_RECEIVED", 1, false); assert(seen == 0)
    RGX:FireEvent("GET_ITEM_INFO_RECEIVED", 1, true); assert(seen == 1)
    detach(); detach()
    RGX:FireEvent("GET_ITEM_INFO_RECEIVED", 1, true); assert(seen == 1)
    assert(I:OnChanged(nil) == nil)
  `],
  ["shared emitter cannot leak hostile error formatting", `
    I:OnChanged(function() error(setmetatable({}, { __tostring = function() error("formatter failed") end })) end)
    assert(pcall(inventoryEmitter.Fire, inventoryEmitter, "changed", "BAG_UPDATE_DELAYED"),
      "shared emitter let error formatting escape")
  `],
  ["shared emitter contains a throwing error-handler getter", `
    I:OnChanged(function() error("consumer failed") end)
    geterrorhandler = function() error("getter failed") end
    assert(pcall(inventoryEmitter.Fire, inventoryEmitter, "changed", "BAG_UPDATE_DELAYED"),
      "shared emitter let error-handler acquisition escape")
  `],
  ["timer reporting cannot abort cleanup or later timers", `
    local good = 0
    geterrorhandler = function() error("getter failed") end
    print = function() end
    RGX:After(0, function() error(setmetatable({}, { __tostring = function() error("formatter failed") end })) end)
    RGX:After(0, function() good = good + 1 end)
    assert(pcall(RGX.UpdateTimers, RGX, 1))
    assert(good == 1 and #RGX.timers == 0 and (RGX._timerDispatchDepth or 0) == 0)
  `],
  ["missing-module reporting contains handler acquisition errors", `
    geterrorhandler = function() error("getter failed") end
    local ok, value = pcall(RGX.RequireModule, RGX, "not-a-module")
    assert(ok and value == nil)
  `],
  ["declarative callback diagnostics retain the owning context", `
    geterrorhandler = function() error("getter failed") end
    RGX.Addon("InventoryFaultFixture", { on = { RGX_INVENTORY_TEST = function()
      error(setmetatable({}, { __tostring = function() error("formatter failed") end }))
    end } })
    RGX:FireEvent("ADDON_LOADED", "InventoryFaultFixture")
    RGX:FireEvent("RGX_INVENTORY_TEST")
    local message = RGX._errorLog and RGX._errorLog[#RGX._errorLog]
    assert(message and message:find("[InventoryFaultFixture] on.RGX_INVENTORY_TEST:", 1, true))
  `],
  ["bag notifications use the available event without polling", `
    local seen = 0
    I:OnChanged(function(event) assert(event == "BAG_UPDATE_DELAYED"); seen = seen + 1 end)
    RGX:FireEvent("BAG_UPDATE_DELAYED")
    assert(seen == 1 and RGX.eventFrame.attempts.BAG_UPDATE == nil)
  `],
  ["older event surface falls back to BAG_UPDATE", `
    blocked.BAG_UPDATE_DELAYED = true
    local seen = 0
    I:OnChanged(function(event, bag) assert(event == "BAG_UPDATE" and bag == 2); seen = seen + 1 end)
    RGX:FireEvent("BAG_UPDATE", 2)
    assert(seen == 1 and RGX.eventFrame.attempts.BAG_UPDATE_DELAYED == nil)
  `],
];
const failures = [];
for (const [name, test] of scenarios) {
  const lua = await Lua.create();
  try {
    for (const [key, path] of Object.entries(sources)) lua.ctx[key + "Source"] = readFileSync(join(root, path), "utf8");
    lua.doStringSync(`
      blocked = {}
      WOW_PROJECT_MAINLINE=1; WOW_PROJECT_CLASSIC=2; WOW_PROJECT_CAMELOT=18; WOW_PROJECT_ID=18
      function GetBuildInfo() return "1.60.1", "", "", 16001 end
      function issecretvalue() return false end
      function issecrettable() return false end
      C_EventUtils = { IsEventValid = function(event) return not blocked[event] end }
      C_Item = { GetItemCount = function() return 0 end, GetItemInfo = function() end }
      function CreateFrame()
        local f = { scripts = {}, attempts = {}, registered = {} }
        function f:SetScript(name, fn) self.scripts[name] = fn end
        function f:Show() end
        function f:Hide() end
        function f:RegisterEvent(name)
          self.attempts[name] = (self.attempts[name] or 0) + 1; self.registered[name] = true
        end
        function f:IsEventRegistered(name) return self.registered[name] == true end
        function f:UnregisterEvent(name) self.registered[name] = nil end
        return f
      end
      RGX = {}
      assert(loadstring(compatSource))("RGX-Framework", RGX)
      assert(loadstring(coreSource))("RGX-Framework", RGX)
      assert(loadstring(eventsSource))("RGX-Framework", RGX)
      assert(loadstring(runtimeSource))("RGX-Framework", RGX)
      local create = RGX.CreateEmitter
      function RGX:CreateEmitter(name)
        local emitter = create(self, name)
        if name == "RGXInventory" then inventoryEmitter = emitter end
        return emitter
      end
      assert(loadstring(inventorySource))("RGX-Framework", RGX)
      I = assert(RGX:GetInventory())
    `);
    lua.doStringSync(test);
    console.log(`PASS inventory: ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL inventory: ${name}\n${error.message}`);
  } finally {
    lua.global.close();
  }
}
assert.equal(failures.length, 0, `${failures.length}/${scenarios.length} inventory scenarios failed: ${failures.join("; ")}`);
console.log(`INVENTORY RUNTIME OK ${scenarios.length} real-module scenarios`);
