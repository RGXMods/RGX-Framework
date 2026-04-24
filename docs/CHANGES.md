# v1.2.0 - 2026-04-24

## New Modules
- **RGXDataBroker** — drop-in replacement for LibDataBroker-1.1, no LibStub dependency. `DB:NewDataObject(name, attrs)` returns a live proxy table where any field write fires `OnAttributeChanged` callbacks automatically. `DB:OnNewDataObject(fn)` / `DB:OnAttributeChanged(fn)` for display addon hooks. Optional bridge: if LibDataBroker-1.1 is already loaded by another addon, new data objects are automatically mirrored to it. Accessible via `RGX:GetDataBroker()` / `_G.RGXDataBroker`.

## UI
- `RGXUI:CreateOptionsPanel` — added `bannerHeight` / `banner` opts: inserts a styled frame between the header and tab row; `banner(frame)` callback fills it. Tab area anchors to the banner frame when present.
- `RGXUI:CreateOptionsPanel` — added `onSelect` per-tab callback: fires when a tab becomes active (after content is shown/refreshed).

## Core
- Added `RGX:GetDataBroker()` shortcut and `databroker` module alias (`RGXDataBroker` global).

# v1.1.0 - 2026-04-23

## New Modules
- **RGXPetBattles** — Battle pet event library: level-up detection, capture events, battle start/end callbacks, pet journal scanning utilities. Designed for any addon that reacts to pet battle events without wiring raw events.

## Dropdowns
- Rewrote `CreateNestedDropdown` with full item-type support: separators, headers, icons, per-item color codes, `keepOpen` flag.
- Added `Dropdowns:ForceWidth(level, minWidth, leftInset, opts)` — auto-sizes UIDropDownMenu list frames and buttons after WoW renders them (inspired by BLU's dropdown utility).
- Added `Dropdowns:GetListFrame(level)` — safe lookup of WoW dropdown list frames.
- Added `Dropdowns:ShortenLabel(text, maxChars)` — text truncation with ellipsis.
- Added `Dropdowns:AddInlineButton(buttonFrame, opts)` — attaches custom inline buttons (preview, delete, etc.) to dropdown item frames, cached per-frame and re-used on re-render.
- Added `Dropdowns:HideInlineButtons(level, key)` — hides all inline buttons for a given level before re-populating.
- Added `autoWidth` option on `CreateNestedDropdown` — automatically calls `ForceWidth` after each level renders.
- Added `onButtonCreated` callback on `CreateNestedDropdown` — fires after each leaf item is added so callers can attach inline widgets.

## Fonts
- Added `Fonts:GetInfo(name)` — returns the full registry entry for a font name (path, displayName, family, category, license, available).

## Core
- Added `RGX:GetPetBattles()` and `RGX:GetMinimap()` shortcuts.
- Added `petbattles` and `minimap` to module alias table (`RGXPetBattles`, `RGXMinimap` globals).

## New Modules (continued)
- **RGXMinimap** — one-call minimap button: circular drag, persistent angle, tooltip builder, show/hide with stored enabled state. Flat storage (`storage + angleKey + enabledKey`) or custom `getAngle`/`setAngle` callbacks. Full click handler surface: `onLeftClick`, `onRightClick`, `onCtrlRight`, `onVisibilityChanged`.
- **RGXSharedMedia** — multi-type media registry and external addon scanner.
- **RGXDesign** — visual building block system using the static RGX palette (#58be81/#bc6fa8). `Design:CreateFrame`, `Design:CreateButton`, `Design:CreateSectionHeader`, `Design:CreateDivider`, `Design:CreateSection`, `Design:ApplyBackdrop`, `Design:Unpack(colorKey)`.
- **Options Panel** (`RGXUI:CreateOptionsPanel`) — builds a fully styled, tabbed WoW options window from a declarative config. Handles retail Settings API and classic InterfaceOptions. `panel:Open`, `panel:SelectTab`, `panel:SelectTabByName`, `panel:InvalidateAllTabs`, `panel:Refresh`.
- **RGXCombat** — combat event library. Zero-boilerplate: `Combat:OnEnter`, `Combat:OnLeave`, `Combat:OnKill`, `Combat:OnPlayerDied`, `Combat:OnPlayerDamaged`, `Combat:OnPlayerHealed`, `Combat:OnCrit`. `Combat:IsInCombat()`, `Combat:GetDuration()`. Parses COMBAT_LOG_EVENT_UNFILTERED automatically.
- **RGXReputation** — reputation and renown tracking. Normalizes `C_Reputation` across expansions. `Rep:OnRankUp`, `Rep:OnGain`, `Rep:OnRenownUp`. `Rep:GetAll()`, `Rep:Get(id)`, `Rep:GetByName(name)`, `Rep:IsMaxed(id)`, `Rep:GetRenown()`. Includes renown support for major factions (DF/TWW).

## Core
- Added `RGX:GetDesign()`, `RGX:GetCombat()`, `RGX:GetReputation()` shortcuts.
- Centralized module `Init()` dispatch in `initialization.lua` — all modules with an `Init` method are called in correct load order. No LibStub/LibSharedMedia dependency. Supports `sound`, `statusbar`, and `font` media types (extensible). Scans for sounds from KittyRegisterSoundPack addons, DBM pack registrars, known compat addons (Prat-3.0, TradeSkillMaster), and generic addon global crawl. Public API: `SM:Register`, `SM:RegisterPack`, `SM:RegisterSoundPack`, `SM:Fetch`, `SM:Find`, `SM:List`, `SM:ListPacks`, `SM:GetPath`, `SM:Scan`, `SM:QueueScan`.

# v1.0.2 - 2026-04-23

## Changes
- Stabilized RGX module resolution.
- Added defensive nil checks and retry logic for Font module access.

# v1.0.1 - 2026-04-23

## Changes
- TOC bump for interface 120005.
