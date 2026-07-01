# CLAUDE.md — RGX-Framework

Agent guidance for this repository. Read this before touching any file.

---

## What this repo is

RGX-Framework is a shared WoW addon framework that serves two roles:

1. **Shared runtime for the entire RGX Mods addon suite** — BLU, BattlePetUtility, SimpleQuestPlates, EnhancedTravelersLog, RemoveNameplateDebuffs, and 14+ sound-pack addons all declare `RequiredDeps: RGX-Framework`. One load, one instance, shared by all.

2. **The foundation layer for `rgx-mod`** — a WeakAuras replacement being built on top of this framework. Every subsystem added to RGX-Framework that benefits current addons is also a building block for rgx-mod's trigger/condition/display engine. This is the north star. Design decisions should be consistent with that scope.

The framework is **not** embedded into addons and has **no LibStub**. It is a hard dependency shipped as its own addon.

---

## Design thesis — make the bug unrepresentable

The framework's core value is **prevention, not remediation.** Most WoW addon maintenance is reactive: hunting deprecated API and taint (protected-frame security-context violations) in code that already shipped them. RGX-Framework is built so consumer addons **cannot introduce that class of bug in the first place.**

- **No manual event frames** — everything routes through `RGX:RegisterEvent` / `RGX:RegisterUnitEvent`. Consumers never touch `CreateFrame` + `SetScript("OnEvent")` by hand.
- **No raw `C_Timer`** — the framework runs its own tick driver; consumers use `RGX:After` / `RGX:Every`.
- **No raw `SLASH_X`** — `RGX:RegisterSlashCommand` handles registration.
- **All dispatch is pcall-wrapped** — one consumer handler can never crash the dispatch frame.
- **Combat-lockdown guards** — frame registration is deferred during lockdown and queued via `PLAYER_REGEN_ENABLED`, so consumers can't trigger taint by mutating protected frames mid-combat.

A consumer addon that writes against the framework API gets taint-safety and current-API usage **by construction.** When designing any new subsystem, the test is not "is this convenient" but "does this make a whole class of WoW-specific bug impossible for the consumer to write." That is the same north star as rgx-mod: a clean, human-friendly authoring surface that emits correct, safe behavior underneath.

---

## Current version

- **Version:** `2.1.0`
- **Interface:** `120007` (WoW Retail Midnight 12.0.7)
- **TOC:** `RGX-Framework.toc`
- **Loader:** `RGX-Framework.xml` — this is the single source of truth for what modules are loaded

---

## Module status

### Active (loaded by XML)

| Module | Global | What it provides |
|---|---|---|
| Core | `RGXFramework` | Events, timers, hooks, slash, DB/profiles, Mixin, utilities, `RGX.Addon()` factory |
| Dropdowns | `RGXDropdowns` | Nested dropdown menus, auto-width, inline buttons |
| Fonts | `RGXFonts` | 36 font definitions, registry, query, apply, style objects, dropdowns, selectors |
| Colors | `RGXColors` | Color palette, math, apply, picker |
| ColorPicker | `RGXColorPicker` | HSV color picker widget |
| Textures | `RGXTextures` | Statusbar texture registry |
| Design | `RGXDesign` | Visual palette, building blocks, theme tokens |
| UI | `RGXUI` | Slider, toggle, label, dropdown, button, section, options panel builder |
| Minimap | `RGXMinimap` | Circular-drag minimap button |
| DataBroker | `RGXDataBroker` | LDB bridge |
| Sound | `RGXSound` | Sound pack registration, variant playback, mute list, SavedVar integration |
| Achievement | `RGXAchievement` | Achievement unlock callbacks |
| LevelUp | `RGXLevelUp` | Level-up event callbacks |
| Collectibles | `RGXCollectibles` | Mount/pet/toy unlock callbacks |
| Loot | `RGXLoot` | Loot and currency callbacks |
| Quest | `RGXQuest` | Quest lifecycle and progress callbacks |
| Honor | `RGXHonor` | Honor level callbacks |
| Delves | `RGXDelves` | Delve companion/lives callbacks |
| Housing | `RGXHousing` | Housing progression/decor callbacks |
| TradingPost | `RGXTradingPost` | Trading Post activity callbacks |
| Prey | `RGXPrey` | Prey hunt callbacks |

### Dormant (in-tree, NOT loaded by XML)

These are complete and tested. Re-enabling is a one-line addition to `RGX-Framework.xml` per module.

| Module | Global | What it provides | Who needs it |
|---|---|---|---|
| SharedMedia | `RGXSharedMedia` | Sound/font/texture registry, KittyPack hook, DBM registrar scan, known-addon compat, generic global scan | BLU (drops 901-line local sharedmedia.lua) |
| PetBattles | `RGXPetBattles` | `OnLevelUp`, `OnCapture`, `OnBattleStart/End`, `IsInBattle`, `GetPetLevel`, `ScanPetLevels` | BattlePetUtility |
| Combat | `RGXCombat` | `OnEnter`, `OnLeave`, `OnKill`, `OnPlayerDied`, `OnCrit`, `OnLowHealth`, `OnExecuteWindow`, `OnEncounterEnd/Victory` | BLU Combat module, rgx-mod triggers |
| Reputation | `RGXReputation` | Reputation and renown tracking callbacks | ReputationLevelUp migration |

**To enable a dormant module:** add the `<Script>` entry in `RGX-Framework.xml` in load-order position, verify `TryInit` call in `core/initialization.lua` if needed, bump version, release.

---

## Consumer addon integration levels

Current state as of v2.1.0:

| Addon | RGX Dep | Systems Used | Level |
|---|---|---|---|
| BLU | Required | events, timers, hooks, slash, DB, dropdowns, sound, utilities | 100% |
| EnhancedTravelersLog | Required | events, timers, hooks, slash, minimap, design | 75% |
| SimpleQuestPlates | Required | events, timers, minimap, slash, design | 75% |
| BattlePetUtility | Required | events, timers, hooks, slash, DB, minimap, debug | 65% |
| RemoveNameplateDebuffs | Required | events, timers, minimap, slash | 50% |
| HelloRGX | Required | DB, slash, UI (RGX.Addon bootstrap) | 50% |
| 14× LevelUp sound packs | Required | sound, events, slash | 25% |
| ReputationLevelUp | None | — | 0% |
| CoordinationCloakUtility | None | — | 0% |
| BLU_Classic | None (Ace3) | — | 0% — intentional, will never migrate |

---

## Priority work order

Build subsystems that benefit **current addons first**, then rgx-mod. Do not build abstract framework modules that no current addon uses.

**The strategic sequence is: finish runtime modules → declarative authoring layer → schema + MCP tooling.** Each stage makes the next one cheaper: modules complete the runtime, the declarative layer gives one stable authoring surface, and the schema/MCP make that surface machine-checkable — after which consumer integration and brand-new addons become near-trivial for humans and agents alike.

### Tier 1 — Enable dormant modules ✅ DONE (v2.0.0 + v2.1.0)

All in-tree modules are loaded by the XML loader. No dormant code remains.

### Tier 2 — Wire consumers to shipped modules (IN FLIGHT)

5. **Wire BLU → RGXSharedMedia** — IN PROGRESS on BLU branch `rgxsharedmedia-migration`: local scanner replaced by a ~190-line bridge (imports on `RGX_SHAREDMEDIA_UPDATED`). Pending in-game test before merge. Open design question on that branch: own-folder exclusion vs dedup-on-import (owner prefers picking up all folders; dedup against already-registered paths is the likely resolution).
6. **Wire BPU → RGXPetBattles** — replace raw `C_PetBattles.*` calls
7. **Wire BLU Combat → RGXCombat** — simplify to `Combat:OnEnter/OnLeave` callbacks
8. **Wire BPU → RGXDropdowns** — replace `EasyMenu`/`UIDropDownMenu` in BPU options

### Tier 3 — Last runtime primitives (NEXT BUILD)

9. **RGXAuras** — taint-safe aura scanning. API surface verified against Blizzard's generated 12.0.7 docs (`Blizzard_APIDocumentationGenerated/UnitAuraDocumentation.lua` in the wow-ui-source mirror): `C_UnitAuras.GetPlayerAuraBySpellID`, `GetAuraDataByIndex/BySlot/ByAuraInstanceID/BySpellName`, `GetAuraSlots`, plus `UNIT_AURA` incremental `UnitAuraUpdateInfo`. Generalizes BPU's `PlayerHasAuraSpellID` pattern; core rgx-mod trigger primitive.
10. **RGXTooltip** — `GameTooltip` hook registry, structured composition, `AddLine`/`AddDoubleLine` helpers. BPU hooks GameTooltip in 5 files today. Also needed by rgx-mod display types.
11. **RGXCombatLog** — structured `COMBAT_LOG_EVENT_UNFILTERED` dispatch: parse subevent, source/dest GUIDs, spellId. Needed by BLU Combat, BPU capture events, and is the core rgx-mod event trigger.

### Tier 4 — Declarative authoring layer (see `docs/DECLARATIVE-DSL.md` on the `dsl` branch)

12. **Harden `RGX.Addon({...})`** to the full declarative shape — events, unit events, timers, slash, minimap, DB defaults all from one table. The declarative Lua table is the canonical foundation; any future `.rgx` syntax compiles to it, never to raw Lua.
13. **Grid/matrix options UI** — declarative 1/2/3-column card layouts with flexible element rows, every control bound to `addon.db` with automatic save/restore. This also kills a live cross-addon bug class: BLU and SQP hand-roll sliders that do not restore their values on reload; framework-owned bound controls fix all of them at once.

### Tier 5 — Schema + rgx-mcp (separate repo; framework never depends on it)

14. **`docs/DECLARATIVE-API.md` + `schemas/rgx-addon.schema.json`** — the machine-checkable contract for the declarative shape.
15. **`rgx-mcp`** — external dev tool (read-only first): validate declarative addons, audit consumers for raw `C_Timer`/event-frame/slash patterns, generate declarative tables from intent. Dependency direction: rgx-mcp depends on RGX docs/schema; consumers depend on RGX-Framework; the framework depends on nothing.

### Tier 6 — rgx-mod engine phases (after above)

16. **Frame pooling** — `CreatePool(frameType, parent, resetFunc)` for rgx-mod's dynamic display regions
17. **Bucket events** — `RegisterBucketEvent(event, delay, callback)` for throttling `UNIT_AURA` spam
18. **Animation/tween helpers** — lerp utilities for smooth display transitions
19. **RGXTriggers** — trigger evaluation engine (aura, event, status, custom) — rgx-mod Phase 2
20. **RGXDisplays** — dynamic frame/texture/text/progressbar display regions — rgx-mod Phase 3
21. **RGXConditions** — boolean condition evaluator for trigger logic — rgx-mod Phase 3

---

## rgx-mod context

`rgx-mod` is a WeakAuras replacement being built on RGX-Framework. WeakAuras provides:
- Trigger system (aura/event/status/custom)
- Display regions (icon, aurabar, text, texture, group, dynamic group)
- Condition/logic evaluator
- Action system (sound, chat, custom code)
- Import/export string system
- Animation system

RGX-Framework already has the foundations: events, timers, DB/profiles, serialization, sound, fonts, colors, textures, dropdowns, UI. What's missing is the trigger engine, display region system, condition evaluator, and animation helpers.

**The WoW UI dump** (full Blizzard API dump) is the reference for building new framework modules. Use it to map APIs correctly before implementing. Do not guess at WoW APIs — consult the dump.

**Build priority rule:** if a new framework module benefits a current maintained addon AND rgx-mod, build it. If it only benefits rgx-mod with no current addon use, defer it.

---

## Architecture rules

- **No LibStub** — ever. No version negotiation. One instance via `_G.RGXFramework`.
- **No embedding** — consumers use `RequiredDeps: RGX-Framework` in TOC, not copy-paste.
- **No C_Timer** — use `RGX:After` / `RGX:Every`.
- **No manual event frames** — use `RGX:RegisterEvent` / `RGX:RegisterUnitEvent`.
- **No raw `SLASH_X` patterns** — use `RGX:RegisterSlashCommand`.
- **All dispatch is pcall-wrapped** — framework never lets a consumer handler crash the frame.
- **Combat lockdown guards** — frame registration deferred during lockdown, queued via `pendingFrameEvents`.
- **New modules register via `RGX:RegisterModule(name, table, opts)`** — sets global alias, stored in `RGX.modules`.
- **Consumer addons `assert(_G.RGXFramework, ...)`** at file scope — fast fail if dependency missing.

---

## Key file locations

```
RGX-Framework.toc        — version, interface, SavedVariables declarations
RGX-Framework.xml        — XML loader (single source of truth for load order)
core/core.lua            — global object, module registry, RGX.Addon() factory
core/systems/config.lua  — framework defaults
core/systems/database.lua — RGX:NewDatabase(), RGX:DB(), serialization, import/export
core/systems/events.lua  — RegisterEvent, RegisterUnitEvent, RegisterMessage, CreateEmitter
core/systems/runtime.lua — After, Every, CancelTimer, Hook, RegisterSlashCommand, Safe* helpers
core/initialization.lua  — ADDON_LOADED handler, TryInit, OnReady lifecycle
modules/                 — one subdirectory per module
docs/ROADMAP.md          — planned work, phase tracking
docs/ARCHITECTURE.md     — internals, load order, module registration conventions
```

---

## Version and release conventions

- Version string lives in `RGX-Framework.toc` (`## Version:`)
- `core/core.lua` reads it at runtime: `RGX.version = GetAddOnMetadataCompat(addonName, "Version")`
- Keep `docs/CHANGES.md` as the current release summary
- Add matching file in `docs/changelogs/<version>.md`
- Merge to `main`, tag `vX.Y.Z`, push tag to trigger GitHub Actions release

---

## What NOT to do

- Do not add modules that no current addon needs
- Do not embed or fork framework code into consumer addons
- Do not add LibStub, Ace3, or any third-party library
- Do not break the `RGX.Addon()` factory API — addons depend on it
- Do not change `NewDatabase` proxy behavior without full regression check across BLU and BPU
- Do not enable dormant modules without verifying `Init()` and `TryInit` wiring in `initialization.lua`
- Do not commit directly to `main` — work on `dev`, merge via PR
