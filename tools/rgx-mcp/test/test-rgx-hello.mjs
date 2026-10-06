#!/usr/bin/env node
// rgx-mcp end-to-end test: use the real MCP server (over the real MCP
// client SDK, real stdio transport -- no reimplementation of the protocol)
// to generate, validate, and audit the actual RGX-Hello reference addon.
//
// This is the concrete answer to "does rgx-mcp actually work": rather than
// synthetic fixtures, it's pointed at a real shipped addon and has to
// produce a correct verdict about it.
//
// Usage: node test/test-rgx-hello.mjs <path-to-RGX-Hello-checkout> [--allow-older-minimum]

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import luaparse from "luaparse";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createDefinitionEngine, exampleDefinition } from "../../../contract/engine/definition.mjs";
import Ajv2020 from "ajv/dist/2020.js";
import { createValidateAddon } from "../../../contract/engine/validate-addon.mjs";
import { engineCases } from "../../ci/contract-vectors.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER_ENTRY = join(HERE, "..", "src", "server.js");
const definitionSchema = JSON.parse(readFileSync(join(HERE, "../../../contract/schemas/rgx-definition.schema.json"), "utf8"));
const { importDefinition } = createDefinitionEngine(definitionSchema);

const helloPath = process.argv[2];
if (!helloPath) {
  console.error("Usage: node test/test-rgx-hello.mjs <path-to-RGX-Hello-checkout> [--allow-older-minimum]");
  process.exit(1);
}
const allowOlderMinimum = process.argv.includes("--allow-older-minimum");
const realCore = readFileSync(join(helloPath, "data", "core.lua"), "utf8");
const realToc = readFileSync(join(helloPath, "RGX-Hello.toc"), "utf8");
const minimumFrameworkVersion = realToc.match(/^## X-RGX-Framework-MinVersion:\s*(\S+)/m)?.[1] ?? "0";
const frameworkVersion = JSON.parse(readFileSync(join(HERE, "..", "..", "ci", "release-snapshot.json"), "utf8")).version;

function compareVersions(left, right) {
  const parse = (value) => {
    const match = (value === "0" ? "0.0.0" : value).match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([\w.-]+))?$/);
    if (!match) throw new Error(`invalid Framework version: ${value}`);
    return { base: match.slice(1, 4).map(Number), pre: match[4]?.split(".") };
  };
  const a = parse(left), b = parse(right);
  for (let index = 0; index < 3; index++) {
    const difference = a.base[index] - b.base[index];
    if (difference) return difference;
  }
  if (!a.pre || !b.pre) return a.pre ? -1 : b.pre ? 1 : 0;
  for (let index = 0; index < Math.max(a.pre.length, b.pre.length); index++) {
    const x = a.pre[index], y = b.pre[index];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
    if (nx && ny) return Number(x) - Number(y);
    if (nx !== ny) return nx ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}

function optsValue(node) {
  if (["StringLiteral", "NumericLiteral", "BooleanLiteral"].includes(node.type)) return node.value;
  if (node.type === "NilLiteral") return null;
  if (node.type === "FunctionDeclaration") return { $lua: "function" };
  if (node.type !== "TableConstructorExpression") throw new Error(`unsupported opts node: ${node.type}`);

  const values = node.fields.filter((field) => field.type === "TableValue");
  if (values.length === node.fields.length) return values.map((field) => optsValue(field.value));

  const result = {};
  for (const field of node.fields) {
    if (field.type !== "TableKeyString") throw new Error(`unsupported opts table field: ${field.type}`);
    result[field.key.name] = optsValue(field.value);
  }
  return result;
}

const ast = luaparse.parse(realCore, { luaVersion: "5.1", encodingMode: "x-user-defined" });
const addonCalls = ast.body.filter((statement) => {
  const expression = statement.type === "CallStatement" && statement.expression;
  return expression?.type === "TableCallExpression"
    && expression.base?.type === "StringCallExpression"
    && expression.base.base?.type === "Identifier"
    && expression.base.base.name === "RGXAddon";
});
if (addonCalls.length !== 1) throw new Error(`expected one curried RGXAddon declaration, found ${addonCalls.length}`);
const addonCall = addonCalls[0].expression;
const actualAddonName = addonCall.base.argument.value;
const actualOpts = optsValue(addonCall.arguments);

const RGX_HELLO_GENERATE_SPEC = {
  name: "RGX-Hello",
  dbName: "RGXHelloDB",
  slash: "rgxhello",
  minimap: true,
  every: { heartbeat: 1 },
  db: { enabled: true, volume: 50 },
  toggles: ["enabled"],
  sliders: [{ key: "volume", label: "Volume", min: 0, max: 100, suffix: "%" }],
};

let failures = 0;
function check(label, cond, detail) {
  if (cond) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}${detail ? " -- " + detail : ""}`);
  }
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [SERVER_ENTRY],
});
const client = new Client({ name: "rgx-mcp-hello-test", version: "0.1.0" }, { capabilities: {} });
await client.connect(transport);

try {
  console.log("== Shared definition authoring (source-development slice) ==");
  const definitionResource = await client.readResource({ uri: "rgx://schemas/definition" });
  check("definition resource exposes the canonical schema",
    JSON.stringify(JSON.parse(definitionResource.contents[0].text)) === JSON.stringify(definitionSchema));
  const edited = await client.callTool({ name: "rgx_edit_definition", arguments: {
    operation: "patch", definition: exampleDefinition, changes: { enabled: false, text: "AI-authored Ω", x: 23 },
  } });
  const authored = JSON.parse(edited.content[0].text);
  check("AI authoring preserves false and returns an interoperable data-only definition",
    authored.sourceOnly === true && authored.definition.enabled === false
      && importDefinition(authored.wire).text === "AI-authored Ω" && authored.definition.x === 23);
  const rejected = await client.callTool({ name: "rgx_edit_definition", arguments: {
    operation: "normalize", definition: { ...exampleDefinition, version: 2 },
  } });
  check("AI definition tools reject unsupported versions", rejected.isError === true);
  console.log("== RGX-Hello source congruence ==");
  check("parsed the real RGX-Hello declaration", actualAddonName === "RGX-Hello");
  const minimumComparison = compareVersions(minimumFrameworkVersion, frameworkVersion);
  check(
    "RGX-Hello targets this Framework source version",
    minimumFrameworkVersion !== "0" && (minimumComparison === 0 || (allowOlderMinimum && minimumComparison < 0)),
    JSON.stringify({ frameworkVersion, minimumFrameworkVersion, allowOlderMinimum })
  );
  const expectsDeclarativeEvery = compareVersions(frameworkVersion, "2.7.0") >= 0 && minimumComparison >= 0;
  check(
    "RGX-Hello declaration matches its minimum Framework contract",
    !expectsDeclarativeEvery
      || (Array.isArray(actualOpts.every?.heartbeat)
        && actualOpts.every.heartbeat[0] === 1
        && actualOpts.every.heartbeat[1]?.$lua === "function"),
    JSON.stringify({ minimumFrameworkVersion, every: actualOpts.every })
  );

  console.log("== rgx_generate_addon (RGX-Hello spec) ==");
  const gen = await client.callTool({ name: "rgx_generate_addon", arguments: RGX_HELLO_GENERATE_SPEC });
  const generatedLua = gen.content?.[0]?.text ?? "";
  console.log(generatedLua);
  check("generator produced a RGXAddon call", generatedLua.includes('RGXAddon "RGX-Hello"'));
  check(
    "generator's SavedVariables hint matches what RGX-Hello actually ships (RGXHelloDB, no hyphen)",
    generatedLua.includes("RGXHelloDB") && !generatedLua.includes("RGX-HelloDB")
  );
  check("generator emits the slider's % suffix", generatedLua.includes('suffix = "%"'));
  check("generator emits a named repeating timer", generatedLua.includes("every   = {") && generatedLua.includes("heartbeat = { 1, function(self, timer)"));
  let generatedParses = true;
  let generatedParseError = "";
  try {
    luaparse.parse(generatedLua, { luaVersion: "5.1" });
  } catch (error) {
    generatedParses = false;
    generatedParseError = error.message;
  }
  check("generated addon parses as Lua 5.1", generatedParses, generatedParseError);
  const sliderGen = await client.callTool({ name: "rgx_generate_addon", arguments: {
    name: "SliderModes", db: { amount: 25 }, sliders: [{ key: "amount", valueDisplay: "hover", progress: false }],
  } });
  const sliderLua = sliderGen.content?.[0]?.text ?? "";
  check("generator preserves hover-only slider values and disabled fill", sliderLua.includes('valueDisplay = "hover"') && sliderLua.includes('progress = false'));

  const namedTimerGen = await client.callTool({
    name: "rgx_generate_addon",
    arguments: { name: "TimerKeys", every: { end: 2, "cache.refresh": 30 } },
  });
  const namedTimerLua = namedTimerGen.content?.[0]?.text ?? "";
  check("generator quotes punctuated timer names", namedTimerLua.includes('["cache.refresh"] = { 30'));
  check("generator quotes reserved-word timer names", namedTimerLua.includes('["end"] = { 2'));
  check("generator sorts timer names deterministically", namedTimerLua.indexOf('["cache.refresh"]') < namedTimerLua.indexOf('["end"]'));

  const invalidTimerGen = await client.callTool({
    name: "rgx_generate_addon",
    arguments: { name: "InvalidTimer", every: { "   ": 0 } },
  });
  check("generator rejects invalid named timers", invalidTimerGen.isError === true, JSON.stringify(invalidTimerGen));

  console.log("\n== rgx_validate_addon (RGX-Hello's parsed opts) ==");
  const val = await client.callTool({ name: "rgx_validate_addon", arguments: { opts: actualOpts } });
  const report = JSON.parse(val.content[0].text);
  console.log(JSON.stringify(report, null, 2));
  check("RGX-Hello's opts validate against the shipped schema", report.valid === true, JSON.stringify(report.errors));
  check("no tier4-only keys used", (report.tier4KeysUsed ?? []).length === 0, JSON.stringify(report.tier4KeysUsed));
  const sliderValidation = await client.callTool({ name: "rgx_validate_addon", arguments: {
    opts: { options: { General: [{ slider: "amount", valueDisplay: "hover", progress: false }] } },
  } });
  check("slider customizations validate against the shared contract", JSON.parse(sliderValidation.content[0].text).valid === true);
  const invalidSlider = await client.callTool({ name: "rgx_validate_addon", arguments: {
    opts: { options: { General: [{ slider: "amount", valueDisplay: "sometimes" }] } },
  } });
  check("invalid slider value-display modes are rejected", JSON.parse(invalidSlider.content[0].text).valid === false);

  const everyVal = await client.callTool({
    name: "rgx_validate_addon",
    arguments: { opts: { every: { heartbeat: [1, { $lua: "function" }] } } },
  });
  const everyReport = JSON.parse(everyVal.content[0].text);
  check("declarative every validates as shipped", everyReport.valid === true, JSON.stringify(everyReport.errors));
  check("declarative every is not reported as tier4", (everyReport.tier4KeysUsed ?? []).length === 0, JSON.stringify(everyReport));

  const columnsVal = await client.callTool({
    name: "rgx_validate_addon",
    arguments: { opts: { options: { columns: 2, General: [{ toggle: "enabled" }] } } },
  });
  const columnsReport = JSON.parse(columnsVal.content[0].text);
  check("option columns validate as shipped", columnsReport.valid === true, JSON.stringify(columnsReport.errors));
  check("option columns are not reported as tier4", (columnsReport.tier4KeysUsed ?? []).length === 0, JSON.stringify(columnsReport));

  const invalidColumnsVal = await client.callTool({
    name: "rgx_validate_addon",
    arguments: { opts: { options: { columns: 5 } } },
  });
  const invalidColumnsReport = JSON.parse(invalidColumnsVal.content[0].text);
  check("invalid column counts are rejected", invalidColumnsReport.valid === false, JSON.stringify(invalidColumnsReport.errors));

  const columnsGen = await client.callTool({
    name: "rgx_generate_addon",
    arguments: { name: "ColumnKeys", columns: 2, toggles: ["enabled"] },
  });
  const columnsLua = columnsGen.content?.[0]?.text ?? "";
  check("generator emits the column count", columnsLua.includes("columns = 2"));
  let columnsParses = true;
  let columnsParseError = "";
  try {
    luaparse.parse(columnsLua, { luaVersion: "5.1" });
  } catch (error) {
    columnsParses = false;
    columnsParseError = error.message;
  }
  check("generated columns parse as Lua 5.1", columnsParses, columnsParseError);

  const invalidEveryVal = await client.callTool({
    name: "rgx_validate_addon",
    arguments: { opts: { every: { "   ": [0, { $lua: "function" }, "extra"] } } },
  });
  const invalidEveryReport = JSON.parse(invalidEveryVal.content[0].text);
  check("invalid declarative every definitions are rejected", invalidEveryReport.valid === false, JSON.stringify(invalidEveryReport.errors));

  const onVal = await client.callTool({
    name: "rgx_validate_addon",
    arguments: { opts: { on: { login: { $lua: "function" } } } },
  });
  const onReport = JSON.parse(onVal.content[0].text);
  check("declarative on remains reported as tier4", onReport.tier4KeysUsed?.includes("on"), JSON.stringify(onReport));

  const tier4String = await client.callTool({
    name: "rgx_validate_addon",
    arguments: { opts: { options: { General: ["toggle enabled"] } } },
  });
  const tier4StringReport = JSON.parse(tier4String.content[0].text);
  check(
    "one-line controls validate as shipped",
    tier4StringReport.valid && tier4StringReport.tier4KeysUsed.length === 0,
    JSON.stringify(tier4StringReport)
  );

  const addonSchema = JSON.parse(readFileSync(join(HERE, "../../../contract/schemas/rgx-addon.schema.json"), "utf8"));
  const validateAddon = createValidateAddon({ schema: addonSchema, Ajv: Ajv2020 });
  for (const { name, opts, valid: expected, tier4 = [] } of engineCases) {
    if (opts === null) continue; // MCP's transport requires a JSON object.
    const reply = await client.callTool({ name: "rgx_validate_addon", arguments: { opts } });
    const report = JSON.parse(reply.content[0].text);
    const { note, ...engineReport } = report;
    check("shared validation parity: " + name,
      JSON.stringify(engineReport) === JSON.stringify(validateAddon(opts)) && report.valid === expected
        && JSON.stringify(report.tier4KeysUsed) === JSON.stringify(tier4), JSON.stringify(report));
  }

  console.log("\n== rgx_audit_lua (RGX-Hello's actual Lua files) ==");
  const audit = await client.callTool({ name: "rgx_audit_lua", arguments: { path: helloPath } });
  const auditReport = JSON.parse(audit.content[0].text);
  console.log(JSON.stringify(auditReport, null, 2));
  check("RGX-Hello's Lua is clean of unsafe patterns", auditReport.clean === true, JSON.stringify(auditReport.findings));

  console.log("\n== rgx_audit_lua (restricted-aura fixtures) ==");
  const fixtureAudit = await client.callTool({
    name: "rgx_audit_lua",
    arguments: { path: join(HERE, "fixtures") },
  });
  const fixtureReport = JSON.parse(fixtureAudit.content[0].text);
  console.log(JSON.stringify(fixtureReport, null, 2));
  const safeAuraFindings = fixtureReport.findings.filter((finding) => finding.file === "aura-safe.lua");
  const unsafeAuraFindings = fixtureReport.findings.filter(
    (finding) => finding.file === "aura-unsafe.lua" && finding.detector === "raw_aura_plumbing"
  );
  const expectedUnsafeAuraLines = [3, 10, 11, 12, 15, 17, 19, 21, 22, 23, 29, 31, 32, 35, 36, 37, 38, 41, 43, 44];
  check("RGXAuras consumer usage passes the restricted-aura audit", safeAuraFindings.length === 0, JSON.stringify(safeAuraFindings));
  check(
    "raw aura plumbing fails the restricted-aura audit",
    JSON.stringify(unsafeAuraFindings.map((finding) => finding.line)) === JSON.stringify(expectedUnsafeAuraLines),
    JSON.stringify(unsafeAuraFindings)
  );
  check(
    "raw aura findings remain complete across files",
    fixtureReport.findings.some((finding) => finding.file === "z-aura-unsafe.lua"
      && finding.line === 1
      && finding.detector === "raw_aura_plumbing"),
    JSON.stringify(fixtureReport.findings)
  );
  const orderedFiles = fixtureReport.findings.map((finding) => finding.file);
  check(
    "directory audit findings are deterministic by file",
    JSON.stringify(orderedFiles) === JSON.stringify([...orderedFiles].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))),
    JSON.stringify(orderedFiles)
  );

  const malformedAudit = await client.callTool({
    name: "rgx_audit_lua",
    arguments: { path: join(HERE, "fixtures", "aura-malformed.txt") },
  });
  const malformedReport = JSON.parse(malformedAudit.content[0].text);
  check(
    "unparseable Lua fails the source audit closed",
    malformedReport.clean === false
      && malformedReport.findings.some((finding) => finding.detector === "lua_parse_error" && finding.line === 2),
    JSON.stringify(malformedReport)
  );
} finally {
  await client.close();
}

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : failures + " CHECK(S) FAILED"}`);
process.exit(failures === 0 ? 0 : 1);
