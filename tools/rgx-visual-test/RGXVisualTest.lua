--=====================================================================================
-- RGX Visual Test -- dev/debug visual QA harness for RGX-Framework.
-- Not a player-facing addon. Every API called below was verified against real
-- RGX-Framework source (modules/ui/controls.lua, modules/ui/options.lua,
-- modules/colors/colorpicker.lua, modules/fonts/dropdowns.lua,
-- modules/textures/textures.lua) before this file was written -- no invented
-- APIs, no guessed option keys.
--
-- Deploy: robocopy this folder to Interface/AddOns/RGXVisualTest alongside a
-- current RGX-Framework build, then in-game:
--   /rgxvisual  -- opens the full tabbed test panel
--   /rgxcolor   -- opens just the color picker directly
--=====================================================================================

local R = _G.RGXFramework
if not R then return end

_G.RGXVisualTestDB = _G.RGXVisualTestDB or {}
local DB = _G.RGXVisualTestDB

DB.primary = DB.primary or { r = 0.35, g = 0.75, b = 0.51 }
DB.accent = DB.accent or { r = 0.74, g = 0.44, b = 0.66 }
DB.enabled = DB.enabled ~= false
DB.scale = DB.scale or 100
DB.volume = DB.volume or "medium"
DB.dropdownChoice = DB.dropdownChoice or "one"

local panel

local function Log(...)
    print("|cFF00A2FF[RGXVisual]|r", ...)
end

local function Place(parent)
    local y = -18
    return function(widget, gap)
        if not widget then return nil end
        widget:SetPoint("TOPLEFT", parent, "TOPLEFT", 18, y)
        y = y - (widget:GetHeight() or 28) - (gap or 12)
        return widget
    end
end

local function MakePreview(parent, title)
    local D = R:GetDesign()
    local f = CreateFrame("Frame", nil, parent, "BackdropTemplate")
    f:SetSize(300, 130)
    f:SetBackdrop({
        bgFile = "Interface\\Buttons\\WHITE8x8",
        edgeFile = "Interface\\Buttons\\WHITE8x8",
        edgeSize = 1,
    })
    f:SetBackdropColor(0.08, 0.09, 0.11, 0.96)
    f:SetBackdropBorderColor(D:Unpack("border"))

    f.title = f:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    f.title:SetPoint("TOP", 0, -10)
    f.title:SetText(title or "Preview")

    f.swatch = f:CreateTexture(nil, "ARTWORK")
    f.swatch:SetSize(90, 50)
    f.swatch:SetPoint("CENTER", 0, -12)
    f.swatch:SetColorTexture(DB.primary.r, DB.primary.g, DB.primary.b, 1)

    f.value = f:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    f.value:SetPoint("BOTTOM", 0, 10)

    function f:SetColor(r, g, b)
        self.swatch:SetColorTexture(r, g, b, 1)
        self.value:SetText(string.format("RGB %.2f / %.2f / %.2f", r, g, b))
    end

    f:SetColor(DB.primary.r, DB.primary.g, DB.primary.b)
    return f
end

local function BuildColorsTab(frame)
    local UI = R:GetUI()
    local CP = R:GetColorPicker()
    local add = Place(frame)

    local title = UI:CreateLabel(frame, {
        text = "Color Picker Visual Test",
        size = "large",
        color = "accent",
    })
    add(title)

    local preview = MakePreview(frame, "Selected Color Preview")
    add(preview, 18)

    local picker = UI:CreateColorPicker(frame, {
        key = "primary",
        label = "Primary Color Swatch",
        storage = DB,
        default = { r = 0.35, g = 0.75, b = 0.51 },
        previewOnClick = function()
            Log("Color swatch clicked -- test SV square, hue bar, RGB, HEX, presets, OK/Cancel")
        end,
        onChange = function(r, g, b)
            DB.primary = { r = r, g = g, b = b }
            preview:SetColor(r, g, b)
            Log("Color changed", string.format("%.2f %.2f %.2f", r, g, b))
        end,
    })
    add(picker)

    local accent = UI:CreateColorPicker(frame, {
        key = "accent",
        label = "Accent Color Swatch",
        storage = DB,
        default = { r = 0.74, g = 0.44, b = 0.66 },
        onChange = function(r, g, b)
            DB.accent = { r = r, g = g, b = b }
            Log("Accent changed", string.format("%.2f %.2f %.2f", r, g, b))
        end,
    })
    add(accent)

    local direct = UI:CreateButton(frame, "Open ColorPicker Directly", 210, 24)
    direct:SetScript("OnClick", function()
        CP:Show(DB.primary, function(r, g, b)
            DB.primary = { r = r, g = g, b = b }
            preview:SetColor(r, g, b)
            Log("Direct picker OK", string.format("%.2f %.2f %.2f", r, g, b))
        end)
    end)
    add(direct)

    add(UI:CreateLabel(frame, {
        text = "What to test: click swatches, drag SV square, drag hue bar, type HEX, type RGB, click presets, test OK, test Cancel, test X close, drag picker window, test Reset button.",
        size = "small",
        color = "muted",
    }))
end

local function BuildControlsTab(frame)
    local UI = R:GetUI()
    local add = Place(frame)

    add(UI:CreateLabel(frame, {
        text = "Basic Control Visual Test",
        size = "large",
        color = "accent",
    }))

    add(UI:CreateToggle(frame, {
        key = "enabled",
        label = "Enable Test Toggle",
        storage = DB,
        default = true,
        onChange = function(v) Log("Toggle changed", tostring(v)) end,
    }))

    add(UI:CreateSlider(frame, {
        key = "scale",
        label = "Scale Slider",
        storage = DB,
        min = 50,
        max = 150,
        step = 5,
        default = 100,
        suffix = "%",
        width = 260,
        onChange = function(v) Log("Slider changed", v) end,
    }))

    add(UI:CreateVolumeSlider(frame, {
        key = "volume",
        storage = DB,
        default = "medium",
        width = 160,
        onChange = function(v) Log("Volume slider changed", v) end,
    }))

    add(UI:CreateLabel(frame, {
        text = "What to test: checkbox click, reset button, slider drag, slider click, mousewheel on slider, volume low/medium/high.",
        size = "small",
        color = "muted",
    }))
end

local function BuildDropdownsTab(frame)
    local UI = R:GetUI()
    local Drops = R:GetDropdowns()
    local add = Place(frame)

    add(UI:CreateLabel(frame, {
        text = "Dropdown Visual Test",
        size = "large",
        color = "accent",
    }))

    local dd = Drops:CreateNestedDropdown(frame, {
        label = "Nested Dropdown",
        width = 320,
        buttonWidth = 240,
        value = DB.dropdownChoice,
        placeholder = "Choose one",
        items = {
            { text = "Group A", children = {
                { text = "Option One", value = "one" },
                { text = "Option Two", value = "two" },
            }},
            { text = "Group B", children = {
                { text = "Purple Choice", value = "purple" },
                { text = "Green Choice", value = "green" },
            }},
            { isSeparator = true },
            { text = "No Value Button", notCheckable = true },
        },
        onChange = function(value)
            DB.dropdownChoice = value
            Log("Dropdown selected", tostring(value))
        end,
    })
    add(dd, 20)

    add(UI:CreateLabel(frame, {
        text = "What to test: open menu, open nested groups, select radio item, reopen and confirm checked state, verify no taint/error.",
        size = "small",
        color = "muted",
    }))
end

local function BuildMediaTab(frame)
    local UI = R:GetUI()
    local Fonts = R:GetFonts()
    local Textures = R:GetTextures()
    local add = Place(frame)

    add(UI:CreateLabel(frame, {
        text = "Fonts + Textures Visual Test",
        size = "large",
        color = "accent",
    }))

    local sample = frame:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    sample:SetText("Font preview: The quick brown fox jumps over RGX.")
    add(sample, 18)

    local fontDD = Fonts:CreateFontDropdown(frame, {
        label = "Font Dropdown",
        width = 320,
        buttonWidth = 230,
        value = DB.fontName or Fonts:GetDefault(),
        onChange = function(name, path)
            DB.fontName = name
            if path then
                sample:SetFont(path, 18, "OUTLINE")
            end
            Log("Font selected", tostring(name))
        end,
    })
    add(fontDD, 20)

    local bar = CreateFrame("StatusBar", nil, frame)
    bar:SetSize(300, 24)
    bar:SetMinMaxValues(0, 100)
    bar:SetValue(67)
    bar:SetStatusBarColor(DB.primary.r, DB.primary.g, DB.primary.b, 1)
    bar:SetStatusBarTexture(Textures:GetBar(DB.barTexture or Textures:GetDefault()))
    add(bar, 18)

    local barBG = bar:CreateTexture(nil, "BACKGROUND")
    barBG:SetAllPoints()
    barBG:SetColorTexture(0.1, 0.1, 0.1, 1)

    local texDD = Textures:CreateBarSettingControl(frame, {
        label = "Statusbar Texture",
        storage = DB,
        key = "barTexture",
        width = 330,
        onChange = function(holder, name, path)
            if path then
                bar:SetStatusBarTexture(path)
            end
            Log("Texture selected", tostring(name))
        end,
    })
    add(texDD, 20)

    add(UI:CreateLabel(frame, {
        text = "What to test: font dropdown opens, font changes preview text, texture dropdown changes the statusbar texture.",
        size = "small",
        color = "muted",
    }))
end

local function BuildPanel()
    local UI = R:GetUI()
    panel = UI:CreateOptionsPanel({
        addonName = "RGXVisualTest",
        title = "RGX Visual Test",
        subtitle = "Visual UI harness for RGX-Framework",
        width = 820,
        height = 640,
        maxPerRow = 5,
        tabs = {
            { text = "Colors", content = BuildColorsTab },
            { text = "Controls", content = BuildControlsTab },
            { text = "Dropdowns", content = BuildDropdownsTab },
            { text = "Media", content = BuildMediaTab },
        },
    })
end

local function OpenPanel()
    if not panel then
        BuildPanel()
    end
    panel:Open()
end

R:OnReady(function()
    R:RegisterSlashCommand({ "rgxvisual", "rgxviz" }, function()
        OpenPanel()
    end, "RGX_VISUAL_TEST")

    R:RegisterSlashCommand({ "rgxcolor", "rgxcp" }, function()
        local CP = R:GetColorPicker()
        CP:Show(DB.primary, function(r, g, b)
            DB.primary = { r = r, g = g, b = b }
            Log("Direct color picker OK", string.format("%.2f %.2f %.2f", r, g, b))
        end)
    end, "RGX_COLOR_DIRECT")

    Log("loaded -- use /rgxvisual or /rgxcolor")
end)
