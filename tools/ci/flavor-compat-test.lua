local expectedFlavor = assert(__expectedFlavor)
local expectedAvailable = assert(__expectedAvailable)
local expectedUnavailable = assert(__expectedUnavailable)

local function check(condition, message)
    if not condition then error("CHECK FAILED: " .. message, 2) end
end

check(RGX.wowVersion == expectedFlavor, "detected flavor " .. tostring(RGX.wowVersion))

for _, name in ipairs(expectedAvailable) do
    check(RGX:IsModuleAvailable(name), name .. " should be available")
end
for _, name in ipairs(expectedUnavailable) do
    check(not RGX:IsModuleAvailable(name), name .. " should be unavailable")
end

check(RGX:GetModule("auras"):HasPlayerAura(123), "aura normalization")
check(RGX:GetModule("auras"):HasAura(123, "target"), "accessible any-unit aura normalization")
check(RGX.API.CanAccessValue(123), "value access capability")
check(RGX.API.CanAccessTable({}), "table access capability")
check(RGX.API.ShouldAurasBeSecret() == false, "unrestricted flavor aura policy")
check(RGX:HasCapability("auraSecrecy") == (expectedFlavor ~= "cata"), "aura secrecy capability")

local quest = RGX.API.GetQuestLogInfo(1)
check(type(quest) == "table" and quest.questID == 456, "quest normalization")

local faction = RGX.API.GetFactionDataByIndex(1)
check(type(faction) == "table" and faction.factionID == 789, "reputation normalization")

if RGX:IsModuleAvailable("housing") then
    check(RGX:GetModule("housing") ~= nil, "available module should be exposed")
else
    check(RGX:GetModule("housing") == nil, "unavailable module should not be exposed")
end
check(RGX:GetModule("auras") ~= nil, "available module should be exposed")

__flavorCompatResult = expectedFlavor .. " OK"
