# Testing — RGX-Hello

[RGX-Hello](https://github.com/DonnieDice/RGX-Hello) is two things in one install:

1. **The reference addon** — `data/core.lua` is the canonical hello-world: the smallest complete RGX addon, written in the declarative `RGXAddon` style you should copy when starting your own.
2. **The framework's in-game test suite** — `data/visualtest.lua` exercises every user-facing framework module through the manual API, and doubles as the reference for going beyond the declarative surface.

## Commands

| Command | Opens |
|---------|-------|
| `/rgxhello` | RGX-Hello's own options panel (the hello-world addon) |
| `/rgxvisual` or `/rgxviz` | The full test suite |
| `/rgxcolor` or `/rgxcp` | The color picker directly |

## Suite coverage

| Tab | Framework features exercised |
|-----|------------------------------|
| Colors | `RGXColorPicker` (SV box, hue bar, HEX/RGB, presets), `UI:CreateColorPicker` swatches + Reset |
| Controls | `UI:CreateToggle` / `CreateSlider` / `CreateVolumeSlider`, reset buttons, label word-wrap |
| Dropdowns | `RGXDropdowns:CreateNestedDropdown` (groups, separators, checked state) |
| Media | `RGXFonts` font dropdown, `RGXTextures` statusbar textures |
| Tooltip | `Tip:Attach` builder, manual `Show`/`Hide`, `HookNative("item")` injection |
| Auras | `IterateAuras` scan, `WatchUnit` + `OnApplied`/`OnRemoved` live log with unsubscribe |
| Minimap | `MM:Create` (icon, tooltip, drag, persistent angle), `Toggle`/`IsShown` |
| Design | `RGX:Font` one-call styling, `RGXDesign` primitives, theme tokens |
| System | `RGX:After`, `RGX:Every`, `RGX:CancelTimer` |

Sound is intentionally untested here — the sound module is a per-addon registry that [BLU](https://github.com/DonnieDice/BLU) exercises in production, which is a more honest test than a synthetic registration.

## The standing pattern

When a framework module ships or changes, its test tab lands in RGX-Hello **in the same cycle**. Contract-side, the loop closes from the other direction too: the framework's [[RGX-MCP]] end-to-end test validates and audits RGX-Hello on every run.
