# RGX-Framework

**One dependency. Everything your addon suite needs.**

RGX-Framework is a modern, self-contained WoW Retail addon framework — an alternative to Ace3 covering events, timers, hooks, slash commands, minimap buttons, options panels, database, and data broker, plus a full media stack (fonts, colors, textures, sound), dropdown menus, UI controls, and a visual design system. It is not a player-facing addon — it loads silently and exposes an API.

---

## Quick Start

**1. Declare the dependency:**

```toc
## RequiredDeps: RGX-Framework
```

**2. Get the framework:**

```lua
local RGX = assert(_G.RGXFramework, "MyAddon: RGX-Framework not loaded")
```

**3. Use it:**

```lua
-- Events
RGX:RegisterEvent("PLAYER_LOGIN", function() print("logged in") end, "myAddon-login")

-- Timers
RGX:After(1.0, function() print("one second later") end)

-- Fonts
local Fonts = RGX:GetFonts()
local path = Fonts:GetPath("Inter-Regular")
myFontString:SetFont(path, 14, "OUTLINE")

-- Or the one-line style path:
Fonts:AttachStyleSelector(parent, db, "titleText")
Fonts:ApplyStyle(myLabel, db.titleText)

-- Colors
local Colors = RGX:GetColors()
myFontString:SetTextColor(Colors:GetRGB("primary"))

-- Minimap button
RGX:CreateMinimapButton({
    name = "MyAddonMinimap",
    icon = "Interface\\AddOns\\MyAddon\\media\\logo.tga",
    onLeftClick = function() myPanel:Open() end,
})

-- Slash command
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

Core-only APIs (events, timers, hooks, slash commands) are available immediately — no `OnReady` needed.

---

## What It Provides

| Category | Details |
|---|---|
| **Lifecycle** | `OnReady`, `OnLogin`, module readiness tracking |
| **Events & Messages** | Blizzard event registration + internal message bus + module-local emitters |
| **Timers** | `After`, `Every`, `CancelTimer` — native OnUpdate driver, no C_Timer |
| **Hooks** | Post-hooks via `hooksecurefunc` — safe for Blizzard UI functions |
| **Slash Commands** | `RegisterSlashCommand` — no raw SLASH_X boilerplate |
| **Combat Queue** | `QueueForCombat`, `SafeShow`, `SafeHide`, `SafeSetPoint`, and more |
| **Fonts** | 36 bundled + 8 WoW defaults (~44 total), 10 blocked in unavailableFonts, grouped dropdowns, style objects |
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
| Core | `RGXFramework` | — | Active |
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
| PetBattles | `RGXPetBattles` | `GetPetBattles()` | Dormant |
| SharedMedia | `RGXSharedMedia` | `GetSharedMedia()` | Dormant |
| Combat | `RGXCombat` | `GetCombat()` | Dormant |
| Reputation | `RGXReputation` | `GetReputation()` | Dormant |

Dormant modules are in-tree and fully implemented but not loaded by the XML loader (removed from the XML loader at v1.5.18 to reduce runtime surface). Their `Get*()` accessors return `nil`. Re-enabling is a one-line XML change per module.

---

## Font Coverage

**Available (14 families, 26 names):**

Sans/UI: Inter, Ubuntu, Liberation Sans, DejaVu Sans, Lato, Poppins, Rajdhani
Serif: Crimson Text
Monospace: IBM Plex Mono, JetBrains Mono
Display: Bebas Neue, Bangers, Creepster, Anton
Pixel: Press Start 2P, Silkscreen, VT323
Fantasy: Uncial Antiqua
WoW defaults: Friz Quadrata, Arial Narrow, Morpheus, Skurri

**Temporarily unavailable (10 fonts with corrupted assets):** Montserrat, Merriweather, Playfair Display, Oswald, Orbitron, Audiowide, Cinzel — blocked in `unavailableFonts` until asset files are replaced.

Total: 36 bundled (26 available + 10 blocked) + 8 WoW defaults = ~44 registered, ~34 selectable.

Font pack addons can extend the registry at runtime with `Fonts:RegisterFontPack(addonName, defs)`.

---

## Wiki

Full documentation lives in the [`docs/`](docs/) directory:

### Getting Started

- **[Super Simple Integration](docs/SUPER-SIMPLE.md)** — the absolute minimum code to use RGX
- **[Migration Guide](docs/MIGRATION.md)** — moving from Ace3, LibSharedMedia, or standalone implementations

### Core Systems

- **[Architecture](docs/ARCHITECTURE.md)** — load order, module registration, `...` varargs pattern, lifecycle, timer driver, event dispatch, combat queue
- **[API Reference](docs/API.md)** — complete public API by module (every method, every parameter)
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** — common issues and fixes

### Module Deep-Dives

- **[Fonts System](docs/FONTS.md)** — registry, blocklist, style objects, dropdown schemas, UI controls, flag helpers, dual-schema design
- **[Dropdowns System](docs/DROPDOWNS.md)** — nested menus, auto-width, inline buttons, item normalization, MenuUtil vs legacy compat
- **[Theming & Design](docs/THEMING.md)** — color palette, font styling conventions, texture system, consistent UI patterns

### Design & Philosophy

- **[Foundation Decisions](docs/FOUNDATION.md)** — what RGX keeps vs drops from Ace3, and why
- **[Ace3 Analysis](docs/ACE3-ANALYSIS.md)** — how each Ace3 piece maps to RGX, and where RGX aims to be better
- **[Roadmap](docs/ROADMAP.md)** — profile/database system, SharedMedia drop-in, pack system, localization, longer-term plans

### Other

- **[Changelog](docs/CHANGES.md)** — current version release notes
- **[Font Sources & Licenses](docs/FONT-SOURCES.md)** — attribution for all bundled fonts
- **[PetBuddy2 Integration](docs/USAGE-PB2.md)** — PB2-specific usage notes

---

## Compatibility

- **WoW Retail only**
- Interface version: `120005`
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

MIT for framework code. Bundled fonts retain their own open licenses — see [docs/FONT-SOURCES.md](docs/FONT-SOURCES.md) for attribution.
