--[[
    RGX-Framework - Utils
--]]

local _, RGX = ...

-- String
function RGX:Trim(str)
    return str:match("^%s*(.-)%s*$")
end

function RGX:Split(str, delimiter)
    local result = {}
    for match in (str..delimiter):gmatch("(.-)" .. delimiter) do
        table.insert(result, match)
    end
    return result
end

-- Table
function RGX:TableCount(tbl)
    local count = 0
    for _ in pairs(tbl) do count = count + 1 end
    return count
end

function RGX:TableKeys(tbl)
    local keys = {}
    for k in pairs(tbl) do table.insert(keys, k) end
    table.sort(keys)
    return keys
end

-- Math
function RGX:Round(num, decimals)
    decimals = decimals or 0
    local mult = 10 ^ decimals
    return math.floor(num * mult + 0.5) / mult
end

-- WoW
function RGX:GetWoWVersion()
    return select(4, GetBuildInfo())
end
