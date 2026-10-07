#!/usr/bin/env node
// Maps RGX runtime API usage against the synced client dumps
// (.reference/wow-api-dump/) and reports per-flavor gaps: symbols the runtime
// references that are absent from one or more supported clients. The dumps are
// capability evidence for the five dumped flavors; wrath/cata have no dump, so
// confirm those in the wow-ui-source mirror. Graphs are indexes, dumps are
// evidence; confirm runtime-driving conclusions before gating code.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const config = JSON.parse(readFileSync(join(scriptDir, "wow-api-dump.json"), "utf8"));
const dumpRoot = join(repoRoot, ".reference", "wow-api-dump");
const manifest = JSON.parse(readFileSync(join(dumpRoot, "manifest.json"), "utf8"));
const sourceRoots = ["core", "modules"];

const args = process.argv.slice(2);
const option = (name) => {
  const entry = args.find((arg) => arg.startsWith(`--${name}=`));
  return entry ? entry.slice(name.length + 3) : null;
};
const jsonOut = args.includes("--json");
const maxSites = Number(option("max-sites") || 3);
const kinds = new Set((option("kind") || "globals,enums,events,methods").split(",").map((s) => s.trim()));
const flavorFilter = option("flavor") ? new Set(option("flavor").split(",").map((s) => s.trim())) : null;

const flavors = config.flavors
  .filter((flavor) => flavor.dumpRef)
  .map((flavor) => {
    const meta = manifest.flavors.find((entry) => entry.id === flavor.id) || {};
    return { id: flavor.id, label: meta.label || flavor.id, build: meta.build || "?", commit: meta.commit || "?" };
  })
  .filter((flavor) => !flavorFilter || flavorFilter.has(flavor.id));

function quoted(text) {
  const out = new Set();
  for (const match of text.matchAll(/"([^"\n]+)"|'([^'\n]+)'/g)) out.add(match[1] ?? match[2]);
  return out;
}

function parseEnums(text) {
  const enums = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    let match = line.match(/^\t([A-Za-z0-9_]+) = \{$/);
    if (match) {
      current = match[1];
      enums.set(current, new Set());
      continue;
    }
    if (line === "}") {
      current = null;
      continue;
    }
    match = line.match(/^\t\t([A-Za-z0-9_]+) = /);
    if (match && current) enums.get(current).add(match[1]);
  }
  return enums;
}

function parseWidgetMethods(text) {
  const tables = new Map();
  let current = null;
  let inMethods = false;
  for (const line of text.split(/\r?\n/)) {
    let match = line.match(/^\t([A-Za-z0-9_]+) = \{$/);
    if (match) {
      current = match[1];
      tables.set(current, new Set());
      inMethods = false;
      continue;
    }
    if (/^\t\tmethods = \{$/.test(line)) {
      inMethods = true;
      continue;
    }
    if (inMethods) {
      match = line.match(/"([^"]+)"/);
      if (match) {
        tables.get(current).add(match[1]);
        continue;
      }
      if (/^\t\t\},?$/.test(line)) inMethods = false;
    }
  }
  return tables;
}

function parseSimpleMethodLists(text) {
  const tables = new Map();
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    let match = line.match(/^\t([A-Za-z0-9_]+) = \{$/);
    if (match) {
      current = match[1];
      tables.set(current, new Set());
      continue;
    }
    match = line.match(/^\t\t"([^"]+)"/);
    if (match && current) tables.get(current).add(match[1]);
  }
  return tables;
}

// Blank Lua comments while preserving string literals and line numbers.
function sanitize(source) {
  const out = source.split("");
  const length = source.length;
  let index = 0;
  while (index < length) {
    const char = source[index];
    if (char === "-" && source[index + 1] === "-") {
      const block = source.slice(index + 2).match(/^\[(=*)\[/);
      if (block) {
        const close = `]${"=".repeat(block[1].length)}]`;
        const end = source.indexOf(close, index + 2 + block[0].length);
        const stop = end === -1 ? length : end + close.length;
        for (let cursor = index; cursor < stop; cursor += 1) {
          if (source[cursor] !== "\n" && source[cursor] !== "\r") out[cursor] = " ";
        }
        index = stop;
      } else {
        let end = source.indexOf("\n", index);
        if (end === -1) end = length;
        for (let cursor = index; cursor < end; cursor += 1) out[cursor] = " ";
        index = end;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      index += 1;
      while (index < length) {
        if (source[index] === "\\") {
          index += 2;
          continue;
        }
        if (source[index] === char || source[index] === "\n") {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }
    if (char === "[") {
      const long = source.slice(index).match(/^\[(=*)\[/);
      if (long) {
        const close = `]${"=".repeat(long[1].length)}]`;
        const end = source.indexOf(close, index + long[0].length);
        index = end === -1 ? length : end + close.length;
        continue;
      }
    }
    index += 1;
  }
  return out.join("");
}

function loadFlavor(id) {
  const resources = join(dumpRoot, id, config.dumpRoot);
  const read = (file) => readFileSync(join(resources, file), "utf8");
  return {
    globals: quoted(read("GlobalAPI.lua")),
    framexml: quoted(read("FrameXML.lua")),
    events: new Set([...quoted(read("Events.lua"))].filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name))),
    enums: parseEnums(read("LuaEnum.lua")),
    methods: new Set([
      ...[...parseWidgetMethods(read("WidgetAPI.lua")).values()].flatMap((set) => [...set]),
      ...[...parseSimpleMethodLists(read("ScriptObjectAPI.lua")).values()].flatMap((set) => [...set]),
    ]),
  };
}

function walk(path, files = []) {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (entry.endsWith(".lua")) files.push(full);
  }
  return files;
}

const flavorData = new Map(flavors.map((flavor) => [flavor.id, loadFlavor(flavor.id)]));
const globalUnion = new Set();
const methodUnion = new Set();
for (const data of flavorData.values()) {
  for (const name of data.globals) globalUnion.add(name);
  for (const name of data.framexml) globalUnion.add(name);
  for (const name of data.methods) methodUnion.add(name);
}

const KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in",
  "local", "nil", "not", "or", "repeat", "return", "then", "true", "until", "while",
]);

const files = sourceRoots.flatMap((root) => walk(join(repoRoot, root)));
const records = new Map(); // `${kind}\u0000${symbol}` -> { kind, symbol, sites: Map }
function record(kind, symbol, file, line) {
  const key = `${kind}\u0000${symbol}`;
  let entry = records.get(key);
  if (!entry) {
    entry = { kind, symbol, sites: new Map() };
    records.set(key, entry);
  }
  const site = `${file}:${line}`;
  entry.sites.set(site, (entry.sites.get(site) || 0) + 1);
}

const patterns = {
  globals: /(?<![:\w.])([A-Za-z_]\w*)\s*\(/g,
  c: /\bC_[A-Za-z0-9_]+\.[A-Za-z0-9_]+/g,
  enum: /\bEnum\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)/g,
  events: /\b(?:Register[A-Za-z_]*Event|Unregister[A-Za-z_]*Event|Is[A-Za-z_]*EventRegistered|FireEvent|RegisterEventCallback)\(\s*"([A-Z][A-Z0-9_]*)"/g,
  methods: /:([A-Z][A-Za-z0-9_]*)\(/g,
};

let referenceCount = 0;
const sourceLines = new Map();
for (const absolute of files) {
  const file = relative(repoRoot, absolute).replaceAll("\\", "/");
  if (file.includes(".reference/")) continue;
  const text = sanitize(readFileSync(absolute, "utf8"));
  const lines = text.split(/\r?\n/);
  sourceLines.set(file, lines);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;
    if (kinds.has("globals")) {
      for (const match of line.matchAll(patterns.c)) {
        record("global", match[0], file, lineNumber);
        referenceCount += 1;
      }
      for (const match of line.matchAll(patterns.enum)) {
        record("enum", `Enum.${match[1]}.${match[2]}`, file, lineNumber);
        referenceCount += 1;
      }
      for (const match of line.matchAll(patterns.globals)) {
        const name = match[1];
        if (KEYWORDS.has(name) || !globalUnion.has(name)) continue;
        const before = line.slice(0, match.index);
        if (/\bfunction\s+$/.test(before)) continue;
        record("global", name, file, lineNumber);
        referenceCount += 1;
      }
    }
    if (kinds.has("events")) {
      for (const match of line.matchAll(patterns.events)) {
        record("event", match[1], file, lineNumber);
        referenceCount += 1;
      }
    }
    if (kinds.has("methods")) {
      for (const match of line.matchAll(patterns.methods)) {
        if (!methodUnion.has(match[1])) continue;
        const before = line.slice(0, match.index);
        if (/\bfunction\s+[\w.]*$/.test(before)) continue;
        record("method", match[1], file, lineNumber);
        referenceCount += 1;
      }
    }
  }
}

// RegisterModule opts flavors: a symbol absent on a flavor whose owning module
// never loads there is gated, not a gap.
const fileGates = new Map();
for (const [file, lines] of sourceLines) {
  let gate = null;
  for (const line of lines) {
    const match = line.match(/RegisterModule\([^)]*flavors\s*=\s*\{([^}]*)\}/);
    if (match) {
      gate = new Set(
        match[1].split(",").map((value) => value.trim().replace(/^["']|["']$/g, "")).filter(Boolean)
      );
    }
  }
  if (gate) fileGates.set(file, gate);
}

const findings = [];
for (const entry of records.values()) {
  const availability = new Map();
  for (const flavor of flavors) {
    const data = flavorData.get(flavor.id);
    let value = "no";
    if (entry.kind === "global") {
      if (data.globals.has(entry.symbol)) value = "yes";
      else if (data.framexml.has(entry.symbol)) value = "fx";
    } else if (entry.kind === "enum") {
      const [, enumName, member] = entry.symbol.split(".");
      if (data.enums.get(enumName)?.has(member)) value = "yes";
    } else if (entry.kind === "event") {
      if (data.events.has(entry.symbol)) value = "yes";
    } else if (entry.kind === "method") {
      if (data.methods.has(entry.symbol)) value = "yes";
    }
    availability.set(flavor.id, value);
  }
  const values = [...availability.values()];
  const absentIn = values.filter((value) => value === "no").length;
  if (absentIn === 0) continue;
  let group;
  if (absentIn === values.length) group = "absent-everywhere";
  else if (availability.get("forever") === "no") group = "absent-on-forever";
  else group = "absent-on-some";
  findings.push({ ...entry, availability, group });
}

findings.sort((a, b) => a.group.localeCompare(b.group) || a.kind.localeCompare(b.kind) || a.symbol.localeCompare(b.symbol));

// Site status: g gate | u local guard | s event dispatcher pcall | ! open.
// Open means absent on a flavor where the module loads and no local handling
// is visible; confirm each against the dumps and wow-ui-source before acting.
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isGuardedSite(finding, window) {
  const components = finding.symbol.split(".");
  const prefix = components[0] === "Enum"
    ? components.slice(0, 2).join(".")
    : components[0];
  const p = escapeRegExp(prefix);
  const guard = new RegExp(
    `type\\(\\s*${p}\\b` +
    `|\\b${p}\\s*(?:and|or)\\b` +
    `|\\bif\\s+(?:not\\s+)?${p}\\b` +
    `|\\bHasEvent\\(\\s*["']${p}["']` +
    `|\\bpcall\\(\\s*${p}\\b`
  );
  return guard.test(window);
}

function classifySite(finding, site) {
  const separator = site.lastIndexOf(":");
  const file = site.slice(0, separator);
  const lineNumber = Number(site.slice(separator + 1));
  const gate = fileGates.get(file);
  let openFlavors = 0;
  for (const flavor of flavors) {
    if (finding.availability.get(flavor.id) !== "no") continue;
    if (!gate || gate.has(flavor.id)) openFlavors += 1;
  }
  if (openFlavors === 0) return "g";
  const lines = sourceLines.get(file) || [];
  const window = lines
    .slice(Math.max(0, lineNumber - 4), Math.min(lines.length, lineNumber + 1))
    .join("\n");
  if (isGuardedSite(finding, window)) return "u";
  // RGX:RegisterEvent routes through core/systems/events.lua's pcall-guarded
  // registration; an absent event never fires and never throws here.
  if (finding.kind === "event") return "s";
  return "!";
}

for (const finding of findings) {
  finding.siteStatus = new Map(
    [...finding.sites.keys()].map((site) => [site, classifySite(finding, site)])
  );
}

if (jsonOut) {
  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    scannedFiles: files.length,
    references: referenceCount,
    flavors: flavors.map((flavor) => {
      const meta = manifest.flavors.find((entry) => entry.id === flavor.id) || {};
      return { id: flavor.id, build: meta.build, commit: meta.commit, dumpRef: meta.dumpRef };
    }),
    findings: findings.map((finding) => ({
      group: finding.group,
      kind: finding.kind,
      symbol: finding.symbol,
      availability: Object.fromEntries(finding.availability),
      sites: [...finding.sites.entries()].map(([site, count]) => ({
        ref: site,
        count,
        status: finding.siteStatus.get(site),
      })),
      count: [...finding.sites.values()].reduce((sum, value) => sum + value, 0),
    })),
  }, null, 2));
  process.exit(0);
}

const groupLabels = {
  "absent-everywhere": "[A] absent from every dumped flavor (stale/renamed, or addon-internal names)",
  "absent-on-forever": "[B] absent on forever (primary test platform) but present on another flavor",
  "absent-on-some": "[C] absent on some flavors (flavor-gating candidates; present on forever)",
};

console.log("Reference API gap map - RGX runtime vs client dumps");
console.log(`dumps: ${flavors.map((flavor) => `${flavor.id} ${flavor.build}@${flavor.commit.slice(0, 12)}`).join(" | ")}`);
console.log(`scanned: ${files.length} runtime files | ${referenceCount} references | kinds: ${[...kinds].join(",")}`);
console.log(`legend: + present | f framexml-only | - absent (dump evidence; confirm before acting)`);
console.log(`status: g gated (module not loaded on absent flavor) | u local guard/probe | s event dispatcher pcall | ! open`);
console.log("");

let openTotal = 0;
for (const group of ["absent-everywhere", "absent-on-forever", "absent-on-some"]) {
  const entries = findings.filter((finding) => finding.group === group);
  const openSites = entries
    .flatMap((entry) => [...entry.siteStatus.values()])
    .filter((status) => status === "!").length;
  openTotal += openSites;
  console.log(`${groupLabels[group]} - ${entries.length} (open sites: ${openSites})`);
  let currentKind = null;
  for (const entry of entries) {
    if (entry.kind !== currentKind) {
      currentKind = entry.kind;
      console.log(`  ${currentKind}`);
    }
    const matrix = flavors.map((flavor) => {
      const value = entry.availability.get(flavor.id);
      return `${flavor.id}:${value === "yes" ? "+" : value === "fx" ? "f" : "-"}`;
    }).join(" ");
    console.log(`    ${entry.symbol}  [${matrix}]`);
    const sites = [...entry.sites.keys()].slice(0, maxSites);
    for (const site of sites) console.log(`      ${site} [${entry.siteStatus.get(site)}]`);
    if (entry.sites.size > maxSites) console.log(`      ... +${entry.sites.size - maxSites} more sites`);
  }
  console.log("");
}

console.log(`Open sites (absent on a loaded flavor with no visible handling): ${openTotal}`);
console.log("");

const byModule = new Map();
for (const finding of findings) {
  for (const [site, status] of finding.siteStatus) {
    const parts = site.split("/");
    const module = parts[0] === "core" ? "core" : parts.slice(0, 2).join("/");
    const bucket = byModule.get(module) || { open: 0, total: 0 };
    bucket.total += 1;
    if (status === "!") bucket.open += 1;
    byModule.set(module, bucket);
  }
}
console.log("Per-module gap sites (open first):");
for (const [module, bucket] of [...byModule.entries()].sort((a, b) => b[1].open - a[1].open || b[1].total - a[1].total)) {
  console.log(`  ${module}: ${bucket.open} open of ${bucket.total}`);
}
