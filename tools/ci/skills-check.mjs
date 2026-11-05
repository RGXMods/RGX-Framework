#!/usr/bin/env node
// Verifies the RGX-Framework skills suite under skills/:
//  - every pack has SKILL.md with frontmatter whose name matches the folder and has a description
//  - every pack carries the RGX-Framework header and an RGX module mapping
//  - every relative Markdown link resolves to an existing file (anchors ignored)
//  - no vendor- or harness-specific product names remain (the suite stays agent-neutral)
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || "skills");
const BANNED = [
  /claude/i, /anthropic/i, /\bmcp__/, /ToolSearch/, /\bSkill tool\b/, /\bAgent tool\b/,
  /\bsubagent/i, /\badvisor\b/i, /uiforever/i, /witchcraft/i, /computer-use/i,
];
const failures = [];
const fail = (msg) => failures.push(msg);

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else yield p;
  }
}

if (!fs.existsSync(ROOT)) {
  console.error(`skills-check: ${ROOT} does not exist`);
  process.exit(1);
}

const packs = fs.readdirSync(ROOT, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
if (packs.length === 0) fail("no skill packs found");

for (const pack of packs) {
  const skillPath = path.join(ROOT, pack, "SKILL.md");
  if (!fs.existsSync(skillPath)) { fail(`${pack}: missing SKILL.md`); continue; }
  const text = fs.readFileSync(skillPath, "utf8");
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) { fail(`${pack}: SKILL.md has no frontmatter`); continue; }
  const name = (fm[1].match(/^name:\s*(.+)$/m) || [])[1]?.trim();
  const description = (fm[1].match(/^description:\s*(.+)$/m) || [])[1]?.trim();
  if (name !== pack) fail(`${pack}: frontmatter name "${name}" must equal the folder name`);
  if (!description) fail(`${pack}: frontmatter description is missing`);
  if (!/RGX-Framework copy/.test(text)) fail(`${pack}: RGX-Framework header is missing`);
  if (!/RGX module or area:/.test(text)) fail(`${pack}: RGX module mapping is missing`);
}

for (const file of walk(ROOT)) {
  if (!file.endsWith(".md")) continue;
  const rel = path.relative(process.cwd(), file);
  const text = fs.readFileSync(file, "utf8");
  for (const re of BANNED) {
    const m = text.match(re);
    if (m) fail(`${rel}: vendor or harness name "${m[0]}" must be replaced by a generic capability`);
  }
  const links = [...text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  for (const link of links) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const target = link.split("#")[0];
    if (!target) continue;
    const resolved = path.resolve(path.dirname(file), target);
    if (!fs.existsSync(resolved)) fail(`${rel}: broken link -> ${link}`);
  }
}

if (failures.length) {
  console.error(`skills-check: ${failures.length} problem(s)`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`skills-check OK: ${packs.length} packs, all links resolve, no vendor or harness names`);
