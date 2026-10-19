#!/usr/bin/env node
// CI schema gate: confirm the declarative addon schema is valid JSON and a
// compilable JSON Schema. rgx-mcp validates real addon opts against this file,
// so a malformed schema would silently break every validation downstream.
//
// Usage: node tools/ci/schema-check.mjs <path-to-schema.json>
// Use the same draft-2020-12 build and options rgx-mcp's server uses, so this
// gate compiles the schema exactly the way the real validator does.
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { conformanceCases, engineCases } from "./contract-vectors.mjs";
import { createValidateAddon } from "../../contract/engine/validate-addon.mjs";

const path = process.argv[2];
if (!path) {
  console.error("Usage: node schema-check.mjs <path-to-schema.json>");
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.error(`INVALID JSON  ${path}  ->  ${e.message}`);
  process.exit(1);
}

try {
  const ajv = new Ajv2020({ allErrors: true, strict: false, strictNumbers: true });
  const validate = ajv.compile(schema);

  for (const { name, opts, valid: expected } of conformanceCases) {
    const actual = validate(opts);
    if (actual !== expected) {
      throw new Error(`${name}: expected ${expected ? "valid" : "invalid"}, got ${actual ? "valid" : "invalid"} (${JSON.stringify(validate.errors)})`);
    }
  }

  const validateAddon = createValidateAddon({ schema, Ajv: Ajv2020 });
  for (const { name, opts, valid: expected, tier4 = [] } of engineCases) {
    const report = validateAddon(opts);
    if (report.valid !== expected || JSON.stringify(report.tier4KeysUsed) !== JSON.stringify(tier4)) {
      throw new Error(`shared engine ${name}: unexpected report (${JSON.stringify(report)})`);
    }
  }
  const annotated = structuredClone(schema);
  annotated.properties.futureFeature = { type: "boolean", "x-rgx-ships": "tier4" };
  annotated.properties.on["x-rgx-ships"] = "today";
  annotated.properties.options.properties.columns["x-rgx-ships"] = "tier4";
  annotated.$defs.controlString["x-rgx-ships"] = "tier4";
  const annotationReport = createValidateAddon({ schema: annotated, Ajv: Ajv2020 })({
    futureFeature: true, on: { login: { $lua: "function" } },
    options: { columns: 2, General: [{ toggle: "enabled" }, "font titleFont"] },
  });
  if (!annotationReport.valid || JSON.stringify(annotationReport.tier4KeysUsed) !== JSON.stringify(["futureFeature", "options.General[1]", "options.columns"])) {
    throw new Error(`availability must follow schema annotations, including referenced control branches (${JSON.stringify(annotationReport)})`);
  }

  console.log(`SCHEMA OK  ${path}  ($id: ${schema.$id || "none"}, ${conformanceCases.length} schema vectors, ${engineCases.length} engine vectors, annotation-driven availability)`);
} catch (e) {
  console.error(`SCHEMA ERROR  ${path}  ->  ${e.message}`);
  process.exit(1);
}
