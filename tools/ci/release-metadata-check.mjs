#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const metadataPath = process.argv[2];
if (!metadataPath) {
  console.error("Usage: node release-metadata-check.mjs <release.json>");
  process.exit(1);
}

const tocPath = join(ROOT, "RGX-Framework.toc");
const toc = readFileSync(tocPath, "utf8");
const version = toc.match(/^## Version:\s*(\S+)/m)?.[1];
const metadata = JSON.parse(readFileSync(resolve(metadataPath), "utf8"));

function tocField(text, key) {
  return text.match(new RegExp(`^## ${key}:\\s*(.+?)\\s*$`, "m"))?.[1] ?? null;
}

// Expected flavors derive from the TOCs the release actually ships — the
// base TOC plus every sibling flavor TOC — so the checker can never drift
// from the package it validates (the hardcoded map missed the Forever
// flavor after the base TOC gained 16001 and failed the v2.7.12 release).
function flavorForInterface(interfaceValue) {
  const value = Number(interfaceValue);
  if (!Number.isInteger(value) || value < 10000) {
    throw new Error(`unrecognized TOC Interface value "${interfaceValue}"`);
  }
  if (value >= 11000 && value <= 11999) return "classic";
  if (value >= 16000 && value <= 16999) return "forever";
  if (value >= 20000 && value <= 20999) return "bcc";
  if (value >= 30000 && value <= 30999) return "wrath";
  if (value >= 38000 && value <= 38999) return "titan";
  if (value >= 40000 && value <= 40999) return "cata";
  if (value >= 50000 && value <= 50999) return "mists";
  if (value >= 100000) return "mainline";
  throw new Error(`unrecognized TOC Interface value "${interfaceValue}"`);
}

const stem = basename(tocPath).replace(/\.toc$/, "");
const expectedFlavors = new Map();
for (const tocFile of readdirSync(ROOT)) {
  if (!tocFile.endsWith(".toc")) continue;
  if (tocFile !== basename(tocPath) && !tocFile.startsWith(`${stem}_`) && !tocFile.startsWith(`${stem}-`)) continue;
  for (const raw of (tocField(readFileSync(join(ROOT, tocFile), "utf8"), "Interface") ?? "").split(",")) {
    const value = raw.trim();
    if (!value) continue;
    expectedFlavors.set(flavorForInterface(value), Number(value));
  }
}
if (expectedFlavors.size === 0) throw new Error("no TOC declares any Interface values");

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
