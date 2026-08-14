#!/usr/bin/env node
// Regenerate the GitHub wiki from docs/ per tools/wiki/manifest.json. docs/ is
// canonical; this emits a flat set of wiki pages (Title-Case names from the
// manifest), a generated _Sidebar, and Home. Cross-page links written as
// [text](SOMEDOC.md) are rewritten to their wiki page names so navigation keeps
// working. Run locally to preview, or by .github/workflows/wiki-sync.yml.
//
// Usage: node tools/wiki/build-wiki.mjs <outDir>
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const DOCS = join(REPO, "docs");
const manifest = JSON.parse(readFileSync(join(HERE, "manifest.json"), "utf8"));

const outDir = process.argv[2];
if (!outDir) {
  console.error("Usage: node build-wiki.mjs <outDir>");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

// docs filename -> wiki page name, used to rewrite cross-page markdown links.
const docToWiki = {};
const wikiToDoc = {};
const manifestErrors = [];

function registerPage(doc, wiki) {
  if (docToWiki[doc]) manifestErrors.push(`duplicate doc mapping: ${doc}`);
  if (wikiToDoc[wiki]) manifestErrors.push(`duplicate wiki target: ${wiki}`);
  docToWiki[doc] = wiki;
  wikiToDoc[wiki] = doc;
}

if (manifest.home) registerPage(manifest.home, "Home");
for (const section of manifest.sections) {
  for (const page of section.pages) registerPage(page.doc, page.wiki);
}

const canonicalDocs = readdirSync(DOCS, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
  .map((entry) => entry.name)
  .sort();
for (const doc of canonicalDocs) {
  if (!docToWiki[doc]) manifestErrors.push(`canonical doc is not mapped to the wiki: ${doc}`);
}

const knownWikiTargets = new Set(
  Object.keys(wikiToDoc).map((name) => name.toLowerCase().replace(/\s+/g, "-"))
);

function validateLinks(md, docFile) {
  for (const match of md.matchAll(/\[\[([^\]]+)\]\]/g)) {
    const parts = match[1].split("|");
    const target = (parts.length > 1 ? parts[1] : parts[0]).split("#")[0]
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-");
    if (!knownWikiTargets.has(target)) {
      manifestErrors.push(`${docFile}: unknown wiki target [[${match[1]}]]`);
    }
  }

  for (const match of md.matchAll(/\]\(([A-Za-z0-9._-]+\.md)(?:#[^)]*)?\)/g)) {
    if (!docToWiki[match[1]]) {
      manifestErrors.push(`${docFile}: relative doc link is not mapped: ${match[1]}`);
    }
  }
}

function rewriteLinks(md) {
  // [text](SOMEDOC.md) / [text](SOMEDOC.md#anchor) -> [text](Wiki-Name#anchor)
  return md.replace(/\]\(([A-Za-z0-9._-]+\.md)(#[^)]*)?\)/g, (m, file, anchor) => {
    const wiki = docToWiki[file];
    return wiki ? `](${wiki}${anchor || ""})` : m;
  });
}

const missing = [];
function emit(docFile, wikiName) {
  const src = join(DOCS, docFile);
  if (!existsSync(src)) {
    missing.push(docFile);
    return;
  }
  const source = readFileSync(src, "utf8").replace(/\r\n/g, "\n");
  validateLinks(source, docFile);
  const body = rewriteLinks(source);
  writeFileSync(join(outDir, `${wikiName}.md`), body);
}

if (manifest.home) emit(manifest.home, "Home");
for (const s of manifest.sections) for (const p of s.pages) emit(p.doc, p.wiki);

// _Sidebar generated from the manifest section structure.
const sidebar = ["## RGX-Framework", "", "[Home](Home)", ""];
for (const s of manifest.sections) {
  sidebar.push(`### ${s.title}`);
  for (const p of s.pages) sidebar.push(`- [[${p.wiki}]]`);
  sidebar.push("");
}
writeFileSync(join(outDir, "_Sidebar.md"), sidebar.join("\n"));

if (missing.length) {
  console.error("MISSING docs referenced by manifest:\n  " + missing.join("\n  "));
  process.exit(1);
}

if (manifestErrors.length) {
  console.error("INVALID wiki manifest or links:\n  " + manifestErrors.join("\n  "));
  process.exit(1);
}

const count =
  manifest.sections.reduce((n, s) => n + s.pages.length, 0) + (manifest.home ? 1 : 0) + 1;
console.log(`Generated ${count} wiki page(s) into ${outDir}`);
