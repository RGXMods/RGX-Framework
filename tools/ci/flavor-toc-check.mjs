#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const expected = new Map([
  ["RGX-Framework.toc", "120100"],
  ["RGX-Framework_Vanilla.toc", "11509"],
  ["RGX-Framework_TBC.toc", "20506"],
  ["RGX-Framework_Wrath.toc", "38002"],
  ["RGX-Framework_Cata.toc", "40402"],
  ["RGX-Framework_Mists.toc", "50504"],
]);

for (const [file, value] of expected) {
  const source = readFileSync(join(ROOT, file), "utf8");
  const actual = source.match(/^## Interface:\s*(\d+)/m)?.[1];
  if (actual !== value) throw new Error(`${file}: expected ${value}, got ${actual}`);
  if (!/^RGX-Framework\.xml\s*$/m.test(source)) throw new Error(`${file}: missing XML loader`);
  console.log(`${file} ${actual} OK`);
}
