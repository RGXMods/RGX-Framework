#!/usr/bin/env node
// Behavior examples for schema rules that matter to runtime/tool consumers.
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const schemaPath = process.argv[2] || join(process.cwd(), "..", "..", "schemas", "rgx-addon.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
const fn = { $lua: "function" };

const cases = [
  ["valid named timers", { every: { heartbeat: [1, fn], "cache.refresh": [30, fn] } }, true],
  ["empty timer set", { every: {} }, true],
  ["empty timer name", { every: { "": [1, fn] } }, false],
  ["whitespace timer name", { every: { "   ": [1, fn] } }, false],
  ["zero interval", { every: { heartbeat: [0, fn] } }, false],
  ["missing handler", { every: { heartbeat: [1] } }, false],
  ["extra tuple value", { every: { heartbeat: [1, fn, "extra"] } }, false],
];

let failures = 0;
for (const [name, opts, expected] of cases) {
  const actual = validate(opts);
  if (actual === expected) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name} -- ${JSON.stringify(validate.errors)}`);
  }
}

console.log(`Checked ${cases.length} declarative contract case(s), ${failures} failed.`);
process.exit(failures ? 1 : 0);
