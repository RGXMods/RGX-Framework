# RGX-Framework

RGX-Framework is a Retail World of Warcraft shared media library for addon authors and addon suites.

Current version: `1.0.0`

***

## Overview

RGX-Framework centralizes fonts, colors, textures, and a few lightweight UI helpers so multiple addons can draw from one consistent resource pack instead of shipping duplicate media folders in every release.

It is built for two groups:

- players who need it because another addon depends on it
- authors who want a clean shared media layer without dragging in a heavy framework

RGX-Framework is not meant to be a standalone player-facing addon. It loads quietly, exposes a small API, and supports the addons built on top of it.

***

## Features

- Shared font library through `_G.RGXFonts`
- Shared color module through `_G.RGXColors`
- Shared texture module through `_G.RGXTextures`
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

***

## Font Coverage

RGX-Framework now includes a wider spread of styles instead of just minor variations of the same UI font.

- Sans/UI: Inter, Ubuntu, Liberation Sans, DejaVu Sans
- Serif: Crimson Text
- Monospace: IBM Plex Mono
- Display: Bebas Neue, Bangers, Creepster
- Pixel: Press Start 2P, Silkscreen, VT323
- Fantasy/Themed: Uncial Antiqua
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

***

## Good Fit For

- addon suites that want one visual identity
- addons that need a shared, curated font menu
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
