function luaQuote(s) {
  return '"' + String(s).replace(/[\\"\x00-\x1f\x7f]/g, (char) => {
    if (char === "\\") return "\\\\";
    if (char === '"') return '\\"';
    return `\\${char.charCodeAt(0).toString().padStart(3, "0")}`;
  }) + '"';
}

function luaComment(s) {
  return String(s).replace(/[\x00-\x1f\x7f]/g, " ");
}

const utf8Encoder = new TextEncoder();

function compareUtf8(a, b) {
  const left = utf8Encoder.encode(a);
  const right = utf8Encoder.encode(b);
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

const LUA_RESERVED = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "if", "in", "local", "nil", "not", "or", "repeat", "return", "then", "true",
  "until", "while",
]);

function luaKey(key) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) && !LUA_RESERVED.has(key)
    ? key
    : `[${luaQuote(key)}]`;
}

function luaDbValue(value, key) {
  if (typeof value === "string") return luaQuote(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  throw new Error(`invalid db value for '${key}'`);
}

function luaNumber(value, what) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`invalid ${what}`);
  return number;
}

function alphaNumber(value, what) {
  const number = luaNumber(value, what);
  if (number < 0 || number > 100) throw new Error(`${what} must be between 0 and 100`);
  return number;
}

// A hyphen (or other non-identifier character) in the addon name is valid
// in the name itself but would produce an odd SavedVariables global if
// concatenated as-is (e.g. "RGX-Hello" -> "RGX-HelloDB"). Strip anything
// that isn't a safe Lua identifier character for the auto-derived default,
// matching the precedent set by RGX-Hello's own hand-written core.lua
// (dbName = "RGXHelloDB").
function defaultDbName(name) {
  return name.replace(/[^A-Za-z0-9_]/g, "") + "DB";
}

// The contract format every generated file is authored against. Keep in
// lockstep with RGX.CONTRACT_FORMAT_VERSION in core/core.lua. Formats are
// additive: format N includes every lower format.
const CONTRACT_FORMAT_VERSION = 1;

// Minimum framework version per used feature, from the framework
// changelog. Contract format 1 is the declarative surface that shipped
// complete in 2.9.0 (schema, engine vectors, pages/cards, catalog);
// features that postdate it record their introduction here so the floor
// rises with what the spec actually uses.
const FEATURE_INTRODUCED = {
  contract: "2.9.0",
  pages: "2.9.0",
};

const FRAMEWORK_VERSION_PATTERN = /^\d+\.\d+(\.\d+)?$/;

function versionSegments(value) {
  const segments = String(value).split(".").map(Number);
  if (segments.some((segment) => !Number.isInteger(segment) || segment < 0)) {
    throw new Error(`invalid Framework version: ${value}`);
  }
  return segments;
}

function maxVersion(candidates) {
  let best = null;
  let bestSegments = null;
  for (const candidate of candidates) {
    const segments = versionSegments(candidate);
    if (!bestSegments) {
      best = candidate;
      bestSegments = segments;
      continue;
    }
    const count = Math.max(bestSegments.length, segments.length);
    for (let index = 0; index < count; index++) {
      const left = bestSegments[index] ?? 0;
      const right = segments[index] ?? 0;
      if (right === left) continue;
      if (right > left) {
        best = candidate;
        bestSegments = segments;
      }
      break;
    }
  }
  return best;
}

function computeFrameworkMinVersion(spec) {
  const used = ["contract"];
  if (spec.pages?.length) used.push("pages");
  const floors = used.map((feature) => FEATURE_INTRODUCED[feature]);
  if (spec.frameworkMinVersion !== undefined) {
    if (typeof spec.frameworkMinVersion !== "string"
      || !FRAMEWORK_VERSION_PATTERN.test(spec.frameworkMinVersion)) {
      throw new Error(`invalid frameworkMinVersion: ${JSON.stringify(spec.frameworkMinVersion)}`);
    }
    floors.push(spec.frameworkMinVersion);
  }
  return maxVersion(floors);
}

const compatPathPattern = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;

function compatEntry(key, value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error(`compat name '${key}' must be an identifier`);
  }
  const paths = Array.isArray(value) ? value : [value];
  if (!paths.length) throw new Error(`compat '${key}' must declare at least one path`);
  for (const path of paths) {
    if (typeof path !== "string" || !compatPathPattern.test(path)) {
      throw new Error(`compat '${key}' path must be a dotted global path`);
    }
  }
  return `        ${luaKey(key)} = { ${paths.map(luaQuote).join(", ")} },`;
}

function luaControlValue(value, what) {
  if (typeof value === "string") return luaQuote(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return `{ ${value.map((entry) => luaControlValue(entry, what)).join(", ")} }`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .sort(([left], [right]) => compareUtf8(left, right))
      .map(([key, entry]) => `${luaKey(key)} = ${luaControlValue(entry, `${what}.${key}`)}`);
    return `{ ${entries.join(", ")} }`;
  }
  throw new Error(`unsupported value for '${what}'`);
}

function emitControl(control) {
  if (typeof control === "string") return luaQuote(control);
  if (!control || typeof control !== "object" || Array.isArray(control)) {
    throw new Error("declarative controls must be strings or objects");
  }
  const entries = Object.entries(control)
    .sort(([left], [right]) => compareUtf8(left, right))
    .map(([key, value]) => `${luaKey(key)} = ${luaControlValue(value, `control.${key}`)}`);
  return `{ ${entries.join(", ")} }`;
}

function generatePagesLua(pages) {
  const tabOrder = [];
  const tabs = new Map();
  for (const page of pages) {
    const tabName = page.tab ?? "General";
    if (!tabs.has(tabName)) {
      tabs.set(tabName, []);
      tabOrder.push(tabName);
    }
    const cards = page.cards ?? [];
    if (!cards.length) throw new Error("declarative pages must contain at least one card");
    const pageNode = { page: page.page, cards: [] };
    if (page.grid !== undefined) pageNode.grid = page.grid;
    for (const card of cards) {
      if (!card?.controls?.length) throw new Error(`card '${card.card}' must contain at least one control`);
      const cardNode = { card: card.card, controls: [] };
      if (card.columns !== undefined) cardNode.columns = card.columns;
      for (const control of card.controls) cardNode.controls.push(emitControl(control));
      pageNode.cards.push(cardNode);
    }
    tabs.get(tabName).push(pageNode);
  }

  const out = [`    options = {`];
  for (const tabName of tabOrder) {
    out.push(`        ${luaKey(tabName)} = {`);
    for (const page of tabs.get(tabName)) {
      const fields = [`page = ${luaQuote(page.page)}`];
      if (page.grid !== undefined) fields.push(`grid = ${luaNumber(page.grid, "page grid")}`);
      out.push(`            { ${fields.join(", ")}, cards = {`);
      for (const card of page.cards) {
        const cardFields = [`card = ${luaQuote(card.card)}`];
        if (card.columns !== undefined) cardFields.push(`columns = ${luaNumber(card.columns, "card columns")}`);
        out.push(`                { ${cardFields.join(", ")}, controls = {`);
        out.push(...card.controls.map((control) => `                    ${control},`));
        out.push(`                } },`);
      }
      out.push(`            } },`);
    }
    out.push(`        },`);
  }
  out.push(`    },`);
  return out;
}

function generateAddonLua(spec) {
  const name = spec.name;
  const dbName = spec.dbName || defaultDbName(name);
  const needsExplicitDbName = Boolean(spec.dbName) || /[^A-Za-z0-9_]/.test(name);
  const minFrameworkVersion = computeFrameworkMinVersion(spec);
  const out = [];
  out.push(`-- ${luaComment(name)}.lua ? generated by rgx-mcp against the RGX Simplicity Contract`);
  out.push(`-- TOC needs: ## RequiredDeps: RGX-Framework` +
    (spec.db ? `  and  ## SavedVariables: ${luaComment(dbName)}` : ""));
  out.push(`-- Contract provenance: ## X-RGX-Contract-Format: ${CONTRACT_FORMAT_VERSION}` +
    `  and  ## X-RGX-Framework-MinVersion: ${luaComment(minFrameworkVersion)} in the TOC`);
  out.push(`local RGX = _G.RGXFramework`);
  out.push(`if type(RGX) ~= "table" or type(RGX.RequireContract) ~= "function" then`);
  out.push(`    error(${luaQuote(`${name} requires RGX-Framework ${minFrameworkVersion} or newer with the RGX contract compatibility handshake. Update RGX-Framework.`)}, 0)`);
  out.push(`end`);
  out.push(`RGX:RequireContract(${luaQuote(name)}, ${CONTRACT_FORMAT_VERSION}, ${luaQuote(minFrameworkVersion)})`);
  out.push(`RGXAddon ${luaQuote(name)} {`);
  if (needsExplicitDbName && spec.db) out.push(`    dbName  = ${luaQuote(dbName)},`);
  out.push(`    slash   = ${luaQuote(spec.slash ?? name.toLowerCase())},`);
  if (spec.minimap) out.push(`    minimap = true,`);
  if (spec.db) {
    const entries = Object.entries(spec.db)
      .map(([k, v]) => `${luaKey(k)} = ${luaDbValue(v, k)}`)
      .join(", ");
    out.push(`    db      = { ${entries} },`);
  }
  const timers = Object.entries(spec.every ?? {}).sort(([a], [b]) => compareUtf8(a, b));
  if (timers.length) {
    out.push(`    every   = {`);
    for (const [timerName, seconds] of timers) {
      const secs = luaNumber(seconds, `timer '${timerName}' seconds`);
      if (secs <= 0) throw new Error(`timer '${timerName}' seconds must be positive`);
      out.push(`        ${luaKey(timerName)} = { ${secs}, function(self, timer)`);
      out.push(`            -- Run ${luaComment(timerName)} every ${secs} second${secs === 1 ? "" : "s"}.`);
      out.push(`        end },`);
    }
    out.push(`    },`);
  }
  const compatEntries = Object.entries(spec.compat ?? {}).sort(([a], [b]) => compareUtf8(a, b));
  if (compatEntries.length) {
    out.push(`    compat  = {`);
    for (const [key, value] of compatEntries) out.push(compatEntry(key, value));
    out.push(`    },`);
  }
  if (spec.pages?.length) {
    if (spec.columns !== undefined) throw new Error("columns cannot be combined with declarative pages");
    if ((spec.toggles?.length ?? 0) || (spec.sliders?.length ?? 0)
      || (spec.textboxes?.length ?? 0) || (spec.panelAlphas?.length ?? 0)) {
      throw new Error("declarative pages cannot be combined with top-level control lists");
    }
    out.push(...generatePagesLua(spec.pages));
  }
  const controls = [];
  for (const t of spec.toggles ?? []) {
    controls.push(`            { toggle = ${luaQuote(t)} },`);
  }
  for (const t of spec.textboxes ?? []) {
    const parts = [`textbox = ${luaQuote(t.key)}`];
    if (t.label) parts.push(`label = ${luaQuote(t.label)}`);
    if (t.placeholder) parts.push(`placeholder = ${luaQuote(t.placeholder)}`);
    if (t.default !== undefined) parts.push(`default = ${luaQuote(String(t.default))}`);
    controls.push(`            { ${parts.join(", ")} },`);
  }
  for (const s of spec.sliders ?? []) {
    const parts = [`slider = ${luaQuote(s.key)}`];
    if (s.label) parts.push(`label = ${luaQuote(s.label)}`);
    parts.push(
      `min = ${luaNumber(s.min ?? 0, `slider '${s.key}' min`)}`,
      `max = ${luaNumber(s.max ?? 100, `slider '${s.key}' max`)}`
    );
    if (s.suffix) parts.push(`suffix = ${luaQuote(s.suffix)}`);
    if (s.valueDisplay) parts.push(`valueDisplay = ${luaQuote(s.valueDisplay)}`);
    if (s.progress !== undefined) parts.push(`progress = ${Boolean(s.progress)}`);
    controls.push(`            { ${parts.join(", ")} },`);
  }
  for (const p of spec.panelAlphas ?? []) {
    const parts = [`panel_alpha = ${luaQuote(p.key)}`];
    if (p.label) parts.push(`label = ${luaQuote(p.label)}`);
    if (p.default !== undefined) {
      parts.push(`default = ${alphaNumber(p.default, `panel_alpha '${p.key}' default`)}`);
    }
    if (p.presets?.length) {
      const entries = p.presets.map((preset) => {
        if (!preset?.label) throw new Error(`panel_alpha '${p.key}' preset label is required`);
        const value = alphaNumber(preset.value, `panel_alpha '${p.key}' preset`);
        return `{ label = ${luaQuote(preset.label)}, value = ${value} }`;
      });
      parts.push(`presets = { ${entries.join(", ")} }`);
    }
    controls.push(`            { ${parts.join(", ")} },`);
  }
  if (!spec.pages?.length && (controls.length || spec.columns !== undefined)) {
    out.push(`    options = {`);
    if (spec.columns !== undefined) {
      const columns = luaNumber(spec.columns, "columns");
      if (!Number.isInteger(columns)) throw new Error("columns must be an integer");
      out.push(`        columns = ${columns},`);
    }
    out.push(`        General = {`);
    out.push(...controls);
    out.push(`        },`);
    out.push(`    },`);
  }
  out.push(`    welcome = ${luaQuote(`loaded ? /${spec.slash ?? name.toLowerCase()} for options`)},`);
  out.push(`}`);
  return out.join("\n");
}


function generateAddonToc(spec) {
  const name = spec.name;
  const dbName = spec.dbName || defaultDbName(name);
  const minFrameworkVersion = computeFrameworkMinVersion(spec);
  const out = [];
  out.push(`## Interface: ${spec.interface ?? 120105}`);
  out.push(`## Title: ${luaComment(spec.title ?? name)}`);
  out.push(`## RequiredDeps: RGX-Framework`);
  out.push(`## X-RGX-Contract-Format: ${CONTRACT_FORMAT_VERSION}`);
  out.push(`## X-RGX-Framework-MinVersion: ${luaComment(minFrameworkVersion)}`);
  if (spec.db) out.push(`## SavedVariables: ${luaComment(dbName)}`);
  out.push(`${luaComment(name)}.lua`);
  return out.join("\n");
}

export { generateAddonLua, generateAddonToc, computeFrameworkMinVersion, CONTRACT_FORMAT_VERSION };
