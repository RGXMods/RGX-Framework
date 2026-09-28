#!/usr/bin/env node
// Database behavior checks in a real Lua 5.1 VM (wasmoon). Mirrors the
// in-game /rgx dbtest harness blocks that cover profileIsGlobal + the
// SavedVariables adoption flow, so regressions fail CI before they reach a
// client. Not a WoW emulator; only the globals database.lua touches are
// stubbed.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const files = {
  database: join(ROOT, "core", "systems", "database.lua"),
  test: join(HERE, "database-runtime-test.lua"),
};

const lua = await Lua.create();
try {
  lua.ctx.__rgxDatabaseSource = readFileSync(files.database, "utf8");
  lua.ctx.__rgxDbTestSource = readFileSync(files.test, "utf8");

  lua.doStringSync(`
    local RGX = { _databases = {} }
    function RGX:Print(...) end
    function RGX:Error(...) end
    function RGX:Debug(...) end
    SlashCmdList = {}
    function UnitName() return "TestChar" end
    function GetRealmName() return "TestRealm" end
    function StaticPopup_Show() end
    function CreateFrame()
        local frame = { scripts = {} }
        function frame:SetScript(name, handler) self.scripts[name] = handler end
        function frame:Show() self._shown = true end
        function frame:Hide() self._shown = false end
        return frame
    end

    local function loadSource(source, path)
        local chunk, err = loadstring(source, "@" .. path)
        assert(chunk, err)
        return chunk
    end

    loadSource(__rgxDatabaseSource, "core/systems/database.lua")("RGX-Framework", RGX)
    loadSource(__rgxDbTestSource, "tools/ci/database-runtime-test.lua")("RGX-Framework", RGX)
  `);

  console.log(lua.ctx.__rgxDbTestResult);
  if (String(lua.ctx.__rgxDbTestResult || "").indexOf("PASSED") === -1) {
    process.exit(1);
  }
} finally {
  lua.global.close();
}
