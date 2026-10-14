#!/usr/bin/env node
// RGXWorldMap runtime harness: loads the real game/worldmap/worldmap.lua into a
// Lua 5.1 VM (wasmoon) and exercises the pin registry + coordinate adapter
// against a minimal RGX stand-in. Mirrors the sharedmedia-runtime-check harness
// shape: only the seams worldmap.lua touches are provided (RGX:RegisterModule,
// CreateFrame, C_Map, LibStub, math.atan2). Not a WoW emulator.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const files = {
  worldmap: join(ROOT, "game", "worldmap", "worldmap.lua"),
  test: join(HERE, "worldmap-runtime-test.lua"),
};

const lua = await Lua.create();
try {
  lua.ctx.worldmapSource = readFileSync(files.worldmap, "utf8");
  lua.ctx.testSource = readFileSync(files.test, "utf8");

  lua.doStringSync(`
    local events = {}
    local RGX = {
      modules = {},
      isForever = false,
      After = function(_, fn) fn() end,
      RegisterModule = function(_, name, module, meta) RGX.modules[name] = module end,
      RegisterEvent = function(_, event, handler) events[event] = handler end,
      Debug = function(_) end,
      SendMessage = function(_, ...) end,
    }
    _G.RGX = RGX

    -- Minimal WoW API stubs: CreateFrame returns a table with the methods
    -- worldmap.lua calls. C_Map stubs return deterministic values so the
    -- adapter can be asserted against. LibStub exposes HereBeDragons-2.0.
    _G.CreateFrame = function(frameType, name, parent, template)
      local f = {
        _name = name,
        _parent = parent,
        texture = nil,
        CreateTexture = function(self, layer, subLevel)
          self.texture = { SetTexture = function() end, SetAllPoints = function() end }
          return self.texture
        end,
        SetWidth = function(self, w) self._w = w end,
        SetHeight = function(self, h) self._h = h end,
        SetPoint = function(self, ...) end,
        Show = function(self) end,
        Hide = function(self) end,
        SetParent = function(self, p) self._parent = p end,
        SetBackdrop = function() end,
        SetFrameStrata = function() end,
        SetFrameLevel = function() end,
      }
      return f
    end

    _G.WorldMapFrame = { _is = "WorldMapFrame" }
    _G.Minimap = { _is = "Minimap" }

    -- C_Map seam: deterministic values asserted by the runtime test.
    _G.C_Map = {
      GetBestMapForUnit = function(unit) if unit == "player" then return 37 end end,
      GetPlayerInfoInWorldMap = function()
        return {
          position = { GetXY = function() return 0.5, 0.5 end },
          instanceID = 123,
        }
      end,
      -- Deliberately absent: GetZoneSize, GetWorldPosFromMapPos,
      -- GetMapPosFromWorldPos, GetWorldVector, GetWorldDistance
    }

    -- LibStub seam: HereBeDragons-2.0 with deterministic zone data so the
    -- adapter fallback is observable.
    local hbd = {
      GetPlayerWorldPosition = function(self) return 0.5, 0.5, 123 end,
      GetPlayerZone = function(self) return 37 end,
      GetZoneSize = function(self, mapID) if mapID == 37 then return 5000, 4000 end return nil, nil end,
      GetWorldCoordinatesFromZone = function(self, x, y, mapID, floor) return x * 100, y * 100, mapID end,
      GetZoneCoordinatesFromWorld = function(self, x, y, mapID) return x / 100, y / 100 end,
      GetWorldVector = function(self, inst, x1, y1, x2, y2)
        local dx, dy = x2 - x1, y2 - y1
        return math.atan2(dy, dx), math.sqrt(dx*dx + dy*dy)
      end,
      GetWorldDistance = function(self, inst, x1, y1, x2, y2)
        local dx, dy = x2 - x1, y2 - y1
        return math.sqrt(dx*dx + dy*dy)
      end,
    }
    _G.LibStub = function(name)
      if name == "HereBeDragons-2.0" then return hbd end
      error("LibStub: unknown library " .. tostring(name))
    end

    local function loadSource(source, path)
      local chunk, err = loadstring(source, "@" .. path)
      assert(chunk, err)
      return chunk
    end
    loadSource(worldmapSource, "game/worldmap/worldmap.lua")("RGX-Framework", RGX)
    loadSource(testSource, "tools/ci/worldmap-runtime-test.lua")("RGX-Framework", RGX)
  `);

  console.log(lua.ctx.__rgxWorldMapTestResult);
  if (String(lua.ctx.__rgxWorldMapTestResult || "").indexOf("PASSED") === -1) {
    process.exit(1);
  }
} finally {
  lua.global.close();
}
