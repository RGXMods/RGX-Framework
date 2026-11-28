#!/usr/bin/env node
// Master capability registry (issue #133). Shipped module identity continues to
// come from rgx-api.catalog.json; the authored plan supplies Core systems,
// research candidates, ownership reviews and traditional-library successors.
// --write regenerates the full registry; the normal check fails on any drift.
// --resolve-evidence additionally checks cited files/line ranges in synced refs.
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const PLAN_PATH = process.env.RGX_CAPABILITY_PLAN ? resolve(process.env.RGX_CAPABILITY_PLAN) : join(ROOT, "contract/capability-plan.json");
const DOMAIN_PATH = process.env.RGX_DOMAIN_RESEARCH ? resolve(process.env.RGX_DOMAIN_RESEARCH) : join(ROOT, "contract/domain-research.json");
const OUT_PATH = process.env.RGX_CAPABILITY_REGISTRY_OUT ? resolve(process.env.RGX_CAPABILITY_REGISTRY_OUT) : join(ROOT, "contract/schemas/rgx-capability.registry.json");
const API_PATH = process.env.RGX_API_CATALOG ? resolve(process.env.RGX_API_CATALOG) : join(ROOT, "contract/schemas/rgx-api.catalog.json");
const write = process.argv.includes("--write");
const resolveEvidence = process.argv.includes("--resolve-evidence");
const STATUSES = [
  "Discovered", "Researching", "Designed", "Planned", "Partially implemented",
  "Implemented", "Validated", "Blocked", "Superseded", "Rejected",
];
const CLASSIFICATIONS = ["Core", "Library", "Module", "Data", "Tooling"];
const REQUIRED = [
  "id", "name", "classification", "owner", "purpose", "status", "priorArt",
  "apiEvidence", "clientSupport", "dependencies", "publicContract", "performance",
  "testCoverage", "consumerCoverage", "licenseStatus", "acceptanceCriteria", "trackingIssue",
];
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const plan = readJson(PLAN_PATH);
const domainResearch = readJson(DOMAIN_PATH);
const api = readJson(API_PATH);
const UI_MANIFEST_PATH = join(ROOT, ".reference/wow-ui-source/manifest.json");
const DUMP_MANIFEST_PATH = join(ROOT, ".reference/wow-api-dump/manifest.json");
// Canonical CI validates provenance against these tracked manifests. The
// sanitized public mirror intentionally excludes .reference/, so only the
// optional evidence-resolution mode may require their presence there.
const uiManifest = existsSync(UI_MANIFEST_PATH) ? readJson(UI_MANIFEST_PATH) : null;
const dumpManifest = existsSync(DUMP_MANIFEST_PATH) ? readJson(DUMP_MANIFEST_PATH) : null;
assert.equal(plan.planVersion, 1, "capability plan must be version 1");
assert.ok(Array.isArray(domainResearch), "domain research must be an array");
for (const key of ["coreSystems", "candidates", "ownershipReviews", "replacementMatrix"]) {
  assert(Array.isArray(plan[key]), `capability plan ${key} must be an array`);
}

const PURPOSES = {
  achievement: "Achievement state and completion signals",
  auras: "Buff/debuff state with restricted-value boundaries",
  collectibles: "Mount, pet, toy, appearance and heirloom collection signals",
  colorpicker: "Reusable color-selection components",
  colors: "Color registry, manipulation and application",
  combat: "Combat state and combat-log information",
  databroker: "Observable shared data objects",
  delves: "Delve companion and activity state",
  design: "Themes, visual styling and native frame treatments",
  display: "Positioned screen elements and drag edit mode",
  dropdowns: "Nested menus and native menu compatibility",
  fonts: "Typography registration, styling, selectors and previews",
  honor: "Honor progression signals",
  housing: "Player housing progression and decor signals",
  inventory: "Live item counts, material aggregation and change notification",
  levelup: "Character level progression signals",
  locale: "Addon and framework localization registry",
  loot: "Loot, rare-item and currency acquisition signals",
  minimap: "Minimap buttons and compartment integration",
  petbattles: "Pet battle state and progression signals",
  prey: "Prey hunt state and progression signals",
  quest: "Quest lifecycle and objective progress",
  reputation: "Reputation, friendship and renown progression",
  sharedmedia: "Cross-addon media discovery and interoperability",
  sound: "General audio registration, variants and playback",
  textures: "Texture registration and application",
  timers: "Countdown and progress display components",
  tooltip: "Composed, interactive and augmented tooltip content",
  tradingpost: "Trading Post activity and currency signals",
  triggers: "Clone-keyed trigger state, progress and change notification",
  ui: "Widgets, layouts, settings and advanced controls",
  worldmap: "Maps, coordinates, pins and nearest-place lookup",
};

function complete(entry, defaults = {}) {
  const result = {
    id: entry.id,
    name: entry.name,
    classification: entry.classification,
    owner: entry.owner,
    purpose: entry.purpose,
    status: entry.status ?? defaults.status ?? "Discovered",
    priorArt: entry.priorArt ?? [],
    apiEvidence: entry.apiEvidence ?? [],
    clientSupport: entry.clientSupport ?? defaults.clientSupport ?? { assessment: "pending" },
    dependencies: entry.dependencies ?? [],
    publicContract: entry.publicContract ?? null,
    performance: entry.performance ?? "Not yet assessed; no performance claim is implied.",
    testCoverage: entry.testCoverage ?? [],
    consumerCoverage: entry.consumerCoverage ?? [],
    licenseStatus: entry.licenseStatus ?? defaults.licenseStatus ?? "Research only; no source reuse approved",
    acceptanceCriteria: entry.acceptanceCriteria ?? "Establish owner, evidence, consumer need and client-safe validation before implementation.",
    trackingIssue: entry.trackingIssue ?? 133,
  };
  for (const field of ["currentOwner", "nativeSurface", "researchFlags", "evidence"]) {
    if (entry[field] !== undefined) result[field] = entry[field];
  }
  return result;
}

const shipped = api.entries.map((entry) => complete({
  id: `module.${entry.module}`,
  name: PURPOSES[entry.module] ?? entry.module,
  classification: entry.category === "library" ? "Library" : "Module",
  owner: entry.owner,
  purpose: PURPOSES[entry.module] ?? `Registered ${entry.module} capability`,
  status: "Implemented",
  clientSupport: { source: "rgx-api.catalog.json", flavors: entry.flavors },
  publicContract: `catalog:${entry.module}`,
  performance: "See the owning implementation; static catalog enumeration is not a performance claim.",
  testCoverage: ["Static API/architecture gates and applicable owner runtime harnesses"],
  licenseStatus: "RGX original",
  acceptanceCriteria: "Confirm consumer coverage and required per-client behavior before marking Validated.",
}));

const capabilities = [
  ...shipped,
  ...plan.coreSystems.map((entry) => complete(entry, {
    status: "Implemented",
    licenseStatus: "RGX original",
    clientSupport: { assessment: "declared-matrix", validation: "per-owner" },
  })),
  ...plan.candidates.map((entry) => complete(entry)),
  ...domainResearch.map((entry) => complete(entry)),
];

const byId = new Map();
const problems = [];
const implementationLike = new Set(["Partially implemented", "Implemented", "Validated"]);
for (const capability of capabilities) {
  for (const field of REQUIRED) {
    if (!(field in capability)) problems.push(`${capability.id ?? "?"}: missing ${field}`);
  }
  if (byId.has(capability.id)) problems.push(`duplicate capability id ${capability.id}`);
  byId.set(capability.id, capability);
  if (!STATUSES.includes(capability.status)) problems.push(`${capability.id}: invalid status ${capability.status}`);
  if (!CLASSIFICATIONS.includes(capability.classification)) problems.push(`${capability.id}: invalid classification ${capability.classification}`);
  if (typeof capability.owner !== "string" || capability.owner.length === 0) problems.push(`${capability.id}: owner must be non-empty`);
  if (typeof capability.purpose !== "string" || capability.purpose.length === 0) problems.push(`${capability.id}: purpose must be non-empty`);
  for (const field of ["priorArt", "apiEvidence", "dependencies", "testCoverage", "consumerCoverage"]) {
    if (!Array.isArray(capability[field])) problems.push(`${capability.id}: ${field} must be an array`);
  }
  if (["Implemented", "Validated"].includes(capability.status) && !capability.publicContract) {
    problems.push(`${capability.id}: implemented capability needs a publicContract (or catalog reference)`);
  }
  if (["Discovered", "Researching", "Designed", "Planned"].includes(capability.status) && capability.publicContract) {
    problems.push(`${capability.id}: unimplemented candidate must not advertise a publicContract`);
  }
  if (implementationLike.has(capability.status)) {
    if (capability.testCoverage.length === 0) problems.push(`${capability.id}: implementation claim has no test coverage`);
    for (const owner of capability.owner.split(" + ").map((part) => part.trim()).filter(Boolean)) {
      if (!existsSync(join(ROOT, owner))) problems.push(`${capability.id}: implemented owner does not exist: ${owner}`);
    }
    if (capability.classification !== "Tooling" && capability.clientSupport.assessment === "pending") {
      problems.push(`${capability.id}: implementation claim still has pending client support`);
    }
  }
  for (const dependency of capability.dependencies) {
    if (!capabilities.some((candidate) => candidate.id === dependency)) problems.push(`${capability.id}: unknown dependency ${dependency}`);
  }
}

for (const entry of api.entries) {
  const capability = byId.get(`module.${entry.module}`);
  if (!capability) {
    problems.push(`module ${entry.module}: missing from master registry`);
    continue;
  }
  if (capability.owner !== entry.owner) problems.push(`${capability.id}: owner drift from API catalog`);
  const expectedClass = entry.category === "library" ? "Library" : "Module";
  if (capability.classification !== expectedClass) problems.push(`${capability.id}: classification drift from API catalog`);
  if (capability.publicContract !== `catalog:${entry.module}`) problems.push(`${capability.id}: publicContract drift from API catalog`);
  if (!existsSync(join(ROOT, entry.owner))) problems.push(`${capability.id}: owner path does not exist`);
}

for (const review of plan.ownershipReviews) {
  for (const field of ["capabilityId", "currentOwner", "recommendedOwner", "decision", "rationale", "status"]) {
    if (typeof review[field] !== "string" || review[field].length === 0) problems.push(`ownership review missing ${field}`);
  }
  if (!byId.has(review.capabilityId)) problems.push(`ownership review references unknown ${review.capabilityId}`);
}
for (const replacement of plan.replacementMatrix) {
  for (const field of ["traditional", "destination", "capabilityId", "status", "rationale"]) {
    if (typeof replacement[field] !== "string" || replacement[field].length === 0) problems.push(`replacement matrix row missing ${field}`);
  }
  if (!STATUSES.includes(replacement.status)) problems.push(`replacement ${replacement.traditional}: invalid status ${replacement.status}`);
  if (!byId.has(replacement.capabilityId)) problems.push(`replacement ${replacement.traditional}: unknown capability ${replacement.capabilityId}`);
}

const sequence = plan.implementationSequence ?? [];
let priorOrder = 0;
for (const step of sequence) {
  for (const field of ["order", "capabilityId", "rationale"]) {
    if (step[field] === undefined || step[field] === "") problems.push(`implementation sequence row missing ${field}`);
  }
  if (!Number.isInteger(step.order) || step.order <= priorOrder) problems.push(`implementation sequence order must be unique and increasing: ${step.order}`);
  priorOrder = step.order;
  const capability = byId.get(step.capabilityId);
  if (!capability) {
    problems.push(`implementation sequence references unknown ${step.capabilityId}`);
    continue;
  }
  for (const dependency of capability.dependencies) {
    const dependencyStep = sequence.find((candidate) => candidate.capabilityId === dependency);
    if (dependencyStep && dependencyStep.order >= step.order) {
      problems.push(`${step.capabilityId}: dependency ${dependency} is not sequenced before it`);
    }
    const dependencyCapability = byId.get(dependency);
    if (!dependencyStep && dependencyCapability && !["Implemented", "Validated"].includes(dependencyCapability.status)) {
      problems.push(`${step.capabilityId}: prerequisite ${dependency} is missing from the implementation sequence`);
    }
  }
}
if (plan.firstImplementation) {
  const capability = byId.get(plan.firstImplementation.capabilityId);
  if (!capability) problems.push(`first implementation references unknown ${plan.firstImplementation.capabilityId}`);
  else if (capability.status !== "Implemented") problems.push(`first implementation ${capability.id} is not implemented`);
  if (sequence[0]?.capabilityId !== plan.firstImplementation.capabilityId) problems.push("firstImplementation must be sequence order 1");
}

const referenceIds = new Set();
const referenceById = new Map();
for (const reference of plan.referenceSets ?? []) {
  for (const field of ["id", "flavor", "build", "commit", "root"]) {
    if (typeof reference[field] !== "string" || reference[field].length === 0) problems.push(`reference set ${reference.id ?? "?"} missing ${field}`);
  }
  referenceIds.add(reference.id);
  referenceById.set(reference.id, reference);
  const isUi = reference.id.endsWith("-ui");
  const isDump = reference.id.endsWith("-dump");
  const manifest = isUi ? uiManifest : isDump ? dumpManifest : null;
  if (!manifest) continue;
  const row = manifest.flavors?.find((entry) => entry.id === reference.flavor);
  if (!row) {
    problems.push(`reference set ${reference.id}: no tracked manifest row for ${reference.flavor}`);
    continue;
  }
  const expectedBuild = isUi ? row.version : row.build;
  if (expectedBuild !== reference.build) problems.push(`reference set ${reference.id}: build ${reference.build} does not match manifest ${expectedBuild}`);
  if (row.commit !== reference.commit) problems.push(`reference set ${reference.id}: commit ${reference.commit} does not match manifest ${row.commit}`);
  if (isDump && !row.dumpRef) problems.push(`reference set ${reference.id}: manifest has no dumpRef`);
  if (typeof row.path === "string" && !reference.root.startsWith(`${row.path}/`)) {
    problems.push(`reference set ${reference.id}: root ${reference.root} is outside manifest path ${row.path}`);
  }
}
const researchFlagValues = new Set(["P", "A", "S", "C"]);
for (const capability of capabilities) {
  for (const flag of capability.researchFlags ?? []) {
    if (!researchFlagValues.has(flag)) problems.push(`${capability.id}: invalid research flag ${flag}`);
  }
  for (const evidence of capability.apiEvidence) {
    const match = typeof evidence === "string" && evidence.match(/^([a-z-]+):(.+\.lua):([0-9]+(?:-[0-9]+)?(?:,[0-9]+(?:-[0-9]+)?)*)$/);
    if (!match || !referenceIds.has(match[1])) {
      problems.push(`${capability.id}: malformed or unowned evidence: ${evidence}`);
      continue;
    }
    if (!resolveEvidence) continue;
    const reference = referenceById.get(match[1]);
    const relative = match[2];
    const full = join(ROOT, reference.root, relative);
    if (relative.startsWith("..") || !existsSync(full)) {
      problems.push(`${capability.id}: evidence file is unavailable after reference sync: ${relative}`);
      continue;
    }
    const lineCount = readFileSync(full, "utf8").split(/\r?\n/).length;
    for (const range of match[3].split(",")) {
      const [start, end = start] = range.split("-").map(Number);
      if (start < 1 || end < start || end > lineCount) problems.push(`${capability.id}: evidence range ${range} is outside ${relative} (1-${lineCount})`);
    }
  }
}

const registry = {
  registryVersion: 1,
  description: "Master RGX capability inventory (issue #133). Shipped module identity and public API references derive from contract/schemas/rgx-api.catalog.json; contract/capability-plan.json owns Core inventory, research candidates, ownership reviews and traditional-library successors. Implemented does not imply per-client or consumer validation; see each capability's testCoverage and acceptanceCriteria.",
  statuses: STATUSES,
  referenceSets: plan.referenceSets ?? [],
  capabilities,
  ownershipReviews: plan.ownershipReviews,
  replacementMatrix: plan.replacementMatrix,
  implementationSequence: sequence,
  firstImplementation: plan.firstImplementation ?? null,
};

assert.equal(problems.length, 0, `capability registry problems:\n  - ${problems.join("\n  - ")}`);
if (write) writeFileSync(OUT_PATH, JSON.stringify(registry, null, 2) + "\n");
const existing = readJson(OUT_PATH);
assert.deepEqual(existing, registry, "generated capability registry is stale; run node tools/ci/capability-registry-check.mjs --write");

const counts = {};
for (const capability of capabilities) counts[capability.status] = (counts[capability.status] ?? 0) + 1;
console.log(`CAPABILITY REGISTRY OK ${capabilities.length} capabilities (${shipped.length} shipped modules), ${plan.replacementMatrix.length} traditional replacements; ${JSON.stringify(counts)}`);
