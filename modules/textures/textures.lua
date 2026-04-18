--[[
    RGX-Framework - Textures Module
    
    Status bar textures and UI skins for WoW addons.
--]]

local _, Textures = ...
local RGX = _G.RGXFramework

if not RGX then
    error("RGX Textures: RGX-Framework not loaded")
    return
end

Textures.name = "textures"
Textures.version = "1.0.0"

-- Status bar texture paths
Textures.bars = {
    ["Blizzard"] = "Interface/TargetingFrame/UI-StatusBar",
    ["Smooth"] = "Interface/RaidFrame/Raid-Bar-Hp-Fill",
    ["Flat"] = "Interface/PaperDollInfoFrame/UI-Character-Skills-Bar",
}

function Textures:RegisterBar(name, path)
    self.bars[name] = path
end

function Textures:GetBar(name)
    return self.bars[name] or self.bars["Blizzard"]
end

function Textures:ListBars()
    local list = {}
    for name in pairs(self.bars) do
        table.insert(list, name)
    end
    table.sort(list)
    return list
end

function Textures:Init()
    RGX:RegisterModule("textures", self)
    RGX:Debug("Textures: Initialized")
end

Textures:Init()
