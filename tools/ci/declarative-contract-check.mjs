#!/usr/bin/env node
// Behavior examples for schema rules that matter to runtime/tool consumers.
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { conformanceCases } from "./contract-vectors.mjs";

const schemaPath = process.argv[2] || join(process.cwd(), "..", "..", "schemas", "rgx-addon.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);

let failures = 0;
for (const { name, opts, valid: expected } of conformanceCases) {
  const actual = validate(opts);
  if (actual === expected) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.error(`  FAIL  ${name} -- ${JSON.stringify(validate.errors)}`);
  }
}

console.log(`Checked ${conformanceCases.length} declarative contract case(s), ${failures} failed.`);
process.exit(failures ? 1 : 0);
