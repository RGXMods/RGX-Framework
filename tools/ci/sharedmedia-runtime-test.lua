-- Runtime scenarios for RGXSharedMedia single-entry registry conveniences.
-- Executed by tools/ci/sharedmedia-runtime-check.mjs, which has already installed
-- a minimal RGX stand-in and loaded libraries/sharedmedia/sharedmedia.lua as the
-- global `RGXSharedMedia` (SM).
--
-- Covers the acceptance criteria for the SM:RegisterStatusBar convenience:
--   1. a single registration returns true and is stored under the statusbar type
--      with the expected generated id / pack assignment
--   2. a duplicate path returns false (dedup fails closed)
--   3. RegisterStatusBar is a thin wrapper: it forwards the same arguments to
--      SM:Register("statusbar", ...) and returns the identical boolean shape
--   4. the convenience accepts the same opts shape (packName / packId) used by the
--      generic API, so consumers can group bare textures under a named pack
--
-- Each scenario uses a distinct texture path so the module-level `SM` singleton's
-- path-dedup table does not create cross-scenario coupling.

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

-- Distinct textures per scenario so the shared registry stays independent.
local TEX_SMOOTH  = "Interface\\AddOns\\RGX-Framework\\media\\bar-smooth.tga"
local TEX_GLOSSY  = "Interface\\AddOns\\RGX-Framework\\media\\bar-glossy.tga"
local TEX_MIRROR  = "Interface\\AddOns\\RGX-Framework\\media\\bar-mirror.tga"
local TEX_PACKAGED = "Interface\\AddOns\\RGX-Framework\\media\\bar-packaged.tga"

scenario("SM:RegisterStatusBar returns true for a fresh statusbar entry", function()
  local ok = SM:RegisterStatusBar("Smooth", TEX_SMOOTH)
  assert(ok == true, "expected true for a new statusbar entry")
  assert(SM.registry.statusbar and SM.registry.statusbar["custom:smooth"],
    "entry should be stored under statusbar type with generated id")
  local entry = SM:Fetch("statusbar", "custom:smooth")
  assert(entry, "Fetch should locate the newly registered entry")
  assert(entry.name == "Smooth", "entry name should round-trip")
  assert(entry.path == TEX_SMOOTH, "entry path should round-trip")
  assert(entry.packId == "custom", "default packId should be custom")
end)

scenario("SM:RegisterStatusBar deduplicates on repeat registration", function()
  local first = SM:RegisterStatusBar("Glossy", TEX_GLOSSY)
  assert(first == true, "first registration should succeed")
  local dup = SM:RegisterStatusBar("Glossy", TEX_GLOSSY)
  assert(dup == false, "duplicate path should fail closed")
  local same = SM:RegisterStatusBar("Glossy", TEX_GLOSSY)
  assert(same == false, "third registration of the same path should still fail closed")
end)

scenario("SM:RegisterStatusBar mirrors SM:Register(\"statusbar\",...)", function()
  -- Generic path: the caller invokes the underlying Register directly.
  local direct = SM:Register("statusbar", "Mirror", TEX_MIRROR, { packName = "mirrors" })
  assert(direct == true, "generic Register should accept the statusbar type")
  -- Convenience path: same opts shape, same media type, distinct texture.
  local convenience = SM:RegisterStatusBar("Reflected", TEX_MIRROR .. ".alt", { packName = "mirrors" })
  assert(convenience == true, "RegisterStatusBar should return the same boolean shape")
  local mirrorEntry = SM:Fetch("statusbar", "mirrors:mirror")
  assert(mirrorEntry, "generic path should be reachable via Fetch")
  local reflectedEntry = SM:Fetch("statusbar", "mirrors:reflected")
  assert(reflectedEntry, "convenience path should be reachable via Fetch")
  assert(mirrorEntry.path ~= reflectedEntry.path,
    "the two entries must not collapse into one dedup slot")
end)

scenario("SM:RegisterStatusBar honours packName/packId opts", function()
  local ok = SM:RegisterStatusBar("Packaged", TEX_PACKAGED, { packName = "mybars", packId = "mybars" })
  assert(ok == true, "opts-based registration should succeed")
  local entry = SM:Fetch("statusbar", "mybars:packaged")
  assert(entry, "entry should live under the caller-provided packId")
  assert(entry.packName == "mybars", "packName should be honoured from opts")
  local packs = SM:ListPacks("statusbar")
  local found = false
  for _, p in ipairs(packs) do if p.id == "mybars" and p.name == "mybars" then found = true end end
  assert(found, "named pack should appear in ListPacks")
end)

local function render()
  return string.format(
    "SM:RegisterStatusBar harness: %d passed, %d failed\nRESULT %s",
    pass, fail, (fail == 0 and "PASSED" or "FAILED")
  )
end

__rgxSharedMediaTestResult = render()
