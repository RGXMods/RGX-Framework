// Transport-independent addon validation engine. The MCP resource dressing and
// response envelope stay in the server; this module owns semantics. Ajv2020 is
// injected by the caller (MCP/CI/editor) so contract/ carries no dependencies
// of its own.
export function parseControlString(source) {
  if (typeof source !== "string") return null;
  source = source.replace(/[ \t\r\n\f\v]+$/, "");
  let match = /^(header|label)[ \t\r\n\f\v]+'([^']*)'$/.exec(source);
  if (match) return { section: match[2] };
  match = /^button[ \t\r\n\f\v]+'([^']*)'[ \t\r\n\f\v]+([A-Za-z_][A-Za-z0-9_]*)$/.exec(source);
  if (match) return { button: match[1], method: match[2] };
  match = /^(toggle|color|font)[ \t\r\n\f\v]+([^ \t\r\n\f\v'"]+)(?:[ \t\r\n\f\v]+'([^']*)')?$/.exec(source);
  if (match) return { [match[1]]: match[2], ...(match[3] !== undefined ? { label: match[3] } : {}) };
  match = /^slider[ \t\r\n\f\v]+([^ \t\r\n\f\v'"]+)[ \t\r\n\f\v]+([+-]?\d*\.?\d+)-([+-]?\d*\.?\d+)(?:[ \t\r\n\f\v]+([+-]?\d*\.?\d+))?(?:[ \t\r\n\f\v]+'([^']*)')?$/.exec(source);
  if (match) {
    const min = Number(match[2]), max = Number(match[3]), step = match[4] === undefined ? 1 : Number(match[4]);
    if (![min, max, step].every(Number.isFinite) || min > max || step <= 0) return null;
    return { slider: match[1], min, max, step, ...(match[5] !== undefined ? { label: match[5] } : {}) };
  }
  match = /^dropdown[ \t\r\n\f\v]+([^ \t\r\n\f\v'"]+)[ \t\r\n\f\v]+([^ \t\r\n\f\v'"]+)(?:[ \t\r\n\f\v]+'([^']*)')?$/.exec(source);
  if (match) {
    const items = match[2].split("|");
    if (items.some(item => item.length === 0)) return null;
    return { dropdown: match[1], items, ...(match[3] !== undefined ? { label: match[3] } : {}) };
  }
  return null;
}

export function createValidateAddon({ schema, Ajv }) {
  const ajv = new Ajv({ allErrors: true, strict: false, strictNumbers: true });
  const validate = ajv.compile(schema);
  const branchValidators = new WeakMap();
  function matches(value, node) {
    if (!branchValidators.has(node)) {
      branchValidators.set(node, ajv.compile({ ...node, $defs: schema.$defs }));
    }
    return branchValidators.get(node)(value);
  }
  function collectFutureKeys(value, node, path, result) {
    if (!node || typeof node !== "object") return;
    if (node["x-rgx-ships"] === "tier4") {
      result.add(path);
      return;
    }
    if (node.$ref?.startsWith("#/")) {
      const target = node.$ref.slice(2).split("/").reduce((part, key) => part?.[key.replaceAll("~1", "/").replaceAll("~0", "~")], schema);
      collectFutureKeys(value, target, path, result);
    }
    for (const branch of [...(node.oneOf ?? []), ...(node.anyOf ?? [])]) {
      if (matches(value, branch)) collectFutureKeys(value, branch, path, result);
    }
    for (const branch of node.allOf ?? []) collectFutureKeys(value, branch, path, result);
    if (Array.isArray(value)) {
      value.forEach((item, index) => collectFutureKeys(item, node.prefixItems?.[index] ?? node.items, `${path}[${index}]`, result));
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        collectFutureKeys(item, node.properties?.[key] ?? node.additionalProperties, path ? `${path}.${key}` : key, result);
      }
    }
  }
  return function validateAddon(opts) {
    const valid = validate(opts);
    const errors = [...(validate.errors ?? [])];
    for (const [tab, controls] of Object.entries(opts?.options ?? {})) {
      if (!Array.isArray(controls)) continue;
      controls.forEach((control, index) => {
        if (typeof control === "string" && !parseControlString(control)) {
          errors.push({ instancePath: `/options/${tab.replaceAll("~", "~0").replaceAll("/", "~1")}/${index}`,
            keyword: "controlGrammar", message: "must be a supported, unambiguous control string", params: {} });
        }
      });
    }
    const futureKeys = new Set();
    collectFutureKeys(opts, schema, "", futureKeys);
    return { valid: valid && errors.length === 0, errors, tier4KeysUsed: [...futureKeys].sort() };
  };
}
