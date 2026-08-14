# RGX-Framework Architecture

Internals, load order, module registration, and conventions.

---

## Global Object

RGX-Framework exposes a single global table:

```lua
_G.RGXFramework
```

Every module and every consumer addon references this same table. There is no LibStub, no version negotiation, and no embedding — one addon, one instance.

---

## Load Order

WoW loads files in the order declared in `RGX-Framework.xml`. The framework uses this sequence:

```
1. core/core.lua            — global object, module registry, Mixin, CopyTable, Clamp, Lerp, TableCount, Print/Warn/Error/Debug
2. core/systems/config.lua  — framework defaults (debugMode, default font, size, flags)
3. core/systems/database.lua— RGX:DB(name, defaults), RGX:InitDatabase()
3b. core/systems/database_test.lua — RGX:RunDBTests() harness; intentionally shipped, runs only via /rgx dbtest
4. core/systems/events.lua  — RegisterEvent, RegisterMessage, CreateEmitter, ADDON_ACTION_BLOCKED monitor
5. core/systems/runtime.lua — After, Every, CancelTimer, Hook, RegisterSlashCommand, combat queue, Safe* helpers
6. core/systems/utils.lua   — Trim, Split, TableKeys/Values/Contains/Map/Filter/Find, MergeTable, Round, Format, Clamp, StartsWith, EndsWith

7. modules/dropdowns/dropdowns.lua  — CreateNestedDropdown, CopyItem, NormalizeItems, ForceWidth, AddInlineButton
8. modules/fonts/definitions.lua    — 36 font definitions, unavailableFonts blocklist
9. modules/fonts/init.lua           — Fonts:Init(), RegisterModule("fonts")
10. modules/fonts/registry.lua      — Register, RegisterAddonFont, RegisterFontPack
11. modules/fonts/query.lua         — GetPath, Get, Exists, IsAvailable, List, ListAvailable, FindByPath
12. modules/fonts/defaults.lua      — SetDefault, GetDefault, SetDefaultSize, SetDefaultFlags, SetAutoScale
13. modules/fonts/apply.lua         — Apply, Quick, ApplyChildren, CreateString, FromTemplate
14. modules/fonts/normalize.lua     — SplitFlags, NormalizeFlags, DescribeFlags, GetFlagPresets, NormalizeFontPath
15. modules/fonts/styles.lua        — NormalizeStyle, NormalizeColorValue, CreateStyle, ApplyStyle/ApplyTextStyle
16. modules/fonts/grouping.lua      — BuildGroupedFontItems, _groupedFontsCache
17. modules/fonts/dropdowns.lua     — CreateFontDropdown, buildItems
18. modules/fonts/controls.lua      — CreateFontSettingControl
19. modules/fonts/menuitems.lua     — CreateFontMenuItems, CreateFlagMenuItems, CreateSizeMenuItems, CreateStyleMenuItems
20. modules/fonts/selectors.lua     — CreateStyleSelector, CreateSimpleFontSelector, AttachStyleSelector, AttachFontSelector
21. modules/fonts/preview.lua       — FontPreview:Create, _ApplyPreviewSelection
22. modules/colors/colors.lua       — full color API (lookup, math, wrapping, apply, picker)
23. modules/colors/colorpicker.lua  — rectangular HSV color picker widget
24. modules/textures/textures.lua   — statusbar texture registry, LSM import
25. modules/design/design.lua       — Design.Colors static palette, visual building blocks
26. modules/ui/controls.lua         — UI control factory (slider, toggle, label, dropdown, etc.)
27. modules/ui/options.lua          — CreateOptionsPanel (tabbed settings window)
28. modules/minimap/minimap.lua     — circular-drag minimap button
29. modules/sharedmedia/sharedmedia.lua — multi-type media registry, DBM/known-addon/generic scanners
30. modules/combat/combat.lua       — combat enter/leave/kill/crit/low-health/encounter callbacks
31. modules/petbattles/petbattles.lua — pet battle level/capture/state callbacks
32. modules/reputation/reputation.lua — reputation and renown tracking callbacks
33. modules/databroker/databroker.lua — NewDataObject, LDB bridge
34. modules/sound/sound.lua         — Sound:Register, variant playback, SavedVar integration
35. modules/achievement/achievement.lua — achievement unlock callbacks
36. modules/levelup/levelup.lua     — level-up callbacks
37. modules/quest/quest.lua         — quest lifecycle and progress callbacks
38. modules/honor/honor.lua         — honor level callbacks
39. modules/delves/delves.lua       — delve companion/lives callbacks
40. modules/housing/housing.lua     — housing progression/decor callbacks
41. modules/tradingpost/tradingpost.lua — Trading Post activity callbacks
42. modules/prey/prey.lua           — prey hunt callbacks
43. modules/collectibles/collectibles.lua — mount/pet/toy unlock callbacks
44. modules/loot/loot.lua           — loot and currency callbacks

45. core/commands.lua        — /rgx slash command handler (modules, fonts, debug)
46. core/initialization.lua  — ADDON_LOADED handler, database init, module TryInit, OnReady lifecycle
```

> Load order is authoritatively defined by `RGX-Framework.xml`. As of v2.1.0 every in-tree module is loaded — there are no dormant modules.

Consumer addons with `RequiredDeps: RGX-Framework` are guaranteed to load after step 32 completes.

---

## The `...` Varargs Pattern

Every Lua file loaded via WoW's `<Script>` tag receives the addon name and the addon table through the `...` varargs:

```lua
local addonName, RGX = ...
```

**Critical subtlety:** WoW passes the same private table to every file. `local _, MyModule = ...` does **not** create a unique module table — `MyModule` is the same table as `_G.RGXFramework`. This means:

- Generic field names like `Init`, `name`, or `db` can collide across split-module files
- The fonts sub-module files (definitions, registry, query, etc.) all populate the same `Fonts` table — they use specific, non-colliding field names
- If two files both define `function MyModule:Init()`, the second one overwrites the first

**Convention:** Module files should either use unique field names or be organized so that only one file defines any given method.

---

## Module Registration

Modules register themselves at load time:

```lua
RGX:RegisterModule(name, moduleTable, { global = "RGXFoo" })
```

This stores the module in `RGX.modules[name]` and optionally publishes it to `_G["RGXFoo"]`.

### Resolution

`RGX:GetModule(name)` resolves in two steps:

1. Check `RGX.modules[normalizedName]` (where `normalizedName = string.lower(name)`)
2. Fall back to `ResolveModuleAlias` — look up `_G[self.moduleAliases[normalizedName]]`

This means a module that sets its own global (e.g. `RGXFonts = Fonts`) before the framework processes it will still be found via the alias fallback.

### Shortcuts

The framework provides typed convenience wrappers:

```lua
RGX:GetFonts()      -- "fonts" → RGXFonts
RGX:GetColors()     -- "colors" → RGXColors
RGX:GetTextures()   -- "textures" → RGXTextures
RGX:GetDropdowns()  -- "dropdowns" → RGXDropdowns
RGX:GetUI()         -- "ui" → RGXUI
RGX:GetColorPicker()-- "colorpicker" → RGXColorPicker
RGX:GetMinimap()    -- "minimap" → RGXMinimap
RGX:GetDesign()     -- "design" → RGXDesign
RGX:GetDataBroker() -- "databroker" → RGXDataBroker
RGX:GetSound()      -- "sound" → RGXSound
```

### Dormant Modules

As of v2.1.0, there are no dormant modules. All in-tree modules are loaded by the XML loader.

Previously dormant modules and when they were re-enabled:

| Module | Global | Re-enabled |
|---|---|---|
| SharedMedia | `RGXSharedMedia` | v2.0.0 |
| PetBattles | `RGXPetBattles` | v2.0.0 |
| Reputation | `RGXReputation` | v2.0.0 |
| Combat | `RGXCombat` | v2.1.0 |
| Achievement, LevelUp, Quest, Honor, Delves, Housing, TradingPost, Prey | various | v2.1.0 |

---

## Lifecycle

### ADDON_LOADED

When WoW fires `ADDON_LOADED` for `"RGX-Framework"`:

1. Initialize `_G.RGXFrameworkDB` (or reuse existing)
2. Set `RGX.db = _G.RGXFrameworkDB`
3. Call `TryInit("RGXFonts")` — runs `Fonts:Init()`
4. Call `TryInit` for each active module: SharedMedia, Combat, PetBattles, Reputation, Achievement, LevelUp, Quest, Honor, Delves, Housing, TradingPost, Prey, Collectibles, Loot
5. Set `RGX._ready = true`
6. Fire all queued `OnReady` callbacks
7. Unregister the ADDON_LOADED handler

### OnReady

```lua
RGX:OnReady(fn)
```

If the framework is already initialized, `fn` runs immediately. Otherwise it is queued and fired during step 6 above.

Consumer addons should use `OnReady` when they need initialized modules (fonts, colors, etc.). For core-only APIs (events, timers, hooks, slash commands), `_G.RGXFramework` is available immediately — no `OnReady` needed.

---

## Timer System

RGX runs its own tick-based timer driver on a hidden `OnUpdate` frame. Timers are plain tables:

```lua
timer = {
    id, label, duration, callback, repeating, elapsed, active,
    owner?, name?, declarativeName?
}
```

- `RGX:After(dur, cb)` — one-shot, returns timer ref
- `RGX:Every(dur, cb)` — repeating, cb receives `timer` as first arg so it can cancel itself
- `RGX:CancelTimer(timer)` — marks `timer.active = false`; removed on next tick

`RGXAddon` can declare `every = { name = { seconds, handler } }`. These timers
start after the consumer's matching `ADDON_LOADED`, carry owner/name metadata,
and use a stable `AddonName:every:name` label. Definitions are sorted and
registered in reverse because the driver walks newest-to-oldest; timers from one
declaration that become due on the same update therefore dispatch in lexical
name order. A persistent scan cursor resumes budget-deferred work on the next
update so a large due set cannot starve later names. Callback errors retain the
timer label and remain failure-isolated.

**Budget:** `timerBudget = { maxPerFrame = 256, maxSeconds = 0.033, slowSeconds = 0.250, slowByLabel = { ["SharedMedia:QueueScan"] = 0.500 } }`. Slow callbacks (>250ms by default) are reported via `[RGX:timer-slow]`; known-heavy labels get per-label overrides instead of raising the global threshold. The driver pauses `OnUpdate` when no active timers remain. (The threshold was raised from 50ms in v2.0.0-alpha.1 — media scanning is normal I/O, not a fault.)

---

## Event System

Two dispatch channels share the same internal handler registry:

| Channel | API | Scope |
|---|---|---|
| Events | `RegisterEvent`, `UnregisterEvent`, `FireEvent` | WoW C events via OnEvent frame |
| Messages | `RegisterMessage`, `UnregisterMessage`, `SendMessage` | Internal addon-to-addon / module-to-module |

Both support `id` (for targeted unregistration) and `owner` (for method-name callbacks). Dispatch is pcall-wrapped with error reporting.

`RegisterCallback` / `UnregisterCallback` are aliases for `RegisterMessage` / `UnregisterMessage`.

### CreateEmitter

Module-local callback emitters:

```lua
local emitter = RGX:CreateEmitter("MyModule")
emitter:RegisterCallback("DATA_CHANGED", fn, id)
emitter:Fire("DATA_CHANGED", data)
```

---

## Combat Queue

```lua
RGX:QueueForCombat(func, ...)
```

If not in combat lockdown, `func` runs immediately. Otherwise it is queued and processed when `PLAYER_REGEN_ENABLED` fires.

The `Safe*` helpers (`SafeShow`, `SafeHide`, `SafeSetPoint`, `SafeSetSize`, `SafeSetText`, and the UIDropDownMenu variants) all use this queue internally.

---

## Saved Variables

Framework DB is `RGXFrameworkDB` (declared in TOC as `SavedVariables`). Consumer addons use their own SavedVariables managed via `RGX:NewDatabase(name, defaults, opts)`, which returns a profile-aware proxy with metamethod access (shipped in v1.9.0, hardened in v2.0.0).

The framework's `config.lua` provides defaults:

```lua
defaults = {
    global = {
        debugMode = false,
    },
    profile = {
        fonts = {
            default = "Inter-Regular",
            defaultSize = 12,
            defaultFlags = "",
        },
    },
}
```

---

## Module Interdependencies

```
Core (events, runtime, utils, config, database)
  ├── Dropdowns (no deps beyond core)
  ├── Fonts (depends on Dropdowns for CreateFontDropdown)
  │     └── uses RGXDropdowns.CreateNestedDropdown internally
  ├── Colors (no deps beyond core)
  │     └── ColorPicker (no deps beyond core + Colors)
  ├── Textures (no deps beyond core)
  ├── Design (depends on Colors for palette)
  ├── UI (depends on Fonts, Colors, Textures, Dropdowns for control factories)
  ├── Minimap (no deps beyond core)
  ├── DataBroker (no deps beyond core)
  └── Sound (no deps beyond core)
```

---

## Key Conventions

1. **No C_Timer** — all deferred work uses `RGX:After` / `RGX:Every`. Inside the framework itself, four call sites keep a guarded `elseif C_Timer.After` fallback for the edge case where the timer driver is unavailable (options.lua x2, sharedmedia.lua, reputation.lua); consumer-facing code has no such exception.
2. **No manual event frames** — use `RGX:RegisterEvent`
3. **No raw SLASH_X patterns** — use `RGX:RegisterSlashCommand`
4. **`assert(_G.RGXFramework, ...)`** — consumer addons fail fast if RGX is missing
5. **`RequiredDeps: RGX-Framework`** — TOC dependency, not optional embedding
6. **Module methods are colon-call** — `Fonts:GetPath("Inter-Regular")`, not `Fonts.GetPath(Fonts, ...)`
7. **Font paths are absolute** — `"Interface\\AddOns\\RGX-Framework\\media\\fonts\\Inter-Regular.otf"`
8. **Unavailable fonts are in-tree but blocked (corrupted assets)** — `unavailableFonts` list in definitions.lua; `IsAvailable()` returns false; `ListAvailable()` excludes them; they cannot be selected in dropdowns
