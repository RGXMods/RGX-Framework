#!/usr/bin/env node
// RGXSharedMedia Scan runtime harness (issue #85): loads the real
// libraries/sharedmedia/sharedmedia.lua into a Lua 5.1 VM (wasmoon) and
// exercises Scan() dedup-state and self-scan safety against the public
// registry. Mirrors the sharedmedia-runtime-check harness shape, but the
// minimal RGX stand-in also installs the WoW AddOn scan seams
// (C_AddOns.*) over a fixture AddOn list, plus an RGX:SendMessage spy, so
// Scan()/Scan(true) run end-to-end. Not a WoW emulator.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const files = {
  sharedmedia: join(ROOT, "libraries", "sharedmedia", "sharedmedia.lua"),
  test: join(HERE, "sharedmedia-scan-runtime-test.lua"),
};

const lua = await Lua.create();
try {
  lua.ctx.smSource = readFileSync(files.sharedmedia, "utf8");
  lua.ctx.testSource = readFileSync(files.test, "utf8");

  lua.doStringSync(`
    local addons = {
      { name = "RGX-Framework" },
      { name = "MyMediaAddon" },
      { name = "Prat-3.0" },
    }
    local loaded = { ["RGX-Framework"] = true, ["MyMediaAddon"] = true, ["Prat-3.0"] = true }

    -- Fixture global matching the #78 audit repro: a media addon global with
    -- 2 audio paths. One of them (alert.ogg) is also registered directly by
    -- the harness, the other is unique to this fixture.
    _G.MyMediaAddon = {
      media = {
        "Interface\\\\AddOns\\\\MyMediaAddon\\\\sounds\\\\alert.ogg",
        "Interface\\\\AddOns\\\\MyMediaAddon\\\\sounds\\\\whistle.wav",
      },
    }

    C_AddOns = {
      GetNumAddOns = function() return #addons end,
      GetAddOnInfo = function(i)
        local a = addons[i]
        if not a then return nil end
        return { name = a.name }
      end,
      IsAddOnLoaded = function(name) return loaded[name] == true end,
      GetAddOnMetadata = function() return nil end,
    }

    local messages = {}
    local RGX = {
      modules = {},
      isForever = false,
      After = function(_, fn) fn() end,
      RegisterModule = function(_, name, module) RGX.modules[name] = module end,
      RegisterEvent = function(_, event, handler) end,
      Debug = function(_) end,
      SendMessage = function(_, msg, mediaType)
        if msg == "RGX_SHAREDMEDIA_UPDATED" then
          table.insert(messages, mediaType)
        end
      end,
    }
    _G.RGX = RGX
    _G.__rgxScanMessageSpy = messages

    local function loadSource(source, path)
        local chunk, err = loadstring(source, "@" .. path)
        assert(chunk, err)
        return chunk
    end
    loadSource(smSource, "libraries/sharedmedia/sharedmedia.lua")("RGX-Framework", RGX)
    loadSource(testSource, "tools/ci/sharedmedia-scan-runtime-test.lua")("RGX-Framework", RGX)
  `);

  console.log(lua.ctx.__rgxSharedMediaScanTestResult);
  if (String(lua.ctx.__rgxSharedMediaScanTestResult || "").indexOf("PASSED") === -1) {
    process.exit(1);
  }
} finally {
  lua.global.close();
}
