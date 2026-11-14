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

-- Forever has no stable realms and UnitName returns first + surname: the
-- character key is the full name, never "Name - Realm".
do
    local tName = "RGX_TestDB_ForeverChar"
    _G[tName] = nil
    local savedUnitName, savedRealm = UnitName, GetRealmName
    RGX.isForever = true
    UnitName = function() return "Donnie", "Dice" end
    GetRealmName = function() return "Classic Beta PvP" end
    local fdb = RGX:NewDatabase(tName, { enabled = true }, {})
    check(fdb:GetCharKey() == "Donnie Dice", "forever: char key must be the full name")
    fdb.char.zone = "Elwynn"
    check(_G[tName].char["Donnie Dice"].zone == "Elwynn",
        "forever: char storage must land under the full-name key")
    UnitName, GetRealmName = savedUnitName, savedRealm
    RGX.isForever = nil
    _G[tName] = nil
end

if #failures > 0 then
    
-- ── Dotted-path helpers (mutation coverage): string paths, table paths,
--        missing nodes, intermediate creation, and guard returns.
local pathDB = { a = { b = { c = 7 } }, items = { [3] = "three" } }
check(RGX:DBGet(pathDB, "a.b.c") == 7, "string path must resolve")
check(RGX:DBGet(pathDB, { "a", "b", "c" }) == 7, "table path must resolve")
check(RGX:DBGet(pathDB, "a.missing.deep", "fallback") == "fallback",
    "a missing node must return the fallback")
check(RGX:DBGet(pathDB, "items.3") == "three", "numeric string path segments must index")
check(RGX:DBGet(pathDB, nil, "fb") == pathDB, "a nil path must return the table itself")
check(RGX:DBGet(pathDB, "x", 99) == 99, "a missing top segment must return the fallback")
RGX:DBSet(pathDB, "new.deeper.leaf", 42)
check(pathDB.new.deeper.leaf == 42, "DBSet must create intermediate tables")
RGX:DBSet(pathDB, { "items", 4 }, "four")
check(pathDB.items[4] == "four", "DBSet must accept table paths")
check(RGX:DBSet(pathDB, nil, 1) == false, "DBSet with a nil path must refuse")

-- ── MigrateDB boundaries: version 1 runs; stored == current is a no-op.
local m1 = {}
local ranOne = false
RGX:MigrateDB(m1, "M1", 1, { [1] = function(d) ranOne = true; d.marked = true end })
check(ranOne == true and m1._dbVersion == 1, "version 1 must run its migration")
local mSame = { _dbVersion = 2 }
local ranSame = false
RGX:MigrateDB(mSame, "MS", 2, { [1] = function() ranSame = true end })
check(ranSame == false and mSame._dbVersion == 2,
    "stored == current must be a no-op without running anything")

-- ── Serialization wire edges: every escape character, separators in keys,
--        nested tables, empty-table values, and round-trip stability.
local wireSample = {
    allEscapes = "a\\b;c=d{e}f",
    trailing = "end\\",
    semis = ";;;;",
    braces = "{{}}",
    equals = "====",
    nested = { deep = { deeper = { leaf = "\\;" } }, empty = nil },
    numericKey = 5,
    strKey = { ["123"] = "numeric-string key" },
}
local encoded = RGX:SerializeTable(wireSample)
local decoded = RGX:DeserializeTable(encoded)
check(decoded and decoded.allEscapes == wireSample.allEscapes,
    "backslash/separator escapes must round-trip")
check(decoded.trailing == wireSample.trailing, "a trailing backslash must round-trip")
check(decoded.semis == ";;;;" and decoded.braces == "{{}}" and decoded.equals == "====",
    "raw separator runs must round-trip")
check(decoded.nested and decoded.nested.deep and decoded.nested.deep.deeper.leaf == "\\;",
    "deeply nested escapes must round-trip")
check(type(decoded.numericKey) == "number" and decoded.numericKey == 5,
    "a nil table value must not break the tree")
check(decoded.strKey["123"] == "numeric-string key",
    "string keys must be escaped and recoverable")
check(RGX:DeserializeTable("") == nil, "an empty wire string must deserialize to nil")
check(RGX:DeserializeTable("RGX_DB_v1:T") == nil or type(RGX:DeserializeTable("RGX_DB_v1:T")) == "table",
    "a malformed body must not crash")


__rgxDbTestResult = "FAILED (" .. #failures .. "): " .. table.concat(failures, " | ")
else
    __rgxDbTestResult = "PASSED"
end
