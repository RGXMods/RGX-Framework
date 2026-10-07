# Declarative API


The authoring surface and human-readable **Simplicity Contract** for RGX addons.
Evolution is additive-only: what you write today keeps working forever. The
machine-checkable shape lives in
[`contract/schemas/rgx-addon.schema.json`](https://github.com/RGXMods/RGX-Framework/blob/main/contract/schemas/rgx-addon.schema.json); keys are
annotated `x-rgx-ships: "today"` (implemented) or `"tier4"` (frozen target).

This page describes supported forms against `core/core.lua`
(`RGX.Addon`, `_G.RGXAddon`). **Local-worktree exception:** the `options.columns` slice described
below is implemented in this branch, but is not part of the published
`2.7.15-beta.2` release and does not implement the full declarative card/page model.

This branch also hardens the beta's one-line implementation: malformed strings
are rejected before registration, signed slider ranges are preserved, method
buttons bind to their addon, and fonts use the existing bound selector. These
corrections are local source changes until integrated and released.

The current untagged structural follow-on moves lazy tab/control construction
to `library/ui/options.lua` while core retains grammar validation and lifecycle.
It changes implementation ownership, not the consumer declaration vocabulary.

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
| `options` | `TabName = { controls... }`; requires `db`; builds a tabbed panel with db-bound controls (automatic save **and** restore) | per-control advanced keys below; local `columns = 1\|2\|3` distributes controls into column flows, not declarative cards; multi-page tabs stay Tier 4 |
| `title` | — | Panel title; assumes the addon name |
| `welcome` | startup string printed with the framework icon and `[RGX]` prefix on load; obeys the global `/rgx login on|off` preference | — |
| `onInit` | function(addon), runs on ADDON_LOADED after `db`/`options` exist — the imperative escape hatch | — |
| `every` | `name = { seconds, function(addon, timer) }`; starts after ADDON_LOADED and first fires after the interval | multiple deterministically named repeating timers; handlers may self-cancel with `addon:CancelTimer(timer)` |
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

## Controls (table forms, shipped)

```lua
{ section = "Header Text" }
{ toggle = "dbKey", label = "Label", default = true }
{ slider = "dbKey", label = "Label", min = 0, max = 100, step = 1, suffix = "%" }
{ slider = "dbKey", valueDisplay = "hover", progress = false }
{ color = "dbKey", label = "Label", default = { r = 1, g = 1, b = 1 } }
{ dropdown = "dbKey", label = "Label", items = { "a", "b" }, width = 260 }
{ button = "Button Text", action = function() ... end, width = 120, height = 22 }
```

### One-line control strings (shipped)

Strings compile to the same table forms:

```lua
options = {
    General = {
        "header 'Settings'",
        "toggle enabled 'Enable Addon'",
        "slider volume 0-100 'Volume'",
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

One composable vocabulary, top to bottom (proven in BLU): **panel → main page
+ tabs → tabs can be multi-paged → 1–2 column card grid → rows/cards holding
the widgets**. The local columns slice is panel → tabs → controls in 1–3
column flows (`options.columns`, default 1). It creates no declarative cards
or multi-page tabs; those remain additive target work.

The imperative UI already provides `CreateFlowLayout`, `CreateColumns`,
`CreatePager`, and `CreateCard` (including one/two internal columns and
width-triggered auto-height reflow). These are the shared layout foundation;
their existence alone does not implement the full declarative page/card model.

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
- Inference: `slash` defaults to the lowercase addon name

Everything above is additive; nothing on this page changes meaning.
> **Beta candidate:** v2.7.15-beta.4; stable remains v2.7.14. Slider customization is included since v2.7.13.
