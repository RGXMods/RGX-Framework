# Colors Module

The Colors module (`RGXColors`) provides a named color palette, class/quality/power color lookups, color math utilities, color wrapping, and the ColorPicker widget.

---

## Named Palette

`Colors:Get(name)` resolves names case-insensitively in this order: `Colors.standard` → `Colors.ui` → `Colors.quality` → class table. Unknown names return `nil` (`Colors:GetHex` falls back to `"ffffff"`, `Colors:GetRGB` to `1, 1, 1`).

### Standard

| Name | Hex |
|---|---|
| `white` | `#ffffff` |
| `black` | `#000000` |
| `red` | `#ff0000` |
| `green` | `#00ff00` |
| `blue` | `#0080ff` |
| `yellow` | `#ffff00` |
| `cyan` | `#00ffff` |
| `magenta` | `#ff00ff` |
| `orange` | `#ffa500` |
| `purple` | `#800080` |
| `pink` | `#ff69b4` |
| `brown` | `#a66836` |
| `gray` / `grey` | `#808080` |
| `gold` | `#ffd700` |
| `silver` | `#c0c0c0` |
| `darkred` | `#8b0000` |
| `darkgreen` | `#006400` |
| `darkblue` | `#00008b` |
| `lightblue` | `#add8e6` |
| `navy` | `#000080` |
| `teal` | `#008080` |
| `lime` | `#00ff00` |
| `olive` | `#808000` |
| `maroon` | `#800000` |
| `coral` | `#ff7f50` |
| `salmon` | `#fa8072` |
| `khaki` | `#f0e68c` |
| `indigo` | `#4b0082` |
| `violet` | `#ee82ee` |
| `turquoise` | `#40e0d0` |
| `lavender` | `#e6e6fa` |
| `plum` | `#dda0dd` |

### UI / Theme

| Name | Hex | Usage |
|---|---|---|
| `primary` | `#00a2ff` | UI primary |
| `secondary` | `#4d4d4d` | UI secondary |
| `success` | `#00cc33` | Success feedback |
| `warning` | `#ffcc00` | Warnings |
| `error` | `#ff3333` | Errors |
| `info` | `#00a2ff` | Info |
| `disabled` | `#808080` | Disabled/muted |
| `highlight` | `#ffffff` | Highlights |
| `shadow` | `#000000` | Shadows |
| `backdrop` | `#1a1a1a` | Backdrops |
| `border` | `#4d4d4d` | Borders |

### Quality

| Name | Hex |
|---|---|
| `poor` | `#9d9d9d` |
| `common` | `#ffffff` |
| `uncommon` | `#1eff00` |
| `rare` | `#0070dd` |
| `epic` | `#a335ee` |
| `legendary` | `#ff8000` |
| `artifact` | `#e6cc80` |
| `heirloom` | `#00ccff` |

---

## Class Colors

Class colors are captured from the client's `RAID_CLASS_COLORS` table. `Colors:GetClass(className)` is case-insensitive and returns `r, g, b` (falling back to `1, 1, 1` for unknown classes):

```lua
local r, g, b = Colors:GetClass("WARLOCK")
myFontString:SetTextColor(r, g, b)
```

Class entries are keyed by the client's upper-case class tokens, while the generic palette lookup (`Colors:Get` / `GetHex` / `Wrap`) lower-cases its input, so class names resolve through `GetClass` rather than the generic palette.

| Class | Hex |
|---|---|
| `WARRIOR` | `#C79C6E` |
| `PALADIN` | `#F58CBA` |
| `HUNTER` | `#ABD473` |
| `ROGUE` | `#FFF569` |
| `PRIEST` | `#FFFFFF` |
| `SHAMAN` | `#0070DE` |
| `MAGE` | `#69CCF0` |
| `WARLOCK` | `#9482C9` |
| `MONK` | `#00FF96` |
| `DRUID` | `#FF7D0A` |
| `DEMONHUNTER` | `#A330C9` |
| `DEATHKNIGHT` | `#C41F3B` |
| `EVOKER` | `#33937F` |

---

## Quality Colors

`Colors:GetQuality(name)` takes a quality name (case-insensitive) and returns `r, g, b`:

| Name | Hex |
|---|---|
| `poor` | `#9d9d9d` |
| `common` | `#ffffff` |
| `uncommon` | `#1eff00` |
| `rare` | `#0070dd` |
| `epic` | `#a335ee` |
| `legendary` | `#ff8000` |
| `artifact` | `#e6cc80` |
| `heirloom` | `#00ccff` |

These names are also resolvable through `Colors:Get`, `Colors:GetHex`, and `Colors:Wrap`.

---

## Power Colors

`Colors:GetPower(token)` returns `r, g, b` for one of the module's short power tokens (case-insensitive; unknown tokens fall back to `1, 1, 1`). These are not the client's enum names:

| Token | r, g, b |
|---|---|
| `mana` | 0.00, 0.60, 1.00 |
| `rage` | 1.00, 0.00, 0.00 |
| `focus` | 1.00, 0.50, 0.25 |
| `energy` | 1.00, 1.00, 0.00 |
| `combo` | 1.00, 0.00, 0.00 |
| `runes` | 0.50, 0.50, 0.50 |
| `runic` | 0.00, 0.82, 1.00 |
| `chi` | 0.71, 1.00, 0.46 |
| `insanity` | 0.40, 0.00, 0.80 |
| `maelstrom` | 0.00, 0.50, 1.00 |
| `fury` | 0.79, 0.26, 0.99 |
| `pain` | 1.00, 0.30, 0.00 |

---

## API

### `Colors:Get(name)` → `table` or `nil`

Get a color table from the palette (also accepts a `"#RRGGBB"` string or `{r, g, b}` table). Tables always carry `hex`; `a` is present only when known:

```lua
local color = Colors:Get("primary")
myFontString:SetTextColor(color.r, color.g, color.b, color.a or 1)
```

### `Colors:GetRGB(name)` → `r, g, b`

Get just the RGB components (0-1 range; falls back to `1, 1, 1`):

```lua
local r, g, b = Colors:GetRGB("error")
myTexture:SetColorTexture(r, g, b, 1)
```

### `Colors:GetHex(name)` → `string`

Bare hex without `#` or an alpha prefix; falls back to `"ffffff"`:

```lua
local hex = Colors:GetHex("primary")
-- → "00a2ff"
```

### `Colors:Create(r, g, b, a)` → `table`

Create a normalized color table `{r, g, b, hex}` (plus `a` when passed). Components are clamped to 0-1:

```lua
local myColor = Colors:Create(0.5, 0.8, 0.3, 1.0)
```

### `Colors:Clone(color)` → `table` or `nil`

Clone a named color or color table:

```lua
local copy = Colors:Clone(myColor)
```

### `Colors:GetClass(className)` → `r, g, b`

```lua
local r, g, b = Colors:GetClass("WARLOCK")
```

### `Colors:GetQuality(name)` → `r, g, b`

```lua
local r, g, b = Colors:GetQuality("epic")
```

### `Colors:GetPower(token)` → `r, g, b`

```lua
local r, g, b = Colors:GetPower("mana")
```

---

## Color Wrapping

### `Colors:Wrap(text, colorName)` → `string`

Wrap text in WoW color escape sequences using a named palette color:

```lua
local wrapped = Colors:Wrap("Important!", "error")
myFontString:SetText(wrapped)
-- Renders as red "Important!"
```

Works with any named palette color: `"primary"`, `"success"`, `"warning"`, `"error"`, etc. Unknown names fall back to `"ffffff"`.

---

## Color Math

### `Colors:Lerp(c1, c2, t)` → `table`

Linear interpolation between two colors (names or tables) by factor `t` (0-1). Returns `{r, g, b}`:

```lua
local purple = Colors:Lerp("red", "blue", 0.5) -- midpoint
```

### `Colors:Darken(colorName, amount)` → `r, g, b`

Darken a color by `amount` (default `0.2`). Returns multi-return components; unknown colors return `0, 0, 0`:

```lua
local r, g, b = Colors:Darken("primary", 0.3)
```

### `Colors:Lighten(colorName, amount)` → `r, g, b`

Lighten a color by `amount` (default `0.2`). Returns multi-return components; unknown colors return `1, 1, 1`:

```lua
local r, g, b = Colors:Lighten("primary", 0.3)
```

---

## Color Picker

### `Colors:OpenPicker(options)`

Opens the Blizzard color picker popup for an initial color:

```lua
Colors:OpenPicker({
    color = "primary",
    hasOpacity = false,
    onChanged = function(color, r, g, b, a, cancelled)
        print("New color:", color.hex)
    end,
})
```

`color` accepts a palette name, `"#RRGGBB"` string, `{r, g, b}` table, or color table. `onChanged` fires live on every change and receives a color table plus component values; `cancelled` is true when the user cancels, and `onCancel` is also supported. Returns `true`, or `false` when the client picker is unavailable.

### `Colors:CreateColorPicker(parent, opts)` → `frame`

Creates an inline label + swatch picker. `opts.onChanged(frame, color, r, g, b, a, cancelled)` fires on change; `opts.onCancel` is also supported. Use `frame:SetColor(color)` / `frame:GetColor()`:

```lua
local picker = Colors:CreateColorPicker(parent, {
    label = "Pick a Color",
    color = { r = 0.5, g = 0.2, b = 0.8 },
    onChanged = function(frame, color, r, g, b, a)
        myTexture:SetColorTexture(color.r, color.g, color.b, color.a or 1)
    end,
})
```

### `Colors:CreateColorSettingControl(parent, opts)` → `frame`

Color swatch + label with optional reset, bound to `opts.storage[opts.key]`. `opts.onChanged(frame, color, r, g, b, a, cancelled)` fires on changes and `opts.onReset(frame, color)` on reset:

```lua
local control = Colors:CreateColorSettingControl(parent, {
    label = "Text Color",
    storage = MyAddonDB.profile,
    key = "textColor",
    onChanged = function(frame, color, r, g, b, a)
        -- update UI
    end,
})
```

### `Colors:ApplyStatusBar(statusBar, colorName)`

Apply a named palette color to a StatusBar's foreground texture:

```lua
Colors:ApplyStatusBar(myHealthBar, "green")
```
