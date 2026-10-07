# Simpler authoring, one shared contract

**Status: design proposal, not shipped or frozen syntax.**
Canonical review: [Framework #67](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/work_items/67).

## Outcome

An author should describe an aura or UI element without constructing a tree of
Lua tables. A visual editor should make the same definition editable through
widgets. The public interface, SDK, generator, validator and MCP should all
represent the same behavior.

This re-evaluates the author-facing form in [SUPER-SIMPLE.md](SUPER-SIMPLE.md).
It does not replace current calls or authorize a complete aura engine, a new
runtime subsystem, or Studio implementation.

## Verified baseline

- `RGXAddon "Name" { ... }` is the current declarative front door.
- [One-line control strings](DECLARATIVE-API.md#one-line-control-strings-shipped)
  already compile into the existing table-form controls. This is the baseline
  to extend, rather than inventing an unrelated authoring language.
- The current definition schema, `contract/schemas/rgx-definition.schema.json`,
  accepts **version-1 labels only**. Its editor/session round trip provides a
  real baseline for save, draft, patch, import and export.
- [The existing layout](DECLARATIVE-API.md#layout-model) and display-positioning
  primitives retain geometry ownership. An authoring extension describes their
  use; it does not add another layout or persistence implementation.
- Trigger -> Conditions -> Display -> Actions -> Load is the RGXMod direction,
  not a fully implemented definition contract.

Nested tables are useful as explicit structured data and an advanced escape
hatch. They need not be the normal human editing form. Removing punctuation
alone is insufficient: defaults, identity and the number of concepts an author
must understand also need to become simpler.

## Recommended direction

Extend the established line-form vocabulary. Keep one canonical, versioned
definition underneath the text and visual authoring views.

The examples below are **authoring sketches, not executable Lua or accepted
current schema input**. Spell 17 illustrates a player buff; the proposed grammar
and defaults require review before implementation.

### Bare aura form

```text
buff 17
```

Possible defaults: watch the player, display an icon when the buff is verifiably
present, resolve its icon through the framework, and show duration when the
client exposes trustworthy duration data. A human-readable name can be derived
for display. Persistent identity is assigned once and retained; it must not
change when the caption, spelling or placement changes.

Defaults must be documented and inspectable through the contract. Unavailable
or restricted data stays unknown; it is not silently converted into absence,
readiness or zero duration.

### Add only the requested detail

```text
aura "Shield"
  buff 17
  glow when remaining < 5s
  load priest combat
```

The author should not need five empty sections or repeated icon/spell/unit
declarations. Internally this still has trigger, condition, display, action and
load ownership. Those are useful editor sections, not compulsory source nesting.

The meanings of `remaining`, `glow` and `load` are proposed, not implemented by
this document. Conditions require trusted values and each operation needs a
verified owning framework primitive before becoming authorable.

### UI elements use the same progressive disclosure

```text
element "Quest title"
  text "Quest progress"
  font 16
  color primary
  position top 8
```

This is an authoring sketch for an RGX-owned text element, not an options panel
control or a promise of arbitrary Blizzard frame editing. Defaults provide the
font family, anchor, appearance and lifecycle. The author specifies exceptions.
Existing theme/palette meanings remain distinct and must be resolved by the
owning contract; concise syntax must not silently change what `primary` means.

Existing controls such as `toggle`, `slider`, `color` and `font` remain the
starting vocabulary for configuration widgets. A simpler future form may infer
values already inferred by table controls; current string sliders still require
their explicit range. The proposal does not make `"slider volume"` valid today.

### Placement uses the shipped position vocabulary

Placement composes from the position names and offsets the shipped
[Display](API.md) module already owns, rather than adding a second geometry
grammar:

```text
element "Quest title"
  text "Quest progress"
  font 16
  color primary
  position top 8
```

`position top 8` reads as the shipped `position = "TOP"` with `spread = 8`:
a built-in or registered position name plus an optional offset along its
axis. When a named position does not fit, the explicit spec stays in the
same vocabulary:

```text
element "Quest title"
  position center relative top offset 0 120
```

This is the inline position spec the Display module already accepts
(`point`, `relativePoint`, `x`, `y`), so text, editor and runtime resolve to
one meaning rather than three placement systems.

Placement properties that are already shipped and must carry over unchanged:

- Stable identity comes from the definition name, not the position. Moving
  an element never creates a new element or resets another element's offset.
- Dragged offsets persist durably (`RGXFrameworkDB.RGXDisplayPositions`,
  mirrored into consumer storage); the durable store wins on creation.
- Edit mode is the existing drag-mover baseline; an editor's move interaction
  patches the same canonical draft rather than adding another interaction
  layer.
- Anchoring into Blizzard-owned frames stays a capability decision per frame.
  The concise form describes RGX-owned elements; it does not promise
  arbitrary protected-frame editing.
- `position` expresses geometry only. Theme and palette words such as
  `primary` keep their owning contract's meaning.

No placement spelling is frozen here; the shipped Display module remains the
single geometry owner until a reviewed contract change says otherwise.

## Visual editing is a first-class authoring view

Selecting a definition exposes relevant controls, not a raw table:

| Editor view | Examples |
| --- | --- |
| Trigger | Buff/spell selection, unit, presence mode |
| Conditions | Field, supported comparison, threshold, effect |
| Display | Icon/text/bar, position, size, font, color, supported effects |
| Actions | Scoped supported action references and parameters |
| Load | Applicable class, combat and other verified capabilities |

Moving an element, choosing a hex color, or changing its trigger patches the
same canonical draft. Save/import/export use the existing definition/session
baseline. A committed edit must restore visibly as well as persist.

The editor should disclose advanced sections only when needed. An aura and a
standalone UI element can share applicable display fields without pretending
they have identical trigger or control semantics.

Text -> definition -> editor -> definition -> text must preserve semantic
meaning and stable identity. Existing advanced data must survive edits; an
unsupported field must be surfaced rather than dropped. The exact representation
of comments and formatting is an open authoring decision, not a runtime concern.

## Public interface, MCP and SDK commitments

```text
Human text             Visual editor             SDK / tools
       \                    |                    /
          canonical versioned definition contract
                    /                   \
       framework Lua runtime       shared authoring engine
                                         |
                               generator / validator / MCP
```

These are commitments for any accepted extension:

1. **One vocabulary and meaning.** Concise text compiles into the same definition
   that a visual editor or typed SDK creates. Existing table forms retain their
   semantics. An agent uses the forms a human can use.
2. **One validation contract.** Schema, normalization, defaults, error locations,
   supported operations and availability agree across runtime and tooling.
   Lua and JavaScript implementations remain congruent through shared vectors;
   WoW never depends on the JavaScript engine.
3. **A small public interface.** Registration, draft editing and lifecycle use
   existing owners where they fit. This proposal does not choose a new public
   `Aura`, `Define` or registration method before checking those seams.
4. **MCP is an adapter.** Validation, generation, patching and export expose
   framework-owned semantics. An MCP-only key or capability is contract drift.
5. **SDK is the complete authoring experience.** Runtime calls, types, schema,
   docs, generation, validation and editor support compose it. No second runtime
   layer or speculative `sdk/` subsystem is implied.
6. **Honest availability.** Unsupported clients, restricted data and missing
   preview evidence remain explicit. Current catalog review gates and
   `authorable`/preview declarations are not flipped by a design document.
7. **Inspectable defaults.** Authors and tools can see the fully normalized
   result and explain why an inferred value was selected.

## Implementation rails if the direction is accepted

1. Freeze the smallest reviewed grammar/defaults and identify a current consumer
   plus reusable RGXMod benefit. Design sketches alone do not justify a module.
2. Extend the current definition/session and line-form baselines; choose the
   appropriate versioning without changing version-1 label semantics.
3. Trace runtime, schema, contract engine, catalog, docs, generator, validator,
   MCP, SDK/editor consumers and RGX-Hello together.
4. Ship a narrow end-to-end slice with identical text/editor/runtime meaning.
5. Verify malformed input, defaults, stable identity, independent drafts,
   callback isolation, unknown/restricted states and semantic round trips.
6. Add applicable client evidence before declaring rendering, combat behavior or
   preview availability verified.

## Decisions still requiring review

- Is the normal authoring form embedded line text, editor-first definitions, or
  both views of the same definition? WoW cannot load arbitrary source text files;
  an embedded form or generated Lua package must define the runtime path.
- Which defaults are safe and genuinely simplify a bare form?
- What is the first accepted definition kind beyond labels, and which current
  consumer exercises it?
- How should a text author discover and retain persistent IDs without clutter?
- Which advanced expressions/actions remain structured or imperative escape
  hatches, and how do tools preserve them without executing imported Lua?

The examples establish a direction for review. They do not freeze spelling,
introduce a competing language, or promise support before these decisions and
their affected contract layers are resolved.
