--[[
    RGX-Framework - UI Controls
    
    Shared UI components for RGX addons.
    
    Usage:
        local UI = RGX:GetModule("ui")
        
        -- Color picker
        UI:CreateColorPicker(parent, {
            key = "textColor",
            label = "Text Color",
            default = {r=1, g=1, b=1}
        })
        
        -- Slider
        UI:CreateSlider(parent, {
            key = "scale",
            label = "Scale",
            min = 0.5,
            max = 2,
            step = 0.1,
            default = 1
        })
        
        -- Toggle
        UI:CreateToggle(parent, {
            key = "enabled",
            label = "Enable",
            default = true
        })
--]]

local _, UI = ...
local RGX = _G.RGXFramework

if not RGX then
    error("RGX UI: RGX-Framework not loaded")
    return
end

UI.name = "ui"
UI.version = "1.0.0"

-- Control registry
UI.controls = {}
UI.backdrop = {
    bgFile = "Interface\\Buttons\\WHITE8x8",
    edgeFile = "Interface\\Buttons\\WHITE8x8",
    tile = false,
    edgeSize = 1,
    insets = {left = 0, right = 0, top = 0, bottom = 0}
}

-- Apply the framework default font to a label, preserving size/flags.
local function ApplyDefaultFont(fs)
    local Fonts = _G.RGXFonts
    if not (Fonts and type(Fonts.Apply) == "function" and type(Fonts.GetDefault) == "function") then return end
    if not (fs and fs.GetFont) then return end
    local _, size, flags = fs:GetFont()
    pcall(Fonts.Apply, Fonts, fs, Fonts:GetDefault(), size, flags)
end

function UI:CreateStatusBarDropdown(parent, options)
    options = options or {}

    local Textures = RGX:GetModule("textures")
    if not Textures or type(Textures.CreateBarSettingControl) ~= "function" then
        return self:CreateLabel(parent, {text = "RGX Textures not loaded", color = "red"})
    end

    return Textures:CreateBarSettingControl(parent, options)
end

UI.CreateTextureDropdown = UI.CreateStatusBarDropdown

--[[============================================================================
    COLOR PICKER CONTROL
============================================================================]]

-- Embeddable color-picker card: the full SV-box + hue-bar picker inline in an
-- options tab (not the popup swatch), bound to storage[key] = {r,g,b}. Returns
-- the widget frame (with :SetColor/:GetColor), or a label if the module is
-- missing. See ColorPicker:CreateEmbedded for opts.
function UI:CreateColorPickerCard(parent, options)
    local CP = RGX:GetColorPicker()
    if not CP or not CP.CreateEmbedded then
        return self:CreateLabel(parent, { text = "RGX ColorPicker not loaded", color = "red" })
    end
    return CP:CreateEmbedded(parent, options or {})
end

function UI:CreateColorPicker(parent, options)
    options = options or {}
    local key = options.key or "color"
    local label = options.label or "Color"
    local default = options.default or {r=1, g=1, b=1}
    local storage = options.storage or {}
    local onChange = options.onChange or function() end
    local previewOnClick = options.previewOnClick  -- Function to call when clicking swatch
    
    local container = CreateFrame("Frame", nil, parent)
    container:SetSize(200, 24)
    
    -- Label
    container.label = self:CreateLabel(container, {
        text = label,
		size = "normal",
        color = "muted"
    })
    container.label:SetPoint("LEFT", 0, 0)
    
    -- Color swatch button
    local swatch = CreateFrame("Button", nil, container)
    swatch:SetSize(20, 20)
    swatch:SetPoint("LEFT", container.label, "RIGHT", 10, 0)
    
    swatch.bg = swatch:CreateTexture(nil, "BACKGROUND")
    swatch.bg:SetAllPoints()
    swatch.bg:SetColorTexture(0, 0, 0, 1)
    
    swatch.tex = swatch:CreateTexture(nil, "ARTWORK")
    swatch.tex:SetSize(16, 16)
    swatch.tex:SetPoint("CENTER")
    
    -- Set initial color
    local currentColor = storage[key] or default
    swatch.tex:SetColorTexture(currentColor.r or 1, currentColor.g or 1, currentColor.b or 1, 1)
    
    swatch:SetScript("OnClick", function()
        -- Call preview function if provided (shows preview of what we're editing)
        if previewOnClick then
            previewOnClick()
        end
        
        local ColorPicker = RGX:GetModule("colorpicker")
        if ColorPicker then
            ColorPicker:Show({
                r = currentColor.r or 1,
                g = currentColor.g or 1,
                b = currentColor.b or 1
            }, function(r, g, b)
                currentColor = {r=r, g=g, b=b}
                storage[key] = currentColor
                swatch.tex:SetColorTexture(r, g, b, 1)
                onChange(r, g, b)
            end)
        else
            -- Fallback to Blizzard color picker
            local r, g, b = currentColor.r or 1, currentColor.g or 1, currentColor.b or 1
            ColorPickerFrame:SetupColorPickerAndShow({
                r = r, g = g, b = b,
                swatchFunc = function()
                    local nr, ng, nb = ColorPickerFrame:GetColorRGB()
                    currentColor = {r=nr, g=ng, b=nb}
                    storage[key] = currentColor
                    swatch.tex:SetColorTexture(nr, ng, nb, 1)
                    onChange(nr, ng, nb)
                end
            })
        end
    end)
    
    -- Reset button
    local reset = self:CreateResetButton(container, function()
        -- default is a keyed {r,g,b} table, not an array -- unpack(default)
        -- returns nothing on a keyed table, so this silently reset storage[key]
        -- to an empty table instead of the default color.
        currentColor = { r = default.r or 1, g = default.g or 1, b = default.b or 1 }
        storage[key] = currentColor
        swatch.tex:SetColorTexture(currentColor.r, currentColor.g, currentColor.b, 1)
        onChange(currentColor.r, currentColor.g, currentColor.b)
    end)
    reset:SetPoint("LEFT", swatch, "RIGHT", 8, 0)
    
    container.swatch = swatch
    return container
end

--[[============================================================================
SLIDER CONTROL

Custom track-style slider using RGX brand colors.
- Drag, click, or scroll to change value
- Value label appears on hover
- Reset button snaps to default

Usage:
	UI:CreateSlider(parent, {
		key = "scale",
		label = "Scale",
		min = 0.5,
		max = 2,
		step = 0.1,
		default = 1,
		storage = myDB,
		suffix = "%",
		onChange = function(value) end,
		width = 200,
		progress = true,   -- optional; false hides the fill behind the thumb
	})
============================================================================]]

function UI:CreateSlider(parent, options)
	options = options or {}
	local key = options.key or "value"
	local label = options.label or "Slider"
	local min = options.min or 0
	local max = options.max or 100
	local step = options.step or 1
	local default = options.default or min
	local storage = options.storage or {}
	local suffix = options.suffix or ""
	local onChange = options.onChange or function() end
	local sliderWidth = options.width or 200
	-- progress: show the brand-colored fill behind the thumb. Defaults on so
	-- existing sliders are unchanged; pass progress = false for a bare track
	-- (some panels want the thumb without a running fill).
	local showProgress = options.progress
	if showProgress == nil then showProgress = true end

	local D = RGX:GetDesign()

	local container = CreateFrame("Frame", nil, parent)
	container:SetSize(sliderWidth + 32, 38)

	container.label = self:CreateLabel(container, {
		text = label,
		size = "normal",
		color = "muted"
	})
	container.label:SetPoint("TOPLEFT", 0, 0)

	container.valueLabel = self:CreateLabel(container, {
		text = (storage[key] or default) .. suffix,
		size = "normal"
	})
	container.valueLabel:SetPoint("TOPRIGHT", -28, 0)

	local trackFrame = CreateFrame("Frame", nil, container)
	trackFrame:SetPoint("TOPLEFT", container.label, "BOTTOMLEFT", 0, -4)
	trackFrame:SetPoint("TOPRIGHT", container.valueLabel, "BOTTOMRIGHT", 0, -4)
	trackFrame:SetHeight(18)

	local button = CreateFrame("Button", nil, trackFrame)
	button:SetAllPoints(trackFrame)
	button:SetHeight(18)

	local valueLabel = trackFrame:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
	valueLabel:SetTextColor(D:Unpack("subtext"))
	valueLabel:SetPoint("TOP", button, "BOTTOM", 0, 2)
	valueLabel:Hide()

	button:SetScript("OnEnter", function() valueLabel:Show() end)
	button:SetScript("OnLeave", function() valueLabel:Hide() end)

	local track = trackFrame:CreateTexture(nil, "ARTWORK")
	track:SetHeight(4)
	track:SetPoint("LEFT", button, "LEFT", 0, 0)
	track:SetPoint("RIGHT", button, "RIGHT", 0, 0)
	track:SetPoint("CENTER", button, "CENTER", 0, 0)
	track:SetColorTexture(D:Unpack("track"))

	local fill = trackFrame:CreateTexture(nil, "ARTWORK")
	fill:SetHeight(4)
	fill:SetPoint("LEFT", track, "LEFT", 0, 0)
	fill:SetColorTexture(D:Unpack("primary"))
	if not showProgress then fill:Hide() end

	local thumb = trackFrame:CreateTexture(nil, "ARTWORK")
	thumb:SetSize(8, 8)
	thumb:SetTexture("Interface\\Buttons\\WHITE8x8")
	thumb:SetVertexColor(D:Unpack("primary"))

	local function valueToPercent(value)
		if max == min then return 0 end
		return (value - min) / (max - min)
	end

	local function percentToValue(pct)
		local raw = min + pct * (max - min)
		local snapped = math.floor(raw / step + 0.5) * step
		return math.max(min, math.min(max, snapped))
	end

	-- Position the fill/thumb from the current stored value. Returns false when
	-- the track has no width yet (frame not laid out, or built while hidden) so
	-- the caller can retry once geometry resolves.
	local function positionThumb()
		local trackWidth = track:GetWidth()
		if trackWidth < 1 then return false end
		local pct = valueToPercent(storage[key] or default)
		local fillW = math.max(4, trackWidth * pct)
		if showProgress then fill:SetWidth(fillW) end
		thumb:ClearAllPoints()
		thumb:SetPoint("CENTER", track, "LEFT", fillW, 0)
		return true
	end

	-- Retry positioning until the track has a real width. OnUpdate never fires
	-- while a frame is hidden, so a slider built on a not-yet-shown panel would
	-- otherwise stay at the wrong spot until its value changed -- the "default
	-- position wrong on login until set/reset/reload" bug. OnShow re-arms this.
	local function positionThumbDeferred()
		if positionThumb() then return end
		trackFrame:SetScript("OnUpdate", function()
			if positionThumb() then trackFrame:SetScript("OnUpdate", nil) end
		end)
	end

	local function apply(value)
		value = math.floor(value / step + 0.5) * step
		value = math.max(min, math.min(max, value))
		storage[key] = value
		container.valueLabel:SetText(value .. suffix)
		valueLabel:SetText(value .. suffix)
		positionThumbDeferred()
		onChange(value)
	end

	local dragging = false

	button:SetScript("OnMouseDown", function(self, clickButton)
		if clickButton == "RightButton" then return end
		local cursorX = GetCursorPosition()
		local scale = self:GetEffectiveScale()
		local left = self:GetLeft() and (self:GetLeft() * scale) or 0
		local w = math.max(1, (self:GetWidth() or 1) * scale)
		local pct = math.max(0, math.min(1, (cursorX - left) / w))
		apply(percentToValue(pct))
		dragging = true
	end)

	button:SetScript("OnMouseUp", function()
		dragging = false
	end)

	button:SetScript("OnUpdate", function(self)
		if not dragging then return end
		if not IsMouseButtonDown("LeftButton") then
			dragging = false
			return
		end
		local cursorX = GetCursorPosition()
		local scale = self:GetEffectiveScale()
		local left = self:GetLeft() and (self:GetLeft() * scale) or 0
		local w = math.max(1, (self:GetWidth() or 1) * scale)
		local pct = math.max(0, math.min(1, (cursorX - left) / w))
		apply(percentToValue(pct))
	end)

	button:SetScript("OnMouseWheel", function(self, delta)
		local current = storage[key] or default
		local newVal = current + delta * step
		apply(newVal)
	end)
	button:EnableMouseWheel(true)

	local reset = self:CreateResetButton(container, function()
		apply(default)
	end)
    self:AnchorRowReset(parent, reset, trackFrame)

	-- Re-place the thumb every time the slider is shown: the first apply() below
	-- runs while the panel is usually still hidden (login/load), so this is what
	-- makes the initial position correct without needing a set/reset/reload.
	container:SetScript("OnShow", positionThumbDeferred)

	apply(storage[key] or default)

	container.SetValue = function(first, maybe)
		-- Support both control:SetValue(v) and control.SetValue(v)
		local value
		if maybe ~= nil and first == container then
			value = maybe
		elseif maybe == nil then
			value = first
		else
			value = maybe
		end
		apply(value)
	end
	container.GetValue = function() return storage[key] or default end

	return container
end

--[[============================================================================
VOLUME SLIDER CONTROL

3-position discrete slider (Low / Medium / High) using the RGX brand colors.
Click or scroll to cycle. Label appears below on hover.

Usage:
	UI:CreateVolumeSlider(parent, {
		key = "volume",
		storage = myDB,
		default = "medium",
		onChange = function(volume) end,
	})

Options:
	key      - string, storage key (default "volume")
	storage  - table, SavedVariables ref (default {})
	default  - "low"|"medium"|"high" (default "medium")
	onChange - callback(volumeString) (default noop)
	width    - number, track width (default 64)
============================================================================]]

function UI:CreateVolumeSlider(parent, options)
	options = options or {}
	local key = options.key or "volume"
	local storage = options.storage or {}
	local default = options.default or "medium"
	local onChange = options.onChange or function() end
	local width = options.width or 64

	local D = RGX:GetDesign()

	local frame = CreateFrame("Frame", nil, parent)
	frame:SetHeight(18)

	local button = CreateFrame("Button", nil, frame)
	button:SetAllPoints(frame)
	button:SetHeight(18)

	local label = frame:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
	label:SetTextColor(D:Unpack("subtext"))
	label:SetPoint("TOP", button, "BOTTOM", 0, 2)
	label:Hide()

	button:SetScript("OnEnter", function() label:Show() end)
	button:SetScript("OnLeave", function() label:Hide() end)

	local track = frame:CreateTexture(nil, "ARTWORK")
	track:SetHeight(4)
	track:SetPoint("LEFT", button, "LEFT", 0, 0)
	track:SetPoint("RIGHT", button, "RIGHT", 0, 0)
	track:SetPoint("CENTER", button, "CENTER", 0, 0)
	track:SetColorTexture(D:Unpack("track"))

	local fill = frame:CreateTexture(nil, "ARTWORK")
	fill:SetHeight(4)
	fill:SetPoint("LEFT", track, "LEFT", 0, 0)
	fill:SetColorTexture(D:Unpack("primary"))

	local thumb = frame:CreateTexture(nil, "ARTWORK")
	thumb:SetSize(8, 8)
	thumb:SetTexture("Interface\\Buttons\\WHITE8x8")
	thumb:SetVertexColor(D:Unpack("primary"))

	local function getVolume()
		return storage[key] or default
	end

	local function setVolume(volume)
		storage[key] = volume
		onChange(volume)
	end

	local function apply(volume)
		if volume ~= "low" and volume ~= "high" then
			volume = "medium"
		end
		setVolume(volume)

		local function updateVisuals()
			local trackWidth = track:GetWidth()
			if trackWidth < 1 then return false end
			local pct = 0.50
			if volume == "low" then
				pct = 0.15
			elseif volume == "high" then
				pct = 0.85
			end
			local fillW = math.max(4, trackWidth * pct)
			fill:SetWidth(fillW)
			thumb:ClearAllPoints()
			thumb:SetPoint("CENTER", track, "LEFT", fillW, 0)
			label:SetText(volume:gsub("^%l", string.upper))
			return true
		end

		if not updateVisuals() then
			frame:SetScript("OnUpdate", function()
				if updateVisuals() then
					frame:SetScript("OnUpdate", nil)
				end
			end)
		end
	end

	button:SetScript("OnMouseDown", function(self)
		local cursorX = GetCursorPosition()
		local scale = self:GetEffectiveScale()
		local left = self:GetLeft() and (self:GetLeft() * scale) or 0
		local w = math.max(1, (self:GetWidth() or 1) * scale)
		local percent = math.max(0, math.min(1, (cursorX - left) / w))
		if percent < 0.34 then
			apply("low")
		elseif percent > 0.66 then
			apply("high")
		else
			apply("medium")
		end
	end)

	button:SetScript("OnMouseWheel", function()
		local current = getVolume()
		if current == "low" then
			apply("medium")
		elseif current == "medium" then
			apply("high")
		else
			apply("low")
		end
	end)
	button:EnableMouseWheel(true)

	apply(getVolume())

	frame.Refresh = function()
		apply(getVolume())
	end

	return frame
end

--[[============================================================================
TOGGLE CONTROL
============================================================================]]

-- A label and 18px checkbox sharing a single layout frame. Consumers can
-- bind the check to their database or event handlers without recreating its
-- geometry, font, and artwork in each addon.
function UI:CreateCheckbox(parent, text)
    local frame = CreateFrame("Frame", nil, parent)
    frame:SetSize(300, 20)
    local checkbox = CreateFrame("CheckButton", nil, frame)
    checkbox:SetSize(18, 18)
    checkbox:SetPoint("LEFT", 0, 0)
    checkbox:SetNormalTexture("Interface\\Buttons\\UI-CheckBox-Up")
    checkbox:SetPushedTexture("Interface\\Buttons\\UI-CheckBox-Down")
    checkbox:SetHighlightTexture("Interface\\Buttons\\UI-CheckBox-Highlight")
    checkbox:SetCheckedTexture("Interface\\Buttons\\UI-CheckBox-Check")
    local label = self:CreateLabel(frame, { text = text, size = "normal", color = "normal" })
    label:SetPoint("LEFT", checkbox, "RIGHT", 5, 0)
    frame.checkbox = checkbox
    frame.label = label
    return frame
end

function UI:CreateToggle(parent, options)
    options = options or {}
    local key = options.key or "enabled"
    local label = options.label or "Toggle"
    local default = options.default ~= false
    local storage = options.storage or {}
    local onChange = options.onChange or function() end
    
    local container = CreateFrame("Frame", nil, parent)
    container:SetSize(200, 24)
    
    -- Checkbox
    local check = CreateFrame("CheckButton", nil, container, "UICheckButtonTemplate")
    check:SetSize(24, 24)
    check:SetPoint("LEFT", 0, 0)
    check:SetChecked(storage[key] ~= false and default)
    
    -- Label
    container.label = self:CreateLabel(container, {
        text = label,
        size = "normal"
    })
    container.label:SetPoint("LEFT", check, "RIGHT", 4, 0)
    
    check:SetScript("OnClick", function(self)
        local enabled = self:GetChecked()
        storage[key] = enabled
        onChange(enabled)
    end)
    
    -- Reset
    local reset = self:CreateResetButton(container, function()
        check:SetChecked(default)
        storage[key] = default
        onChange(default)
    end)
    reset:SetPoint("LEFT", container.label, "RIGHT", 10, 0)
    
    container.check = check
    return container
end

--[[============================================================================
    LABEL
============================================================================]]

function UI:CreateLabel(parent, options)
    options = options or {}
    local text = options.text or ""
    local size = options.size or "normal"  -- small, normal, large
    local color = options.color or "normal"  -- normal, muted, accent, red, green
    local D = RGX:GetDesign()
    
    local label = parent:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    
    -- Set font size
    if size == "small" then
        label:SetFontObject("GameFontNormalSmall")
    elseif size == "large" then
        label:SetFontObject("GameFontNormalLarge")
    else
        label:SetFontObject("GameFontNormal")
    end
    ApplyDefaultFont(label)
    
    local colorKeys = {
        normal = "text",
        muted  = "subtext",
        accent = "accent",
        red    = "error",
        green  = "success",
        yellow = "warning",
    }

    if D then
        label:SetTextColor(D:Unpack(colorKeys[color] or "text"))
    else
        label:SetTextColor(1, 1, 1)
    end
    
    label:SetText(text)

    -- Long text (descriptions, help text) needs an explicit width to wrap at
    -- -- a FontString with no width auto-sizes to fit everything on one line
    -- and silently overflows the parent frame's edge instead of breaking.
    -- Short labels ("Enable Addon", "R"/"G"/"B") should keep their natural
    -- single-line width, so wrapping is opt-in via options.width.
    if options.width then
        label:SetWidth(options.width)
        label:SetWordWrap(true)
        label:SetJustifyH(options.justify or "LEFT")
    end

    return label
end

--[[============================================================================
    RESET BUTTON
============================================================================]]

function UI:CreateResetButton(parent, onClick)
    local btn = CreateFrame("Button", nil, parent, "BackdropTemplate")
    local D = RGX:GetDesign()
    -- 24px wide: 2px transparent margin each side keeps the visual clear of adjacent controls
    btn:SetSize(24, 16)

    local bg = btn:CreateTexture(nil, "BACKGROUND")
    bg:SetPoint("TOPLEFT",     btn, "TOPLEFT",     2,  0)
    bg:SetPoint("BOTTOMRIGHT", btn, "BOTTOMRIGHT", -2, 0)
    bg:SetColorTexture(D:Unpack("surface"))
    btn.bg = bg

    local border = CreateFrame("Frame", nil, btn, "BackdropTemplate")
    border:SetPoint("TOPLEFT",     btn, "TOPLEFT",     2,  0)
    border:SetPoint("BOTTOMRIGHT", btn, "BOTTOMRIGHT", -2, 0)
    border:SetBackdrop({ edgeFile = "Interface\\Buttons\\WHITE8x8", edgeSize = 1 })
    border:SetBackdropBorderColor(D:Unpack("border"))
    btn.border = border

    local lbl = btn:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    lbl:SetAllPoints()
    lbl:SetJustifyH("CENTER")
    lbl:SetJustifyV("MIDDLE")
    lbl:SetText("R")
    lbl:SetTextColor(D:Unpack("subtext"))
    btn.lbl = lbl

    btn:SetScript("OnClick", onClick)
    btn:SetScript("OnEnter", function(self)
        local D = RGX:GetDesign()
        self.border:SetBackdropBorderColor(D:Unpack("primary"))
        self.bg:SetColorTexture(D:Unpack("hover"))
        self.lbl:SetTextColor(D:Unpack("primary"))
        GameTooltip:SetOwner(self, "ANCHOR_RIGHT")
        GameTooltip:SetText("Reset to default")
        GameTooltip:Show()
    end)
    btn:SetScript("OnLeave", function(self)
        local D = RGX:GetDesign()
        self.border:SetBackdropBorderColor(D:Unpack("border"))
        self.bg:SetColorTexture(D:Unpack("surface"))
        self.lbl:SetTextColor(D:Unpack("subtext"))
        GameTooltip:Hide()
    end)
    return btn
end

-- Buttons are created with skin only. Behavior is attached via SetScript or
-- the options table form. Pcall-isolated like every other shared dispatch so
-- one consumer's handler error cannot break unrelated panels.
local function AttachButtonAction(btn, onClick)
    if type(onClick) ~= "function" then return btn end
    btn:SetScript("OnClick", function(self, button)
        local ok, err = pcall(onClick, self, button)
        if not ok and RGX and type(RGX.Error) == "function" then
            RGX:Error("[RGXUI] button onClick failed: " .. tostring(err))
        end
    end)
    return btn
end

-- UI:CreateButton(parent, textOrOpts[, w][, h])
-- Legacy positional form still works; the table form is the declared
-- ergonomic surface: { text, width, height, tooltip, onClick }.
function UI:CreateButton(parent, textOrOpts, w, h)
    local opts = nil
    local text = textOrOpts
    if type(textOrOpts) == "table" then
        opts = textOrOpts
        text = opts.text
        w = opts.width or w
        h = opts.height or h
    elseif type(textOrOpts) == "function" then
        -- UI:CreateButton(parent, onClickFn) is never valid — surface it.
        text = nil
        opts = { onClick = textOrOpts }
    end
    h = h or (opts and opts.height) or 22

    local D = RGX:GetDesign()
    local btn
    if D and type(D.CreateButton) == "function" then
        btn = D:CreateButton(parent, text, w, h,
            opts and opts.tooltip, opts and opts.tooltipBody)
    else
        btn = CreateFrame("Button", nil, parent, "BackdropTemplate")
        btn:SetSize(w or 120, h)
        local bg = btn:CreateTexture(nil, "BACKGROUND")
        bg:SetAllPoints()
        bg:SetColorTexture(D:Unpack("surface"))
        local border = CreateFrame("Frame", nil, btn, "BackdropTemplate")
        border:SetAllPoints()
        border:SetBackdrop({ edgeFile = "Interface\\Buttons\\WHITE8x8", edgeSize = 1 })
        border:SetBackdropBorderColor(D:Unpack("border"))
        local lbl = btn:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
        lbl:SetAllPoints()
        lbl:SetJustifyH("CENTER")
        lbl:SetJustifyV("MIDDLE")
        lbl:SetText(text or "")
        lbl:SetTextColor(D:Unpack("subtext"))
        btn:SetScript("OnEnter", function()
            local D2 = RGX:GetDesign()
            border:SetBackdropBorderColor(D2:Unpack("primary"))
            bg:SetColorTexture(D2:Unpack("hover"))
            lbl:SetTextColor(D2:Unpack("primary"))
        end)
        btn:SetScript("OnLeave", function()
            border:SetBackdropBorderColor(D:Unpack("border"))
            bg:SetColorTexture(D:Unpack("surface"))
            lbl:SetTextColor(D:Unpack("subtext"))
        end)
    end
    if opts and type(opts.onClick) == "function" then
        AttachButtonAction(btn, opts.onClick)
    end
    return btn
end

--[[============================================================================
    SECTION/PANEL
============================================================================]]

-- A scrollable canvas for card layouts taller than an options tab. Keep the
-- scrollbar and clipping in the framework so consumers only position cards.
function UI:CreateScrollPage(parent, height)
    local scroll = CreateFrame("ScrollFrame", nil, parent, "UIPanelScrollFrameTemplate")
    scroll:SetPoint("TOPLEFT", parent, "TOPLEFT", 8, -8)
    scroll:SetPoint("BOTTOMRIGHT", parent, "BOTTOMRIGHT", -30, 8)

    local canvas = CreateFrame("Frame", nil, scroll)
    canvas:SetHeight(height or 620)
    canvas:SetWidth(math.max(1, scroll:GetWidth()))
    scroll:SetScrollChild(canvas)
    scroll:HookScript("OnSizeChanged", function(self, width)
        canvas:SetWidth(math.max(1, width))
    end)
    return canvas, scroll
end

function UI:CreateSection(parent, options)
    options = options or {}
    local title = options.title or "Section"
    local width = options.width or 300
    local height = options.height or 200
    local D = RGX:GetDesign()
    assert(D and type(D.CreateSection) == "function", "RGX UI: section design unavailable")
    -- Share BLU's section skin; RGXUI owns placement, RGXDesign textures.
    local section = D:CreateSection(parent, title ~= "" and title or nil, options.icon,
        { square = options.square ~= false })
    section:SetSize(width, height)
    section.headerBand = section.header
    -- Measure direct widgets after the consumer finishes building the card.
    -- Children can be Frames or FontStrings; do not depend on a fixed count,
    -- particular widget type, or the consumer's hand-maintained y offsets.
    function section:FitContent(padding)
        local top = self.content:GetTop()
        local deepest = 0
        local function measure(region)
            if not region or (region.IsShown and not region:IsShown()) then return end
            local bottom = region.GetBottom and region:GetBottom()
            if top and type(bottom) == "number" then
                deepest = math.max(deepest, top - bottom)
            elseif region.GetPoint and region.GetHeight then
                local _, relative, relativePoint, _, y = region:GetPoint(1)
                if relative == self.content and (relativePoint == "TOPLEFT" or relativePoint == "TOP")
                    and type(y) == "number" then
                    deepest = math.max(deepest, -y + (region:GetHeight() or 0))
                end
            end
        end
        for _, child in ipairs({self.content:GetChildren()}) do measure(child) end
        for _, region in ipairs({self.content:GetRegions()}) do measure(region) end
        if deepest > 0 then
            self:SetHeight(self.contentTopInset + deepest + self.contentBottomInset + (padding or 2))
        end
        return self:GetHeight()
    end
    return section
end

--[[============================================================================
    PREVIEW FRAME
============================================================================]]

function UI:CreatePreviewFrame(parent, options)
    options = options or {}
    local width = options.width or 250
    local height = options.height or 150
    local D = RGX:GetDesign()
    
    local frame = CreateFrame("Frame", nil, parent, "BackdropTemplate")
    frame:SetSize(width, height)
    frame:SetBackdrop(self.backdrop)
    local sr, sg, sb = D:Unpack("surface")
    frame:SetBackdropColor(sr, sg, sb, 0.9)
    frame:SetBackdropBorderColor(D:Unpack("border"))
    
    -- Label
    frame.label = self:CreateLabel(frame, {
        text = options.title or "Preview",
        size = "normal",
        color = "muted"
    })
    frame.label:SetPoint("TOP", 0, -8)
    
    -- Preview content area
    frame.preview = CreateFrame("Frame", nil, frame)
    frame.preview:SetPoint("CENTER", 0, -10)
    frame.preview:SetSize(width - 20, height - 40)
    
    -- Background for preview
    frame.preview.bg = frame.preview:CreateTexture(nil, "BACKGROUND")
    frame.preview.bg:SetAllPoints()
    frame.preview.bg:SetColorTexture(D:Unpack("background"))
    
    return frame
end

--[[============================================================================
    SWITCH — sliding on/off control (BLU module-page style)

    UI:CreateSwitch(parent, options)
    options:
        key      storage key (when storage given)
        label    text shown left of the switch
        default  default state when storage has no value (default true)
        storage  settings table (optional; without it the switch is stateless
                 and reports via onChange)
        onChange function(enabled)
    Returns a container with .switchFrame / .toggle / .label / .Refresh and
    container.checkbox (a Button emulating GetChecked) for compatibility.
============================================================================]]

function UI:CreateSwitch(parent, options)
    options = options or {}
    local D = RGX:GetDesign()
    local pr, pg, pb = 0.02, 0.87, 0.38 -- green-ish; refined by theme below
    if D then pr, pg, pb = D:Unpack("success") end
    local br, bg_, bb = 0.30, 0.30, 0.30
    if D then br, bg_, bb = D:Unpack("border") end

    local container = CreateFrame("Button", nil, parent)
    container:SetSize(200, 22)
    container:RegisterForClicks("LeftButtonUp")

    -- Status text (right of label area, matches BLU module toggles)
    container.label = self:CreateLabel(container, {
        text = options.label or "",
        size = "small",
    })
    container.label:SetPoint("LEFT", 0, 0)

    local status = container:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    status:SetPoint("RIGHT", container, "RIGHT", -52, 0)
    ApplyDefaultFont(status)
    container.status = status

    -- Track
    local switchFrame = CreateFrame("Frame", nil, container)
    switchFrame:SetSize(44, 20)
    switchFrame:SetPoint("RIGHT", container, "RIGHT", 0, 0)
    container.switchFrame = switchFrame

    local switchBg = switchFrame:CreateTexture(nil, "BACKGROUND")
    switchBg:SetAllPoints()
    switchBg:SetTexture("Interface\\Buttons\\WHITE8x8")

    -- Thumb
    local toggle = CreateFrame("Frame", nil, switchFrame)
    toggle:SetSize(18, 18)
    toggle:EnableMouse(false)
    container.toggle = toggle

    local toggleBg = toggle:CreateTexture(nil, "ARTWORK")
    toggleBg:SetAllPoints()
    toggleBg:SetTexture("Interface\\Buttons\\WHITE8x8")
    toggleBg:SetVertexColor(0.92, 0.92, 0.92, 1)

    local storage   = options.storage
    local key       = options.key
    local default   = options.default
    if default == nil then default = true end
    local onChange  = options.onChange or function() end
    if not (storage and key) then
        container._enabled = (default == true)
    end

    local function IsEnabled()
        if storage and key then
            local v = storage[key]
            if v == nil then return default end
            return v and true or false
        end
        return container._enabled == true
    end

    function container:Refresh()
        local enabled = IsEnabled()
        toggle:ClearAllPoints()
        if enabled then
            toggle:SetPoint("RIGHT", switchFrame, "RIGHT", -1, 0)
            switchBg:SetVertexColor(pr, pg, pb, 1)
            status:SetText("|cff00ff00ON|r")
        else
            toggle:SetPoint("LEFT", switchFrame, "LEFT", 1, 0)
            switchBg:SetVertexColor(br, bg_, bb, 1)
            status:SetText("|cffff0000OFF|r")
        end
    end

    container:SetScript("OnClick", function()
        local nextState = not IsEnabled()
        if storage and key then
            storage[key] = nextState
        else
            container._enabled = nextState
        end
        container:Refresh()
        onChange(nextState)
    end)

    -- Compatibility shim so generic refresh code can SetChecked/GetChecked
    local fake = { checked = IsEnabled() }
    function fake:GetChecked()  return IsEnabled() end
    function fake:SetChecked(s) if storage and key then storage[key] = s and true or false else container._enabled = s and true or false end; container:Refresh() end
    function fake:SetScript() end
    container.checkbox = fake

    container:Refresh()
    return container
end

--[[============================================================================
    COLUMNS — centered multi-column page layout

    UI:CreateColumns(parent, count, options)
    options:
        colWidth  width per column (default: share the parent width evenly)
        gap       horizontal gap between columns (default 14)
        margin    extra inset from the parent edges when auto-sizing (default 0)

    Columns are centered as a block inside the parent, so two-column pages
    sit properly centered instead of hugging the edges.
    Returns one frame per column (unpack into locals).
============================================================================]]

function UI:CreateColumns(parent, count, options)
    options = options or {}
    count = count or 2
    local gap = options.gap or 14
    local margin = options.margin or 0
    local fixedWidth = options.colWidth

    local columns = {}
    for i = 1, count do
        columns[i] = CreateFrame("Frame", nil, parent)
    end

    -- Column width is derived from the parent, which may be anchor-sized and
    -- therefore report 0 until layout resolves. Recompute on size changes so
    -- the page settles at the right width instead of staying collapsed.
    local function layout()
        local colWidth = fixedWidth
        if not colWidth then
            local w = (parent.GetWidth and parent:GetWidth()) or 0
            if w <= 0 then
                colWidth = 360
            else
                colWidth = math.floor((w - (count - 1) * gap - margin * 2) / count)
                if colWidth < 80 then colWidth = 80 end
            end
        end
        for i = 1, count do
            local col = columns[i]
            col:SetWidth(colWidth)
            local xCenter = (i - 0.5 - count / 2) * (colWidth + gap)
            col:ClearAllPoints()
            col:SetPoint("TOP", parent, "TOP", xCenter, 0)
            col:SetPoint("BOTTOM", parent, "BOTTOM", xCenter, 0)
        end
    end
    layout()

    if parent.HookScript then
        parent:HookScript("OnSizeChanged", layout)
    end

    return unpack(columns)
end

--[[============================================================================
    INITIALIZATION
============================================================================]]

function UI:Init()
    RGX:RegisterModule("ui", self)
    _G.RGXUI = self
end

UI:Init()
