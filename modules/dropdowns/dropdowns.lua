--[[
    RGX-Framework - Dropdowns Module

    Generic dropdown helpers for WoW addons.

    This module is intentionally separate from RGXFonts and RGXColors so
    menu widgets can be reused across future RGX modules and consuming addons.
--]]

local _, Dropdowns = ...
local RGX = _G.RGXFramework

if not RGX then
    error("RGX Dropdowns: RGX-Framework not loaded")
    return
end

Dropdowns.name = "dropdowns"
Dropdowns.version = "1.0.0"

local function CopyItem(item)
    if type(item) ~= "table" then
        return nil
    end

    local copy = {}
    for key, value in pairs(item) do
        if key == "children" and type(value) == "table" then
            local children = {}
            for index, child in ipairs(value) do
                children[index] = CopyItem(child)
            end
            copy.children = children
        else
            copy[key] = value
        end
    end

    return copy
end

function Dropdowns:NormalizeItems(items)
    local normalized = {}

    if type(items) ~= "table" then
        return normalized
    end

    for _, item in ipairs(items) do
        local copy = CopyItem(item)
        if copy then
            normalized[#normalized + 1] = copy
        end
    end

    return normalized
end

function Dropdowns:CreateNestedDropdown(parent, opts)
    opts = opts or {}
    parent = parent or UIParent

    local holder = CreateFrame("Frame", nil, parent)
    holder:SetSize(opts.width or 260, opts.height or 56)

    holder.label = holder:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    holder.label:SetPoint("TOPLEFT", 0, 0)
    holder.label:SetText(opts.label or "Select")

    holder.value = opts.value

    holder.dropdown = CreateFrame("Frame", nil, holder, "UIDropDownMenuTemplate")
    holder.dropdown:SetPoint("TOPLEFT", holder.label, "BOTTOMLEFT", -18, -2)
    UIDropDownMenu_SetWidth(holder.dropdown, opts.buttonWidth or 210)

    function holder:GetItems()
        if type(opts.items) == "function" then
            return Dropdowns:NormalizeItems(opts.items(self))
        end
        return Dropdowns:NormalizeItems(opts.items)
    end

    function holder:GetItemText(item)
        if type(opts.getItemText) == "function" then
            return opts.getItemText(item, self.value, self) or ""
        end
        return item and (item.text or item.label or tostring(item.value or "")) or ""
    end

    function holder:GetValueText(value)
        if type(opts.getValueText) == "function" then
            return opts.getValueText(value, self) or ""
        end

        local function findText(items)
            for _, item in ipairs(items) do
                if item.value == value then
                    return self:GetItemText(item)
                end
                if type(item.children) == "table" then
                    local nested = findText(item.children)
                    if nested then
                        return nested
                    end
                end
            end
        end

        return findText(self:GetItems()) or opts.placeholder or "Select"
    end

    function holder:IsItemChecked(item)
        if type(opts.isItemChecked) == "function" then
            return opts.isItemChecked(item, self.value, self) == true
        end
        return item and item.value == self.value
    end

    function holder:Select(item)
        if not item then
            return
        end

        self.value = item.value
        UIDropDownMenu_SetText(self.dropdown, self:GetValueText(self.value))

        if type(opts.onChange) == "function" then
            opts.onChange(item.value, item, self)
        end

        CloseDropDownMenus()
    end

    local function addItems(items, level)
        for _, item in ipairs(items or {}) do
            local info = UIDropDownMenu_CreateInfo()
            info.text = holder:GetItemText(item)
            info.notCheckable = item.notCheckable
            if info.notCheckable == nil then
                info.notCheckable = item.value == nil
            end
            info.disabled = item.disabled
            info.tooltipTitle = item.tooltipTitle
            info.tooltipText = item.tooltipText

            if type(item.children) == "table" and #item.children > 0 then
                info.hasArrow = true
                info.menuList = item.children
            else
                info.func = function()
                    holder:Select(item)
                end
                if not info.notCheckable then
                    info.checked = holder:IsItemChecked(item)
                end
            end

            UIDropDownMenu_AddButton(info, level)
        end
    end

    UIDropDownMenu_Initialize(holder.dropdown, function(_, level, menuList)
        level = level or 1
        if level == 1 then
            addItems(holder:GetItems(), level)
        elseif type(menuList) == "table" then
            addItems(menuList, level)
        end
    end)

    function holder:Refresh(value)
        if value ~= nil then
            self.value = value
        end
        UIDropDownMenu_SetText(self.dropdown, self:GetValueText(self.value))
    end

    function holder:SetEnabled(enabled)
        local isEnabled = enabled ~= false
        self.label:SetAlpha(isEnabled and 1 or 0.6)
        UIDropDownMenu_DisableDropDown(self.dropdown)
        if isEnabled then
            UIDropDownMenu_EnableDropDown(self.dropdown)
        end
        self.dropdown:SetAlpha(isEnabled and 1 or 0.45)
    end

    holder:Refresh(holder.value)
    return holder
end

function Dropdowns:Init()
    RGX:RegisterModule("dropdowns", self)
    _G.RGXDropdowns = self
end

Dropdowns:Init()
