-- Database runtime tests (Lua 5.1 VM, WoW globals stubbed by the runner).
-- Mirrors the in-game /rgx dbtest harness (blocks 16-17) plus the SQP-style
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

-- SQP-style flow: capture at chunk time, adopt at ADDON_LOADED, persist after
do
    local sName = "SIM_SQP_Settings"
    _G[sName] = nil
    local sdb = RGX:NewDatabase(sName, { enabled = true, showQuestMarker = true }, { profileIsGlobal = true })
    local S = sdb.global -- SQPSettings = SQP.db.global (captured once)
    S.enabled = false    -- in-session toggle (pre-adoption, lands in orphan)
    local saved = { profiles = { Default = { enabled = true, scale = 1.5 } }, global = {}, char = {} }
    _G[sName] = saved    -- client deserializes SavedVariables, replacing the global
    check(sdb:Adopt() == true, "SQP: adopt should return true")
    check(S.enabled == true, "SQP: view should read the loaded value after adoption")
    S.showQuestMarker = false -- post-adoption toggle
    check(saved.profiles.Default.showQuestMarker == false,
        "SQP: post-adoption writes must land in the loaded table")
    check(saved.profiles.Default.scale == 1.5, "SQP: loaded values must survive adoption")
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

if #failures > 0 then
    __rgxDbTestResult = "FAILED (" .. #failures .. "): " .. table.concat(failures, " | ")
else
    __rgxDbTestResult = "PASSED"
end
