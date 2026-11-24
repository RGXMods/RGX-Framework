#!/usr/bin/env node
// Real library callbacks under Lua 5.1; tooltip methods are deterministic seams,
// not evidence of rendered UI, native API availability, taint or combat safety.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const lua = await Lua.create();
try {
  lua.ctx.brokerSource = readFileSync(join(root, "libraries/databroker/databroker.lua"), "utf8");
  lua.ctx.tooltipSource = readFileSync(join(root, "libraries/tooltip/tooltip.lua"), "utf8");
  lua.doStringSync(`
    function fresh()
      diagnostics, hooks, hookCount = {}, {}, 0
      local modules = {}
      framework = {
        RegisterModule = function(_, name, module) modules[name] = module end,
        Debug = function(_, message) diagnostics[#diagnostics + 1] = message end,
      }
      GameTooltip = { lines = {}, shown = false }
      function GameTooltip:SetOwner(owner) self.owner = owner end
      function GameTooltip:ClearLines() self.lines = {} end
      function GameTooltip:AddLine(text) self.lines[#self.lines + 1] = text end
      function GameTooltip:AddDoubleLine(left, right) self.lines[#self.lines + 1] = { left, right } end
      function GameTooltip:Show() self.shown = true end
      function GameTooltip:Hide() self.shown = false end
      Enum = { TooltipDataType = { Item = 1 } }
      TooltipDataProcessor = { AddTooltipPostCall = function(kind, callback)
        hookCount = hookCount + 1
        hooks[kind] = callback
      end }
      assert(loadstring(brokerSource))("RGX-Framework", framework)
      assert(loadstring(tooltipSource))("RGX-Framework", framework)
      DB, Tip = modules.databroker, modules.tooltip
    end
    function hostileError()
      return setmetatable({}, { __tostring = function() error("error formatter failed") end })
    end
    function hoverFrame()
      return { scripts = {}, SetScript = function(self, name, callback) self.scripts[name] = callback end }
    end
  `);
  const scenarios = [
    ["DataBroker keeps proxy identity, arguments and independent registry snapshots", `
      local registered, changed
      DB:OnNewDataObject(function(name, object) registered = { name, object } end)
      DB:OnAttributeChanged(function(name, key, value) changed = { name, key, value } end)
      local object = DB:NewDataObject("Example", { text = "before" })
      assert(registered[1] == "Example" and registered[2] == object)
      object.text = "after"
      assert(changed[1] == "Example" and changed[2] == "text" and changed[3] == "after")
      local snapshot = DB:GetAllDataObjects()
      snapshot.Example = nil
      assert(DB:GetDataObject("Example") == object)
    `],
    ["new-object notifications survive a throwing diagnostic reporter", `
      local healthy = 0
      framework.Debug = function() error("reporter failed") end
      DB:OnNewDataObject(function() error("consumer failed") end)
      DB:OnNewDataObject(function(name, object)
        assert(name == "Example" and object == DB:GetDataObject(name))
        healthy = healthy + 1
      end)
      local ok = pcall(function() DB:NewDataObject("Example", {}) end)
      assert(ok, "diagnostic reporting escaped new-object notification")
      assert(healthy == 1, "another new-object consumer was skipped")
    `],
    ["attribute notifications survive an unprintable consumer error", `
      local object = DB:NewDataObject("Example", {})
      local healthy = 0
      DB:OnAttributeChanged(function() error(hostileError()) end)
      DB:OnAttributeChanged(function(name, key, value)
        assert(name == "Example" and key == "text" and value == false)
        healthy = healthy + 1
      end)
      local ok = pcall(function() object.text = false end)
      assert(ok, "error formatting escaped attribute notification")
      assert(healthy == 1 and object.text == false, "another attribute consumer or stored value was lost")
    `],
    ["new-object registration preserves failure-isolated eager replay", `
      DB:NewDataObject("One", {})
      DB:NewDataObject("Two", {})
      local replayed = 0
      local ok = pcall(function() DB:OnNewDataObject(function() error("replay failed") end) end)
      assert(ok, "a failing eager-replay consumer escaped")
      DB:OnNewDataObject(function() replayed = replayed + 1 end)
      assert(replayed == 2, "existing objects were not replayed exactly once")
    `],
    ["native tooltip consumers retain payload identity after an unprintable error", `
      local tooltip, data, healthy = {}, {}, 0
      assert(Tip:HookNative("item", function() error(hostileError()) end))
      assert(Tip:HookNative("item", function(owner, payload)
        assert(owner == tooltip and payload == data)
        healthy = healthy + 1
      end))
      assert(hookCount == 1, "native registration was duplicated")
      local ok = pcall(hooks[1], tooltip, data)
      assert(ok, "native dispatch leaked an error-formatting failure")
      assert(healthy == 1, "a healthy native tooltip consumer was skipped")
    `],
    ["native tooltip dispatch survives a throwing diagnostic reporter", `
      local healthy = 0
      framework.Debug = function() error("reporter failed") end
      assert(Tip:HookNative("item", function() error("consumer failed") end))
      assert(Tip:HookNative("item", function() healthy = healthy + 1 end))
      local ok = pcall(hooks[1], {}, {})
      assert(ok and healthy == 1, "a reporter failure interrupted native tooltip dispatch")
    `],
    ["composed tooltip lines survive a throwing diagnostic reporter", `
      framework.Debug = function() error("reporter failed") end
      local broken = setmetatable({}, { __index = function() error("line failed") end })
      local ok, shown = pcall(Tip.Show, Tip, {}, { lines = { broken, "Healthy line" } })
      assert(ok and shown, "reporting a bad line aborted tooltip composition")
      assert(GameTooltip.shown and GameTooltip.lines[1] == "Healthy line")
    `],
    ["composed tooltip lines survive an unprintable error", `
      local broken = setmetatable({}, { __index = function() error(hostileError()) end })
      local ok = pcall(Tip.Show, Tip, {}, { lines = { broken, "Healthy line" } })
      assert(ok and GameTooltip.lines[1] == "Healthy line", "line-error formatting aborted composition")
    `],
    ["hover builders and their diagnostics cannot escape into hover handlers", `
      local frame = hoverFrame()
      framework.Debug = function() error("reporter failed") end
      assert(Tip:Attach(frame, function() error("builder failed") end))
      assert(pcall(frame.scripts.OnEnter, frame), "builder-error reporting escaped OnEnter")
      assert(not GameTooltip.shown)
      local healthy = hoverFrame()
      assert(Tip:Attach(healthy, function(owner)
        assert(owner == healthy)
        return { lines = { "Healthy hover" } }
      end))
      healthy.scripts.OnEnter(healthy)
      assert(GameTooltip.shown and GameTooltip.lines[1] == "Healthy hover")
      healthy.scripts.OnLeave(healthy)
      assert(not GameTooltip.shown)
    `],
    ["ordinary callback failures still reach diagnostics", `
      DB:OnNewDataObject(function() error("broker diagnostic") end)
      DB:NewDataObject("Example", {})
      assert(Tip:HookNative("item", function() error("tooltip diagnostic") end))
      hooks[1]({}, {})
      assert(#diagnostics == 2)
      assert(diagnostics[1]:find("broker diagnostic", 1, true))
      assert(diagnostics[2]:find("tooltip diagnostic", 1, true))
    `],
  ];
  let failures = 0;
  for (const [name, code] of scenarios) {
    try {
      lua.doStringSync(`fresh()\n${code}`);
      console.log(`PASS ${name}`);
    } catch (error) {
      failures++;
      console.error(`FAIL ${name}: ${error.message}`);
    }
  }
  console.log(`LIBRARY CALLBACKS ${scenarios.length - failures}/${scenarios.length} passed`);
  if (failures) process.exitCode = 1;
} finally {
  lua.global.close();
}
