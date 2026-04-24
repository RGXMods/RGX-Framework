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

        -- Initialize modules that need post-load startup
        local function TryInit(global)
            local mod = _G[global]
            if mod and type(mod.Init) == "function" then
                local ok, err = pcall(mod.Init, mod)
                if not ok then
                    print("|cFFFF4444[RGX] Init error " .. global .. ": " .. tostring(err) .. "|r")
                end
            end
        end

        TryInit("RGXSharedMedia")
        TryInit("RGXCombat")
        TryInit("RGXReputation")
    end
end)
