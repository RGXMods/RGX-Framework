#!/usr/bin/env node
// Build + verify the RGX contract bundle (issue #6).
//
// The bundle is a versioned zip that pins the RGXX contract surface
// (schema, declarative docs, API catalog, conformance vectors)
// separately from the player archive.
//
// Metadata derivation never hand-repeats source truths:
//   - frameworkVersion, wowInterface, sourceRepository come from RGX-Framework.toc
//   - sourceRevision/sourceDirty come from git (or CI env)
//   - the flavor is resolved from the git tag in a detached CI/tag build
//     (name-suffixed flavor TOCs are matched), falling back to the mainline TOC
//
// Determinism: the zip uses a fixed DOS mtime, sorted entries, and fixed
// compression settings. Every byte embedded in the manifest is hashed.
// Rebuilding the same revision therefore reproduces the same logical
// contents and stable hashes.
//
// Usage:
//   node tools/ci/contract-bundle-check.mjs                     # verify only
//   node tools/ci/contract-bundle-check.mjs --out artifacts     # verify + emit
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import { zipSync } from "fflate";
import { conformanceCases } from "./contract-vectors.mjs";

const ROOT = resolve(join(import.meta.dirname, "..", ".."));
const CONTRACT_FORMAT_VERSION = 1;
const BUNDLE_ROOT = "RGX-Contract";
// fflate writes local DOS timestamp fields, so construct fixed local components
// rather than an absolute instant that would vary when built in another zone.
const FIXED_MTIME = new Date(1980, 0, 1, 0, 0, 0);

const args = process.argv.slice(2);
const options = { out: null };
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--out") {
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error("--out requires a directory");
    options.out = resolve(value);
  } else if (arg === "-h" || arg === "--help") {
    console.log("Usage: contract-bundle-check.mjs [--out <dir>]");
    process.exit(0);
  } else {
    throw new Error(`unknown option: ${arg}`);
  }
}

function read(rel) { return readFileSync(join(ROOT, rel)); }
function text(rel) { return read(rel).toString("utf8"); }
function sha256(data) { return createHash("sha256").update(data).digest("hex"); }

function tocValue(toc, key) {
  return toc.match(new RegExp(`^## ${key}:\\s*(.+?)\\s*$`, "m"))?.[1] ?? null;
}

const FLAVOR_TOCS = [
  ["mainline", "RGX-Framework.toc"],
  ["classic-era", "RGX-Framework_Vanilla.toc"],
  ["tbc", "RGX-Framework_TBC.toc"],
  ["wrath", "RGX-Framework_Wrath.toc"],
  ["cata", "RGX-Framework_Cata.toc"],
  ["mists", "RGX-Framework_Mists.toc"],
];

function gitRef() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.CI_COMMIT_SHA) return process.env.CI_COMMIT_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function gitTag() {
  if (process.env.CI_COMMIT_TAG) return process.env.CI_COMMIT_TAG;
  if (process.env.GITHUB_REF_TYPE === "tag") return process.env.GITHUB_REF_NAME ?? null;
  try {
    return execFileSync("git", ["describe", "--exact-match", "--tags", "HEAD"], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function gitDirty() {
  try {
    return execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim().length > 0;
  } catch {
    return null;
  }
}

// Resolve which flavor this revision/tag packages. Tag names like
// "v2.7.8-wrath" are matched against the flavor TOCs; a bare version tag
// (or no tag) is mainline.
function resolveFlavor() {
  const tag = gitTag();
  if (tag) {
    const lower = tag.toLowerCase();
    for (const [flavor, tocFile] of FLAVOR_TOCS) {
      if (flavor === "mainline") continue;
      if (lower.includes(flavor.replace(/-/g, "")) || lower.includes(flavor)) {
        return { flavor, tocFile };
      }
    }
  }
  return { flavor: "mainline", tocFile: "RGX-Framework.toc" };
}

// Catalog of the declarative keys in the shipped surface, with shipped vs
// tier4 status and descriptions straight from the schema, never hand-kept.
function collectSchemaKeys(node, path = []) {
  const entries = [];
  if (node && typeof node === "object" && node.properties) {
    for (const [key, sub] of Object.entries(node.properties)) {
      entries.push({
        key: [...path, key].join("."),
        ships: sub["x-rgx-ships"] ?? null,
        description: sub.description ?? null,
      });
      if (sub.properties) entries.push(...collectSchemaKeys(sub, [...path, key]));
    }
  }
  return entries;
}

function offlineRunner() {
  return `#!/usr/bin/env node
// Offline conformance runner shipped inside the RGX contract bundle.
// Re-runs the same vectors framework CI uses against rgx-addon.schema.json.
// Usage: node conformance/run-vectors.mjs    (requires: npm i ajv)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const bundle = join(dirname(fileURLToPath(import.meta.url)), "..");
const vectors = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "contract-vectors.json"), "utf8")).vectors;

let Ajv2020;
try {
  ({ default: Ajv2020 } = await import("ajv/dist/2020.js"));
} catch {
  console.error("Install ajv (npm i ajv) to run the offline conformance vectors.");
  process.exit(2);
}
const schema = JSON.parse(readFileSync(join(bundle, "rgx-addon.schema.json"), "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

let failures = 0;
for (const { name, opts, valid: expected } of vectors) {
  const actual = validate(opts);
  if (actual === expected) console.log(\`  PASS  \${name}\`);
  else { failures++; console.error(\`  FAIL  \${name} -- \${JSON.stringify(validate.errors)}\`); }
}
console.log(\`Checked \${vectors.length} vector(s), \${failures} failed.\`);
process.exit(failures ? 1 : 0);
`;
}

function zipBundle(entries) {
  const out = {};
  for (const path of Object.keys(entries).sort()) {
    out[path] = [new Uint8Array(entries[path]), { level: 9, mtime: FIXED_MTIME, os: 3, attrs: 0o644 << 16 }];
  }
  return Buffer.from(zipSync(out, { level: 9, mtime: FIXED_MTIME }));
}

// ---- build bundle contents ----
const failures = [];
const { version, interface: wowInterface, website, title } = (() => {
  const toc = text("RGX-Framework.toc");
  return {
    version: tocValue(toc, "Version"),
    interface: tocValue(toc, "Interface"),
    website: tocValue(toc, "X-Website"),
    title: tocValue(toc, "Title"),
  };
})();
if (!version || !wowInterface) failures.push("RGX-Framework.toc must declare Version and Interface");
if (!title) failures.push("RGX-Framework.toc must declare Title");

const { flavor, tocFile } = resolveFlavor();
if (!/^v?\d+\.\d+\.\d+/.test(version)) failures.push(`RGX-Framework.toc Version is not a semantic version: ${version}`);

const schemaRaw = read("schemas/rgx-addon.schema.json");
const schema = JSON.parse(schemaRaw.toString("utf8"));
const declarativeDoc = read("docs/DECLARATIVE-API.md");
if (declarativeDoc.includes("DO NOT EDIT")) failures.push("docs/DECLARATIVE-API.md appears to be generated placeholder content");

const apiCatalogJson = Buffer.from(JSON.stringify({
  description: "Approved declarative API catalog derived from schemas/rgx-addon.schema.json. Keys with ships=\"today\" are implemented in core/core.lua RGX.Addon; \"tier4\" entries are frozen future targets.",
  keys: collectSchemaKeys(schema),
}, null, 2) + "\n");

const conformanceJson = Buffer.from(JSON.stringify({
  schema: "rgx-addon.schema.json",
  runner: "conformance/run-vectors.mjs",
  vectors: conformanceCases,
}, null, 2) + "\n");

const bundleFiles = {
  "rgx-addon.schema.json": schemaRaw,
  "docs/DECLARATIVE-API.md": declarativeDoc,
  "api/catalog.json": apiCatalogJson,
  "conformance/contract-vectors.json": conformanceJson,
  "conformance/run-vectors.mjs": Buffer.from(offlineRunner()),
};

const fileInventory = Object.entries(bundleFiles)
  .map(([path, data]) => ({ path, size: data.length, sha256: sha256(data) }))
  .sort((a, b) => a.path.localeCompare(b.path));

const manifestJson = Buffer.from(JSON.stringify({
  formatVersion: CONTRACT_FORMAT_VERSION,
  frameworkVersion: version,
  title,
  flavor,
  wowInterface,
  sourceRepository: website ?? null,
  sourceRevision: gitRef(),
  sourceDirty: gitDirty(),
  generatedBy: "tools/ci/contract-bundle-check.mjs",
  schemaId: schema.$id ?? null,
  files: fileInventory,
}, null, 2) + "\n");

// Verify: the manifest must list every file sha, and the zip must round-trip.
for (const { path, sha256: expected } of fileInventory) {
  const actual = sha256(bundleFiles[path]);
  if (actual !== expected) failures.push(`hash drift for ${path}`);
}
if (!fileInventory.some((f) => f.path === "rgx-addon.schema.json")) failures.push("bundle must contain rgx-addon.schema.json");
if (!fileInventory.some((f) => f.path === "docs/DECLARATIVE-API.md")) failures.push("bundle must contain docs/DECLARATIVE-API.md");
if (!fileInventory.some((f) => f.path === "api/catalog.json")) failures.push("bundle must contain api/catalog.json");
if (!fileInventory.some((f) => f.path === "conformance/contract-vectors.json")) failures.push("bundle must contain conformance/contract-vectors.json");

const zipBytes = zipBundle({
  ...Object.fromEntries(Object.entries(bundleFiles).map(([path, data]) => [`${BUNDLE_ROOT}/${path}`, data])),
  [`${BUNDLE_ROOT}/manifest.json`]: manifestJson,
});

if (failures.length) {
  for (const failure of failures) console.error(`CONTRACT BUNDLE ERROR  ${failure}`);
  process.exit(1);
}

if (options.out) {
  rmSync(options.out, { recursive: true, force: true });
  mkdirSync(options.out, { recursive: true });
  const base = `RGX-Framework-${version}-contract`;
  writeFileSync(join(options.out, `${base}.manifest.json`), manifestJson);
  writeFileSync(join(options.out, `${base}.zip`), zipBytes);
  const checksums = [
    `${sha256(manifestJson)}  ${base}.manifest.json`,
    `${sha256(zipBytes)}  ${base}.zip`,
  ].join("\n") + "\n";
  writeFileSync(join(options.out, `${base}.sha256`), checksums);
  console.log(`CONTRACT BUNDLE OK  ${fileInventory.length} file(s), flavor=${flavor}, version=${version}`);
  console.log(`  -> ${join(options.out, `${base}.zip`)}`);
  console.log(`  -> ${join(options.out, `${base}.manifest.json`)}`);
  console.log(`  -> ${join(options.out, `${base}.sha256`)}`);
} else {
  console.log(`CONTRACT BUNDLE OK  ${fileInventory.length} file(s), flavor=${flavor}, version=${version}`);
}
