-- Runtime scenarios for the honeycomb ColorPicker. Executed by
-- tools/ci/colorpicker-runtime-check.mjs, which has already installed the
-- widget mock and loaded library/colors/colorpicker.lua as `CP`.
--
-- Geometry the mock cannot provide (frame left/bottom) is assigned directly,
-- mirroring how control-interaction-check treats mouse delivery as an engine
-- seam. Everything else -- cell identity, hue/saturation mapping, storage
-- writes, callback firing, hex validation, class palette -- is real behavior.

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

-- Locates the honeycomb controller frame the picker built under `owner`
-- (embedded instances are otherwise opaque locals).
local function spectrumFrameOf(owner)
  for _, frame in ipairs(CREATED) do
    if frame.parent == owner and frame.children and #frame.children >= 60 then
      return frame
    end
  end
  return nil
end

local function cellInDirection(cells, targetH, minS)
  local best, bestDist
  for _, cell in ipairs(cells) do
    if cell.s >= minS then
      local dh = math.abs(cell.h - targetH)
      if dh > 0.5 then dh = 1 - dh end
      if not bestDist or dh < bestDist then best, bestDist = cell, dh end
    end
  end
  return best, bestDist
end

local f = CP:GetFrame()

scenario("dialog builds a 61-cell honeycomb with valid hue/saturation", function()
  assert(f.spectrum, "no honeycomb spectrum")
  assert(#f.spectrum.cells == 61, "expected 61 cells, got " .. #f.spectrum.cells)
  for _, cell in ipairs(f.spectrum.cells) do
    assert(cell.h >= 0 and cell.h < 1, "hue out of range: " .. tostring(cell.h))
    assert(cell.s >= 0 and cell.s <= 1, "saturation out of range: " .. tostring(cell.s))
    assert(cell.tex.texture == "Interface\\AddOns\\RGX-Framework\\media\\hexmask.tga",
      "cell is not using the hex fill asset")
    assert(cell.tex.width == cell.tex.height and cell.tex.width == 2 * 14,
      "cell quad is not the 2*size square padded hex")
    local pt = cell.tex.points[1]
    assert(pt and pt[1] == "CENTER" and pt[4] == cell.x and pt[5] == cell.y,
      "cell texture is not centred on its cell")
  end
  assert(f.spectrum.marker.texture == "Interface\\AddOns\\RGX-Framework\\media\\hexring.tga",
    "selection marker is not using the hex ring asset")
  assert(f.spectrum.marker.width == f.spectrum.marker.height,
    "ring marker quad is not square")
  -- Place the marker, then confirm it is centred on the chosen cell.
  f.spectrum:SetValue(0.333, 1, 1)
  local mpt = f.spectrum.marker.points[1]
  assert(mpt and mpt[1] == "CENTER" and mpt[4] == f.spectrum.selected.x and mpt[5] == f.spectrum.selected.y,
    "marker is not centred on the selected cell")
  local centre
  for _, cell in ipairs(f.spectrum.cells) do
    if cell.q == 0 and cell.r == 0 then centre = cell end
  end
  assert(centre and centre.s == 0, "centre cell must be the desaturated white")
end)

scenario("hue orientation covers the documented anchors", function()
  -- cyan top-left ~195, blue top ~240, purple right ~330, red bottom-right
  -- ~15, yellow bottom ~60, green left ~150 (all in 0-360 degrees).
  local anchors = { 195, 240, 330, 15, 60, 150 }
  for _, deg in ipairs(anchors) do
    local _, dist = cellInDirection(f.spectrum.cells, (deg % 360) / 360, 0.7)
    assert(dist and dist <= 0.05, "no cell near hue " .. deg .. " (closest " .. tostring(dist) .. ")")
  end
end)

scenario("Show restores the incoming color without firing the callback", function()
  local calls = 0
  CP:Show({ r = 0.2, g = 0.4, b = 0.6 }, function() calls = calls + 1 end)
  assert(calls == 0, "callback fired during Show")
  assert(math.abs(CP.current.r - 0.2) < 1e-6 and math.abs(CP.current.g - 0.4) < 1e-6
    and math.abs(CP.current.b - 0.6) < 1e-6, "Show did not restore the passed color")
  assert(f.spectrum.selected, "no selected cell after Show")
end)

scenario("OK fires the callback once; Cancel does not fire it", function()
  local calls = 0
  CP:Show({ r = 1, g = 0, b = 0 }, function() calls = calls + 1 end)
  CP:OK()
  assert(calls == 1, "OK did not fire exactly once")
  assert(not f:IsShown(), "OK did not hide the dialog")
  CP:Show({ r = 0, g = 1, b = 0 }, function() calls = calls + 1 end)
  CP:Cancel()
  assert(calls == 1, "Cancel fired the callback")
  assert(not f:IsShown(), "Cancel did not hide the dialog")
end)

scenario("clicking a honeycomb cell selects that cell's hue and saturation", function()
  CP:Show({ r = 1, g = 1, b = 1 }, function() end)
  local grid = f.spectrum.frame
  grid.left, grid.bottom = 100, 200
  local target = f.spectrum.cells[10]
  cursorX, cursorY = grid.left + target.x, grid.bottom + target.y
  grid.scripts.OnMouseDown(grid, "LeftButton")
  grid.scripts.OnMouseUp(grid)
  assert(math.abs(CP.current.h - target.h) < 1e-9, "clicked hue mismatch")
  assert(math.abs(CP.current.s - target.s) < 1e-9, "clicked saturation mismatch")
end)

scenario("brightness bar dims to black but retains hue and saturation", function()
  CP:Show({ r = 1, g = 0, b = 0 }, function() end)
  local bar = f.valueBar.frame
  bar.left, bar.bottom = 500, 300
  cursorX, cursorY = bar.left + 5, bar.bottom
  bar.scripts.OnMouseDown(bar, "LeftButton")
  bar.scripts.OnMouseUp(bar)
  assert(CP.current.v == 0, "bottom of the bar must be value 0, got " .. tostring(CP.current.v))
  assert(CP.current.h == 0 and CP.current.s == 1, "hue/saturation lost at black")

  -- The pure red hue must survive: changing hue while black keeps value 0.
  local grid = f.spectrum.frame
  grid.left, grid.bottom = 100, 200
  local target
  for _, cell in ipairs(f.spectrum.cells) do
    if cell.s == 1 and math.abs(cell.h - 0.3333) < 0.05 then target = cell end
  end
  assert(target, "no green-ring cell found")
  cursorX, cursorY = grid.left + target.x, grid.bottom + target.y
  grid.scripts.OnMouseDown(grid, "LeftButton")
  grid.scripts.OnMouseUp(grid)
  assert(CP.current.v == 0, "hue change reset brightness to " .. tostring(CP.current.v))

  -- Top of the bar restores full value.
  cursorX, cursorY = bar.left + 5, bar.bottom + bar.height
  bar.scripts.OnMouseDown(bar, "LeftButton")
  assert(CP.current.v == 1, "top of the bar must be value 1")
end)

scenario("invalid hex is ignored and valid hex applies without recursing", function()
  CP:Show({ r = 0, g = 0, b = 0 }, function() end)
  local before = { CP.current.r, CP.current.g, CP.current.b }
  f.hexInput.text = "GGGGGG"
  f.hexInput.scripts.OnTextChanged(f.hexInput)
  assert(CP.current.r == before[1] and CP.current.g == before[2] and CP.current.b == before[3],
    "invalid hex mutated the color")

  local updates, original = 0, CP.UpdateUI
  CP.UpdateUI = function(self, ...)
    updates = updates + 1
    return original(self, ...)
  end
  f.hexInput.text = "00FF00"
  f.hexInput.scripts.OnTextChanged(f.hexInput)
  CP.UpdateUI = original
  assert(math.abs(CP.current.g - 1) < 1e-6 and math.abs(CP.current.r) < 1e-6,
    "valid hex did not apply")
  assert(updates <= 2, "hex update recursed " .. updates .. " times")

  -- SetText itself must stay guarded (mock fires OnTextChanged like the client).
  f.hexInput:SetText("0000FF")
  assert(math.abs(CP.current.b - 1) < 1e-6 and math.abs(CP.current.r) < 1e-6,
    "guarded SetText did not apply the new color")
end)

scenario("HexToRGB validates instead of clamping garbage to black", function()
  local r, g, b = CP:HexToRGB("#0f0")
  assert(math.abs(r) < 1e-6 and math.abs(g - 1) < 1e-6 and math.abs(b) < 1e-6, "3-digit hex failed")
  assert(CP:HexToRGB("GGGGGG") == nil, "garbage accepted")
  assert(CP:HexToRGB("12345") == nil, "short hex accepted")
  assert(CP:HexToRGB(nil) == nil, "nil accepted")
  assert(math.abs(select(1, CP:HexToRGB("ffffff")) - 1) < 1e-6, "white failed")
end)

scenario("embedded pickers are multi-instance and silent while building", function()
  local storeA, storeB = {}, {}
  local cbA, cbB = 0, 0
  local a = CP:CreateEmbedded(UIParent, {
    key = "color", storage = storeA, default = { r = 0, g = 0, b = 1 }, width = 220,
    onChange = function() cbA = cbA + 1 end,
  })
  local b = CP:CreateEmbedded(UIParent, {
    key = "color", storage = storeB, default = { r = 1, g = 0, b = 0 }, width = 220,
    onChange = function() cbB = cbB + 1 end,
  })
  assert(storeA.color == nil and storeB.color == nil, "build wrote to storage")
  assert(cbA == 0 and cbB == 0, "build fired onChange")
  local ar, ag, ab = a:GetColor()
  assert(math.abs(ab - 1) < 1e-6 and math.abs(ar) < 1e-6, "instance A did not read its default")
  local br, bg2, bb = b:GetColor()
  assert(math.abs(br - 1) < 1e-6 and math.abs(bb) < 1e-6, "instance B did not read its default")

  -- Mutating instance A must not disturb instance B (separate storage,
  -- separate callbacks, separate selection). The honeycomb controller is an
  -- opaque local, so drive the public setter that the controller calls.
  assert(spectrumFrameOf(a), "could not locate embedded honeycomb")
  a:SetColor(0, 1, 0)
  assert(cbA == 1, "SetColor did not fire onChange once")
  assert(storeA.color and math.abs(storeA.color.g - 1) < 1e-6, "SetColor did not write storage")
  assert(storeB.color == nil and cbB == 0, "instance B was mutated by instance A")
  local ar2, ag2, ab2 = a:GetColor()
  assert(math.abs(ag2 - 1) < 1e-6 and math.abs(ar2) < 1e-6, "SetColor did not update instance A color")
end)

scenario("embedded hex entry validates and does not recurse", function()
  local store = {}
  local calls = 0
  local w = CP:CreateEmbedded(UIParent, {
    key = "hex", storage = store, default = { r = 1, g = 1, b = 1 }, width = 220,
    onChange = function() calls = calls + 1 end,
  })
  -- Find the embedded hex EditBox (the only EditBox child with 6 max letters).
  local hex
  for _, frame in ipairs(CREATED) do
    if frame.parent == w and frame.kind == "EditBox" then hex = frame end
  end
  assert(hex, "embedded hex box not found")
  hex.text = "NOTHEX"
  hex.scripts.OnTextChanged(hex)
  local r0 = select(1, w:GetColor())
  assert(r0 == 1 and calls == 0, "invalid embedded hex changed the color")
  hex.text = "FF0000"
  hex.scripts.OnTextChanged(hex)
  local r, g, b = w:GetColor()
  assert(math.abs(r - 1) < 1e-6 and math.abs(g) < 1e-6 and math.abs(b) < 1e-6, "embedded hex failed")
  assert(calls == 1, "embedded hex fired onChange " .. calls .. " times")
end)

scenario("class row renders live client colors inside its declared width", function()
  local sw = f.classRow.swatches
  assert(#sw == 13, "expected 13 playable class swatches, got " .. #sw)
  for _, s in ipairs(sw) do
    assert(s.tex.texture == "Interface\\AddOns\\RGX-Framework\\media\\hexmask.tga",
      "class swatch is not using the hex fill asset")
    assert(s.ring.texture == "Interface\\AddOns\\RGX-Framework\\media\\hexring.tga",
      "class swatch has no ring asset")
  end
  -- The canonical first swatch is Warrior; compare against the mock client value.
  local warrior = RAID_CLASS_COLORS.WARRIOR
  assert(math.abs(sw[1].r - warrior.r) < 1e-6 and math.abs(sw[1].g - warrior.g) < 1e-6,
    "first swatch is not the live Warrior color")
  local maxW = f.classRow.frame.width
  local rowH = f.classRow.height
  for _, s in ipairs(sw) do
    local p = s.points[1]
    assert(p[1] == "TOPLEFT", "swatch not anchored TOPLEFT")
    local xoff, yoff = p[4], p[5]
    -- Whole rectangle, not just the top-left anchor: right edge must stay
    -- inside the declared width and the bottom edge inside the declared height.
    assert(xoff >= -0.5 and xoff + s.width <= maxW + 0.5,
      "swatch rectangle exceeds content width: " .. tostring(xoff + s.width) .. " > " .. tostring(maxW))
    assert(yoff <= 0.5 and yoff - s.height >= -(rowH + 0.5),
      "swatch rectangle overflows row height: " .. tostring(yoff - s.height) .. " < " .. tostring(-rowH))
  end
  -- All 13 classes fit the 260px content width on a single line.
  for _, s in ipairs(sw) do
    assert(s.points[1][5] == 0, "class swatch wrapped to a second line")
  end
end)

scenario("class row hides itself when the client palette is absent", function()
  -- The row reads RAID_CLASS_COLORS at build time; a second, isolated picker
  -- module instance must survive the palette being nil.
  local saved = RAID_CLASS_COLORS
  RAID_CLASS_COLORS = nil
  local w = CP:CreateEmbedded(UIParent, { width = 220, default = { r = 1, g = 0, b = 0 } })
  RAID_CLASS_COLORS = saved
  assert(w, "embedded picker failed without RAID_CLASS_COLORS")
end)

scenario("class selection clears so a stale hover ring cannot stick", function()
  CP:Show({ r = 1, g = 1, b = 1 }, function() end)
  local row = f.classRow
  local warrior = row.swatches[1]
  row:SetSelected(warrior.r, warrior.g, warrior.b)
  assert(row.selected ~= nil, "class selection was not recorded")
  -- Choosing a non-class color must clear the selection, not merely move it.
  row:SetSelected(0.123, 0.456, 0.789)
  assert(row.selected == nil, "SetSelected left a stale selection behind")
  -- Hover enter/leave of the formerly selected swatch must hide its ring.
  warrior.scripts.OnEnter(warrior)
  assert(warrior.ring.shown, "hover did not show the ring")
  warrior.scripts.OnLeave(warrior)
  assert(not warrior.ring.shown, "stale hover ring stayed visible after leave")
end)

scenario("brightness gradient reflects saturation, not always pure hue", function()
  -- White: saturation 0, so the top of the bar must be white, not red.
  CP:Show({ r = 1, g = 1, b = 1 }, function() end)
  local top = f.valueBar.bg.gradient[3]
  assert(top.r > 0.999 and top.g > 0.999 and top.b > 0.999,
    "white selection showed a saturated gradient")
  -- Pastel red: HSV(0, 0.5, 1) => (1, 0.5, 0.5) at the top of the bar.
  CP:Show({ r = 1, g = 0.5, b = 0.5 }, function() end)
  top = f.valueBar.bg.gradient[3]
  assert(math.abs(top.r - 1) < 1e-6 and math.abs(top.g - 0.5) < 1e-6 and math.abs(top.b - 0.5) < 1e-6,
    "pastel selection showed the wrong gradient endpoint")
end)

scenario("spectrum keeps full-value colour at brightness zero", function()
  CP:Show({ r = 1, g = 0, b = 0 }, function() end)
  local bar = f.valueBar.frame
  bar.left, bar.bottom = 500, 300
  cursorX, cursorY = bar.left + 5, bar.bottom
  bar.scripts.OnMouseDown(bar, "LeftButton")
  bar.scripts.OnMouseUp(bar)
  assert(CP.current.v == 0, "value did not reach 0")
  -- Every coloured cell must remain bright (full value) so the palette stays
  -- readable; only the bar handle / preview should reflect v = 0.
  local coloured = 0
  for _, cell in ipairs(f.spectrum.cells) do
    if cell.s > 0 then
      coloured = coloured + 1
      local r, g, b = cell.tex:GetVertexColor()
      assert(math.max(r, g, b) > 0.5, "cell darkened with brightness: " .. tostring(r) .. "," .. tostring(g) .. "," .. tostring(b))
    end
  end
  assert(coloured > 0, "no coloured cells to check")
end)

scenario("grayscale selections mark the neutral centre cell", function()
  for _, grey in ipairs({ { r = 1, g = 1, b = 1 }, { r = 0.5, g = 0.5, b = 0.5 }, { r = 0, g = 0, b = 0 } }) do
    CP:Show(grey, function() end)
    local sel = f.spectrum.selected
    assert(sel and sel.q == 0 and sel.r == 0,
      "grayscale did not select the centre cell (q=" .. tostring(sel and sel.q) .. ")")
  end
end)

scenario("embedded hex typing does not prematurely expand six-digit input", function()
  local store, calls = {}, 0
  local w = CP:CreateEmbedded(UIParent, {
    key = "hex", storage = store, default = { r = 1, g = 1, b = 1 }, width = 220,
    onChange = function() calls = calls + 1 end,
  })
  local hex
  for _, frame in ipairs(CREATED) do
    if frame.parent == w and frame.kind == "EditBox" then hex = frame end
  end
  assert(hex, "embedded hex box not found")
  for _, text in ipairs({ "F", "FF", "FF0", "FF00", "FF000" }) do
    hex.text = text
    hex.scripts.OnTextChanged(hex)
    assert(hex.text == text, "hex box rewrote '" .. text .. "' to '" .. tostring(hex.text) .. "'")
    local r, _, b = w:GetColor()
    assert(r == 1 and b == 1, "color changed mid-type at '" .. text .. "'")
    assert(calls == 0, "callback fired mid-type at '" .. text .. "'")
  end
  hex.text = "FF0000"
  hex.scripts.OnTextChanged(hex)
  local r, g, b = w:GetColor()
  assert(math.abs(r - 1) < 1e-6 and math.abs(g) < 1e-6 and math.abs(b) < 1e-6, "six-digit hex failed")
  assert(calls == 1, "six-digit hex fired onChange " .. calls .. " times")
end)

scenario("embedded Enter commits 3-digit shorthand once and dedupes repeats", function()
  local store, calls = {}, 0
  local w = CP:CreateEmbedded(UIParent, {
    key = "hex", storage = store, default = { r = 1, g = 1, b = 1 }, width = 220,
    onChange = function() calls = calls + 1 end,
  })
  local hex
  for _, frame in ipairs(CREATED) do
    if frame.parent == w and frame.kind == "EditBox" then hex = frame end
  end
  assert(hex, "embedded hex box not found")
  hex.text = "0f0"
  hex.scripts.OnTextChanged(hex)
  assert(calls == 0, "3-digit shorthand committed on change instead of Enter")
  hex.scripts.OnEnterPressed(hex)
  local r, g, b = w:GetColor()
  assert(math.abs(r) < 1e-6 and math.abs(g - 1) < 1e-6 and math.abs(b) < 1e-6, "shorthand Enter failed")
  assert(calls == 1, "shorthand Enter fired " .. calls .. " times")
  hex.scripts.OnEnterPressed(hex)
  assert(calls == 1, "duplicate Enter re-fired onChange")
end)

scenario("embedded picker re-projects storage on Refresh without writing or firing", function()
  local store, calls = {}, 0
  local w = CP:CreateEmbedded(UIParent, {
    key = "color", storage = store, default = { r = 1, g = 1, b = 1 }, width = 220,
    onChange = function() calls = calls + 1 end,
  })
  w:SetColor(1, 0, 0)
  assert(calls == 1, "SetColor did not fire onChange once")
  assert(store.color and math.abs(store.color.r - 1) < 1e-6, "SetColor did not persist")
  -- A peer writes storage directly; a silent re-projection must adopt that
  -- value without writing it back or firing a callback.
  store.color = { r = 0, g = 1, b = 0 }
  w:Refresh()
  local r, g, b = w:GetColor()
  assert(math.abs(g - 1) < 1e-6 and math.abs(r) < 1e-6, "Refresh did not re-read storage")
  assert(calls == 1, "Refresh fired onChange")
  assert(store.color and math.abs(store.color.g - 1) < 1e-6, "Refresh rewrote storage")
end)

scenario("embedded OnShow re-projects storage written by a peer", function()
  local store = { color = { r = 1, g = 1, b = 1 } }
  local w = CP:CreateEmbedded(UIParent, {
    key = "color", storage = store, default = { r = 1, g = 1, b = 1 }, width = 220,
  })
  store.color = { r = 0, g = 0, b = 1 }
  w.scripts.OnShow(w)
  local r, _, b = w:GetColor()
  assert(math.abs(b - 1) < 1e-6 and math.abs(r) < 1e-6, "OnShow did not re-read storage")
end)

scenario("Show opts collapse RGB and presets and shrink the panel", function()
  CP:Show({ r = 0, g = 0, b = 1 }, function() end, { rgb = false, presets = false })
  assert(not f.rgbRow:IsShown(), "rgb row stayed visible")
  for _, el in ipairs(f.rgbGroup) do assert(not el:IsShown(), "rgb element stayed visible") end
  for _, el in ipairs(f.presetsGroup) do assert(not el:IsShown(), "preset element stayed visible") end
  -- Visible sections chain onto the previous visible one; the centred
  -- OK/Cancel pair sits at a panel-absolute position below the content.
  local pt = f.previewRing.points[1]
  assert(pt and pt[1] == "TOPLEFT" and pt[2] == f.classRow.frame and pt[4] == 0 and pt[5] == -14,
    "preview did not re-anchor under the class row")
  local okPt = f.okBtn.points[1]
  local okY = -(46 + f.spectrum.gridH + f.sections[1].flow + f.sections[2].flow + 16)
  assert(okPt and okPt[1] == "TOPLEFT" and okPt[2] == f and okPt[4] == 155 and okPt[5] == okY,
    "OK button is not centred below the content")
  -- RGB flow (14 + 46) and presets flow no longer matter: the height is
  -- derived from the visible content plus buttons and one bottom margin.
  local expected = 46 + f.spectrum.gridH + f.sections[1].flow + f.sections[2].flow + 16 + 28 + 20
  assert(f.height == expected, "panel height is not content-derived: " .. tostring(f.height))
  -- First visible section aligns back to the 20px content margin, not to the
  -- centred spectrum's left edge (36).
  local cpt = f.classLabel.points[1]
  assert(cpt and cpt[4] == 20 - 36, "class label did not align to the content margin")
end)

scenario("Show without opts restores every section and the full panel", function()
  CP:Show({ r = 1, g = 1, b = 1 }, function() end)
  for _, el in ipairs(f.rgbGroup) do assert(el:IsShown(), "rgb element did not return") end
  for _, el in ipairs(f.presetsGroup) do assert(el:IsShown(), "preset element did not return") end
  local pt = f.presetsLabel.points[1]
  assert(pt and pt[1] == "TOPLEFT" and pt[2] == f.rgbRow and pt[4] == 0 and pt[5] == -14,
    "presets did not re-anchor under RGB")
  local okPt = f.okBtn.points[1]
  local okY = -(46 + f.spectrum.gridH
    + f.sections[1].flow + f.sections[2].flow + f.sections[3].flow + f.sections[4].flow + 16)
  assert(okPt and okPt[1] == "TOPLEFT" and okPt[2] == f and okPt[4] == 155 and okPt[5] == okY,
    "OK button is not centred below the full content")
  local full = 46 + f.spectrum.gridH
    + f.sections[1].flow + f.sections[2].flow + f.sections[3].flow + f.sections[4].flow
    + 16 + 28 + 20
  assert(f.height == full, "full panel height is not content-derived: " .. tostring(f.height))
end)

scenario("spectrum and brightness bar are centred as one group", function()
  local spt = f.spectrum.frame.points[1]
  local centred = (300 - (f.spectrum.gridW + 14 + 18)) / 2
  assert(spt and spt[4] == centred and centred == 36,
    "spectrum is not centred: " .. tostring(spt and spt[4]))
end)

scenario("classes=false moves the preview up to the spectrum", function()
  CP:Show({ r = 1, g = 0, b = 0 }, function() end, { classes = false })
  for _, el in ipairs(f.classGroup) do assert(not el:IsShown(), "class element stayed visible") end
  local pt = f.previewRing.points[1]
  assert(pt and pt[1] == "TOPLEFT" and pt[2] == f.spectrum.frame and pt[4] == 20 - 36 and pt[5] == -14,
    "preview did not align to the content margin under the spectrum")
  local noClass = 46 + f.spectrum.gridH + f.sections[2].flow + f.sections[3].flow + f.sections[4].flow + 16 + 28 + 20
  assert(f.height == noClass, "panel height ignored the class flow: " .. tostring(f.height))
end)

scenario("preview=false chains RGB and buttons onto the class row", function()
  CP:Show({ r = 1, g = 0, b = 0 }, function() end, { preview = false, presets = false })
  for _, el in ipairs(f.previewGroup) do assert(not el:IsShown(), "preview element stayed visible") end
  local pt = f.rgbRow.points[1]
  assert(pt and pt[1] == "TOPLEFT" and pt[2] == f.classRow.frame and pt[5] == -14,
    "RGB row did not re-anchor under the class row")
  local okPt = f.okBtn.points[1]
  local okY = -(46 + f.spectrum.gridH + f.sections[1].flow + f.sections[3].flow + 16)
  assert(okPt and okPt[4] == 155 and okPt[5] == okY,
    "OK button is not centred below the chained content")
end)

scenario("Show accepts a dialog scale and resets it", function()
  CP:Show({ r = 1, g = 0, b = 0 }, function() end, { scale = 0.85 })
  assert(f.dialogScale == 0.85, "dialog scale was not applied: " .. tostring(f.dialogScale))
  CP:Show({ r = 1, g = 0, b = 0 }, function() end)
  assert(f.dialogScale == 1, "dialog scale did not reset: " .. tostring(f.dialogScale))
  CP:Show({ r = 1, g = 0, b = 0 }, function() end, { scale = 0 })
  assert(f.dialogScale == 1, "non-positive scale was not rejected")
  CP:Show({ r = 1, g = 0, b = 0 }, function() end, { scale = "big" })
  assert(f.dialogScale == 1, "non-numeric scale was not rejected")
end)

scenario("Cancel is safe before first open and ESC can close the dialog", function()
  local saved = CP.frame
  CP.frame = nil
  CP:Cancel()
  UISpecialFrames = {}
  CP.frame = nil
  CP:GetFrame()
  local found = false
  for _, name in ipairs(UISpecialFrames) do
    if name == "RGXColorPicker" then found = true end
  end
  assert(found, "dialog did not join UISpecialFrames")
  CP.frame = saved
end)

scenario("a short class row centres instead of hugging the left margin", function()
  local saved = RAID_CLASS_COLORS
  RAID_CLASS_COLORS = {}
  for _, name in ipairs({ "WARRIOR", "PALADIN", "HUNTER", "ROGUE", "PRIEST",
      "DEATHKNIGHT", "SHAMAN", "MAGE", "WARLOCK", "MONK" }) do
    RAID_CLASS_COLORS[name] = saved[name]
  end
  CP.frame = nil
  local slim = CP:GetFrame()
  assert(#slim.classRow.swatches == 10, "expected 10 class swatches, got " .. #slim.classRow.swatches)
  local first = slim.classRow.swatches[1].points[1]
  assert(first and first[4] == (260 - 10 * 20) / 2,
    "short class row is not centred: " .. tostring(first and first[4]))
  local last = slim.classRow.swatches[10]
  local lastPt = last.points[1]
  assert(lastPt[4] + last.width <= 260.5, "centred row overhangs the content width")
  RAID_CLASS_COLORS = saved
  CP.frame = nil
  f = CP:GetFrame()
end)

scenario("commitOnPick selects, fires, and closes with no buttons", function()
  local calls = 0
  CP:Show({ r = 1, g = 0, b = 0 }, function() calls = calls + 1 end,
    { presets = false, rgb = false, preview = false, commitOnPick = true })
  assert(not f.okBtn:IsShown() and not f.cancelBtn:IsShown(), "buttons stayed visible")
  local expected = 46 + f.spectrum.gridH + f.sections[1].flow + 20
  assert(f.height == expected, "buttonless height is wrong: " .. tostring(f.height))
  f.spectrum.onPick(0.5, 0.8)
  assert(calls == 1, "pick did not commit the callback")
  assert(not f:IsShown(), "dialog did not close on pick")
  CP:Show({ r = 1, g = 0, b = 0 }, function() end)
  assert(f.okBtn:IsShown() and f.cancelBtn:IsShown(), "buttons did not return")
end)

scenario("Show accepts a brand border and restores the design border", function()
  CP:Show({ r = 1, g = 0, b = 0 }, function() end, { border = { 0.345, 0.745, 0.506 } })
  local bc = f.borderColor
  assert(bc and math.abs(bc[1] - 0.345) < 1e-6 and math.abs(bc[2] - 0.745) < 1e-6
    and math.abs(bc[3] - 0.506) < 1e-6, "brand border was not applied")
  CP:Show({ r = 1, g = 0, b = 0 }, function() end, { border = { r = 1, g = 0, b = 0 } })
  bc = f.borderColor
  assert(bc and bc[1] == 1 and bc[2] == 0 and bc[3] == 0, "named brand border was not applied")
  CP:Show({ r = 1, g = 0, b = 0 }, function() end)
  bc = f.borderColor
  assert(bc and bc[1] ~= 0.345, "design border did not return")
end)

print(string.format("COLORPICKER %d passed, %d failed", pass, fail))
if fail > 0 then error(fail .. " colorpicker scenario(s) failed") end
