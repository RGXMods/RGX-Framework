#!/usr/bin/env node
// Legacy bundled-font path regression: saved paths under media/fonts/ must
// resolve to the same registered font after assets move under libraries/fonts/media/.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const source = (path) => readFileSync(join(ROOT, path), "utf8");

const lua = await Lua.create();
try {
  Object.assign(lua.ctx, {
    __definitions: source("libraries/fonts/definitions.lua"),
    __init: source("libraries/fonts/init.lua"),
    __registry: source("libraries/fonts/registry.lua"),
    __query: source("libraries/fonts/query.lua"),
  });
  lua.doStringSync(`
    local RGX = {
      Debug = function() end,
      RegisterModule = function() end,
    }
    _G.RGXFramework = RGX
    local addon = {}
    local function loadSource(text, path)
      local chunk, err = loadstring(text, "@" .. path)
      assert(chunk, err)
      return chunk
    end
    loadSource(__definitions, "libraries/fonts/definitions.lua")("RGX-Framework", addon)
    loadSource(__init, "libraries/fonts/init.lua")("RGX-Framework", addon)
    loadSource(__registry, "libraries/fonts/registry.lua")("RGX-Framework", addon)
    loadSource(__query, "libraries/fonts/query.lua")("RGX-Framework", addon)

    local Fonts = addon._fontsModule
    local current = Fonts.fontPath .. "Inter-Regular.otf"
    Fonts:Register("Inter-Regular", current, { available = true })
    local name = Fonts:FindByPath("Interface/AddOns/RGX-Framework/media/fonts/Inter-Regular.otf")
    assert(name == "Inter-Regular", "legacy path did not resolve to registered font")
    local resolved = Fonts:ResolveName("Interface/AddOns/RGX-Framework/media/fonts/Inter-Regular.otf")
    assert(resolved == "Inter-Regular", "legacy path did not resolve through ResolveName")
    local newName = Fonts:FindByPath(current)
    assert(newName == "Inter-Regular", "current library path did not resolve")
    print("RESULT PASSED")
  `);
} finally {
  lua.global.close();
}
