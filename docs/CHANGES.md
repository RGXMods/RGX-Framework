# Changes

## Current Development Release

### [v2.6.1](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.6.1.md) - 2026-08-13

- Removed the mistaken secondary product concept. RGX-Framework releases only
  the addon framework; future public MCP/API/editor tooling belongs to Studio.
- Deterministic runtime verification now includes all six flavor TOCs.
- Corrected premature documentation claims: declarative `on` and `every` remain
  frozen future contract forms until their runtime implementation lands.

### [v2.6.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.6.0.md) - 2026-08-13

- Added capability-gated support and verified TOCs for Retail, Classic Era,
  TBC, Wrath/Titan, Cataclysm, and Mists Classic.

### [v2.5.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.5.0.md) - 2026-07-04

- **Fixed: declarative `minimap` buttons forgot their dragged position.** `RGX.Addon` created the button without passing `storage`, so the angle never persisted; creation now happens after `addon.db` exists and persists there by default. The bare form also assumes a left-click that opens your options panel, and a new advanced table form passes through the full minimap opts (`tooltip`, `defaultAngle`, `onRightClick`, ...).
- **Fixed: declarative `dropdown` controls saved but never visually restored their selection** — `value = addon.db[key]` was not passed, the exact save-without-restore bug class the framework exists to kill.
- **New `{ color = "dbKey" }` control** — the DSL now reaches `UI:CreateColorPicker`; default color assumed from the db defaults.
- **`slash` advanced form** — `slash = { "cmd", handler = function(addon, msg) ... end }` overrides the assumed open-the-panel handler.
- **Auto-derived SavedVariables names now strip non-identifier characters** (`"RGX-Hello"` → `RGXHelloDB`), matching what `rgx_generate_addon` emits. Hyphenated-name addons relying on the old raw concatenation should set `dbName` explicitly (RGX-Hello always has).
- **Progressive-disclosure principle and the BLU-proven layout model** (panel → tabs → multi-page tabs → 1–2 column cards → widgets) encoded in `CLAUDE.md`, `docs/DECLARATIVE-API.md`, and the schema; `docs/ACE3-ANALYSIS.md` gained a verified current-state parity map against Ace3.

### [v2.4.1](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.4.1.md) - 2026-07-03

- **Fixed: declarative slider `suffix` was silently dropped.** `{ slider = "volume", suffix = "%" }` in an `RGXAddon` options table validated fine and ran with no error, but the options-table-to-UI mapper only forwarded `key`/`label`/`min`/`max`/`step` to `UI:CreateSlider` — `suffix` never reached it, so no addon using it (including RGX-Hello's own Volume slider) ever actually showed the suffix. Found by running `tools/rgx-mcp` end-to-end against RGX-Hello's real, shipped opts table instead of a synthetic fixture.
- `schemas/rgx-addon.schema.json` now allows `suffix` on `sliderControl` (it was rejecting the same shipped, working key the schema itself hadn't caught up to).
- `rgx_generate_addon` gained a `dbName` override and `label`/`suffix` passthrough on generated sliders. Without an override it was emitting `RGX-HelloDB` (hyphen intact) as the SavedVariables hint for a name like "RGX-Hello", which doesn't match what any hyphenated addon should actually ship — it now strips non-identifier characters for the default and lets callers override explicitly.
- New `tools/rgx-mcp/test/test-rgx-hello.mjs` — drives the real server over the real MCP client SDK and points it at the actual RGX-Hello repo (generate/validate/audit), so future changes to the schema, the mapper, or the generator get checked against a real addon, not just synthetic input.

### [v2.4.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.4.0.md) - 2026-07-03

- **RGXColorPicker redesigned** with a modern circular control vocabulary (ring-and-fill drag handles on the SV box and hue bar, circular swatches and preview, hover feedback on presets, primary-themed focus states on the hex/RGB inputs) built on `RGXDesign` tokens instead of hardcoded colors, replacing the borrowed Blizzard minimize-button icon that was standing in for a cursor.
- **`UI:CreateLabel` fixed to actually wrap long text.** FontStrings with no explicit width auto-size to a single line and silently overflow their parent frame's edge instead of breaking — every multi-sentence label (e.g. the visual test harness's "What to test" hints) rendered past its panel. `CreateLabel` now accepts an opt-in `options.width` that enables `SetWordWrap` and justification; short labels are unaffected.
- **`tools/rgx-visual-test/` moved to the `RGX-Hello` repo**, merged into that addon rather than shipped as a separate in-tree dev tool — RGX-Hello is now both the minimal reference addon and the visual QA harness.
- **`tools/rgx-mcp/` now ships inside the packaged addon zip** (previously excluded). Addon authors who install RGX-Framework and want to build on it should already have the framework's MCP server on hand instead of needing a separate download.

### [v2.3.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.3.0.md) - 2026-07-03

- **New module: RGXTooltip** — tooltip composition (`Show`/`Attach`) replacing the `SetOwner → ClearLines → AddLine × N → Show` boilerplate found across 71 GameTooltip call sites in BattlePetUtility alone, plus a safe wrapper (`HookNative`) over Blizzard's `TooltipDataProcessor` for augmenting native item/spell/unit/aura/pet/mount/macro tooltips. Blizzard does not pcall-wrap `TooltipDataProcessor` dispatch, so `HookNative` pcall-guards every registered callback — one addon's tooltip hook can no longer break tooltip rendering for every other addon.
- **RGXColorPicker actually renders now.** `Show()` silently failed since the module was introduced — six frames called `:SetBackdrop()` without the required `BackdropTemplate` mixin, throwing partway through construction so the frame was never cached. With that fixed, two more stub features were exposed: the hue bar never had a rainbow (a hardcoded flat red — the original code's own comment admitted it was left unfinished), and the saturation/value box never had a saturation axis (only value/brightness worked). Both replaced with real gradients (a 6-segment hue rainbow, and a reactive white→hue `SetGradient` for saturation).
- **New dev tool: `tools/rgx-visual-test/`** — an in-tree QA harness for manually testing RGX's UI controls in-game (`/rgxvisual` full panel, `/rgxcolor` picker only). Not player-facing, excluded from the packaged zip.
- Documented the in-tree `tools/rgx-mcp/` MCP server and the Declarative API in README.md and description.html (shipped in v2.2.0, previously undocumented in either entry point).

### [v2.2.1](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.2.1.md) - 2026-07-02

- Packaging hotfix: the v2.2.0 zip leaked `docs/`, `schemas/`, and `tools/` — the packager's ignore matcher silently fails on directory entries with trailing slashes. Entries normalized; the zip now contains only the runtime (TOC, XML, core, modules, media, LICENSE).

### [v2.2.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.2.0.md) - 2026-07-02

- **rgx-mcp ships in-tree** at `tools/rgx-mcp/` — read-only MCP server (validate/audit/generate against the Simplicity Contract), excluded from the player zip; anyone with the checkout has the tool. Registered in `.mcp.json`.
- **CI: Discord notifications fixed** — the notify step now fails loudly on webhook rejection instead of silently succeeding (`curl` without `--fail` treated 4xx as success); avatar URL corrected; empty-secret guard added.
- Repaired double-encoded UTF-8 (mojibake) across 11 documentation files; deleted `docs/USAGE-BPU.md` in favor of the Tier 2 work item it described.
- **New module: RGXAuras** — taint-safe aura scanning and watching (`HasPlayerAura`/`GetPlayerAura` fast path, `HasAura`/`GetAura`/`IterateAuras` for any unit, `WatchUnit` incremental `UNIT_AURA` cache with `OnApplied`/`OnRemoved`/`OnUpdated` callbacks). Designed around Midnight's secret-aura restrictions: every potentially-secret field comparison stays behind an internal pcall boundary, so restricted units yield nil/false instead of taint. Generalizes BPU's `PlayerHasAuraSpellID` pattern; first rgx-mod trigger primitive.
- **`RGXAddon` global entry point** — line 1 of a consumer addon is the addon: `RGXAddon "MyAddon" { ... }` (curried form supported). Wraps `RGX.Addon`; per the frozen Simplicity Contract (`docs/DECLARATIVE-DSL.md`, `dsl` branch), the `local RGX = assert(...)` form is now the documented escape hatch, not the front door.
- **Declarative API contract shipped** — `schemas/rgx-addon.schema.json` (machine-checkable shape of the `RGXAddon` opts table; keys annotated `x-rgx-ships: today|tier4`, trigger vocabulary + control grammar encoded) and `docs/DECLARATIVE-API.md` (human reference for the shipped surface, verified against `core/core.lua`). This is Tier 5 #14 and the contract the external `rgx-mcp` tool validates against. Schema excluded from the packaged zip.
- `RGXSharedMedia` now fires the internal message `RGX_SHAREDMEDIA_UPDATED` after every scan so consumers can re-import bridge entries and refresh media pickers.
- Added `SM:ExcludeFolder(addonFolderName)` — consumers that manage their own media can exclude their AddOn folder from the generic scan so their paths are not re-bridged as duplicates. The framework's own folder is excluded by default.
- Packaging fixes: added missing `LICENSE.txt` (TOC already declared `X-License: MIT`); `.pkgmeta` now excludes agent/tool files (`CLAUDE.md`, `Home.md`, `.agents/`, `.claude/`, `graphify-out/`) from the zip, uses the valid `manual-changelog` key pointing at `docs/CHANGES.md`, and drops stale font-download instructions (fonts are committed under `media/fonts/`).
- Removed dead `KittyGetSoundPacks` / `KittyRegisterSoundPack` scan and hook from `RGXSharedMedia` — these globals never existed in any real addon; the generic addon-global scan already covers third-party sound packs.
- Enforced the framework's own "no `C_Timer`" rule: `RGXDelves:QueueLivesRefresh` and `RGXHonor:QueueCheck` now use `RGX:After` so deferred work is budgeted and diagnosable by the framework timer driver.
- Documented the design thesis in `CLAUDE.md`: the framework prevents taint and deprecated-API bugs by construction. Verified by audit that the framework (and consumers BLU, BPU) use only `hooksecurefunc`, no protected-function calls, with correct combat-lockdown handling.

### [v2.1.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.1.0.md) - 2026-06-30

- Enabled RGXCombat — combat enter/leave/kill/crit/low-health/execute/encounter callbacks now active for all consumers.
- Enabled 8 event callback modules that were dormant since v1.8.0: Achievement, LevelUp, Quest, Honor, Delves, Housing, TradingPost, Prey.
- All modules are now active in the XML loader. No dormant code remains in-tree.
- `TryInit("RGXCombat")` wired into initialization.lua between RGXSharedMedia and RGXPetBattles.
- Removed stale comment in initialization.lua that described RGXCombat as blocked during load screen (its Init() already defers via PLAYER_REGEN_ENABLED).

Full notes:
- [v2.1.0 changelog](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.1.0.md)

## Production Releases

### [v2.0.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0.md) - 2026-06-30

- Stable RGX 2.0 framework release for retail 12.0.7.
- Promotes the RGX.Addon, NewDatabase, event, timer, and runtime integration work out of alpha.
- Keeps unfinished callback modules out of the XML loader for a clean live load.
- Includes combat-safe event/runtime hardening and SharedMedia scan coalescing from the alpha cycle.

Full notes:
- [v2.0.0 changelog](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0.md)

### [v2.0.0-alpha.2](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0-alpha.2.md) - 2026-06-28

- SharedMedia startup scan now coalesces light/full rescans instead of doing the expensive generic pass immediately.
- Generic addon-global media scan is deferred until after `PLAYER_LOGIN`, reducing startup timer-slow warnings.
- Added scan-state guards so late media-provider loads can upgrade a pending scan without duplicating work.

Full notes:
- [v2.0.0-alpha.2 changelog](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0-alpha.2.md)

### [v2.0.0-alpha.1](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0-alpha.1.md) - 2026-06-11

- **RGX.Addon()** — one-call addon factory: auto-creates database, slash commands, minimap button from a single declarative table.
- **Declarative options engine** — table-driven panel builder with toggle, slider, dropdown, button, section, label controls, all auto-bound to `addon.db`.
- **Proxy fix** — `__newindex`/`__index` now guard internal fields (`_guard`, `_raw`, `_defaults`, `_callbacks`, `_onSwitch`) with `rawget`/`rawset` so they never leak into profile SavedVars.
- Fixed `MergeDefaults` → `MergeTable` (3 call sites — `MergeDefaults` was never defined).
- Added `database_test.lua` with 14 assertions, wired via `/rgx dbtest` command.
- `RGX.Addon()` now passes `opts.onSwitch` through to `NewDatabase`.
- Timer-slow threshold: 50ms → 250ms (SharedMedia:QueueScan ~207ms is normal I/O).

Full notes:
- [v2.0.0-alpha.1 changelog](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/2.0.0-alpha.1.md)

### [v1.9.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/1.9.0.md) - 2026-06-09

- **NewDatabase API** — `RGX:NewDatabase(name, defaults, opts)` with metamethod-based profile access, profile CRUD, cross-character `db.global`.
- Combat lockdown safety — `pcall(function() ... end)` closure pattern replaces raw C function reference.
- `RGXCombat` returned to dormant status.

### [v1.8.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/1.8.0.md) - 2026-06-09

- **BLU v7 migration foundation** — 10 callback modules (Achievement, LevelUp, Collectibles, Loot, Quest, Honor, Delves, Housing, TradingPost, Prey).
- Theme highlight tokens, combat safety guards.

### [v1.6.0](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/changelogs/1.6.0.md) - 2026-05-01

## Changes

- Reworked backend font handling to properly support shared bundled fonts across downstream addons.
- Improved RGX font registration, lookup, and UI application paths so addons can reliably consume the shared font system.
- Updated shared option UI behavior for tabs, buttons, labels, and reset controls.
- Restored framework tab sizing and label anchoring to the expected RGX defaults.
- Cleaned up button/tab text handling to avoid unintended wrapping, alignment drift, and inconsistent font-string anchors.
- Rewrote README.md as a polished entry point with links to the full wiki documentation.
- Added comprehensive wiki documentation: Architecture, API Reference, Fonts System, Dropdowns System, Theming & Design, Troubleshooting, and Migration Guide.
- Updated CurseForge description.html with current module list, font counts, and documentation links.
- Fixed stale file path references (modules/fonts/fonts.lua → modules/fonts/definitions.lua).
- Fixed inconsistent dormant module wording across all docs (standardized to "in-tree but not loaded by the XML loader").
- Fixed stale interface version in Super Simple example code (110002 → 120005).
- Standardized font count language across all docs (36 bundled + 8 WoW defaults = ~44 total, 10 blocked, ~34 available).

## Fixes

- Fixed shared font plumbing needed by BattlePetUtility and SimpleQuestPlates.
- Fixed RGX option tabs using widened dimensions and incorrect text alignment.
- Fixed non-icon option tab labels being left-aligned instead of centered.
- Fixed icon tab label padding regressions.
- Removed unintended word-wrap and font-string anchor changes from shared RGX controls.
- Verified touched RGX Lua files pass syntax validation.
