# RGX Visual Test

Dev/debug visual QA harness for RGX-Framework's UI controls. Not a player-facing
addon -- lives in `tools/` and is excluded from the packaged zip, same as
`tools/rgx-mcp/`.

Every API this addon calls was verified against real RGX-Framework source
before being written (`modules/ui/controls.lua`, `modules/ui/options.lua`,
`modules/colors/colorpicker.lua`, `modules/fonts/dropdowns.lua`,
`modules/textures/textures.lua`) -- no invented option keys, no guessed
callback signatures.

## Deploy

Copy this folder into your WoW AddOns directory alongside a current
RGX-Framework build:

```powershell
$WoWAddOns = "C:\Program Files (x86)\World of Warcraft\_retail_\Interface\AddOns"
robocopy "tools\rgx-visual-test" "$WoWAddOns\RGXVisualTest" /MIR
```

## Use

- `/rgxvisual` or `/rgxviz` -- opens the full tabbed test panel (Colors,
  Controls, Dropdowns, Media)
- `/rgxcolor` or `/rgxcp` -- opens the color picker directly, bypassing the panel

## What to test, tab by tab

**Colors** -- click swatches, drag the SV square, drag the hue bar, type
HEX/RGB, click presets, OK, Cancel, X close, drag the picker window, and the
Reset button (fixed 2026-07: `unpack()` on a keyed `{r,g,b}` table returned
nothing, silently resetting to an empty color).

**Controls** -- toggle checkbox, reset button, slider drag/click/mousewheel,
volume slider low/medium/high click regions and mousewheel cycling.

**Dropdowns** -- open menu, open nested groups, select a radio item, reopen
and confirm the checked state persisted, verify no taint/error. RGX's dropdown
module uses modern `MenuUtil` on newer clients to avoid the legacy
`UIDropDownMenu` taint surface.

**Media** -- font dropdown opens and changes the preview text; statusbar
texture dropdown changes the bar's texture and restores on reset.

Pass criteria for all tabs: no Lua error, no `ADDON_ACTION_BLOCKED` /
forbidden-action taint error, visual state matches the control's actual value
after `/reload`.
