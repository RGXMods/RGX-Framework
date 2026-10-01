#!/usr/bin/env node
// Searches the synced client dumps (.reference/wow-api-dump/). This is the main
// capability reference: does a global function, widget method, template, mixin,
// event, or enum exist on a given client? For Blizzard-authored signatures,
// documentation, and behavior confirmation, follow up in the wow-ui-source
// mirror (tools/reference/search-wow-api.mjs).

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const config = JSON.parse(readFileSync(join(scriptDir, "wow-api-dump.json"), "utf8"));
const args = process.argv.slice(2);
const pattern = args.find((arg) => !arg.startsWith("--"));

if (!pattern) {
  console.error("Usage: node tools/reference/search-wow-api-dump.mjs <text> [--flavor=id] [--regex] [--case-sensitive] [--max=N] [--inventory]");
  console.error("  --inventory lists file names only; keep result lines small and quote-ish-free.");
  process.exit(2);
}

const option = (name) => {
  const entry = args.find((arg) => arg.startsWith(`--${name}=`));
  return entry ? entry.slice(name.length + 3) : null;
};
const flavorFilter = option("flavor");
const maxResults = Number(option("max") || 200);
const useRegex = args.includes("--regex");
const caseSensitive = args.includes("--case-sensitive");
const inventoryOnly = args.includes("--inventory");
const matcher = useRegex ? new RegExp(pattern, caseSensitive ? "" : "i") : null;
const literal = caseSensitive ? pattern : pattern.toLowerCase();
let matches = 0;

function commitFor(path) {
  return execFileSync("git", ["-C", path, "rev-parse", "--short=12", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function buildFor(path) {
  const readme = readFileSync(join(path, "README.md"), "utf8");
  return readme.match(/GetBuildInfo\(\)\s*=>\s*"([^"]+)"/)?.[1] ?? "unknown-build";
}

function walk(path, files = []) {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith(".lua")) {
      files.push(full);
    }
  }
  return files;
}

for (const flavor of config.flavors) {
  if (flavorFilter && flavor.id !== flavorFilter) continue;
  if (!flavor.dumpRef) continue;
  const flavorRoot = join(repoRoot, ".reference", "wow-api-dump", flavor.id);
  let build;
  let commit;
  try {
    build = buildFor(flavorRoot);
    commit = commitFor(flavorRoot);
  } catch {
    continue;
  }

  const root = join(flavorRoot, config.dumpRoot);
  let files;
  try {
    files = walk(root);
  } catch {
    continue;
  }
  for (const file of files) {
    const source = relative(repoRoot, file).replaceAll("\\", "/");
    if (inventoryOnly) {
      if (source.toLowerCase().includes(literal.toLowerCase())) {
        console.log(`${flavor.id} ${build} ${flavor.dumpRef}@${commit} ${source}`);
        matches += 1;
      }
      continue;
    }
    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const found = matcher ? matcher.test(line) : (caseSensitive ? line : line.toLowerCase()).includes(literal);
      if (!found) continue;
      console.log(`${flavor.id} ${build} ${flavor.dumpRef}@${commit} ${source}:${index + 1}: ${line.trim().slice(0, 200)}`);
      matches += 1;
      if (matches >= maxResults) {
        console.error(`Stopped after ${maxResults} matches. Use --max=N to change the limit.`);
        process.exit(0);
      }
    }
  }
}

if (matches === 0) {
  console.error(`No matches for '${pattern}'.`);
  process.exit(1);
}
