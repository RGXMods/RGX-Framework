local RGX = assert(_G.RGXFramework)

RGX:RegisterEvent("UNIT_AURA", function(_, unit, updateInfo)
    if updateInfo.isFullUpdate then return end
    for _, auraData in ipairs(updateInfo.addedAuras or {}) do
        RGX:Print(unit, auraData.spellId)
    end
end)

local auraData = C_UnitAuras.GetAuraDataByIndex("target", 1, "HARMFUL")
local name = UnitAura("target", 1, "HELPFUL")
AuraUtil.ForEachAura("target", "HARMFUL", nil, function(aura) return aura == auraData end, true)

local auraEvent = "UNIT_AURA"
RGX:RegisterUnitEvent(auraEvent, "target", function() end, "raw-aura")

local UnitAuras = C_UnitAuras
local allAuras = UnitAuras.GetUnitAuras("target")
local getBuff = C_UnitAuras.GetBuffDataByIndex
local buff = getBuff("target", 1, "HELPFUL")
local debuff = C_UnitAuras.GetDebuffDataByIndex("target", 1, "HARMFUL")
local bySlot = C_UnitAuras["GetAuraDataBySlot"]("target", 1)
local getByInstance = C_UnitAuras.GetAuraDataByAuraInstanceID
local byInstance = getByInstance(
    "target",
    1
)
local updated = updateInfo["updatedAuraInstanceIDs"]
local protected = pcall(C_UnitAuras.GetUnitAuras, "target")
local holder = {}
holder.getAura = C_UnitAuras.GetAuraDataByIndex
local flowGetter = C_UnitAuras.GetAuraDataByIndex
flowGetter("target", 1)
flowGetter = safeGetter
local eachAura = AuraUtil.ForEachAura
local protectedEach = pcall(AuraUtil.FindAura, nil, "target", "HELPFUL")
local rawList = AuraUtil.GetUnitAuras("target", "HARMFUL")
RGX:RegisterEvent "UNIT_AURA"
local eventNames = {}
eventNames.aura = "UNIT_AURA"
RGX:RegisterEvent(eventNames.aura, function() end, "member-aura-event")
local registerAuraEvent = RGX.RegisterEvent
registerAuraEvent(RGX, "UNIT_AURA", function() end, "stored-register")
local globalAuras = _G["C_UnitAuras"]
