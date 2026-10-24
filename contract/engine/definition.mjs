// Transport-independent, browser-compatible authoring logic. No MCP, filesystem,
// AI, or WoW dependency. The schema is the source of constraints, not a copy.
export const exampleDefinition = Object.freeze({
  version: 1, kind: "label", id: "example", text: "Hello RGX",
  enabled: true, x: 0, y: 0, scale: 100,
});
// Adapters supply the canonical JSON schema: Node reads it, browsers fetch it.
// Keep this module free of filesystem and import-attribute/version dependencies.
export function createDefinitionEngine(schema) {
if (schema?.properties?.version?.const !== 1 || schema?.properties?.kind?.const !== "label") {
  throw new Error("unsupported definition contract");
}
const encoder = new TextEncoder();
const decoder = new TextDecoder("utf-8", { fatal: true });
const fields = schema.required;
function plainData(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error("definition must be a plain object");
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== "string" || !fields.includes(key)) throw new Error("unknown definition field");
    if (descriptor.get || descriptor.set) throw new Error("definition must contain data, not accessors");
  }
}
function validLabelText(text) {
  if (typeof text !== "string" || /[\x00-\x1f\x7f]/.test(text)) return false;
  const bytes = encoder.encode(text);
  return bytes.length <= schema.properties.text["x-rgx-maxBytes"] && decoder.decode(bytes) === text;
}
function normalizeDefinition(value) {
  plainData(value);
  if (fields.some(key => !Object.hasOwn(value, key))) throw new Error("missing definition field");
  if (value.version !== 1 || value.kind !== "label") throw new Error("unsupported definition version/kind");
  if (typeof value.id !== "string" || !new RegExp(schema.properties.id.pattern).test(value.id)) throw new Error("invalid definition id");
  if (!validLabelText(value.text)) throw new Error("invalid definition text");
  if (typeof value.enabled !== "boolean") throw new Error("invalid definition enabled state");
  for (const key of ["x", "y", "scale"]) {
    const rule = schema.properties[key];
    if (!Number.isInteger(value[key]) || value[key] < rule.minimum || value[key] > rule.maximum) throw new Error(`invalid definition ${key}`);
  }
  return Object.fromEntries(fields.map(key => [key, typeof value[key] === "number" && value[key] === 0 ? 0 : value[key]]));
}
function exportDefinition(value) {
  const d = normalizeDefinition(value);
  const text = Array.from(encoder.encode(d.text), byte => `%${byte.toString(16).toUpperCase().padStart(2, "0")}`).join("");
  return ["RGXD1", d.kind, d.id, d.enabled ? "1" : "0", d.scale, d.x, d.y, text].join("|");
}
function importDefinition(wire) {
  if (typeof wire !== "string" || wire.length > 1024) throw new Error("invalid definition transfer");
  const p = wire.split("|");
  if (p.length !== 8 || p[0] !== "RGXD1" || !/^[01]$/.test(p[3]) || !/^(?:%[0-9a-fA-F]{2})*$/.test(p[7])) throw new Error("invalid definition transfer");
  for (const part of p.slice(4, 7)) if (!/^-?(?:0|[1-9][0-9]*)$/.test(part)) throw new Error("invalid definition number");
  let text;
  try { text = decoder.decode(Uint8Array.from(p[7].match(/%../g) ?? [], token => parseInt(token.slice(1), 16))); }
  catch { throw new Error("invalid definition text"); }
  return normalizeDefinition({ version: 1, kind: p[1], id: p[2], enabled: p[3] === "1", scale: Number(p[4]), x: Number(p[5]), y: Number(p[6]), text });
}
function createDefinitionSession(value, onSave) {
  let saved = normalizeDefinition(value);
  let draft = { ...saved };
  return {
    getDefinition: () => ({ ...saved }),
    getDraft: () => ({ ...draft }),
    patch(changes) {
      plainData(changes);
      const next = normalizeDefinition({ ...draft, ...changes });
      draft = next;
      return { ...draft };
    },
    import(wire) { draft = importDefinition(wire); return { ...draft }; },
    export: () => exportDefinition(draft),
    cancel() { draft = { ...saved }; return { ...draft }; },
    save() {
      const next = normalizeDefinition(draft);
      if (onSave) {
        const accepted = onSave({ ...next });
        if (accepted !== undefined && accepted !== true) throw new Error("definition save rejected (callback must be synchronous)");
      }
      saved = next;
      return { ...saved };
    },
  };
}
return { definitionSchema: schema, validLabelText, normalizeDefinition, importDefinition,
  exportDefinition, createDefinitionSession };
}
