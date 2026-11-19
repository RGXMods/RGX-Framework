-- Runtime scenarios for RGXWorldMap pin registry and coordinate adapter.
-- Executed by tools/ci/worldmap-runtime-check.mjs, which has already installed
-- a minimal RGX stand-in and loaded modules/worldmap/worldmap.lua as the
-- global `RGXWorldMap`.
--
-- Covers the acceptance criteria for the worldmap module:
--   1. module registers as RGXWorldMap global with category "game"
--   2. AddWorldMapIcon stores a pin that UpdateWorldMapIcon and
--      RemoveWorldMapIcon round-trip
--   3. RemoveAllWorldMapIcons clears the whole registry
--   4. AddMinimapIcon / RemoveMinimapIcon / RemoveAllMinimapIcons behave the
--      same for the minimap registry
--   5. coordinate helpers resolve through the native C_Map adapter
--      (world position, zone size, zone<->world conversions)
--   6. absent client capabilities yield nils, never errors
--   7. no phantom API name or external-library seam is referenced

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

-- The check harness pre-stubs CreateFrame, CreateVector2D and C_Map with
-- real API names only; see worldmap-runtime-check.mjs.

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

scenario("GetPlayerWorldPosition resolves native C_Map world coordinates", function()
  -- Player map position (0.5, 0.5) scales to world (500, 400) on continent
  -- 543 through the harness's GetWorldPosFromMapPos stub (dyadic values so
  -- the assert is exact, not a float-tolerance guess).
  local wx, wy, continentID = WM:GetPlayerWorldPosition()
  assert(wx == 500 and wy == 400,
    "expected stubbed world coordinates 500,400, got " .. tostring(wx) .. "," .. tostring(wy))
  assert(continentID == 543, "expected stubbed continent id 543, got " .. tostring(continentID))
end)

scenario("zone and world coordinates round-trip through C_Map", function()
  local wx, wy, continentID = WM:GetWorldCoordinatesFromZone(50, 25, 37)
  assert(wx == 500 and wy == 200 and continentID == 543,
    "zone->world conversion failed: " .. tostring(wx) .. "," .. tostring(wy) .. "," .. tostring(continentID))
  local zx, zy, uiMapID = WM:GetZoneCoordinatesFromWorld(wx, wy, continentID)
  assert(zx == 50 and zy == 25 and uiMapID == 37,
    "world->zone conversion failed: " .. tostring(zx) .. "," .. tostring(zy) .. "," .. tostring(uiMapID))
end)

scenario("GetZoneSize returns native C_Map dimensions", function()
  -- C_Map.GetMapWorldSize ships on Retail/Forever; the stub returns yards.
  local w, h = WM:GetZoneSize(37)
  assert(w == 5000 and h == 4000,
    "C_Map.GetMapWorldSize should drive GetZoneSize, got " .. tostring(w) .. "," .. tostring(h))
end)

scenario("GetWorldVector returns angle and distance", function()
  local angle, dist = WM:GetWorldVector(0, 0, 0, 3, 4)
  assert(dist == 5, "3-4-5 triangle should give distance 5, got " .. tostring(dist))
  assert(type(angle) == "number", "angle should be numeric")
end)

scenario("absent client capabilities yield nils, never errors", function()
  -- Simulate a Classic-era client: C_Map without GetMapWorldSize and
  -- without GetPlayerMapPosition. The adapter must degrade to nils
  -- rather than error or invent data.
  local savedSize = C_Map.GetMapWorldSize
  local savedPos = C_Map.GetPlayerMapPosition
  C_Map.GetMapWorldSize = nil
  WM._coordsAdapter = nil
  local w, h = WM:GetZoneSize(37)
  assert(w == nil and h == nil, "missing GetMapWorldSize must return nils")
  C_Map.GetPlayerMapPosition = nil
  WM._coordsAdapter = nil
  local wx, wy, continentID = WM:GetPlayerWorldPosition()
  assert(wx == nil and wy == nil and continentID == nil,
    "missing GetPlayerMapPosition must return nils, got "
      .. tostring(wx) .. "," .. tostring(wy) .. "," .. tostring(continentID))
  C_Map.GetPlayerMapPosition = savedPos
  C_Map.GetMapWorldSize = savedSize
  WM._coordsAdapter = nil
end)

scenario("Nearest picks the place closest to the player in world yards", function()
  -- Player at world (500, 400); zone (x, y) maps to world (x*10, y*8) on continent 543.
  local far = { name = "Far", zoneID = 37, x = 10, y = 10 }      -- world (100, 80)
  local near = { name = "Near", mapID = 37, x = 55, y = 45 }     -- world (550, 360)
  local best, dist = WM:Nearest({ far, near })
  assert(best == near, "the nearer place should win, got " .. tostring(best and best.name))
  assert(dist and math.abs(dist - math.sqrt(50 * 50 + 40 * 40)) < 1e-9, "distance in world yards, got " .. tostring(dist))
  assert(WM:Nearest({}) == nil, "no places: nil")
end)

scenario("positions handed back as plain tables still convert", function()
  local saved = C_Map.GetWorldPosFromMapPos
  C_Map.GetWorldPosFromMapPos = function(mapID, pos)
    local x, y = pos:GetXY()
    return 543, { x = x * 1000, y = y * 800 }
  end
  WM._coordsAdapter = nil
  local wx, wy = WM:GetWorldCoordinatesFromZone(50, 25, 37)
  assert(wx == 500 and wy == 200, "plain { x, y } positions convert, got " .. tostring(wx) .. "," .. tostring(wy))
  C_Map.GetWorldPosFromMapPos = saved
  WM._coordsAdapter = nil
end)

scenario("SetWaypoint puts the game's own map pin and tracks it", function()
  local set, tracked, cleared
  C_Map.SetUserWaypoint = function(point) set = point return true end
  C_Map.ClearUserWaypoint = function() cleared = true end
  C_Map.CanSetUserWaypointOnMap = function(mapID) return mapID ~= 99 end
  _G.C_SuperTrack = { SetSuperTrackedUserWaypoint = function(v) tracked = v end }
  assert(WM:SetWaypoint(37, 52.6, 55.5) == true, "the pin is set")
  local px = set and set.position and (set.position.GetXY and set.position:GetXY() or set.position.x)
  assert(set and set.uiMapID == 37 and px and math.abs(px - 0.526) < 1e-9, "zone coordinates 0-100 become map fractions")
  assert(tracked == true, "the pin is tracked")
  assert(WM:SetWaypoint(99, 10, 10) == false, "a map the client cannot pin is refused")
  assert(WM:SetWaypoint(37, nil, 10) == false, "missing coordinates are refused")
  WM:ClearWaypoint()
  assert(cleared == true, "ClearWaypoint removes the pin")
  C_Map.SetUserWaypoint, C_Map.ClearUserWaypoint, C_Map.CanSetUserWaypointOnMap, _G.C_SuperTrack = nil, nil, nil, nil
  assert(WM:SetWaypoint(37, 10, 10) == false, "a client without map pins: false, no error")
end)

scenario("waypoints fail closed: capability errors, unknown answers, bad maps and coordinates are refused (#124)", function()
  local calls = 0
  C_Map.SetUserWaypoint = function() calls = calls + 1; return true end
  C_Map.CanSetUserWaypointOnMap = function() error("query failed") end
  assert(WM:CanSetWaypoint(37) == false and WM:SetWaypoint(37, 50, 50) == false, "a capability-query error is not permission")
  C_Map.CanSetUserWaypointOnMap = function() return nil end
  assert(WM:SetWaypoint(37, 50, 50) == false, "an unknown (nil) capability answer is not permission")
  C_Map.CanSetUserWaypointOnMap = function() return false end
  assert(WM:SetWaypoint(37, 50, 50) == false, "a refused map stays refused")
  C_Map.CanSetUserWaypointOnMap = function() return true end
  for _, bad in ipairs({ { -100, 200 }, { 0 / 0, 50 }, { 50, 1 / 0 }, { 101, 50 }, { "50", 50 } }) do
    assert(WM:SetWaypoint(37, bad[1], bad[2]) == false, "invalid coordinates are refused: " .. tostring(bad[1]) .. "," .. tostring(bad[2]))
  end
  for _, badMap in ipairs({ 0, -5, 1.5, "37", 0 / 0 }) do
    assert(WM:SetWaypoint(badMap, 50, 50) == false, "an invalid map id is refused: " .. tostring(badMap))
  end
  assert(calls == 0, "the setter is never reached for refused waypoints (" .. calls .. ")")
  assert(WM:SetWaypoint(37, 0, 100) == true and calls == 1, "the edges 0 and 100 are valid")
  C_Map.CanSetUserWaypointOnMap = nil
  assert(WM:SetWaypoint(37, 50, 50) == false and calls == 1, "a client without the capability query is refused (every client with map pins has it: live 297d7aa, forever 3d8abb1)")
  C_Map.CanSetUserWaypointOnMap = function() return true end
  C_Map.SetUserWaypoint = function() error("not allowed") end
  assert(WM:SetWaypoint(37, 50, 50) == false, "a setter error reports false")
  C_Map.SetUserWaypoint = function() return false end
  assert(WM:SetWaypoint(37, 50, 50) == false, "the client reporting wasSet = false reports false")
  local good = { name = "Good", mapID = 37, x = 55, y = 45 }
  local best = WM:Nearest({ { name = "Bad", mapID = 37, x = 0 / 0, y = 10 }, good })
  assert(best == good, "Nearest skips places with invalid coordinates")
  C_Map.SetUserWaypoint, C_Map.CanSetUserWaypointOnMap = nil, nil
end)

-- Each boundary scenario restores its seams even if an assertion fails.
local function withWaypointClient(fn)
  local savedMap, savedVector = C_Map, CreateVector2D
  local savedPoint, savedTrack, savedAPI = UiMapPoint, C_SuperTrack, RGX.API
  local calls = { query = 0, vector = 0, set = 0, track = 0 }
  RGX.API = { CanAccessValue = function(value) return value ~= nil end }
  C_Map = {
    CanSetUserWaypointOnMap = function()
      calls.query = calls.query + 1
      return true
    end,
    SetUserWaypoint = function(point)
      calls.set = calls.set + 1
      calls.point = point
      return true
    end,
  }
  CreateVector2D = function(x, y)
    calls.vector = calls.vector + 1
    return savedVector(x, y)
  end
  UiMapPoint = nil
  C_SuperTrack = {
    SetSuperTrackedUserWaypoint = function(value)
      calls.track = calls.track + 1
      calls.tracked = value
    end,
  }
  local ok, err = pcall(fn, calls)
  C_Map, CreateVector2D = savedMap, savedVector
  UiMapPoint, C_SuperTrack, RGX.API = savedPoint, savedTrack, savedAPI
  assert(ok, err)
end

scenario("waypoints reject malformed map IDs before querying or constructing", function()
  withWaypointClient(function(calls)
    local invalid = { false, 0, -1, 1.5, "37", {}, 0/0, math.huge, -math.huge }
    assert(WM:CanSetWaypoint(nil) == false and WM:SetWaypoint(nil, 50, 50) == false)
    for _, mapID in ipairs(invalid) do
      assert(WM:CanSetWaypoint(mapID) == false, "invalid map ID must be refused")
      assert(WM:SetWaypoint(mapID, 50, 50) == false, "invalid map ID must not set a pin")
    end
    assert(calls.query == 0 and calls.vector == 0 and calls.set == 0 and calls.track == 0,
      "invalid map IDs must not reach client APIs")
  end)
end)

scenario("waypoints reject non-finite and out-of-range coordinates before client calls", function()
  withWaypointClient(function(calls)
    local invalid = { false, "50", {}, -0.01, 100.01, 0/0, math.huge, -math.huge }
    assert(WM:SetWaypoint(37, nil, 50) == false and WM:SetWaypoint(37, 50, nil) == false)
    for _, value in ipairs(invalid) do
      assert(WM:SetWaypoint(37, value, 50) == false, "invalid x must be refused")
      assert(WM:SetWaypoint(37, 50, value) == false, "invalid y must be refused")
    end
    assert(calls.query == 0 and calls.vector == 0 and calls.set == 0 and calls.track == 0,
      "invalid coordinates must not reach client APIs")
  end)
end)

scenario("waypoints require an explicit successful permission query", function()
  withWaypointClient(function(calls)
    local queries = {
      function() return false end,
      function() return nil end,
      function() return 1 end,
      function() error("permission unavailable") end,
    }
    for _, query in ipairs(queries) do
      C_Map.CanSetUserWaypointOnMap = query
      assert(WM:CanSetWaypoint(37) == false, "unknown or denied permission is not support")
      assert(WM:SetWaypoint(37, 50, 50) == false, "unknown or denied permission must not set a pin")
    end
    C_Map.CanSetUserWaypointOnMap = nil
    assert(WM:CanSetWaypoint(37) == false and WM:SetWaypoint(37, 50, 50) == false,
      "a missing permission API cannot establish support")
    assert(calls.vector == 0 and calls.set == 0 and calls.track == 0,
      "denied permission must not construct, set or track")
  end)
end)

scenario("waypoints reject inaccessible values and failing access predicates", function()
  withWaypointClient(function(calls)
    RGX.API.CanAccessValue = function() return false end
    assert(WM:CanSetWaypoint(37) == false and WM:SetWaypoint(37, 50, 50) == false)
    RGX.API.CanAccessValue = function() error("access unavailable") end
    assert(WM:CanSetWaypoint(37) == false and WM:SetWaypoint(37, 50, 50) == false)
    RGX.API.CanAccessValue = function(value) return value ~= true end
    assert(WM:CanSetWaypoint(37) == false and WM:SetWaypoint(37, 50, 50) == false,
      "an inaccessible permission result must not be used")
    assert(calls.vector == 0 and calls.set == 0 and calls.track == 0,
      "inaccessible values must not reach pin construction or mutation")
  end)
end)

scenario("waypoints accept zone edges and track false leaves tracking alone", function()
  withWaypointClient(function(calls)
    assert(WM:SetWaypoint(37, 0, 100, { track = false }) == true)
    local x, y = calls.point.position:GetXY()
    assert(x == 0 and y == 1 and calls.point.uiMapID == 37, "inclusive edges must convert exactly")
    assert(calls.set == 1 and calls.track == 0, "track false must not call super tracking")
    assert(WM:SetWaypoint(37, 100, 0) == true)
    x, y = calls.point.position:GetXY()
    assert(x == 1 and y == 0 and calls.track == 1 and calls.tracked == true)
  end)
end)

scenario("waypoints honor the native setter result and never track a rejected pin", function()
  withWaypointClient(function(calls)
    for _, setter in ipairs({
      function() return false end,
      function() return nil end,
      function() error("setter unavailable") end,
    }) do
      C_Map.SetUserWaypoint = setter
      assert(WM:SetWaypoint(37, 50, 50) == false, "only a successful setter result establishes a pin")
    end
    assert(calls.track == 0, "rejected pins must never be super tracked")
  end)
end)

scenario("waypoints use the optional native point constructor when present", function()
  withWaypointClient(function(calls)
    local made = { uiMapID = 37, position = CreateVector2D(0.25, 0.75) }
    UiMapPoint = { CreateFromCoordinates = function(mapID, x, y)
      assert(mapID == 37 and x == 0.25 and y == 0.75)
      return made
    end }
    assert(WM:SetWaypoint(37, 25, 75) == true and calls.point == made)
  end)
end)

scenario("waypoints refuse absent or malformed client constructors and setters", function()
  withWaypointClient(function(calls)
    CreateVector2D = true
    assert(WM:CanSetWaypoint(37) == false and WM:SetWaypoint(37, 50, 50) == false)
    CreateVector2D = nil
    assert(WM:CanSetWaypoint(37) == false and WM:SetWaypoint(37, 50, 50) == false)
    C_Map.SetUserWaypoint = nil
    assert(WM:CanSetWaypoint(37) == false and WM:SetWaypoint(37, 50, 50) == false)
    C_Map = nil
    assert(WM:CanSetWaypoint(37) == false and WM:SetWaypoint(37, 50, 50) == false)
    assert(calls.set == 0 and calls.track == 0)
  end)
end)

scenario("no phantom API or external-library seam exists", function()
  assert(C_Map.GetPlayerInfoInWorldMap == nil,
    "phantom C_Map.GetPlayerInfoInWorldMap must never be called")
  assert(_G.LibStub == nil, "the module must not resolve external libraries")
  assert(WM._hbd == nil, "the module must not keep an external-library handle")
end)

local function render()
  return string.format(
    "RGXWorldMap harness: %d passed, %d failed\nRESULT %s",
    pass, fail, (fail == 0 and "PASSED" or "FAILED")
  )
end

__rgxWorldMapTestResult = render()
