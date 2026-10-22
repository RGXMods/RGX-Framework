#!/usr/bin/env node
// Direct engine check for deterministic TOC generation. The same tocCases are
// shared with tools/rgx-mcp/test/test-rgx-hello.mjs, so the engine and the MCP
// transport always exercise the same canonical spec inputs.
import { generateAddonToc } from "../../contract/engine/generate-addon.mjs";
import { tocCases } from "./contract-vectors.mjs";

let failures = 0;
for (const vector of tocCases) {
  const first = generateAddonToc(vector.spec);
  const second = generateAddonToc(vector.spec);
  if (first !== second) {
    console.error(`TOC ERROR  ${vector.name}: generation is not deterministic`);
    failures++;
  }
  if (first !== vector.expected) {
    console.error(`TOC ERROR  ${vector.name}: unexpected output`);
    console.error(`expected:\\n${vector.expected}`);
    console.error(`actual:\\n${first}`);
    failures++;
  }
}

if (failures) {
  console.error(`CONTRACT TOC ERROR  ${failures} failure(s) across ${tocCases.length} vector(s)`);
  process.exit(1);
}

console.log(`CONTRACT TOC OK  ${tocCases.length} vector(s), deterministic`);
