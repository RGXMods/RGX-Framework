# RGX-Framework Architecture

Internals, load order, module registration, and conventions.

## Modularity Review — 2026-10-06

RGX has a modular registry, but implementation ownership is uneven. Modularity
means a coherent responsibility behind a small interface, not a directory per
helper or a new public module for every file.

| Area | Verified current structure | Ownership / next correction |
|---|---|---|
| Core systems | events, runtime/timers, DB and compatibility have dedicated implementations | Keep one owner per mechanic; addon-scoped methods delegate to these systems |
| Fonts | registry/query/apply/styles/selectors are separate files sharing one module | Useful internal decomposition; retain one public Fonts interface |
| UI | controls/options/layout/profiles are separate files sharing one UI module; the local follow-on moves declarative tab rendering into options | Controls own interaction, layout owns geometry, options owns panel/tab composition; keep one set of factories |
| Addon factory | `core/core.lua` retains declaration compilation, scoped methods, lifecycle/storage wiring and panel configuration | The local follow-on delegates rendering to UI's private compositor; the grammar stays in core and consumers still use `RGXAddon` |
| Design/media | theme colors and frame primitives in Design; registries in media modules | Extend existing presentation contracts for skins; keep geometry/state in UI, not per-skin consumer forks |
| Game modules | registered with `category = "game"`, capability/flavor gates and lifecycle initialization | Keep domain state separate; verify callback contracts and missing capabilities before new DSL routes |
| Contract/MCP | local validation/preflight now delegate to the shared engine; availability comes from schema annotations | Shared vectors verify MCP/direct reports; remaining normalization/generation/editor scope stays in #8 |
| Runtime tests | most checks are developer-only, but `core/systems/database_test.lua` is XML-loaded | This is an explicit shipped diagnostic exception, not evidence that test relocation is complete |

### Ordered Structural Work

1. Preserve and reconcile current correctness fixes before moving their owners.
   Several local feature slices touch the same addon factory; a parked change
   is not integrated behavior.
2. Integrate the local shared-validation correction in `contract/engine/` and MCP;
   retain runtime Lua validation and conformance against the same supported forms.
3. Verify/integrate the local options-rendering separation. `modules/ui/options.lua`
   composes tabs and calls existing scroll/column/flow/control factories through
   a private seam; core supplies resolved declarations and retains lifecycle.
   This follow-on is separate from the committed beta.3 snapshot and
   introduces no consumer API, module, global or package-file expansion.
4. Complete page/card composition and modular skin resolution through their
   existing owners, with consumer/client evidence. Column distribution alone
   is not a card model; palette selection alone is not a native frame skin.
5. Relocate the runtime DB diagnostic only with an explicit supported replacement
   for `/rgx dbtest`. Directory taxonomy moves come after dependency checks,
   not before correctness or as a substitute for responsibility separation.

These are scoped follow-ups under
[#32](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/32),
contract engine [#8](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/8),
layout [#11](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/11)
and themes [#21](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/21).
This review records implementation seams, not completed refactors.

---

## Architectural Boundaries

RGX-Framework is one WoW addon with one loaded instance, one compatibility
boundary, and one public contract. Internally it separates eight layers with a
one-way dependency direction:

```text
Consumer addons
      ↓  RequiredDeps: RGX-Framework
Public RGX API (RGXFramework / RGXAddon / Get* / RegisterModule)
      ↓
Runtime (core → modules/libraries → modules/game)
      ↔  conforms to
Canonical contract (contract/schemas + contract/engine)
      ↓  consumed by
MCP adapter · editor · CI · future Studio
```

| Layer | Lives in | Ships to players | Rules |
|---|---|---|---|
| Runtime kernel | `core/` | Yes | Registry, events, timers, DB, compat, lifecycle only; feature systems belong in modules |
| Framework libraries | `modules/<library>` | Yes | `category = "library"`; reusable by any consumer |
| Game adapters | `modules/<game>` | Yes | `category = "game"`; WoW-domain events gated by flavor capability |
| Public API | `RGXFramework`, `RGXAddon`, `Get*` | Yes | Frozen 31-global surface — `npm run arch-check` fails any new `_G` write |
| Contract | `contract/schemas`, `contract/engine` | No | Machine form of the declarative API; runtime remains authoritative for behavior |
| Tooling | `tools/rgx-mcp`, `tools/ci`, `tools/reference`, `tools/release`, `tools/wiki` | No | Adapters over the contract; never own RGX semantics |
| Tests | `tools/ci/*-check.mjs`, `modules/*/tests/` | Normally no | Headless checks stay outside runtime; XML still explicitly loads the `/rgx dbtest` diagnostic |
| WoW reference | `.reference/` (untracked trees + tracked manifests/provenance) | No | Generated cache; sync via `tools/reference/sync-*.mjs` |

Two machine-enforced invariants (`npm run arch-check`, wired into shared CI):

- **Module graph** (`tools/ci/module-graph-check.mjs`): registered names are
  unique, declared `depends` exist and load earlier in the XML, the dependency
  graph is acyclic, `flavors` declarations have matching central gates in
  `core/compat.lua`, every module declares a `category`, and the public global
  surface stays frozen.
- **Runtime boundary** (`tools/ci/runtime-boundary-check.mjs`): no `core/` or
  `modules/` Lua may reference `tools/`, `contract/`, `.reference/`,
  `rgx-mcp`, or `node_modules`, and may never use `require`/`dofile`/`loadfile`
  — WoW addons load exclusively through the TOC/XML manifest.

---

## Global Object

RGX-Framework exposes a single global table:

```lua
_G.RGXFramework
```

Every module and every consumer addon references this same table. There is no LibStub, no version negotiation, and no embedding — one addon, one instance.

---

## Load Order

`RGX-Framework.xml` loads in this exact order. The compatibility layer is now
first: every later file can consult flavor flags and `RGX:ModuleSupported` at
load time, and `RGX:RegisterModule` refuses gated registrations centrally. Both
compat files preserve the shared `RGX.API` table (`RGX.API = RGX.API or {}`) —
earlier revisions silently wiped predicates when the second file loaded, which
is a load-order bug class we now test for (`tools/ci/compat-loader-check.mjs`).
Every `RGX.API` name has exactly one defining file: `core/compat.lua` owns the
normalized implementations and `core/compat_api.lua` only adds names it does
not define, enforced across the XML load list by
`tools/ci/api-ownership-check.mjs`.

WoW loads files in the order declared in `RGX-Framework.xml`. The framework uses this sequence:

```text
0. core/compat.lua, core/compat_api.lua — capability foundation before registration
1. core/core.lua            — global object, module registry, Mixin, CopyTable, Clamp, Lerp, TableCount, Print/Warn/Error/Debug
2. core/systems/config.lua  — framework defaults (debugMode, default font, size, flags)
3. core/systems/database.lua— RGX:DB(name, defaults), RGX:InitDatabase()
3b. core/systems/database_test.lua — RGX:RunDBTests() harness; intentionally shipped, runs only via /rgx dbtest
4. core/systems/events.lua  — RegisterEvent, RegisterMessage, CreateEmitter, ADDON_ACTION_BLOCKED monitor
5. core/systems/runtime.lua — After, Every, CancelTimer, Hook, RegisterSlashCommand, combat queue, Safe* helpers
6. core/systems/utils.lua   — Trim, Split, TableKeys/Values/Contains/Map/Filter/Find, MergeTable, Round, Format, Clamp, StartsWith, EndsWith

6b. modules/locale/locale.lua, overrides.lua — locale registry and framework translations
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
23. modules/colors/colorpicker.lua  — HSV color picker widget
24. modules/textures/textures.lua   — statusbar texture registry, LSM import
25. modules/design/design.lua       — Design.Colors static palette, visual building blocks
26. modules/ui/controls.lua         — UI control factory (slider, toggle, label, dropdown, etc.)
27. modules/ui/options.lua          — CreateOptionsPanel (tabbed settings window)
27b. modules/ui/layout.lua, profiles.lua, guide.lua — composition, profiles and guide
28. modules/minimap/minimap.lua     — circular-drag minimap button
29. modules/sharedmedia/sharedmedia.lua — multi-type media registry, DBM/known-addon/generic scanners
30. modules/combat/combat.lua       — combat enter/leave/kill/crit/low-health/encounter callbacks
31. modules/petbattles/petbattles.lua — pet battle level/capture/state callbacks
32. modules/reputation/reputation.lua — reputation and renown tracking callbacks
32b. modules/auras/auras.lua, modules/tooltip/tooltip.lua — aura boundary and tooltip composition
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

> Exact load order is authoritative in `RGX-Framework.xml`; the labels above
> summarize it and are not manifest indices. File existence alone does not prove
> registration, initialization or availability on every flavor.

Required dependencies load before the consumer's Lua files. This does not make
gameplay data or consumer SavedVariables ready at chunk load: use the proper
readiness/`ADDON_LOADED` lifecycle and capability gates.

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

### Flavor-gated modules

Feature modules that can only exist on specific client families skip registration via `RGX:ModuleSupported(name)` at file scope, decided by the client's own global surface (the namespace the module drives), not the product string. The support map is evidence-coded in `core/compat.lua` from the synced client dumps; the module's `flavors` registration metadata records the same list so the taxonomy and gate stay congruent. Blizzard's misspelled `CURRENT_HOUSE_INFO_RECIEVED` event exists on every flavor and never substitutes for a namespace check. Registration tests live in `tools/ci/module-gating-check.mjs`.

### Module taxonomy

Every module declares its architectural class at registration:
`category = "library"` for framework capabilities consumed by any addon
(fonts, colors, textures, dropdowns, ui, design, minimap, tooltip, databroker,
sharedmedia, sound, locale) and `category = "game"` for WoW-domain adapters
(auras, quest, combat, levelup, housing, and the rest). `depends` lists must
load earlier in `RGX-Framework.xml` — the checker proves it. `stability`
(`stable | experimental | deprecated | internal`) is recorded alongside; the
machine-readable API catalog milestone formalizes it further. The global
namespace is frozen at 31 names: `module-graph-check.mjs` fails both when a
new `_G.RGX*` write appears and when an allowlisted global stops being
written.

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
