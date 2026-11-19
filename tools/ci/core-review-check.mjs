#!/usr/bin/env node
// Core fixes from the whole-project review: repeating timers do not replay a backlog after a long frame gap, Split treats its delimiter literally, the legacy API fallbacks keep every
// return value, a profile import only accepts a profile table, and the import/export popups find the edit box on
// clients where it is EditBox or GetEditBox().
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = (p) => readFileSync(join(ROOT, p), "utf8");
const lua = await Lua.create();
Object.assign(lua.ctx, { __core: src("core/core.lua"), __events: src("core/systems/events.lua"), __runtime: src("core/systems/runtime.lua"),
  __utils: src("core/systems/utils.lua"), __compat: src("core/compat.lua"), __db: src("core/systems/database.lua") });
try {
  lua.doStringSync(String.raw`
    InCombatLockdown = function() return false end
    UnitAffectingCombat = function() return false end
    SlashCmdList = {}
    geterrorhandler = function() return function(m) error(m, 0) end end
    __clock = 0
    GetTime = function() return __clock end
    GetTimePreciseSec = function() return __clock end
    debugprofilestop = function() return __clock * 1000 end
    function CreateFrame()
      local f = { scripts = {} }
      function f:SetScript(n, fn) self.scripts[n] = fn end
      function f:RegisterEvent() end
      function f:UnregisterEvent() end
      function f:IsEventRegistered() return false end
      function f:Show() end
      function f:Hide() end
      return f
    end
    function hooksecurefunc() end
    local function load(text, path, ...) local c = assert(loadstring(text, "@" .. path)); return c(...) end
    local RGX = {}
    load(__core, "core/core.lua", "RGX-Framework", RGX)
    RGX.API = RGX.API or {}
    load(__events, "core/systems/events.lua", "RGX-Framework", RGX)
    load(__runtime, "core/systems/runtime.lua", "RGX-Framework", RGX)
    load(__utils, "core/systems/utils.lua", "RGX-Framework", RGX)
    load(__compat, "core/compat.lua", "RGX-Framework", RGX)
    local failures = {}
    local function check(ok, msg) if not ok then failures[#failures + 1] = msg end end

    -- Timers: a 1s repeating timer after a 10s gap fires once, then keeps its rhythm.
    local fired = 0
    RGX:Every(1, function() fired = fired + 1 end, "review-every")
    local drive = RGX.timerFrame.scripts.OnUpdate
    __clock = 10; drive(nil, 10)
    local afterGap = fired
    for _ = 1, 5 do __clock = __clock + 0.016; drive(nil, 0.016) end
    check(afterGap == 1 and fired == 1, "a repeating timer replays no backlog after a long gap (fired " .. afterGap .. " then " .. fired .. ")")
    __clock = __clock + 1; drive(nil, 1)
    check(fired == 2, "the repeating timer fires again one period later (fired " .. fired .. ")")

    -- An addon registering two handlers for the same event without ids keeps both; the same callback twice stays one.
    local addon = RGX.Addon("ReviewIds", {})
    local first, second = 0, 0
    local f1 = function() first = first + 1 end
    addon:RegisterEvent("REVIEW_IDS_EVENT", f1)
    addon:RegisterEvent("REVIEW_IDS_EVENT", function() second = second + 1 end)
    addon:RegisterEvent("REVIEW_IDS_EVENT", f1)
    RGX:FireEvent("REVIEW_IDS_EVENT")
    check(first == 1 and second == 1, "both handlers run once (" .. first .. ", " .. second .. ")")
    addon:UnregisterEvent("REVIEW_IDS_EVENT")
    RGX:FireEvent("REVIEW_IDS_EVENT")
    check(first == 1 and second == 1, "UnregisterEvent without an id removes all of the addon's handlers")
    local msgs = 0
    addon:RegisterMessage("REVIEW_IDS_MSG", function() msgs = msgs + 1 end)
    addon:RegisterMessage("REVIEW_IDS_MSG", function() msgs = msgs + 10 end)
    RGX:SendMessage("REVIEW_IDS_MSG")
    check(msgs == 11, "two message handlers both run (" .. msgs .. ")")

    -- MergeTable fills only what is missing: a saved non-table value is kept even when the default is a table.
    local saved = { minimap = false, nested = { a = 1 } }
    RGX:MergeTable(saved, { minimap = { hide = false }, nested = { a = 2, b = 3 }, fresh = { x = 1 } })
    check(saved.minimap == false, "a saved false is kept over a table default")
    check(saved.nested.a == 1 and saved.nested.b == 3, "nested defaults fill only missing keys")
    check(type(saved.fresh) == "table" and saved.fresh.x == 1, "a missing table default is copied in")

    -- Split: the delimiter is literal.
    local parts = RGX:Split("1.2.3", ".")
    check(#parts == 3 and parts[1] == "1" and parts[3] == "3", "Split on '.' gives 1,2,3 (got " .. table.concat(parts, "|") .. ")")
    local pct = RGX:Split("a%b", "%")
    check(#pct == 2 and pct[1] == "a" and pct[2] == "b", "Split on '%' works")
    local plain = RGX:Split("a,b,,c", ",")
    check(#plain == 4 and plain[3] == "", "Split keeps empty fields")

    -- Compat fallbacks: legacy functions keep every return value (and a false first value).
    C_Spell, C_Item = nil, nil
    GetSpellInfo = function() return "Name", nil, 123, 1500 end
    GetSpellCooldown = function() return 10, 5, 1, 1 end
    IsUsableSpell = function() return false, true end
    GetItemInfo = function() return "Item", "link", 4 end
    local n, _, icon, cast = RGX.API.GetSpellInfo(1)
    check(n == "Name" and icon == 123 and cast == 1500, "GetSpellInfo fallback keeps the icon and cast time")
    local st, dur = RGX.API.GetSpellCooldown(1)
    check(st == 10 and dur == 5, "GetSpellCooldown fallback keeps the duration")
    local usable, noMana = RGX.API.IsUsableSpell(1)
    check(usable == false and noMana == true, "IsUsableSpell fallback keeps false and the mana flag")
    local iname, ilink, iq = RGX.API.GetItemInfo(1)
    check(iname == "Item" and ilink == "link" and iq == 4, "GetItemInfo fallback keeps the link and quality")

    -- Database popups and import.
    local shown = {}
    StaticPopupDialogs = {}
    StaticPopup_Show = function(name) shown[#shown + 1] = name end
    date = function() return "20261118_000000" end
    UnitName = function() return "Tester" end
    GetRealmName = function() return "Realm" end
    load(__db, "core/systems/database.lua", "RGX-Framework", RGX)
    local box = { text = "" }
    function box:SetText(t) self.text = t end
    function box:GetText() return self.text end
    function box:HighlightText() end
    RGX:ShowExportDialog("t", "DATA")
    StaticPopupDialogs.RGX_EXPORT.OnShow({ EditBox = box })
    check(box.text == "DATA", "export fills the edit box when the client names it EditBox")
    box.text = ""
    StaticPopupDialogs.RGX_EXPORT.OnShow({ GetEditBox = function() return box end })
    check(box.text == "DATA", "export fills the edit box reached through GetEditBox()")
    local imported
    RGX:ShowImportDialog("t", function(s) imported = s end)
    box.text = "PASTED"
    StaticPopupDialogs.RGX_IMPORT.OnAccept({ EditBox = box })
    check(imported == "PASTED", "import reads the edit box when the client names it EditBox")

    _G.TestDB = nil
    local db = RGX:NewDatabase("TestDB", { a = 1 })
    db.DeserializeProfile = function() return "not a table" end
    local okImport = pcall(function()
      db:ShowImportDialog()
      StaticPopupDialogs.RGX_IMPORT.OnAccept({ editBox = box })
    end)
    local profiles = 0
    for name in pairs(_G.TestDB.profiles or {}) do if name:find("^Imported_") then profiles = profiles + 1 end end
    check(okImport and profiles == 0, "an import that is not a profile table is refused, not stored")

    if #failures > 0 then error(table.concat(failures, "\n")) end
    result = "CORE REVIEW OK"
  `);
  console.log(lua.ctx.result);
} catch (error) {
  console.error(`CORE REVIEW FAIL\n${error.message}`);
  process.exitCode = 1;
} finally {
  lua.global.close();
}
