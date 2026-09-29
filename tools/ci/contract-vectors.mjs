#!/usr/bin/env node
// Conformance vectors that hold under BOTH validator configurations the
// ecosystem uses (schema-check.mjs runs ajv with strictNumbers:true, the
// runtime contract check runs strictNumbers:false). Non-finite numbers
// (Infinity, NaN) are excluded because Ajv's handling differs between
// modes; they remain enforced by the schema in strictNumbers mode only.
const fn = { $lua: "function" };

export const conformanceCases = [
  { name: "valid named timers", opts: { every: { heartbeat: [1, fn], "cache.refresh": [30, fn] } }, valid: true },
  { name: "empty timer set", opts: { every: {} }, valid: true },
  { name: "empty opts", opts: {}, valid: true },
  { name: "non-breaking-space timer name", opts: { every: { " ": [2, fn] } }, valid: true },
  { name: "empty timer name", opts: { every: { "": [1, fn] } }, valid: false },
  { name: "whitespace timer name", opts: { every: { "   ": [1, fn] } }, valid: false },
  { name: "zero interval", opts: { every: { heartbeat: [0, fn] } }, valid: false },
  { name: "negative interval", opts: { every: { heartbeat: [-1, fn] } }, valid: false },
  { name: "missing handler", opts: { every: { heartbeat: [1] } }, valid: false },
  { name: "extra tuple value", opts: { every: { heartbeat: [1, fn, "extra"] } }, valid: false },
  { name: "non-function handler", opts: { every: { heartbeat: [1, { $lua: "not-a-function" }] } }, valid: false },
  { name: "every must be an object", opts: { every: true }, valid: false },
  { name: "newline timer name", opts: { every: { "tick\nname": [1, fn] } }, valid: false },
];
