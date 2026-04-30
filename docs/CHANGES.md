# v1.5.23 - 2026-04-29

## Bug Fixes

- **Font dropdown rebuilt on RGXDropdowns**: `Fonts:CreateFontDropdown` no longer
  uses legacy `UIDropDownMenuTemplate` directly. It now delegates to
  `RGX:GetDropdowns():CreateNestedDropdown`, which routes to
  `WowStyle1ArrowDropdownTemplate` on WoW 12.x (Retail/Midnight) and falls back
  to the legacy UIDropDownMenu path on Classic. This fixes font selection in both
  SQP and PB2 options panels on Retail where `UIDropDownMenu_Initialize` is no
  longer available without explicitly loading `Blizzard_UIDropDownMenu`.

---

# v1.5.22 - 2026-04-29

## Bug Fixes

- **IconTexture path corrected**: Added explicit `.tga` extension to the
  `IconTexture` TOC entry. The path `Interface\AddOns\RGX-Framework\media\logo`
  is now `Interface\AddOns\RGX-Framework\media\logo.tga` to match the actual
  file and WoW addon conventions.
- **Combat:OnComboPoints implemented**: Added the missing implementation for
  `Combat:OnComboPoints(fn)` which was documented in the header but not
  implemented. Registers callbacks for combo point changes via `UNIT_POWER_UPDATE`
  and `PLAYER_TARGET_CHANGED` events. Fires with signature `fn(current, max, unit)`.
- **Replaced direct C_Timer.After with RGX:After**: Updated
  `modules/reputation/reputation.lua`, `modules/sharedmedia/sharedmedia.lua`,
  and `modules/ui/options.lua` to prefer `RGX:After()` over direct
  `C_Timer.After()`. This ensures framework timer budgeting and diagnostics are
  applied consistently. Falls back to `C_Timer.After` only if RGX timer is
  unavailable. Added timer labels for diagnostics: "Reputation:_QueueCheck",
  "SharedMedia:QueueScan", "Options:RunSoon", "Options:DeferOptionsOpen".
- **Module access standardised (Issue 6A)**: Removed stale file-top
  `_G.RGXDropdowns` capture in `modules/fonts/fonts.lua` (replaced with lazy
  `RGX:GetDropdowns()` at the single call site). Replaced `_G.RGXDropdowns`
  fallback chain in `modules/textures/textures.lua` with `RGX:GetDropdowns()`.
  Replaced three `_G.RGXDesign` direct reads in `modules/ui/controls.lua` with
  `RGX:GetDesign()`. Added a clarifying comment in `modules/ui/options.lua`
  explaining why `GetUI()`/`GetDesign()` read `_G` directly (bootstrap timing).
  No behaviour change.

## Documentation

- **TryInit dormant calls documented (Issue 7A)**: Added comments in
  `core/initialization.lua` above the three `TryInit` calls for
  `RGXSharedMedia`, `RGXCombat`, and `RGXReputation` explaining that they are
  currently no-ops (modules not in XML) but are retained so re-adding a module
  to the XML loader automatically wires its `Init()` without requiring a
  parallel change here. No runtime change.
- **Optional module status documented (Issue 7)**: Corrected `README.md` to
  reflect that `PetBattles`, `SharedMedia`, `Combat`, and `Reputation` are not
  loaded in the default build (removed from `RGX-Framework.xml` at v1.5.18).
  Module table now marks these four with a `†` footnote explaining they return
  `nil` until re-added to the XML loader. Quick Start example updated to note
  the distinction between always-loaded and optional modules. No runtime change.
- **Font availability documentation corrected**: Updated `media/fonts/README.md`,
  `docs/description.html`, and `docs/FONT-SOURCES.md` to accurately reflect that
  10 bundled fonts are currently unavailable due to corrupted asset files.
  - Affected fonts: Audiowide-Regular, Cinzel-Regular, Merriweather-Regular,
    Merriweather-Bold, Montserrat-Regular, Montserrat-Bold, Orbitron-Regular,
    Oswald-Regular, PlayfairDisplay-Regular, PlayfairDisplay-Bold
  - These fonts are correctly blocked by `unavailableFonts` in
    `modules/fonts/fonts.lua` and will be re-enabled once valid font files are
    obtained from upstream sources.
  - The Google Fonts upstream repository now distributes these families as
    variable fonts (e.g., `Cinzel[wght].ttf`), requiring a separate asset
    replacement task to restore functionality.
- **README.md font count language cleaned up**: Removed "30+ bundled fonts"
  claims from overview, module table, and Font Coverage section. Replaced with
  neutral language that acknowledges some fonts are temporarily unavailable
  without implying a specific count of valid fonts.

---

# v1.5.21 - 2026-04-29

## Bug Fixes

- **Framework icon metadata**: Added the RGX `IconTexture` TOC entry pointing at
  `media/logo.tga` so WoW can use the new framework icon in addon notes/lists.
- **BLU-style font dropdown**: Replaced the custom RGX font popup with a
  `UIDropDownMenuTemplate` dropdown using category submenus, matching the BLU
  dropdown pattern and avoiding custom strata issues.

# v1.5.20 - 2026-04-29

## Bug Fixes

- **Dropdown font control restored**: Reverted the visible paged picker back to
  a compact RGX-owned dropdown button with a dropdown list, so addon font
  selection remains a dropdown UX instead of a separate/inline picker.

# v1.5.19 - 2026-04-29

## Bug Fixes

- **Visible font picker**: Replaced the popup-style RGX font dropdown with an
  always-visible paged picker so SQP/PB2 can show selectable font rows without
  relying on Blizzard dropdown/menu popup behavior.
- **Timer budget noise reduced**: Timer budget deferrals now use a quieter chat
  diagnostic and only report larger queues instead of raising BugSack-style
  error output for normal short deferrals.

# v1.5.18 - 2026-04-29

## Bug Fixes

- **Reduced runtime surface**: Disabled unused optional modules from the loader
  for current SQP/PB2/ETL testing: pet battles, shared media, combat, and
  reputation. The files remain in-tree, but they no longer initialize at login.

# v1.5.17 - 2026-04-29

## Bug Fixes

- **Font fallback loop fixed**: `Fonts:GetPath()` now falls back directly to the
  default/Friz path without recursively calling itself, preventing watchdog
  stalls when a saved or default font cannot be resolved.
- **Cached font lists**: Available and grouped font lists are cached after
  registration, reducing SQP/PB2 dropdown open cost.
- **Chat diagnostics**: RGX font init/dropdown/menu creation now prints
  total/available/default counts to chat, and blocked-action diagnostics also
  emit directly to chat.

# v1.5.16 - 2026-04-29

## Bug Fixes

- **Timer watchdog guardrail**: RGX timers now process within a per-frame budget
  and defer excess callbacks instead of trying to drain a large burst in one
  frame, reducing script-ran-too-long freezes during addon load/nameplate spikes.
- **Timer diagnostics**: Slow timer callbacks now report their label and elapsed
  time, and budget deferrals report queued timer counts for the next in-game
  reload test.
- **Blocked-action diagnostics**: RGX now listens for Blizzard blocked/forbidden
  action events and reports the blamed addon/function when Blizzard supplies it.
- **Template-free font reset button**: Shared font setting reset buttons now use
  RGX-owned frames/textures/font strings instead of Blizzard panel button
  templates.

# v1.5.15 - 2026-04-29

## Bug Fixes

- **Template-free font picker**: RGX font dropdowns now use plain frames,
  textures, and font strings only. This removes the remaining Blizzard dropdown
  and panel-button template dependencies from SQP/PB2 font selection.
- **Flat font menu data**: `CreateFontMenuItems()` now returns a flat list of
  selectable fonts so PB2's native right-click menu cannot lose nested font
  submenu entries.
- **Optional Settings registration**: RGX options panels can opt out of Blizzard
  Settings registration/opening for test builds that are hitting protected
  `Settings.OpenToCategory` blocks.

# v1.5.14 - 2026-04-29

## Bug Fixes

- **Native RGX font picker**: `Fonts:CreateFontDropdown()` now uses an
  RGX-owned button/popup picker instead of Blizzard dropdown/MenuUtil widgets,
  reducing Settings taint risk and giving SQP/PB2 one shared font-selection
  implementation.
- **Font asset filtering**: Excluded packaged font files that were accidentally
  saved as GitHub HTML pages, so addon dropdowns only list fonts WoW can load.
- **Font control enable state**: Shared font setting controls now enable/disable
  the new native picker correctly instead of only handling legacy dropdown
  frames.

# v1.5.13 - 2026-04-29

## Bug Fixes

- **Nested dropdown dispatch restored**: Re-added the public
  `Dropdowns:CreateNestedDropdown()` entry point so SQP/PB2 can build RGX font
  selectors again.
- **Retail dropdown taint reduction**: RGX now prefers the modern MenuUtil
  dropdown path on Retail/Midnight and no longer pre-generates menus while
  controls are being constructed.
- **Flatter font menus**: Font selectors now show category headers with direct
  family entries instead of category submenus, reducing menu depth and making
  PB2/SQP font choices easier to reach.
- **Packaged fonts restored**: All bundled RGX font files are marked available
  because the media folder contains the full registered font set.
- **Options pacing**: RGX options deferrals now prefer native `C_Timer.After`
  over the framework timer to reduce protected-action blame during Settings
  opens.

# v1.5.12 - 2026-04-29

## Bug Fixes

- **Font hot-path stability**: Cached RGX font path normalization, path lookup,
  and path resolution so nameplate events do not repeatedly rebuild the same
  font data during SQP plate updates.
- **Font dropdown hardening**: RGX now ignores malformed font entries while
  grouping nested dropdown items, preventing one bad registration from breaking
  addon options menus.
- **Protected UI safety**: Removed `securecall` from RGX safe wrappers and the
  Settings open path. The helpers now use combat deferral plus `pcall`, matching
  addon-safe behavior without protected-call attribution.
- **Startup event safety**: RGX now registers the combat-queue resume event
  lazily only when work is actually queued during combat.
- **Options chrome cleanup**: Removed the shared RGX options-panel close button
  so addon panels embedded in Blizzard Settings do not render an extra large X.

# v1.5.11 - 2026-04-28

## Bug Fixes

- **Settings open taint guard**: RGX no longer falls through into direct
  `SettingsPanel` show/open calls after `Settings.OpenToCategory()` succeeds
  with a nil return value, preventing protected Blizzard UI popups when addon
  minimap buttons open options.
- **Retail options fallback**: Retail clients now stop after the supported
  Settings API path instead of trying protected panel internals as a fallback.

# v1.5.10 - 2026-04-28

## Enhancements

- **BLU-style protected UI helpers**: Added RGX combat queue and safe wrappers
  for common frame/dropdown operations so addons can defer protected UI work
  until combat ends instead of duplicating the pattern.
- **Dropdown safety through framework**: RGX nested dropdowns and font controls
  now use the shared safe dropdown wrappers for initialize, refresh, enable,
  disable, close, and label updates.

## Bug Fixes

- **Blizzard Settings category opening**: Options panels now resolve the
  registered Settings category ID using the BLU fallback pattern, then try
  `Settings.OpenToCategory`, `SettingsPanel:OpenToCategory`, and legacy
  `InterfaceOptionsFrame_OpenToCategory` before falling back.
- **Combat-safe options opening**: Attempts to open RGX options during combat are
  queued and replayed after combat lockdown ends.

# v1.5.9 - 2026-04-28

## Bug Fixes

- **Blizzard Settings open path**: RGX options panels now prefer opening through
  Blizzard Settings by default again. Direct panel display is only a fallback when
  the Settings APIs cannot open the registered category.
- **Options open pacing**: Initial tab construction remains deferred to the next
  frame after the panel shows, and optional banner construction is queued shortly
  after that to reduce single-frame timeout risk.

# v1.5.8 - 2026-04-28

## Bug Fixes

- **Options registration without login timeouts**: RGX options panels now register
  with Blizzard Settings immediately but defer banner and tab content construction
  until the panel is shown.
- **Options open pacing**: Initial tab construction is deferred to the next frame
  after the panel shows, reducing single-frame `Backdrop.lua` timeout risk.
- **Options open fallback**: If the Blizzard Settings category cannot be opened,
  RGX now shows the panel directly instead of returning silently.
- **Framework text style menus**: Added reusable font/style/size menu builders so
  addons can expose text style selection through nested dropdown menus without
  duplicating font menu logic.

# v1.5.7 - 2026-04-28

## Bug Fixes

- **Unknown event fallback**: Unknown Blizzard events now return `false`
  silently through `RGX:RegisterEvent()` instead of opening an error dialog,
  allowing addons to probe fallback event names safely.
- **Style selector refresh**: RGX font style selectors now guard dropdown
  refresh calls so malformed or unavailable dropdown frames cannot crash PB2's
  text style options.
- **Options panel performance**: RGX options panels now lazy-build tab content
  when a tab is selected instead of constructing every tab during panel
  creation.

# v1.5.6 - 2026-04-28

## Bug Fixes

- **Font hot-path safety**: Font path reverse lookups now use a cached path map
  instead of scanning the full registry during nameplate/UI refreshes.
- **Font availability startup**: Removed load-time `SetFont()` probing from the
  normal init path and marks known bad bundled font files unavailable directly,
  preventing script-timeout cascades during login/nameplate creation.
- **Style dropdowns**: Text style outline/flag selection now uses the shared RGX
  nested dropdown instead of a custom menu frame.

# v1.5.5 - 2026-04-28

## Bug Fixes

- **Event registration safety**: RGX's central event frame is now named
  `RGXFrameworkEventFrame`, and event registration/unregistration is guarded so
  Blizzard API failures are reported with the event name instead of leaving
  stale handlers behind.
- **Init event routing**: RGX initialization and UI options injection now use the
  shared RGX event bus instead of creating extra raw `ADDON_LOADED` frames.

# v1.5.4 - 2026-04-28

## Enhancements

- **Chat prefix helper**: Added `RGX:CreateChatPrefix()` so addons can build a
  standard chat prefix with a single shared helper instead of hand-formatting
  texture tags and tag colors in each addon.
- **Default sizing**: The helper defaults addon chat icons to 16x16 to match the
  existing RGX addon style.
- **Font resolution helpers**: Added `RGXFonts:ResolveName()` and
  `RGXFonts:ResolvePath()` so addons can pass either saved font names or saved
  font paths and let the framework choose the available font path safely.

## Bug Fixes

- **Font dropdown validity**: Font availability now checks the return value from
  WoW's `SetFont()` probe, so invalid packaged font files are filtered out of
  grouped dropdowns instead of appearing selectable.
- **Nested dropdown compatibility**: RGX nested dropdowns now handle both
  string-key submenu registries and BLU-style table `menuList` payloads, and
  honor `keepShownOnClick` as an alias for `keepOpen`.

# v1.5.3 - 2026-04-25

## Options — Backward-Compat Fix (CreateAddHelper)

Tab content functions now receive the actual WoW frame extended with the
auto-layout helper methods, instead of a plain Lua proxy table.

This means:
- Old addons using `function(f) f:CreateFontString(...)` still work.
- Old addons using `CreateFrame("Frame", nil, f)` still work.
- New addons using `f:Toggle()`, `f:Slider()`, etc. still work.
- `f._frame` is set to `f` itself for any code that needs the raw frame.

## Options — Dynamic Centered Tab Layout

Tab buttons are now dynamically centered within each row. Each row is
measured and offset so the group is centered in the tab area. Positioning
updates automatically on `OnSizeChanged` so multi-row layouts with varying
tab counts per row all center independently. Max capacity remains 6 per row.
