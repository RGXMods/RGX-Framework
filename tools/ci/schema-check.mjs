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
  let vectors = 0;

  if (schema.properties?.every) {
    const luaFunction = { $lua: "function" };
    const validCases = [
      {},
      { every: {} },
      { every: { heartbeat: [1, luaFunction], "cache.refresh": [0.25, luaFunction], ["\u00a0"]: [2, luaFunction] } },
    ];
    const invalidCases = [
      { every: true },
      { every: { "": [1, luaFunction] } },
      { every: { "   ": [1, luaFunction] } },
      { every: { "tick\nname": [1, luaFunction] } },
      { every: { heartbeat: [0, luaFunction] } },
      { every: { heartbeat: [-1, luaFunction] } },
      { every: { heartbeat: [Number.NaN, luaFunction] } },
      { every: { heartbeat: [Number.POSITIVE_INFINITY, luaFunction] } },
      { every: { heartbeat: [1] } },
      { every: { heartbeat: [1, luaFunction, "extra"] } },
      { every: { heartbeat: [1, { $lua: "not-a-function" }] } },
    ];

    for (const value of validCases) {
      vectors++;
      if (!validate(value)) throw new Error(`valid every fixture was rejected: ${JSON.stringify(validate.errors)}`);
    }
    for (const value of invalidCases) {
      vectors++;
      if (validate(value)) throw new Error(`invalid every fixture was accepted: ${JSON.stringify(value)}`);
    }
  }

  console.log(`SCHEMA OK  ${path}  ($id: ${schema.$id || "none"}, ${vectors} behavior vectors)`);
} catch (e) {
  console.error(`SCHEMA ERROR  ${path}  ->  ${e.message}`);
  process.exit(1);
}
