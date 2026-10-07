# ColorPicker — `RGXColorPicker`

A custom RGX HSV color picker (`modules/colors/colorpicker.lua`). The panel is a honeycomb spectrum plus a vertical brightness bar, styled with [[RGXDesign|Theming]] tokens: ring-and-fill drag handles, a live class-color row, circular swatches/preview, and themed focus states. The separate `Colors:OpenPicker()` API opens Blizzard's picker.

---

## Features

- **Honeycomb spectrum** — a flat-top hexagon grid where hue is the angle from the white centre (cyan top-left, blue top, purple right, red bottom-right, yellow bottom, green left) and saturation is the ring distance. The palette stays at full value so every color remains visible while brightness changes. Click or drag any cell; the selected cell is outlined (grayscale values mark the neutral centre).
- **Vertical brightness bar** — to the right of the spectrum. It shades from black at the bottom to the current hue **at the selected saturation** at the top (so white and pastels do not show a misleading saturated gradient) and keeps the picked hue/saturation even when driven to black. The handle and preview show the current brightness; the hexagons stay at full value.
- **Class Colors row** — rendered from the live client `RAID_CLASS_COLORS` palette for the current flavor (fewer swatches on Classic); no class swatches are added when the client exposes no palette.
- **HEX input** and **R/G/B inputs** (0–255) with primary-themed focus borders; invalid hex is ignored rather than clamped to black
- **Preset palettes** — Quality and Basic — as circular swatches with hover rings
- **Circular preview** of the current color
- **OK / Cancel / ×** themed via `Design:CreateButton`; the panel is draggable

---

## API

### `CP:Show(color, callback)`

```lua
local CP = RGX:GetColorPicker()
CP:Show({ r = 0.5, g = 0.2, b = 0.8 }, function(r, g, b, a)
    -- called on OK
end)
```

`color` is a `{r, g, b}` table (0–1 floats). `callback(r, g, b, a)` fires on **OK** only; Cancel and × close without calling it.

### Via the declarative DSL

```lua
options = {
    General = {
        { color = "accentColor", label = "Accent Color" },
    },
}
```

Binds a swatch control to `addon.db.accentColor` (`{r,g,b}`); clicking the swatch opens this picker. See [[Declarative API]].

### Via UI controls (à la carte)

`UI:CreateColorPicker(parent, { key, label, storage, default, onChange })` — inline swatch + reset button, opens this picker on click. See [[UI Controls]].

The embeddable card (`UI:CreateColorPickerCard`) accepts named or array colors
in storage via `SetColor`, and `:Refresh()` re-projects `storage[key]` silently
(no write, no `onChange`) so a peer or theme change updates an already-open
widget.

---

## Testing

`/rgxcolor` (from [RGX-Hello](https://github.com/RGXMods/RGX-Hello)) opens the picker directly; the Colors tab of `/rgxvisual` exercises the swatch controls, reset, and direct-open paths. See [[Testing]].

## History

- **Unreleased** — honeycomb spectrum, vertical brightness bar, and live Class Colors row replace the circular SV/hue-bar layout; embedded/`UI:CreateColorPicker` widgets re-project storage on `:Refresh()` and show, and options panels expose `panel:SetTheme(...)` for runtime theme updates without leaking into the shared default
- **v2.4.0** — circular redesign (RGXDesign tokens, ring-and-fill handles, circular swatches/preview, focus states)
- **v2.3.0** — first release that actually rendered: fixed six missing `BackdropTemplate` mixins that silently aborted construction, and completed two stub features (the hue-bar rainbow and the saturation gradient)
- **v2.0.0** — module introduced
