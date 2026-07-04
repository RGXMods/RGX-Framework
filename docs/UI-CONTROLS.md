# UI Controls & Options Panel

The UI module (`RGXUI`) provides widget factories for common interface controls and a full options panel builder with tab system and scroll container.

---

## Widget Factories

### `UI:CreateSlider(parent, opts)` → `Frame`

Create a horizontal slider control bound to a storage table — it saves **and restores** its value.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `parent` | Frame | Yes | — | Parent frame |
| `opts.key` | string | Yes | — | Storage key the slider reads/writes |
| `opts.storage` | table | No | `{}` | Table holding `storage[key]` (usually your db) |
| `opts.label` | string | No | key | Label text |
| `opts.min` / `opts.max` | number | No | 0 / 100 | Range |
| `opts.step` | number | No | 1 | Step increment |
| `opts.default` | number | No | min | Value when storage is empty; Reset target |
| `opts.suffix` | string | No | `""` | Appended to the displayed value, e.g. `"%"` |
| `opts.width` | number | No | 200 | Track width |
| `opts.onChange` | function | No | — | `onChange(value)` |

```lua
local slider = UI:CreateSlider(parent, {
    key = "scale", storage = MyAddonDB,
    label = "Scale", min = 50, max = 150, step = 5,
    default = 100, suffix = "%",
    onChange = function(val) MyFrame:SetScale(val / 100) end,
})
```

---

### `UI:CreateToggle(parent, opts)` → `Frame`

Create a checkbox toggle bound to a storage table.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `parent` | Frame | Yes | — | Parent frame |
| `opts.key` | string | Yes | — | Storage key |
| `opts.storage` | table | No | `{}` | Table holding `storage[key]` |
| `opts.label` | string | No | key | Label text beside the checkbox |
| `opts.default` | bool | No | — | Value when storage is empty; Reset target |
| `opts.onChange` | function | No | — | `onChange(checked)` |

```lua
local toggle = UI:CreateToggle(parent, {
    key = "notifications", storage = MyAddonDB,
    label = "Enable Notifications", default = true,
    onChange = function(checked) ... end,
})
```

---

### `UI:CreateLabel(parent, opts)` → `FontString`

Create a styled label using the theme's named sizes and colors.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `parent` | Frame | Yes | — | Parent frame |
| `opts.text` | string | Yes | — | Label text |
| `opts.size` | string | No | `"normal"` | `"small"` \| `"normal"` \| `"large"` |
| `opts.color` | string | No | `"normal"` | `"normal"` \| `"muted"` \| `"accent"` \| `"red"` \| `"green"` \| `"yellow"` (theme tokens) |
| `opts.width` | number | No | — | **Enables word wrap** at this width — required for long text, which otherwise renders past the parent frame's edge on a single line |
| `opts.justify` | string | No | `"LEFT"` | Horizontal justify (only with `width`) |

```lua
local hint = UI:CreateLabel(parent, {
    text = "A long descriptive sentence that needs to wrap inside the panel.",
    size = "small", color = "muted", width = 340,
})
```

---

### `UI:CreateColorPicker(parent, opts)` → `table`

Create a color swatch control that opens the ColorPicker on click.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `parent` | Frame | Yes | — | Parent frame |
| `opts.label` | string | No | — | Label text |
| `opts.value` | table | No | {1,1,1,1} | Initial color {r,g,b,a} |
| `opts.onChange` | function | No | — | `onChange(r, g, b, a)` callback |

**Returns:** `{ frame, swatch, label }`

```lua
local cp = UI:CreateColorPicker(parent, {
    label = "Background Color",
    value = {0.1, 0.1, 0.2, 1.0},
    onChange = function(r, g, b, a)
    myFrame:SetBackdropColor(r, g, b, a)
    end,
})
```

---

### `UI:CreateColorSettingControl(parent, opts)` → `table`

Color swatch + label bound to a saved variable. Changes write directly to `storage[key]`.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `parent` | Frame | Yes | Parent frame |
| `opts.label` | string | Yes | Label text |
| `opts.storage` | table | Yes | Saved variable table |
| `opts.key` | string | Yes | Key within storage |
| `opts.onChange` | function | No | Additional change callback |

```lua
local ctrl = UI:CreateColorSettingControl(parent, {
    label = "Bar Color",
    storage = MyAddonDB.profile,
    key = "barColor",
})
```

---

### `UI:CreateStatusBarDropdown(parent, opts)` → `table`

Statusbar texture selection dropdown. Delegates to the Textures module.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `parent` | Frame | Yes | Parent frame |
| `opts.label` | string | No | Label text |
| `opts.value` | string | No | Initial statusbar name |
| `opts.onChange` | function | No | `onChange(barName)` callback |

---

### `UI:CreateFontDropdown(parent, opts)` → `table`

Font family selection dropdown. Delegates to the Fonts module.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `parent` | Frame | Yes | Parent frame |
| `opts.label` | string | No | Label text |
| `opts.value` | string | No | Initial font name |
| `opts.onChange` | function | No | `onChange(fontName)` callback |

---

### `UI:CreateFontSettingControl(parent, opts)` → `table`

Font dropdown + reset button bound to `storage[key]`. Delegates to the Fonts module.

**Parameters:**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `parent` | Frame | Yes | Parent frame |
| `opts.label` | string | Yes | Label text |
| `opts.storage` | table | Yes | Saved variable table |
| `opts.key` | string | Yes | Key within storage |
| `opts.onChange` | function | No | Additional change callback |

---

## Options Panel Builder

### `UI:CreateOptionsPanel(name, opts)` → `panel`

Create a full options panel with tab system, scroll container, and header.

**Parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string | Yes | — | Panel name (used as frame name) |
| `opts.title` | string | No | name | Title text in header |
| `opts.subtitle` | string | No | "" | Subtitle text |
| `opts.width` | number | No | 800 | Panel width |
| `opts.height` | number | No | 600 | Panel height |
| `opts.version` | string | No | — | Version string shown in header |
| `opts.author` | string | No | — | Author string shown in header |
| `opts.website` | string | No | — | Website URL shown in header |

**Returns:** Panel object with methods below.

### Panel Methods

#### `panel:AddTab(name, buildFn)`

Add a tab to the panel. `buildFn(container)` is called once when the tab is first shown.

```lua
panel:AddTab("General", function(container)
    UI:CreateToggle(container, { label = "Enabled", value = true })
    UI:CreateSlider(container, { label = "Scale", min = 0.5, max = 2.0, step = 0.1, value = 1.0 })
end)

panel:AddTab("Fonts", function(container)
    UI:CreateFontDropdown(container, { label = "Header Font" })
    UI:CreateFontDropdown(container, { label = "Body Font" })
end)

panel:AddTab("Colors", function(container)
    UI:CreateColorPicker(container, { label = "Primary Color" })
end)
```

#### `panel:Open()`

Open the panel and navigate to it in Interface Options:

```lua
panel:Open()
```

#### `panel:SelectTab(index)`

Switch to a tab by 1-based index:

```lua
panel:SelectTab(2) -- switch to Fonts tab
```

#### `panel:SelectTabByName(name)`

Switch to a tab by its name:

```lua
panel:SelectTabByName("Fonts")
```

#### `panel:InvalidateAllTabs()`

Mark all tabs for rebuild. Next time each tab is shown, its `buildFn` will be re-executed:

```lua
panel:InvalidateAllTabs()
```

#### `panel:Refresh()`

Force-refresh the currently visible tab:

```lua
panel:Refresh()
```

---

## Complete Options Panel Example

```lua
local UI = RGX:GetUI()

local panel = UI:CreateOptionsPanel("MyAddonOptions", {
    title = "My Addon",
    subtitle = "v1.0.0 by Me",
    width = 800,
    height = 600,
})

panel:AddTab("General", function(container)
    UI:CreateToggle(container, {
        label = "Enable Addon",
        value = MyAddonDB.profile.enabled,
        onChange = function(v) MyAddonDB.profile.enabled = v end,
    })
    UI:CreateSlider(container, {
        label = "Update Interval",
        min = 0.1,
        max = 5.0,
        step = 0.1,
        value = MyAddonDB.profile.interval,
        onChange = function(v) MyAddonDB.profile.interval = v end,
    })
end)

panel:AddTab("Appearance", function(container)
    UI:CreateFontDropdown(container, {
        label = "Font Family",
        value = MyAddonDB.profile.fontFamily,
        onChange = function(v) MyAddonDB.profile.fontFamily = v end,
    })
    UI:CreateSlider(container, {
        label = "Font Size",
        min = 8,
        max = 24,
        step = 1,
        value = MyAddonDB.profile.fontSize,
        onChange = function(v) MyAddonDB.profile.fontSize = v end,
    })
    UI:CreateColorPicker(container, {
        label = "Text Color",
        value = MyAddonDB.profile.textColor,
        onChange = function(r, g, b, a)
        MyAddonDB.profile.textColor = {r, g, b, a}
        end,
    })
    UI:CreateStatusBarDropdown(container, {
        label = "Bar Texture",
        value = MyAddonDB.profile.barTexture,
        onChange = function(v) MyAddonDB.profile.barTexture = v end,
    })
end)

-- Register with WoW
InterfaceOptions_AddCategory(panel.frame)

-- Open from slash command
SLASH_MYADDON1 = "/myaddon"
SlashCmdList.MYADDON = function()
    panel:Open()
end
```

---

## Layout Notes

- Controls are positioned automatically within the scroll container
- Each control is anchored below the previous one
- Use `container` (the scroll child) as the parent for all controls
- The scroll container handles overflow automatically
- Tab content is built lazily on first show and cached unless invalidated
