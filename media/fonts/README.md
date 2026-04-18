# Fonts for RGX-Framework

This folder contains open-source fonts packaged with RGX-Framework.

## Included Fonts

### Inter (OFL 1.1)
- **Files:** Inter-Regular.otf, Inter-Bold.otf
- **Source:** https://rsms.me/inter/
- **License:** Open Font License 1.1
- **Type:** Sans-serif

### Crimson Text (OFL 1.1)
- **Files:** CrimsonText-Regular.ttf
- **Source:** https://fonts.google.com/specimen/Crimson+Text
- **License:** Open Font License 1.1
- **Type:** Serif

### Press Start 2P (OFL 1.1)
- **Files:** PressStart2P-Regular.ttf
- **Source:** https://fonts.google.com/specimen/Press+Start+2P
- **License:** Open Font License 1.1
- **Type:** Pixel

### VT323 (OFL 1.1)
- **Files:** VT323-Regular.ttf
- **Source:** https://fonts.google.com/specimen/VT323
- **License:** Open Font License 1.1
- **Type:** Pixel

### IBM Plex Mono (OFL 1.1)
- **Files:** IBMPlexMono-Regular.ttf
- **Source:** https://fonts.google.com/specimen/IBM+Plex+Mono
- **License:** Open Font License 1.1
- **Type:** Monospace

### Bebas Neue (OFL 1.1)
- **Files:** BebasNeue-Regular.ttf
- **Source:** https://fonts.google.com/specimen/Bebas+Neue
- **License:** Open Font License 1.1
- **Type:** Display

### Bangers (OFL 1.1)
- **Files:** Bangers-Regular.ttf
- **Source:** https://fonts.google.com/specimen/Bangers
- **License:** Open Font License 1.1
- **Type:** Display

### Creepster (OFL 1.1)
- **Files:** Creepster-Regular.ttf
- **Source:** https://fonts.google.com/specimen/Creepster
- **License:** Open Font License 1.1
- **Type:** Display

### Silkscreen (OFL 1.1)
- **Files:** Silkscreen-Regular.ttf
- **Source:** https://fonts.google.com/specimen/Silkscreen
- **License:** Open Font License 1.1
- **Type:** Pixel

### Uncial Antiqua (OFL 1.1)
- **Files:** UncialAntiqua-Regular.ttf
- **Source:** https://fonts.google.com/specimen/Uncial+Antiqua
- **License:** Open Font License 1.1
- **Type:** Fantasy

## Adding Fonts

To add more fonts:

1. Download TTF or OTF font files from open source font repositories
2. Copy them to this folder
3. Add entries to `modules/fonts/fonts.lua` in the `Fonts.definitions` table
4. Restart WoW

## Recommended Sources

- **Google Fonts:** https://fonts.google.com/ (filter by OFL or Apache license)
- **GitHub:** Many open source fonts available
- **Font Squirrel:** https://www.fontsquirrel.com/ (filter by "Open Font License")

## License Requirements

All fonts must be licensed under:
- **OFL (Open Font License)** - Free to use, modify, redistribute
- **Apache 2.0** - Free to use commercially
- **MIT** - Free to use
- **Public Domain** - No restrictions

## WoW Default Fonts (Always Available)

These Blizzard fonts are always available without including files:

- `Fonts/FRIZQT__.TTF` - Friz Quadrata (default UI font)
- `Fonts/ARIALN.TTF` - Arial Narrow
- `Fonts/skurri.ttf` - Skurri
- `Fonts/MORPHEUS.ttf` - Morpheus

## Usage

```lua
local Fonts = RGX:GetModule("fonts")

-- Get font path
local path = Fonts:GetPath("Inter-Regular")
myFontString:SetFont(path, 12, "OUTLINE")

-- Quick apply
Fonts:Quick(myFontString, "Inter-Regular", 14, "OUTLINE")
```
