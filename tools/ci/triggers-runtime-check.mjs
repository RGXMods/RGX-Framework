#!/usr/bin/env node
// Runtime behavior gate for the RGXTriggers state store: engine-diffed
// changed flags, guaranteed progress shapes, stale-clone sweep, and
// failure-isolated change notifications. Fresh VM per run.
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
    __coreSource: source("core/core.lua"),
    __triggersSource: source("modules/triggers/triggers.lua"),
    __testSource: source("tools/ci/triggers-runtime-test.lua"),
  });

  lua.doStringSync(`
    -- Controllable clock for expirationTime assertions.
    __rgxNow = 0
    function GetTime() return __rgxNow end

    geterrorhandler = function()
        return function(message) error(message, 0) end
    end

    -- Frame stub sufficient for core.lua's load-time needs.
    function CreateFrame()
        local frame = { scripts = {} }
        function frame:SetScript(script, handler) frame.scripts[script] = handler end
        return frame
    end

    local RGX = {}
    _G.RGXFramework = RGX

    local function loadSource(text, path)
        local chunk, err = loadstring(text, "@" .. path)
        assert(chunk, err)
        return chunk("RGX-Framework", RGX)
    end

    -- core.lua owns RegisterModule, Debug/Error, and the module getters.
    loadSource(__coreSource, "core/core.lua")
    loadSource(__triggersSource, "modules/triggers/triggers.lua")

    __rgxTriggersCheckCount = 0
    loadSource(__testSource, "tools/ci/triggers-runtime-test.lua")
  `);

  const count = lua.ctx.__rgxTriggersCheckCount ?? 0;
  if (count < 45) {
    throw new Error(`triggers harness ran too few checks: ${count}`);
  }
  console.log(lua.ctx.__rgxTriggersTestResult);
} finally {
  lua.global.close();
}
