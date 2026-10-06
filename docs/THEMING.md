# RGX Theming and Design System

Visual identity, color palette, textures, and styling conventions.

## Current Scope and Modular Skin Direction

The current implementation supplies color themes, main-color presets, derived
shades, corner preferences and shared frame primitives. `Design:SetTheme`
updates primary/accent (and their aliases); structural colors still come from
`Design.Colors`. A table containing `surface` or `border` is not a supported
complete skin override just because those names are readable color tokens.

Complete texture/frame skin selection remains tracked in
[#21](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/21).
Its intended ownership is:

- **Design/media:** theme keys, resolution/fallback, textures, borders and fonts.
- **UI/layout:** frame geometry, scrolling, pages/cards, interaction and binding.
- **Consumer:** choose presentation; supply feature-specific content and behavior.

Build on the existing `SetTheme`/`WithTheme` and UI factories. A skin swap must
preserve layout, callbacks and saved settings, including controls created lazily
after panel construction. A color preset does not prove native Forever styling.
Follow #21's phase order: stabilize the BLU-derived SQP layout before switching
skins, then verify actual flavor assets/build and in-game rendering.

---

## Design Palette (`RGXDesign`)

`RGXDesign` combines theme colors with a structural palette. Use its getters so
main-color shades follow the active theme:

```lua
local Design = RGX:GetDesign()
local primary = Design:GetColor("main")  -- {r, g, b}; alias of primary
local accent  = Design:GetColor("accent")
```

### Main Color and Derived Shades

| Key | Hex | RGB | Usage |
|---|---|---|---|
| `primary` / `main` / `mainColor` | `#00e6ff` | Cyan | Main theme color; overridden by the active theme |
| `accent` | `#bc6fa8` | Purple | Brand secondary, highlights, active states |

The framework settings **Main color** preset selector stores its choice in
`RGXFrameworkDB.themePreset`; the corner selector stores `cornerStyle`.
Existing widgets need a reload to rebuild with the selected theme/corners.
Explicit consumer themes and corner options continue to take precedence.

`SetTheme({ main = {r, g, b} })` and `SetMainColor(color, accent)` use the
existing primary/accent theme contract. `primary`, `highlight`, and the older
setter names remain supported. Shared shade tokens derive from the current
main color without consumer-side color arithmetic:

| Token | Main-color intensity |
|---|---|
| `mainSurface` | 10% |
| `mainHover` | 20% |
| `mainBorder` | 35% |

```lua
local panel = Design:CreateFrame(parent, {
    color = "mainSurface", borderColor = "mainBorder", square = false,
})
panel:SetPanelColor(Design:GetColor("mainHover")) -- recolor its rounded fill
```

For rounded frames, recolor the existing fill with `SetPanelColor` rather
than covering it with a rectangular highlight texture. The fill retains the
panel's existing nine-slice silhouette and one-pixel border inset. WoW does
not apply CSS `overflow: hidden`; rectangular child clipping alone does not
provide rounded-corner clipping. Square frames use their backdrop methods.

### Surface Colors

| Key | Usage |
|---|---|
| `surface` | Panel and card backgrounds |
| `background` | Main window / frame backgrounds |

### Text Colors

| Key | Usage |
|---|---|
| `text` | Primary text (light on dark) |
| `subtext` | Secondary / dimmed text |

### Semantic Colors

| Key | Usage |
|---|---|
| `success` | Positive indicators (completed, enabled, etc.) |
| `warning` | Caution indicators (pending, attention) |
| `error` | Error / negative indicators (failed, disabled) |

### Border Colors

| Key | Usage |
|---|---|
| `border` | Default panel / widget borders |
| `borderActive` | Focused / selected widget borders |
| `hover` | Hover state highlights |

---

## Using Colors in Code

### Via Design palette

```lua
local Design = RGX:GetDesign()
myFontString:SetTextColor(Design:Unpack("main"))
```

### Via Colors module

```lua
local Colors = RGX:GetColors()
Colors:ApplyText(myFontString, "primary")     -- if registered as named color
Colors:ApplyStatusBar(myBar, "success")
```

### Wrapping text with colors

```lua
local Colors = RGX:GetColors()
local wrapped = Colors:Wrap("Hello", "primary")  -- |cff58be81Hello|r
local classText = Colors:WrapClass("Hunter", "HUNTER")
local qualText = Colors:WrapQuality("Epic", 4)
```

### Color math

```lua
local Colors = RGX:GetColors()
local dimmed = Colors:Darken("primary", 0.3)      -- 30% darker
local bright = Colors:Lighten("accent", 0.2)      -- 20% lighter
local mid    = Colors:Lerp(Colors:Get("primary"), Colors:Get("accent"), 0.5)
local health = Colors:Health(0.75)                  -- green → yellow → red gradient
```

---

## Visual Building Blocks

`RGXDesign` provides helper methods for creating consistent UI elements:

- Panel backgrounds with the RGX surface color
- Section headers using brand fonts and primary/accent colors
- Consistent border styling with `border` and `borderActive`

---

## Font Styling Conventions

### RGX default font

`Inter-Regular` at 12pt with no flags. This is the framework default set in `config.lua`.

### Template styles

| Template | Font | Size | Flags | Use |
|---|---|---|---|---|
| `header` | Inter-Bold | 18 | — | Section headers |
| `title` | Inter-Bold | 14 | — | Panel titles |
| `small` | Inter-Regular | 10 | — | Captions, dimmed text |
| `default` | Inter-Regular | 12 | — | Body text |

```lua
local fs = Fonts:FromTemplate(parent, "title", "My Panel Title")
```

### Style objects for consumers

```lua
local Fonts = RGX:GetFonts()
local style = Fonts:CreateStyle({
    font = "Inter-Regular",
    size = 13,
    flags = "OUTLINE",
    color = "primary",       -- resolved from Design.Colors
    justifyH = "LEFT",
})
Fonts:ApplyStyle(myFontString, style)
```

---

## Statusbar Textures

```lua
local Textures = RGX:GetTextures()
Textures:ApplyToStatusBar(myBar, "Smooth")      -- apply by name
Textures:ImportLibSharedMedia()                   -- pull in LSM textures
```

Default texture: `"Blizzard"`.

---

## Consistent UI Patterns

### Options panel

```lua
local panel = RGX:Options({
    title = "My Addon",
    tabs = {
        { text = "General", content = function(parent)
            RGX:Toggle(parent, { label = "Enable", value = true, onChange = function(v) end })
            RGX:Slider(parent, { label = "Size", min = 8, max = 32, step = 1, value = 14, onChange = function(v) end })
            RGX:Section(parent, { title = "Fonts" })
            RGX:GetFonts():AttachFontSelector(parent, db, "fontFamily")
        end },
    },
})
```

### Minimap button with brand colors

```lua
RGX:CreateMinimapButton({
    name = "MyAddonMinimap",
    icon = "Interface\\AddOns\\MyAddon\\media\\logo.tga",
    tooltip = {
        title = Colors:Wrap("My Addon", "primary"),
        lines = {
            { left = Colors:Wrap("Left-Click", "primary"), right = "Open options" },
            { left = Colors:Wrap("Drag", "accent"), right = "Reposition" },
        },
    },
    onLeftClick = function() panel:Open() end,
})
```

### Dropdown with semantic color

```lua
local Drops = RGX:GetDropdowns()
local dd = Drops:CreateNestedDropdown(parent, {
    label = "Priority",
    items = {
        { text = "High",   value = "high",   colorCode = Colors:GetHex("error") },
        { text = "Medium", value = "medium", colorCode = Colors:GetHex("warning") },
        { text = "Low",    value = "low",    colorCode = Colors:GetHex("success") },
    },
    onChange = function(value) end,
})
```

---

## Icon and Texture Paths

Framework media layout:

```
media/
├── fonts/          — bundled font files (.ttf, .otf)
├── logo.tga        — framework icon (used in TOC IconTexture)
└── textures/       — statusbar textures
```

Consumer addons should use their own `media/` directories and reference icons via full `Interface\\AddOns\\AddonName\\media\\...` paths.
