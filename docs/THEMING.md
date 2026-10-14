# RGX Theming and Design System

Visual identity, color palette, textures, and styling conventions.

## Theme Key Contract

`RGXDesign` resolves every color request through one deterministic contract,
implemented in [`libraries/design/design.lua`](../libraries/design/design.lua).
This section documents the shipped behavior: which keys exist, their
defaults, the exact resolution order for `Design:GetColor(key)`, and what
happens when a theme supplies only some of the tokens.

### Theme key inventory

A theme supplies two color tokens — `primary` and `accent` — plus three
derived shade keys computed from `primary`. Everything else is structural
palette, owned by interface styles, not by themes.

**Theme tokens** (settable via `Design:SetTheme`):

| Key | Aliases accepted by `SetTheme` | Default | Usage |
|---|---|---|---|
| `primary` | `main`, `mainColor`, `highlight`, `highlightColor`, `themeColor` | `{0.000, 0.902, 1.000}` (`#00e6ff` cyan) | Main theme color: labels, borders, fills, slider fills |
| `accent` | `secondary`, `secondaryHighlight` | `{0.737, 0.435, 0.659}` (`#bc6fa8` purple) | Secondary highlight; active states |
| `borderActive` | *(read via `GetColor` only; maps to `primary`)* | resolves to `primary` | Focused / selected widget borders |

`borderActive` is a read-side alias, not an independent stored token:
`Design:GetColor("borderActive")` returns the current `Theme.primary`.

**Main-color shade derivatives** (never stored; computed from
`Theme.primary` at read time, so they always follow the active theme):

| Key | Derivation | Usage |
|---|---|---|
| `mainSurface` | `primary × 0.10` | Panel/card fills that echo the theme color |
| `mainHover` | `primary × 0.20` | Hover-state fills |
| `mainBorder` | `primary × 0.35` | Section-header frames and muted theme borders |

Because they are derived on every `GetColor` call, shade keys are never stale
after a theme change and must not be cached across `SetTheme` calls.

**Structural palette keys** (owned by interface styles via
`Design:SetStyle`, stored in `Design.Colors`, shipped `framework` defaults):

| Key | Default (framework style) | Usage |
|---|---|---|
| `surface` | `{0.086, 0.086, 0.110}` | Panel and card backgrounds |
| `background` | `{0.055, 0.055, 0.071}` | Main window / frame backgrounds |
| `panelAlt` | `{0.102, 0.102, 0.129}` | Alternate panel fill (sections, wells) |
| `text` | `{0.910, 0.910, 0.933}` | Primary text |
| `subtext` | `{0.545, 0.545, 0.596}` | Secondary / dimmed text |
| `label` | `{0.357, 0.357, 0.400}` | Muted label text |
| `success` | `{0.200, 0.800, 0.400}` | Positive indicators |
| `warning` | `{0.941, 0.706, 0.161}` | Caution indicators |
| `error` | `{0.878, 0.333, 0.333}` | Error / negative indicators |
| `border` | `{0.137, 0.137, 0.173}` | Default panel / widget borders |
| `hover` | `{0.102, 0.102, 0.129}` | Hover state highlights |
| `track` | `{0.137, 0.137, 0.173}` | Widget tracks (sliders, scrollbars) |

A theme passed to `SetTheme` does **not** own any of these keys. A table
containing `surface` or `border` is not a supported complete skin override
just because those names are readable color tokens — structural values come
from `Design.Colors` and change only through `Design:SetStyle` (or direct
`Design.Colors` edits, which styles overwrite).

### `GetColor` resolution order

`Design:GetColor(key)` resolves in four stages, in this exact order
(`libraries/design/design.lua`, `MAIN_SHADES` → `THEME_KEYS` → `Design.Colors`):

1. **Main-shade derivatives** — if `key` is `mainSurface`, `mainHover`, or
   `mainBorder`, the result is computed immediately as
   `Theme.primary × {0.10 | 0.20 | 0.35}`. This wins over everything,
   including any structural value of the same name.
2. **Theme tokens** — stage-2 keys are exactly the entries of `THEME_KEYS`:
   `primary`, `main`, `mainColor`, `highlight` (→ `Theme.primary`),
   `accent` (→ `Theme.accent`), and `borderActive` (→ `Theme.primary`).
   Note the asymmetry with `SetTheme`: the extended input aliases
   `highlightColor`, `themeColor`, `secondary`, and `secondaryHighlight`
   are accepted only on the *write* side by `SetTheme` — they are **not**
   `GetColor` keys. `GetColor("highlightColor")` or
   `GetColor("secondary")` falls through to stage 4 and returns white.
3. **Structural palette** — otherwise the key is looked up in
   `Design.Colors` (populated by the active interface style via
   `Design:SetStyle`).
4. **Terminal fallback** — an unknown key anywhere returns `{1, 1, 1}`
   (white) rather than raising.

```lua
local Design = RGX:GetDesign()
Design:GetColor("main")         -- Theme.primary (alias resolution, stage 2)
Design:GetColor("mainBorder")  -- Theme.primary × 0.35 (stage 1 wins first)
Design:GetColor("surface")     -- Design.Colors.surface (stage 3)
Design:GetColor("nonsense")    -- {1, 1, 1} (stage 4)
```

Theme tokens and shade derivatives are resolved live on every call, so UI
built before a theme change still picks up new colors when it next calls
`GetColor`; structural values change only when a style is applied.

### Partial-theme fallback chain

`Design:SetTheme(config)` is a **partial override**: it writes only the
tokens that are present *and* normalizable in `config`; every absent or
malformed token silently retains its current value.

Concretely, in `SetTheme`:

- `primary` is read from the first present key among `config.primary`,
  `config.main`, `config.mainColor`, `config.highlight`,
  `config.highlightColor`, `config.themeColor`;
- `accent` is read from the first present key among `config.accent`,
  `config.secondary`, `config.secondaryHighlight`;
- each candidate goes through color normalization — array form
  `{r, g, b}` (or `{r, g, b, a}`) passes through, named form
  `{r = . . ., g = . . ., b = . . .}` is converted, and anything else
  (wrong type, missing channels) is discarded;
- `Theme.primary` is replaced only if a normalizable primary was found;
  `Theme.accent` is replaced only if a normalizable accent was found.

**Observable consequence:** passing only a primary keeps the previous
(global) accent. This is the "gold accent fallback" seen on SQP Forever
options tabs — a consumer that calls `SetTheme({ primary = gold })` gets the
gold primary it asked for while `accent` remains whatever was previously
active (for example the framework's purple default, or another consumer's
leftover), because `SetTheme` never resets or defaults the tokens it was not
given.

Three ways to scope a full, predictable `{primary, accent}` pair:

```lua
-- 1. Supply both tokens in one call (global, persists until the next
--    SetTheme / preset change)
Design:SetTheme({ primary = GOLD, accent = PURPLE })

-- 2. Scoped: apply for the duration of one construction block, then restore
--    the previous tokens automatically (never mutates shared defaults)
Design:WithTheme({ primary = GOLD, accent = PURPLE }, function()
    local panel = Design:CreateFrame(parent, { color = "mainSurface" })
end)

-- 3. Per-panel: build the panel, then recolor via SetPanelColor (themes do
--    not leak into other panels)
panel:SetPanelColor(Design:GetColor("mainHover"))
```

`Design:WithTheme(theme, fn)` snapshots the current `primary`/`accent`,
applies the partial theme for `fn`'s duration, and restores the snapshot
afterwards (including on error). Because it composes the same partial
semantics, a `WithTheme` that names only `primary` also leaves `accent`
untouched for the duration — supply both when the block must render a
coherent pair.

Named presets (`Design:SetThemePreset(name)`) always set both tokens:
every entry in `Design.THEME_PRESETS` (`cyan`, `gold`, `green`, `purple`,
`rose`) is a complete `{primary, accent}` pair, so switching presets never
produces a mixed pair.

### Composition rules: who owns which key

| Layer | Owns | Stored in | Persisted as |
|---|---|---|---|
| Interface style (`Design:SetStyle`, `framework`/`retail`/`classic`/`forever`) | Corner treatment + all 12 structural palette keys | `Design.Colors` + `Design.cornerStyle` | `RGXFrameworkDB.style` |
| Color preset (`Design:SetThemePreset`) | Complete `{primary, accent}` pair | `Design.Theme` + `Design.currentPreset` | `RGXFrameworkDB.themePreset` |
| Consumer theme (`Design:SetTheme` / `WithTheme`) | `primary`/`accent` (partial OK) | `Design.Theme` (scoped restore for `WithTheme`) | not persisted |

On login the framework re-applies the persisted style (`SetStyle`) and color
preset (`SetThemePreset`) before modules build UI, in that order. Explicit
consumer `SetTheme`/`WithTheme` calls at construction time take precedence
for the elements they build; the settings selectors continue to override
the global tokens when the operator changes them.

The `forever` style palette is a **starting point** for in-game tuning, not
native Forever client styling — client-export fidelity is pending operator
evidence tracked in
[#21](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/21).
Follow #21's phase order: stabilize the BLU-derived SQP layout
([#16](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/16))
before switching skins, then verify actual flavor assets/build and in-game
rendering.

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
| `accent` | `#bc6fa8` | Purple | Secondary highlight; active states |

The framework settings **Main color** preset selector stores its choice in
`RGXFrameworkDB.themePreset`; the corner selector stores `cornerStyle`.
Existing widgets need a reload to rebuild with the selected theme/corners.
Explicit consumer themes and corner options continue to take precedence.

### Interface Styles

`Design:SetStyle(name)` selects a full visual style — corner treatment plus
structural palette — independently of the primary/accent color presets:

| Style | Corners | Look |
|---|---|---|
| `framework` (default) | rounded | Custom RGX dark navy used across the board |
| `retail` | rounded | Retail-flavored blue steel |
| `classic` | square | Classic-flavored warm stone |
| `forever` | square | Forever-flavored deep green |

```lua
Design:SetStyle("classic") -- square corners, warm palette; primary/accent untouched
Design:GetStyle()          -- "classic"; nil after direct SetCornerStyle/SetTheme edits
```

The choice persists in `RGXFrameworkDB.style` and re-applies on login.
Styles take effect on UI built after the call; already-open windows re-skin
on reload, same as the corner selector. Retail/classic/forever palettes are
starting points for in-game tuning.

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
Colors:ApplyText(myFontString, "primary")     -- named RGXColors palette color
Colors:ApplyStatusBar(myBar, "success")
```

### Wrapping text with colors

```lua
local Colors = RGX:GetColors()
local wrapped = Colors:Wrap("Hello", "primary")  -- |cff00a2ffHello|r
local classText = Colors:WrapClass("Hunter", "HUNTER")
local qualText = Colors:WrapQuality("Epic", 4)
```

### Color math

```lua
local Colors = RGX:GetColors()
local dimmed = Colors:Darken("primary", 0.3)      -- 30% darker
local bright = Colors:Lighten("blue", 0.2)        -- 20% lighter
local mid    = Colors:Lerp(Colors:Get("primary"), Colors:Get("blue"), 0.5)
local health = Colors:Health(0.75)                  -- green → yellow → red gradient
```

---

## Visual Building Blocks

`RGXDesign` provides helper methods for creating consistent UI elements:

- Panel backgrounds with the RGX surface color
- Section headers using RGX fonts with the theme's primary/accent colors
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
    color = "primary",       -- resolved via the RGXColors palette
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

### Minimap button with theme colors

```lua
RGX:CreateMinimapButton({
    name = "MyAddonMinimap",
    icon = "Interface\\AddOns\\MyAddon\\media\\logo.tga",
    tooltip = {
        title = Colors:Wrap("My Addon", "primary"),
        lines = {
            { left = Colors:Wrap("Left-Click", "primary"), right = "Open options" },
            { left = Colors:Wrap("Drag", "purple"), right = "Reposition" },
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
