# UI Controls & Options Panel

The UI module (`RGXUI`) provides widget factories for common interface controls and a full options panel builder with tab system and scroll container.

---

## Widget Factories

`UI:CreateSwitch(parent, opts)` returns a db-bound on/off button. Its entire
element, including the label and surrounding hit area, toggles on click; the
smaller inset square is visual only. `UI:CreateCheckbox(parent, text)` returns
an unbound 18px checkbox row with `.checkbox` and `.label`, for consumers that
manage their own state callbacks.

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
| `opts.progress` | boolean | No | `true` | Show the brand-colored fill behind the thumb; `false` for a bare track |
| `opts.onChange` | function | No | — | `onChange(value)` |

> The thumb re-positions itself on `OnShow`, so a slider built on a panel that
> is still hidden (login/load) lands at the correct spot the first time the
> panel opens — no set/reset needed.

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

### `UI:CreateColorPickerCard(parent, opts)` → `Frame`

The **embeddable** color picker — the full SV-box + hue-bar + preview + hex
inline as a card, for placing directly in an options tab (instead of the popup
swatch). Multi-instance with its own state; bound to `storage[key] = {r,g,b}`.
Click or **drag** the SV box and hue bar to pick.

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `opts.key` | string | No | — | Storage key holding `{r,g,b}` |
| `opts.storage` | table | No | `{}` | Table the widget reads/writes |
| `opts.default` | table | No | white | `{r,g,b}` when storage is empty |
| `opts.width` | number | No | 220 | Card width |
| `opts.onChange` | function | No | — | `onChange(r, g, b)` on every change |

Returns the widget frame, with `:SetColor(r,g,b)` / `:GetColor()`.

```lua
local card = UI:CreateColorPickerCard(container, {
    key = "accent", storage = MyAddonDB, default = { r = 1, g = 0, b = 0 },
    onChange = function(r, g, b) MyAddon:SetAccent(r, g, b) end,
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

### `UI:CreateScrollPage(parent, height)` → `canvas, scrollFrame`

Create a clipped, scrollable canvas for option cards taller than the tab's
visible area. Position sections on the canvas; the canvas tracks the scroll
frame width. Classic-era's `UIPanelScrollFrameTemplate` supplies the scrollbar.

```lua
local page = UI:CreateScrollPage(content, 620)
local section = UI:CreateSection(page, { title = "General", height = 140 })
```

`UI:CreateSection` uses the same `RGXDesign:CreateSection` frame and
brand-bordered header that BLU uses; RGXUI handles geometry while RGXDesign owns textures
and themed colors. After adding controls to `section.content`, call
`section:FitContent()` to measure visible direct children and FontStrings
and size the card to them. Stacked cards anchored to its bottom follow the
resulting height. `UI:CreateColumns(parent, 2, { titles = { "Options", "Layout" } })`
returns card content frames; call `left.card:FitContent()` and
`right.card:FitContent()` once both columns are built.

`UI:CreateCard(parent, { title = "Font" })` provides a section with a flow
layout. Anchor stacked cards to the previous card's bottom so `FitContent()`
or `AutoHeight()` can reflow the column. Use
`UI:CreateColumns(parent, 2, { card = false })` for plain column hosts when
the cards themselves supply the section borders.

`UI:CreateButtonGroup(parent, { "Left", "Right" }, { y = -8 })` centers a
styled button pair in its parent (default 84px buttons, 8px gap). Buttons
are available as `group.buttons[1]` and `group.buttons[2]`.

`UI:AnchorRowReset(row, reset, control)` puts every reset at the same right
inset (8px) and centers it vertically on the control rather than its label.
Framework sliders and font dropdowns use this automatically.

For a single informational page without tab chrome, pass `content = function(frame)
... end` instead of `tabs`. Existing `tabs = { ... }` panels retain their tab
row and page lifecycle. The framework's AddOns settings category uses this
single-page form to link to RGX-Hello and list the available modules and tools.

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

#### Providing tabs

Tabs are supplied at creation through `opts.tabs`; each `content(container)`
builder runs once, the first time its tab is shown:

```lua
local panel = UI:CreateOptionsPanel({
    addonName = "MyAddon",
    tabs = {
        { text = "General", content = function(container)
            UI:CreateToggle(container, { key = "enabled", label = "Enabled", storage = MyAddonDB })
            UI:CreateSlider(container, { key = "scale", label = "Scale", min = 50, max = 150, storage = MyAddonDB })
        end },
        { text = "Colors", content = function(container)
            UI:CreateColorPicker(container, { key = "primary", label = "Primary Color", storage = MyAddonDB })
        end },
    },
})
```

#### Extending another addon's panel — `RGX:AddOptionsTab(addonName, text, builder[, geom])`

Register extra tabs onto an addon's panel **by name, before it is built** (i.e.
at file-parse time, from a second file). The declarative panel builder appends
them after the addon's own `options` tabs, so a bundled dev/test suite can live
on the addon's own panel instead of a separate window. `geom` optionally hints
panel `width`/`height`/`maxPerRow`; the largest hint across all registrations
wins. Panels are not rebuilt after creation, so this must run before the addon's
`ADDON_LOADED`.

```lua
RGX:AddOptionsTab("MyAddon", "Debug", function(container)
    UI:CreateButton(container, "Dump State", 120, 24, DumpState)
end, { maxPerRow = 5 })
```

`RGX:GetAddon(name)` returns the addon object (with `.panel`) if you need it.

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

- Framework scroll pages are clipping viewports with mouse-wheel scrolling;
  native scrollbar widgets are not created or shown. Canvas width uses the
  content area rather than reserving a visible-bar gutter.
- Numeric and discrete volume slider thumbs refresh after show and geometry
  changes, reading the current bound storage; redraw does not overwrite settings.
- Controls are positioned automatically within the scroll container
- Each control is anchored below the previous one
- Use `container` (the scroll child) as the parent for all controls
- The scroll container handles overflow automatically
- Tab content is built lazily on first show and cached unless invalidated

## Definition Round Trip (Source Development Slice)

This first editor slice is available on its feature source branch, not in the
published `v2.7.9` addon. It edits **one plain-text label definition**, using one
canonical schema (`schemas/rgx-definition.schema.json`) and equivalent guarded
Lua/runtime and pure JavaScript/tooling implementations. It does not implement
the complete Trigger/Conditions/Display/Actions/Load model, a Studio shell, or
Blizzard Edit Mode registration.

```lua
local definition = {
    version = 1, kind = "label", id = "example", text = "Hello RGX",
    enabled = true, x = 0, y = 0, scale = 100,
}
local UI = RGX:GetUI()
local editor, err = UI:CreateDefinitionEditor(parent, {
    definition = definition,
    onSave = function(saved)
        addon.db.labelDefinition = saved -- persist through the consumer's RGX DB
    end,
})
```

All fields are required. `id` is an ASCII identifier (letter followed by up to
47 letters/digits/underscores/hyphens); `text` is valid UTF-8 of at most 256 bytes
without ASCII controls; `enabled` preserves explicit false; x/y are integer
offsets in -500..500 (positive y is upward); scale is integer percent in 25..300.
The model owns coordinates and scale, not pixel-identical fonts across platforms.

`CreateDefinitionSession` owns independent saved and draft copies. Patch/Import
change only a successfully validated draft. Save calls a synchronous `onSave`
with an independent copy: nil/no return or true accepts; false, another return,
or an error rejects. Callback side effects are the callback's responsibility;
the session cannot roll back arbitrary consumer writes. Cancel and closing the
in-game control restore the last saved draft. Invalid visible fields block Save.
Getters return independent copies, not mutable session storage.

Import/export uses the data-only envelope
`RGXD1|label|id|enabled-bit|scale|x|y|percent-encoded-UTF8-text`.
Every text byte is encoded as `%XX`; no Lua parser, `loadstring`, code execution,
or live-game bridge is involved in imports. Unknown versions/fields, malformed
UTF-8/numbers, and inaccessible values are rejected without replacing the saved
definition. This is a transfer encoding, not a second authoring DSL.

### Try Both Adapters

1. Run `node tools/editor/serve.mjs` from a source checkout, then open
   `http://127.0.0.1:18790`. The allowlisted static server is loopback-only and
   read-only. The browser stores an explicitly saved definition in localStorage.
2. Install a manifest-built feature runtime in the intended test client; run
   `/rgx editor`. Save uses the framework's own DB leaf
   `RGXFrameworkDB.definitionExample`; closing/reloading must restore the saved
   definition. Unsupported stored definitions are preserved and reported.
3. Change and export a browser draft; paste/import it in-game. Change it there,
   export, and import back into the browser. Both directions must preserve text,
   false, position and scale. Import is a draft operation; Save remains explicit.
4. Test Save/Cancel, invalid fields, malformed imports, reopen/reload persistence,
   overflow/preview clipping, and unaffected panels in each affected client.

The in-game preview uses the existing RGX scroll viewport, sections, controls,
and options lifecycle. The ordinary InputBox template and user-input distinction
are verified in active Retail/Classic source mirrors under
`Blizzard_SharedXML/Shared/InputBox/InputBoxTemplates.xml` and `.lua`; legacy
Cataclysm/Forever visual behavior still needs client validation.

`npm --prefix tools/ci run definition-check` crosses the actual JS/Lua validators
and sessions in both directions, checks the JSON schema, exercises the real Lua
editor adapter with explicit widget seams, and verifies the static server routes.
Headless widget seams do not prove WoW geometry, protected-action behavior, or
actual browser rendering. Record those manual results under framework #27.

For AI-assisted authoring, `rgx_edit_definition` uses the same pure engine and
returns normalized data plus an interoperable export string. Its schema resource
is `rgx://schemas/definition`. It is optional source tooling and labels this slice
`sourceOnly`; it never writes files or executes generated actions.
