-- Shared profile editor; consumers supply their existing database owner.
-- Three-zone layout (title band, intro, active-profile highlight box,
-- profile dropdown, stacked action buttons) using only framework skin
-- primitives: no consumer colors, icons, or presets here.
local _, UI = ...
local RGX = _G.RGXFramework

-- opts: db (required database owner), title, icon (texture path),
-- description (intro line), onChange(activeName, db).
function UI:CreateProfilesPanel(parent, opts)
    opts = opts or {}
    local db = assert(opts.db, "RGX UI: profile controls require a database")
    local D = assert(RGX:GetDesign(), "RGX UI: design unavailable")
    local dropdowns = assert(RGX:GetModule("dropdowns"), "RGX UI: dropdowns unavailable")

    -- Title band + intro line.
    local header = D:CreateSectionHeader(parent, opts.title or "Profiles", opts.icon)
    header:SetPoint("TOPLEFT", parent, "TOPLEFT", 0, 0)
    header:SetPoint("TOPRIGHT", parent, "TOPRIGHT", 0, 0)
    local intro = self:CreateLabel(parent, {
        text = opts.description or "Create, switch, and manage your saved profiles.",
        color = "muted",
        width = 560,
    })
    intro:SetPoint("TOPLEFT", header, "BOTTOMLEFT", 0, -8)

    -- Main card: highlight box (left), dropdown column (middle),
    -- stacked actions (right). Fixed zones like the reference layout;
    -- middle content is anchored, never measured.
    local card = self:CreateCard(parent, { title = opts.title or "Profiles", height = 214 })
    card:ClearAllPoints()
    card:SetPoint("TOPLEFT", intro, "BOTTOMLEFT", 0, -8)
    card:SetPoint("TOPRIGHT", parent, "TOPRIGHT", 0, -8)
    local content = card.content

    local status = self:CreateLabel(content, { text = "", color = "muted", width = 240 })

    local function changed()
        card:Refresh()
        if type(opts.onChange) == "function" then
            local ok, err = pcall(opts.onChange, db:GetActiveProfile(), db)
            if not ok then RGX:Error("[RGXUI] profile callback failed: " .. tostring(err)) end
        end
    end

    -- Plain Button widgets expose Enable/Disable, not SetEnabled.
    local function setButtonEnabled(button, enabled)
        if enabled then button:Enable() else button:Disable() end
    end

    -- RIGHT: stacked action buttons (created first: the middle column
    -- anchors against them).
    card.buttons = {}
    local actionSpecs = {
        { "Create", "CreateProfile", true },
        { "Copy", "CopyProfile", true },
        { "Rename", "RenameProfile", true },
        { "Reset", "ResetProfile" },
        { "Delete", "DeleteProfile" },
    }
    local function action(method, needsName)
        return function()
            local name
            if needsName then
                name = (card.input:GetText() or ""):gsub("^%s+", ""):gsub("%s+$", "")
                if name == "" then status:SetText("Enter a profile name."); return end
                for _, existing in ipairs(db:ListProfiles()) do
                    if existing == name then status:SetText("That profile already exists."); return end
                end
            end
            local active = db:GetActiveProfile()
            local ok
            if method == "CreateProfile" then ok = db:CreateProfile(name)
            elseif method == "CopyProfile" then ok = db:CopyProfile(active, name)
            elseif method == "RenameProfile" then ok = db:RenameProfile(active, name)
            else ok = db[method](db, active) end
            if ok then
                card.input:SetText("")
                status:SetText("Profile updated.")
                changed()
            else status:SetText("Profile could not be changed.") end
        end
    end
    local buttonY = -8
    for _, spec in ipairs(actionSpecs) do
        local button = self:CreateButton(content, {
            text = spec[1], width = 100, height = 22, onClick = action(spec[2], spec[3]),
        })
        button:SetPoint("TOPRIGHT", content, "TOPRIGHT", -8, buttonY)
        card.buttons[spec[1]:lower()] = button
        buttonY = buttonY - 28
    end

    -- LEFT: active-profile highlight box in the theme surface.
    local highlight = CreateFrame("Frame", nil, content, "BackdropTemplate")
    highlight:SetPoint("TOPLEFT", content, "TOPLEFT", 8, -8)
    highlight:SetPoint("BOTTOMLEFT", content, "BOTTOMLEFT", 8, 8)
    highlight:SetWidth(170)
    D:ApplyBackdrop(highlight, "dark", 0.60)
    local activeLabel = self:CreateLabel(highlight, { text = "Active", color = "muted" })
    activeLabel:SetPoint("TOPLEFT", highlight, "TOPLEFT", 12, -12)
    local activeValue = self:CreateLabel(highlight, {
        text = db:GetActiveProfile() or "Default", width = 146,
    })
    activeValue:SetPoint("TOPLEFT", activeLabel, "BOTTOMLEFT", 0, -2)

    -- MIDDLE: dropdown, count, name input, status — each chained under the
    -- previous element so dropdown height never needs measuring.
    local profileLabel = self:CreateLabel(content, { text = "Profile", color = "accent" })
    profileLabel:SetPoint("TOPLEFT", highlight, "TOPRIGHT", 8, 0)
    local picker = dropdowns:CreateNestedDropdown(content, {
        label = "", width = 240, buttonWidth = 230,
        items = function()
            local items = {}
            for _, name in ipairs(db:ListProfiles()) do items[#items + 1] = { text = name, value = name } end
            return items
        end,
        value = db:GetActiveProfile(),
        getValueText = function(value) return value or "Default" end,
        onChange = function(value) if db:LoadProfile(value) then changed() end end,
    })
    assert(picker, "RGX UI: no supported profile dropdown capability")
    picker:SetPoint("TOPLEFT", profileLabel, "BOTTOMLEFT", 0, -4)
    local count = self:CreateLabel(content, { text = "", color = "muted" })
    count:SetPoint("TOPLEFT", picker, "BOTTOMLEFT", 0, -4)
    local nameLabel = self:CreateLabel(content, { text = "New profile name", color = "muted" })
    nameLabel:SetPoint("TOPLEFT", count, "BOTTOMLEFT", 0, -8)
    local inputRow = CreateFrame("Frame", nil, content)
    inputRow:SetSize(240, 26)
    inputRow:SetPoint("TOPLEFT", nameLabel, "BOTTOMLEFT", 0, -4)
    local input = CreateFrame("EditBox", nil, inputRow, "InputBoxTemplate")
    input:SetAutoFocus(false)
    input:SetMaxLetters(80)
    input:SetPoint("TOPLEFT", inputRow, "TOPLEFT", 8, -3)
    input:SetPoint("BOTTOMRIGHT", inputRow, "BOTTOMRIGHT", -8, 3)
    input:SetScript("OnEnterPressed", function(self) self:ClearFocus() end)
    input:SetScript("OnEscapePressed", function(self) self:ClearFocus() end)
    status:SetPoint("TOPLEFT", inputRow, "BOTTOMLEFT", 0, -4)

    local function profileCountText()
        local n = #db:ListProfiles()
        return n == 1 and "1 profile" or (n .. " profiles")
    end

    function card:Refresh()
        local active = db:GetActiveProfile()
        picker:Refresh(active)
        activeValue:SetText(active or "Default")
        count:SetText(profileCountText())
        local protected = active == "Default"
        setButtonEnabled(self.buttons.delete, not protected)
        setButtonEnabled(self.buttons.rename, not protected)
    end
    card.input, card.dropdown, card.status = input, picker, status
    card:HookScript("OnShow", function(self) self:Refresh() end)
    card:Refresh()
    return card
end
