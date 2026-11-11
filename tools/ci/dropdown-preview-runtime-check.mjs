#!/usr/bin/env node
// RGXDropdowns onPreview harness: loads the real libraries/dropdowns/dropdowns.lua into a
// Lua 5.1 VM (wasmoon) and runs the Play-button scenarios in
// tools/ci/dropdown-preview-runtime-test.lua against a widget mock. This checks behaviour
// only. Sizes and anchors are recorded, never rendered, so geometry needs an in-game check.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const lua = await Lua.create();
try {
  lua.ctx.dropdownsSource = readFileSync(join(ROOT, "libraries", "dropdowns", "dropdowns.lua"), "utf8");
  lua.ctx.testSource = readFileSync(join(HERE, "dropdown-preview-runtime-test.lua"), "utf8");

  lua.doStringSync(`
    RGXFramework = {
      RegisterModule = function(self, _, module) self.dropdowns = module end,
      Debug = function() end,
      After = function(self, _, fn) fn() end,
    }
    local function loadSource(source, path)
      local chunk, err = loadstring(source, "@" .. path)
      assert(chunk, err)
      return chunk
    end
    loadSource(dropdownsSource, "libraries/dropdowns/dropdowns.lua")("RGX-Framework", {})
    loadSource(testSource, "tools/ci/dropdown-preview-runtime-test.lua")("RGX-Framework", {})
  `);

  console.log(lua.ctx.__rgxDropdownPreviewResult);
  if (String(lua.ctx.__rgxDropdownPreviewResult || "").indexOf("PASSED") !== 0) {
    process.exit(1);
  }
} finally {
  lua.global.close();
}
