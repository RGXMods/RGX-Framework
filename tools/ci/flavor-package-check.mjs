#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..", "..");
const allowedRoots = new Set(["core", "modules", "media"]);
const rootFiles = new Set([
  "LICENSE.txt",
  "RGX-Framework.xml",
  "RGX-Framework.toc",
  "RGX-Framework_Vanilla.toc",
  "RGX-Framework_TBC.toc",
  "RGX-Framework_Wrath.toc",
  "RGX-Framework_Cata.toc",
  "RGX-Framework_Mists.toc",
]);

for (const file of rootFiles) {
  if (!existsSync(join(ROOT, file))) throw new Error(`missing package file: ${file}`);
}

const xml = readFileSync(join(ROOT, "RGX-Framework.xml"), "utf8");
for (const match of xml.matchAll(/file="([^"]+)"/g)) {
  if (!existsSync(join(ROOT, match[1]))) throw new Error(`XML references missing file: ${match[1]}`);
  if (!allowedRoots.has(match[1].split(/[\\/]/)[0])) throw new Error(`XML loads disallowed root: ${match[1]}`);
}

const metadata = readFileSync(join(ROOT, ".pkgmeta"), "utf8");
for (const directory of ["docs", "schemas", "tools", "tests", ".github", ".reference", "artifacts", "graphify-out"]) {
  if (!metadata.includes(`- ${directory}`)) throw new Error(`.pkgmeta does not exclude ${directory}`);
}

console.log("Six-flavor runtime package inventory OK");
