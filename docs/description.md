# RGX-Framework

**A modular resource library for World of Warcraft addon authors.** RGX-Framework bundles professionally curated fonts, a WoW-safe color palette, and a reusable texture set behind a tiny, drop-in API — so other addons can share these assets without duplicating megabytes of media across every installation.

RGX-Framework is **not a player-facing addon**. It loads silently, exposes a small global API, and does nothing on its own. You only need it if another addon lists it as a required dependency.

---

## Who is this for?

- **Addon users** — if an addon you've installed lists `RGX-Framework` as a required dependency (for example, PetBuddy2), you need this library installed alongside it. Once installed, it's invisible and requires no configuration.
- **Addon authors** — use RGX-Framework to pull fonts, colors, and UI textures into your addon with a single line of Lua, instead of shipping your own copies.

---

## Features

### 🔤 Font Library — `_G.RGXFonts`
Over 20 bundled, correctly-licensed font files, including:

- **UI / Sans-Serif:** Inter, Ubuntu, Liberation Sans, DejaVu Sans (regular, bold, condensed, italics)
- **Display / Themed:** Bangers, Bebas Neue, Creepster, Crimson Text, Uncial Antiqua
- **Monospace / Pixel:** IBM Plex Mono, Press Start 2P, Silkscreen, VT323

Retrieve any font path with one call:

```lua
local path = _G.RGXFonts:GetPath("Inter-Regular")
myText:SetFont(path, 12, "OUTLINE")
```

### 🎨 Color Module — `_G.RGXColors`
A curated palette of WoW-safe hex colors (class colors, quality colors, status/warning colors, brand accents). No more hard-coding `|cffffd100` tokens across your files.

### 🖼️ Texture Module — `_G.RGXTextures`
Reusable UI textures (backdrops, borders, status bars, and panel chrome) that match the visual identity of other RGX Mods addons.

---

## How it affects the user experience

For **players**, the practical effect is simple: addons built on top of RGX-Framework look and feel consistent. They share the same fonts, the same panel styling, and the same color vocabulary, so switching between (for example) PetBuddy2, Enhanced Traveler's Log, and BLU | Better Level-Up! feels like part of one coordinated suite rather than three unrelated mods.

For **authors**, the practical effect is:
- **Smaller addons.** Your addon no longer needs to ship a `media/` folder with 5–20 MB of font files.
- **Faster iteration.** Swap fonts and colors by name, not by file path.
- **Consistent licensing.** All bundled fonts are open-licensed (Inter, IBM Plex, Ubuntu, DejaVu, Liberation, Google Fonts display faces).

---

## Integration example

```lua
-- YourAddon.toc
## Interface: 120001
## Title: YourAddon
## RequiredDeps: RGX-Framework

YourAddon.lua
```

```lua
-- YourAddon.lua
local text = UIParent:CreateFontString(nil, "OVERLAY")
text:SetFont(_G.RGXFonts:GetPath("Bangers-Regular"), 24, "OUTLINE")
text:SetText("Hello!")
text:SetPoint("CENTER")
```

That's it — no bridges, no registries, no factory patterns. Just `_G.RGXFonts:GetPath(name)`.

---

## Compatibility

- ✅ World of Warcraft: Midnight (Interface 120000, 120001)
- Loads before any addon that declares `## RequiredDeps: RGX-Framework` or `## OptionalDeps: RGX-Framework`.

---

## Links & support

- GitHub: https://github.com/DonnieDice/RGX-Framework
- Issues: https://github.com/DonnieDice/RGX-Framework/issues
- Community: [Discord](https://discord.gg/N7kdKAHVVF)

---

## License

MIT — see `LICENSE`. Bundled fonts retain their individual OFL / Apache / open licenses; see `docs/FONT-SOURCES.md` for attribution.
