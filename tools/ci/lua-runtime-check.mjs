#!/usr/bin/env node
// Focused framework behavior checks in a real Lua 5.1 VM. This is not a WoW
// emulator; the fixture supplies only the Blizzard globals the tested path uses.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const files = {
  core: join(ROOT, "core", "core.lua"),
  events: join(ROOT, "core", "systems", "events.lua"),
  runtime: join(ROOT, "core", "systems", "runtime.lua"),
  test: join(HERE, "declarative-every-runtime-test.lua"),
};

const lua = await Lua.create();
try {
  lua.ctx.__rgxCoreSource = readFileSync(files.core, "utf8");
  lua.ctx.__rgxEventsSource = readFileSync(files.events, "utf8");
  lua.ctx.__rgxRuntimeSource = readFileSync(files.runtime, "utf8");
  lua.ctx.__rgxTestSource = readFileSync(files.test, "utf8");

  lua.doStringSync(`
    local RGX = {}
    SlashCmdList = {}
    function CreateFrame()
        local frame = { scripts = {}, registered = {} }
        function frame:SetScript(script, handler)
            self.scripts[script] = handler
        end
        function frame:Show() self._shown = true end
        function frame:Hide() self._shown = false end
        function frame:RegisterEvent(event)
            self.registered[event] = true
        end
        function frame:RegisterAllEvents()
            self.allEvents = true
        end
        function frame:UnregisterEvent(event)
            self.registered[event] = nil
        end
        return frame
    end

    local function loadSource(source, path)
        local chunk, err = loadstring(source, "@" .. path)
        assert(chunk, err)
        return chunk
    end

    loadSource(__rgxCoreSource, "core/core.lua")("RGX-Framework", RGX)
    loadSource(__rgxEventsSource, "core/systems/events.lua")("RGX-Framework", RGX)
    loadSource(__rgxRuntimeSource, "core/systems/runtime.lua")("RGX-Framework", RGX)
    loadSource(__rgxTestSource, "tools/ci/declarative-every-runtime-test.lua")()
  `);

  console.log(lua.ctx.__rgxRuntimeTestResult);
} finally {
  lua.global.close();
}
