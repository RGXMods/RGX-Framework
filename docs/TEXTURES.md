# Textures Module

The Textures module (`RGXTextures`) manages statusbar texture registration and selection.

---

## API

### `Textures:RegisterBar(name, path, opts)`

Register a statusbar texture:

```lua
Textures:RegisterBar("MyBar", "Interface\\AddOns\\MyAddon\\Textures\\bar.tga", {
    category = "MyAddon",
})
```

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `name` | string | Yes | Texture name (used as key) |
| `path` | string | Yes | Texture file path |
| `opts.category` | string | No | Grouping category (default `"Custom"`) |

### `Textures:GetBar(name)` → `string|nil`

Get the texture path for a registered statusbar:

```lua
local path = Textures:GetBar("Blizzard")
-- → "Interface\\TargetingFrame\\UI-StatusBar"
```

### `Textures:ListBars()` → `table`

Array of all registered statusbar names:

```lua
local bars = Textures:ListBars()
for _, name in ipairs(bars) do
    print(name, Textures:GetBar(name))
end
```

### `Textures:GetDefault()` → `string`

Current default statusbar name. Default: `"Blizzard"`.

### `Textures:SetDefault(name)`

Set the default statusbar. Must be a registered name:

```lua
Textures:SetDefault("MyBar")
```

### `Textures:CreateBarDropdown(parent, opts)` → `table`

Create a statusbar texture selection dropdown:

```lua
local holder = Textures:CreateBarDropdown(parent, {
    title = "Select Bar Texture",
    onChange = function(barName)
        myStatusBar:SetStatusBarTexture(Textures:GetBar(barName))
    end,
})
```

### `Textures:CreateBarSettingControl(parent, opts)` → `table`

Create a bar dropdown + reset button bound to a saved variable:

```lua
local control = Textures:CreateBarSettingControl(parent, {
    label = "Bar Texture",
    storage = MyAddonDB.profile,
    key = "barTexture",
})
```

## Built-in Statusbars

| Name | Path |
|---|---|
| `Blizzard` | `Interface\TargetingFrame\UI-StatusBar` |
| `Blizzard Raid` | `Interface\RaidFrame\Raid-Bar-Hp-Fill` |

---

## Usage with StatusBar Frames

```lua
local Textures = RGX:GetTextures()

-- Create a health bar
local bar = CreateFrame("StatusBar", nil, UIParent)
bar:SetSize(200, 20)
bar:SetStatusBarTexture(Textures:GetBar("Blizzard"))

-- Let the user choose
local dropdown = Textures:CreateBarDropdown(configPanel, {
    onChange = function(barName)
    bar:SetStatusBarTexture(Textures:GetBar(barName))
    end,
})
```
