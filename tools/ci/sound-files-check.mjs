#!/usr/bin/env node
// Personal sound files: an addon names the folders it looks in, the player types a file name the way they think of
// it (with or without the extension, spaces or underscores), and the framework finds the file the game can play.
// The game only reports whether a file plays, so every lookup is a play probe that is stopped at once.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lua = await Lua.create();
lua.ctx.source = readFileSync(join(ROOT, "libraries/sound/sound.lua"), "utf8");
try {
  lua.doStringSync(String.raw`
    local files = {}            -- lower-cased paths the fake game can play
    local muted = {}
    local played, stopped = {}, {}
    local muteBlocksPlay = false
    function MuteSoundFile(p) muted[p] = true end
    function UnmuteSoundFile(p) muted[p] = nil end
    function PlaySoundFile(p, channel)
      played[#played + 1] = p
      if muteBlocksPlay and muted[p] then return false end
      if files[string.lower(p)] then return true, #played end
      return false
    end
    function StopSound(h) stopped[#stopped + 1] = h end
    local modules = {}
    RGXFramework = {}
    function RGXFramework:RegisterModule(name, m) modules[name] = m end
    function RGXFramework:GetModule(name) return modules[name] end
    local S = {}
    assert(loadstring(source))("RGX-Framework", S)
    local failures = {}
    local function check(ok, msg) if not ok then failures[#failures + 1] = msg end end
    local FOLDERS = { "Interface\\AddOns\\My_Sounds\\", "Interface\\AddOns\\MyAddon\\sounds\\" }

    files["interface\\addons\\my_sounds\\sonar_boop_med.ogg"] = true
    files["interface\\addons\\myaddon\\sounds\\ding.mp3"] = true
    files["interface\\addons\\my_sounds\\two words.wav"] = true

    check(S:ProbeFile("Interface\\AddOns\\My_Sounds\\sonar_boop_med.ogg") == true, "a present file probes true")
    check(S:ProbeFile("Interface\\AddOns\\My_Sounds\\nope.ogg") == false, "a missing file probes false")
    check(#stopped >= 1, "a probe stops what it started")
    check(next(muted) == nil, "a probe leaves nothing muted")
    check(S:ProbeFile(nil) == false and S:ProbeFile("") == false, "no path probes false")

    local function resolves(input, want, label)
      local path, tried = S:ResolveFile(input, { folders = FOLDERS })
      check(path == want, label .. ": got " .. tostring(path))
      return path, tried
    end
    resolves("sonar_boop_med.ogg", "Interface\\AddOns\\My_Sounds\\sonar_boop_med.ogg", "name with extension")
    resolves("sonar_boop_med", "Interface\\AddOns\\My_Sounds\\sonar_boop_med.ogg", "bare name finds the extension")
    resolves("sonar boop med", "Interface\\AddOns\\My_Sounds\\sonar_boop_med.ogg", "spaces find the underscored file")
    resolves("  Sonar_Boop_Med.OGG ", "Interface\\AddOns\\My_Sounds\\Sonar_Boop_Med.OGG", "case and padding")
    resolves("two_words", "Interface\\AddOns\\My_Sounds\\two words.wav", "underscores find the spaced file")
    resolves("ding", "Interface\\AddOns\\MyAddon\\sounds\\ding.mp3", "the second folder is searched")
    resolves("Interface/AddOns/MyAddon/sounds/ding.mp3", "Interface\\AddOns\\MyAddon\\sounds\\ding.mp3", "a full path with forward slashes")
    resolves("Interface\\AddOns\\MyAddon\\sounds\\ding", "Interface\\AddOns\\MyAddon\\sounds\\ding.mp3", "a full path without extension")

    local missing, tried = S:ResolveFile("nothere", { folders = FOLDERS })
    check(missing == nil, "a missing file does not resolve")
    check(type(tried) == "table" and tried[1] == "Interface\\AddOns\\My_Sounds\\nothere.ogg", "the designated folder is tried first")
    check(#tried == 6, "every folder and extension is reported (" .. tostring(#tried) .. ")")
    check(S:ResolveFile("", { folders = FOLDERS }) == nil, "empty input does not resolve")
    check(S:ResolveFile("..\\..\\x.ogg", { folders = FOLDERS }) == nil, "a path outside the AddOns folder does not resolve")

    -- Smart lookup: the ways players actually misname or misplace a file -------------------------------------------
    local DEEP = { folders = FOLDERS, deep = true }
    local function deep(input, want, label)
      local path = S:ResolveFile(input, DEEP)
      check(path and path:lower() == want:lower(), label .. ": got " .. tostring(path))
    end
    files["interface\\addons\\my_sounds\\hidden.ogg.ogg"] = true
    deep("hidden.ogg", "Interface\\AddOns\\My_Sounds\\hidden.ogg.ogg", "a doubled extension (hidden extensions on Windows)")
    files["interface\\addons\\my_sounds\\actually.mp3"] = true
    deep("actually.ogg", "Interface\\AddOns\\My_Sounds\\actually.mp3", "the wrong extension typed")
    files["interface\\addons\\my_sounds\\dash-name.ogg"] = true
    deep("dash name", "Interface\\AddOns\\My_Sounds\\dash-name.ogg", "spaces find a hyphenated file")
    deep("dash_name", "Interface\\AddOns\\My_Sounds\\dash-name.ogg", "underscores find a hyphenated file")
    files["interface\\addons\\my_sounds\\my_sounds\\unzipped.ogg"] = true
    deep("unzipped", "Interface\\AddOns\\My_Sounds\\My_Sounds\\unzipped.ogg", "a folder unzipped inside itself")
    files["interface\\addons\\my_sounds\\sounds\\nested.ogg"] = true
    deep("nested", "Interface\\AddOns\\My_Sounds\\sounds\\nested.ogg", "a common sounds subfolder")
    files["interface\\addons\\my_sounds\\media\\sounds\\twodeep.wav"] = true
    deep("twodeep", "Interface\\AddOns\\My_Sounds\\media\\sounds\\twodeep.wav", "two levels down")
    files["interface\\addons\\my_sounds\\pack\\inpack.ogg"] = true
    deep("pack\\inpack", "Interface\\AddOns\\My_Sounds\\pack\\inpack.ogg", "a relative path inside the folder")
    deep("My_Sounds\\pack\\inpack.ogg", "Interface\\AddOns\\My_Sounds\\pack\\inpack.ogg", "a path starting at the folder name")
    deep("C:\\Program Files (x86)\\World of Warcraft\\_forever_\\Interface\\AddOns\\My_Sounds\\pack\\inpack.ogg",
      "Interface\\AddOns\\My_Sounds\\pack\\inpack.ogg", "a pasted full Windows path")
    deep("\"sonar_boop_med.ogg\"", "Interface\\AddOns\\My_Sounds\\sonar_boop_med.ogg", "quotes around the name")
    deep("Interface\\AddOns\\My_Sounds\\hidden.ogg", "Interface\\AddOns\\My_Sounds\\hidden.ogg.ogg", "a full path with a hidden doubled extension")
    -- Depth is bounded: deep search only goes into the first (designated) folder, and only for misses.
    local _, deepTried = S:ResolveFile("nothere", DEEP)
    check(#deepTried <= 200, "a deep miss stays bounded (" .. #deepTried .. " probes)")
    for _, p in ipairs(deepTried) do
      if p:lower():find("myaddon\\sounds\\[^\\]+\\") then check(false, "deep search stays in the designated folder: " .. p) break end
    end
    local _, quick = S:ResolveFile("sonar_boop_med", DEEP)
    check(#quick == 1, "an exact name in the designated folder takes one probe (" .. #quick .. ")")
    check(S:ResolveFile("Interface\\AddOns\\..\\..\\x.ogg", DEEP) == nil, "no escaping the AddOns folder")

    -- The standard layout --------------------------------------------------------------------------------------
    local f = S:AddonFolders("MyAddon", "MyAddon_Sounds")
    check(f.wowDefault == "Interface\\AddOns\\MyAddon\\sounds\\wow_default\\", "wow_default folder")
    check(f.game == "Interface\\AddOns\\MyAddon\\sounds\\game\\", "game folder")
    check(f.user == "Interface\\AddOns\\MyAddon\\sounds\\user\\", "user folder")
    check(f.shared == "Interface\\AddOns\\MyAddon_Sounds\\", "shared folder beside the addon")
    check(S:AddonFolders("MyAddon").shared == nil, "no shared folder unless named")
    local uf = S:UserFolders("MyAddon", "MyAddon_Sounds")
    check(uf[1] == f.shared and uf[2] == f.user and #uf == 2, "user folders: the durable shared folder first, then sounds\\user")
    files["interface\\addons\\myaddon\\sounds\\user\\mine.ogg"] = true
    check(S:ResolveFile("mine", { addon = "MyAddon", shared = "MyAddon_Sounds" }) == "Interface\\AddOns\\MyAddon\\sounds\\user\\mine.ogg", "opts.addon searches the layout's user folders")
    local a1, g1 = S:LayoutGroup("Interface\\AddOns\\MyAddon\\sounds\\wow_default\\x.ogg")
    check(a1 == "MyAddon" and g1 == "wow_default", "layout group: wow_default")
    local a2, g2 = S:LayoutGroup("interface/addons/MyAddon/Sounds/User/x.ogg")
    check(a2 == "MyAddon" and g2 == "user", "layout group: user, any case and slashes")
    local a3, g3 = S:LayoutGroup("Interface\\AddOns\\BLU_Sounds\\x.ogg")
    check(a3 == "BLU" and g3 == "shared", "layout group: the shared folder")
    check(S:LayoutGroup("Interface\\AddOns\\Other\\media\\x.ogg") == nil, "no layout: nil")

    -- A client where a muted file reports that it will not play: the probe still finds the file.
    muteBlocksPlay = true
    check(S:ProbeFile("Interface\\AddOns\\My_Sounds\\sonar_boop_med.ogg") == true, "muted probe falls back to a stopped play")
    resolves("sonar_boop_med.ogg", "Interface\\AddOns\\My_Sounds\\sonar_boop_med.ogg", "extension input on a mute-blocking client")

    -- Default folder list: the shared player folder is searched when an addon names none.
    check(type(S.USER_FOLDER) == "string" and S.USER_FOLDER:find("^Interface\\AddOns\\"), "a shared player folder is named")

    if #failures > 0 then error(table.concat(failures, "\n")) end
    result = "SOUND FILES OK"
  `);
  console.log(lua.ctx.result);
} catch (error) {
  console.error(`SOUND FILES FAIL\n${error.message}`);
  process.exitCode = 1;
} finally {
  lua.global.close();
}
