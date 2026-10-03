-- Shared profile editor; consumers supply their existing database owner.
local _, UI = ...
local RGX = _G.RGXFramework

function UI:CreateProfilesPanel(parent, opts)
    opts = opts or {}
    local db = assert(opts.db, "RGX UI: profile controls require a database")
    local dropdowns = assert(RGX:GetModule("dropdowns"), "RGX UI: dropdowns unavailable")
    local card = self:CreateCard(parent, { title = opts.title or "Profiles" })
    local flow = card.flow
    local status = self:CreateLabel(card.content, { text = "", color = "muted", width = 300 })
    local picker
    local function changed()
        card:Refresh()
        if type(opts.onChange) == "function" then
            local ok, err = pcall(opts.onChange, db:GetActiveProfile(), db)
            if not ok then RGX:Error("[RGXUI] profile callback failed: " .. tostring(err)) end
        end
    end
    picker = dropdowns:CreateNestedDropdown(card.content, {
        label = "Current profile", width = 300, buttonWidth = 290,
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
    flow:Add(picker, { fill = true })

    local inputRow = CreateFrame("Frame", nil, card.content)
    inputRow:SetHeight(26)
    local input = CreateFrame("EditBox", nil, inputRow, "InputBoxTemplate")
    input:SetAutoFocus(false)
    input:SetMaxLetters(80)
    input:SetPoint("TOPLEFT", inputRow, "TOPLEFT", 8, -3)
    input:SetPoint("BOTTOMRIGHT", inputRow, "BOTTOMRIGHT", -8, 3)
    input:SetScript("OnEnterPressed", function(self) self:ClearFocus() end)
    input:SetScript("OnEscapePressed", function(self) self:ClearFocus() end)
    local nameLabel = self:CreateLabel(card.content, { text = "New profile name", color = "muted" })
    flow:Add(nameLabel)
    flow:Add(inputRow, { fill = true })

    local function newName()
        local name = (input:GetText() or ""):gsub("^%s+", ""):gsub("%s+$", "")
        if name == "" then status:SetText("Enter a profile name."); return end
        for _, existing in ipairs(db:ListProfiles()) do
            if existing == name then status:SetText("That profile already exists."); return end
        end
        return name
    end
    local function action(method, needsName)
        return function()
            local name = needsName and newName()
            if needsName and not name then return end
            local active = db:GetActiveProfile()
            local ok
            if method == "CreateProfile" then ok = db:CreateProfile(name)
            elseif method == "CopyProfile" then ok = db:CopyProfile(active, name)
            elseif method == "RenameProfile" then ok = db:RenameProfile(active, name)
            else ok = db[method](db, active) end
            if ok then
                input:SetText("")
                status:SetText("Profile updated.")
                changed()
            else status:SetText("Profile could not be changed.") end
        end
    end
    card.buttons = {}
    for _, row in ipairs({
        { { "Create", "CreateProfile", true }, { "Copy", "CopyProfile", true }, { "Rename", "RenameProfile", true } },
        { { "Reset", "ResetProfile" }, { "Delete", "DeleteProfile" } },
    }) do
        local entries = {}
        for _, spec in ipairs(row) do
            local button = self:CreateButton(card.content, {
                text = spec[1], width = 90, height = 22, onClick = action(spec[2], spec[3]),
            })
            card.buttons[spec[1]:lower()] = button
            entries[#entries + 1] = { child = button, fill = true }
        end
        flow:AddRow(entries)
    end
    flow:Add(status, { fill = true })
    function card:Refresh()
        picker:Refresh(db:GetActiveProfile())
        local protected = db:GetActiveProfile() == "Default"
        self.buttons.delete:SetEnabled(not protected)
        self.buttons.rename:SetEnabled(not protected)
        self:AutoHeight()
    end
    card.input, card.dropdown, card.status = input, picker, status
    card:HookScript("OnShow", function(self) self:Refresh() end)
    card:Refresh()
    return card
end
