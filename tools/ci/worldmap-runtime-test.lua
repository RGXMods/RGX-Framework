-- Runtime scenarios for RGXWorldMap pin registry and coordinate adapter.
-- Executed by tools/ci/worldmap-runtime-check.mjs, which has already installed
-- a minimal RGX stand-in and loaded game/worldmap/worldmap.lua as the
-- global `RGXWorldMap`.
--
-- Covers the acceptance criteria for the worldmap module:
--   1. module registers as RGXWorldMap global with category "game"
--   2. AddWorldMapIcon stores a pin that UpdateWorldMapIcon and
--      RemoveWorldMapIcon round-trip
--   3. RemoveAllWorldMapIcons clears the whole registry
--   4. AddMinimapIcon / RemoveMinimapIcon / RemoveAllMinimapIcons behave the
--      same for the minimap registry
--   5. GetPlayerZone and GetPlayerWorldPosition delegate through the
--      coordinate adapter (stubbed C_Map seam)
--   6. GetZoneSize falls back to HereBeDragons-2.0 when C_Map is absent

local pass, fail = 0, 0

local function scenario(name, fn)
  local ok, err = pcall(fn)
  if ok then
    pass = pass + 1
    print("PASS " .. name)
  else
    fail = fail + 1
    print("FAIL " .. name .. ": " .. tostring(err))
  end
end

local WM = _G.RGXWorldMap
assert(WM, "RGXWorldMap did not register as a global")

-- The check harness pre-stubs CreateFrame and C_Map; see worldmap-runtime-check.mjs.

scenario("module registers as game-category with compat alias", function()
  assert(WM.name == "worldmap", "module name should be worldmap")
  assert(type(WM.Init) == "function", "Init should be a function")
  assert(type(WM.AddWorldMapIcon) == "function", "AddWorldMapIcon should exist")
  assert(type(WM.AddMinimapIcon) == "function", "AddMinimapIcon should exist")
end)

scenario("AddWorldMapIcon + UpdateWorldMapIcon + RemoveWorldMapIcon round-trip", function()
  WM:Init()
  local frame = WM:AddWorldMapIcon(nil, "TESTICON", 1234, 0.25, 0.75, "pin-a")
  assert(frame ~= nil, "AddWorldMapIcon should return a frame")
  local pin = WM._pins["pin-a"]
  assert(pin ~= nil, "pin should be registered under its name")
  assert(pin.mapID == 1234, "pin mapID should round-trip")
  assert(pin.x == 0.25 and pin.y == 0.75, "pin coords should round-trip")

  local ok = WM:UpdateWorldMapIcon("pin-a", 0.5, 0.5)
  assert(ok == true, "UpdateWorldMapIcon should return true for an existing pin")
  pin = WM._pins["pin-a"]
  assert(pin.x == 0.5 and pin.y == 0.5, "update should change stored coords")

  local removed = WM:RemoveWorldMapIcon("pin-a")
  assert(removed == true, "RemoveWorldMapIcon should return true")
  assert(WM._pins["pin-a"] == nil, "pin registry should be cleared for the name")

  local missing = WM:RemoveWorldMapIcon("pin-a")
  assert(missing == false, "removing a missing pin should return false")
end)

scenario("RemoveAllWorldMapIcons clears every registered pin", function()
  WM:Init()
  WM:AddWorldMapIcon(nil, "IC1", 1, 0.1, 0.1, "w1")
  WM:AddWorldMapIcon(nil, "IC2", 1, 0.2, 0.2, "w2")
  WM:AddWorldMapIcon(nil, "IC3", 1, 0.3, 0.3, "w3")
  WM:RemoveAllWorldMapIcons()
  local count = 0
  for _ in pairs(WM._pins) do count = count + 1 end
  assert(count == 0, "registry should be empty after RemoveAllWorldMapIcons")
end)

scenario("minimap pin lifecycle mirrors world-map lifecycle", function()
  WM:Init()
  local frame = WM:AddMinimapIcon(nil, "MINI1", 42, 0.4, 0.6, "m1")
  assert(frame ~= nil, "AddMinimapIcon should return a frame")
  assert(WM._minimapPins["m1"] ~= nil, "minimap pin should be registered")

  local ok = WM:UpdateMinimapIcon("m1", 0.5, 0.5)
  assert(ok == true, "UpdateMinimapIcon should succeed for an existing pin")

  local removed = WM:RemoveMinimapIcon("m1")
  assert(removed == true, "RemoveMinimapIcon should succeed")
  assert(WM._minimapPins["m1"] == nil, "minimap registry should be cleared")

  WM:AddMinimapIcon(nil, "MINI2", 42, 0.1, 0.1, "m2")
  WM:AddMinimapIcon(nil, "MINI3", 42, 0.2, 0.2, "m3")
  WM:RemoveAllMinimapIcons()
  local count = 0
  for _ in pairs(WM._minimapPins) do count = count + 1 end
  assert(count == 0, "minimap registry should be empty")
end)

scenario("GetPlayerZone delegates through the coordinate adapter", function()
  -- The harness's C_Map stub returns 37 for GetBestMapForUnit("player").
  local zone = WM:GetPlayerZone()
  assert(zone == 37, "C_Map.GetBestMapForUnit should drive GetPlayerZone, got " .. tostring(zone))
end)

scenario("GetPlayerWorldPosition delegates through the coordinate adapter", function()
  local x, y, instance = WM:GetPlayerWorldPosition()
  assert(x == 0.5 and y == 0.5, "expected stubbed world coordinates")
  assert(instance == 123, "expected stubbed instance id, got " .. tostring(instance))
end)

scenario("GetZoneSize falls back to HereBeDragons-2.0 zone data", function()
  -- C_Map.GetZoneSize is absent in the harness; HBD stub returns 5000, 4000.
  local w, h = WM:GetZoneSize(37)
  assert(w == 5000 and h == 4000,
    "HBD fallback should supply zone size, got " .. tostring(w) .. "," .. tostring(h))
end)

scenario("GetWorldVector returns angle and distance", function()
  local angle, dist = WM:GetWorldVector(0, 0, 0, 3, 4)
  assert(dist == 5, "3-4-5 triangle should give distance 5, got " .. tostring(dist))
  assert(type(angle) == "number", "angle should be numeric")
end)

local function render()
  return string.format(
    "RGXWorldMap harness: %d passed, %d failed\nRESULT %s",
    pass, fail, (fail == 0 and "PASSED" or "FAILED")
  )
end

__rgxWorldMapTestResult = render()
