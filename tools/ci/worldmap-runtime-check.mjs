#!/usr/bin/env node
// RGXWorldMap runtime harness: loads the real modules/worldmap/worldmap.lua into a
// Lua 5.1 VM (wasmoon) and exercises the pin registry + coordinate adapter
// against a minimal RGX stand-in. Mirrors the sharedmedia-runtime-check harness
// shape: only the seams worldmap.lua touches are provided (RGX:RegisterModule,
// CreateFrame, C_Map, CreateVector2D). Not a WoW emulator. Every stubbed C_Map
// name below is a real client API; phantom names must never come back.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const files = {
  worldmap: join(ROOT, "modules", "worldmap", "worldmap.lua"),
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
    -- worldmap.lua calls. C_Map stubs return deterministic values the adapter
    -- asserts against. No external-library seam (LibStub and friends) is
    -- provided; the runtime test asserts the module never resolves one.
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
        Show = function() end,
        Hide = function() end,
        SetParent = function(self, p) self._parent = p end,
        SetBackdrop = function() end,
        SetFrameStrata = function() end,
        SetFrameLevel = function() end,
      }
      return f
    end

    _G.WorldMapFrame = { _is = "WorldMapFrame" }
    _G.Minimap = { _is = "Minimap" }

    -- vector2 stub with the Vector2DMixin surface the adapter reads (GetXY).
    _G.CreateVector2D = function(x, y)
      return { GetXY = function(self) return x, y end }
    end

    -- C_Map seam: deterministic values asserted by the runtime test. Every
    -- name here is a real client API with the documented signature shape.
    _G.C_Map = {
      GetBestMapForUnit = function(unit) if unit == "player" then return 37 end end,
      GetPlayerMapPosition = function(mapID, unit)
        if unit == "player" then return CreateVector2D(0.5, 0.5) end
      end,
      GetWorldPosFromMapPos = function(mapID, pos)
        local x, y = pos:GetXY()
        return 543, CreateVector2D(x * 1000, y * 800)
      end,
      GetMapPosFromWorldPos = function(continentID, pos)
        local x, y = pos:GetXY()
        return 37, CreateVector2D(x / 1000, y / 800)
      end,
      GetMapWorldSize = function(mapID) if mapID == 37 then return 5000, 4000 end end,
      -- Deliberately absent: GetPlayerInfoInWorldMap (a phantom name that
      -- once masked a dead code path) and any GetZoneSize-style invention.
    }

    local function loadSource(source, path)
      local chunk, err = loadstring(source, "@" .. path)
      assert(chunk, err)
      return chunk
    end
    loadSource(worldmapSource, "modules/worldmap/worldmap.lua")("RGX-Framework", RGX)
    loadSource(testSource, "tools/ci/worldmap-runtime-test.lua")("RGX-Framework", RGX)
  `);

  console.log(lua.ctx.__rgxWorldMapTestResult);
  if (String(lua.ctx.__rgxWorldMapTestResult || "").indexOf("PASSED") === -1) {
    process.exit(1);
  }
} finally {
  lua.global.close();
}
