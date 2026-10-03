-- Database runtime tests (Lua 5.1 VM, WoW globals stubbed by the runner).
-- Mirrors the in-game /rgx dbtest harness (blocks 16-17) plus the consumer-style
-- capture/adopt/persist flow that motivated the view + Adopt work.

local _, RGX = ...

local failures = {}
local function check(cond, msg)
    if not cond then
        failures[#failures + 1] = msg
    end
end

-- 17. profileIsGlobal live view + SavedVariables adoption
do
    local tName = "RGX_TestDB_Adopt"
    _G[tName] = nil
    local adb = RGX:NewDatabase(tName, { enabled = true }, { profileIsGlobal = true })
    local captured = adb.global
    check(type(captured) == "table", "17: db.global should return a table")
    local loaded = { profiles = { Default = { enabled = false, kept = "yes" } }, global = {}, char = {} }
    _G[tName] = loaded
    check(adb:Adopt() == true, "17: Adopt should adopt the client-loaded table")
    check(captured.enabled == false, "17: view: captured db.global should read adopted data")
    check(captured.kept == "yes", "17: view: adopted values should be visible through the view")
    captured.newKey = 7
    check(loaded.profiles.Default.newKey == 7, "17: view: writes should land in the adopted profile")
    check(captured.enabled == false, "17: Adopt: FillDefaults must not clobber saved values")
    _G[tName] = nil
end

-- Consumer-style flow: capture at chunk time, adopt at ADDON_LOADED, persist after
do
    local sName = "SIM_CONSUMER_Settings"
    _G[sName] = nil
    local sdb = RGX:NewDatabase(sName, { enabled = true, showQuestMarker = true }, { profileIsGlobal = true })
    local S = sdb.global -- MySettings = MyAddon.db.global (captured once)
    S.enabled = false    -- in-session toggle (pre-adoption, lands in orphan)
    local saved = { profiles = { Default = { enabled = true, scale = 1.5 } }, global = {}, char = {} }
    _G[sName] = saved    -- client deserializes SavedVariables, replacing the global
    check(sdb:Adopt() == true, "consumer: adopt should return true")
    check(S.enabled == true, "consumer: view should read the loaded value after adoption")
    S.showQuestMarker = false -- post-adoption toggle
    check(saved.profiles.Default.showQuestMarker == false,
        "consumer: post-adoption writes must land in the loaded table")
    check(saved.profiles.Default.scale == 1.5, "consumer: loaded values must survive adoption")
end

-- 16. profileIsGlobal basics (existing in-game asserts)
do
    local gName = "SIM_GlobalAsProfile"
    _G[gName] = nil
    local gdb = RGX:NewDatabase(gName, { settingA = "hi", settingB = 42 }, { profileIsGlobal = true })
    check(gdb.global.settingA == "hi", "16: defaults readable through db.global")
    gdb.global.settingB = 99
    check(gdb.global.settingB == 99, "16: db.global writes should persist")
    check(_G[gName].profiles.Default.settingB == 99, "16: writes should land in the profile")
    _G[gName] = nil
end

-- Session round-trip: profile selection and profile data must survive a full
-- write → simulated logout → reload cycle (the consumer-class bug: writes landed in
-- a database the client never persisted). The client hand-back is modeled by
-- reassigning the SavedVariables global with the same content, which is what
-- happens when the serialised table deserializes before ADDON_LOADED.
do
    local tName = "RGX_TestDB_RoundTrip"
    local defaults = { enabled = true, scale = 1.0 }
    _G[tName] = nil

    local db = RGX:NewDatabase(tName, defaults, {})
    check(db:GetActiveProfile() == "Default", "round-trip: initial profile should be Default")
    db:CreateProfile("Tank")
    db.scale = 2.5
    db.enabled = false
    check(_G[tName].profiles.Tank.scale == 2.5, "round-trip: write must land in Tank")
    check(_G[tName].activeProfile == "Tank", "round-trip: activeProfile must switch")

    local savedContent = _G[tName]
    _G[tName] = savedContent -- client deserialization returns equivalent content
    local db2 = RGX:NewDatabase(tName, defaults, {})
    check(db2:GetActiveProfile() == "Tank", "round-trip: active profile must persist across reload")
    check(db2.scale == 2.5, "round-trip: profile data must persist across reload")
    check(db2.enabled == false, "round-trip: stored false must survive, not fall back to default")
    check(db2.global ~= nil, "round-trip: global table must exist")
    check(db2.char ~= nil, "round-trip: char table must exist")
    _G[tName] = nil
end

-- profileIsGlobal round-trip: the captured db.global view (settings-alias style)
-- must survive a reload and keep addressing whichever profile is active.
do
    local tName = "RGX_TestDB_GlobalViewRoundTrip"
    _G[tName] = nil
    local gdb = RGX:NewDatabase(tName, { enabled = true, scale = 1.0 }, { profileIsGlobal = true })
    local G = gdb.global
    gdb:CreateProfile("DPS")
    G.enabled = false
    check(_G[tName].profiles.DPS.enabled == false, "global-view: write through the view must persist to the profile")
    check(_G[tName].activeProfile == "DPS", "global-view: activeProfile must switch")

    local savedContent = _G[tName]
    local gdb2 = RGX:NewDatabase(tName, { enabled = true, scale = 1.0 }, { profileIsGlobal = true })
    check(gdb2:GetActiveProfile() == "DPS", "global-view: profile selection must persist across reload")
    local G2 = gdb2.global
    check(G2.enabled == false, "global-view: a fresh capture reads the persisted value")
    G2.scale = 42
    check(savedContent.profiles.DPS.scale == 42, "global-view: writes through a fresh view land in the saved profile")
    check(G.scale == 42, "global-view: the pre-reload capture follows the same content")
    _G[tName] = nil
end

if #failures > 0 then
    __rgxDbTestResult = "FAILED (" .. #failures .. "): " .. table.concat(failures, " | ")
else
    __rgxDbTestResult = "PASSED"
end
