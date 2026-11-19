# Declarative API


The authoring surface and human-readable **Simplicity Contract** for RGX addons.
Evolution is additive-only: what you write today keeps working forever. The
machine-checkable shape lives in
[`contract/schemas/rgx-addon.schema.json`](https://github.com/RGXMods/RGX-Framework/blob/main/contract/schemas/rgx-addon.schema.json); keys are
annotated `x-rgx-ships: "today"` (implemented) or `"tier4"` (frozen target).

This page describes supported forms against `core/core.lua`
(`RGX.Addon`, `_G.RGXAddon`). Core validates the grammar and owns the lifecycle;
`libraries/ui/options.lua` builds tabs and controls lazily. Malformed one-line
strings are rejected before registration, signed slider ranges are preserved,
method buttons bind to their addon, and fonts use the bound selector.
`options.columns` lays out column flows; `page` nodes author multi-page tabs
and card grids.

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
| `db` | table of profile defaults; creates `addon.db` on ADDON_LOADED. SavedVariables name assumes `<Name>DB` with non-identifier characters stripped (`"RGX-Hello"` → `RGXHelloDB`) — declare it in your TOC | `dbName` overrides the name; `global` (cross-character), `onSwitch` (profile-switch callback); `legacyFlat = true` adopts an existing flat SavedVariables table into the Default profile once, so an addon moving onto `db` keeps its players' settings (a table that already holds both flat keys and profiles has its flat keys applied to the active profile, once; the old keys stay recoverable) |
| `compat` | `name = "Global.API.Path"` or `name = { "Preferred.Path", "FallbackPath" }` — the first callable path on the current client becomes `addon.compat.name(...)` | same names with `{ prefer = "...", fallback = "...", normalize = function(...) }`; `normalize` receives the raw return values |
| `options` | `TabName = { controls... }`; requires `db`; builds a tabbed panel with db-bound controls (automatic save **and** restore) | per-control advanced keys below; local `columns = 1\|2\|3` distributes plain control lists into column flows; `page` nodes author multi-page tabs and 1–2 column card grids |
| `title` | — | Panel title; assumes the addon name |
| `welcome` | startup string printed with the framework icon and `[RGX]` prefix on load; obeys the global `/rgxf login on|off` preference | — |
| `onInit` | function(addon), runs on ADDON_LOADED after `db`/`options` exist — the imperative escape hatch | — |
| `every` | `name = { seconds, function(addon, timer) }`; starts after ADDON_LOADED and first fires after the interval | multiple deterministically named repeating timers; handlers may self-cancel with `addon:CancelTimer(timer)` |
| `on` | `trigger = function(addon, ...)` with a trigger word from the table below; bound after ADDON_LOADED | any UPPER_CASE key subscribes to that raw WoW event |
| `brand` | — | Hex color (no `#`) for the chat prefix; also themes the options panel (tab/header accents). Assumes `58be81` |
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

## Triggers

```lua
RGXAddon "MyAddon" {
    on = {
        login = function(self) self:Print("ready") end,
        ["quest.turnin"] = function(self, ...) end,
        PLAYER_REGEN_DISABLED = function(self) end, -- raw event escape hatch
    },
}
```

Trigger words are plain words. Each one maps to exactly one framework module
callback, so a handler gets the same arguments that module passes to its
`On*` subscribers, after the addon object:

| Words | Module |
|---|---|
| `login` | Runs once after login; immediately (next frame) when the addon loads after login |
| `levelup` | levelup |
| `achievement`, `achievement.criteria` | achievement |
| `quest.accepted`, `quest.complete`, `quest.turnin`, `quest.progress` | quest |
| `combat.start`, `combat.stop`, `combat.kill`, `combat.died`, `combat.crit`, `combat.lowhealth` | combat |
| `aura.applied`, `aura.removed`, `aura.updated` | auras |
| `loot.rare`, `loot.currency` | loot |
| `collect.mount`, `collect.toy`, `collect.transmog`, `collect.heirloom` | collectibles |
| `rep.gain`, `rep.rankup`, `rep.renown` | reputation |
| `honor` | honor |
| `pet.levelup`, `pet.capture`, `pet.battlestart`, `pet.battleend` | petbattles |
| `delve.companion`, `delve.lifelost`, `delve.lifegained` | delves |
| `housing.favor`, `housing.levelup`, `housing.rewards`, `housing.decor` | housing |
| `prey.start`, `prey.ambush`, `prey.capped`, `prey.complete` | prey |
| `tradingpost.purchase`, `tradingpost.currency` | tradingpost |
| `media.updated` | Shared media registry changed |

The whole declaration is validated before the addon registers anything: an
unknown word or a non-function handler is a load error, never a silent no-op.
A word whose module the current client does not load is skipped with a debug
note, so one declaration stays valid on every client. One failing handler is
reported to the game's error handler as `[MyAddon] on.<trigger>: <error>`
and does not stop the others.

## Declarative compatibility shims

```lua
RGXAddon "MyAddon" {
    compat = {
        GetAvailableQuests = {
            prefer = "C_GossipInfo.GetAvailableQuests",
            fallback = "GetGossipAvailableQuests",
            normalize = function(...)
                local title, questID, isTrivial = ...
                return { title = title, questID = questID, trivial = isTrivial }
            end,
        },
        GetCoinText = { "C_CurrencyInfo.GetCoinText", "GetCoinText" },
    },
}
```

Each entry names one or more global API paths. The first callable path on the
current client wins and becomes `addon.compat.<name>(...)`. `normalize`, when
present, receives the raw return values and can repack them into the shape the
addon wants. The complete declaration is resolved before the addon registers:
if no listed path is callable, the declaration fails instead of shipping a
dead call site. This is the declarative form of the load-time compatibility
tables large multi-version addons otherwise hand-write.

## Controls (table forms, shipped)

```lua
{ section = "Header Text" }
{ toggle = "dbKey", label = "Label", default = true }
{ slider = "dbKey", label = "Label", min = 0, max = 100, step = 1, suffix = "%" }
{ slider = "dbKey", valueDisplay = "hover", progress = false }
{ panel_alpha = "dbKey", label = "Label", default = 100, presets = { { label = "Low", value = 25 } } }
{ textbox = "dbKey", label = "Label", default = "", placeholder = "Hint" }
{ color = "dbKey", label = "Label", default = { r = 1, g = 1, b = 1 } }
{ dropdown = "dbKey", label = "Label", items = { "a", "b" }, width = 260 }
{ button = "Button Text", action = function() ... end, width = 120, height = 22 }
```

Every value control (`toggle`, `slider`, `panel_alpha`, `textbox`, `color`, `dropdown`) also takes
`onChange = function(addon, value) ... end`. It runs after the new value is stored in `addon.db`, so a
handler reads the final state, and a failing handler is reported to the game's error handler instead of
breaking the widget. Use it for effects that must happen the moment a setting flips (hiding a frame,
showing a button) without watching the database.

```lua
{ toggle = "enabled", label = "Remove debuffs",
  onChange = function(self, on) if on then self:HideAll() else self:RestoreAll() end end },
```

Toggle controls render the canonical `UI:CreateSwitch` on/off element (the
same widget consumer settings pages use), so no per-addon switch styling or
plumbing is required.

### One-line control strings (shipped)

Strings compile to the same table forms:

```lua
options = {
    General = {
        "header 'Settings'",
        "toggle enabled 'Enable Addon'",
        "slider volume 0-100 'Volume'",
        "textbox keyword 'Keyword'",
        "panel_alpha overlay 'Panel Opacity'",
        "dropdown quality low|high 'Quality'",
        "color alertColor 'Alert Color'",
        "font titleFont 'Title Font'",
        "button 'Reset All' ResetSettings",
        "label 'Notes:'",
    },
}
```

The supported grammar is case-sensitive. Keys contain no ASCII whitespace or
quotes; labels use single quotes. ASCII whitespace separates tokens and may
trail the declaration. Sliders require a signed-decimal `min-max` range
(for example `-10--5`), optional positive step, and optional label. Bounds and
step must be finite; reversed bounds and non-positive steps are rejected.
Textboxes bind a string db key with an optional label; an empty commit falls
back to the table form's `default`.
Panel-transparency rows bind a 0-100 numeric key to the shipped
`UI:CreatePanelAlpha` slider; optional `presets` are `{ label, value }`
entries whose values must also be 0-100.
Dropdown items use `|` separators without empty entries. Headers/labels require
quoted text, and button methods must be Lua identifiers.

Strings supplied at declaration raise a deterministic `RGXAddon` error when malformed, before the addon,
slash command or load callback is registered. The shared engine enforces the
same grammar and numeric rules; JSON Schema checks shape and lexical grammar,
while cross-value numeric constraints require the engine or runtime.

### Column flows (local implementation)

```lua
options = {
    columns = 2,
    General = {
        { toggle = "enabled", label = "Enable Addon" },
        { slider = "volume", label = "Volume", min = 0, max = 100 },
        { toggle = "verbose", label = "Verbose" },
        { slider = "scale", label = "Scale", min = 0.5, max = 2 },
    },
}
```

`columns = 1|2|3` lays every tab out in that many column flows (default 1,
today's single column). Controls fill down each column in declaration order,
balanced so related controls stay adjacent. Anything else is rejected before
the addon registers. The reserved `columns` key is never treated as a tab.

`font` delegates to `Fonts:AttachFontSelector`, including name resolution and
DB-bound restoration when shown. `header`/`label` render the section-style text
row. Profile changes refresh the lazy options panel against its current storage.

For table-form bound controls, only the db key is required — labels assume the
capitalized key, slider range assumes 0–100, color default assumes the db default
for that key. String sliders require their explicit range. Every
control reads its initial state from `addon.db` and writes changes back —
persistence *and visual restore* are not the author's job.

Slider `valueDisplay` is `"always"` (default), `"hover"`, or `"none"`.
`progress = false` removes the running fill without changing the stored value.
These table-form customizations are shared with `UI:CreateSlider`.

### Section

`{ section = "Header Text" }` renders a text header inside a scrollable page. Tabs are
laid out by the framework's scroll page + flow layout: controls render in
declaration order, nothing overlaps, and the page scrolls when it is taller
than the panel.

### Button

`{ button = "Button Text", action = function(frame, mouseButton) ... end, width, height }`
hooks `action` straight into a click handler through `UI:CreateButton`'s
table form. The handler is pcall-isolated and cannot break the panel.

Existing table control lists remain live for imperative additions/replacements
in `onInit` before lazy construction. Strings added later are validated when
rendered; use declaration-time strings for early, registration-free rejection.

The string form `"button 'Reset All' ResetSettings"` resolves `ResetSettings`
on the owning addon at click time and calls it with that addon as `self`.
The method may be assigned in `onInit`; a missing method reports an error
through the existing isolated button callback. Table-form callback arguments
remain unchanged.

### Layout model

One composable vocabulary, top to bottom: **panel → tabs → pages → 1–2 column
card grid → cards → controls**.

Plain tabs keep the original control-list form. A tab that uses pages contains
only page nodes:

```lua
options = {
    General = {
        {
            page = "Basics",
            grid = 2,
            cards = {
                {
                    card = "Display",
                    columns = 2,
                    controls = {
                        { toggle = "enabled", label = "Enable Addon" },
                        { slider = "scale", label = "Scale", min = 50, max = 150 },
                    },
                },
                {
                    card = "Audio",
                    controls = { { slider = "volume", min = 0, max = 100 } },
                },
            },
        },
        {
            page = "Advanced",
            cards = {
                { card = "Profiles", controls = { { textbox = "profileNote" } } },
            },
        },
    },
}
```

- `page` is the page title. A tab may not mix page nodes with plain controls.
- `grid` is the page card-grid column count (`1` or `2`, default `1`); cards fill
  the grid in declaration order, balanced like `options.columns`.
- `card` is the card title. `columns` is the card's internal control column count
  (`1` or `2`, default `1`); controls fill the card in declaration order.
- Cards and controls use the same db-bound factories as plain tabs, so reopening
  a panel or changing profiles restores values and displayed control state.
- `options.columns` still means the plain control-list column flow. It cannot be
  combined with page nodes.
- Layout declarations are validated before the addon registers; an invalid page,
  card, grid, column count, nested layout, or control string fails without
  creating the addon, its load handler, or its panel.

The implementation renders these nodes over the existing imperative primitives:
`CreateScrollPage`, `CreateColumns`, `CreatePager`, `CreateCard`, and
`CreateFlowLayout`. No second layout engine exists.

## The addon object

Returned by `RGXAddon`. Everything is scoped to the addon (auto-generated
handler ids, one per callback: two handlers for one event both run, and the same callback registered again
replaces itself) and routed through framework-managed, failure-isolated paths:

| Method | Notes |
|---|---|
| `addon:Print(msg)` / `Warn(msg)` / `Error(msg)` | Branded chat output |
| `addon:RegisterEvent(event, fn, id?)` / `UnregisterEvent(event, id?)` | Scoped WoW events |
| `addon:RegisterUnitEvent(event, unit, fn, id?)` / `UnregisterUnitEvent(event, id?)` | Scoped unit events |
| `addon:RegisterMessage(msg, fn, id?)` / `UnregisterMessage` / `SendMessage` (`Emit`) | Internal message bus |
| `addon:After(sec, fn)` / `Every(sec, fn)` / `CancelTimer(t)` | Framework timers; returned refs carry `owner = addon` |
| `addon.db` | The database proxy (after ADDON_LOADED) — see API.md → Database & Profiles |
| `addon.panel` | The options panel (when `options` was given); `addon.panel:Open()` |

## Contract compatibility handshake

A declarative addon is authored against a **contract format**, not a
framework version. Formats are additive — format `N` includes every lower
format — and the number lives in `RGX.CONTRACT_FORMAT_VERSION`
(currently `1`), independent of either project's release numbers.

The framework answers two questions without ever erroring:

| API | Behavior |
|---|---|
| `RGX:SupportsContract(format)` | `true` when this framework can consume that contract format; `false` for nil, non-integer, sub-1, or future formats |
| `RGX:CompareVersions(a, b)` | `-1`/`0`/`1` for dotted versions (`"2.10.0"` > `"2.9.0"`, `"v2.9"` == `"2.9.0"`, prerelease sorts first); `nil` when either side cannot be parsed |

Generated addons start with a **handshake guard** before their first
contract call:

```lua
local RGX = _G.RGXFramework
if type(RGX) ~= "table" or type(RGX.RequireContract) ~= "function" then
    error("MyAddon requires RGX-Framework 2.9.0 or newer with the RGX contract compatibility handshake. Update RGX-Framework.", 0)
end
RGX:RequireContract("MyAddon", 1, "2.9.0")
```

`RGX:RequireContract(name, format, minFrameworkVersion)` returns `true` or
errors with one clear message — an old framework fails loudly at load
instead of silently ignoring behavior. Hand-written consumers may call the
same guard; `RGXAddon` itself needs no wrapper beyond it.

### Generated TOC provenance

The generators also record what they produced in custom TOC fields:

| TOC field | Meaning |
|---|---|
| `## X-RGX-Contract-Format: 1` | Contract format the file was generated against |
| `## X-RGX-Framework-MinVersion: 2.9.0` | Minimum framework for the features actually used (the engine computes this floor; an explicit `frameworkMinVersion` spec field raises it) |

These fields are **provenance** for humans and tooling. The real
dependency remains `## RequiredDeps: RGX-Framework` (load order), and the
real compatibility enforcement remains the runtime handshake above — WoW
itself ignores custom `X-` fields.

## Coming in Tier 4 (frozen contract)

- Inference: `slash` defaults to the lowercase addon name

Everything above is additive; nothing on this page changes meaning.
