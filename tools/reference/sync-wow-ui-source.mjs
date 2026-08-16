#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const config = JSON.parse(readFileSync(join(scriptDir, "wow-ui-source.json"), "utf8"));
const referenceRoot = join(repoRoot, ".reference", "wow-ui-source");
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
const manifest = {
  repository: config.repository,
  syncedAt: new Date().toISOString(),
  flavors: [],
};

for (const flavor of selected) {
  const destination = join(referenceRoot, flavor.id);
  if (!hasGitRepo(destination)) {
    run([
      "clone",
      "--depth", "1",
      "--filter=blob:none",
      "--sparse",
      "--branch", flavor.ref,
      config.repository,
      destination,
    ]);
  } else {
    const remote = run(["-C", destination, "remote", "get-url", "origin"], { capture: true });
    if (!remote.includes("Gethe/wow-ui-source")) {
      throw new Error(`Refusing to update unexpected remote '${remote}' at ${destination}.`);
    }
    if (flavor.kind === "branch") {
      run(["-C", destination, "fetch", "--depth", "1", "origin", `refs/heads/${flavor.ref}`]);
      run(["-C", destination, "merge", "--ff-only", "FETCH_HEAD"]);
    } else {
      run(["-C", destination, "fetch", "--depth", "1", "origin", `refs/tags/${flavor.ref}`]);
      run(["-C", destination, "checkout", "--detach", "FETCH_HEAD"]);
    }
  }

  run(["-C", destination, "sparse-checkout", "init", "--cone"]);
  run(["-C", destination, "sparse-checkout", "set", ...config.sparsePaths]);

  const version = readFileSync(join(destination, "version.txt"), "utf8").trim();
  const commit = run(["-C", destination, "rev-parse", "HEAD"], { capture: true });
  manifest.flavors.push({
    ...flavor,
    version,
    commit,
    path: `.reference/wow-ui-source/${flavor.id}`,
    syncedAt: new Date().toISOString(),
  });
  console.log(`${flavor.label}: ${version} (${flavor.ref}@${commit.slice(0, 12)})`);
}

let previousFlavors = [];
try {
  previousFlavors = JSON.parse(readFileSync(manifestPath, "utf8")).flavors || [];
} catch {
  // First sync has no prior manifest.
}
const refreshed = new Map(manifest.flavors.map((flavor) => [flavor.id, flavor]));
const previous = new Map(previousFlavors.map((flavor) => [flavor.id, flavor]));
manifest.flavors = config.flavors
  .map((flavor) => {
    const known = refreshed.get(flavor.id) || previous.get(flavor.id);
    if (known) return known;
    const destination = join(referenceRoot, flavor.id);
    if (!hasGitRepo(destination)) return null;
    return {
      ...flavor,
      version: readFileSync(join(destination, "version.txt"), "utf8").trim(),
      commit: run(["-C", destination, "rev-parse", "HEAD"], { capture: true }),
      path: `.reference/wow-ui-source/${flavor.id}`,
      syncedAt: null,
    };
  })
  .filter(Boolean);
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
