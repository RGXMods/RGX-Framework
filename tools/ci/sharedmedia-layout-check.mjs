#!/usr/bin/env node
// RGXSharedMedia follows the standard sound layout (RGXSound.LAYOUT): a player's own files, in an addon's
// sounds\user\ folder or its <Addon>_Sounds folder, are listed under "<Addon> User Sounds", apart from what the addon
// ships; RegisterUserSounds puts an addon's user sounds in that same pack.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lua = await Lua.create();
lua.ctx.smSource = readFileSync(join(ROOT, "libraries/sharedmedia/sharedmedia.lua"), "utf8");
lua.ctx.soundSource = readFileSync(join(ROOT, "libraries/sound/sound.lua"), "utf8");
try {
  lua.doStringSync(String.raw`
    local RGX = { modules = {}, After = function(_, _, fn) end,
      RegisterModule = function(self, name, m) self.modules[name] = m end,
      GetModule = function(self, name) return self.modules[name] end,
      RegisterEvent = function() end, Debug = function() end, SendMessage = function() end }
    _G.RGXFramework = RGX
    assert(loadstring(soundSource))("RGX-Framework", {})
    RGX.modules.sound = RGX.modules.sound or _G.RGXSound
    assert(loadstring(smSource))("RGX-Framework", RGX)
    local SM = RGX.modules.sharedmedia or _G.RGXSharedMedia
    local failures = {}
    local function check(ok, msg) if not ok then failures[#failures + 1] = msg end end

    check(SM:PackNameForPath("Interface\\AddOns\\BLU\\sounds\\user\\boop.ogg") == "BLU User Sounds", "sounds\\user is the addon's user sounds")
    check(SM:PackNameForPath("Interface\\AddOns\\BLU_Sounds\\boop.ogg") == "BLU User Sounds", "<Addon>_Sounds is the addon's user sounds")
    check(SM:PackNameForPath("Interface\\AddOns\\BLU\\sounds\\game\\x.ogg") == "BLU", "shipped sounds stay the addon's pack")
    check(SM:PackNameForPath("Interface\\AddOns\\Other\\media\\x.ogg") == "Other", "no layout: the addon folder")

    check(SM:_BridgePath("Interface\\AddOns\\MyAddon\\sounds\\user\\mine.ogg") == true, "a found user sound is bridged")
    local packs = SM:ListPacks("sound") or {}
    local seen = false
    for k, v in pairs(packs) do
      local name = type(v) == "table" and (v.name or v.packName) or (type(k) == "string" and k) or v
      if name == "MyAddon User Sounds" then seen = true end
    end
    check(seen, "the bridged user sound is in the MyAddon User Sounds pack")

    check(SM:RegisterUserSounds("BLU", { Boop = "Interface\\AddOns\\BLU_Sounds\\boop2.ogg" }) == 1, "RegisterUserSounds registers")
    local entry = SM:Find("sound", "Boop")
    check(entry and entry.packName == "BLU User Sounds", "registered into the addon's user sounds pack")
    check(SM:RegisterUserSounds("", {}) == 0, "no addon name: nothing registered")

    if #failures > 0 then error(table.concat(failures, "\n")) end
    result = "SHAREDMEDIA LAYOUT OK"
  `);
  console.log(lua.ctx.result);
} catch (error) {
  console.error(`SHAREDMEDIA LAYOUT FAIL\n${error.message}`);
  process.exitCode = 1;
} finally {
  lua.global.close();
}
