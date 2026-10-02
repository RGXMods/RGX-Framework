import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const compat = readFileSync(join(ROOT, "core/compat.lua"), "utf8");
const adapters = readFileSync(join(ROOT, "core/compat_api.lua"), "utf8");
const xml = readFileSync(join(ROOT, "RGX-Framework.xml"), "utf8");

assert(xml.indexOf("core/compat.lua") < xml.indexOf("core/core.lua"), "compat must load before core");
assert(xml.indexOf("core/compat_api.lua") < xml.indexOf("core/core.lua"), "compat_api must load before core");
assert(xml.indexOf("core/compat.lua") < xml.indexOf("modules/dropdowns/dropdowns.lua"), "compat must precede all modules");

async function orderCase(name, order) {
  const lua = await Lua.create();
  try {
    lua.ctx.__compat = compat;
    lua.ctx.__adapters = adapters;
    lua.doStringSync(`RGX = {} function GetBuildInfo() return "1.60.1","69893","test",16001 end
      WOW_PROJECT_MAINLINE=1 WOW_PROJECT_CLASSIC=2 WOW_PROJECT_ID=2`);
    for (const source of order) lua.doStringSync(source === "compat" ? `assert(loadstring(__compat))("RGX-Framework", RGX)` : `assert(loadstring(__adapters))("RGX-Framework", RGX)`);
    const state = lua.doStringSync('return tostring(type(RGX.API.CanAccessValue)) .. "," .. tostring(type(RGX.API.GetItemInfo)) .. "," .. tostring(type(RGX.API.ShouldAurasBeSecret)) .. "," .. tostring(RGX.wowVersion) .. "," .. tostring(RGX.isForever)');
    const [canAccess, itemInfo, auras, wowVersion, isForever] = state.split(",");
    assert.equal(canAccess, "function", `${name}: CanAccessValue must survive`);
    assert.equal(itemInfo, "function", `${name}: compat_api wrappers must exist`);
    assert.equal(auras, "function", `${name}: aura secrecy predicates must exist`);
  } finally { lua.global.close(); }
}
await orderCase("compat -> compat_api", ["compat", "adapters"]);
await orderCase("compat_api -> compat", ["adapters", "compat"]);
console.log("LOADER ORDER OK both compat files preserve shared API state in either order; XML keeps compat first");
