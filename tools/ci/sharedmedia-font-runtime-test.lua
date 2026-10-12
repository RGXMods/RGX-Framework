-- Runtime scenarios for the RGXSharedMedia "font" media type.
-- Executed by tools/ci/sharedmedia-font-runtime-check.mjs, which has already
-- installed a minimal RGX stand-in and loaded
-- library/sharedmedia/sharedmedia.lua as the global `RGXSharedMedia` (SM).
--
-- Covers the acceptance criteria for issue #82:
--   1. SM:Register("font", name, path, opts) works for individual registration
--   2. SM:RegisterFontPack(packName, entries) mirrors RegisterSoundPack /
--      RegisterStatusBarPack for batch registration
--   3. font entries appear in SM:List("font") / SM:Fetch("font", id) /
--      SM:Find("font", name) and List sorts by pack then name
--   4. re-registering the same font path does not create duplicate entries
--      (dedup fails closed)
--   5. SM:RegisterFont is a thin wrapper over SM:Register("font", ...)
--
-- Each scenario uses distinct font paths so the module-level path-dedup
-- table does not create cross-scenario coupling.

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

local FONT_MAIN  = "Interface\\AddOns\\RGX-Framework\\media\\font-main.ttf"
local FONT_ALT   = "Interface\\AddOns\\RGX-Framework\\media\\font-alt.ttf"
local FONT_NARROW = "Interface\\AddOns\\RGX-Framework\\media\\font-narrow.ttf"
local FONT_PACK_A = "Interface\\AddOns\\RGX-Framework\\media\\pack\\font-pack-a.ttf"
local FONT_PACK_B = "Interface\\AddOns\\RGX-Framework\\media\\pack\\font-pack-b.ttf"

scenario("SM:Register(\"font\", ...) registers a single font entry", function()
  local ok = SM:Register("font", "Main", FONT_MAIN)
  assert(ok == true, "expected true for a fresh font entry")
  local entry = SM:Fetch("font", "custom:main")
  assert(entry, "entry should be stored under the font type with generated id")
  assert(entry.name == "Main", "entry name should round-trip")
  assert(entry.path == FONT_MAIN, "entry path should round-trip")
  assert(entry.packId == "custom", "default packId should be custom")
end)

scenario("SM:Register(\"font\", ...) deduplicates on repeat registration", function()
  local first = SM:Register("font", "Alt", FONT_ALT)
  assert(first == true, "first registration should succeed")
  local dup = SM:Register("font", "Alt", FONT_ALT)
  assert(dup == false, "duplicate path should fail closed")
  local again = SM:Register("font", "Alt Renamed", FONT_ALT)
  assert(again == false, "re-registering the same path under another name should still fail closed")
  local list = SM:List("font")
  local seen = 0
  for _, entry in ipairs(list) do
    if entry.path == FONT_ALT then seen = seen + 1 end
  end
  assert(seen == 1, "duplicate path must not create a second entry")
end)

scenario("SM:RegisterFont mirrors SM:Register(\"font\", ...)", function()
  local direct = SM:Register("font", "Narrow", FONT_NARROW, { packName = "narrowpack" })
  assert(direct == true, "generic Register should accept the font type")
  local viaWrapper = SM:RegisterFont("Narrow Wrapped", FONT_NARROW .. ".alt", { packName = "narrowpack" })
  assert(viaWrapper == true, "RegisterFont should return the same boolean shape")
  assert(SM:Fetch("font", "narrowpack:narrow"), "generic path should be reachable via Fetch")
  assert(SM:Fetch("font", "narrowpack:narrow wrapped"), "convenience path should be reachable via Fetch")
end)

scenario("SM:RegisterFontPack registers a batch and returns the count", function()
  local registered = SM:RegisterFontPack("MyFontPack", {
    { name = "Pack A", path = FONT_PACK_A },
    ["Pack B"] = FONT_PACK_B,
  })
  assert(registered == 2, "expected 2 fresh pack entries, got " .. tostring(registered))
  assert(SM:Fetch("font", "myfontpack:pack a"), "pack entry A should be reachable via Fetch")
  assert(SM:Fetch("font", "myfontpack:pack b"), "pack entry B should be reachable via Fetch")
  local packA = SM:Fetch("font", "myfontpack:pack a")
  assert(packA.packName == "MyFontPack", "pack entry should carry the pack name")
  local packs = SM:ListPacks("font")
  local found = false
  for _, p in ipairs(packs) do
    if string.lower(p.id) == "myfontpack" and p.name == "MyFontPack" and p.count == 2 then found = true end
  end
  assert(found, "named font pack should appear in ListPacks with count 2 (got " ..
    tostring(#packs) .. " packs listed for font)")
end)

scenario("SM:Find(\"font\", name) locates by display name and List is sorted", function()
  local found = SM:Find("font", "Main")
  assert(found and found.path == FONT_MAIN, "Find should locate by display name")
  local list = SM:List("font")
  assert(#list >= 5, "expected at least 5 font entries registered so far")
  for i = 2, #list do
    local a, b = list[i - 1], list[i]
    local pa, pb = string.lower(a.packName or ""), string.lower(b.packName or "")
    assert(pa < pb or (pa == pb and string.lower(a.name) <= string.lower(b.name)),
      "List must stay sorted by pack then name")
  end
end)

local function render()
  return string.format(
    "SharedMedia font harness: %d passed, %d failed\nRESULT %s",
    pass, fail, (fail == 0 and "PASSED" or "FAILED")
  )
end

__rgxSharedMediaFontTestResult = render()
