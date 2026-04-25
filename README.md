# RGX-Framework

A modular WoW Retail addon foundation. Provides fonts, colors, textures, dropdowns, UI controls, minimap buttons, pet battle events, a native event/timer/hook runtime, and shared utilities — all in one required dependency so every addon in a suite shares the same plumbing instead of duplicating it.

***

## Overview

RGX-Framework is a modern, self-contained addon framework — an alternative to Ace3 covering events, timers, hooks, slash commands, minimap, options panels, database, and data broker, plus a full media stack (fonts, colors, textures, shared media), combat and reputation event libraries, and pet battle support. It is not a player-facing addon — it loads silently and exposes an API.

**One dependency. Everything you need.** Declare `RequiredDeps: RGX-Framework` once and every addon in your suite shares the same initialized instance — events, timers, hooks, minimap, fonts, UI controls, combat events, and more, loaded once, always up-to-date. No embedded libraries to juggle. No version arbitration. When the framework updates, every addon on the player's machine benefits automatically.

**What it provides:** a lifecycle-aware event bus, a tick-based timer system, hook helpers, slash command registration, 30+ bundled fonts, a named color palette, statusbar textures, nested dropdowns with auto-width and inline buttons, reusable UI controls, an options panel builder, circular-drag minimap buttons, pet battle callbacks, a combat event library, reputation/renown tracking, a shared media registry, a color picker, and a data broker registry.

The framework is used by `SimpleQuestPlates`, `petbuddy2`, and `RemoveNameplateDebuffs`, and is designed to be usable by any addon author, not just first-party projects.

***

## Quick Start

```toc
## RequiredDeps: RGX-Framework
```

```lua
local RGX = assert(_G.RGXFramework, "MyAddon: RGX-Framework not loaded")

-- Optional: defer initialization until the framework is fully ready
RGX:OnReady(function()
    -- modules are guaranteed loaded here
    local Fonts    = RGX:GetFonts()
    local Colors   = RGX:GetColors()
    local Textures = RGX:GetTextures()
    local Drops    = RGX:GetDropdowns()
    local UI       = RGX:GetUI()
    local MM       = RGX:GetMinimap()
    local PB       = RGX:GetPetBattles()
end)
```

For addons that only need the event/timer/slash surface (no modules), `_G.RGXFramework` is available immediately at load time — no `OnReady` needed.

***

## Architecture

### Module System

Each module is a plain Lua table that registers itself into the framework at load time:

```lua
RGX:RegisterModule("fonts", FontsTable, { global = "RGXFonts" })
```

Modules are resolved by normalized name (lowercased). The framework maintains a `moduleAliases` table that maps short names to global variable names, so `RGX:GetModule("fonts")` first checks the internal registry, then falls back to looking up `_G["RGXFonts"]` if the module registered itself as a global before the framework saw it.

**Module shortcuts** — convenience wrappers over `GetModule`:

```lua
RGX:GetFonts()       -- "fonts"       → RGXFonts
RGX:GetColors()      -- "colors"      → RGXColors
RGX:GetTextures()    -- "textures"    → RGXTextures
RGX:GetDropdowns()   -- "dropdowns"   → RGXDropdowns
RGX:GetUI()          -- "ui"          → RGXUI
RGX:GetColorPicker() -- "colorpicker" → RGXColorPicker
RGX:GetMinimap()     -- "minimap"     → RGXMinimap
RGX:GetPetBattles()  -- "petbattles"  → RGXPetBattles
RGX:GetSharedMedia() -- "sharedmedia" → RGXSharedMedia
RGX:GetDesign()      -- "design"      → RGXDesign
RGX:GetCombat()      -- "combat"      → RGXCombat
RGX:GetReputation()  -- "reputation"  → RGXReputation
RGX:GetDataBroker()  -- "databroker"  → RGXDataBroker
```

**Module resolution API:**

```lua
RGX:GetModule(name)       -- soft get; returns nil if not loaded
RGX:RequireModule(name)   -- hard get; logs error via geterrorhandler() if missing
RGX:IsModuleLoaded(name)  -- boolean
RGX:GetLoadedModules()    -- sorted list of registered module names
```

### Load Order

The XML loader loads core files first (`core.lua`, `config.lua`, `database.lua`, `events.lua`, `runtime.lua`, `utils.lua`), then modules in dependency order, then `commands.lua`, then `initialization.lua`. Addons that depend on RGX-Framework are guaranteed to load after all of this.

### `...` Varargs Pattern

Each module file receives the addon name and the shared `RGX` table via WoW's `...` varargs:

```lua
local _, MyModule = ...
-- MyModule is the same table as _G.RGXFramework — modules populate it directly
```

***

## Modules

| Module | Global | `RGX:Get*()` | Description |
|---|---|---|---|
| Core | `RGXFramework` | — | Module registry, utilities, version |
| Fonts | `RGXFonts` | `GetFonts()` | 30+ bundled fonts, style objects, dropdowns |
| Colors | `RGXColors` | `GetColors()` | Named/class/quality colors, color picker, gradients |
| Textures | `RGXTextures` | `GetTextures()` | Statusbar textures, RGX-provided media |
| Dropdowns | `RGXDropdowns` | `GetDropdowns()` | Nested UIDropDownMenu, inline buttons, auto-width |
| UI | `RGXUI` | `GetUI()` | Slider, toggle, label, options panel builder |
| ColorPicker | `RGXColorPicker` | `GetColorPicker()` | Custom HSV color picker with presets |
| Minimap | `RGXMinimap` | `GetMinimap()` | Circular-drag minimap button, tooltip, persistent state |
| PetBattles | `RGXPetBattles` | `GetPetBattles()` | Pet battle callbacks, level-up detection, journal utils |
| SharedMedia | `RGXSharedMedia` | `GetSharedMedia()` | Sound/font/statusbar registry, drop-in sound pack scanner |
| Design | `RGXDesign` | `GetDesign()` | Visual building blocks using the static RGX palette |
| Combat | `RGXCombat` | `GetCombat()` | Combat event library — enter/leave/kill/damage/heal/crit |
| Reputation | `RGXReputation` | `GetReputation()` | Reputation and renown tracking, cross-expansion normalized |
| DataBroker | `RGXDataBroker` | `GetDataBroker()` | Data object registry — drop-in for LibDataBroker-1.1 |

***

## API Reference

### Lifecycle

```lua
RGX:IsReady()          -- true after ADDON_LOADED init completes
RGX:OnReady(fn)        -- call fn now if ready, otherwise queue for when ready
```

Use `OnReady` when your addon file runs at load time and needs framework modules to be initialized:

```lua
RGX:OnReady(function()
    local Fonts = RGX:GetFonts()
    Fonts:Apply(myLabel, "Inter-Regular", 13)
end)
```

***

### Core Utilities

```lua
RGX.version                  -- string from TOC metadata
RGX.debugMode                -- boolean; set true to enable RGX:Debug() output

-- Output
RGX:Print(...)               -- |cff58be81[RGX]|r ... (green prefix)
RGX:Warn(...)                -- |cffffcc00[RGX]|r ... (yellow prefix)
RGX:Error(...)               -- |cffff4444[RGX]|r ... (red prefix)
RGX:Debug(...)               -- prints only when debugMode is true

-- Object composition
RGX:Mixin(target, ...)       -- copy all fields from source tables into target; returns target

-- Deep copy / math
RGX:CopyTable(orig)          -- deep copy including metatables
RGX:Clamp(val, min, max)     -- number clamp
RGX:Lerp(a, b, t)            -- linear interpolation, t clamped to [0,1]
RGX:TableCount(tbl)          -- count all keys (pairs iteration)
```

***

### Events & Messages

RGX wraps WoW's C event system into a listener registry and adds an internal message bus for addon-to-addon and module-to-module communication. Both systems support optional `id` and `owner` tags for targeted unregistration.

```lua
-- WoW events
RGX:RegisterEvent(event, callback, id, owner)
RGX:UnregisterEvent(event, id)
RGX:UnregisterAllEvents(id)
RGX:FireEvent(event, ...)       -- manually fire into the listener registry

-- Internal messages (not WoW events)
RGX:RegisterMessage(message, callback, id, owner)
RGX:UnregisterMessage(message, id)
RGX:UnregisterAllMessages(id)
RGX:SendMessage(message, ...)

-- Module-local emitter (scoped to a named context)
local emitter = RGX:CreateEmitter(name)
emitter:RegisterCallback(signal, fn, id)
emitter:Fire(signal, ...)
```

Example:

```lua
RGX:RegisterEvent("PLAYER_LOGIN", function(event)
    print("logged in")
end, "myAddon-login")

RGX:RegisterMessage("MY_ADDON_READY", function(msg, data)
    print("addon ready:", data)
end, "myAddon-ready")

RGX:SendMessage("MY_ADDON_READY", { version = "1.0" })
```

***

### Timers

RGX implements its own tick-based timer driver using a hidden `OnUpdate` frame. Timers are plain tables returned by `CreateTimer` and cancelled by passing the reference back to `CancelTimer`.

```lua
RGX:After(duration, callback)              -- one-shot delay
RGX:Every(duration, callback)              -- repeating ticker; callback receives timer ref
RGX:CancelTimer(timer)                     -- stop a ticker or pending one-shot
RGX:CancelAllTimers()                      -- cancel all active timers
RGX:CreateTimer(duration, callback, repeating)  -- low-level; returns timer table
```

The `Every` callback signature is `function(timer)` so a repeating timer can cancel itself:

```lua
RGX:Every(0.5, function(t)
    if done then RGX:CancelTimer(t) end
end)
```

***

### Hooks

```lua
RGX:Hook(target, method, callback)
-- callback signature: function(original, self, ...) return original(self, ...) end

RGX:Unhook(target, method)
RGX:UnhookAll()
```

Example:

```lua
RGX:Hook(MyFrame, "Show", function(original, self, ...)
    print("frame shown")
    return original(self, ...)
end)
```

***

### Slash Commands

```lua
RGX:RegisterSlashCommand(commands, callback, id)
-- commands: string "mycommand" or table {"mycommand", "mc"}
-- callback: function(msg, editBox)
-- id: unique SLASH_CMD identifier (uppercase recommended)
```

***

### Utilities

**String:**

```lua
RGX:Trim(str)                    -- strip leading/trailing whitespace
RGX:Split(str, delimiter)        -- split string, returns table
RGX:Format(pattern, ...)         -- string.format wrapper
RGX:StartsWith(str, prefix)      -- boolean
RGX:EndsWith(str, suffix)        -- boolean
```

**Table:**

```lua
RGX:TableCount(tbl)              -- count all keys
RGX:TableKeys(tbl)               -- array of all keys
RGX:TableValues(tbl)             -- array of all values
RGX:TableContains(tbl, value)    -- boolean
RGX:TableMap(tbl, fn)            -- returns new table with fn(v) applied
RGX:TableFilter(tbl, fn)         -- returns new array of values where fn(v) is true
RGX:TableFind(tbl, fn)           -- returns first value where fn(v) is true
RGX:MergeTable(dst, src)         -- shallow merge src into dst, returns dst
RGX:CopyTable(orig)              -- deep copy
```

**Math:**

```lua
RGX:Round(num, decimals)         -- round to N decimal places
RGX:Clamp(val, min, max)
RGX:Lerp(a, b, t)
```

**WoW version:**

```lua
RGX:GetWoWVersion()              -- numeric build version
RGX:IsRetail()                   -- boolean
RGX:IsClassicEra()               -- boolean
```

***

### Fonts (`RGXFonts`)

The font registry stores font paths by name with metadata (family, category, license). Fonts can be registered by the framework, by external font pack addons, or by consumer addons at runtime.

**Registry:**

```lua
Fonts:Register(name, path, info)
-- info: { family, category, displayName, license, available }

Fonts:RegisterAddonFont(addonName, fontName, fontFile, info)
-- fontFile is relative to the addon directory; RGX resolves the full path

Fonts:RegisterFontPack(addonName, definitions)
-- definitions: { [fontName] = { file, family, category, license } }

Fonts:Exists(name)            -- boolean
Fonts:IsAvailable(name)       -- boolean; false if font file not found on disk
Fonts:GetInfo(name)           -- returns full registry entry table
Fonts:GetPath(name)           -- returns absolute font path string or nil
Fonts:Get(name, size, flags)  -- returns path, size, flags (resolved)
Fonts:GetFont(name, size, flags)  -- alias for Get
Fonts:List()                  -- array of all registered names
Fonts:ListAvailable()         -- array of names with files found on disk
Fonts:ListByCategory(cat)     -- array of names in a category
Fonts:GetCategories()         -- array of distinct category strings
Fonts:GetFamilies()           -- array of distinct family strings
Fonts:GetGroupedFonts()       -- nested table: { [category] = { [family] = { name, ... } } }
Fonts:FindByPath(path)        -- reverse lookup: path → name
```

**Applying fonts:**

```lua
Fonts:Apply(fontString, name, size, flags)    -- SetFont on a FontString
Fonts:Quick(fontString, name, size, flags)    -- same, with safe nil guards
Fonts:ApplyChildren(frame, name, size, flags) -- apply to all child FontStrings
Fonts:CreateString(parent, name, size, flags, layer)  -- create + apply
```

**Default management:**

```lua
Fonts:SetDefault(name)
Fonts:GetDefault()           -- name string
Fonts:SetDefaultSize(size)
Fonts:SetDefaultFlags(flags)
Fonts:SetAutoScale(enable)
```

**Style objects** — a style is a plain table describing a complete text appearance:

```lua
-- Fields: font, size, flags, color, shadowColor, shadowOffset {x,y},
--         justifyH, justifyV, spacing

local style = Fonts:CreateStyle({
    font     = "Inter-Regular",
    size     = 14,
    flags    = "OUTLINE",
    color    = "highlight",     -- named color or {r,g,b,a}
    justifyH = "LEFT",
})

Fonts:ApplyStyle(fontString, style)    -- applies all fields
Fonts:ApplyTextStyle(fontString, style)  -- alias
Fonts:NormalizeStyle(style)            -- fills missing fields with defaults
Fonts:GetStyle(font, size, flags)      -- builds a minimal style table
```

**Dropdowns and selectors:**

```lua
-- Full grouped font dropdown (grouped by category → family)
local control = Fonts:CreateFontDropdown(parent, {
    label    = "Font",
    value    = "Inter-Regular",   -- initial selection
    onChange = function(name, path) end,
    width    = 200,
})

-- Inline font setting control with preview and optional reset
local control = Fonts:CreateFontSettingControl(parent, {
    label      = "Quest Font",
    storage    = db,
    key        = "questFont",         -- stores the font PATH in db[key]
    showReset  = true,
    onChanged  = function(holder, name, path) end,
})
control:Reset()    -- revert to default

-- Simple selector (minimal opts surface)
local sel = Fonts:CreateSimpleFontSelector(parent, opts)

-- Attach to a db key directly (reads/writes db[key] as style table)
Fonts:AttachFontSelector(parent, db, key, opts)
```

**Flag helpers:**

```lua
Fonts:SplitFlags(flags)           -- "OUTLINE MONOCHROME" → { "OUTLINE", "MONOCHROME" }
Fonts:NormalizeFlags(flags)       -- normalizes string or table to canonical string
Fonts:DescribeFlags(flags)        -- human-readable description
Fonts:GetFlagPresets()            -- table of preset flag combinations
```

***

### Colors (`RGXColors`)

Named color registry covering WoW class colors, item quality colors, power type colors, and custom named colors. All return normalized `{r, g, b, a}` tables.

**Lookup:**

```lua
Colors:Get(name)              -- returns color table {r, g, b, a}
Colors:GetRGB(name)           -- returns r, g, b (multi-return)
Colors:GetHex(name)           -- returns "#RRGGBB" string
Colors:GetClass(className)    -- returns class color table
Colors:GetQuality(quality)    -- returns quality color table (0=poor … 5=legendary)
Colors:GetPower(powerType)    -- returns power type color table
```

**Text wrapping:**

```lua
Colors:Wrap(text, colorName)         -- "|cffRRGGBBtext|r"
Colors:WrapClass(text, className)    -- wrap in class color
Colors:WrapQuality(text, quality)    -- wrap in quality color
```

**Color math:**

```lua
Colors:Create(r, g, b, a)           -- returns new color table
Colors:Clone(color)                 -- deep copy of a color table
Colors:Darken(colorName, amount)    -- returns new darkened color
Colors:Lighten(colorName, amount)   -- returns new lightened color
Colors:SetAlpha(colorName, alpha)   -- returns new color with alpha set
Colors:Lerp(color1, color2, t)      -- interpolate between two colors
Colors:Gradient(pct, low, mid, high)  -- 3-stop gradient; mid optional
Colors:Health(percent)              -- health gradient (green → yellow → red)
Colors:RGBToHex(r, g, b)           -- returns "RRGGBB"
Colors:HexToRGB(hex)               -- returns r, g, b
```

**Apply helpers:**

```lua
Colors:ApplyText(fontString, colorName)
Colors:ApplyTexture(texture, colorName)
Colors:ApplyStatusBar(statusBar, colorName)
```

**Color picker (Blizzard API, old + new compat):**

```lua
Colors:OpenPicker({
    color     = "brand",             -- named color or {r,g,b,a} table
    hasOpacity = false,              -- enable alpha slider
    onChanged  = function(color, r, g, b, a, cancelled) end,
    -- fires on every live update and on cancel (cancelled=true)
})
```

**Inline color control:**

```lua
local swatch = Colors:CreateColorPicker(parent, {
    label     = "Text Color",
    color     = { r=1, g=0.5, b=0 },
    hasOpacity = true,
    onChange  = function(r, g, b, a) end,
})

local control = Colors:CreateColorSettingControl(parent, {
    label   = "Bar Color",
    storage = db,
    key     = "barColor",     -- reads/writes db[key] = {r,g,b,a}
})
```

***

### Textures (`RGXTextures`)

Statusbar texture registry with optional LibSharedMedia import. Textures are grouped by source (framework-bundled, LibSharedMedia, addon-local).

```lua
Textures:RegisterBar(name, path, opts)
-- opts: { group, source }

Textures:RegisterBars(sourceName, bars, opts)
-- bars: { [name] = path }

Textures:Exists(name)             -- boolean
Textures:GetInfo(name)            -- returns registry entry { name, path, group, source }
Textures:GetBar(name)             -- returns path string
Textures:GetDefault()             -- returns default texture name
Textures:GetDefaultPath()         -- returns default texture path
Textures:SetDefault(name)
Textures:ListBars()               -- sorted array of all registered names
Textures:ListAvailable()          -- same; alias
Textures:GetGroups()              -- array of distinct group strings
Textures:ListByGroup(group)       -- array of names in a group
Textures:GetDropdownItems()       -- grouped item list for CreateNestedDropdown
Textures:ImportLibSharedMedia(force)  -- pull all registered LSM bars into registry

Textures:ApplyToStatusBar(statusBar, name)
Textures:ApplyToTexture(region, name)

-- Inline texture selector
local control = Textures:CreateBarDropdown(parent, opts)
local control = Textures:CreateBarSettingControl(parent, opts)
Textures:AttachBarSelector(parent, db, key, opts)
```

***

### Dropdowns (`RGXDropdowns`)

Wraps WoW's `UIDropDownMenu` system with full nested support, auto-sizing, and inline per-item widgets. All built on WoW's native API — no custom scroll frames.

**Core dropdown:**

```lua
local dd = Drops:CreateNestedDropdown(parent, {
    label     = "Choose Font",
    width     = 200,
    value     = "Inter-Regular",   -- initial selected value

    -- Item fields:
    -- { text, value }              — leaf item
    -- { text, children = {...} }   — submenu
    -- { text, isHeader = true }    — non-selectable section header
    -- { isSeparator = true }       — horizontal divider
    -- { text, icon = "path" }      — icon left of label
    -- { text, colorCode = "|cff..." } — colored label
    -- { text, keepOpen = true }    — don't close on select
    items = {
        { text = "Sans", isHeader = true },
        { text = "Inter", value = "Inter-Regular", children = {
            { text = "Regular", value = "Inter-Regular" },
            { text = "Bold",    value = "Inter-Bold"    },
        }},
        { isSeparator = true },
        { text = "None", value = "" },
    },

    onChange = function(value, item) end,

    -- Auto-size the list frame after render
    autoWidth = { minWidth = 200, leftInset = 10 },

    -- Called after each leaf item is added to the menu frame
    onButtonCreated = function(buttonFrame, item) end,
})
```

**Auto-sizing:**

`ForceWidth` is deferred via `RGX:After(0)` — it runs two passes: first measuring all button label widths, then applying the resolved width to the list frame and all buttons. This handles WoW's constraint that list frames are sized before button content is rendered.

```lua
Drops:ForceWidth(level, minWidth, leftInset, opts)
-- opts: { inlineKeys, compactRight, countKey }
-- level: 1 = root, 2 = first submenu, etc.
```

**Inline buttons (per-item widgets):**

Inline buttons are attached to individual dropdown button frames and persist across re-renders by key:

```lua
Drops:AddInlineButton(buttonFrame, {
    key     = "preview",    -- reuse key (default "inline")
    text    = "▶",
    width   = 20,
    height  = 16,
    tooltip = "Preview sound",
    onClick = function(inlineBtn, buttonFrame) end,
})

Drops:HideInlineButtons(level, key)   -- hide before re-populating a level
```

**Other helpers:**

```lua
Drops:GetListFrame(level)              -- returns _G["DropDownList"..level]
Drops:ShortenLabel(text, maxChars)     -- truncate with "..."
Drops:NormalizeItems(items)            -- normalize item list in place
```

***

### UI Controls (`RGXUI`)

Reusable options panel widgets. Each `Create*` function returns a frame with a consistent interface (value getter/setter, label, optional reset button).

```lua
-- Font dropdown (thin wrapper around Fonts:CreateFontDropdown)
local ctrl = UI:CreateFontDropdown(parent, {
    label    = "Font",
    value    = "Inter-Regular",
    onChange = function(name, path) end,
    width    = 200,
})

-- Statusbar texture dropdown
local ctrl = UI:CreateStatusBarDropdown(parent, {
    label    = "Bar Texture",
    value    = "Smooth",
    onChange = function(name, path) end,
})

-- Pop-up font selector menu
UI:OpenFontMenu(anchor, {
    value    = currentFont,
    onChange = function(name, path) end,
})

-- Inline color swatch + picker
local ctrl = UI:CreateColorPicker(parent, {
    label     = "Color",
    color     = { r=1, g=0.5, b=0, a=1 },
    hasOpacity = true,
    onChange  = function(r, g, b, a) end,
})

-- Slider
local ctrl = UI:CreateSlider(parent, {
    label   = "Size",
    min     = 8,
    max     = 32,
    step    = 1,
    value   = 14,
    onChange = function(value) end,
    width   = 200,
})

-- Toggle checkbox
local ctrl = UI:CreateToggle(parent, {
    label    = "Show icon",
    value    = true,
    onChange = function(value) end,
})

-- Label
local lbl = UI:CreateLabel(parent, {
    text  = "Section Header",
    font  = "Inter-Bold",
    size  = 13,
    color = "highlight",
})

-- Reset button
local btn = UI:CreateResetButton(parent, function() end)

-- Section divider with optional title
local sec = UI:CreateSection(parent, {
    title = "Appearance",
    width = 400,
})

-- Preview frame (styled backdrop panel)
local preview = UI:CreatePreviewFrame(parent, {
    width  = 300,
    height = 60,
    label  = "Preview",
})
```

***

### Minimap (`RGXMinimap`)

One-call circular draggable minimap button. Handles frame construction, angle math, drag-to-reposition, tooltip rendering, show/hide state, and storage — so addons only describe what they want, not how to build it.

**Create:**

```lua
local btn = MM:Create({
    name         = "MyAddonMinimapButton",   -- unique global frame name (required)
    icon         = "Interface\\...",         -- icon texture path (required)
    defaultAngle = 220,                      -- degrees, 0=right, 90=top (default 220)
    buttonSize   = 32,                       -- outer frame size (default 32)
    iconSize     = 19,                       -- icon texture size (default 19)
    iconOffsetX  = 0,                        -- icon CENTER x offset (default 0)
    iconOffsetY  = -1,                       -- icon CENTER y offset (default -1)

    -- Storage option A: flat table
    storage    = MyAddonDB,       -- table to read/write directly
    angleKey   = "minimapAngle",  -- default "minimapAngle"
    enabledKey = "minimapEnabled",-- default "minimapEnabled"

    -- Storage option B: custom callbacks (takes priority over storage)
    getAngle = function() return db.minimap.angle end,
    setAngle = function(v) db.minimap.angle = v end,

    -- Tooltip
    tooltip = {
        title       = "|cffFF8000My Addon|r",
        icon        = "Interface\\...",
        description = "Optional subtitle line",
        lines = {
            { left = "|cff58be81Left-Click|r",       right = "Open options" },
            { left = "|cff4ecdc4Drag|r",             right = "Move around minimap" },
            { left = "|cffe74c3cCtrl+Right-Click|r", right = "Hide icon" },
        },
    },

    -- Click handlers
    onLeftClick  = function(btn) end,
    onRightClick = function(btn) end,
    onCtrlRight  = function(btn) btn:SetVisible(false) end, -- default

    -- Visibility change (fires after show/hide + storage write)
    onVisibilityChanged = function(visible, btn) end,
})
```

**Button wrapper API:**

```lua
btn:SetVisible(bool)   -- show/hide + write enabledKey to storage + fire onVisibilityChanged
btn:Toggle()           -- flip visibility
btn:Show()             -- place at current angle then show frame
btn:Hide()             -- hide frame
btn:IsShown()          -- boolean
btn:GetEnabled()       -- reads enabledKey from storage; returns true if not explicitly false
btn:PlaceAtAngle()     -- reposition from stored angle (call after forced Show)
btn:GetAngle()         -- returns current stored angle in degrees
btn:SetAngle(deg)      -- store angle (writes via setAngle callback or storage[angleKey])
btn.frame              -- the raw WoW Button frame
```

**Registry:**

```lua
MM:Get(name)           -- retrieve an existing button wrapper by frame name
```

**Drag math:** angle is computed as `math.deg(math.atan2(cursor.y - minimap.y, cursor.x - minimap.x))`, normalized to `[0, 360)`. Radius is `math.max(Minimap:GetWidth(), Minimap:GetHeight()) / 2 + 10` to handle non-square minimap frames.

***

### PetBattles (`RGXPetBattles`)

Callback-based pet battle event library. Addons register handlers instead of wiring raw WoW events. Levelup events are debounced (1 second per slot) to suppress the rapid-fire duplicates WoW sends.

**Callbacks:**

```lua
PB:OnLevelUp(function(petID, petSlot, newLevel, oldLevel) end)
PB:OnCapture(function(petID, petSlot) end)
PB:OnBattleStart(function() end)
PB:OnBattleEnd(function() end)
PB:OnPetChanged(function() end)
```

Multiple addons can register independent callbacks — each call appends to the listener list.

**State queries:**

```lua
PB:IsAvailable()                  -- true if pet battle system is accessible
PB:IsInBattle()                   -- true during an active pet battle
PB:GetNumPets()                   -- count of owned pets
PB:GetPetInfoByIndex(index)       -- C_PetJournal.GetPetInfoByIndex result table
PB:GetPetInfoByID(petID)          -- C_PetJournal.GetPetInfoByPetID result table
PB:GetPetLevel(petID)             -- cached level for a petID (nil if not scanned)
PB:ScanPetLevels()                -- populate internal petID → level cache
PB:CheckPetLevels()               -- diff scan: fires OnLevelUp for any changed levels
PB:SchedulePetLevelScan(delay)    -- RGX:After(delay, ScanPetLevels)
```

**Events wired internally:** `PET_BATTLE_LEVEL_CHANGED`, `PET_BATTLE_PET_CHANGED`, `PET_BATTLE_CAPTURED`, `PET_BATTLE_OPENING_START`, `PET_BATTLE_CLOSE`, `PLAYER_LOGIN`.

***

## Font Coverage

30+ bundled fonts organized by category:

- **Sans / UI:** Inter, Ubuntu, Liberation Sans, DejaVu Sans, Lato, Poppins, Montserrat, Rajdhani
- **Serif:** Crimson Text, Merriweather, Playfair Display
- **Monospace:** IBM Plex Mono, JetBrains Mono
- **Display:** Bebas Neue, Bangers, Creepster, Oswald, Orbitron, Audiowide, Anton
- **Pixel:** Press Start 2P, Silkscreen, VT323
- **Fantasy / Themed:** Uncial Antiqua, Cinzel
- **WoW defaults:** Friz Quadrata, Arial Narrow, Morpheus, Skurri

Font pack addons can extend the registry at runtime with `Fonts:RegisterFontPack(addonName, defs)`. See [docs/FONT-SOURCES.md](docs/FONT-SOURCES.md) for attribution.

***

## Compatibility

- WoW **Retail** only
- Interface versions: `120000`, `120001`
- `C_AddOns.GetAddOnMetadata` and `GetAddOnMetadata` are both handled
- `ColorPickerFrame` old API and new `ColorPickerInteraction` API are both handled
- `Settings.RegisterCanvasLayoutCategory` and `InterfaceOptions_AddCategory` are both handled in consumer addons

Any addon can declare:

```toc
## RequiredDeps: RGX-Framework
## OptionalDeps: RGX-Framework
```

For `OptionalDeps` consumers, guard with `local RGX = _G.RGXFramework` before use.

***

## Documentation

- [docs/CHANGES.md](docs/CHANGES.md) — version history
- [docs/ROADMAP.md](docs/ROADMAP.md) — planned additions
- [docs/FOUNDATION.md](docs/FOUNDATION.md) — design philosophy
- [docs/ACE3-ANALYSIS.md](docs/ACE3-ANALYSIS.md) — comparison with Ace3
- [docs/FONT-SOURCES.md](docs/FONT-SOURCES.md) — font attribution and licenses
- [docs/SUPER-SIMPLE.md](docs/SUPER-SIMPLE.md) — minimal integration guide
- [docs/USAGE-PB2.md](docs/USAGE-PB2.md) — petbuddy2 integration notes

***

## Support

- GitHub: https://github.com/DonnieDice/RGX-Framework
- Issues: https://github.com/DonnieDice/RGX-Framework/issues
- Discord: https://discord.gg/N7kdKAHVVF

***

## License

MIT for framework code. Bundled fonts retain their own open licenses — see [docs/FONT-SOURCES.md](docs/FONT-SOURCES.md) for attribution.
