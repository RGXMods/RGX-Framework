#!/usr/bin/env node
// RGXTimers runtime harness: loads the real libraries/timers/timers.lua into a
// Lua 5.1 VM (wasmoon) and drives bar lifecycle against a deterministic frame
// stand-in and timer driver. Mirrors the worldmap-runtime-check harness shape:
// only the seams timers.lua touches are provided (RGX:RegisterModule,
// RGX:Every, RGX:CancelTimer, CreateFrame, UIParent, GetTime). Not a WoW
// emulator.
//
// Frames are plain data tables whose methods come from shared prototypes,
// matching WoW: a widget has no raw method fields, so the module's metatable
// swap behaves the same way here as in the client. Unknown member access
// raises instead of silently returning nil; known data fields read as nil.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const files = {
  timers: join(ROOT, "libraries", "timers", "timers.lua"),
  test: join(HERE, "timers-runtime-test.lua"),
};

const lua = await Lua.create();
try {
  lua.ctx.timersSource = readFileSync(files.timers, "utf8");
  lua.ctx.testSource = readFileSync(files.test, "utf8");

  lua.doStringSync(`
    local clock = 0
    _G.GetTime = function() return clock end
    _G.UIParent = { _is = "UIParent" }

    local timers = {}

    -- RGX stand-in: module registry + alias publication (mirrors
    -- core/core.lua's moduleAliases behaviour) + repeating timers.
    local RGX = {
      modules = {},
      moduleAliases = { timers = "RGXTimers" },
      RegisterModule = function(self, name, module, opts)
        opts = opts or {}
        module.name = module.name or name
        module.category = opts.category or module.category
        local alias = opts.global or self.moduleAliases[name]
        if type(alias) == "string" then _G[alias] = module end
        self.modules[name] = module
        return true
      end,
      Every = function(self, duration, callback, label)
        local timer = {
          period = duration,
          callback = callback,
          label = label,
          due = clock + duration,
          active = true,
        }
        timers[#timers + 1] = timer
        return timer
      end,
      CancelTimer = function(self, timer)
        if type(timer) == "table" then timer.active = false end
        return true
      end,
      Debug = function() end,
    }
    _G.RGX = RGX
    _G.RGXFramework = RGX

    -- Data fields a widget may hold (or legitimately read as nil). Anything
    -- else unknown raises, so a typo'd frame call fails the run instead of
    -- silently returning nil.
    local widgetDataFields = {
      shown = true, scripts = true, width = true, height = true, minMax = true,
      value = true, statusBarTexture = true, color = true, strata = true,
      text = true, path = true, parent = true,
      statusBar = true, icon = true, label = true, time = true,
      duration = true, remaining = true, running = true, countdown = true,
      updater = true, onComplete = true, onCancel = true, start = true,
      exp = true, _label = true, _name = true,
    }
    local function strictIndex(kind)
      return function(_, key)
        if widgetDataFields[key] then return nil end
        error("timers harness: unknown " .. kind .. " member '" .. tostring(key) .. "'", 2)
      end
    end

    local FrameProto = setmetatable({}, { __index = strictIndex("frame") })
    local frameMT = { __index = FrameProto }

    function FrameProto:SetWidth(width) self.width = width end
    function FrameProto:SetHeight(height) self.height = height end
    function FrameProto:SetSize(width, height) self.width = width; self.height = height end
    function FrameProto:SetPoint() end
    function FrameProto:ClearAllPoints() end
    function FrameProto:SetFrameStrata(strata) self.strata = strata end
    function FrameProto:SetFrameLevel() end
    function FrameProto:SetScale() end
    function FrameProto:SetParent(parent) self.parent = parent end
    function FrameProto:GetParent() return self.parent end
    function FrameProto:SetScript(event, handler) self.scripts[event] = handler end
    function FrameProto:GetScript(event) return self.scripts[event] end
    function FrameProto:Show() self.shown = true end
    function FrameProto:Hide()
      self.shown = false
      local handler = self.scripts.OnHide
      if handler then handler(self) end
    end
    function FrameProto:IsShown() return self.shown end
    function FrameProto:SetMinMaxValues(minValue, maxValue) self.minMax = { minValue, maxValue } end
    function FrameProto:SetValue(value) self.value = value end
    function FrameProto:GetValue() return self.value end
    function FrameProto:SetStatusBarTexture(path) self.statusBarTexture = path end
    function FrameProto:SetStatusBarColor(r, g, b, a) self.color = { r, g, b, a } end

    local TextureProto = setmetatable({}, { __index = strictIndex("texture") })
    local textureMT = { __index = TextureProto }
    function TextureProto:SetTexture(path) self.path = path end
    function TextureProto:SetWidth(width) self.width = width end
    function TextureProto:SetHeight(height) self.height = height end
    function TextureProto:SetPoint() end
    function TextureProto:SetTexCoord() end
    function TextureProto:Show() self.shown = true end
    function TextureProto:Hide() self.shown = false end
    function TextureProto:IsShown() return self.shown end

    local FontStringProto = setmetatable({}, { __index = strictIndex("font string") })
    local fontStringMT = { __index = FontStringProto }
    function FontStringProto:SetText(text) self.text = text end
    function FontStringProto:SetFormattedText(pattern, ...) self.text = string.format(pattern, ...) end
    function FontStringProto:SetPoint() end
    function FontStringProto:SetJustifyH() end
    function FontStringProto:SetJustifyV() end
    function FontStringProto:SetTextColor() end
    function FontStringProto:Show() self.shown = true end
    function FontStringProto:Hide() self.shown = false end
    function FontStringProto:IsShown() return self.shown end

    function FrameProto:CreateTexture() return setmetatable({ shown = false, path = nil }, textureMT) end
    function FrameProto:CreateFontString() return setmetatable({ text = "", shown = true }, fontStringMT) end

    _G.CreateFrame = function(frameType, name, parent)
      return setmetatable({
        _type = frameType,
        _name = name,
        parent = parent,
        shown = true,
        scripts = {},
      }, frameMT)
    end

    -- Timer driver: advance the clock in fixed steps and fire due callbacks.
    -- The module computes remaining time from GetTime, so tick count and
    -- clock stay independent.
    __rgxTimersTick = function(count)
      for _ = 1, count do
        clock = clock + 0.1
        for _, timer in ipairs(timers) do
          if timer.active and clock >= timer.due then
            timer.due = timer.due + timer.period
            timer.callback(timer)
          end
        end
      end
      return clock
    end
    __rgxTimersClock = function() return clock end
    __rgxTimersReset = function()
      clock = 0
      timers = {}
    end
    __rgxTimersActiveCount = function()
      local active = 0
      for _, timer in ipairs(timers) do
        if timer.active then active = active + 1 end
      end
      return active
    end
    __rgxTimersLabels = function()
      local labels = {}
      for _, timer in ipairs(timers) do
        if timer.active then labels[#labels + 1] = tostring(timer.label) end
      end
      return table.concat(labels, ",")
    end

    local function loadSource(source, path)
      local chunk, err = loadstring(source, "@" .. path)
      assert(chunk, err)
      return chunk
    end
    loadSource(timersSource, "libraries/timers/timers.lua")("RGX-Framework", RGX)
    loadSource(testSource, "tools/ci/timers-runtime-test.lua")("RGX-Framework", RGX)
  `);

  console.log(lua.ctx.__rgxTimersTestResult);
  if (String(lua.ctx.__rgxTimersTestResult || "").indexOf("PASSED") === -1) {
    process.exit(1);
  }
} finally {
  lua.global.close();
}
