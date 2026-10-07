# ColorPicker — `RGXColorPicker`

A custom RGX HSV color picker (`library/colors/colorpicker.lua`). The panel is a honeycomb spectrum plus a vertical brightness bar, styled with [[RGXDesign|Theming]] tokens: ring-and-fill drag handles, a live class-color row, circular swatches/preview, and themed focus states. The separate `Colors:OpenPicker()` API opens Blizzard's picker.

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

### `CP:Show(color, callback, opts)`

```lua
local CP = RGX:GetColorPicker()
CP:Show({ r = 0.5, g = 0.2, b = 0.8 }, function(r, g, b, a)
    -- called on OK
end)
```

`color` is a `{r, g, b}` table (0–1 floats). `callback(r, g, b, a)` fires on **OK** only; Cancel and × close without calling it.

`opts` is optional and hides named sections for this consumer:

```lua
CP:Show(color, callback, { rgb = false, presets = false })
```

Keys default to shown; passing `false` hides the matching section, collapses the panel to fit, and re-anchors the remaining sections and the OK/Cancel buttons. The next `Show` without `opts` restores every section. Sections: `classes` (Class Colors label + row), `preview` (circular preview, HEX field, eyedropper), `rgb` (R/G/B inputs), `presets` (Quality/Basic swatches).

`opts.scale` (positive number, default `1`) uniformly scales the dialog for
compact consumers — e.g. `{ rgb = false, presets = false, scale = 0.85 }`.
The frame is a singleton, so the scale resets to `1` on every `Show` without
the key; non-numeric or non-positive values are ignored.

`opts.border` (`{r, g, b}` or `{r=, g=, b=}`) outlines the dialog in a
consumer brand color — e.g. SQP green `{ 0.345, 0.745, 0.506 }`. Omitted,
the design border token returns.

The SQP minimal popup is honeycomb + brightness bar + one-line class row:
`{ presets = false, rgb = false, preview = false, scale = 0.85 }`.

`opts.commitOnPick` (default off) turns the dialog into select-and-close:
picking from the honeycomb, brightness bar, or class row fires the callback
and closes immediately, and the OK/Cancel buttons are hidden (the height
ends below the last visible section). Pair it with hidden text inputs —
typed RGB stays staging-only without buttons to confirm it.

The dialog joins `UISpecialFrames`, so ESC closes it like every other RGX
window. Switching options tabs or pager pages dismisses it without firing
the callback — a popup never outlives the page that opened it.

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

- **Unreleased** — honeycomb spectrum, vertical brightness bar, and live Class Colors row replace the circular SV/hue-bar layout; embedded/`UI:CreateColorPicker` widgets re-project storage on `:Refresh()` and show, and options panels expose `panel:SetTheme(...)` for runtime theme updates without leaking into the shared default; `Show(...)` accepts `opts` to hide the class, preview, RGB, or preset sections per consumer, collapsing and re-anchoring the panel to fit
- **v2.4.0** — circular redesign (RGXDesign tokens, ring-and-fill handles, circular swatches/preview, focus states)
- **v2.3.0** — first release that actually rendered: fixed six missing `BackdropTemplate` mixins that silently aborted construction, and completed two stub features (the hue-bar rainbow and the saturation gradient)
- **v2.0.0** — module introduced
