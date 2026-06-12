# Changes

## Current Development Release

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

## Production Releases

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

- Fixed shared font plumbing needed by PetBuddy2 and SimpleQuestPlates.
- Fixed RGX option tabs using widened dimensions and incorrect text alignment.
- Fixed non-icon option tab labels being left-aligned instead of centered.
- Fixed icon tab label padding regressions.
- Removed unintended word-wrap and font-string anchor changes from shared RGX controls.
- Verified touched RGX Lua files pass syntax validation.
