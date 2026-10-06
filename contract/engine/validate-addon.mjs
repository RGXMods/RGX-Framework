// Transport-independent addon validation engine. The MCP resource dressing and
// response envelope stay in the server; this module owns semantics. Ajv2020 is
// injected by the caller (MCP/CI/editor) so contract/ carries no dependencies
// of its own.
export function createValidateAddon({ schema, Ajv }) {
  const ajv = new Ajv({ allErrors: true, strict: false, strictNumbers: true });
  const validate = ajv.compile(schema);
  return function validateAddon(opts) {
    const valid = validate(opts);
    const tier4Used = ["on"].filter((k) => k in opts);
    if (opts.options && typeof opts.options === "object" && "columns" in opts.options) {
      tier4Used.push("options.columns");
    }
    return { valid, errors: validate.errors ?? [], tier4KeysUsed: tier4Used };
  };
}
