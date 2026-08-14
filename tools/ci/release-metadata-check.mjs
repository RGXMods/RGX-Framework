#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const metadataPath = process.argv[2];
if (!metadataPath) {
  console.error("Usage: node release-metadata-check.mjs <release.json>");
  process.exit(1);
}

const toc = readFileSync(join(ROOT, "RGX-Framework.toc"), "utf8");
const version = toc.match(/^## Version:\s*(\S+)/m)?.[1];
const metadata = JSON.parse(readFileSync(resolve(metadataPath), "utf8"));
const expectedFlavors = new Map([
  ["mainline", 120100],
  ["classic", 11509],
  ["bcc", 20506],
  ["titan", 38002],
  ["cata", 40402],
  ["mists", 50504],
]);
const failures = [];

if (!version) failures.push("RGX-Framework.toc is missing Version");
if (!Array.isArray(metadata.releases) || metadata.releases.length !== 1) {
  failures.push(`expected exactly one release entry, got ${metadata.releases?.length ?? "none"}`);
}

const release = metadata.releases?.[0] ?? {};
if (release.name !== "RGX-Framework") failures.push(`expected release name RGX-Framework, got ${release.name}`);
if (release.version !== `v${version}`) failures.push(`expected release version v${version}, got ${release.version}`);
if (release.filename !== `RGX-Framework-v${version}.zip`) failures.push(`unexpected release filename ${release.filename}`);
if (release.nolib !== false) failures.push("release metadata must describe the normal package");

const metadataEntries = release.metadata ?? [];
if (metadataEntries.length !== expectedFlavors.size) failures.push(`expected ${expectedFlavors.size} flavor rows, got ${metadataEntries.length}`);
const actualFlavors = new Map(metadataEntries.map((entry) => [entry.flavor, entry.interface]));
if (actualFlavors.size !== expectedFlavors.size) failures.push(`expected ${expectedFlavors.size} flavor entries, got ${actualFlavors.size}`);
for (const [flavor, wowInterface] of expectedFlavors) {
  if (actualFlavors.get(flavor) !== wowInterface) {
    failures.push(`${flavor}: expected Interface ${wowInterface}, got ${actualFlavors.get(flavor)}`);
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`RELEASE ERROR  ${failure}`);
  process.exit(1);
}

console.log(`RELEASE METADATA OK  v${version}, ${expectedFlavors.size} flavors.`);
