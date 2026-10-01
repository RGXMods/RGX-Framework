#!/usr/bin/env node
// Syncs the WoW client dumps (Ketho/BlizzardInterfaceResources, dumped from the
// KethoDoc addon) into .reference/wow-api-dump/. This is the framework's main
// capability reference; wow-ui-source remains the confirmation layer.
// Reference-only: never runtime or release dependencies.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const config = JSON.parse(readFileSync(join(scriptDir, "wow-api-dump.json"), "utf8"));
const referenceRoot = join(repoRoot, ".reference", "wow-api-dump");
const manifestPath = join(referenceRoot, "manifest.json");

function run(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  })?.trim();
}

function hasGitRepo(path) {
  try {
    return run(["-C", path, "rev-parse", "--is-inside-work-tree"], { capture: true }) === "true";
  } catch {
    return false;
  }
}

const flavorArg = process.argv.indexOf("--flavor");
const requestedFlavor = flavorArg >= 0 ? process.argv[flavorArg + 1] : null;
const selected = requestedFlavor
  ? config.flavors.filter((flavor) => flavor.id === requestedFlavor)
  : config.flavors;
if (requestedFlavor && selected.length === 0) {
  throw new Error(`Unknown flavor '${requestedFlavor}'.`);
}

mkdirSync(referenceRoot, { recursive: true });
let existingFlavors = [];
try {
  existingFlavors = JSON.parse(readFileSync(manifestPath, "utf8")).flavors || [];
} catch {
  // First sync.
}
const previous = new Map(existingFlavors.map((entry) => [entry.id, entry]));
const manifest = {
  repository: config.repository,
  note: config.note,
  syncedAt: new Date().toISOString(),
  flavors: [],
};

for (const flavor of selected) {
  if (!flavor.dumpRef) {
    manifest.flavors.push(previous.get(flavor.id) ?? { ...flavor, build: null, commit: null, path: null, syncedAt: null });
    console.log(`${flavor.label}: no dump (gap: ${flavor.gap ?? "none recorded"})`);
    continue;
  }

  const destination = join(referenceRoot, flavor.id);
  if (!hasGitRepo(destination)) {
    run([
      "clone", "--depth", "1", "--filter=blob:none", "--sparse",
      "--branch", flavor.dumpRef, config.repository, destination,
    ]);
  } else {
    const remote = run(["-C", destination, "remote", "get-url", "origin"], { capture: true });
    if (!remote.includes("Ketho/BlizzardInterfaceResources")) {
      throw new Error(`Refusing to update unexpected remote '${remote}' at ${destination}.`);
    }
    run(["-C", destination, "fetch", "--depth", "1", "origin", `refs/heads/${flavor.dumpRef}`]);
    run(["-C", destination, "merge", "--ff-only", "FETCH_HEAD"]);
  }
  run(["-C", destination, "sparse-checkout", "init", "--cone"]);
  run(["-C", destination, "sparse-checkout", "set", config.dumpRoot]);

  const commit = run(["-C", destination, "rev-parse", "HEAD"], { capture: true });
  const readme = readFileSync(join(destination, "README.md"), "utf8");
  const build = readme.match(/GetBuildInfo\(\)\s*=>\s*"([^"]+)"/)?.[1] ?? null;
  const inventory = readFileSync(join(destination, config.dumpRoot, "GlobalAPI.lua"), "utf8");
  if (!build || inventory.length < 1000) {
    throw new Error(`Dump inventory validation failed for ${flavor.id}`);
  }
  manifest.flavors.push({
    ...flavor,
    build,
    commit,
    path: `.reference/wow-api-dump/${flavor.id}`,
    syncedAt: new Date().toISOString(),
  });
  console.log(`${flavor.label}: ${build} (${flavor.dumpRef}@${commit.slice(0, 12)})`);
}

if (manifest.flavors.length < config.flavors.length) {
  // Keep prior entries for flavors not selected this run.
  const synced = new Set(manifest.flavors.map((entry) => entry.id));
  for (const entry of existingFlavors) {
    if (!synced.has(entry.id)) manifest.flavors.push(entry);
  }
  manifest.flavors.sort((left, right) =>
    config.flavors.findIndex((flavor) => flavor.id === left.id)
      - config.flavors.findIndex((flavor) => flavor.id === right.id));
}

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Manifest: ${manifestPath}`);
