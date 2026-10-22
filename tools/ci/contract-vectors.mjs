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
  { name: "single-column options", opts: { db: {}, options: { columns: 1, General: [] } }, valid: true },
  { name: "options without db is rejected", opts: { options: { General: [] } }, valid: false },
  { name: "options with db is accepted", opts: { db: {}, options: { General: [] } }, valid: true },
  { name: "two-column options", opts: { db: {}, options: { columns: 2, General: [] } }, valid: true },
  { name: "three-column options", opts: { db: {}, options: { columns: 3, General: [] } }, valid: true },
  { name: "zero columns", opts: { options: { columns: 0 } }, valid: false },
  { name: "four columns", opts: { options: { columns: 4 } }, valid: false },
  { name: "non-numeric columns", opts: { options: { columns: "two" } }, valid: false },
  { name: "panel alpha control", opts: { db: {}, options: { General: [{ panel_alpha: "overlay", label: "Panel Opacity", default: 80, presets: [{ label: "Low", value: 25 }, { label: "High", value: 100 }] }] } }, valid: true },
  { name: "panel alpha default above range", opts: { options: { General: [{ panel_alpha: "overlay", default: 150 }] } }, valid: false },
  { name: "panel alpha preset below range", opts: { options: { General: [{ panel_alpha: "overlay", presets: [{ label: "Low", value: -5 }] }] } }, valid: false },
  { name: "unknown panel alpha key", opts: { options: { General: [{ panel_alpha: "overlay", width: 300 }] } }, valid: false },
  { name: "valid compat single path", opts: { compat: { GetItemInfo: "RGX.API.GetItemInfo" } }, valid: true },
  { name: "valid compat path list", opts: { compat: { GetAvailableQuests: ["C_GossipInfo.GetAvailableQuests", "GetGossipAvailableQuests"] } }, valid: true },
  { name: "valid compat prefer fallback normalize", opts: { compat: { GetAvailableQuests: { prefer: "C_GossipInfo.GetAvailableQuests", fallback: "GetGossipAvailableQuests", normalize: fn } } }, valid: true },
  { name: "compat must be an object", opts: { compat: true }, valid: false },
  { name: "compat name must be an identifier", opts: { compat: { "bad name": "C_GossipInfo.GetAvailableQuests" } }, valid: false },
  { name: "compat path must be a dotted global", opts: { compat: { GetAvailableQuests: "not a path" } }, valid: false },
  { name: "compat path list cannot be empty", opts: { compat: { GetAvailableQuests: [] } }, valid: false },
  { name: "compat prefer is required in table form", opts: { compat: { GetAvailableQuests: { fallback: "GetGossipAvailableQuests" } } }, valid: false },
  { name: "compat normalize must be a function", opts: { compat: { GetAvailableQuests: { prefer: "C_GossipInfo.GetAvailableQuests", normalize: true } } }, valid: false },
  { name: "valid declarative page and card", opts: { db: {}, options: { General: [{ page: "Basics", grid: 2, cards: [{ card: "Display", columns: 2, controls: [{ toggle: "enabled" }, "slider volume 0-100 'Volume'"] }] }] } }, valid: true },
  { name: "declarative page requires cards", opts: { options: { General: [{ page: "Basics" }] } }, valid: false },
  { name: "declarative page cards cannot be empty", opts: { options: { General: [{ page: "Basics", cards: [] }] } }, valid: false },
  { name: "declarative page grid must be 1 or 2", opts: { options: { General: [{ page: "Basics", grid: 3, cards: [{ card: "Display", controls: [{ toggle: "enabled" }] }] }] } }, valid: false },
  { name: "declarative card requires controls", opts: { options: { General: [{ page: "Basics", cards: [{ card: "Display" }] }] } }, valid: false },
  { name: "declarative card controls cannot be empty", opts: { options: { General: [{ page: "Basics", cards: [{ card: "Display", controls: [] }] }] } }, valid: false },
  { name: "declarative card columns must be 1 or 2", opts: { options: { General: [{ page: "Basics", cards: [{ card: "Display", columns: 3, controls: [{ toggle: "enabled" }] }] }] } }, valid: false },
  { name: "pages and cards cannot nest in card controls", opts: { options: { General: [{ page: "Basics", cards: [{ card: "Display", controls: [{ page: "Nested" }] }] }] } }, valid: false },
  ...["slider offset -10--5", "slider offset -1.5-0.5 .25 'Offset'", "textbox keyword", "textbox keyword 'Keyword'", "panel_alpha overlay", "panel_alpha overlay 'Panel Opacity'", "dropdown mode low|high", "font titleFont", "button 'Reset' ResetSettings", "header 'Settings'", "label 'Notes'", "toggle enabled\t"].map(control => ({
    name: `supported control: ${control}`, opts: { db: {}, options: { General: [control] } }, valid: true,
  })),
  ...["toggle enabled extra", "button nonsense", "slider volume nonsense", "textbox", "textbox keyword extra", "panel_alpha", "panel_alpha overlay extra", "dropdown mode low||high", "header 'Title' extra"].map(control => ({
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

// Shared TOC-generation vectors. Each case drives the same canonical spec input
// through generateAddonToc; direct CI and the MCP transport test both consume
// these vectors and additionally require a byte-identical second generation.
export const tocCases = [
  {
    name: "basic TOC with db",
    spec: { name: "MyAddon", db: { enabled: true } },
    expected: [
      "## Interface: 120105",
      "## Title: MyAddon",
      "## RequiredDeps: RGX-Framework",
      "## X-RGX-Contract-Format: 1",
      "## X-RGX-Framework-MinVersion: 2.9.0",
      "## SavedVariables: MyAddonDB",
      "MyAddon.lua",
    ].join("\n"),
  },
  {
    name: "hyphenated name derives dbName",
    spec: { name: "RGX-Hello", db: {} },
    expected: [
      "## Interface: 120105",
      "## Title: RGX-Hello",
      "## RequiredDeps: RGX-Framework",
      "## X-RGX-Contract-Format: 1",
      "## X-RGX-Framework-MinVersion: 2.9.0",
      "## SavedVariables: RGXHelloDB",
      "RGX-Hello.lua",
    ].join("\n"),
  },
  {
    name: "no db omits SavedVariables",
    spec: { name: "NoDb" },
    expected: [
      "## Interface: 120105",
      "## Title: NoDb",
      "## RequiredDeps: RGX-Framework",
      "## X-RGX-Contract-Format: 1",
      "## X-RGX-Framework-MinVersion: 2.9.0",
      "NoDb.lua",
    ].join("\n"),
  },
  {
    name: "interface and title overrides",
    spec: { name: "ClassicAddon", interface: 11509, title: "Classic Addon", db: {} },
    expected: [
      "## Interface: 11509",
      "## Title: Classic Addon",
      "## RequiredDeps: RGX-Framework",
      "## X-RGX-Contract-Format: 1",
      "## X-RGX-Framework-MinVersion: 2.9.0",
      "## SavedVariables: ClassicAddonDB",
      "ClassicAddon.lua",
    ].join("\n"),
  },
  {
    name: "declarative pages keep the contract floor",
    spec: { name: "PagedAddon", db: {}, pages: [{ page: "Basics", cards: [{ card: "Display", controls: ["toggle enabled"] }] }] },
    expected: [
      "## Interface: 120105",
      "## Title: PagedAddon",
      "## RequiredDeps: RGX-Framework",
      "## X-RGX-Contract-Format: 1",
      "## X-RGX-Framework-MinVersion: 2.9.0",
      "## SavedVariables: PagedAddonDB",
      "PagedAddon.lua",
    ].join("\n"),
  },
  {
    name: "frameworkMinVersion override raises the provenance floor",
    spec: { name: "NewerAddon", db: {}, frameworkMinVersion: "2.10.0" },
    expected: [
      "## Interface: 120105",
      "## Title: NewerAddon",
      "## RequiredDeps: RGX-Framework",
      "## X-RGX-Contract-Format: 1",
      "## X-RGX-Framework-MinVersion: 2.10.0",
      "## SavedVariables: NewerAddonDB",
      "NewerAddon.lua",
    ].join("\n"),
  },
];
