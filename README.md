# RGX-Framework

RGX-Framework is a Retail World of Warcraft addon foundation for addon authors and addon suites.

Current version: `1.0.0`

***

## Overview

RGX-Framework centralizes fonts, colors, textures, shared controls, and core addon plumbing so multiple addons can build on one consistent foundation instead of each project reinventing the same systems.

It is built for two groups:

- players who need it because another addon depends on it
- authors who want one clean framework layer instead of stitching together separate media, widget, and utility code in every addon

RGX-Framework is not meant to be a standalone player-facing addon. It loads quietly, exposes a small API, and supports the addons built on top of it.

The direction is bigger than a media pack: RGX is intended to become the shared base for the broader addon suite, including future projects like `RGX-Mod`.

***

## Features

- Shared font library through `_G.RGXFonts`
- Reusable nested font dropdowns for addon options
- Reusable statusbar texture dropdowns for addon options
- Reusable font style selectors with WoW font flag support
- One-table text style application for addon `FontString`s
- Shared color module through `_G.RGXColors`
- Shared texture module through `_G.RGXTextures`
- Native RGX event and message bus without requiring `LibStub`
- BLU-inspired native runtime helpers for timers, hooks, and slash command registration
- Lightweight callback emitters for module-local change notifications
- WoW-safe font path lookup and fallback handling
- Shared color picker support
- Shared status bar, border, and panel texture resources
- Consistent branding and visual identity across RGX-based addons

***

## Highlights In 1.0.0

- Expanded the bundled font lineup beyond near-identical UI sans fonts
- Added stronger variety across pixel, display, fantasy, serif, and monospace styles
- Improved PB2 integration so addon font menus can consume RGX fonts directly
- Added shared color-picker helpers for drop-in addon usage
- Continued positioning RGX as the common media layer behind the broader addon suite
- Added a native RGX dispatcher for events, messages, and callback-style module signals

***

## Font Coverage

RGX-Framework now ships a broader downloaded font bundle instead of leaning on a tiny set of defaults.

- Sans/UI: Inter, Ubuntu, Liberation Sans, DejaVu Sans, Lato, Poppins, Montserrat, Rajdhani
- Serif: Crimson Text, Merriweather, Playfair Display
- Monospace: IBM Plex Mono, JetBrains Mono
- Display: Bebas Neue, Bangers, Creepster, Oswald, Orbitron, Audiowide, Anton
- Pixel: Press Start 2P, Silkscreen, VT323
- Fantasy/Themed: Uncial Antiqua, Cinzel
- WoW defaults: Friz Quadrata, Arial Narrow, Morpheus, Skurri

For source and attribution details:
[docs/FONT-SOURCES.md](docs/FONT-SOURCES.md)

***

## Basic Usage

Declare the dependency in your addon:

```toc
## RequiredDeps: RGX-Framework
```

Use RGX fonts directly:

```lua
local path = _G.RGXFonts:GetPath("Inter-Regular")
MyFontString:SetFont(path, 12, "OUTLINE")
```

Apply one shared text style object:

```lua
_G.RGXFonts:ApplyStyle(MyFontString, {
    font = "Inter-Regular",
    size = 14,
    flags = "OUTLINE",
    color = "highlight",
    shadowColor = "shadow",
    shadowOffset = { x = 1, y = -1 },
    justifyH = "LEFT",
    justifyV = "TOP",
    spacing = 2,
})
```

Or use the simplest aliases:

```lua
local Fonts = _G.RGXFonts

local style = Fonts:CreateStyle({
    font = "Inter-Regular",
    size = 14,
    flags = "OUTLINE",
})

Fonts:ApplyTextStyle(MyFontString, style)
```

Create a nested grouped font dropdown in your addon:

```lua
local fontDropdown = _G.RGXFonts:CreateFontDropdown(parent, {
    label = "Primary Font",
    value = "Inter-Regular",
    onChange = function(fontName, path)
        print("Selected font:", fontName, path)
    end,
})
```

Or use the simple aliases:

```lua
local fontSelector = _G.RGXFonts:CreateSimpleFontSelector(parent, opts)
local styleSelector = _G.RGXFonts:CreateSimpleStyleSelector(parent, opts)
```

Full-scope easiest integration:

```lua
_G.RGXFonts:AttachStyleSelector(parent, db, "titleText")
_G.RGXFonts:ApplyTextStyle(MyFontString, db.titleText)
```

Or just attach the font picker:

```lua
_G.RGXFonts:AttachFontSelector(parent, db, "titleFont")
```

Register a companion font pack addon:

```lua
_G.RGXFonts:RegisterFontPack("MyFontPack", {
    ["Sora-Regular"] = {
        file = "Sora-Regular.ttf",
        family = "Sora",
        category = "Sans-serif",
        license = "OFL 1.1",
    },
    ["Sora-Bold"] = {
        file = "Sora-Bold.ttf",
        family = "Sora",
        category = "Sans-serif",
        license = "OFL 1.1",
    },
})
```

Use RGX colors:

```lua
local Colors = _G.RGXColors
local r, g, b = Colors:GetRGB("epic")
MyFontString:SetTextColor(r, g, b)
```

Open the shared color picker:

```lua
_G.RGXColors:OpenPicker({
    color = "brand",
    callback = function(color)
        print(color.hex)
    end,
})
```

Use RGX textures:

```lua
local Textures = _G.RGXTextures
myStatusBar:SetStatusBarTexture(Textures:GetBar("Smooth"))
```

Attach a shared statusbar texture selector:

```lua
local Textures = _G.RGXTextures

Textures:AttachBarSelector(parent, db, "barTexture", {
    label = "Bar Texture",
    onChange = function(_, barName, barPath)
        myStatusBar:SetStatusBarTexture(barPath)
    end,
})
```

Register addon-local bars into the shared RGX texture pool:

```lua
_G.RGXTextures:RegisterBars("MyAddon", {
    ["My Gloss"] = "Interface\\AddOns\\MyAddon\\media\\gloss.tga",
    ["My Flat"] = "Interface\\AddOns\\MyAddon\\media\\flat.tga",
})
```

Use the native RGX message bus:

```lua
local RGX = _G.RGXFramework

RGX:RegisterMessage("RGX_TEXTURES_UPDATED", function(message, sourceAddon)
    print("Textures changed from:", sourceAddon)
end, "my-texture-listener")

RGX:SendMessage("RGX_TEXTURES_UPDATED", "MyAddon")
```

Create a tiny module-local callback emitter:

```lua
local RGX = _G.RGXFramework
local emitter = RGX:CreateEmitter("RGXTextures")

emitter:RegisterCallback("BarsChanged", function(signal, sourceAddon)
    print(signal, sourceAddon)
end, "bars-watch")

emitter:Fire("BarsChanged", "MyAddon")
```

RGX does not need `LibStub` for its own internals because it is a single dependency addon, not a pile of separately embedded versioned libraries. A small native dispatcher is usually enough for framework-to-addon and module-to-module communication.

Use the native RGX runtime helpers:

```lua
local RGX = _G.RGXFramework

RGX:After(1.0, function()
    print("Delayed by one second")
end)

RGX:Every(0.5, function(timer)
    if not MyAddon:IsPreviewOpen() then
        RGX:CancelTimer(timer)
    end
end)
```

```lua
local RGX = _G.RGXFramework

RGX:Hook(MyFrame, "Show", function(original, ...)
    print("Before show")
    return original(...)
end)
```

***

## Good Fit For

- addon suites that want one visual identity
- addons that need a shared, curated font menu
- addons that want optional companion font packs without rebuilding font plumbing
- authors who want shared textures and colors without duplicating assets
- projects that want smaller packages and easier visual iteration

***

## Compatibility

- WoW Retail only
- Interface versions: `120000`, `120001`

Any addon that declares `## RequiredDeps: RGX-Framework` or `## OptionalDeps: RGX-Framework` can consume it directly.

***

## Documentation

- [docs/description.html](docs/description.html)
- [docs/CHANGES.md](docs/CHANGES.md)
- [docs/FOUNDATION.md](docs/FOUNDATION.md)
- [docs/ACE3-ANALYSIS.md](docs/ACE3-ANALYSIS.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/SUPER-SIMPLE.md](docs/SUPER-SIMPLE.md)
- [docs/USAGE-PB2.md](docs/USAGE-PB2.md)
- [docs/FONT-SOURCES.md](docs/FONT-SOURCES.md)

***

## Support

- GitHub: https://github.com/DonnieDice/RGX-Framework
- Issues: https://github.com/DonnieDice/RGX-Framework/issues
- Discord: https://discord.gg/N7kdKAHVVF

***

## License

MIT for framework code.

Bundled fonts retain their own original open licenses. See the docs for attribution and sources.
