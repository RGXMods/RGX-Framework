#!/usr/bin/env node
// Framework command namespace regression: the framework must own a stable
// RGXFRAMEWORK token and must not overwrite another addon's legacy RGX token.
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
  lua.ctx.runtimeSource = source("core/systems/runtime.lua");
  lua.ctx.commandsSource = source("core/commands.lua");
  lua.doStringSync(`
    SlashCmdList = {}
    strtrim = function(value) return (tostring(value):gsub("^%s+", ""):gsub("%s+$", "")) end
    local foreignCalls = 0
    SlashCmdList.RGX = function() foreignCalls = foreignCalls + 1 end
    SLASH_RGX1 = "/rgx"

    local prints = {}
    local RGX = {
      version = "9.9.9",
      slashCommands = {},
      Print = function(_, ...)
        local parts = {}
        for i = 1, select("#", ...) do parts[#parts + 1] = tostring(select(i, ...)) end
        prints[#prints + 1] = table.concat(parts, " ")
      end,
      GetModule = function() return nil end,
      GetLoadedModules = function() return { "core", "ui" } end,
      SetLoginMessagesEnabled = function() end,
      IsLoginMessagesEnabled = function() return true end,
      OpenDefinitionEditor = function() end,
    }
    local function loadSource(path, chunk)
      local fn, err = loadstring(chunk, "@" .. path)
      assert(fn, err)
      return fn
    end
    loadSource("core/systems/runtime.lua", runtimeSource)("RGX-Framework", RGX)
    loadSource("core/commands.lua", commandsSource)("RGX-Framework", RGX)

    local function check(label, condition)
      if not condition then error(label, 2) end
      print("PASS " .. label)
    end

    check("canonical token maps all aliases", SlashCmdList.RGXFRAMEWORK ~= nil
      and SLASH_RGXFRAMEWORK1 == "/rgx"
      and SLASH_RGXFRAMEWORK2 == "/rgxframework"
      and SLASH_RGXFRAMEWORK3 == "/rgxf")
    check("legacy RGX callback is preserved", SlashCmdList.RGX ~= nil
      and SLASH_RGX1 == "/rgx")
    SlashCmdList.RGX()
    check("foreign RGX callback remains callable", foreignCalls == 1)
    SlashCmdList.RGXFRAMEWORK("version")
    check("canonical alias reaches command handler", prints[#prints]:find("9.9.9", 1, true) ~= nil)
    check("registration metadata keeps aliases", RGX.slashCommands.RGXFRAMEWORK ~= nil
      and #RGX.slashCommands.RGXFRAMEWORK.commands == 3)

    print("RESULT PASSED")
  `);
} finally {
  lua.global.close();
}
