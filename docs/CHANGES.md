# v1.5.1 - 2026-04-25

## UI — Options Panel Shortcuts

Added top-level shortcuts so addon authors never need to call `RGX:GetUI()` manually:

- `RGX:Options(config)` — create a tabbed options panel registered with WoW Settings
- `RGX:Toggle(parent, opts)` — checkbox + label
- `RGX:Slider(parent, opts)` — labeled slider with value display
- `RGX:ColorPicker(parent, opts)` — color swatch that opens the color picker
- `RGX:Section(parent, opts)` — bordered section container with header
- `RGX:Label(parent, opts)` — styled font string

All of these are shortcuts for `RGX:GetUI():Create*()`. The underlying API is unchanged.
