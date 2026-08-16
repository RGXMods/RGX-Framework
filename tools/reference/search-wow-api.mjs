#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const config = JSON.parse(readFileSync(join(scriptDir, "wow-ui-source.json"), "utf8"));
const args = process.argv.slice(2);
const pattern = args.find((arg) => !arg.startsWith("--"));

if (!pattern) {
  console.error("Usage: node tools/reference/search-wow-api.mjs <text> [--flavor=id] [--regex] [--case-sensitive] [--api-only] [--max=N]");
  process.exit(2);
}

const option = (name) => {
  const prefix = `--${name}=`;
  const entry = args.find((arg) => arg.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
};
const flavorFilter = option("flavor");
const maxResults = Number(option("max") || 200);
const useRegex = args.includes("--regex");
const caseSensitive = args.includes("--case-sensitive");
const apiOnly = args.includes("--api-only");
const matcher = useRegex
  ? new RegExp(pattern, caseSensitive ? "" : "i")
  : null;
const literal = caseSensitive ? pattern : pattern.toLowerCase();
const extensions = new Set([".lua", ".xml"]);
let matches = 0;

function commitFor(path) {
  return execFileSync("git", ["-C", path, "rev-parse", "--short=12", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function walk(path, files = []) {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (extensions.has(entry.slice(entry.lastIndexOf(".")))) {
      files.push(full);
    }
  }
  return files;
}

for (const flavor of config.flavors) {
  if (flavorFilter && flavor.id !== flavorFilter) continue;
  const flavorRoot = join(repoRoot, ".reference", "wow-ui-source", flavor.id);
  let version;
  let commit;
  try {
    version = readFileSync(join(flavorRoot, "version.txt"), "utf8").trim();
    commit = commitFor(flavorRoot);
  } catch {
    continue;
  }

  const routes = apiOnly ? config.sparsePaths.slice(0, 1) : config.sparsePaths;
  for (const route of routes) {
    const root = join(flavorRoot, ...route.split("/"));
    let files;
    try {
      files = walk(root);
    } catch {
      continue;
    }
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const found = matcher ? matcher.test(line) : (caseSensitive ? line : line.toLowerCase()).includes(literal);
        if (!found) continue;
        const source = relative(repoRoot, file).replaceAll("\\", "/");
        console.log(`${flavor.id} ${version} ${flavor.ref}@${commit} ${source}:${index + 1}: ${line.trim()}`);
        matches += 1;
        if (matches >= maxResults) {
          console.error(`Stopped after ${maxResults} matches. Use --max=N to change the limit.`);
          process.exit(0);
        }
      }
    }
  }
}

if (matches === 0) {
  console.error(`No matches for '${pattern}'.`);
  process.exit(1);
}
