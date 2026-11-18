#!/usr/bin/env node
// RGXColors:OpenPicker opens the framework's own colour picker whenever it is loaded, so every addon that asks the
// framework for a colour gets the same RGX dialog. The game's picker is used only when the framework picker is
// missing or the caller needs opacity (the RGX dialog has no alpha).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lua = await Lua.create();
lua.ctx.source = readFileSync(join(ROOT, "libraries/colors/colors.lua"), "utf8");
try {
  lua.doStringSync(String.raw`
    local modules = {}
    RGXFramework = {}
    function RGXFramework:RegisterModule(name, m) modules[name] = m end
    function RGXFramework:GetModule(name) return modules[name] end
    function RGXFramework:GetColorPicker() return modules.colorpicker end
    function RGXFramework:Debug() end
    function RGXFramework:Clamp(v, lo, hi) if v < lo then return lo elseif v > hi then return hi end return v end
    RAID_CLASS_COLORS = {}
    ITEM_QUALITY_COLORS = {}
    local blizzardShown = 0
    ColorPickerFrame = { SetupColorPickerAndShow = function(_, info) blizzardShown = blizzardShown + 1; ColorPickerFrame.info = info end,
      GetColorRGB = function() return 0.3, 0.3, 0.3 end, GetColorAlpha = function() return 1 end }
    assert(loadstring(source))("RGX-Framework", {})
    local Colors = _G.RGXColors or modules.colors
    if not Colors then
      for k, v in pairs(_G) do if type(v) == "table" and v.OpenPicker then Colors = v end end
    end
    local failures = {}
    local function check(ok, msg) if not ok then failures[#failures + 1] = msg end end

    -- Framework picker loaded: it opens, with the starting colour, and its OK reports the colour.
    local shown
    modules.colorpicker = { Show = function(_, color, callback, opts) shown = { color = color, callback = callback, opts = opts } end }
    local got
    check(Colors:OpenPicker({ r = 0.1, g = 0.2, b = 0.3, onChanged = function(_, r, g, b) got = { r, g, b } end }) == true, "opens")
    check(shown ~= nil and blizzardShown == 0, "the framework picker opens, not the game's")
    check(shown and math.abs(shown.color.r - 0.1) < 1e-6 and math.abs(shown.color.b - 0.3) < 1e-6, "with the starting colour")
    shown.callback(0.9, 0.8, 0.7, 1)
    check(got and got[1] == 0.9 and got[3] == 0.7, "OK reports the picked colour to onChanged")
    Colors:OpenPicker({ r = 1, g = 1, b = 1, border = { 1, 0, 0 }, onChanged = function() end })
    check(shown.opts and shown.opts.border and shown.opts.border[1] == 1, "a brand border is passed through")

    -- Opacity needs the game's picker.
    shown = nil
    Colors:OpenPicker({ r = 1, g = 1, b = 1, a = 0.5, onChanged = function() end })
    check(shown == nil and blizzardShown == 1, "opacity requests use the game's picker")

    -- No framework picker: the game's picker.
    modules.colorpicker = nil
    Colors:OpenPicker({ r = 1, g = 1, b = 1, onChanged = function() end })
    check(blizzardShown == 2, "without the framework picker the game's opens")

    if #failures > 0 then error(table.concat(failures, "\n")) end
    result = "OPENPICKER OK"
  `);
  console.log(lua.ctx.result);
} catch (error) {
  console.error(`OPENPICKER FAIL\n${error.message}`);
  process.exitCode = 1;
} finally {
  lua.global.close();
}
