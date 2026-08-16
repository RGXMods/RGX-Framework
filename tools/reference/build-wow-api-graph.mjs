#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../..");
const config = JSON.parse(readFileSync(join(scriptDir, "wow-ui-source.json"), "utf8"));
const referenceRoot = join(repoRoot, ".reference", "wow-ui-source");
const outputRoot = join(repoRoot, ".reference", "wow-ui-graph", "graphify-out");
const outputPath = join(outputRoot, "graph.json");
const nodes = new Map();
const links = new Map();
const sourceMetadata = [];

const idPart = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
  .replace(/[^A-Za-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "")
  .toLowerCase();
const nodeId = (flavor, kind, label) => `${flavor}:${kind}:${idPart(label)}`;

function addNode(id, attributes) {
  if (!nodes.has(id)) nodes.set(id, { id, ...attributes });
}

function addLink(source, target, relation, sourceFile, sourceLocation, attributes = {}) {
  const key = `${source}\0${target}\0${relation}`;
  if (links.has(key)) return;
  links.set(key, {
    source,
    target,
    relation,
    confidence: "EXTRACTED",
    confidence_score: 1,
    source_file: sourceFile,
    source_location: sourceLocation,
    ...attributes,
  });
}

function git(path, ...args) {
  return execFileSync("git", ["-C", path, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

function walkLua(path, files = []) {
  for (const entry of readdirSync(path)) {
    const full = join(path, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walkLua(full, files);
    else if (entry.endsWith(".lua")) files.push(full);
  }
  return files;
}

function matchingBrace(text, start) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return index;
  }
  return -1;
}

function lineAt(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

function objectBlocks(sectionText, baseOffset) {
  const blocks = [];
  let depth = 0;
  let start = -1;
  let quote = null;
  let escaped = false;
  for (let index = 0; index < sectionText.length; index += 1) {
    const char = sectionText[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") {
      depth += 1;
      if (depth === 1) start = index;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        blocks.push({ text: sectionText.slice(start, index + 1), offset: baseOffset + start });
        start = -1;
      }
    }
  }
  return blocks;
}

function section(text, name) {
  const match = new RegExp(`\\n\\s*${name}\\s*=\\s*`).exec(text);
  if (!match) return null;
  const brace = text.indexOf("{", match.index + match[0].length);
  const end = matchingBrace(text, brace);
  if (brace < 0 || end < 0) return null;
  return { text: text.slice(brace + 1, end), offset: brace + 1 };
}

function field(block, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]+)"`).exec(block);
  return match ? match[1] : null;
}

function booleanFlags(block) {
  const flags = [];
  const pattern = /\b([A-Za-z][A-Za-z0-9_]*)\s*=\s*true\b/g;
  let match;
  while ((match = pattern.exec(block))) flags.push({ name: match[1], offset: match.index });
  return flags;
}

function entityFlags(block) {
  const markers = ["Arguments", "Returns", "Payload", "Fields"]
    .map((name) => new RegExp(`\\n\\s*${name}\\s*=`).exec(block)?.index)
    .filter((offset) => Number.isInteger(offset));
  const header = markers.length > 0 ? block.slice(0, Math.min(...markers)) : block;
  return booleanFlags(header).filter(({ name }) => /^(HasRestrictions|Requires|Secret|ReturnsNeverSecret)/.test(name));
}

function secretArguments(block) {
  const markers = ["Arguments", "Returns", "Payload", "Fields"]
    .map((name) => new RegExp(`\\n\\s*${name}\\s*=`).exec(block)?.index)
    .filter((offset) => Number.isInteger(offset));
  const header = markers.length > 0 ? block.slice(0, Math.min(...markers)) : block;
  return field(header, "SecretArguments");
}

function fieldFlags(block) {
  return booleanFlags(block).filter(({ name }) => /^(ConditionalSecretContents|NeverSecret|NeverSecretContents|SecretValue)$/.test(name));
}

function typedFields(block, key) {
  const nested = section(`\n${block}`, key);
  if (!nested) return [];
  return objectBlocks(nested.text, nested.offset - 1).map((entry) => ({
    name: field(entry.text, "Name"),
    type: field(entry.text, "Type"),
    innerType: field(entry.text, "InnerType"),
    flags: fieldFlags(entry.text),
    offset: entry.offset,
  })).filter((entry) => entry.name);
}

function ensureConcept(flavor, kind, label, sourceFile, sourceLine) {
  const id = nodeId(flavor, kind, label);
  addNode(id, {
    label,
    file_type: "concept",
    entity_type: kind,
    flavor,
    source_file: sourceFile,
    source_location: `L${sourceLine}`,
  });
  return id;
}

function addEntity({ flavor, namespace, kind, name, literalName, block, offset, sourceFile, fullText }) {
  const displayName = kind === "event" ? (literalName || name) : (namespace ? `${namespace}.${name}` : name);
  const id = nodeId(flavor, kind, displayName);
  const sourceLine = lineAt(fullText, offset);
  const flags = entityFlags(block);
  const secretArgumentPolicy = secretArguments(block);
  addNode(id, {
    label: displayName,
    file_type: "concept",
    entity_type: kind,
    flavor,
    namespace: namespace || null,
    api_name: name,
    literal_name: literalName || null,
    restrictions: flags.map((entry) => entry.name),
    secret_arguments: secretArgumentPolicy,
    source_file: sourceFile,
    source_location: `L${sourceLine}`,
  });

  for (const flag of flags) {
    const flagId = ensureConcept(flavor, "predicate", flag.name, sourceFile, lineAt(fullText, offset + flag.offset));
    addLink(id, flagId, "restricted_by", sourceFile, `L${lineAt(fullText, offset + flag.offset)}`);
  }
  if (secretArgumentPolicy) {
    const policyId = ensureConcept(flavor, "secret_argument_policy", secretArgumentPolicy, sourceFile, sourceLine);
    addLink(id, policyId, "accepts_secret_arguments", sourceFile, `L${sourceLine}`);
  }

  for (const [fieldSection, relation] of [["Arguments", "accepts"], ["Returns", "returns"], ["Payload", "payload"], ["Fields", "field"]]) {
    for (const item of typedFields(block, fieldSection)) {
      const fieldLabel = `${displayName}.${item.name}`;
      const fieldId = ensureConcept(flavor, `${kind}_${fieldSection.toLowerCase()}_field`, fieldLabel, sourceFile, lineAt(fullText, offset + item.offset));
      addLink(id, fieldId, relation, sourceFile, `L${lineAt(fullText, offset + item.offset)}`);
      for (const typeName of [item.type, item.innerType].filter(Boolean)) {
        const typeId = ensureConcept(flavor, "type", typeName, sourceFile, lineAt(fullText, offset + item.offset));
        addLink(fieldId, typeId, item.innerType ? "contains_type" : "has_type", sourceFile, `L${lineAt(fullText, offset + item.offset)}`);
      }
      for (const flag of item.flags) {
        const flagId = ensureConcept(flavor, "field_secrecy", flag.name, sourceFile, lineAt(fullText, offset + item.offset + flag.offset));
        addLink(fieldId, flagId, "secrecy", sourceFile, `L${lineAt(fullText, offset + item.offset + flag.offset)}`);
      }
    }
  }
}

for (const flavor of config.flavors) {
  const flavorRoot = join(referenceRoot, flavor.id);
  const apiRoot = join(flavorRoot, "Interface", "AddOns", "Blizzard_APIDocumentationGenerated");
  let version;
  let commit;
  try {
    version = readFileSync(join(flavorRoot, "version.txt"), "utf8").trim();
    commit = git(flavorRoot, "rev-parse", "HEAD");
  } catch {
    console.warn(`Skipping ${flavor.id}: run sync-wow-ui-source.mjs first.`);
    continue;
  }
  sourceMetadata.push({ ...flavor, version, commit });

  const flavorId = nodeId(flavor.id, "flavor", flavor.label);
  addNode(flavorId, {
    label: `${flavor.label} ${version}`,
    file_type: "concept",
    entity_type: "flavor",
    flavor: flavor.id,
    upstream_ref: flavor.ref,
    upstream_commit: commit,
    source_file: `.reference/wow-ui-source/${flavor.id}/version.txt`,
    source_location: "L1",
  });

  for (const file of walkLua(apiRoot)) {
    const text = readFileSync(file, "utf8");
    const sourceFile = relative(repoRoot, file).replaceAll("\\", "/");
    const systemName = field(text, "Name") || basename(file).replace(/Documentation\.lua$/, "");
    const namespace = field(text, "Namespace");
    const systemId = nodeId(flavor.id, "system", namespace || systemName);
    addNode(systemId, {
      label: namespace || systemName,
      file_type: "concept",
      entity_type: "system",
      flavor: flavor.id,
      namespace: namespace || null,
      source_file: sourceFile,
      source_location: `L${lineAt(text, text.indexOf(`Name = "${systemName}"`))}`,
    });
    addLink(flavorId, systemId, "provides", sourceFile, "L1");

    for (const [sectionName, kind] of [["Functions", "function"], ["Events", "event"], ["Tables", "type"], ["Predicates", "predicate"]]) {
      const found = section(text, sectionName);
      if (!found) continue;
      for (const entry of objectBlocks(found.text, found.offset)) {
        const name = field(entry.text, "Name");
        if (!name) continue;
        const literalName = field(entry.text, "LiteralName");
        addEntity({
          flavor: flavor.id,
          namespace: kind === "function" ? namespace : null,
          kind,
          name,
          literalName,
          block: entry.text,
          offset: entry.offset,
          sourceFile,
          fullText: text,
        });
        const displayName = kind === "event" ? (literalName || name) : (namespace && kind === "function" ? `${namespace}.${name}` : name);
        addLink(systemId, nodeId(flavor.id, kind, displayName), "contains", sourceFile, `L${lineAt(text, entry.offset)}`);
      }
    }
  }
}

const communityByFlavor = new Map();
for (const flavor of sourceMetadata) communityByFlavor.set(flavor.id, communityByFlavor.size);
for (const node of nodes.values()) {
  node.community = communityByFlavor.get(node.flavor) ?? null;
  node.community_name = sourceMetadata.find((flavor) => flavor.id === node.flavor)?.label || node.flavor;
  node.norm_label = node.label.toLowerCase();
}

function writeGraph(path, graphNodes, graphLinks, sources, name) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({
    directed: false,
    multigraph: false,
    graph: {
      name,
      repository: config.repository,
      built_at: new Date().toISOString(),
      sources,
    },
    nodes: graphNodes,
    links: graphLinks,
    hyperedges: [],
  }, null, 2)}\n`);
  console.log(`Built ${relative(repoRoot, path)}: ${graphNodes.length} nodes, ${graphLinks.length} edges.`);
}

const allNodes = [...nodes.values()];
const allLinks = [...links.values()];
writeGraph(outputPath, allNodes, allLinks, sourceMetadata, "Gethe WoW UI generated API reference");

for (const flavor of sourceMetadata) {
  const flavorNodes = allNodes.filter((node) => node.flavor === flavor.id);
  const flavorNodeIds = new Set(flavorNodes.map((node) => node.id));
  const flavorLinks = allLinks.filter((link) => flavorNodeIds.has(link.source) && flavorNodeIds.has(link.target));
  const flavorPath = join(repoRoot, ".reference", "wow-ui-graph", flavor.id, "graphify-out", "graph.json");
  writeGraph(flavorPath, flavorNodes, flavorLinks, [flavor], `${flavor.label} ${flavor.version} generated API reference`);
}
