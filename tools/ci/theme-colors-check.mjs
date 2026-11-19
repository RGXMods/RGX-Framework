#!/usr/bin/env node
// The global theme override's colours: the operator picks a primary and a secondary colour (or a preset fills both),
// and every RGX addon that follows the framework theme builds with that pair while the override is on.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lua = await Lua.create();
lua.ctx.design = readFileSync(join(ROOT, "libraries/design/design.lua"), "utf8");
try {
  lua.doStringSync(String.raw`
    local function noop() end
    local mt = { __index = function(t, k) if type(k) == "string" and k:match("^%u") then return noop end end }
    function CreateFrame() return setmetatable({}, mt) end
    UIParent = CreateFrame()
    local modules = {}
    RGXFramework = {}
    function RGXFramework:RegisterModule(name, m) modules[name] = m end
    function RGXFramework:GetModule(name) return modules[name] end
    function RGXFramework:GetDesign() return modules.design end
    function RGXFramework:Error() end
    function RGXFramework:Debug() end
    assert(loadstring(design))('RGX-Framework', RGXFramework)
    local D = _G.RGXDesign
    local failures = {}
    local function check(ok, msg) if not ok then failures[#failures + 1] = msg end end
    local function same(a, b) return a and b and math.abs(a[1] - b[1]) < 1e-6 and math.abs(a[2] - b[2]) < 1e-6 and math.abs(a[3] - b[3]) < 1e-6 end
    local gold = D.THEME_PRESETS.gold
    local BRAND = { primary = { 0.5, 0.1, 0.2 }, accent = { 0.4, 0.4, 0.4 } }

    -- A preset alone gives its own pair.
    local pair = D:GetOverrideTheme({ themePreset = "gold" })
    check(same(pair.primary, gold.primary) and same(pair.accent, gold.accent), "a preset gives its pair")
    check(same(D:GetOverrideTheme({}).primary, D.THEME_PRESETS.cyan.primary), "no choice falls back to cyan")

    -- Custom picks replace either colour of the preset.
    local db = { themePreset = "gold", themePrimary = { r = 0.1, g = 0.2, b = 0.3 } }
    pair = D:GetOverrideTheme(db)
    check(same(pair.primary, { 0.1, 0.2, 0.3 }) and same(pair.accent, gold.accent), "a primary pick keeps the preset secondary")
    db.themeSecondary = { r = 0.7, g = 0.6, b = 0.5 }
    check(same(D:GetOverrideTheme(db).accent, { 0.7, 0.6, 0.5 }), "a secondary pick replaces the preset secondary")
    check(same(D:GetOverrideTheme({ themePrimary = { r = "x" } }).primary, D.THEME_PRESETS.cyan.primary), "a malformed pick is ignored")

    -- Addons see the pair only while the override is on.
    _G.RGXFrameworkDB = { themeOverride = false, themePreset = "gold", themePrimary = { r = 0.1, g = 0.2, b = 0.3 } }
    local t = D:ResolveAddonTheme(BRAND, "framework")
    check(same(t.primary, BRAND.primary), "override off: the addon keeps its own primary")
    _G.RGXFrameworkDB.themeOverride = true
    t = D:ResolveAddonTheme(BRAND, "framework")
    check(same(t.primary, { 0.1, 0.2, 0.3 }) and same(t.accent, gold.accent), "override on: the picked primary and the preset secondary")

    -- Applying sets the live theme.
    D:ApplyOverrideTheme(_G.RGXFrameworkDB)
    check(same(D.Theme.primary, { 0.1, 0.2, 0.3 }), "apply sets the live primary")
    check(D:GetThemePreset() == nil, "a custom pair is not reported as a preset")
    D:ApplyOverrideTheme({ themePreset = "green" })
    check(same(D.Theme.primary, D.THEME_PRESETS.green.primary) and D:GetThemePreset() == "green", "a plain preset applies and reports itself")

    if #failures > 0 then error(table.concat(failures, "\n")) end
    result = "THEME COLORS OK"
  `);
  console.log(lua.ctx.result);
} catch (error) {
  console.error(`THEME COLORS FAIL\n${error.message}`);
  process.exitCode = 1;
} finally {
  lua.global.close();
}
