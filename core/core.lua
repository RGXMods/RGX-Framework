--[[
    RGX-Framework - Core Library
    
    A modular framework providing fonts, colors, and textures for WoW addons.
    
    Usage:
        ## RequiredDeps: RGX-Framework
        
        local RGX = _G.RGXFramework
        local Fonts = RGX:GetModule("fonts")
        local Colors = RGX:GetModule("colors")
        local Textures = RGX:GetModule("textures")
--]]

local _, RGX = ...
_G.RGXFramework = RGX

RGX.version = "1.0.0"
RGX.debugMode = false

-- Module storage
RGX.modules = {}
RGX.loadedModules = {}

-- Module management
function RGX:RegisterModule(name, module)
    if type(name) ~= "string" or name == "" then return false end
    if type(module) ~= "table" then return false end
    if self.modules[name] then return false end

    self.modules[name] = module
    self.loadedModules[name] = true
    return true
end

function RGX:GetModule(name)
    return self.modules[name]
end

function RGX:IsModuleLoaded(name)
    return self.loadedModules[name] == true
end

function RGX:GetLoadedModules()
    local list = {}
    for name in pairs(self.loadedModules) do
        table.insert(list, name)
    end
    table.sort(list)
    return list
end

-- Utilities
function RGX:Debug(...)
    if not self.debugMode then return end
    print("|cFF00FF00[RGX]|r", ...)
end

function RGX:CopyTable(orig)
    local copy
    if type(orig) == "table" then
        copy = {}
        for k, v in next, orig, nil do
            copy[self:CopyTable(k)] = self:CopyTable(v)
        end
        setmetatable(copy, self:CopyTable(getmetatable(orig)))
    else
        copy = orig
    end
    return copy
end

function RGX:Clamp(val, min, max)
    return math.min(math.max(val, min), max)
end

function RGX:Lerp(a, b, t)
    t = self:Clamp(tonumber(t) or 0, 0, 1)
    return a + (b - a) * t
end

-- Table helpers
function RGX:TableCount(tbl)
    local count = 0
    for _ in pairs(tbl) do count = count + 1 end
    return count
end
