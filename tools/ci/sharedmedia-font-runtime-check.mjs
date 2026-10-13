#!/usr/bin/env node
// RGXSharedMedia font-runtime harness: loads the real
// library/sharedmedia/sharedmedia.lua into a Lua 5.1 VM (wasmoon) and exercises
// the "font" media type against the public registry. Mirrors the
// database-runtime-check harness shape: a minimal RGX stand-in provides only
// the seams sharedmedia.lua touches (RGX:RegisterModule, RGX:Debug,
// RGX:RegisterEvent, RGX:SendMessage, RGX.After). Not a WoW emulator.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const files = {
  sharedmedia: join(ROOT, "library", "sharedmedia", "sharedmedia.lua"),
  test: join(HERE, "sharedmedia-font-runtime-test.lua"),
};

const lua = await Lua.create();
try {
  lua.ctx.smSource = readFileSync(files.sharedmedia, "utf8");
  lua.ctx.testSource = readFileSync(files.test, "utf8");

  lua.doStringSync(`
    local events = {}
    local RGX = {
      modules = {},
      isForever = false,
      After = function(_, fn) fn() end,
      RegisterModule = function(_, name, module) RGX.modules[name] = module end,
      RegisterEvent = function(_, event, handler) events[event] = handler end,
      Debug = function(_) end,
      SendMessage = function(_, ...) end,
    }
    _G.RGX = RGX

    -- sharedmedia.lua touches C_AddOns only when scanning; the single-entry
    -- registration path never reaches those gates, so leaving them absent is safe.

    local function loadSource(source, path)
        local chunk, err = loadstring(source, "@" .. path)
        assert(chunk, err)
        return chunk
    end
    loadSource(smSource, "library/sharedmedia/sharedmedia.lua")("RGX-Framework", RGX)
    loadSource(testSource, "tools/ci/sharedmedia-font-runtime-test.lua")("RGX-Framework", RGX)
  `);

  console.log(lua.ctx.__rgxSharedMediaFontTestResult);
  if (String(lua.ctx.__rgxSharedMediaFontTestResult || "").indexOf("PASSED") === -1) {
    process.exit(1);
  }
} finally {
  lua.global.close();
}
