// Runtime boundary check: the shipped Lua runtime must be self-contained.
// core/ and modules/ may never reference developer tooling (tools/, contract/,
// .reference/, rgx-mcp, node_modules) and may never use Lua's external-code
// loaders (require/dofile/loadfile) — WoW addons load exclusively through
// the TOC/XML manifest. Comments are stripped before scanning so prose rules
// ("the runtime must never reference tools/") do not trip the checker.
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RUNTIME_ROOTS = [join(ROOT, "core"), join(ROOT, "modules"), join(ROOT, "library")];

// [^[\]]* nested-bracket-free body: strip --[[ ... ]] block comments first,
// then -- line comments, then scan for forbidden references.
function stripComments(source) {
  return source
    .replace(/--\[\[[\s\S]*?\]\]/g, " ")
    .replace(/--[^\n]*/g, " ");
}

const FORBIDDEN = [
  { pattern: /\brequire\s*\(/, label: "require()" },
  { pattern: /\bdofile\s*\(/, label: "dofile()" },
  { pattern: /\bloadfile\s*\(/, label: "loadfile()" },
  { pattern: /["'][^"']*tools\//, label: "tools/ path" },
  { pattern: /["'][^"']*contract\//, label: "contract/ path" },
  { pattern: /["'][^"']*\.reference/, label: ".reference path" },
  { pattern: /["'][^"']*rgx-mcp/, label: "rgx-mcp reference" },
  { pattern: /["'][^"']*node_modules/, label: "node_modules path" },
];

function scanRuntimeLua(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanRuntimeLua(full));
    } else if (entry.name.endsWith(".lua")) {
      files.push(full);
    }
  }
  return files;
}

let scanned = 0;
for (const root of RUNTIME_ROOTS) {
  for (const file of scanRuntimeLua(root)) {
    scanned += 1;
    const code = stripComments(readFileSync(file, "utf8"));
    for (const rule of FORBIDDEN) {
      const match = code.match(rule.pattern);
      if (match) {
        // Locate the line for an actionable message.
        const index = code.indexOf(match[0]);
        const line = code.slice(0, index).split("\n").length;
        assert.fail(`${file}:${line}: runtime references forbidden ${rule.label}`);
      }
    }
    // Consumer-coupling: the framework is a framework. No consumer addon's
    // name may appear anywhere in the runtime — code or comments. Consumers
    // are siblings that depend on RGX, never ingredients of it, and a brand
    // reference here is how addon-specific behavior starts leaking in.
    const raw = readFileSync(file, "utf8");
    for (const brand of [
      { pattern: /\bSQP\b/, label: "SQP" },
      { pattern: /SimpleQuestPlates/, label: "SimpleQuestPlates" },
      { pattern: /\bBLU\b/, label: "BLU" },
      { pattern: /BetterLevelUp/, label: "BetterLevelUp" },
      { pattern: /RGXQoL/, label: "RGXQoL" },
      { pattern: /RGXProfessions/, label: "RGXProfessions" },
    ]) {
      const match = raw.match(brand.pattern);
      if (match) {
        const line = raw.slice(0, raw.indexOf(match[0])).split("\n").length;
        assert.fail(`${file}:${line}: runtime references consumer addon '${brand.label}' — the framework must stay consumer-agnostic`);
      }
    }
  }
}
console.log(`RUNTIME BOUNDARY OK ${scanned} runtime Lua files reference no tooling, contract engines, reference caches, external loaders, or consumer addons`);
