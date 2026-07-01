# RGX-Framework Roadmap

## Direction

RGX-Framework is a modern WoW addon framework and the **foundation layer for `rgx-mod`** — a WeakAuras replacement.

**North star:** `rgx-mod` provides a WeakAuras-style trigger/condition/display engine built entirely on RGX-Framework. Every subsystem added to the framework serves two masters: the current addon suite first, and the rgx-mod engine second. Do not build abstract framework modules no current addon uses — build what current addons need that rgx-mod can also leverage.

The framework ships as a single `RequiredDeps` entry. No embedding. No LibStub. No version conflicts. One load, one `_G.RGXFramework` instance, shared by every addon in the suite.

Reusable patterns discovered in consumer addons move into RGX. Addon-specific product behavior stays in the addon.

---

## Consumer Integration Levels

Current state as of v2.1.0:

| Addon | RGX Dep | Systems Used | Level |
|---|---|---|---|
| BLU | Required | events, timers, hooks, slash, DB, dropdowns, sound, utilities | 100% |
| EnhancedTravelersLog | Required | events, timers, hooks, slash, minimap, design | 75% |
| SimpleQuestPlates | Required | events, timers, minimap, slash, design | 75% |
| BattlePetUtility | Required | events, timers, hooks, slash, DB, minimap, debug | 65% |
| RemoveNameplateDebuffs | Required | events, timers, minimap, slash | 50% |
| HelloRGX | Required | DB, slash, UI factory | 50% |
| 14x LevelUp sound packs | Required | sound, events, slash | 25% |
| ReputationLevelUp | None | — | 0% (migration target) |
| CoordinationCloakUtility | None | — | 0% (migration target) |
| BLU_Classic | None (Ace3) | — | 0% (intentional, never migrates) |

---

## Core Principles

- One shared instance for all consumers — the single-load model beats per-addon embedding past 2 addons
- Modules are siloed by responsibility but designed to work together
- The public API stays simple; complexity lives inside the framework
- Build once in RGX, consume across the entire suite
- No LibStub, no embedding tax, no legacy compat shims
- Build for current addon needs first — rgx-mod phases unlock naturally as those needs are met

---

## What's Built

### Active Modules

| System | Module | Status |
|---|---|---|
| Events, timers, hooks, slash commands | Core | Done |
| Lifecycle (OnReady, IsReady) | Core | Done |
| Output helpers (Print, Warn, Error, Debug) | Core | Done |
| Object composition (Mixin) | Core | Done |
| Profile-aware database with metamethod access | Core | Done (v1.9.0+) |
| Deep-merge DB defaults (MergeTable recursive) | Core | Done |
| Version-based DB migration (MigrateDB) | Core | Done |
| Unit-filtered event registration (RegisterUnitEvent) | Core | Done |
| Serialization + import/export dialogs | Core | Done |
| RGX.Addon() one-call addon factory | Core | Done (v2.0.0) |
| Font registry + dropdowns + style objects | RGXFonts | Done |
| Color palette + picker + math | RGXColors | Done |
| Statusbar texture registry | RGXTextures | Done |
| Nested dropdowns + auto-width + inline buttons | RGXDropdowns | Done |
| Slider, toggle, label, button, options panel builder | RGXUI | Done |
| Color picker widget | RGXColorPicker | Done |
| Circular-drag minimap button | RGXMinimap | Done |
| Visual palette, building blocks, theme tokens | RGXDesign | Done |
| Data broker registry | RGXDataBroker | Done |
| Sound pack registration, variant playback, mute | RGXSound | Done |
| Achievement unlock callbacks | RGXAchievement | Done |
| Level-up callbacks | RGXLevelUp | Done |
| Collectible unlock callbacks | RGXCollectibles | Done |
| Loot and currency callbacks | RGXLoot | Done |
| Quest lifecycle and progress callbacks | RGXQuest | Done |
| Honor level callbacks | RGXHonor | Done |
| Delve companion/lives callbacks | RGXDelves | Done |
| Housing progression/decor callbacks | RGXHousing | Done |
| Trading Post activity callbacks | RGXTradingPost | Done |
| Prey hunt callbacks | RGXPrey | Done |

### Recently Enabled Modules

As of **v2.1.0**, every in-tree module is loaded by the XML loader. There are no dormant modules. The modules below were the last to be enabled — they are now Active (listed in the table above) and available to every consumer.

| Module | Global | What it provides | Enabled | Primary consumer |
|---|---|---|---|---|
| SharedMedia | RGXSharedMedia | Sound/font/texture registry, DBM registrar scan, known-addon compat, generic addon-global scan | v2.0.0 | BLU (will drop local sharedmedia.lua) |
| PetBattles | RGXPetBattles | OnLevelUp, OnCapture, OnBattleStart/End, IsInBattle, GetPetLevel, ScanPetLevels | v2.0.0 | BattlePetUtility |
| Reputation | RGXReputation | Reputation and renown tracking callbacks | v2.0.0 | ReputationLevelUp migration |
| Combat | RGXCombat | OnEnter, OnLeave, OnKill, OnPlayerDied, OnCrit, OnLowHealth, OnExecuteWindow, OnEncounterEnd/Victory | v2.1.0 | BLU Combat module, rgx-mod triggers |
| Achievement, LevelUp, Quest, Honor, Delves, Housing, TradingPost, Prey | various | Event callback modules for milestone/progression triggers | v2.1.0 | BLU v8 modules, sound packs |

---

## Priority Work Order

### Tier 1 — Enable dormant modules ✅ DONE (v2.0.0 + v2.1.0)

All previously-dormant modules are now loaded by the XML loader. No dormant code remains in-tree.

1. ✅ **RGXSharedMedia enabled** (v2.0.0)
2. ✅ **RGXPetBattles enabled** (v2.0.0)
3. ✅ **RGXReputation enabled** (v2.0.0)
4. ✅ **RGXCombat + 8 event callback modules enabled** (v2.1.0)

### Tier 2 — Wire existing shipped modules into consumers ← CURRENT FOCUS

Framework already has these. Addons just haven't adopted them yet.

5. **Wire BLU to RGXSharedMedia** — drop BLU's local `core/sounds/sharedmedia.lua` entirely
6. **Wire BPU to RGXPetBattles** — replace raw C_PetBattles API calls
7. **Wire BLU Combat to RGXCombat** — replace raw PLAYER_REGEN event handling
8. **Wire BPU to RGXDropdowns** — replace EasyMenu/UIDropDownMenu in BPU options
9. **Migrate ReputationLevelUp** — add RequiredDeps, wire sound + events + slash + reputation

### Tier 3 — New modules (guided by WoW UI dump)

Build when a current addon needs it AND it serves rgx-mod. WoW UI dump is the API reference.

10. **RGXAuras** — taint-safe aura scanning
    - `HasAura(spellId, unit)`, `GetAura(spellId, unit)`, pcall guards
    - Generalizes BPU's `PlayerHasAuraSpellID` pattern
    - Core rgx-mod aura trigger primitive
    - Uses `C_UnitAuras.GetPlayerAuraBySpellID` (taint-safe)

11. **RGXTooltip** — GameTooltip hook registry and composition
    - Hook registration without taint: `RGXTooltip:Hook(fn)`
    - `AddLine`, `AddDoubleLine`, typed helpers
    - BPU hooks GameTooltip in 5 files today — standardize it
    - Needed by rgx-mod display types

12. **RGXCombatLog** — structured COMBAT_LOG_EVENT_UNFILTERED dispatch
    - Parse subevent type, source/dest GUIDs, spellId, amount
    - Typed callbacks: `OnSwing`, `OnSpellDamage`, `OnAuraApplied`, etc.
    - BLU Combat module, BPU pet capture events
    - Core rgx-mod event trigger primitive

### Tier 4 — Declarative authoring layer

Full design: `docs/DECLARATIVE-DSL.md` on the `dsl` branch. The declarative Lua table is the canonical foundation — any future `.rgx` syntax compiles to it.

13. **Harden `RGX.Addon({...})`** — one declarative table defines events, unit events, timers, slash, minimap, and DB defaults
14. **Grid/matrix options UI** — declarative 1/2/3-column card layouts, flexible element rows, every control bound to `addon.db` with automatic save/restore (also fixes the live BLU/SQP hand-rolled-slider persistence bug class at the framework level)

### Tier 5 — Schema + rgx-mcp (separate repo)

15. **`docs/DECLARATIVE-API.md` + `schemas/rgx-addon.schema.json`** — machine-checkable contract for the declarative shape
16. **`rgx-mcp`** — external developer/agent tool, read-only first: validate declarative addons, audit consumers for unsafe patterns, generate declarative tables. Dependency rule: rgx-mcp depends on RGX docs/schema; the framework never depends on rgx-mcp.

**Why this order:** modules complete the runtime → the declarative layer gives one stable authoring surface → the schema/MCP make it machine-checkable. After Tier 5, wiring existing consumers and building brand-new addons becomes near-trivial for humans and agents alike.

---

## rgx-mod Foundation Phases

Phases unlock as the framework subsystems above are built. The framework work and rgx-mod work feed each other.

| Phase | rgx-mod Feature | Framework Dependency | Status |
|---|---|---|---|
| 1 | Baseline (BLU-derived sound triggers) | Core, DB, Events, Sound, Combat | Done (framework side) |
| 2 | Multi-trigger auras | RegisterUnitEvent, RGXAuras | RegisterUnitEvent done; RGXAuras not built |
| 3 | Display types + conditions | RGXDisplays (new), RGXConditions (new) | Not built |
| 4 | Options editor + actions | RGXUI, RGXDropdowns | Done (framework side) |
| 5 | Import/export + profiles | Serialization, Profiles, Bucket events | Profiles + Serialization done; Bucket events not built |
| 6 | Groups, animations, pooling | Frame pooling, Animation helpers, Locale | Not built |

### rgx-mod specific framework work (ordered by phase)

- **Bucket events** (Phase 5) — `RegisterBucketEvent(event, delay, callback)` — throttles UNIT_AURA spam, any combat addon benefits
- **RGXTriggers** (Phase 2-3) — trigger evaluation engine: aura, event, status, custom
- **RGXDisplays** (Phase 3) — dynamic frame/icon/text/progressbar/aurabar region system
- **RGXConditions** (Phase 3) — boolean condition evaluator combining multiple trigger states
- **Frame pooling** (Phase 6) — `CreatePool(frameType, parent, resetFunc)` for display regions
- **Animation helpers** (Phase 6) — lerp/tween utilities for entry/exit/loop transitions
- **RGXLocale** (Phase 6) — `NewLocale(addonName, locale, isDefault)` for community translations

---

## Near-Term Feature Additions

### Bloodlust Detection

Add `RGX_BLOODLUST` and `RGX_SATED` messages to the framework event system:
- `C_UnitAuras.GetPlayerAuraBySpellID()` for Sated-family debuff detection (taint-safe)
- `RegisterUnitEvent("UNIT_AURA", "player", ...)` for real-time tracking
- Sated spell IDs: 57723, 57724, 80354, 95809, 115969, 117897, 117901, 160738
- Any addon subscribes via `RGX:RegisterMessage("RGX_BLOODLUST", fn)`

### Combat Rez Tracking

Add `RGX_COMBATREZ_AVAILABLE` and `RGX_COMBATREZ_USED` messages:
- `C_DeathInfo.GetSelfResurrectOptions()` for available self-rez spells
- `GetDeathResurrectChargeInfo()` for charge counts

### Pack / Addin System

External addon packs that extend RGX-Framework with fonts, sounds, textures. Ship as separate CurseForge addons with `OptionalDeps: RGX-Framework`. Register into shared registries, fire `RGX_MEDIA_UPDATED` for dropdown refresh. Existing LibSharedMedia packs work via `RGXSharedMedia` bridge automatically.

### Theme System (RGXTheme)

Named theme presets (Dark, Light, brand-specific). Central widget registry for `ApplyTheme()`. `RGX_THEME_CHANGED` message. Merges preset -> brand overrides -> user color-picker overrides. Builds on existing RGXDesign palette and RGXColors.

---

## Migration Status

### BLU v8.0.1 — 100%

Migrated: events, timers, hooks, slash, DB/profiles, combat protection, dropdowns, utility functions, sound muting.
Remaining: `core/sounds/sharedmedia.lua` (~830 lines, after dead Kitty-API removal) — RGXSharedMedia is now enabled (v2.0.0), so this local file can be dropped in the Tier 2 wire-up (#5).

### BattlePetUtility v2.3.20 — 65%

Migrated: events, timers, hooks, slash, DB/profiles, minimap, debug.
Not yet wired: RGXDropdowns (still uses EasyMenu/UIDropDownMenu), RGXFonts for font settings, RGXPetBattles (needs enabling first).

### ReputationLevelUp — 0%, migration target

Needs: TOC RequiredDeps, RGX:GetSound() registration, RGX:RegisterEvent(), RGX:RegisterSlashCommand(), RGXReputation callback hooks.

### CoordinationCloakUtility — 0%, migration target

Small utility addon. Needs: TOC RequiredDeps, basic event/timer/slash wiring.

---

## Completed This Cycle (v2.1.0)

| Feature | Description |
|---|---|
| All modules enabled | RGXCombat + 8 event callback modules (Achievement, LevelUp, Quest, Honor, Delves, Housing, TradingPost, Prey) loaded by XML — no dormant code remains |
| Dead-code removal | Removed fictional KittyGetSoundPacks/KittyRegisterSoundPack scan/hook from RGXSharedMedia (and BLU's local copy) |
| Timer-rule enforcement | Delves + Honor modules switched from raw `C_Timer.After` to `RGX:After` for budget/diagnostics consistency |
| Taint audit | Verified framework + BLU + BPU clean: only `hooksecurefunc`, no protected calls, combat-lockdown handling correct |

## Completed Earlier (v2.0.0)

| Feature | Description |
|---|---|
| RGX.Addon() factory | One-call addon bootstrap with DB, events, minimap, slash, options |
| Declarative options engine | Table-driven panel builder in RGXUI |
| Profile-aware DB proxy hardening | Metamethod guards, char support, profileIsGlobal mode |
| RegisterUnitEvent | Per-unit event filtering (UNIT_AURA for "player" only) |
| Database test harness | /rgx dbtest command |
| Deep-merge MergeTable | Recursive default fill replacing shallow nil-fill |
| MigrateDB | Version-based ordered migration system |
| Opt-in scroll container | scroll = true on tab wraps content in ScrollFrame |
| CreateDropdown widget | RGXUI wrapper around RGXDropdowns |

---

## Non-Goals

- Not a replacement for WoW's native APIs — RGX wraps where wrapping adds value, passes through otherwise
- Not AceComm / AceSerialization — addon-to-addon chat channel communication is niche, not planned
- Not a general-purpose Lua library — everything is WoW-specific
- Consuming addons should never need to understand RGX internals to benefit from it
- BLU_Classic will never use RGX-Framework — it is TBC Classic only and intentionally stays on Ace3
