#!/usr/bin/env node
// Secret gate: run the addon:secrets job's own script (extracted from .gitlab/ci/addon.yml, the single
// source of truth) against planted credentials and clean trees. It fails if the gate would let a
// Discord webhook, GitHub token, cloud key or private key through, or blocks something it should not.
// The planted credentials are assembled at run time so this file never holds one.
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const yml = readFileSync(join(ROOT, ".gitlab/ci/addon.yml"), "utf8");
const lines = yml.split("\n");
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// 1. The job exists and runs on the same pipelines as addon:validate (MR, branch, tag).
const jobAt = lines.findIndex((l) => l === "addon:secrets:");
check(jobAt >= 0, "addon.yml defines the addon:secrets job");
const jobBlock = lines.slice(jobAt, jobAt + 14).join("\n");
check(/stage: validate/.test(jobBlock), "addon:secrets runs in the validate stage");
check(/merge_request_event/.test(jobBlock) && /when: on_success/.test(jobBlock), "addon:secrets runs on merge request and branch pipelines");

// 2. Extract the heredoc script exactly as the runner would feed it to node.
const open = lines.findIndex((l) => l.trim() === "node - <<'NODE'");
const close = lines.findIndex((l, i) => i > open && l.trim() === "NODE");
check(open > 0 && close > open, "the scanner script is inline between node - <<'NODE' and NODE");
const indent = open >= 0 ? lines[open + 1].match(/^ */)[0].length : 0;
const script = lines.slice(open + 1, close).map((l) => l.slice(indent)).join("\n");

const work = mkdtempSync(join(tmpdir(), "secret-scan-"));
const scriptPath = join(work, "scan.cjs");
writeFileSync(scriptPath, script);

function scan(files) {
  const dir = mkdtempSync(join(work, "tree-"));
  for (const [name, content] of Object.entries(files)) {
    const file = join(dir, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }
  const r = spawnSync("node", [scriptPath, dir], { encoding: "utf8" });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

const hook = "https://discord.com/api/webhooks/" + "1".repeat(18) + "/" + "Ab9_-".repeat(9);
const dapp = "https://discordapp.com/api/webhooks/" + "2".repeat(19) + "/" + "Zy8-_".repeat(9);
const ghToken = "ghp_" + "a1B2".repeat(9);
const awsKey = "AKIA" + "ABCDEFGH12345678".slice(0, 16);
const pemHead = "-----BEGIN " + "RSA PRIVATE KEY-----";
const glToken = "glpat-" + "Qw3rTy_9".repeat(3);
const literal = "9f8e7d6c-5b4a-3210-fedc-ba9876543210";

// 3. Must block.
for (const [label, files, expect] of [
  ["a Discord webhook in a workflow", { ".github/workflows/release.yml": `curl -X POST ${hook}\n` }, "Discord webhook"],
  ["a Discord webhook in a markdown doc", { "docs/SETUP.md": `Webhook: ${hook}\n` }, "Discord webhook"],
  ["a discordapp.com webhook", { "a.txt": dapp }, "Discord webhook"],
  ["a GitHub token", { "script.sh": `export T=${ghToken}\n` }, "GitHub token"],
  ["an AWS access key", { "c.env": `KEY=${awsKey}\n` }, "AWS access key"],
  ["a private key", { "id": `${pemHead}\nMIIE\n` }, "Private key"],
  ["a GitLab token", { "ci.sh": `TOKEN=${glToken}\n` }, "GitLab token"],
  ["a CurseForge key with a literal value", { "release.yml": `env:\n  CF_API_KEY: ${literal}\n` }, "Release credential"],
  ["a Wago token assigned in a script", { "up.sh": `WAGO_API_TOKEN="${literal}"\n` }, "Release credential"],
  ["a WoWInterface token assigned in a script", { "up2.sh": `export WOWI_API_TOKEN=${literal}\n` }, "Release credential"],
]) {
  const r = scan(files);
  check(r.code === 1, `blocks ${label} (exit ${r.code})`);
  check(r.out.includes(expect), `reports ${label} as "${expect}"`);
  check(!r.out.includes("Ab9_-Ab9_-Ab9_-") && !r.out.includes("a1B2a1B2a1B2"), `does not echo the secret for ${label}`);
}

// 4. Must pass.
for (const [label, files] of [
  ["a clean tree", { "README.md": "hello\n", "core.lua": "print('x')\n" }],
  ["an unfilled placeholder", { "docs/CI.md": "POST https://discord.com/api/webhooks/<id>/<token>\n" }],
  ["a secret reference, not a value", { "w.yml": "DISCORD_WEBHOOK: ${{ secrets.DISCORD_WEBHOOK }}\n" }],
  ["release credentials read from the environment", { "r.yml": "CF_API_KEY: ${{ secrets.CF_API_KEY }}\nWAGO_API_TOKEN: ${{ secrets.WAGO_API_TOKEN }}\nGITHUB_OAUTH: ${{ secrets.GITHUB_TOKEN }}\n" }],
  ["a shell variable and an empty value", { "s.sh": "CF_API_KEY=$CF_API_KEY\nWOWI_API_TOKEN=\nCF_API_KEY: ''\n" }],
  ["prose naming a secret without a value", { "docs/x.md": "Add the secret WAGO_API_TOKEN to the repository.\n" }],
  ["a deliberate waived example", { "docs/EXAMPLE.md": `${hook} <!-- secret-scan:allow -->\n` }],
  ["a skipped node_modules tree", { "node_modules/x/index.js": `${hook}\n` }],
  ["a binary file", { "icon.blp": `\u0000\u0000${hook}` }],
]) {
  const r = scan(files);
  check(r.code === 0, `passes ${label} (exit ${r.code}: ${r.out.trim().split("\n")[0]})`);
}

rmSync(work, { recursive: true, force: true });
if (failures.length) {
  console.error("secret-scan-check FAILED:\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log("secret-scan-check OK (the addon:secrets gate blocks 10 planted credentials and passes 9 clean cases)");
