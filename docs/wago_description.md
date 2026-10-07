# RGX-Framework


**One dependency. Everything your addon suite needs.**

RGX-Framework is a modern, self-contained WoW addon framework for Retail,
WoW Forever beta, Classic Era, TBC, Wrath/Titan, Cataclysm, and Mists. One shared dependency
provides events, timers, hooks, slash commands, minimap buttons, options panels,
database profiles, DataBroker, media, dropdowns, UI controls, and a visual design
system. It is not a player-facing addon; it loads silently and exposes an API.

---

## Quick Start

**Latest stable release:** [`v2.7.14`](https://github.com/RGXMods/RGX-Framework/releases/tag/v2.7.14)
The source beta candidate is `v2.7.15-beta.4`; follow the release page for published tester builds.

**1. Declare the dependency:**

```toc
## RequiredDeps: RGX-Framework
## SavedVariables: MyAddonDB
```

**2. Declare your addon — one call:**

```lua
-- Line 1 of MyAddon.lua is the addon. RGXAddon is a framework-provided
-- global; RequiredDeps guarantees it exists. No local, no assert.
RGXAddon "MyAddon" {
    slash   = "myaddon",              -- /myaddon opens the options panel
    minimap = "Interface\\AddOns\\MyAddon\\media\\logo.tga",
    db      = { enabled = true, volume = 80 },   -- SavedVariables proxy on addon.db
    every   = {
        heartbeat = { 30, function(self, timer)
            self.heartbeatTicks = (self.heartbeatTicks or 0) + 1
        end },
    },
    options = {
        General = {
            { section = "Settings" },
            { toggle = "enabled", label = "Enable Addon" },
            { slider = "volume",  label = "Volume", min = 0, max = 100 },
        },
    },
    onInit = function(self)
        self:RegisterEvent("PLAYER_LOGIN", function()
            self:Print("Ready!")
        end)
    end,
    welcome = "loaded — /myaddon for options",
}
```

That is a **complete addon**: profile-aware saved settings, a tabbed options
panel with db-bound controls, a slash command, a minimap button, branded chat
output, and lifecycle work routed through scoped framework methods. The `addon`
object carries `RegisterEvent`, `RegisterUnitEvent`, `RegisterMessage`, `After`,
`Every`, `Print`, `Warn`, and `Error`, so consumers do not need raw WoW plumbing.

> Human `on` triggers and full declarative card/page layouts remain future forms.
> Named `every` timers are implemented; one-line controls ship in `v2.7.15-beta.2`.
> Use scoped methods for
> events and other behavior that is not yet declarative.

**3. À la carte — individual systems when you need them:**

```lua
-- Events (id string enables targeted unregistration)
RGX:RegisterEvent("PLAYER_LOGIN", function() print("logged in") end, "myAddon-login")

-- Timers
RGX:After(1.0, function() print("one second later") end)

-- Fonts — one-line DB-bound style UI, one-line application
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
| **Fonts** | 40 bundled + 4 WoW defaults (44 total), 10 blocked in unavailableFonts, grouped dropdowns, style objects |
| **Colors** | Named palette, class/quality/power colors, color math, wrapping, picker integration |
| **Textures** | Statusbar registry, LibSharedMedia import, dropdown controls |
| **Dropdowns** | Nested UIDropDownMenu with auto-width, inline buttons, dual-schema items |
| **UI Controls** | Slider, toggle, label, dropdown, color picker, section, preview, reset button |
| **Options Panels** | Tabbed settings windows registered with WoW Settings |
| **Minimap** | Circular-drag buttons with persistent angle, tooltip, show/hide |
| **Design** | Theme tokens (`primary`, `accent`) + static structural palette (`surface`, `text`, `border`, etc.) + visual building blocks |
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

**Temporarily unavailable (10 fonts with corrupted assets):** Montserrat, Merriweather, Playfair Display, Oswald, Orbitron, Audiowide, Cinzel — blocked in `unavailableFonts` until asset files are replaced.

Total: 40 bundled (30 available + 10 blocked) + 4 WoW defaults (Friz Quadrata, Arial Narrow, Morpheus, Skurri) = 44 registered, 34 selectable.

Font pack addons can extend the registry at runtime with `Fonts:RegisterFontPack(addonName, defs)`.

---

## Wiki

Full documentation lives in the [`docs/`](https://github.com/RGXMods/RGX-Framework/tree/main/docs) directory and the [generated Wiki](https://github.com/RGXMods/RGX-Framework/wiki):

### Getting Started

- **[Super Simple Integration](https://github.com/RGXMods/RGX-Framework/blob/main/docs/SUPER-SIMPLE.md)** — the absolute minimum code to use RGX
- **[Migration Guide](https://github.com/RGXMods/RGX-Framework/blob/main/docs/MIGRATION.md)** — moving from Ace3, LibSharedMedia, or standalone implementations

### Core Systems

- **[Architecture](https://github.com/RGXMods/RGX-Framework/blob/main/docs/ARCHITECTURE.md)** — load order, module registration, `...` varargs pattern, lifecycle, timer driver, event dispatch, combat queue
- **[API Reference](https://github.com/RGXMods/RGX-Framework/blob/main/docs/API.md)** — documented public APIs by module
- **[Troubleshooting](https://github.com/RGXMods/RGX-Framework/blob/main/docs/TROUBLESHOOTING.md)** — common issues and fixes

### Module Deep-Dives

- **[Fonts System](https://github.com/RGXMods/RGX-Framework/blob/main/docs/FONTS.md)** — registry, blocklist, style objects, dropdown schemas, UI controls, flag helpers, dual-schema design
- **[Dropdowns System](https://github.com/RGXMods/RGX-Framework/blob/main/docs/DROPDOWNS.md)** — nested menus, auto-width, inline buttons, item normalization, MenuUtil vs legacy compat
- **[Theming & Design](https://github.com/RGXMods/RGX-Framework/blob/main/docs/THEMING.md)** — color palette, font styling conventions, texture system, consistent UI patterns

### Localization

RGX-Framework ships complete WoW client locale coverage for its own
user-facing output across all twelve WoW client locales: **enUS** (base),
**deDE**, **esES**, **esMX**, **frFR**, **itIT**, **koKR**, **ptBR**,
**ptPT**, **ruRU**, **zhCN**, **zhTW**. The framework's own slash-command
output, login line, control fallback labels, and reputation rank names are
read from a single locale registry (`library/locale/locale.lua` +
`library/locale/overrides.lua`). The English base loads unconditionally and
every non-English block is guarded on `GetLocale()`, so untranslated keys
fall through to English with no nil leaks.

Consumer addons inherit the same convention via the
`RGXLocale:NewLocale(addonName, locale, isDefault)` registry documented in
`docs/ROADMAP.md` and `library/locale/locale.lua`: register one `enUS` base
table plus guarded per-locale blocks. The frozen per-consumer
`Handle:SetLocale` / `Handle:GetLocale` wire-scope contract in
`library/sound/sound.lua` is unchanged.

### Design & Philosophy

- **[Foundation Decisions](https://github.com/RGXMods/RGX-Framework/blob/main/docs/FOUNDATION.md)** — capability ownership and modularity standards
- **[Ace3 Analysis](https://github.com/RGXMods/RGX-Framework/blob/main/docs/ACE3-ANALYSIS.md)** — current capabilities and runtime/contract/design/tooling architecture
- **[Roadmap](https://github.com/RGXMods/RGX-Framework/blob/main/docs/ROADMAP.md)** — implemented baseline, current hardening and need-driven future work
- **[Studio Roadmap](https://github.com/RGXMods/RGX-Framework/blob/main/docs/STUDIO-ROADMAP.md)** — planned authoring application, contract and preview boundaries, phased delivery
- **[Distribution](https://github.com/RGXMods/RGX-Framework/blob/main/docs/DISTRIBUTION.md)** — runtime package boundary, checksums, and installation

### Other

- **[Changelog](https://github.com/RGXMods/RGX-Framework/blob/main/docs/CHANGES.md)** — current version release notes
- **[Font Sources & Licenses](https://github.com/RGXMods/RGX-Framework/blob/main/docs/FONT-SOURCES.md)** — attribution for all bundled fonts
- **[Declarative API](https://github.com/RGXMods/RGX-Framework/blob/main/docs/DECLARATIVE-API.md)** — the `RGXAddon` authoring surface, verified against source

---

## Source Contract Conformance

RGX-Framework temporarily maintains an [MCP](https://modelcontextprotocol.io) server at [`tools/rgx-mcp/`](https://github.com/RGXMods/RGX-Framework/tree/main/tools/rgx-mcp) as a source-tree contract-conformance fixture. It gives CI and framework contributors tools that read the canonical schema and docs:

| Tool | What it does |
|---|---|
| `rgx_validate_addon` | Validate an `RGXAddon` opts table against `contract/schemas/rgx-addon.schema.json` |
| `rgx_audit_lua` | Scan Lua for unsafe patterns the framework prevents (raw `C_Timer`, manual event frames, `SLASH_` globals, unguarded `SetAttribute`, raw aura event/API plumbing, raw hook reassignment) |
| `rgx_generate_addon` | Emit a contract-congruent addon Lua file using only shipped keys |
| `rgx_get_contract` | Return the schema + declarative API reference for agent context |
| `rgx_edit_definition` | Source-development slice: strictly normalize/import/patch/export one label definition using shared authoring logic; emits data only |

The source-development [definition round trip](https://github.com/RGXMods/RGX-Framework/blob/main/docs/UI-CONTROLS.md#definition-round-trip-source-development-slice)
adds a small external editor (`node tools/editor/serve.mjs`, loopback only) and
in-game `/rgx editor` adapter over the same versioned data contract. This slice
is not in the published `v2.7.14` package and is not a complete Studio application
or Blizzard Edit Mode integration. Browser/WoW visual checks remain required.

Read-only by design — it never edits repos, commits, or touches the game.
An MCP-capable harness can configure it using the source `.mcp.json` example (run
`npm ci` once in `tools/rgx-mcp/`); discovery varies by harness. It is optional,
source-only, and excluded from the WoW addon release. The framework's essential
API is the [runtime Lua interface](https://github.com/RGXMods/RGX-Framework/blob/main/docs/API.md) used by dependent addons. Its
schema and reusable authoring logic also remain framework-owned; future Studio
consumes that foundation rather than replacing it. See the
[API/contract/MCP comparison](https://github.com/RGXMods/RGX-Framework/blob/main/docs/RGX-MCP.md#runtime-api-contract-and-mcp).
RGX-Framework publishes only the framework addon package. See
[`docs/DISTRIBUTION.md`](https://github.com/RGXMods/RGX-Framework/blob/main/docs/DISTRIBUTION.md).

---

## Compatibility

- **Latest stable release:** [`v2.7.14`](https://github.com/RGXMods/RGX-Framework/releases/tag/v2.7.14)

- **Clients:** Retail `120100`, WoW Forever beta `16001`, Classic Era `11509`, TBC `20506`, Wrath/Titan `38002`, Cataclysm `40402`, Mists `50504`
- **Distribution:** one runtime-only addon package; see [Distribution](https://github.com/RGXMods/RGX-Framework/blob/main/docs/DISTRIBUTION.md)
- `C_AddOns.GetAddOnMetadata` and `GetAddOnMetadata` both handled
- `ColorPickerFrame` old API and `ColorPickerInteraction` new API both handled
- `Settings.RegisterCanvasLayoutCategory` and `InterfaceOptions_AddCategory` both handled
- **Source conformance tooling:** temporary in-tree MCP fixture for CI; not a published product

---

## Support

- **GitHub:** https://github.com/RGXMods/RGX-Framework
- **Issues:** https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues
- **Discord:** https://realmgx.com

---

## License

[MIT](https://github.com/RGXMods/RGX-Framework/blob/main/LICENSE.txt) for framework code. Bundled fonts retain their own open licenses — see [docs/FONT-SOURCES.md](https://github.com/RGXMods/RGX-Framework/blob/main/docs/FONT-SOURCES.md) for attribution.
