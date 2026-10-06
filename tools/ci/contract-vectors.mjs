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
  { name: "single-column options", opts: { options: { columns: 1, General: [] } }, valid: true },
  { name: "two-column options", opts: { options: { columns: 2, General: [] } }, valid: true },
  { name: "three-column options", opts: { options: { columns: 3, General: [] } }, valid: true },
  { name: "zero columns", opts: { options: { columns: 0 } }, valid: false },
  { name: "four columns", opts: { options: { columns: 4 } }, valid: false },
  { name: "non-numeric columns", opts: { options: { columns: "two" } }, valid: false },
  ...["slider offset -10--5", "slider offset -1.5-0.5 .25 'Offset'", "dropdown mode low|high", "font titleFont", "button 'Reset' ResetSettings", "header 'Settings'", "label 'Notes'", "toggle enabled\t"].map(control => ({
    name: `supported control: ${control}`, opts: { options: { General: [control] } }, valid: true,
  })),
  ...["toggle enabled extra", "button nonsense", "slider volume nonsense", "dropdown mode low||high", "header 'Title' extra"].map(control => ({
    name: `malformed control: ${control}`, opts: { options: { General: [control] } }, valid: false,
  })),
];

// Numeric grammar semantics cannot be expressed by JSON Schema's regex alone.
// These cases exercise the shared engine and the real MCP transport equally.
export const engineCases = [
  ...conformanceCases,
  ...["slider offset 5-1", "slider offset 0-1 0", "slider offset 0-1 -1"].map(control => ({
    name: `invalid slider semantics: ${control}`, opts: { options: { General: [control] } }, valid: false,
  })),
  { name: "future trigger", opts: { on: { login: fn } }, valid: true, tier4: ["on"] },
  { name: "null declaration", opts: null, valid: false },
];
