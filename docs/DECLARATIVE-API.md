# Declarative API — `RGXAddon`

The authoring surface and human-readable **Simplicity Contract** for RGX addons.
Evolution is additive-only: what you write today keeps working forever. The
machine-checkable shape lives in
[`schemas/rgx-addon.schema.json`](https://github.com/RGXMods/RGX-Framework/blob/main/schemas/rgx-addon.schema.json); keys are
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

An addon name can be declared only once. A duplicate `RGXAddon` call is rejected
before slash commands, events, timers, or registry entries can be replaced or
leaked.

## The rule: bare forms assume, advanced forms unlock

Every key works bare with assumed arguments, and accepts an advanced form when
you need more — one vocabulary, no second API. `minimap = true` assumes an
icon, a left-click that opens your panel, and angle persistence to `addon.db`;
`minimap = { icon = ..., onRightClick = ... }` unlocks the rest. If you find
yourself needing an argument the bare form should have assumed, that is a
framework bug — report it.

## Options table — shipped keys

| Key | Bare form | Advanced form |
|---|---|---|
| `slash` | string \| string[] — registers `/cmd`; assumed handler opens the options panel | same table + `handler = function(addon, msg)` |
| `minimap` | `true` (default icon) \| string (icon path) — assumed left-click opens the panel; dragged angle persists to `addon.db` | full opts table passed through to the minimap module (`tooltip`, `defaultAngle`, `onRightClick`, `onCtrlRight`, ...) |
| `db` | table of profile defaults; creates `addon.db` on ADDON_LOADED. SavedVariables name assumes `<Name>DB` with non-identifier characters stripped (`"RGX-Hello"` → `RGXHelloDB`) — declare it in your TOC | `dbName` overrides the name; `global` (cross-character), `onSwitch` (profile-switch callback) |
| `options` | `TabName = { controls... }`; requires `db`; builds a tabbed panel with db-bound controls (automatic save **and** restore) | per-control advanced keys below; Tier 4 adds `columns` and multi-page tabs |
| `title` | — | Panel title; assumes the addon name |
| `welcome` | startup string printed with the framework icon and `[RGX]` prefix on load; obeys the global `/rgx login on|off` preference | — |
| `onInit` | function(addon), runs on ADDON_LOADED after `db`/`options` exist — the imperative escape hatch | — |
| `every` | `name = { seconds, function(addon, timer) }`; starts after ADDON_LOADED and first fires after the interval | multiple deterministically named repeating timers; handlers may self-cancel with `addon:CancelTimer(timer)` |
| `brand` | — | Hex color (no `#`) for the chat prefix; assumes `58be81` |
| `table` | — | Use an existing table as the addon object |

## Named repeating timers

```lua
RGXAddon "MyAddon" {
    every = {
        heartbeat = { 1, function(self, timer)
            self.ticks = (self.ticks or 0) + 1
            if self.ticks == 3 then
                self:CancelTimer(timer)
            end
        end },
        ["cache.refresh"] = { 30, function(self)
            self.cacheRefreshes = (self.cacheRefreshes or 0) + 1
        end },
    },
}
```

Each entry is exactly `{ seconds, handler }`: the interval must be a finite
number greater than zero, and the name must be printable and contain at least
one non-space character.
The complete declaration is validated before the addon registers any resource.

Timers are created after the addon's matching `ADDON_LOADED`, once its database,
options panel, and minimap button exist. The first run occurs after one full
interval; there is no immediate call. Handlers receive the addon object followed
by the timer reference.

Names are sorted for deterministic same-update dispatch within one declaration
and become diagnostic labels such as `MyAddon:every:cache.refresh`. Timer refs
carry `owner`, `name`, and `declarativeName` metadata. One handler error is
reported with its stable label and does not stop unrelated timers; a failing
repeating timer remains active. Timers do not imply combat safety, so protected
UI work must still use RGX's safe helpers.

## Controls (table forms, shipped)

```lua
{ section = "Header Text" }
{ toggle = "dbKey", label = "Label", default = true }
{ slider = "dbKey", label = "Label", min = 0, max = 100, step = 1, suffix = "%" }
{ color = "dbKey", label = "Label", default = { r = 1, g = 1, b = 1 } }
{ dropdown = "dbKey", label = "Label", items = { "a", "b" }, width = 260 }
{ button = "Button Text", action = function() ... end, width = 120, height = 22 }
```

Only the db key is required — labels assume the capitalized key, slider range
assumes 0–100, color default assumes the db default for that key. Every
control reads its initial state from `addon.db` and writes changes back —
persistence *and visual restore* are not the author's job.

## Layout model

One composable vocabulary, top to bottom (proven in BLU): **panel → main page
+ tabs → tabs can be multi-paged → 1–2 column card grid → rows/cards holding
the widgets**. What ships today is panel → tabs → a single column of controls;
Tier 4 implements the rest of the hierarchy (`columns = 1|2|3` — 1–2 is the
BLU-proven range — and multi-page tabs) without changing anything you write
today.

## The addon object

Returned by `RGXAddon`. Everything is scoped to the addon (auto-generated
handler ids) and routed through framework-managed, failure-isolated paths:

| Method | Notes |
|---|---|
| `addon:Print(msg)` / `Warn(msg)` / `Error(msg)` | Branded chat output |
| `addon:RegisterEvent(event, fn, id?)` / `UnregisterEvent(event, id?)` | Scoped WoW events |
| `addon:RegisterUnitEvent(event, unit, fn, id?)` / `UnregisterUnitEvent(event, id?)` | Scoped unit events |
| `addon:RegisterMessage(msg, fn, id?)` / `UnregisterMessage` / `SendMessage` (`Emit`) | Internal message bus |
| `addon:After(sec, fn)` / `Every(sec, fn)` / `CancelTimer(t)` | Framework timers; returned refs carry `owner = addon` |
| `addon.db` | The database proxy (after ADDON_LOADED) — see API.md → Database & Profiles |
| `addon.panel` | The options panel (when `options` was given); `addon.panel:Open()` |

## Coming in Tier 4 (frozen contract)

- `on = { levelup = fn, ["quest.turnin"] = fn, ... }` — human trigger words, never WoW event names
- One-line control strings: `"toggle enabled"`, `"slider volume 0-100"`
- `options.columns = 1|2|3` — card-grid layouts
- Inference: `slash` defaults to the lowercase addon name

Everything above is additive; nothing on this page changes meaning.
