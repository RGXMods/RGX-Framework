# Textures Module

The Textures module (`RGXTextures`) manages statusbar texture registration, selection, and integration with LibSharedMedia.

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

### `Textures:GetDefaultBar()` → `string`

Current default statusbar name. Default: `"Blizzard"`.

### `Textures:SetDefaultBar(name)`

Set the default statusbar. Must be a registered name:

```lua
Textures:SetDefaultBar("MyBar")
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

### `Textures:ImportLSM()`

Scan LibSharedMedia-3.0 (if loaded) for statusbar textures and register them. This is called automatically on the first call to `GetBar()`, `ListBars()`, or `CreateBarDropdown()` if LSM is present.

You can call it manually to force a re-scan:

```lua
Textures:ImportLSM()
```

---

## Built-in Statusbars

| Name | Path |
|---|---|
| `Blizzard` | `Interface\TargetingFrame\UI-StatusBar` |
| `Blizzard Raid` | `Interface\RaidFrame\Raid-Bar-Hp-Fill` |

---

## LibSharedMedia Integration

When LibSharedMedia-3.0 is present in the addon environment, RGX-Framework automatically imports its statusbar textures on first access. The import:

1. Checks if `LibSharedMedia-3.0` is available
2. Iterates `LSM:HashTable("statusbar")`
3. Registers each entry via `RegisterBar()`
4. Sets category to `"LibSharedMedia"`
5. Only runs once (guarded by `Textures._lsmImported` flag)

To add LSM textures manually at a specific time:

```lua
RGX:OnReady(function()
    local Textures = RGX:GetTextures()
    Textures:ImportLSM()
end)
```

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
