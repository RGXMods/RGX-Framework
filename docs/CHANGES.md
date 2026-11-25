# Changes

## Current Release

### [v2.20.0](changelogs/2.20.0.md) - 2026-11-24

- Registry-owned inventory counts, material aggregation and bag/item-data notifications are available through `RGX:GetInventory()` without adding a global alias.
- Unknown counts remain unknown; modern storage flags and item-info tuple positions are normalized by the existing compatibility owner.
- Shared event, timer and declarative callback diagnostics contain error formatting and error-handler acquisition failures.

### [v2.19.5](changelogs/2.19.5.md) - 2026-11-23

- DataBroker and Tooltip now isolate errors in callback-error formatting and reporting, so another consumer's callback or tooltip line still runs.
- Existing callback arguments, native hook registration and ordinary diagnostic output remain unchanged.

### [v2.19.4](changelogs/2.19.4.md) - 2026-11-22

- Timer-bar completion and cancellation callbacks are failure-isolated, so errors cannot skip cleanup or abort cancellation for unrelated bars.
- Natural expiry never invokes the cancellation callback when no completion callback is set.
- A lifecycle callback can restart its bar without cleanup of the old run hiding it.

### [v2.19.3](changelogs/2.19.3.md) - 2026-11-22

- `/rgxf debug` toggles framework diagnostics, including options-open timings, and keeps font debugging aligned. Diagnostic thresholds are unchanged.
- Source tooling no longer tracks an absolute workstation `node_modules` link. Dependencies install locally from the existing lockfile.

### [v2.19.2](changelogs/2.19.2.md) - 2026-11-22

- The consumer packager preserves `sounds/user/README.txt`, so custom-sound folders exist after extraction. Other text files remain excluded.
- Declarative `on` takes an advanced table form, `{ handler = fn, unit = "player" | { ... }, throttle = seconds }`: `unit` narrows a raw event to those units through the framework's unit events, `throttle` runs the handler at most once per window.

### [v2.19.1](changelogs/2.19.1.md) - 2026-11-19

- Event, message and unit-event handlers registered by method name run again (the method was resolved into the error slot, so every one of them was dropped).
- Declarative options: sliders, switches, text boxes, panel-opacity and colour controls use the control's own `default`, else the addon's declared `db` default (sliders saved their minimum, colours reset to the colour they had when the panel was built); page cards fill their grid column instead of keeping a fixed 300px width; tabs declared by name come in a stable order (General first, then by name) instead of a different order each load.
- Sliders and the volume slider call `onChange` only when the value changes, not when built, refreshed or held on the same step while dragging; `SetValue(nil)` resets a slider or text box to its default instead of storing the control; the volume slider gets its width; the game's colour picker fallback restores the colour on Cancel.
- Repeating timers fire once after a long frame gap (a loading screen) instead of catching up every missed period.
- `RGX:Split` treats its delimiter literally (`"."`, `"%"`).
- `RGX.API.GetSpellInfo`, `GetSpellCooldown`, `IsUsableSpell` and `GetItemInfo` keep every return value of the older client functions.
- A profile import that is not a profile table is refused instead of becoming the active profile; the import and export popups find the edit box on clients where it is `EditBox` or `GetEditBox()`.
- Docs: the declarative `db` needs a `## SavedVariables` line; `RGX:Hook` callback signature; four interface styles; the saved style and colours apply at login only while the override is on; brand-built UI redraws live; addons do not call `SetHighlightColor`; load order lists timer bars and the world map; maintainer checks include `arch-check`.
- `ADDON_LOADED` is registered when the framework loads, so a reload during combat no longer misses the addons' load events.
- Several addons can `RGX:Hook` the same function; the same callback is still installed once.
- Escape in a text input cancels the edit instead of saving it.
- An addon that registers two handlers for one event (or message) without ids keeps both; the same callback registered again replaces itself. Two owners with the same method name for one event both run.
- `RGX:MergeTable` keeps a saved non-table value (a saved `false`) instead of replacing it with a table default.
- Options panels reuse their tab buttons on a theme change in the same style, instead of making a new set every time.
- Options panels record where opening spends its time (`panel.openTimings`: category lookup, the open, showing; `panel.tabBuildTimings` per tab) and report phases over 250ms with `/rgxf debug` on, to find the slow first open on Forever (#49, #61).
- The release packer for test installs keeps a root `Bindings.xml`, which the client loads without a TOC entry (#127).
- The reference sync follows upstream when it replaces its history, without re-cloning (#125).
- World map pins validate before they are set: map ids and coordinates must be accessible finite numbers, the client must answer `CanSetUserWaypointOnMap` with true and `SetUserWaypoint` must report it was set (#124).
- Custom options content keeps its height through the shared reflow (#128).

### [v2.19.0](changelogs/2.19.0.md) - 2026-11-18

- **Live theme.** Addons register their brand once (`RGXDesign:RegisterBrand`) and build through it. Options pages (chrome, tabs, header, every tab's content), dropdown menus and addon windows follow the beta global theme override, the main colour and the interface style as soon as they change, without a reload. The Theme tab has a Reload UI button for anything that does not.
- **Styles own their shape.** RGX Material Round is rounded, RGX Framework is square, WoW Classic and WoW Forever use the game's own cut-corner frames. The separate corner selector is gone; the style list reads Material Round, RGX Framework, WoW Classic, WoW Forever.
- **Theme settings are saved, and applied only while the override is on.** The colour and style choices (Theme tab and `/rgx style`) no longer change the look of every addon while the override is off, the dropdowns show the saved choice, and turning the override on applies it at once.
- **Primary and secondary colours for the theme override.** The Theme tab has Primary color and Secondary color pickers (the framework colour picker) next to the Main color preset; the preset fills both, a pick replaces either, and every addon following the override builds with the pair (`Design:GetOverrideTheme`, `Design:ApplyOverrideTheme`).
- `RGXColors:OpenPicker` opens the framework's own colour picker (the RGX dialog) whenever it is loaded, so addons that ask the framework for a colour (Simple Quest Plates and others) no longer get the game's picker; the game's picker is used only when the framework picker is missing or the caller asks for opacity.
- **Standard sound layout.** `RGXSound.LAYOUT`, `Sound:AddonFolders`, `Sound:UserFolders` and `Sound:LayoutGroup` describe the folders every RGX addon uses (`sounds\wow_default`, `sounds\game`, `sounds\user`, and an `<Addon>_Sounds` folder beside the addon that updates never touch); `ResolveFile` takes `addon =` to search them. RGXSharedMedia lists the player's own files under `<Addon> User Sounds` (`SM:PackNameForPath`, `SM:RegisterUserSounds`).
- Dropdown menus follow the owning addon's brand: RGX Framework and Material Round draw their own box behind the menu rows; WoW Classic and WoW Forever keep the game's menu.
- Options pages: the page header, outer box and content area take the style's shape, and cards sit inside it with room on every side. WoW Forever tabs use the game's own top-facing options tabs.
- **WoW Forever is a layered window look.** Inside the client's metal frame, flat panels sit in layers of depth derived from each addon's own brand colour (frame, rows, panels, header, selected row, border, title), with tinted tooltip-border cards and flat header bands. `Design:LayeredPalette(primary)` exposes the layers. WoW Classic keeps the client's tiled backgrounds.
- WoW Forever and WoW Classic are built like the game's own windows: an outer frame (Forever: the client's metal window frame; Classic: the gold-edged dialog border) with inner inset frames for cards and the options content area.
- `UI:SkinTab` / `UI:PaintTab` give an addon's own tab buttons the active style's tab look.
- The sound scan names no other addon: it no longer carries a built-in list of other addons' sound packs or calls their registrars; the generic scan still finds sound files in installed addons.
- RGX-Framework uses no other library: the optional imports from other shared media and data-object libraries are removed (`Textures:ImportLibSharedMedia` is gone).
- `RGXWorldMap:SetWaypoint` / `ClearWaypoint` / `CanSetWaypoint` set the game's own map pin, and `RGXWorldMap:Nearest` finds the place nearest the player, so addons share one implementation.
- **Declarative triggers.** `RGXAddon` accepts `on = { login = fn, ["quest.turnin"] = fn, ... }`: each trigger word maps to one framework module, any UPPER_CASE key is a raw event, an unknown word or non-function handler is a load error, and one failing handler does not stop the others. The generator emits `on` stubs and raises the generated minimum to 2.19.0.
- **Declarative database adoption and control callbacks.** `RGXAddon` takes `legacyFlat = true` to adopt an addon's existing flat SavedVariables table into the Default profile once (including a table whose flat keys are the real choices while its profiles hold defaults), and every value control takes `onChange = function(addon, value)`, run after the value is stored, with failures reported rather than thrown into the widget.
- **Player sound files.** `RGXSound:ProbeFile(path)` and `RGXSound:ResolveFile(input, { folders = ... })` find a file the player copied in by the name they typed: the extension is optional and a wrong or doubled one (hidden extensions on Windows) is corrected, spaces, underscores and hyphens are interchangeable, a pasted full path or one starting at the folder's name works, folders are searched in order, and `deep = true` also looks inside the designated folder (a folder unzipped inside itself, `sounds`, `media\sounds` and similar); an exact name costs one probe and a miss stays bounded and report every path tried. A probe retries unmuted on a client that will not report on a muted file.
- Square windows have the same `SetPanelColor` recolour API as shaped ones.
- Addon CI runs each addon's `tests/*.test.lua` and `tests/*.test.mjs`, and fails a build that changes the framework's shared colour, reads its saved theme settings directly, or treats an unset override as on.
- The framework's version is kept where library files cannot overwrite it, so `RequireContract` and the settings header always report the installed version (an addon requiring 2.18.3 failed because the framework read as 1.0.0).

### [v2.18.3](changelogs/2.18.3.md) - 2026-11-14

- The global theme override is a **beta and off by default**: every RGX addon keeps its own default theme unless the Theme tab switch (now "Beta: override every RGX addon's theme") or `/rgx style override on` turns it on.
- RGX Classic and RGX Forever finish their client-art set: card titles sit over the client's divider line, the switch is the client's bar and knob (the mod's primary fills the bar when ON), the slider reset is the client's reset icon, and dropdown buttons use the client's input frame and arrow.

### [v2.18.2](changelogs/2.18.2.md) - 2026-11-14

- The framework settings page shows the framework version from its TOC (it showed 1.0.0).
- `/rgx style override on|off` is the "Apply the framework theme to addons" switch from chat.
- `/rgx style [framework|materialround|classic|forever]` shows or chooses the interface style from chat, the same saved choice as the Theme tab.
- **RGX Classic and RGX Forever use the game client's own art throughout**: sliders use the client's minimal slider bar and knob, and tabs the client's tab art. Classic draws the client's classic gold-edged dialog border on windows and the tooltip border on cards, so it no longer looks like Forever. `Design:UsesClientArt()` and `Design:SetAtlasOr()` are public.
- **RGX Classic and RGX Forever use the game client's own frame art.** Windows use the client's `Dialog` frame, cards the client's inset-frame (Forever) or tooltip border (Classic) layout, and buttons and tick boxes are the client's own `UIPanelButtonTemplate` and `UICheckButtonTemplate`; frames are laid out with `NineSliceUtil` (`Design:ApplyBlizzardFrame`). A client that lacks a layout or atlas gets the style's own frame art instead (new `panel_classic` textures). Dropdown triggers now follow the active style in every style, where they used a fixed navy fill.
- The Theme tab also shows when RGX Professions or RGX AQoL is loaded, because both now follow the framework interface style while "Apply the framework theme to addons" is on. Changing the style tells you to /reload for windows that are already open.
- Cards follow the interface style: in Material Round the card body is a rounded panel to match its rounded header band (it was always a square backdrop, so a rounded header sat on a square card). Other styles keep the square body.
- `UI:CreateStandardCard` no longer has an Addons-menu row: the entry is always on and is not an option.
- Tick box labels wrap inside the row and the row grows to fit, so long option text no longer runs past the card edge.
- `UI:CreateStandardCard` no longer offers a chat-prefix box: the prefix is the branded RGX prefix, not a setting.
- The Theme card on the framework settings page flows its rows (switch, two dropdowns, corner buttons, note) instead of fixed pixel offsets, so the dropdowns no longer overlap.
- `UI:CreateStandardCard` rows are now tick boxes, following the standard that switches belong in card headers.

### [v2.18.1](changelogs/2.18.1.md) - 2026-11-12

- Switches and tick boxes carry the addon's primary colour in every interface style (the switch used a fixed green/red).

### [v2.18.0](changelogs/2.18.0.md) - 2026-11-11

- New interface style **RGX Forever** (warm brown panels, bronze frame line, parchment text, accent-coloured card titles); a saved `forever` choice now selects it.
- The framework settings pages use one full-width column.
- Cards take a header module switch (`UI:CreateCard` `switch`) and tick boxes bind to saved values (`UI:CreateCheckbox` `storage`/`key`); RGX Forever draws framed cut-corner art.
- The framework theme is optional: a switch on the Theme tab (`themeOverride`) turns the saved colour, style and corners off.

### [v2.17.8](changelogs/2.17.8.md) - 2026-11-11

- RGX Material Round now rounds the controls inside options panels: switches, sliders, text boxes, checkboxes, reset chips and tab chips.
- The framework settings page is tabbed: About, Build with RGX, and Theme when a theme-following addon is loaded.

### [v2.17.7](changelogs/2.17.7.md) - 2026-11-11

- `UI:CreateOptionsPanel` takes `style` and remembers the interface style it was built in, so tab content built later keeps it (RGX Material Round panels no longer fall back to the default look).

### [v2.17.6](changelogs/2.17.6.md) - 2026-11-11

- The framework settings page shows its Theme card (main colour, interface style, corners) only when BLU or Simple Quest Plates is loaded.

### [v2.17.5](changelogs/2.17.5.md) - 2026-11-11

- A slider's reset button is anchored to the slider's own row, so it no longer sits 8px inside a card row and over the end of the track.

### [v2.17.4](changelogs/2.17.4.md) - 2026-11-11

- `UI:CreateOptionsPanel` takes `hideTabRow = true`: a one-tab panel hides its tab row so the page starts right under the header.

### [v2.17.3](changelogs/2.17.3.md) - 2026-11-10

- `UI:CreateStandardCard` takes `addonMenu = false` and `loginMessage = false` to omit those switches.

### [v2.17.2](changelogs/2.17.2.md) - 2026-11-10

- `RGX:CreateChat` prints the standard RGX prefix, `icon - [Label] message` (the `RGX:CreateChatPrefix` format), with `label`, `icon` and `tagColor` options.

### [v2.17.1](changelogs/2.17.1.md) - 2026-11-10

- `UI:CreateStandardCard` takes `description = false` and `prefix = false` to omit the muted line under the title and the chat-prefix box.

### [v2.17.0](changelogs/2.17.0.md) - 2026-11-10

- `UI:CreateStandardCard`: one card with the options every mod shares (minimap icon, Addons-menu entry, chat output, login message, chat prefix).
- `RGX:CreateChat`: addon chat with the shared prefix and on/off rules.

### [v2.16.0](changelogs/2.16.0.md) - 2026-11-09

- Minimap buttons can show or hide their Addons-menu entry at runtime (`SetCompartmentVisible`).
- New shared addon release kit: guide plus templates for the GitHub workflow, `.pkgmeta` and GitLab CI.

### [v2.15.2](changelogs/2.15.2.md) - 2026-11-07

- Rounded buttons keep the building mod's hover ring colour; `WithTheme` and `WithStyle` return the builder's results.

### [v2.15.1](changelogs/2.15.1.md) - 2026-11-07

- Every interface style is branded by the mod's own primary and accent colours. RGX Material Round's ring now follows `primary` and its card titles follow `accent`, instead of a fixed red and coral.

### [v2.15.0](changelogs/2.15.0.md) - 2026-11-07

- New **RGX Material Round** interface style (rounded cards, header bands and buttons on grey with the RGX red ring), a drop-in for every RGX addon.
- Styles are named **RGX Framework**, **RGX Material Round** and **RGX Classic**; `retail` and `forever` remain as aliases.
- Added `Design:WithStyle` for building one addon's UI in a style without changing the operator's choice.

### [v2.14.2](changelogs/2.14.2.md) - 2026-11-05

- Addons can pass their own palette to dropdown list frames (`ForceWidth` `opts.skin`) and inline buttons (`AddInlineButton` `opts.colors`).

### [v2.14.1](changelogs/2.14.1.md) - 2026-11-05

- Dropdown list frames opened through `ForceWidth` use the design-system theme, and inline Play buttons stay inside the row.
- Release zips avoid a boot-sector byte signature that Wago rejected.

### [v2.14.0](changelogs/2.14.0.md) - 2026-11-05

- Added `RGXLoot:OnItemLooted` (any new item) and `RGXHonor:OnHonorGain`; `OnRareLoot` no longer repeats for items that stay flagged new.
- The dropdown inline Play button is themed with the design system and keeps clear of the frame edge.
- Release tooling publishes the exact CurseForge and Wago game version per flavor.

### [v2.13.0](changelogs/2.13.0.md) - 2026-11-05

- Every button created with `RGXMinimap:Create` is now also listed in Blizzard's Addons menu on the minimap (the addon compartment), with the same icon, tooltip, left click and right click.
- Added `compartment = false` to opt a button out and `compartmentText` to set the menu label.
- Clients without the addon compartment are unchanged.

### [v2.12.0](changelogs/2.12.0.md) - 2026-11-03

- Added `onPreview` to `CreateNestedDropdown`: a Play/Stop button on each leaf with a value. Use `isPreviewing`, `previewLabel` and `previewStopLabel` to control it, and set `item.preview = false` to skip a row.
- Menus with `onPreview` use the UIDropDownMenu path, where the framework reserves row width for the button.
- Added `holder:RefreshPreviews()` to re-read Play/Stop labels after playback ends.
- Play buttons are cleared whenever a dropdown builds a menu level, because menu rows are shared between dropdowns.
- Documented the Play button API in `docs/DROPDOWNS.md`.

### [v2.8.2](changelogs/2.8.2.md) - 2026-10-19

- Added the declarative `compat` key: first callable global API path wins,
  optional normalize repacks return values, and missing paths fail before
  registration.
- The runtime package now ships the expanded `AGENTS.md` project entry point in
  place of `AGENT-DIRECTIVE.md`; the file count is unchanged.

### [v2.8.1](changelogs/2.8.1.md) - 2026-10-19

- Repaired the WoW reference cache and added inventory/freshness checks.
- Restored `modules/` for game-domain modules; library modules remain under
  `libraries/`.
- Namespaced framework slash commands as `/rgxframework` and `/rgxf`, keeping
  `/rgx` as a legacy alias.
- Colocated library-owned media and kept legacy font paths resolving.
- Added the shipped `AGENT-DIRECTIVE.md`; public APIs and client Interfaces are
  unchanged.

### [v2.8.0](changelogs/2.8.0.md) - 2026-10-17

- New `RGXTimers` library module (`RGX:GetTimers()`, global `RGXTimers`) adds
  frame-based countdown/progress bars that replace LibCandyBar-3.0 for consumer
  addons: native frame methods on every bar, completion and cancel callbacks,
  and `exp`/`start` stamps for pooled sorting.
- `docs/TIMERS.md` documents the module with a LibCandyBar mapping table; the
  API catalog gains the `timers` entry and an 11-scenario Lua 5.1 harness runs
  in `lua-runtime-check`.
- Current public APIs and client Interfaces are unchanged. No SavedVariables
  deletion is required.

## Recent Releases

### [v2.7.20](changelogs/2.7.20.md) - 2026-10-17

- Minimap buttons created through `RGX.Addon` now persist their visibility when
  the consumer addon does not declare its own database; storage falls back to
  the framework SavedVariables while consumer-owned databases keep their
  existing behavior.
- Lua 5.1 regression coverage documents the fallback; current public APIs and
  client Interfaces are unchanged. No SavedVariables deletion is required.

## Recent Releases

### [v2.7.19](changelogs/2.7.19.md) - 2026-10-17

- The login scan no longer treats the framework's own `RGXSharedMedia`
  registry as a generic addon global or re-bridges sound paths a live entry
  still claims, removing the redundant work flagged by the
  `[RGX:timer-slow] SharedMedia:QueueScan` budget warning.
- World-map pin and waypoint primitives (`RGXWorldMap`) ship with pin lifecycle
  on the world map and minimap plus a zone-data adapter over `C_Map` with a
  HereBeDragons-2.0 fallback for Classic-era clients.
- Picker Escape no longer collides with a module alias shortcut.
- Lua 5.1 regressions cover the fixes; current public APIs and client
  Interfaces are unchanged. No SavedVariables deletion is required.

### [v2.7.18](changelogs/2.7.18.md) - 2026-10-14

- Prevent adopting a database handle/live profile view as its own SavedVariables
  owner, avoiding a recursive C stack overflow while preserving saved values.
- Recovered metatable-poisoned profile stores remain writable, rather than
  silently dropping later settings changes.
- Lua 5.1 regressions cover both failures. Operator reports no issues after
  testing and explicitly approves stable publication; no detailed test matrix
  or independent in-game capture is claimed.

### [v2.7.17](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.17.md) - 2026-10-13

Player-accepted opt-in secure minimap item actions support preparation on one
click and item use on the next hardware click, without replacing secure OnClick.
Ordinary minimap consumers are unchanged; secure mutations are combat-guarded.

### [v2.7.16](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.16.md) - 2026-10-13

Retail 12.1.5 compatibility (Interface `120105`) and wiki-manifest publishing
fix; runtime unchanged from the v2.7.15 cycle.

### [v2.7.14](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.14.md) - 2026-10-06

Stable release of the beta-validated UI/minimap batch:

- `UI:CreateButton` selected-state support for option tabs and toggles.
- Minimap-button ownership respects minimap-button collectors; the backdrop frame
  background moves to `frame.backgroundTexture` for collector compatibility.
- Opt-in `legacyFlat` database migration preserves pre-existing flat settings
  when adopting profiles.
- Framework no longer prints its own startup banner to chat.

### [v2.7.13](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.13.md) - 2026-10-05

First stable release of the shared UI batch (tested as v2.7.13-beta.1/beta.2):

- Profiles panel preset pagination, confirmed per-row Delete, and
  create-from-current copying.
- Panel `Close()`/`Toggle()` through the safe-hide boundary, including the
  Settings-embedded host.
- New `UI:CreateSwitch` module toggles plus config gear/dialog chrome.
- Slider purpose labels visible with hover-only values; dropdown modern-menu
  restoration and reclaimed inline rows; card layout and reset alignment fixes.
- Regression coverage across profiles, controls, layout, dropdowns, options,
  reset/poison recovery, and six-flavor packaging.

### [v2.7.12](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.12.md) - 2026-10-03

- Fixed the CurseForge release upload (metadata must be a plain form
  value, not a file part), completing the distribution chain.
- Settings-embedded options panels now fill the canvas: no more double
  frame or extra background inside the game's Settings window.
- Taller 64px header band with the 42px square suite icon.
- Round/square suite icons regenerated with proper edge-keyed alpha.
- Runtime is consumer-agnostic and CI-enforced: no consumer addon names
  anywhere in core/ or modules/ Lua.
- Classic Era `11509` added to the base TOC.

### Language coverage

RGX-Framework ships complete WoW client locale coverage for its own
user-facing output across all twelve WoW client locales: enUS (base), deDE,
esES, esMX, frFR, itIT, koKR, ptBR, ptPT, ruRU, zhCN, zhTW. The same
coverage list is published in every flavor TOC's `## X-Localizations:`
header and in `README.md`. Consumer addons inherit the
`RGXLocale:NewLocale(addonName, locale, isDefault)` registry convention.

### [v2.7.10](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.10.md) - 2026-10-03

- Database self-heal: metatable-poisoned SavedVariables tables no longer
  loop every read into a C stack overflow; the corrupted entry is logged
  and rebuilt plain with defaults.
- Fixed `card:AutoHeight()` crashing layout construction with an
  arithmetic-on-table error.
- New framework chrome: `UI:CreateCloseButton`, `UI:CreateConfigButton`, and
  `UI:CreateConfigDialog` primitives; options panels consume the shared
  close button.
- Shipped suite brand icons `media/round.tga` (minimap) and
  `media/square.tga` (headers); Wago project ID registered.
- Architecture hardening: contract promoted to `contract/` with shared
  engines, MCP thinned to a transport adapter, module taxonomy + frozen
  31-global public surface + runtime boundary enforcement in shared CI.

### [v2.7.9](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.9.md) - 2026-09-29

- Hardened client metadata compatibility checks when APIs are unavailable.
- Applied framework accent borders to section headers.
- Documented flavor-specific consumer module and options boundaries.

### [v2.7.8](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.8.md) - 2026-09-25

- RGXDesign restyle: dark navy rounded
  nine-slice panels (12px corners via new `media/panel_rounded.tga`),
  cyan `#00e6ff` primary accent, gold secondary accent, Inter labels
  with locale-safe font fallback and soft text shadows.
- `Design:CreateFrame` rounds by default; pass `opts.square = true` for
  the legacy flat backdrop (exported `Design:ApplyBackdrop` unchanged).
- Minimap `Button:GetAngle` now reads the durable store before
  callback-backed sources, so dragged positions persist for every
  consumer path.
- New `Design:WithTheme(theme, fn)` scoped theme helper: an addon can
  apply its brand color while building its panel, and RGXDesign
  restores its defaults afterwards.
- Options panel tab buttons honor `panel.theme` at runtime: hover and
  active states resolve the panel brand `primary` instead of the
  shared RGXDesign default, and the build-time `Design:SetTheme` is
  restored after construction.

### [v2.7.7](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.7.md) - 2026-09-21

- Fixed the tonumber crash in compat.lua on WoW Forever beta clients. New RGX.API guarded module. Minimap positions prefer durable store. 101 runtime files.

### [v2.7.6](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.6.md) - 2026-09-20

- Durable minimap button positions across the suite: drag angles mirror into `RGXFrameworkDB.RGXMinimapPositions` and restore when an addon's own SavedVariables are lost.

### [v2.7.5](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.5.md) - 2026-09-17

- Added WoW Forever Beta compatibility (Interface `16001` client) via runtime capability detection while retaining Retail `120100` manifest support.
- Uses the interface capability rather than client build `69893` to suppress restricted CLEU registration.
- Skips the generic SharedMedia global scan on Forever to avoid the measured startup hitch.

### [v2.7.4](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.4.md) - 2026-08-23

- Standardized framework chat output as `{icon} - [RGX] {message}` through
  `RGX:CreateChatPrefix()`.
- Added a persistent global login-message gate with `/rgx login on|off|status`
  and the `IsLoginMessagesEnabled`, `SetLoginMessagesEnabled`, and
  `LoginMessage` APIs.
- Routed declarative `welcome` output through the login gate and reduced
  framework startup output to one gated, metadata-derived line.
- Added Lua 5.1 runtime coverage for persistence, command confirmations,
  declarative welcome behavior, prefix formatting, and startup deduplication.

### [v2.7.3](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.3.md) - 2026-08-22

- Fixed `ADDON_ACTION_FORBIDDEN` from the v2.7.2 event-lifecycle flush: deferred
  native registrations now run only from an anonymous next-frame driver, never
  while unwinding an event dispatch, timer dispatch, combat, or pet battle.
- Registration success is verified with `IsEventRegistered`; unsupported or
  repeatedly rejected events are dropped after a bounded attempt cap instead of
  retrying forever. The 2.7.2 deferral guarantee is preserved one frame later.
- Retail no longer registers `COMBAT_LOG_EVENT_UNFILTERED`: new flavor-gated
  `combatLogEvent` capability, `RGXCombat` skips CLEU on Retail 12.x, and
  `RGXCombat:HasCombatLogEvents()` exposes the degraded surface.
- Event-lifecycle runtime coverage extended from 35 to 66 checks.
- Published assets are `RGX-Framework-v2.7.3.zip` and `release.json`; the addon
  archive contains 100 runtime files and all six flavor TOCs.

### [v2.7.2](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.2.md) - 2026-08-22

- Fixed deferred WoW frame-event registrations created during framework event
  dispatch. Consumer events registered from `PLAYER_LOGIN`,
  `PLAYER_ENTERING_WORLD`, or another handler now become native frame events
  immediately after the outermost safe dispatch returns.
- Extended the same lifecycle guarantee to registrations created inside RGX
  timer callbacks, closing the second path that could strand callbacks in
  `pendingFrameEvents`.
- Made unit-event unregistration clean up pending and native frame state
  symmetrically while preserving a shared registration when regular handlers
  still exist for the same event.
- Added 35 Lua 5.1 event-lifecycle checks covering login bootstrap, nested
  dispatch, unit events, timers, combat deferral, shared handlers, and
  removal-before-flush. Existing 166 timer and 86 restricted-aura checks remain
  green.
- Published assets are `RGX-Framework-v2.7.2.zip` and `release.json`; the addon
  archive contains 100 runtime files and all six flavor TOCs.

### [v2.7.0](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.7.0.md) - 2026-08-15

- Added declarative named repeating timers with deterministic ordering,
  lifecycle binding, metadata, self-cancellation, and failure isolation.
- Hardened RGXAuras into an accessible-only restricted-value boundary and added
  the corresponding Lua 5.1 runtime and source-conformance coverage.

### [v2.6.2](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.6.2.md) - 2026-08-14

- Synchronized distribution documentation and hardened release/package
  validation across the six supported WoW flavors.

### [v2.6.1](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.6.1.md) - 2026-08-13

- Restored the single-product framework distribution boundary and aligned
  deterministic package verification.

### [v2.6.0](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.6.0.md) - 2026-08-13

- Added capability-gated support and verified TOCs for Retail, Classic Era,
  TBC, Wrath/Titan, Cataclysm, and Mists Classic.

### [v2.5.1](https://github.com/RGXMods/RGX-Framework/blob/main/docs/changelogs/2.5.1.md) - 2026-08-12

- Added the cross-version compatibility layer, hardened aura payload access,
  and shipped accumulated UI and pet-battle fixes.

## Historical Release Notes

Full per-version notes remain in [`docs/changelogs/`](https://github.com/RGXMods/RGX-Framework/tree/main/docs/changelogs), including releases from v1.x through v2.5.0. The 2.7.13 beta channel (beta.1, beta.2) was promoted to stable as v2.7.13; its notes remain in [`docs/changelogs/`](https://github.com/RGXMods/RGX-Framework/tree/main/docs/changelogs).

## Historical Beta - v2.7.15-beta.4

The prior opt-in beta preceded the v2.7.15 release line. See
[beta notes](changelogs/2.7.15-beta.4.md) for additions and tester checks.
