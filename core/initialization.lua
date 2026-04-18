--[[
    RGX-Framework - Initialization
--]]

local addonName, RGX = ...

local frame = CreateFrame("Frame")
frame:RegisterEvent("ADDON_LOADED")
frame:SetScript("OnEvent", function(_, event, addon)
    if event == "ADDON_LOADED" and addon == addonName then
        -- Initialize database silently
        _G.RGXFrameworkDB = _G.RGXFrameworkDB or {}
        RGX.db = _G.RGXFrameworkDB
        
        -- No welcome message - this is a library
    end
end)
