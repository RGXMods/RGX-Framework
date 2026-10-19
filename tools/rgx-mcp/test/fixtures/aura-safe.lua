local RGX = assert(_G.RGXFramework)
local Auras = assert(RGX:GetAuras())

Auras:IterateAuras("target", "HARMFUL", function(auraData)
    if auraData.spellId == 123 then
        RGX:Print("Accessible aura found")
    end
end)

Auras:OnApplied(function(unit, auraData)
    RGX:Print(unit, auraData.name)
end)

local transfer = { isFullUpdate = true }
RGX:Print(transfer.isFullUpdate)

local reassignedEvent = "UNIT_AURA"
reassignedEvent = "PLAYER_LOGIN"
RGX:RegisterEvent(reassignedEvent, function() end, "safe-reassignment")

local eventNames = {}
eventNames.aura = "UNIT_AURA"
eventNames.aura = "PLAYER_LOGIN"
RGX:RegisterEvent(eventNames.aura, function() end, "safe-member-reassignment")

local scopedEvent = "PLAYER_LOGIN"
do
    local scopedEvent = "UNIT_AURA"
end
RGX:RegisterEvent(scopedEvent, function() end, "safe-scope")

local api = {
    UnitAura = function() end,
    C_UnitAuras = {},
}
api.UnitAura()
local C_UnitAuras = {}
local UnitAura = function() end
local AuraUtil = { ForEachAura = function() end }
C_UnitAuras.GetAuraDataByIndex = function() end
UnitAura()
AuraUtil.ForEachAura()
