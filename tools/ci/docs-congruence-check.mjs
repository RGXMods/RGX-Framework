#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path) => readFileSync(join(ROOT, path), "utf8");
const failures = [];
const releaseSnapshot = JSON.parse(read("tools/ci/release-snapshot.json"));
const publishedVersion = releaseSnapshot.publishedVersion ?? releaseSnapshot.version;

const flavorTocs = [
  ["retail", "Retail", "Retail", "RGX-Framework.toc", "120100"],
  ["classic-era", "Classic Era", "Classic Era", "RGX-Framework_Vanilla.toc", "11509"],
  ["tbc", "TBC Classic", "TBC", "RGX-Framework_TBC.toc", "20506"],
  ["wrath", "Wrath/Titan", "Wrath/Titan", "RGX-Framework_Wrath.toc", "38002"],
  ["cata", "Cataclysm", "Cataclysm", "RGX-Framework_Cata.toc", "40402"],
  ["mists", "Mists Classic", "Mists", "RGX-Framework_Mists.toc", "50504"],
];

const retailToc = read("RGX-Framework.toc");
const version = retailToc.match(/^## Version:\s*(\S+)/m)?.[1];
if (!version) failures.push("RGX-Framework.toc: missing Version");
if (version !== releaseSnapshot.version) failures.push(`release snapshot is ${releaseSnapshot.version}, TOCs are ${version}`);

for (const [flavor, , , path, expectedInterface] of flavorTocs) {
  const toc = read(path);
  const actualVersion = toc.match(/^## Version:\s*(\S+)/m)?.[1];
  const actualInterface = toc.match(/^## Interface:\s*(\d+)/m)?.[1];
  if (actualVersion !== version) failures.push(`${path}: expected version ${version}, got ${actualVersion}`);
  if (actualInterface !== expectedInterface) failures.push(`${path}: expected Interface ${expectedInterface}, got ${actualInterface}`);
  if (!flavor) failures.push(`${path}: missing flavor key`);
  if (path !== "RGX-Framework.toc" && /^## X-(?:Curse-Project-ID|Wago-ID|WoWI-ID):/m.test(toc)) {
    failures.push(`${path}: addon-service project IDs belong only in RGX-Framework.toc`);
  }
}

const currentSurfaces = [
  "README.md",
  "docs/HOME.md",
  "docs/DISTRIBUTION.md",
  "docs/description.html",
  "docs/CHANGES.md",
  "docs/RGX-MCP.md",
  "docs/STUDIO-ROADMAP.md",
  "docs/SUPER-SIMPLE.md",
  "docs/AURAS.md",
  "tools/rgx-mcp/README.md",
];
const surfaceText = Object.fromEntries(currentSurfaces.map((path) => [path, read(path)]));

for (const path of ["README.md", "docs/HOME.md", "docs/DISTRIBUTION.md", "docs/description.html", "docs/CHANGES.md"]) {
  if (!surfaceText[path].includes(`v${publishedVersion}`)) failures.push(`${path}: missing published release v${publishedVersion}`);
}

const exactPublishedMarkers = [
  ["README.md", `**Latest published release:** [\`v${publishedVersion}\`]`],
  ["docs/HOME.md", `Current release \`v${publishedVersion}\``],
  ["docs/DISTRIBUTION.md", `[\`v${publishedVersion}\`](https://github.com/RGXMods/RGX-Framework/releases/tag/v${publishedVersion})`],
  ["docs/description.html", `releases/tag/v${publishedVersion}\" style=\"color:#58a6ff\">v${publishedVersion}</a>`],
];
for (const [path, marker] of exactPublishedMarkers) {
  if (!surfaceText[path].includes(marker)) failures.push(`${path}: missing exact latest-published marker for v${publishedVersion}`);
}
const changesReleasePattern = new RegExp(`## Current Release\\s+### \\[v${publishedVersion.replace(/\./g, "\\.")}\\]`);
if (!changesReleasePattern.test(surfaceText["docs/CHANGES.md"])) failures.push(`docs/CHANGES.md: Current Release is not v${publishedVersion}`);

const candidateSurfaces = [
  "README.md",
  "docs/API.md",
  "docs/AURAS.md",
  "docs/CHANGES.md",
  "docs/DECLARATIVE-API.md",
  "docs/DISTRIBUTION.md",
  "docs/HOME.md",
  "docs/QUICK-START.md",
  "docs/ROADMAP.md",
  "docs/STUDIO-ROADMAP.md",
  "docs/SUPER-SIMPLE.md",
];
if (publishedVersion !== version) {
  for (const path of candidateSurfaces) {
    const source = path in surfaceText ? surfaceText[path] : read(path);
    if (!source.includes(`v${version}`) || !source.includes(`v${publishedVersion}`) || !/candidate|unreleased/i.test(source)) {
      failures.push(`${path}: candidate documentation must identify both v${version} and published v${publishedVersion}`);
    }
  }
} else {
  for (const path of candidateSurfaces) {
    const source = path in surfaceText ? surfaceText[path] : read(path);
    if (/candidate|unreleased/i.test(source)) failures.push(`${path}: released documentation still contains candidate wording`);
  }
}

for (const path of ["README.md", "docs/HOME.md", "docs/DISTRIBUTION.md", "docs/description.html"]) {
  for (const [, , , , wowInterface] of flavorTocs) {
    if (!surfaceText[path].includes(wowInterface)) failures.push(`${path}: missing Interface ${wowInterface}`);
  }
}

for (const path of ["README.md", "docs/HOME.md"]) {
  const normalized = surfaceText[path].replace(/\s+/g, " ");
  for (const [, , label, , wowInterface] of flavorTocs) {
    if (!normalized.includes(`${label} \`${wowInterface}\``)) failures.push(`${path}: missing exact ${label}/${wowInterface} pairing`);
  }
}

const distribution = surfaceText["docs/DISTRIBUTION.md"];
const description = surfaceText["docs/description.html"];
for (const [, docsLabel, descriptionLabel, tocPath, wowInterface] of flavorTocs) {
  const distributionRow = `| ${docsLabel} | \`${tocPath}\` | \`${wowInterface}\` |`;
  if (!distribution.includes(distributionRow)) failures.push(`docs/DISTRIBUTION.md: missing exact row ${distributionRow}`);
  const descriptionEntry = `&bull; ${descriptionLabel}: <span style="color:#58a6ff">${wowInterface}</span>`;
  if (!description.includes(descriptionEntry)) failures.push(`docs/description.html: missing exact ${descriptionLabel}/${wowInterface} pairing`);
}

for (const required of [
  `RGX-Framework-v${publishedVersion}.zip`,
  "release.json",
  "one product",
  "Source-Only Tooling",
  "docs/description.html",
  `exactly ${releaseSnapshot.runtimeFiles}`,
]) {
  if (!distribution.includes(required)) failures.push(`docs/DISTRIBUTION.md: missing ${required}`);
}

for (const [path, source] of Object.entries(surfaceText)) {
  for (const forbidden of [/RGX-Developer/i, /contract SDK/i, /developer artifact/i, /developer ZIP/i]) {
    if (forbidden.test(source)) failures.push(`${path}: contains retired product wording ${forbidden}`);
  }
}

const readme = surfaceText["README.md"];
if (/\n\s*on\s*=\s*\{/.test(readme)) failures.push("README.md: primary example uses future declarative on form");
if (!/\n\s*every\s*=\s*\{/.test(readme)) failures.push("README.md: primary example is missing shipped declarative every form");
for (const path of ["README.md", "docs/HOME.md", "docs/description.html", "docs/SUPER-SIMPLE.md"]) {
  if (!surfaceText[path].includes("SavedVariables: MyAddonDB")) failures.push(`${path}: persisted DB example is missing SavedVariables: MyAddonDB`);
}
if (!description.includes("/RGX-Framework/wiki")) failures.push("docs/description.html: wiki URL is not canonical");

const currentChangelogPath = `docs/changelogs/${version}.md`;
const currentChangelog = existsSync(join(ROOT, currentChangelogPath)) ? read(currentChangelogPath) : "";
for (const required of [`RGX-Framework-v${version}.zip`, `${releaseSnapshot.runtimeFiles} runtime files`]) {
  if (!currentChangelog.includes(required)) failures.push(`${currentChangelogPath}: missing ${required}`);
}
if (publishedVersion !== version) {
  if (!/unreleased|candidate/i.test(currentChangelog) || !currentChangelog.includes(`v${publishedVersion}`)) {
    failures.push(`${currentChangelogPath}: candidate changelog must identify published v${publishedVersion}`);
  }
} else if (/unreleased|candidate/i.test(currentChangelog)) {
  failures.push(`${currentChangelogPath}: released changelog still contains candidate wording`);
}

const schema = JSON.parse(read("schemas/rgx-addon.schema.json"));
if (schema.properties?.on?.["x-rgx-ships"] !== "tier4") failures.push("schema: on must remain tier4 until runtime implementation lands");
if (schema.properties?.every?.["x-rgx-ships"] !== "today") failures.push("schema: every must ship today with its runtime implementation");

const studio = surfaceText["docs/STUDIO-ROADMAP.md"];
for (const required of ["work_items/30", "work_items/36", "Studio is still blocked"]) {
  if (!studio.includes(required)) failures.push(`docs/STUDIO-ROADMAP.md: missing ${required}`);
}

const auras = surfaceText["docs/AURAS.md"];
for (const required of ["accessible-only aura boundary", "fail closed", "raw UNIT_AURA", "payload, which remains unsanitized", "v2.7.0", "v2.6.2", "12.1.0.69283"]) {
  if (!auras.includes(required)) failures.push(`docs/AURAS.md: missing restricted-value boundary '${required}'`);
}
const mcpServer = read("tools/rgx-mcp/src/server.js");
for (const required of ["pcall catches errors but does not prevent taint", "fails closed and withholds restricted AuraData", "raw event payloads remain unsanitized", "typeof control === \"string\""]) {
  if (!mcpServer.includes(required)) failures.push(`tools/rgx-mcp/src/server.js: secret-aura advice missing '${required}'`);
}

const normalizedDistribution = distribution.replace(/\s+/g, " ");
const curseProject = retailToc.match(/^## X-Curse-Project-ID:\s*(\S+)/m)?.[1];
if (curseProject !== "1516939") failures.push(`RGX-Framework.toc: expected CurseForge project 1516939, got ${curseProject}`);
if (!normalizedDistribution.includes("CurseForge is the currently configured addon service")) failures.push("docs/DISTRIBUTION.md: CurseForge configuration is not documented");
for (const [metadataKey, service] of [["X-Wago-ID", "Wago"]]) {
  const configured = new RegExp(`^## ${metadataKey}:`, "m").test(retailToc);
  const documentedSkipped = new RegExp(`${service}[\\s\\S]{0,40}skipped`).test(normalizedDistribution);
  if (configured && documentedSkipped) failures.push(`docs/DISTRIBUTION.md: ${service} is configured but documented as skipped`);
  if (!configured && !documentedSkipped) failures.push(`docs/DISTRIBUTION.md: ${service} is unconfigured but not documented as skipped`);
}

const wikiManifest = read("tools/wiki/manifest.json");
for (const doc of ["DISTRIBUTION.md", "STUDIO-ROADMAP.md"]) {
  if (!wikiManifest.includes(`\"doc\": \"${doc}\"`)) failures.push(`tools/wiki/manifest.json: missing ${doc}`);
}

const mcpPackage = JSON.parse(read("tools/rgx-mcp/package.json"));
if (mcpPackage.private !== true) failures.push("tools/rgx-mcp/package.json: fixture must be private");
if (!JSON.stringify(mcpPackage.repository).includes("RGX-Framework")) failures.push("tools/rgx-mcp/package.json: repository must point to RGX-Framework");
if (mcpPackage.engines?.node !== ">=20") failures.push("tools/rgx-mcp/package.json: Node engine must match documented >=20");
if (/^package-lock\.json\s*$/m.test(read("tools/rgx-mcp/.gitignore"))) failures.push("tools/rgx-mcp/.gitignore: tracked lockfile is ignored");
if (existsSync(join(ROOT, "Home.md"))) failures.push("Home.md: competing root wiki source must not exist");

if (!existsSync(join(ROOT, currentChangelogPath))) failures.push(`${currentChangelogPath}: missing current release changelog`);

const releaseWorkflow = read(".github/workflows/release.yml");
for (const required of ["BigWigsMods/packager@v2", "args: -d", "args: -c -o", "--inspect", "--expected-count", "sha256sum", "release-metadata-check.mjs", "Verify published release assets"]) {
  if (!releaseWorkflow.includes(required)) failures.push(`release workflow: missing ${required}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`DOCS ERROR  ${failure}`);
  process.exit(1);
}

const releaseState = publishedVersion === version ? "published" : `candidate v${version}, published`;
console.log(`DOCS CONGRUENT  ${releaseState} v${publishedVersion}, ${flavorTocs.length} flavors, ${currentSurfaces.length} public surfaces.`);
