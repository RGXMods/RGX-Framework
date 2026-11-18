#!/usr/bin/env node
// Contract compatibility handshake gate (issue #9): proves the engine
// emits provenance and a runtime guard, then runs the generated guard and
// the framework's handshake API inside a Lua 5.1 VM (wasmoon).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";
import {
  generateAddonLua,
  generateAddonToc,
  computeFrameworkMinVersion,
} from "../../contract/engine/generate-addon.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const source = (path) => readFileSync(join(ROOT, path), "utf8");

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.error(`  FAIL  ${label}${detail ? " -- " + detail : ""}`);
  }
}

function throws(label, run) {
  try {
    run();
    failures++;
    console.error(`  FAIL  ${label} -- expected an error`);
  } catch {
    console.log(`  PASS  ${label}`);
  }
}

console.log("== Engine floor and provenance ==");
check("default floor is the contract surface",
  computeFrameworkMinVersion({}) === "2.9.0");
check("declarative pages keep the contract floor",
  computeFrameworkMinVersion({ pages: [{ page: "Basics", cards: [{ card: "Display", controls: ["toggle enabled"] }] }] }) === "2.9.0");
check("explicit override raises the floor",
  computeFrameworkMinVersion({ frameworkMinVersion: "2.10.0" }) === "2.10.0");
check("override below the floor keeps the floor",
  computeFrameworkMinVersion({ frameworkMinVersion: "2.8.0" }) === "2.9.0");
throws("malformed override is rejected", () => computeFrameworkMinVersion({ frameworkMinVersion: "banana" }));
throws("numeric segment junk is rejected", () => computeFrameworkMinVersion({ frameworkMinVersion: "2.x.0" }));

const generated = generateAddonLua({ name: "GuardedAddon", db: { enabled: true } });
check("generated Lua opens with the handshake guard",
  generated.includes('RGX:RequireContract("GuardedAddon", 1, "2.9.0")'), generated.slice(0, 400));
check("generated guard probes for the handshake before using it",
  generated.includes("type(RGX.RequireContract) ~= \"function\""), generated.slice(0, 400));
check("generated guard names the floor in its clear error",
  generated.includes("requires RGX-Framework 2.9.0 or newer with the RGX contract compatibility handshake"),
  generated.slice(0, 400));
check("generated Lua documents its TOC provenance",
  generated.includes("## X-RGX-Contract-Format: 1") && generated.includes("## X-RGX-Framework-MinVersion: 2.9.0"),
  generated.slice(0, 400));

const overrideGenerated = generateAddonLua({ name: "NewerAddon", frameworkMinVersion: "2.10.0" });
check("override flows into the generated guard",
  overrideGenerated.includes('RGX:RequireContract("NewerAddon", 1, "2.10.0")')
    && overrideGenerated.includes("requires RGX-Framework 2.10.0 or newer"),
  overrideGenerated.slice(0, 400));
throws("engine rejects malformed override at generation time",
  () => generateAddonLua({ name: "BadOverride", frameworkMinVersion: "2..9" }));

const toc = generateAddonToc({ name: "GuardedAddon", db: {} });
const requiredAt = toc.indexOf("## RequiredDeps: RGX-Framework");
const formatAt = toc.indexOf("## X-RGX-Contract-Format: 1");
const minAt = toc.indexOf("## X-RGX-Framework-MinVersion: 2.9.0");
const savedAt = toc.indexOf("## SavedVariables: GuardedAddonDB");
check("TOC carries contract provenance after RequiredDeps",
  requiredAt !== -1 && requiredAt < formatAt && formatAt < minAt && minAt < savedAt, toc);

console.log("== Runtime handshake (Lua 5.1 VM) ==");
const lua = await Lua.create();
try {
  const generatedGuard = generated.slice(0, generated.indexOf('RGXAddon "'));
  Object.assign(lua.ctx, {
    __coreSource: source("core/core.lua"),
    __testSource: source("tools/ci/contract-handshake-test.lua"),
    __generatedGuard: generatedGuard,
  });

  await lua.doString(`
    _G.RGXFrameworkDB = {}
    C_AddOns = { GetAddOnMetadata = function(name, field)
        if field == "Version" then return "2.9.0" end
        return nil
    end }

    local function loadSource(text, path)
        local chunk, err = loadstring(text, "@" .. path)
        assert(chunk, err)
        return chunk
    end

    local RGX = {}
    loadSource(__coreSource, "core/core.lua")("RGX-Framework", RGX)
    _G.RGXFramework = RGX
    _G.__rgxHandshakeGuard = __generatedGuard
    loadSource(__testSource, "tools/ci/contract-handshake-test.lua")()
  `);

  const count = lua.ctx.__rgxHandshakeCheckCount ?? 0;
  if (count < 40) {
    throw new Error(`handshake harness ran too few checks: ${count}`);
  }
  console.log(lua.ctx.__rgxHandshakeTestResult ?? "CONTRACT HANDSHAKE OK");
} finally {
  lua.global.close();
}

if (failures) {
  console.error(`CONTRACT HANDSHAKE FAILED  ${failures} check(s)`);
  process.exit(1);
}
console.log("CONTRACT HANDSHAKE GATE OK");
