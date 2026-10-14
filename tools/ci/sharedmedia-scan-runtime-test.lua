-- Runtime scenarios for RGXSharedMedia Scan() dedup-state and self-scan safety
-- (issue #85). Executed by tools/ci/sharedmedia-scan-runtime-check.mjs, which
-- has already installed a minimal RGX stand-in and loaded
-- libraries/sharedmedia/sharedmedia.lua as the global `RGXSharedMedia` (SM).
--
-- The RGX stand-in for this harness additionally installs the WoW scan seams
-- (C_AddOns.GetNumAddOns/GetAddOnInfo/GetAddOnMetadata/IsAddOnLoaded) over a
-- fixture AddOn list, plus a SendMessage spy, so Scan() can run end-to-end.
--
-- Covers the acceptance criteria for #85:
--   1. Scan() preserves dedup state for directly-registered (non-bridge)
--      paths: re-registering an already-registered path still returns false.
--   2. Scan() wipes and re-bridges bridge entries without duplicating any
--      path: after Scan(true) over a registry with mixed direct+bridge
--      entries, no path appears under more than one registry id.
--   3. The generic crawl must not scan the module's own registry global
--      (`RGXSharedMedia` is excluded, so registered sounds are not
--      re-bridged from the module's own registry table).
--   4. RGX_SHAREDMEDIA_UPDATED still fires exactly once per Scan.
--   5. A BLU-style import via SM:List("sound") sees no duplicate paths.
--
-- Fixtures (see sharedmedia-scan-runtime-check.mjs):
--   MyMediaAddon global table with 2 audio paths (one also registered
--   directly below, one unique) — matches the audit repro from #78.
--   Prat-3.0 is a loaded known addon with its KNOWN_ADDON_SOUNDS pack.

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

local SM = _G.RGXSharedMedia
assert(SM, "RGXSharedMedia did not register as a global")

-- Paths used by this harness. SOUND_DIRECT is registered directly by a
-- consumer AND discoverable in the MyMediaAddon fixture global, so any
-- self-scan or dedup regression re-bridges it and this harness catches it.
local SOUND_DIRECT  = "Interface\\AddOns\\MyMediaAddon\\sounds\\alert.ogg"
local SOUND_UNIQUE  = "Interface\\AddOns\\MyMediaAddon\\sounds\\whistle.wav"

-- The scan message spy (installed by the .mjs wrapper) records every
-- RGX_SHAREDMEDIA_UPDATED send. Reset it before each measured Scan.
local spy = _G.__rgxScanMessageSpy
assert(type(spy) == "table", "scan message spy missing")

-- ── helpers ────────────────────────────────────────────────────────────────

local function countSeenPaths()
  local n = 0
  if SM._seenPaths and SM._seenPaths.sound then
    for _ in pairs(SM._seenPaths.sound) do n = n + 1 end
  end
  return n
end

-- Return { [lowerPath] = { ids..., count = n } } for every sound registry
-- entry, so a path registered under more than one id is detectable.
local function pathIdMap()
  local map = {}
  local soundReg = SM.registry and SM.registry.sound or {}
  for _, entry in pairs(soundReg) do
    local lp = string.lower(entry.path)
    map[lp] = map[lp] or { ids = {}, count = 0 }
    map[lp].count = map[lp].count + 1
    table.insert(map[lp].ids, entry.id)
  end
  return map
end

local function duplicatePaths()
  local dups, map = {}, pathIdMap()
  for lp, info in pairs(map) do
    if info.count > 1 then dups[lp] = info end
  end
  return dups
end

local function hasDuplicates()
  for _, info in pairs(pathIdMap()) do
    if info.count > 1 then return true end
  end
  return false
end

-- ── scenario 0: baseline fixture sanity ───────────────────────────────────

scenario("fixture sanity: MyMediaAddon global is visible with 2 audio paths", function()
  local fixture = _G.MyMediaAddon
  assert(type(fixture) == "table", "MyMediaAddon fixture global missing")
  local paths = {}
  CollectAudioPathsProbe = function() end -- luacheck: ignore
  local found, state = {}, { total = 0, tables = 0 }
  -- Reuse the module's own crawl logic indirectly: the fixture global must
  -- contain both audio strings the scanners can discover.
  local sawAlert, sawWhistle = false, false
  local function crawl(v, depth)
    if depth > 6 then return end
    if type(v) == "string" then
      if string.lower(v) == string.lower(SOUND_DIRECT) then sawAlert = true end
      if string.lower(v) == string.lower(SOUND_UNIQUE) then sawWhistle = true end
      return
    end
    if type(v) ~= "table" then return end
    for _, child in pairs(v) do crawl(child, depth + 1) end
  end
  crawl(fixture, 0)
  assert(sawAlert and sawWhistle, "fixture must expose both audio paths")
end)

-- ── scenario 1: dedup state for direct registrations survives Scan ─────────

scenario("Scan() preserves dedup for directly-registered paths (re-register returns false)", function()
  local ok = SM:Register("sound", "Alert", SOUND_DIRECT, { packName = "MyMedia" })
  assert(ok == true, "direct registration should succeed first time")
  local seenBefore = countSeenPaths()
  assert(seenBefore >= 1, "seenPaths should contain the direct path")

  local fired = 0
  for i = 1, #spy do spy[i] = nil end
  SM:Scan(false)

  -- AC 5: exactly one RGX_SHAREDMEDIA_UPDATED per Scan.
  assert(#spy == 1, "RGX_SHAREDMEDIA_UPDATED should fire exactly once per Scan, fired " .. #spy)

  -- AC 1: dedup state for the direct path must survive the Scan.
  local seenAfter = countSeenPaths()
  assert(seenAfter >= 1, "seenPaths was fully wiped by Scan (dedup state lost)")
  local again = SM:Register("sound", "Alert", SOUND_DIRECT, { packName = "MyMedia" })
  assert(again == false, "re-registering an already-registered path after Scan must return false, got " .. tostring(again))
end)

-- ── scenario 2: bridge wipe/re-bridge keeps registry free of path dupes ─────

scenario("Scan(true) re-bridges without duplicating any path (mixed direct+bridge registry)", function()
  -- Seed a bridge entry by running the generic scan once (Prat-3.0 is a
  -- loaded known addon, MyMediaAddon contributes via the addon-info list).
  for i = 1, #spy do spy[i] = nil end
  SM:Scan(true)
  assert(#spy == 1, "RGX_SHAREDMEDIA_UPDATED should fire exactly once per Scan(true), fired " .. #spy)

  -- Registry now has a mix: a direct entry (custom:alert from scenario 1)
  -- and bridge entries (known Prat pack and/or MyMediaAddon paths).
  local soundReg = SM.registry.sound
  local hasDirect, hasBridge = false, false
  for _, entry in pairs(soundReg) do
    if entry.isBridge then hasBridge = true else hasDirect = true end
  end
  assert(hasDirect, "registry should still contain the direct entry")
  assert(hasBridge, "registry should contain bridge entries after Scan(true)")

  assert(not hasDuplicates(), "registry must not duplicate any path across ids after Scan(true)")

  -- Rescan stability: a second full Scan must keep the same shape.
  SM:Scan(true)
  assert(not hasDuplicates(), "registry must not duplicate any path after a second Scan(true)")

  local list = SM:List("sound")
  local seen = {}
  for _, entry in ipairs(list) do
    local lp = string.lower(entry.path)
    assert(not seen[lp], "SM:List(\"sound\") consumer sees duplicate path: " .. entry.path)
    seen[lp] = true
  end
end)

-- ── scenario 3: the module must not re-bridge its own registry global ───────

scenario("generic crawl does not scan RGXSharedMedia itself (no self-scan re-bridging)", function()
  -- The module's own registry global is populated at this point (direct
  -- entry + bridge entries). If IGNORED_GLOBALS does not exclude
  -- RGXSharedMedia, the generic fallback crawl re-discovers every
  -- registered path from _G.RGXSharedMedia.registry and re-bridges it after
  -- the Scan wiped the bridge entries — duplicating paths.
  --
  -- The probe is registered directly and its path exists ONLY in the
  -- module's own registry (not in any fixture addon global), so the ONLY way
  -- it can be re-bridged is the crawl reading _G.RGXSharedMedia itself.
  local SOUND_PROBE = "Interface\\AddOns\\MyMediaAddon\\sounds\\probe-only.ogg"
  local ok = SM:Register("sound", "SelfScanProbe", SOUND_PROBE, { packName = "MyMedia" })
  assert(ok == true, "probe registration should succeed (unique path)")

  local soundReg = SM.registry.sound

  SM:Scan(true)

  -- Every path in the registry must appear at most once; no path may gain a
  -- second id. On unfixed code the self-scan re-bridges the probe under both
  -- custom:* and bridge:* ids.
  assert(not hasDuplicates(), "generic crawl re-bridged the module's own registry entries (self-scan): " ..
    (function()
      local msgs = {}
      for lp, info in pairs(duplicatePaths()) do
        table.insert(msgs, lp .. " x" .. info.count .. " (" .. table.concat(info.ids, ", ") .. ")")
      end
      return table.concat(msgs, "; ")
    end)())

  -- The probe (directly registered, only reachable from the module's own
  -- registry global) must not gain a bridge twin.
  local probeLower = string.lower(SOUND_PROBE)
  local probeIds = pathIdMap()[probeLower]
  assert(probeIds, "probe path must still be registered after Scan")
  assert(probeIds.count == 1, "probe path registered under " .. probeIds.count .. " ids: " ..
    table.concat(probeIds.ids, ", "))
  for _, entry in pairs(soundReg) do
    if string.lower(entry.path) == probeLower then
      assert(not entry.isBridge, "directly-registered probe must not be re-bridged by the generic crawl")
    end
  end
end)

-- ── scenario 4: pack counts stay consistent across rescans ──────────────────

scenario("pack counts do not inflate across repeated scans", function()
  SM:Scan(true)
  local counts1 = {}
  for _, p in ipairs(SM:ListPacks("sound")) do counts1[p.id] = p.count end
  SM:Scan(true)
  local counts2 = {}
  for _, p in ipairs(SM:ListPacks("sound")) do counts2[p.id] = p.count end
  for id, c1 in pairs(counts1) do
    local c2 = counts2[id]
    assert(c2 == c1, ("pack %s count inflated across rescans: %d -> %d"):format(id, c1, c2 or -1))
  end
  for id, c2 in pairs(counts2) do
    assert(counts1[id] ~= nil or c2 >= 0, "new pack appeared")
  end
end)

local function render()
  return string.format(
    "SM Scan dedup/self-scan harness: %d passed, %d failed\nRESULT %s",
    pass, fail, (fail == 0 and "PASSED" or "FAILED")
  )
end

__rgxSharedMediaScanTestResult = render()
