#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { unzipSync, zipSync } from "fflate";

const RUNTIME_ROOT = "RGX-Framework";
// fflate writes local DOS timestamp fields, so construct fixed local components
// rather than an absolute instant that would vary when built in another zone.
const FIXED_MTIME = new Date(1980, 0, 1, 0, 0, 0);
const FORBIDDEN_PLAYER_EXTENSIONS = new Set([
  ".c", ".cc", ".cpp", ".cs", ".go", ".h", ".hpp", ".java", ".js",
  ".jsx", ".json", ".mjs", ".cjs", ".py", ".rs", ".ts", ".tsx",
]);
const FORBIDDEN_PLAYER_SEGMENTS = new Set([
  ".git", ".github", ".reference", "docs", "graphify-out", "node_modules",
  "schemas", "src-tauri", "tools",
]);

const args = process.argv.slice(2);
const options = { root: resolve(join(process.cwd(), "..", "..")), out: null, inspect: null };
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--out" || arg === "--inspect") {
    const value = args[++i];
    if (!value || value.startsWith("--")) throw new Error(`${arg} requires a path`);
    options[arg.slice(2)] = value;
  }
  else if (arg === "-h" || arg === "--help") {
    console.log("Usage: package-manifest-check.mjs [repo-root] [--out <dir>] [--inspect <runtime.zip>]");
    process.exit(0);
  } else if (arg.startsWith("--")) {
    throw new Error(`unknown option: ${arg}`);
  } else {
    options.root = resolve(arg);
  }
}
if (options.out) options.out = resolve(options.out);
if (options.inspect) options.inspect = resolve(options.inspect);

function normalizedPath(path) {
  return path.split(sep).join("/");
}

function read(path) {
  return readFileSync(join(options.root, path));
}

function text(path) {
  return read(path).toString("utf8");
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function listFiles(directory) {
  const files = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(normalizedPath(relative(options.root, path)));
    }
  };
  visit(join(options.root, directory));
  return files.sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
}

function runtimeSourceFiles() {
  return [
    "RGX-Framework.toc",
    "RGX-Framework_Vanilla.toc",
    "RGX-Framework_TBC.toc",
    "RGX-Framework_Wrath.toc",
    "RGX-Framework_Cata.toc",
    "RGX-Framework_Mists.toc",
    "RGX-Framework.xml",
    "LICENSE.txt",
    ...listFiles("core"),
    ...listFiles("modules"),
    "media/logo.tga",
    ...listFiles("media/fonts"),
  ];
}

function inventory(files, archiveRoot) {
  return files.map((source) => {
    const data = read(source);
    return {
      path: `${archiveRoot}/${source}`,
      source,
      size: data.length,
      sha256: sha256(data),
    };
  });
}

function parseToc() {
  const toc = text("RGX-Framework.toc");
  const value = (key) => toc.match(new RegExp(`^## ${key}:\\s*(.+?)\\s*$`, "m"))?.[1] ?? null;
  return { version: value("Version"), interface: value("Interface"), website: value("X-Website") };
}

function sourceRevision() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.CI_COMMIT_SHA) return process.env.CI_COMMIT_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: options.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function sourceDirty() {
  try {
    return execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], {
      cwd: options.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim().length > 0;
  } catch {
    return null;
  }
}

function artifactMetadata(runtimeFiles) {
  const { version, interface: wowInterface, website: sourceRepository } = parseToc();
  if (!version || !wowInterface) throw new Error("RGX-Framework.toc must declare Version and Interface");
  return {
    formatVersion: 3,
    frameworkVersion: version,
    sourceRepository,
    sourceRevision: sourceRevision(),
    sourceDirty: sourceDirty(),
    wowInterface,
    supportedFlavors: ["retail", "classic-era", "tbc", "wrath", "cata", "mists"],
    runtime: {
      archive: `RGX-Framework-${version}.zip`,
      root: RUNTIME_ROOT,
      files: inventory(runtimeFiles, RUNTIME_ROOT),
    },
  };
}

function addFile(entries, path, data) {
  entries[path] = [new Uint8Array(data), { level: 9, mtime: FIXED_MTIME, os: 3, attrs: 0o644 << 16 }];
}

function zipArtifact(files, archiveRoot, extra = {}) {
  const entries = {};
  for (const source of files) addFile(entries, `${archiveRoot}/${source}`, read(source));
  for (const [path, data] of Object.entries(extra)) addFile(entries, `${archiveRoot}/${path}`, Buffer.from(data));
  return Buffer.from(zipSync(entries, { level: 9, mtime: FIXED_MTIME }));
}

function checksumText(artifacts) {
  return Object.entries(artifacts)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, data]) => `${sha256(data)}  ${name}`)
    .join("\n") + "\n";
}

function archiveEntries(data) {
  return Object.fromEntries(Object.entries(unzipSync(new Uint8Array(data))).map(([path, value]) => [path.replace(/\\/g, "/"), Buffer.from(value)]));
}

function isUnsafeArchivePath(path) {
  return !path || path.startsWith("/") || /^[A-Za-z]:/.test(path) || path.includes("\0") || path.split("/").some((part) => part === "" || part === "." || part === "..");
}

function validateExactArchive(entries, expected, label) {
  const failures = [];
  const allPaths = Object.keys(entries).sort();
  const actualPaths = allPaths.filter((path) => !path.endsWith("/"));
  const expectedPaths = [...expected].sort();
  for (const path of allPaths) {
    const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
    if (isUnsafeArchivePath(normalized)) failures.push(`${label}: unsafe archive path ${path}`);
  }
  for (const path of expectedPaths) if (!entries[path]) failures.push(`${label}: missing ${path}`);
  for (const path of actualPaths) if (!expected.includes(path)) failures.push(`${label}: unexpected ${path}`);
  return failures;
}

function parseRuntimeReferences(xml, toc) {
  return [
    ...xml.matchAll(/<Script\s+file="([^"]+)"/g),
    ...toc.matchAll(/^([^#\s][^\r\n]*\.(?:lua|xml))\s*$/gim),
  ].map((match) => match[1].replace(/\\/g, "/"));
}

function validateRuntimeMetadata(entries, root, label) {
  const failures = [];
  const toc = entries[`${root}/RGX-Framework.toc`]?.toString("utf8");
  const xml = entries[`${root}/RGX-Framework.xml`]?.toString("utf8");
  if (!toc || !xml) return failures;
  if (!/^## SavedVariables:\s*RGXFrameworkDB\s*$/m.test(toc)) failures.push(`${label}: RGX-Framework.toc must declare RGXFrameworkDB`);
  for (const reference of parseRuntimeReferences(xml, toc)) {
    const path = `${root}/${reference}`;
    if (!entries[path]) failures.push(`${label}: load reference is missing ${path}`);
  }
  return failures;
}

function validateRuntime(entries, expectedPaths) {
  const failures = validateExactArchive(entries, expectedPaths, "runtime archive");
  const toc = entries[`${RUNTIME_ROOT}/RGX-Framework.toc`]?.toString("utf8") ?? "";
  const xml = entries[`${RUNTIME_ROOT}/RGX-Framework.xml`]?.toString("utf8") ?? "";
  const loadReferences = new Set(parseRuntimeReferences(xml, toc));
  for (const path of Object.keys(entries)) {
    if (path.endsWith("/")) continue;
    const relativePath = path.slice(`${RUNTIME_ROOT}/`.length);
    const segments = relativePath.toLowerCase().split("/");
    const extension = /\.[^.\/]+$/.exec(relativePath.toLowerCase())?.[0] ?? "";
    if (segments.some((segment) => FORBIDDEN_PLAYER_SEGMENTS.has(segment))) failures.push(`runtime archive: forbidden path ${path}`);
    if (FORBIDDEN_PLAYER_EXTENSIONS.has(extension)) failures.push(`runtime archive: forbidden extension ${path}`);
    const allowed = /^RGX-Framework(?:_(?:Vanilla|TBC|Wrath|Cata|Mists))?\.toc$/.test(relativePath)
      || relativePath === "RGX-Framework.xml"
      || relativePath === "LICENSE.txt"
      || /^(?:core|modules)\/.+\.lua$/.test(relativePath)
      || relativePath === "media/logo.tga"
      || /^media\/fonts\/(?:.+\.(?:otf|ttf)|README\.md)$/.test(relativePath);
    if (!allowed) failures.push(`runtime archive: path is outside the player allowlist ${path}`);
    if (/^(?:core|modules)\/.+\.lua$/.test(relativePath) && !loadReferences.has(relativePath)) failures.push(`runtime archive: Lua file is not in the load graph ${path}`);
  }
  failures.push(...validateRuntimeMetadata(entries, RUNTIME_ROOT, "runtime archive"));
  return failures;
}

function validateSourceBoundary(runtimeFiles) {
  const failures = [];
  const runtimeSet = new Set(runtimeFiles);
  for (const source of runtimeFiles) {
    if (/^(?:tools|schemas|docs)\//.test(source)) failures.push(`source boundary: non-runtime path selected for runtime ${source}`);
  }
  if (!runtimeSet.has("LICENSE.txt")) failures.push("source boundary: LICENSE.txt must ship in the runtime artifact");
  return failures;
}

function validatePkgmeta() {
  const pkgmeta = text(".pkgmeta");
  const failures = [];
  if (/^\s*license\s*:/m.test(pkgmeta)) failures.push(".pkgmeta uses unsupported 'license'; keep tracked LICENSE.txt or use license-output");
  for (const path of ["tools", "docs", "schemas", ".reference", ".release", "artifacts", "graphify-out", "media/kiwi.gif", "media/logo.png"]) {
    if (!new RegExp(`^\\s*- ${path.replace(".", "\\.")}\\s*$`, "m").test(pkgmeta)) failures.push(`.pkgmeta must exclude ${path}`);
  }
  if (/tools\/rgx-mcp intentionally ships|ships in the packaged zip/i.test(pkgmeta)) failures.push(".pkgmeta must not describe developer tooling as player payload");
  return failures;
}

function inspectExternalRuntime(path, expectedRelativePaths) {
  if (!existsSync(path)) throw new Error(`archive to inspect does not exist: ${path}`);
  const entries = archiveEntries(readFileSync(path));
  const roots = [...new Set(Object.keys(entries).map((entry) => entry.split("/")[0]))];
  if (roots.length !== 1) return [`packager archive: expected one root directory, found ${roots.join(", ") || "none"}`];
  if (roots[0] !== RUNTIME_ROOT) return [`packager archive: expected root ${RUNTIME_ROOT}, found ${roots[0]}`];
  const expected = expectedRelativePaths.map((path) => `${RUNTIME_ROOT}/${path}`);
  const failures = validateExactArchive(entries, expected, "packager archive");
  for (const path of Object.keys(entries)) {
    if (path.endsWith("/")) continue;
    const relativePath = path.slice(roots[0].length + 1);
    const extension = /\.[^.\/]+$/.exec(relativePath.toLowerCase())?.[0] ?? "";
    if (relativePath.toLowerCase().split("/").some((segment) => FORBIDDEN_PLAYER_SEGMENTS.has(segment))) failures.push(`packager archive: forbidden path ${path}`);
    if (FORBIDDEN_PLAYER_EXTENSIONS.has(extension)) failures.push(`packager archive: forbidden extension ${path}`);
  }
  failures.push(...validateRuntimeMetadata(entries, RUNTIME_ROOT, "packager archive"));
  return failures;
}

function writeArtifacts(metadata, runtimeZip) {
  const expectedOutput = resolve(options.root, "artifacts");
  if (options.out !== expectedOutput) throw new Error(`artifact output must be ${expectedOutput}`);
  rmSync(options.out, { recursive: true, force: true });
  mkdirSync(options.out, { recursive: true });
  const artifacts = {
    [metadata.runtime.archive]: runtimeZip,
  };
  const manifestName = `RGX-Framework-${metadata.frameworkVersion}.manifest.json`;
  const manifest = Buffer.from(JSON.stringify(metadata, null, 2) + "\n");
  artifacts[manifestName] = manifest;
  const checksumsName = `RGX-Framework-${metadata.frameworkVersion}.sha256`;
  const checksums = Buffer.from(checksumText(artifacts));
  artifacts[checksumsName] = checksums;
  for (const [name, data] of Object.entries(artifacts)) writeFileSync(join(options.out, name), data);
  return Object.keys(artifacts).sort();
}

const runtimeFiles = runtimeSourceFiles();
for (const path of runtimeFiles) {
  if (!existsSync(join(options.root, path)) || !statSync(join(options.root, path)).isFile()) throw new Error(`artifact source file is missing: ${path}`);
}

const metadata = artifactMetadata(runtimeFiles);
const runtimeZip = zipArtifact(runtimeFiles, RUNTIME_ROOT);

const runtimeExpected = [
  ...metadata.runtime.files.map((file) => file.path),
];
const failures = [
  ...validatePkgmeta(),
  ...validateSourceBoundary(runtimeFiles),
  ...validateRuntime(archiveEntries(runtimeZip), runtimeExpected),
];
if (options.inspect) failures.push(...inspectExternalRuntime(options.inspect, runtimeFiles));

if (failures.length) {
  for (const failure of failures) console.error(`PACKAGE ERROR  ${failure}`);
  process.exit(1);
}

let output = [];
if (options.out) output = writeArtifacts(metadata, runtimeZip);
console.log(`PACKAGE BOUNDARY OK  ${runtimeFiles.length} runtime file(s).`);
if (options.inspect) console.log(`PACKAGER ARCHIVE OK  ${basename(options.inspect)}`);
if (output.length) console.log(`ARTIFACTS BUILT  ${output.join(", ")}`);
