#!/usr/bin/env node
// Build a sanitized public GitHub tree from the full GitLab source.
//
// GitLab remains authoritative. This script removes internal references,
// agent instructions, internal CI, historical changelogs, and internal-only
// docs, then creates a standalone commit/tag suitable for the public mirror.
//
// Usage:
//   node tools/release/build-public-mirror.mjs --check
//   node tools/release/build-public-mirror.mjs --ref HEAD --tag v2.8.2 --sha-out /tmp/public-sha
//   node tools/release/build-public-mirror.mjs --ref HEAD --out /tmp/public-tree

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const config = JSON.parse(readFileSync(join(ROOT, "tools/release/public-mirror.json"), "utf8"));
const snapshot = JSON.parse(readFileSync(join(ROOT, "tools/ci/release-snapshot.json"), "utf8"));
const version = snapshot.version;

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} requires a value`);
  return value;
}

function run(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd || ROOT,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"],
  });
}

function remove(path) {
  rmSync(join(out, path), { recursive: true, force: true });
}

const ref = arg("ref", "HEAD");
const tag = arg("tag");
const out = arg("out") || mkdtempSync(join(tmpdir(), "rgx-public-"));
const shaOut = arg("sha-out");
const check = process.argv.includes("--check");
// Optional branch lineage: fetch the mirror's current default branch and
// soft-reset onto it so the rebuilt tree commits on top and the push is a
// fast-forward (a first run with no mirror branch yet starts a fresh lineage).
const baseUrl = arg("base-url");
const baseBranch = arg("base-branch") || "main";

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const tarPath = join(out, ".source.tar");
run(["archive", "-o", tarPath, ref], { cwd: ROOT });
execFileSync("tar", ["-xf", tarPath, "-C", out]);
rmSync(tarPath, { force: true });

for (const path of config.exclude) remove(path);

// Curate docs: only the public docs list plus the current release changelog.
const docs = join(out, "docs");
if (existsSync(docs)) {
  const keep = new Set(config.publicDocs.map((path) => path.replace(/^docs\//, "")));
  for (const entry of readdirSync(docs, { withFileTypes: true })) {
    if (entry.name === "changelogs") continue;
    if (!keep.has(entry.name)) rmSync(join(docs, entry.name), { recursive: true, force: true });
  }
  const changelogs = join(docs, "changelogs");
  if (existsSync(changelogs)) {
    for (const entry of readdirSync(changelogs, { withFileTypes: true })) {
      if (entry.name !== `${version}.md`) rmSync(join(changelogs, entry.name), { recursive: true, force: true });
    }
  }
}

for (const path of config.required) {
  if (!existsSync(join(out, path))) throw new Error(`public mirror missing required path: ${path}`);
}
if (!existsSync(join(out, "docs/changelogs", `${version}.md`))) {
  throw new Error(`public mirror missing current changelog: docs/changelogs/${version}.md`);
}

const count = execFileSync("find", [out, "-type", "f"], { encoding: "utf8" }).trim().split("\n").filter(Boolean).length;
if (check) {
  console.log(`PUBLIC MIRROR OK  ${count} files from ${ref}${tag ? ` (tag ${tag})` : ""}`);
  process.exit(0);
}

run(["init", "-q"], { cwd: out });
if (baseUrl) {
  run(["remote", "add", "base", baseUrl], { cwd: out });
  try {
    run(["fetch", "-q", "base", `+refs/heads/${baseBranch}:refs/heads/base`], { cwd: out });
    run(["reset", "-q", "--soft", "refs/heads/base"], { cwd: out });
  } catch {
    console.log(`no existing ${baseBranch} on the mirror; starting a fresh lineage`);
  }
}
run(["config", "user.name", "RGX Public Mirror"], { cwd: out });
run(["config", "user.email", "public-mirror@realmgx.com"], { cwd: out });
run(["add", "-A"], { cwd: out });
run(["commit", "-q", "-m", `Public mirror of ${ref}${tag ? ` (${tag})` : ""} [public-mirror]`], { cwd: out });
if (tag) run(["tag", "-a", tag, "-m", `RGX-Framework ${tag} public tree`], { cwd: out });
const commit = run(["rev-parse", "HEAD"], { cwd: out }).trim();
if (shaOut) writeFileSync(shaOut, `${commit}\n`);
console.log(commit);
