# Minimap Module

The Minimap module (`RGXMinimap`) provides minimap button creation with circular drag tracking, angle persistence, and DataBroker integration.

---

## `Minimap:Create(config)` → `table`

Create a minimap button.

### Config Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `config.texture` | string | Yes | — | Icon texture path |
| `config.position` | number | No | 225 | Initial angle in degrees (0=top, 90=right, etc.) |
| `config.storage` | table | No | — | Saved variable table for angle persistence |
| `config.storageKey` | string | No | — | Key within storage for angle value |
| `config.tooltip` | string | No | — | Tooltip text on hover |
| `config.onClick` | function | No | — | `onClick(button, clickType)` handler |
| `config.onEnter` | function | No | — | `onEnter(button)` handler |
| `config.onLeave` | function | No | — | `onLeave(button)` handler |

### Returns

A button object with the methods below.

---

## Button Object Methods

### `button:SetVisible(visible)`

Show or hide the minimap button:

```lua
button:SetVisible(true)
button:SetVisible(false)
```

### `button:GetVisible()` → `bool`

Whether the button is currently shown.

### `button:GetAngle()` → `number`

Get the current angle in radians.

### `button:SetAngle(angle)`

Set the button position by angle (in radians):

```lua
button:SetAngle(math.rad(225))
```

### `button:SetTooltip(text)`

Update the tooltip text:

```lua
button:SetTooltip("MyAddon v2.0")
```

### `button:OnClick(callback)`

Override the click handler:

```lua
button:OnClick(function(btn, clickType)
    if clickType == "LeftButton" then
        MyAddon:Toggle()
    elseif clickType == "RightButton" then
        MyAddon:OpenConfig()
    end
end)
```

---

## Angle Persistence

When `storage` and `storageKey` are provided, the button's angle is automatically saved on drag end and restored on next login:

```lua
local button = Minimap:Create({
    texture = "Interface\\Icons\\INV_Misc_QuestionMark",
    storage = MyAddonDB.profile,
    storageKey = "minimapAngle",
    position = MyAddonDB.profile.minimapAngle or 225,
})
```

If no storage is provided, the angle is not persisted between sessions.

---

## Drag Behavior

- The button follows the cursor around the minimap edge while dragged
- Position is constrained to the minimap's circular border
- On drag end, the final angle is saved to `storage[storageKey]` (if configured)
- The button's position is recalculated relative to the minimap center

---

## DataBroker Integration

Minimap buttons created via `RGXMinimap` are compatible with DataBroker display addons (like TitanPanel, ChocolateBar). For DataBroker APIs, see [DataBroker](API.md#databroker-rgxdatabroker).

---

## Complete Example

```lua
local Minimap = RGX:GetMinimap()

local button = Minimap:Create({
    texture = "Interface\\AddOns\\MyAddon\\icon.tga",
    position = 225,
    storage = MyAddonDB.profile,
    storageKey = "minimapAngle",
    tooltip = "MyAddon - Click to toggle",
    onClick = function(btn, clickType)
        if clickType == "LeftButton" then
            MyAddon:Toggle()
        elseif clickType == "RightButton" then
            MyAddon:OpenConfig()
        end
    end,
})

-- Later: hide the button
button:SetVisible(false)

-- Later: change tooltip
button:SetTooltip("MyAddon - Active")
```
