local checks = 0
local function check(condition, message)
    checks = checks + 1
    if not condition then error("CHECK FAILED: " .. message, 2) end
end

local Auras = assert(RGX:GetAuras())
local function instanceKey(unit, id)
    return tostring(unit) .. ":" .. tostring(id)
end
local function indexKey(unit, index, filter)
    return tostring(unit) .. ":" .. tostring(index) .. ":" .. tostring(filter)
end
local function poisonTable()
    return setmetatable({}, {
        __index = function() error("poison table was indexed before its predicate") end,
    })
end

-- Generic access predicates: type/nil handling is safe, and canaccess* remains
-- the primary permission decision when both predicate families exist.
__valueAccessCalls = 0
check(not RGX.API.CanAccessValue(nil), "nil should be unavailable")
check(__valueAccessCalls == 0, "nil should not be passed to canaccessvalue")
check(RGX.API.CanAccessValue(123), "ordinary values should be accessible")
check(__secretValueCalls == 0, "issecretvalue should not override canaccessvalue")
local deniedValue = {}
__deniedValues[deniedValue] = true
check(not RGX.API.CanAccessValue(deniedValue), "denied values should fail closed")
check(__secretValueCalls == 0, "denied canaccessvalue should not fall through")

__tableAccessCalls = 0
check(not RGX.API.CanAccessTable(nil), "nil tables should be unavailable")
check(__tableAccessCalls == 0, "nil should not be passed to canaccesstable")
local ordinaryTable = {}
check(RGX.API.CanAccessTable(ordinaryTable), "ordinary tables should be accessible")
check(__secretTableCalls == 0, "issecrettable should not override canaccesstable")
local deniedTable = {}
__deniedTables[deniedTable] = true
check(not RGX.API.CanAccessTable(deniedTable), "denied tables should fail closed")

local deniedUnit = {}
__deniedValues[deniedUnit] = true
__indexPredicateCalls = 0
check(RGX.API.ShouldUnitAuraIndexBeSecret(deniedUnit, 1, "HELPFUL") == nil,
    "public index predicate should reject inaccessible arguments")
check(__indexPredicateCalls == 0, "inaccessible index arguments should not reach C_Secrets")
__instancePredicateCalls = 0
check(RGX.API.ShouldUnitAuraInstanceBeSecret(deniedUnit, 1) == nil,
    "public instance predicate should reject inaccessible arguments")
check(__instancePredicateCalls == 0, "inaccessible instance arguments should not reach C_Secrets")

-- Player and direct any-unit lookups expose only accessible AuraData.
local playerAura = { spellId = 123, auraInstanceID = 10 }
__playerAura = playerAura
check(Auras:GetPlayerAura(123) == playerAura, "player lookup should return accessible data")
check(Auras:HasPlayerAura(123), "player presence should use the guarded lookup")
__deniedTables[playerAura] = true
check(Auras:GetPlayerAura(123) == nil, "player lookup should suppress denied data")
__deniedTables[playerAura] = nil

local directAura = { spellId = 321, auraInstanceID = 11 }
__unitSpellAura = directAura
check(Auras:GetAura(321, "target") == directAura, "unit spell lookup should return accessible data")
__deniedTables[directAura] = true
check(Auras:GetAura(321, "target") == nil, "unit spell lookup should suppress denied data")
__deniedTables[directAura] = nil

-- Index preflight runs before the getter, and denied getter results never reach
-- iteration callbacks.
local aura101 = { spellId = 101, auraInstanceID = 101 }
__auras.target.HELPFUL = { aura101 }
__auras.target.HARMFUL = {}
__instances[101] = aura101
local visited = 0
check(Auras:IterateAuras("target", "HELPFUL", function() visited = visited + 1 end) == 1,
    "accessible iteration should report one aura")
check(visited == 1, "accessible AuraData should reach the callback")

__secretIndexes[indexKey("target", 1, "HELPFUL")] = true
__indexGetterCalls = 0
visited = 0
check(Auras:IterateAuras("target", "HELPFUL", function() visited = visited + 1 end) == 0,
    "secret index should end the scan")
check(__indexGetterCalls == 0 and visited == 0, "secret index should not call the getter or callback")
__secretIndexes[indexKey("target", 1, "HELPFUL")] = nil

local deniedAura = poisonTable()
__deniedTables[deniedAura] = true
__auras.target.HELPFUL = { deniedAura }
visited = 0
check(Auras:IterateAuras("target", "HELPFUL", function() visited = visited + 1 end) == 0,
    "denied getter data should end the scan")
check(visited == 0, "denied getter data should not reach a callback")
__auras.target.HELPFUL = { aura101 }

-- Unit-event routing checks the event unit before comparison or forwarding.
local routed = 0
RGX:RegisterUnitEvent("UNIT_AURA", "target", function() routed = routed + 1 end, "AuraRouteTest")
__deniedValues.target = true
RGX:FireEvent("UNIT_AURA", "target", { isFullUpdate = false })
check(routed == 0, "denied event units should not dispatch unit handlers")
__deniedValues.target = nil

local deniedUnits = poisonTable()
__deniedTables[deniedUnits] = true
check(not RGX:RegisterUnitEvent("UNIT_AURA", deniedUnits, function() end, "DeniedUnits"),
    "denied unit-filter tables should fail before iteration")
__deniedTables[deniedUnits] = nil

__deniedValues.focus = true
check(not RGX:RegisterUnitEvent("UNIT_AURA", { "target", "focus" }, function() end, "DeniedUnit"),
    "denied unit-filter elements should reject the registration")
__deniedValues.focus = nil

local copiedUnits = { "target" }
local copiedRoutes = 0
check(RGX:RegisterUnitEvent("UNIT_AURA", copiedUnits, function() copiedRoutes = copiedRoutes + 1 end, "CopiedUnits"),
    "accessible unit-filter tables should register")
copiedUnits[1] = "focus"
RGX:FireEvent("UNIT_AURA", "target", { isFullUpdate = false })
RGX:FireEvent("UNIT_AURA", "focus", { isFullUpdate = false })
check(copiedRoutes == 1, "unit-filter tables should be copied before caller mutation")

-- Watch rebuilds a predicate-approved cache.
check(Auras:WatchUnit("target"), "watch should register through the unit dispatcher")
check(Auras._cache.target.valid == true, "accessible rebuild should publish a valid cache")
check(Auras:GetAuraByInstanceID("target", 101) == aura101, "approved cache entries should be readable")

local applied, updated, removed = 0, 0, 0
Auras:OnApplied(function() error("expected callback failure") end)
Auras:OnApplied(function() applied = applied + 1 end)
Auras:OnUpdated(function() updated = updated + 1 end)
Auras:OnRemoved(function() removed = removed + 1 end)

local aura202 = { spellId = 202, auraInstanceID = 202 }
__instances[202] = aura202
RGX:FireEvent("UNIT_AURA", "target", {
    isFullUpdate = false,
    addedAuras = { aura202 },
})
check(applied == 1, "one failing applied callback should not stop another")
check(Auras:GetAuraByInstanceID("target", 202) == aura202, "accessible additions should enter the cache")

local aura202Updated = { spellId = 203, auraInstanceID = 202 }
__instances[202] = aura202Updated
RGX:FireEvent("UNIT_AURA", "target", {
    isFullUpdate = false,
    updatedAuraInstanceIDs = { 202 },
})
check(updated == 1, "accessible updates should fire once")
check(Auras:GetAuraByInstanceID("target", 202) == aura202Updated, "accessible updates should replace cache data")

RGX:FireEvent("UNIT_AURA", "target", {
    isFullUpdate = false,
    removedAuraInstanceIDs = { 202 },
})
check(removed == 1, "accessible removals should fire once")
__instances[202] = nil
check(Auras:GetAuraByInstanceID("target", 202) == nil, "removed data should not remain cached")

-- Callback batches are cache-atomic and non-reentrant. A nested update wins and
-- stale callbacks from the older generation stop before they can be forwarded.
local aura404 = { spellId = 404, auraInstanceID = 404 }
local aura405 = { spellId = 405, auraInstanceID = 405 }
__instances[404], __instances[405] = aura404, aura405
RGX:FireEvent("UNIT_AURA", "target", {
    isFullUpdate = false,
    addedAuras = { aura404, aura405 },
})

local nested404 = { spellId = 1404, auraInstanceID = 404 }
local outer404 = { spellId = 2404, auraInstanceID = 404 }
local outer405 = { spellId = 2405, auraInstanceID = 405 }
local reentrantCallbacks = {}
Auras:OnUpdated(function(_, auraData)
    reentrantCallbacks[#reentrantCallbacks + 1] = auraData.spellId
    if auraData == outer404 then
        __instances[404] = nested404
        RGX:FireEvent("UNIT_AURA", "target", {
            isFullUpdate = false,
            updatedAuraInstanceIDs = { 404 },
        })
    end
end)
__instances[404], __instances[405] = outer404, outer405
RGX:FireEvent("UNIT_AURA", "target", {
    isFullUpdate = false,
    updatedAuraInstanceIDs = { 404, 405 },
})
check(Auras:GetAuraByInstanceID("target", 404) == nested404,
    "a nested update should remain newer than the outer transaction")
check(Auras:GetAuraByInstanceID("target", 405) == outer405,
    "the outer transaction should commit atomically before callbacks")
check(#reentrantCallbacks == 2
        and reentrantCallbacks[1] == 2404
        and reentrantCallbacks[2] == 1404,
    "a newer generation should suppress stale remaining callbacks")

local aura406 = { spellId = 406, auraInstanceID = 406 }
local aura407 = { spellId = 407, auraInstanceID = 407 }
local staleApplied = 0
Auras:OnApplied(function(_, auraData)
    if auraData == aura406 then
        __auraEventSecret = true
        RGX:FireEvent("UNIT_AURA", "target", poisonTable())
        __auraEventSecret = false
    end
end)
Auras:OnApplied(function() staleApplied = staleApplied + 1 end)
RGX:FireEvent("UNIT_AURA", "target", {
    isFullUpdate = false,
    addedAuras = { aura406, aura407 },
})
check(Auras._cache.target.valid == false,
    "a nested restricted event should keep the outer cache invalidated")
check(staleApplied == 0,
    "a nested restricted event should stop remaining stale callbacks")

local function rebuildTarget()
    __auras.target.HELPFUL = { aura101 }
    __instances[101] = aura101
    RGX:FireEvent("UNIT_AURA", "target", { isFullUpdate = true })
    check(Auras._cache.target.valid == true, "full update should rebuild an accessible cache")
end

local function callbackCount()
    return applied + updated + removed
end

local function checkRestrictedSilence(beforeCallbacks, beforeErrors, label)
    check(callbackCount() == beforeCallbacks, label .. " should fire no callbacks")
    check(#__errors == beforeErrors, label .. " should raise no hidden handler error")
end

-- An inaccessible event unit still reaches the predicate-only raw guard, which
-- invalidates every watched cache before unit dispatch is suppressed.
rebuildTarget()
local beforeCallbacks, beforeErrors = callbackCount(), #__errors
__deniedValues.target = true
local deniedUnitPayload = poisonTable()
local ok = pcall(RGX.FireEvent, RGX, "UNIT_AURA", "target", deniedUnitPayload)
check(ok and Auras._cache.target.valid == false, "denied event units should invalidate watched caches")
checkRestrictedSilence(beforeCallbacks, beforeErrors, "denied event unit")
__deniedValues.target = nil

-- Outer and child containers are approved before indexing or iteration.
rebuildTarget()
local deniedUpdate = poisonTable()
__deniedTables[deniedUpdate] = true
beforeCallbacks, beforeErrors = callbackCount(), #__errors
ok = pcall(RGX.FireEvent, RGX, "UNIT_AURA", "target", deniedUpdate)
check(ok and Auras._cache.target.valid == false, "denied updateInfo should invalidate without indexing")
checkRestrictedSilence(beforeCallbacks, beforeErrors, "denied updateInfo")

rebuildTarget()
local deniedAddedList = poisonTable()
__deniedTables[deniedAddedList] = true
beforeCallbacks, beforeErrors = callbackCount(), #__errors
ok = pcall(RGX.FireEvent, RGX, "UNIT_AURA", "target", {
    isFullUpdate = false,
    addedAuras = deniedAddedList,
})
check(ok and Auras._cache.target.valid == false, "denied child tables should invalidate without iteration")
checkRestrictedSilence(beforeCallbacks, beforeErrors, "denied child table")

rebuildTarget()
local deniedAddedAura = poisonTable()
__deniedTables[deniedAddedAura] = true
beforeCallbacks, beforeErrors = callbackCount(), #__errors
ok = pcall(RGX.FireEvent, RGX, "UNIT_AURA", "target", {
    isFullUpdate = false,
    addedAuras = { deniedAddedAura },
})
check(ok and Auras._cache.target.valid == false, "denied added AuraData should never be indexed")
checkRestrictedSilence(beforeCallbacks, beforeErrors, "denied added AuraData")

rebuildTarget()
local aura303 = { spellId = 303, auraInstanceID = 303 }
__deniedValues[303] = true
beforeCallbacks, beforeErrors = callbackCount(), #__errors
RGX:FireEvent("UNIT_AURA", "target", { isFullUpdate = false, addedAuras = { aura303 } })
check(Auras._cache.target.valid == false, "denied instance IDs should invalidate before cache-key use")
checkRestrictedSilence(beforeCallbacks, beforeErrors, "denied instance ID")
__deniedValues[303] = nil

rebuildTarget()
local aura304 = { spellId = 304, auraInstanceID = 304 }
__secretInstances[instanceKey("target", 304)] = true
beforeCallbacks, beforeErrors = callbackCount(), #__errors
RGX:FireEvent("UNIT_AURA", "target", { isFullUpdate = false, addedAuras = { aura304 } })
check(Auras._cache.target.valid == false, "secret aura instances should never enter the cache")
checkRestrictedSilence(beforeCallbacks, beforeErrors, "secret aura instance")
__secretInstances[instanceKey("target", 304)] = nil

-- A denied getter result is distinct from an absent aura and invalidates the
-- entire transaction before earlier removal/addition data can be committed.
rebuildTarget()
local deniedGetterAura = poisonTable()
__deniedTables[deniedGetterAura] = true
__auras.target.HELPFUL = { deniedGetterAura }
beforeCallbacks, beforeErrors = callbackCount(), #__errors
ok = pcall(RGX.FireEvent, RGX, "UNIT_AURA", "target", { isFullUpdate = true })
check(ok and Auras._cache.target.valid == false, "denied rebuild results should not publish a partial cache")
checkRestrictedSilence(beforeCallbacks, beforeErrors, "denied rebuild result")
__auras.target.HELPFUL = { aura101 }

rebuildTarget()
local aura305 = { spellId = 305, auraInstanceID = 305 }
local deniedUpdatedAura = poisonTable()
__deniedTables[deniedUpdatedAura] = true
__instances[101] = deniedUpdatedAura
beforeCallbacks, beforeErrors = callbackCount(), #__errors
ok = pcall(RGX.FireEvent, RGX, "UNIT_AURA", "target", {
    isFullUpdate = false,
    removedAuraInstanceIDs = { 101 },
    addedAuras = { aura305 },
    updatedAuraInstanceIDs = { 101 },
})
check(ok and Auras._cache.target.valid == false, "denied update results should reject the complete delta")
checkRestrictedSilence(beforeCallbacks, beforeErrors, "denied updated AuraData")
__instances[101] = aura101

-- Event-wide secrecy is checked before touching updateInfo.
rebuildTarget()
__auraEventSecret = true
local secretEventPayload = poisonTable()
beforeCallbacks, beforeErrors = callbackCount(), #__errors
ok = pcall(RGX.FireEvent, RGX, "UNIT_AURA", "target", secretEventPayload)
check(ok and Auras._cache.target.valid == false, "secret UNIT_AURA payloads should be suppressed unopened")
checkRestrictedSilence(beforeCallbacks, beforeErrors, "secret UNIT_AURA payload")
__auraEventSecret = false

-- Cached snapshots are rechecked against current instance secrecy.
rebuildTarget()
__secretInstances[instanceKey("target", 101)] = true
check(Auras:GetAuraByInstanceID("target", 101) == nil, "current instance secrecy should hide cached data")
__secretInstances[instanceKey("target", 101)] = nil
check(Auras:GetAuraByInstanceID("target", 101) == aura101, "cache should recover when the instance is accessible")

-- On secret-capable unknown/partial environments, missing generic predicates
-- fail closed rather than assuming accessibility.
local savedCanAccessValue, savedIsSecretValue = canaccessvalue, issecretvalue
canaccessvalue, issecretvalue = nil, nil
check(not RGX.API.CanAccessValue(123), "missing value predicates should fail closed under restrictions")
canaccessvalue, issecretvalue = savedCanAccessValue, savedIsSecretValue

local savedCanAccessTable, savedIsSecretTable = canaccesstable, issecrettable
canaccesstable, issecrettable = nil, nil
check(not RGX.API.CanAccessTable({}), "missing table predicates should fail closed under restrictions")
canaccesstable, issecrettable = savedCanAccessTable, savedIsSecretTable

__rgxAuraTestResult = string.format(
    "LUA RUNTIME OK  restricted aura boundary (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
__rgxAuraCheckCount = checks
