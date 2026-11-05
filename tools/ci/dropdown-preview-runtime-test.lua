-- Runtime scenarios for CreateNestedDropdown's onPreview option.
-- Executed by tools/ci/dropdown-preview-runtime-check.mjs, which first loads
-- libraries/dropdowns/dropdowns.lua into the same Lua state. This file installs a
-- widget mock (frames with points and scripts, list frames with numButtons, recycled
-- rows that keep their children) and the UIDropDownMenu calls the module makes.
-- It proves behaviour, not geometry: sizes and anchors are recorded, never rendered.

local PREVIEW_KEY = "rgxPreviewBtn"
local passed = 0
local failures = {}

local function check(condition, message)
  if not condition then error(message, 2) end
end

local function scenario(name, fn)
  local ok, err = pcall(fn)
  if ok then
    passed = passed + 1
  else
    failures[#failures + 1] = name .. " -> " .. tostring(err)
  end
end

-- Widget mock ----------------------------------------------------------------

local methods = {}

local function newFrame(frameType, name, parent, template)
  local frame = setmetatable({
    __type = frameType,
    __name = name,
    __parent = parent,
    __template = template,
    __shown = true,
  }, {
    __index = function(self, key)
      return methods[key] or rawget(self, key)
    end,
  })
  if name then _G[name] = frame end
  return frame
end

function methods:SetPoint(point, relative, relativePoint, x, y)
  self.__points = self.__points or {}
  self.__points[#self.__points + 1] = { point = point, relative = relative, x = x, y = y }
end
function methods:ClearAllPoints() self.__points = {} end
function methods:SetSize(w, h) self.__w, self.__h = w, h end
function methods:SetWidth(w) self.__w = w end
function methods:SetHeight(h) self.__h = h end
function methods:GetWidth() return self.__w or 0 end
function methods:GetHeight() return self.__h or 0 end
function methods:Show() self.__shown = true end
function methods:Hide() self.__shown = false end
function methods:SetShown(on) self.__shown = on and true or false end
function methods:IsShown() return self.__shown == true end
function methods:GetName() return self.__name end
function methods:SetScript(event, fn)
  self.__scripts = self.__scripts or {}
  self.__scripts[event] = fn
end
function methods:GetScript(event) return (self.__scripts or {})[event] end
function methods:HookScript(event, fn)
  self.__hooks = self.__hooks or {}
  self.__hooks[event] = fn
end
function methods:SetText(text) self.__text = text end
function methods:GetText() return self.__text end
function methods:OverrideText(text) self.__text = text end
function methods:SetAlpha(alpha) self.__alpha = alpha end
function methods:GetFrameLevel() return self.__level or 1 end
function methods:SetFrameLevel(level) self.__level = level end
function methods:GetStringWidth() return 0 end
function methods:CreateFontString() return newFrame("FontString", nil, self) end
function methods:CreateTexture() return newFrame("Texture", nil, self) end
function methods:SetupMenu(generator) self.__generator = generator end
function methods:SetDefaultText() end
function methods:EnableMouse() end
function methods:RegisterForClicks() end
function methods:SetAllPoints() end
function methods:SetBackdrop() end
function methods:SetBackdropColor() end
function methods:SetBackdropBorderColor() end
function methods:SetTextColor() end
function methods:SetJustifyH() end
function methods:SetWordWrap() end
function methods:SetMaxLines() end
function methods:SetTexture() end
function methods:SetColorTexture() end
function methods:SetVertexColor() end
function methods:SetEnabled() end
function methods:SetScale() end
function methods:SetOwner() end
function methods:AddLine() end

UIParent = newFrame("Frame", "UIParent", nil)
GameTooltip = newFrame("Frame", "GameTooltip", UIParent)
UIDROPDOWNMENU_MAXBUTTONS = 32

function CreateFrame(frameType, name, parent, template)
  -- The modern selection template exists only while a scenario turns it on.
  if frameType == "DropdownButton" and not _G.__modernTemplate then
    error("No selection dropdown template available: " .. tostring(template))
  end
  return newFrame(frameType, name, parent, template)
end

-- UIDropDownMenu mock --------------------------------------------------------

function UIDropDownMenu_CreateInfo() return {} end

function UIDropDownMenu_AddButton(info, level)
  local listName = "DropDownList" .. level
  local list = _G[listName] or newFrame("Frame", listName, UIParent)
  list.numButtons = (list.numButtons or 0) + 1
  local rowName = listName .. "Button" .. list.numButtons
  local row = _G[rowName] or newFrame("Button", rowName, list)
  row.__shown = true
  row.__text = info.text
  return row
end

function UIDropDownMenu_Initialize(frame, initializer)
  frame.__initializer = initializer
end
function UIDropDownMenu_SetWidth() end
function UIDropDownMenu_SetText(frame, text) frame.__text = text end
function UIDropDownMenu_EnableDropDown() end
function UIDropDownMenu_DisableDropDown() end
function ToggleDropDownMenu() end
function CloseDropDownMenus() end

-- Opens one menu level the way the client does: the initializer adds rows, then rows
-- past the last one are hidden. Existing row frames are reused, not cleared, so a stale
-- child such as a Play button survives unless the module clears it.
local function openMenu(holder, level, menuList)
  local list = _G["DropDownList" .. level]
  if list then list.numButtons = 0 end
  holder.dropdown.__initializer(holder.dropdown, level, menuList)
  if list then
    for i = (list.numButtons or 0) + 1, UIDROPDOWNMENU_MAXBUTTONS do
      local row = _G[list:GetName() .. "Button" .. i]
      if row then row.__shown = false end
    end
  end
end

local function newHolder(opts)
  return RGXDropdowns:CreateNestedDropdown(newFrame("Frame", nil, UIParent), opts)
end

local function rowAt(level, index)
  return _G["DropDownList" .. level .. "Button" .. index]
end

local function playOn(row)
  return row and row[PREVIEW_KEY] or nil
end

local function isShown(frame)
  return frame ~= nil and frame:IsShown()
end

local function sampleItems()
  return {
    { text = "Header", isHeader = true },
    { text = "Group", children = { { text = "Fanfare", value = 1 }, { text = "Chime", value = 2 } } },
    { text = "None", value = 0, preview = false },
    { text = "Single", value = 3 },
    { isSeparator = true },
  }
end

-- Scenarios ------------------------------------------------------------------

scenario("Play goes on playable leaves only", function()
  local holder = newHolder({ items = sampleItems(), onPreview = function() end })
  openMenu(holder, 1)
  check(playOn(rowAt(1, 1)) == nil, "header row has no Play")
  check(playOn(rowAt(1, 2)) == nil, "group row has no Play")
  check(playOn(rowAt(1, 3)) == nil, "leaf with preview=false has no Play")
  check(isShown(playOn(rowAt(1, 4))), "leaf with a value has a shown Play")
  check(playOn(rowAt(1, 5)) == nil, "separator has no Play")
  check(playOn(rowAt(1, 4)).label:GetText() == "Play", "idle label is Play")
end)

scenario("submenu leaves get Play buttons", function()
  local holder = newHolder({ items = sampleItems(), onPreview = function() end })
  openMenu(holder, 1)
  openMenu(holder, 2, "m1")
  check(isShown(playOn(rowAt(2, 1))), "Fanfare has a shown Play")
  check(isShown(playOn(rowAt(2, 2))), "Chime has a shown Play")
end)

scenario("clicking Play passes value, item and holder, then shows Stop while playing", function()
  local calls, playing = {}, nil
  local holder = newHolder({
    items = sampleItems(),
    onPreview = function(value, item, owner)
      calls[#calls + 1] = { value = value, item = item, owner = owner }
      playing = value
    end,
    isPreviewing = function(value) return value == playing end,
  })
  openMenu(holder, 1)
  openMenu(holder, 2, "m1")
  local chime = playOn(rowAt(2, 2))
  chime:GetScript("OnClick")(chime)
  check(#calls == 1, "onPreview ran once")
  check(calls[1].value == 2, "onPreview got the value")
  check(calls[1].item.text == "Chime", "onPreview got the item")
  check(calls[1].owner == holder, "onPreview got the holder")
  check(chime.label:GetText() == "Stop", "label shows Stop while the value is playing")
end)

scenario("RefreshPreviews restores Play after playback ends", function()
  local playing = 2
  local holder = newHolder({
    items = sampleItems(),
    onPreview = function() end,
    isPreviewing = function(value) return value == playing end,
  })
  openMenu(holder, 1)
  openMenu(holder, 2, "m1")
  local chime = playOn(rowAt(2, 2))
  check(chime.label:GetText() == "Stop", "label is Stop while playing")
  playing = nil
  holder:RefreshPreviews()
  check(chime.label:GetText() == "Play", "RefreshPreviews restores Play")
end)

scenario("a rebuilt menu hides Play buttons that rows no longer need", function()
  local current = {
    { text = "A", value = 1 },
    { text = "B", value = 2 },
    { text = "C", value = 3 },
    { text = "D", value = 4 },
  }
  local holder = newHolder({ items = function() return current end, onPreview = function() end })
  openMenu(holder, 1)
  check(isShown(playOn(rowAt(1, 4))), "row 4 starts with a shown Play")
  current = {
    { text = "A", value = 1 },
    { text = "B", value = 2 },
    { text = "C", value = 3 },
    { text = "Group", children = { { text = "Z", value = 9 } } },
  }
  openMenu(holder, 1)
  check(not isShown(playOn(rowAt(1, 4))), "row 4 is now a group, so its old Play is hidden")
  check(isShown(playOn(rowAt(1, 1))), "row 1 keeps its Play")
end)

scenario("Play width is reserved through ForceWidth and anchored to the row's right edge", function()
  local seen = {}
  local realForceWidth = RGXDropdowns.ForceWidth
  RGXDropdowns.ForceWidth = function(self, level, minWidth, leftInset, opts)
    seen[#seen + 1] = { level = level, opts = opts }
    return realForceWidth(self, level, minWidth, leftInset, opts)
  end
  local ok, err = pcall(function()
    local holder = newHolder({ items = sampleItems(), onPreview = function() end })
    openMenu(holder, 1)
  end)
  RGXDropdowns.ForceWidth = realForceWidth
  check(ok, tostring(err))
  check(#seen >= 1 and seen[1].level == 1, "ForceWidth ran for level 1")
  check((seen[1].opts.inlineKeys or {})[1] == PREVIEW_KEY, "ForceWidth reserves the preview key")
  local play = playOn(rowAt(1, 4))
  local last = play and play.__points and play.__points[#play.__points]
  check(last ~= nil and last.point == "RIGHT", "Play is anchored RIGHT by ForceWidth")
end)

-- Rows are shared and recycled, so an earlier holder's hidden Play frame can still exist on
-- the row. The requirement is that none is visible.
scenario("without onPreview no Play button is visible", function()
  local holder = newHolder({ items = sampleItems() })
  openMenu(holder, 1)
  check(not isShown(playOn(rowAt(1, 4))), "no visible Play without onPreview")
end)

-- Last on purpose: a successful MenuUtil probe is cached by the module for its lifetime.
scenario("onPreview keeps the UIDropDownMenu path even when MenuUtil is available", function()
  _G.__modernTemplate = true
  _G.MenuUtil = { CreateContextMenu = function() return {} end }
  local modernCalls = 0
  local realMenuUtil = RGXDropdowns.CreateNestedDropdown_MenuUtil
  RGXDropdowns.CreateNestedDropdown_MenuUtil = function(self, parent, opts)
    modernCalls = modernCalls + 1
    return realMenuUtil(self, parent, opts)
  end
  local ok, err = pcall(function()
    local plain = newHolder({ items = sampleItems() })
    check(modernCalls == 1 and plain.dropdown.__type == "DropdownButton", "without onPreview MenuUtil builds the menu")
    local previewed = newHolder({ items = sampleItems(), onPreview = function() end })
    check(modernCalls == 1, "with onPreview MenuUtil is not used")
    check(previewed.dropdown.__type == "Frame", "with onPreview the UIDropDownMenu frame is built")
  end)
  RGXDropdowns.CreateNestedDropdown_MenuUtil = realMenuUtil
  _G.MenuUtil = nil
  _G.__modernTemplate = false
  check(ok, tostring(err))
end)

if #failures == 0 then
  __rgxDropdownPreviewResult = "PASSED " .. passed .. " scenarios"
else
  __rgxDropdownPreviewResult = "FAILED: " .. table.concat(failures, "; ")
end
