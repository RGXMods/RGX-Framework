#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import { Lua } from "wasmoon-lua5.1";
import { createDefinitionEngine, exampleDefinition } from "../../contract/engine/definition.mjs";
import { createEditorServer } from "../editor/serve.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const definitionSchema = JSON.parse(readFileSync(join(ROOT, "contract/schemas/rgx-definition.schema.json"), "utf8"));
const { validLabelText, normalizeDefinition, importDefinition, exportDefinition,
  createDefinitionSession } = createDefinitionEngine(definitionSchema);
const ajv = new Ajv({ strict: false });
ajv.addFormat("rgx-label-text", validLabelText);
const validate = ajv.compile(definitionSchema);
const lua = await Lua.create();
let checks = 0;
const quote = JSON.stringify;
try {
  lua.ctx.__uiSource = readFileSync(join(ROOT, "modules/ui/controls.lua"), "utf8");
  lua.doStringSync(`
    UI = {}
    RGX = { API = {
      CanAccessValue = function(value) return type(value) ~= "nil" and value ~= __deniedValue end,
      CanAccessTable = function(value) return type(value) == "table" and value ~= __deniedTable end,
    }, RegisterModule = function() end }
    _G.RGXFramework = RGX
    assert(loadstring(__uiSource))("RGX-Framework", UI)
  `);
  const samples = [exampleDefinition,
    { ...exampleDefinition, enabled: false, text: "", x: -500, y: 500, scale: 25 },
    { ...exampleDefinition, id: "unicode_1", text: "Ω 🐉 |cFF00FF00 " + String.fromCharCode(34, 92), x: 23, y: -17, scale: 300 },
    { ...exampleDefinition, text: "a".repeat(256), x: -0 },
  ];
  for (const sample of samples) {
    const definition = normalizeDefinition(sample);
    assert(validate(definition), JSON.stringify(validate.errors));
    const wire = exportDefinition(definition);
    assert.deepEqual(importDefinition(wire), definition);
    assert.equal(lua.doStringSync(`return assert(UI:ExportDefinition(assert(UI:ImportDefinition(${quote(wire)}))))`), wire);
    const external = createDefinitionSession(definition);
    external.patch({ enabled: false, x: 19, y: -12, scale: 125, text: "edited externally Ω" });
    const returned = lua.doStringSync(`
      local s = assert(UI:CreateDefinitionSession(assert(UI:ImportDefinition(${quote(external.export())}))))
      assert(s:Patch({ text = "edited in-game", y = 42 }))
      assert(s:Save())
      return assert(s:Export())
    `);
    const result = importDefinition(returned);
    assert.deepEqual(result, { ...external.getDraft(), text: "edited in-game", y: 42 });
    checks++;
  }
  const invalid = [
    { ...exampleDefinition, version: 2 }, { ...exampleDefinition, kind: "script" },
    { ...exampleDefinition, id: "bad id" }, { ...exampleDefinition, enabled: 0 },
    { ...exampleDefinition, x: 501 }, { ...exampleDefinition, scale: 1.5 },
    { ...exampleDefinition, text: "Ω".repeat(129) }, { ...exampleDefinition, text: "\ud800" },
    { ...exampleDefinition, text: "line\nbreak" }, { ...exampleDefinition, script: "return 1" },
  ];
  for (const sample of invalid) {
    assert.equal(validate(sample), false);
    assert.throws(() => normalizeDefinition(sample));
    checks++;
  }
  const malformed = ["", "RGXD2|label|example|1|100|0|0|", "RGXD1|label|example|false|100|0|0|",
    "RGXD1|label|example|1|100|1.5|0|", "RGXD1|label|example|1|100|01|0|",
    "RGXD1|label|example|1|100|0|0|%FF", "RGXD1|label|example|1|100|0|0|%C0%80",
    "RGXD1|label|example|1|100|0|0|%ED%A0%80", "RGXD1|label|example|1|100|0|0|%00",
    "RGXD1|label|example|1|100|0|0|%GG", "RGXD1|label|example|1|100|0|0|%41|extra",
    "RGXD1|script|example|1|100|0|0|", "RGXD1|label|example|1|100|501|0|",
    "RGXD1|label|example|1|301|0|0|", "RGXD1|label|bad id|1|100|0|0|"];
  const clean = exportDefinition(exampleDefinition);
  for (const wire of malformed) {
    const external = createDefinitionSession(exampleDefinition);
    assert.throws(() => external.import(wire));
    assert.equal(external.export(), clean);
    assert.equal(lua.doStringSync(`
      local s = assert(UI:CreateDefinitionSession(assert(UI:ImportDefinition(${quote(clean)}))))
      assert(s:Import(${quote(wire)}) == nil)
      return assert(s:Export())
    `), clean);
    checks++;
  }
  const external = createDefinitionSession(exampleDefinition, () => false);
  external.patch({ enabled: false });
  assert.throws(() => external.save());
  assert.equal(external.getDefinition().enabled, true);
  external.cancel();
  assert.equal(external.getDraft().enabled, true);
  assert.equal(lua.doStringSync(`
    local initial = assert(UI:ImportDefinition(${quote(clean)}))
    local s = assert(UI:CreateDefinitionSession(initial, function() error("persistence failure") end))
    assert(s:Patch({ enabled = false }))
    assert(s:Save() == nil)
    assert(s:GetDefinition().enabled == true)
    assert(s:Cancel().enabled == true)
    assert(s:Patch({ version = 2 }) == nil)
    assert(s:GetDraft().version == 1)
    __deniedTable = setmetatable({}, { __index = function() error("denied table indexed") end })
    assert(UI:NormalizeDefinition(__deniedTable) == nil)
    __deniedValue = {}
    initial.text = __deniedValue
    assert(UI:NormalizeDefinition(initial) == nil)
    return true
  `), true);
  checks++;
  let accessorRead = false;
  const accessor = { ...exampleDefinition };
  Object.defineProperty(accessor, "text", { get() { accessorRead = true; throw new Error("getter must stay unopened"); } });
  assert.throws(() => normalizeDefinition(accessor));
  assert.equal(accessorRead, false);
  // Execute the real Lua visual adapter against explicit widget seams. This
  // exercises user edits and buttons, not real WoW geometry/taint.
  assert.equal(lua.doStringSync(`
    local frames, buttons = {}, {}
    local function widget(kind, parent)
      local w = { kind = kind, parent = parent, scripts = {} }
      for _, method in ipairs({ "SetSize", "SetPoint", "SetAutoFocus", "ClearFocus", "ClearAllPoints", "SetScale", "Show", "Hide" }) do
        w[method] = function() end
      end
      function w:SetScript(name, fn) self.scripts[name] = fn end
      function w:SetText(text) self.text = text; if self.scripts.OnTextChanged then self.scripts.OnTextChanged(self, false) end end
      function w:GetText() return self.text end
      function w:SetChecked(value) self.checked = value end
      frames[#frames + 1] = w
      return w
    end
    CreateFrame = function(kind, _, parent) return widget(kind, parent) end
    UI.CreateLabel = function(_, parent) return widget("label", parent) end
    UI.CreateSection = function(_, parent) local w = widget("section", parent); w.content = widget("content", w); return w end
    UI.CreateScrollPage = function(_, parent) return widget("canvas", parent), widget("viewport", parent) end
    UI.CreateToggle = function(_, parent, opts) local w = widget("toggle", parent); w.check = widget("check", w); w.onChange = opts.onChange; return w end
    UI.CreateButton = function(_, parent, opts) local w = widget("button", parent); buttons[opts.text] = opts.onClick; return w end
    local saved
    local editor = assert(UI:CreateDefinitionEditor(widget("parent"), {
      definition = assert(UI:ImportDefinition(${quote(clean)})), onSave = function(d) saved = d end,
    }))
    local inputs, toggle = {}, nil
    for _, w in ipairs(frames) do
      if w.kind == "EditBox" and w.parent == editor then inputs[#inputs + 1] = w end
      if w.kind == "toggle" then toggle = w end
    end
    local function edit(w, value) w:SetText(value); w.scripts.OnTextChanged(w, true) end
    edit(inputs[1], "draft")
    edit(inputs[2], "-")
    buttons.Save()
    assert(saved == nil, "invalid visible field must block Save")
    buttons.Cancel()
    assert(inputs[1]:GetText() == "Hello RGX")
    edit(inputs[1], "saved in-game")
    toggle.onChange(false)
    buttons.Save()
    assert(saved.text == "saved in-game" and saved.enabled == false)
    edit(inputs[1], "unsaved")
    editor.scripts.OnHide()
    assert(editor.session:GetDraft().text == "saved in-game")
    inputs[5]:SetText(${quote(clean)})
    buttons.Import()
    assert(editor.session:GetDraft().text == "Hello RGX")
    buttons.Export()
    assert(inputs[5]:GetText() == ${quote(clean)})
    return true
  `), true);
  checks++;
} finally { lua.global.close(); }
const server = createEditorServer();
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const path of ["/", "/contract/engine/definition.mjs", "/contract/schemas/rgx-definition.schema.json"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200); assert((await response.text()).length > 0);
    checks++;
  }
  assert.equal((await fetch(base + "/not-allowlisted")).status, 404);
  assert.equal((await fetch(base, { method: "POST" })).status, 405);
} finally { await new Promise(resolve => server.close(resolve)); }
console.log(`DEFINITION ROUND TRIP OK  ${checks} cross-language/schema/session/widget/server scenarios; browser/WoW visual checks remain manual`);
