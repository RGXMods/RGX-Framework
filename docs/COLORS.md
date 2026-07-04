# Colors Module

The Colors module (`RGXColors`) provides a named color palette, class/quality/power color lookups, color math utilities, color wrapping, and the ColorPicker widget.

---

## Named Palette

| Name | Hex | Usage |
|---|---|---|
| `red` | `#f44336` | Errors, health loss |
| `blue` | `#2196f3` | Mana, info |
| `green` | `#4caf50` | Success, gains |
| `yellow` | `#ffeb3b` | Warnings |
| `orange` | `#ff9800` | Warnings |
| `purple` | `#9c27b0` | Epic items |
| `cyan` | `#00bcd4` | Info highlights |
| `white` | `#ffffff` | Normal text |
| `gray` | `#9e9e9e` | Disabled/muted |
| `black` | `#000000` | Backgrounds |
| `primary` | `#58be81` | Brand primary |
| `accent` | `#bc6fa8` | Brand accent |
| `epic` | `#a335ee` | Epic quality |
| `rare` | `#0070dd` | Rare quality |
| `uncommon` | `#1eff00` | Uncommon quality |
| `common` | `#ffffff` | Common quality |
| `poor` | `#9d9d9d` | Poor quality |
| `legendary` | `#ff8000` | Legendary quality |
| `heirloom` | `#00ccff` | Heirloom quality |
| `artifact` | `#e6cc80` | Artifact quality |
| `enchant` | `#ffd100` | Enchant quality |

---

## Class Colors

`Colors:GetClass(className)` returns a `ColorMixin` for the given English class name:

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

`Colors:GetQuality(qualityEnum)` returns a `ColorMixin` for item quality:

| Enum | Quality | Hex |
|---|---|---|
| 0 | Poor (gray) | `#9D9D9D` |
| 1 | Common (white) | `#FFFFFF` |
| 2 | Uncommon (green) | `#1EFF00` |
| 3 | Rare (blue) | `#0070DD` |
| 4 | Epic (purple) | `#A335EE` |
| 5 | Legendary (orange) | `#FF8000` |
| 6 | Artifact (gold) | `#E6CC80` |
| 7 | Heirloom (cyan) | `#00CCFF` |

---

## Power Colors

`Colors:GetPower(powerType)` returns a `ColorMixin` for the given power type string:

| Power Type | Hex |
|---|---|
| `MANA` | `#0000FF` |
| `RAGE` | `#FF0000` |
| `FOCUS` | `#FF8000` |
| `ENERGY` | `#FFFF00` |
| `COMBO_POINTS` | `#FF8000` |
| `RUNES` | `#8080FF` |
| `RUNIC_POWER` | `#0080FF` |
| `SOUL_SHARDS` | `#9482C9` |
| `LUNAR_POWER` | `#4C8C00` |
| `HOLY_POWER` | `#F58CBA` |
| `MAELSTROM` | `#0070DE` |
| `INSANITY` | `#9482C9` |
| `CHI` | `#00FF96` |
| `ARCANE_CHARGES` | `#69CCF0` |
| `FURY` | `#A330C9` |
| `PAIN` | `#C41F3B` |

---

## API

### `Colors:Get(name)` → `ColorMixin`

Get a named color from the palette.

```lua
local color = Colors:Get("primary")
myFontString:SetTextColor(color:GetRGB())
```

### `Colors:GetRGB(name)` → `r, g, b`

Get just the RGB components (0-1 range):

```lua
local r, g, b = Colors:GetRGB("error")
myTexture:SetColorTexture(r, g, b, 1)
```

### `Colors:GetHex(name)` → `string`

Get the full hex color string with alpha prefix:

```lua
local hex = Colors:GetHex("primary")
-- → "ff58be81"
```

### `Colors:Create(r, g, b, a)` → `ColorMixin`

Create a new ColorMixin instance:

```lua
local myColor = Colors:Create(0.5, 0.8, 0.3, 1.0)
```

### `Colors:Clone(color)` → `ColorMixin`

Clone an existing color:

```lua
local copy = Colors:Clone(myColor)
```

### `Colors:GetClass(className)` → `ColorMixin`

```lua
local classColor = Colors:GetClass("WARLOCK")
print(classColor.colorStr) -- → "ff9482C9"
```

### `Colors:GetQuality(qualityEnum)` → `ColorMixin`

```lua
local epicColor = Colors:GetQuality(4)
print(epicColor.colorStr) -- → "ffA335EE"
```

### `Colors:GetPower(powerType)` → `ColorMixin`

```lua
local manaColor = Colors:GetPower("MANA")
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

Works with any named palette color: `"primary"`, `"accent"`, `"success"`, `"warning"`, `"error"`, etc.

---

## Color Math

### `Colors:Lerp(c1, c2, t)` → `ColorMixin`

Linear interpolation between two colors by factor `t` (0-1):

```lua
local red = Colors:Get("red")
local blue = Colors:Get("blue")
local purple = Colors:Lerp(red, blue, 0.5) -- midpoint
```

### `Colors:Darken(color, amount)` → `ColorMixin`

Darken a color by `amount` (0-1). 0 = no change, 1 = black:

```lua
local darkPrimary = Colors:Darken(Colors:Get("primary"), 0.3)
```

### `Colors:Lighten(color, amount)` → `ColorMixin`

Lighten a color by `amount` (0-1). 0 = no change, 1 = white:

```lua
local lightPrimary = Colors:Lighten(Colors:Get("primary"), 0.3)
```

---

## Color Picker

### `Colors:OpenPicker(r, g, b, callback)`

Opens the RGX ColorPicker widget with an initial color and a change callback:

```lua
Colors:OpenPicker(0.5, 0.2, 0.8, function(newColor)
    print("New color:", newColor:GetRGB())
end)
```

The callback fires on every color change (live preview). `newColor` is a `ColorMixin`.

### `Colors:CreateColorPicker(parent, opts)` → `table`

Creates an embedded ColorPicker widget within a parent frame:

```lua
local picker = Colors:CreateColorPicker(parent, {
    label = "Pick a Color",
    value = { r = 0.5, g = 0.2, b = 0.8 },
    onChange = function(r, g, b, a)
        myTexture:SetColorTexture(r, g, b, a)
    end,
})
```

### `Colors:CreateColorSettingControl(parent, opts)` → `table`

Color swatch + label bound to a saved variable:

```lua
local control = Colors:CreateColorSettingControl(parent, {
    label = "Text Color",
    storage = MyAddonDB.profile,
    key = "textColor",
    onChange = function(r, g, b, a)
        -- update UI
    end,
})
```

### `Colors:ApplyStatusBar(statusBar, colorName)`

Apply a named palette color to a StatusBar's foreground texture:

```lua
Colors:ApplyStatusBar(myHealthBar, "green")
```
