# RGX-Framework

**One dependency. Everything your addon suite needs.**

RGX-Framework is a modern, self-contained WoW Retail addon framework â€” an alternative to Ace3 covering events, timers, hooks, slash commands, minimap buttons, options panels, database, and data broker, plus a full media stack (fonts, colors, textures, sound), dropdown menus, UI controls, and a visual design system. It is not a player-facing addon â€” it loads silently and exposes an API.

---

## Quick Start

**1. Declare the dependency:**

```toc
## RequiredDeps: RGX-Framework
```

**2. Declare your addon — one call:**

```lua
-- Line 1 of MyAddon.lua is the addon. RGXAddon is a framework-provided
-- global; RequiredDeps guarantees it exists. No local, no assert.
local addon = RGXAddon("MyAddon", {
    slash   = "myaddon",              -- /myaddon opens the options panel
    minimap = "Interface\\AddOns\\MyAddon\\media\\logo.tga",
    db      = { enabled = true, volume = 80 },   -- SavedVariables proxy on addon.db
    options = {
        General = {
            { section = "Settings" },
            { toggle = "enabled", label = "Enable Addon" },
            { slider = "volume",  label = "Volume", min = 0, max = 100 },
        },
    },
    welcome = "loaded â€” /myaddon for options",
    onInit  = function(self)
        self:RegisterEvent("PLAYER_LOGIN", function()
            self:Print("Ready!")
        end)
    end,
})
```

That is a **complete addon**: profile-aware saved settings, a tabbed options panel with db-bound controls, a slash command, a minimap button, and branded chat output â€” with every event, timer, and control routed through the framework's taint-safe paths automatically. The `addon` object carries scoped `RegisterEvent` / `RegisterUnitEvent` / `RegisterMessage` / `After` / `Every` / `Print` / `Warn` / `Error` so you never touch raw WoW plumbing.

> The declarative surface grows each release (framework roadmap Tier 4 adds declarative `events`/`timers` tables and grid card layouts). Anything not yet declarative is available Ã  la carte below.

**3. Ã€ la carte â€” individual systems when you need them:**

```lua
-- Events (id string enables targeted unregistration)
RGX:RegisterEvent("PLAYER_LOGIN", function() print("logged in") end, "myAddon-login")

-- Timers
RGX:After(1.0, function() print("one second later") end)

-- Fonts â€” one-line DB-bound style UI, one-line application
local Fonts = RGX:GetFonts()
Fonts:AttachStyleSelector(parent, db, "titleText")
Fonts:ApplyStyle(myLabel, db.titleText)

-- Colors
myFontString:SetTextColor(RGX:GetColors():GetRGB("primary"))

-- Minimap button with custom click handling
RGX:CreateMinimapButton({
    name = "MyAddonMinimap",
    icon = "Interface\\AddOns\\MyAddon\\media\\logo.tga",
    onLeftClick = function() myPanel:Open() end,
})

-- Slash command with a custom handler
RGX:RegisterSlashCommand("myaddon", function(msg) print("/myaddon:", msg) end, "MYADDON")
```

For module-dependent code, wrap in `OnReady`:

```lua
RGX:OnReady(function()
    local Fonts = RGX:GetFonts()
    local Colors = RGX:GetColors()
    local Textures = RGX:GetTextures()
    local Drops = RGX:GetDropdowns()
    local UI = RGX:GetUI()
    local MM = RGX:GetMinimap()
end)
```

Core-only APIs (events, timers, hooks, slash commands) are available immediately â€” no `OnReady` needed.

---

## What It Provides

| Category | Details |
|---|---|
| **Lifecycle** | `OnReady`, `OnLogin`, module readiness tracking |
| **Events & Messages** | Blizzard event registration + internal message bus + module-local emitters |
| **Timers** | `After`, `Every`, `CancelTimer` â€” native OnUpdate driver, no C_Timer |
| **Hooks** | Post-hooks via `hooksecurefunc` â€” safe for Blizzard UI functions |
| **Slash Commands** | `RegisterSlashCommand` â€” no raw SLASH_X boilerplate |
| **Combat Queue** | `QueueForCombat`, `SafeShow`, `SafeHide`, `SafeSetPoint`, and more |
| **Fonts** | 40 bundled + 4 WoW defaults (44 total), 10 blocked in unavailableFonts, grouped dropdowns, style objects |
| **Colors** | Named palette, class/quality/power colors, color math, wrapping, picker integration |
| **Textures** | Statusbar registry, LibSharedMedia import, dropdown controls |
| **Dropdowns** | Nested UIDropDownMenu with auto-width, inline buttons, dual-schema items |
| **UI Controls** | Slider, toggle, label, dropdown, color picker, section, preview, reset button |
| **Options Panels** | Tabbed settings windows registered with WoW Settings |
| **Minimap** | Circular-drag buttons with persistent angle, tooltip, show/hide |
| **Design** | Static brand palette (`primary`, `accent`, `border`, etc.) + visual building blocks |
| **DataBroker** | LibDataBroker-compatible proxy data sources |
| **Sound** | Level-up sound system with variant playback and SavedVar integration |

---

## Module Reference

| Module | Global | `RGX:Get*()` | Status |
|---|---|---|---|
| Core | `RGXFramework` | â€” | Active |
| Fonts | `RGXFonts` | `GetFonts()` | Active |
| Colors | `RGXColors` | `GetColors()` | Active |
| Textures | `RGXTextures` | `GetTextures()` | Active |
| Dropdowns | `RGXDropdowns` | `GetDropdowns()` | Active |
| UI | `RGXUI` | `GetUI()` | Active |
| ColorPicker | `RGXColorPicker` | `GetColorPicker()` | Active |
| Minimap | `RGXMinimap` | `GetMinimap()` | Active |
| Design | `RGXDesign` | `GetDesign()` | Active |
| DataBroker | `RGXDataBroker` | `GetDataBroker()` | Active |
| Sound | `RGXSound` | `GetSound()` | Active |
| SharedMedia | `RGXSharedMedia` | `GetSharedMedia()` | Active |
| PetBattles | `RGXPetBattles` | `GetPetBattles()` | Active |
| Combat | `RGXCombat` | `GetCombat()` | Active |
| Reputation | `RGXReputation` | `GetReputation()` | Active |
| Achievement | `RGXAchievement` | `GetAchievement()` | Active |
| LevelUp | `RGXLevelUp` | `GetLevelUp()` | Active |
| Collectibles | `RGXCollectibles` | `GetCollectibles()` | Active |
| Loot | `RGXLoot` | `GetLoot()` | Active |
| Quest | `RGXQuest` | `GetQuest()` | Active |
| Honor | `RGXHonor` | `GetHonor()` | Active |
| Delves | `RGXDelves` | `GetDelves()` | Active |
| Housing | `RGXHousing` | `GetHousing()` | Active |
| TradingPost | `RGXTradingPost` | `GetTradingPost()` | Active |
| Prey | `RGXPrey` | `GetPrey()` | Active |

As of **v2.1.0**, every in-tree module is loaded by the XML loader. There are no dormant modules.

---

## Font Coverage

**Available (19 families, 30 names):**

Sans/UI: Inter, Ubuntu, Liberation Sans, DejaVu Sans, DejaVu Sans Condensed, Lato, Poppins, Rajdhani
Serif: Crimson Text
Monospace: IBM Plex Mono, JetBrains Mono
Display: Bebas Neue, Bangers, Creepster, Anton
Pixel: Press Start 2P, Silkscreen, VT323
Fantasy: Uncial Antiqua
WoW defaults: Friz Quadrata, Arial Narrow, Morpheus, Skurri

**Temporarily unavailable (10 fonts with corrupted assets):** Montserrat, Merriweather, Playfair Display, Oswald, Orbitron, Audiowide, Cinzel â€” blocked in `unavailableFonts` until asset files are replaced.

Total: 40 bundled (30 available + 10 blocked) + 4 WoW defaults (Friz Quadrata, Arial Narrow, Morpheus, Skurri) = 44 registered, 34 selectable.

Font pack addons can extend the registry at runtime with `Fonts:RegisterFontPack(addonName, defs)`.

---

## Wiki

Full documentation lives in the [`docs/`](docs/) directory:

### Getting Started

- **[Super Simple Integration](docs/SUPER-SIMPLE.md)** â€” the absolute minimum code to use RGX
- **[Migration Guide](docs/MIGRATION.md)** â€” moving from Ace3, LibSharedMedia, or standalone implementations

### Core Systems

- **[Architecture](docs/ARCHITECTURE.md)** â€” load order, module registration, `...` varargs pattern, lifecycle, timer driver, event dispatch, combat queue
- **[API Reference](docs/API.md)** â€” complete public API by module (every method, every parameter)
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** â€” common issues and fixes

### Module Deep-Dives

- **[Fonts System](docs/FONTS.md)** â€” registry, blocklist, style objects, dropdown schemas, UI controls, flag helpers, dual-schema design
- **[Dropdowns System](docs/DROPDOWNS.md)** â€” nested menus, auto-width, inline buttons, item normalization, MenuUtil vs legacy compat
- **[Theming & Design](docs/THEMING.md)** â€” color palette, font styling conventions, texture system, consistent UI patterns

### Design & Philosophy

- **[Foundation Decisions](docs/FOUNDATION.md)** â€” what RGX keeps vs drops from Ace3, and why
- **[Ace3 Analysis](docs/ACE3-ANALYSIS.md)** â€” how each Ace3 piece maps to RGX, and where RGX aims to be better
- **[Roadmap](docs/ROADMAP.md)** â€” profile/database system, SharedMedia drop-in, pack system, localization, longer-term plans

### Other

- **[Changelog](docs/CHANGES.md)** â€” current version release notes
- **[Font Sources & Licenses](docs/FONT-SOURCES.md)** â€” attribution for all bundled fonts
- **[BattlePetUtility Integration](docs/USAGE-BPU.md)** â€” BPU-specific usage notes

---

## Compatibility

- **WoW Retail only**
- Interface version: `120007`
- `C_AddOns.GetAddOnMetadata` and `GetAddOnMetadata` both handled
- `ColorPickerFrame` old API and `ColorPickerInteraction` new API both handled
- `Settings.RegisterCanvasLayoutCategory` and `InterfaceOptions_AddCategory` both handled

---

## Support

- **GitHub:** https://github.com/DonnieDice/RGX-Framework
- **Issues:** https://github.com/DonnieDice/RGX-Framework/issues
- **Discord:** https://discord.gg/N7kdKAHVVF

---

## License

MIT for framework code. Bundled fonts retain their own open licenses â€” see [docs/FONT-SOURCES.md](docs/FONT-SOURCES.md) for attribution.
