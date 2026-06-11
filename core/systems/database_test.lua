--[[
    RGX-Framework - Database Tests
]]

local _, RGX = ...

function RGX:RunDBTests()
    self:Print("Running Database System Tests...")

    local testDBName = "RGX_TestDB"
    _G[testDBName] = nil -- Clear previous test data

    local defaults = {
        enabled = true,
        volume = 0.5,
        nested = {
            value = 10,
            text = "hello"
        }
    }

    local switchCount = 0
    local lastProfileName = ""
    local lastProfileData = nil

    local db = self:NewDatabase(testDBName, defaults, {
        onSwitch = function(name, profile)
            switchCount = switchCount + 1
            lastProfileName = name
            lastProfileData = profile
        end
    })

    -- 1. Initial State
    assert(db.enabled == true, "Initial enabled should be true")
    assert(db.volume == 0.5, "Initial volume should be 0.5")
    assert(db.nested.value == 10, "Initial nested value should be 10")
    assert(db:GetActiveProfile() == "Default", "Initial profile should be 'Default'")
    assert(switchCount == 1, "onSwitch should fire once on initialization")
    assert(lastProfileName == "Default", "Initial onSwitch should pass 'Default'")

    -- 2. Value Modification
    db.enabled = false
    db.volume = 0.8
    assert(db.enabled == false, "Modified enabled should be false")
    assert(db.volume == 0.8, "Modified volume should be 0.8")
    assert(_G[testDBName].profiles.Default.enabled == false, "Raw table should be updated")

    -- 3. Nested Modification (Caution: Proxy doesn't catch nested writes directly, but it works because we return the table)
    db.nested.value = 20
    assert(db.nested.value == 20, "Nested value should be updated")
    assert(_G[testDBName].profiles.Default.nested.value == 20, "Raw nested table should be updated")

    -- 4. Profile Creation
    local success = db:CreateProfile("Tank")
    assert(success == true, "CreateProfile('Tank') should succeed")
    assert(db:GetActiveProfile() == "Tank", "Active profile should now be 'Tank'")
    assert(db.enabled == true, "New profile should have default values")
    assert(db.nested.value == 10, "New profile should have default nested values")
    assert(switchCount == 2, "onSwitch should fire on profile creation")

    -- 5. Profile Switching
    db.enabled = false -- Change Tank value
    db:LoadProfile("Default")
    assert(db:GetActiveProfile() == "Default", "Should be back on 'Default'")
    assert(db.enabled == false, "Default should still be false")
    assert(switchCount == 3, "onSwitch should fire on profile load")

    db:LoadProfile("Tank")
    assert(db.enabled == false, "Tank should still be false")

    -- 6. Profile Copying
    db:CopyProfile("Tank", "Healer")
    assert(db:GetActiveProfile() == "Healer", "Active profile should be 'Healer'")
    assert(db.enabled == false, "Healer should have copied values from Tank")
    assert(db.nested.value == 10, "Healer should have nested values from Tank")

    -- 7. Reset Profile
    db:ResetProfile()
    assert(db.enabled == true, "Reset profile should have default values")
    assert(db.nested.value == 10, "Reset profile should have default nested values")

    -- 8. Deletion
    db:DeleteProfile("Tank")
    local profiles = db:ListProfiles()
    local found = false
    for _, name in ipairs(profiles) do
        if name == "Tank" then found = true end
    end
    assert(not found, "Tank should be deleted")

    -- 9. Global Storage
    db.global.lastLogin = 12345
    assert(_G[testDBName].global.lastLogin == 12345, "Global should be in raw table")
    assert(db.global.lastLogin == 12345, "Global should be readable from proxy")

 -- 10. Metamethod methods
 assert(type(db.CreateProfile) == "function", "Methods should be accessible via proxy")

 -- 11. GetProfile returns the active profile table
 db:LoadProfile("Default")
 local profile = db:GetProfile()
 assert(type(profile) == "table", "GetProfile should return a table")
 assert(profile.enabled == false, "GetProfile should reflect current values")

 -- 12. ResetProfile works on Default (the protected profile)
 db:LoadProfile("Default")
 db.enabled = false
 db.volume = 0.0
 local resetOk = db:ResetProfile()
 assert(resetOk == true, "ResetProfile should succeed on Default")
 assert(db.enabled == true, "Default should be reset to defaults")
 assert(db.volume == 0.5, "Default volume should be reset to 0.5")

 -- 13. Internal fields don't leak into profile
 assert(profile._guard == nil, "_guard should not appear in profile data")
 assert(profile._raw == nil, "_raw should not appear in profile data")
 assert(profile._defaults == nil, "_defaults should not appear in profile data")

 -- 14. Path accessors
 db:Set({"nested", "value"}, 99)
 assert(db:Get({"nested", "value"}) == 99, "Table path Get/Set should work")
 db:Set("nested.value", 88)
 assert(db:Get("nested.value") == 88, "String dot-path Get/Set should work")

 -- Cleanup
    _G[testDBName] = nil

    self:Print("Database System Tests: |cff00ff00PASSED|r")
end
