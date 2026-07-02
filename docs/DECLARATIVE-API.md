# Declarative API — `RGXAddon`

The authoring surface for RGX addons. Governed by **THE SIMPLICITY CONTRACT**
(`docs/DECLARATIVE-DSL.md`, `dsl` branch): evolution is additive-only — what
you write today keeps working forever. The machine-checkable shape lives in
[`schemas/rgx-addon.schema.json`](../schemas/rgx-addon.schema.json); keys are
annotated `x-rgx-ships: "today"` (implemented) or `"tier4"` (frozen target).

This page documents **what ships today**, verified against
`core/core.lua` (`RGX.Addon`, `_G.RGXAddon`).

---

## Entry point

```lua
RGXAddon("MyAddon", { ... })
RGXAddon "MyAddon" { ... }     -- curried form; identical
```

`RGXAddon` is a global the framework provides — `## RequiredDeps:
RGX-Framework` guarantees it exists before your file runs. Returns the addon
object. `local RGX = assert(_G.RGXFramework, ...)` remains available as the
escape hatch for à la carte use; it is not the front door.

## Options table — shipped keys

| Key | Type | Behavior |
|---|---|---|
| `slash` | string \| string[] | Registers `/cmd`; default handler opens the options panel |
| `minimap` | true \| string | Minimap button; `true` = default icon, string = icon path |
| `db` | table | Profile defaults; creates `addon.db` (a `RGX:NewDatabase` proxy) on ADDON_LOADED. SavedVariables name defaults to `<Name>DB` — declare it in your TOC |
| `dbName` | string | Override the SavedVariables name |
| `global` | boolean | Passed to `NewDatabase` (cross-character storage) |
| `onSwitch` | function | Profile-switch callback, passed to `NewDatabase` |
| `options` | table | `TabName = { controls... }`; requires `db`; builds a tabbed panel with db-bound controls (automatic save **and** restore) |
| `title` | string | Panel title; defaults to the addon name |
| `welcome` | string | Printed with the branded prefix on load |
| `onInit` | function(addon) | Runs on ADDON_LOADED after `db`/`options` exist — the imperative escape hatch |
| `brand` | string | Hex color (no `#`) for the chat prefix; default `58be81` |
| `table` | table | Use an existing table as the addon object |

## Controls (table forms, shipped)

```lua
{ section = "Header Text" }
{ toggle = "dbKey", label = "Label", default = true }
{ slider = "dbKey", label = "Label", min = 0, max = 100, step = 1 }
{ dropdown = "dbKey", label = "Label", items = { "a", "b" }, width = 260 }
{ button = "Button Text", action = function() ... end, width = 120, height = 22 }
```

Labels default to the capitalized key. Every control reads its initial state
from `addon.db` and writes changes back — persistence is not the author's job.

## The addon object

Returned by `RGXAddon`. Everything is scoped to the addon (auto-generated
handler ids) and routed through the framework's taint-safe paths:

| Method | Notes |
|---|---|
| `addon:Print(msg)` / `Warn(msg)` / `Error(msg)` | Branded chat output |
| `addon:RegisterEvent(event, fn, id?)` / `UnregisterEvent(event, id?)` | Scoped WoW events |
| `addon:RegisterUnitEvent(event, unit, fn, id?)` / `UnregisterUnitEvent(event, id?)` | Scoped unit events |
| `addon:RegisterMessage(msg, fn, id?)` / `UnregisterMessage` / `SendMessage` (`Emit`) | Internal message bus |
| `addon:After(sec, fn)` / `Every(sec, fn)` / `CancelTimer(t)` | Framework timers |
| `addon.db` | The database proxy (after ADDON_LOADED) — see API.md → Database & Profiles |
| `addon.panel` | The options panel (when `options` was given); `addon.panel:Open()` |

## Coming in Tier 4 (frozen contract — see DECLARATIVE-DSL.md)

- `on = { levelup = fn, ["quest.turnin"] = fn, ... }` — human trigger words, never WoW event names
- `every = { scan = { 30, fn } }` — named repeating timers
- One-line control strings: `"toggle enabled"`, `"slider volume 0-100"`
- `options.columns = 1|2|3` — card-grid layouts
- Inference: `slash` defaults to the lowercase addon name

Everything above is additive; nothing on this page changes meaning.
