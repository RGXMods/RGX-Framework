# ColorPicker — `RGXColorPicker`

A modern HSV color picker (`modules/colors/colorpicker.lua`) replacing WoW's default circular picker. Redesigned in v2.4.0 with a circular control vocabulary built on [[RGXDesign|Theming]] tokens: ring-and-fill drag handles, circular preset swatches and preview, themed focus states.

---

## Features

- **Saturation/Value box** — drag to select saturation (white→hue, horizontal) and value (black overlay, vertical); ring-and-fill cursor tracks the live color
- **Horizontal hue bar** — 6-segment true rainbow gradient with a circular drag handle
- **Circular preview** of the current color
- **HEX input** and **R/G/B inputs** (0–255) with primary-themed focus borders
- **Preset palettes** — Class colors, Quality colors, Basic — as circular swatches with hover rings ("Recent" fills as you pick)
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

---

## Testing

`/rgxcolor` (from [RGX-Hello](https://github.com/RGXMods/RGX-Hello)) opens the picker directly; the Colors tab of `/rgxvisual` exercises the swatch controls, reset, and direct-open paths. See [[Testing]].

## History

- **v2.4.0** — circular redesign (RGXDesign tokens, ring-and-fill handles, circular swatches/preview, focus states)
- **v2.3.0** — first release that actually rendered: fixed six missing `BackdropTemplate` mixins that silently aborted construction, and completed two stub features (the hue-bar rainbow and the saturation gradient)
- **v2.0.0** — module introduced
