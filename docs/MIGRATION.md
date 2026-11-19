# Moving an addon onto RGX-Framework

Guide for addon authors moving hand-built plumbing (event frames, timers, hooks, slash globals, media and saved variables) onto RGX-Framework.

---

## Migration Goal

RGX-Framework should make addon development easier, not force every addon into the same shape.

Your addon remains a normal addon table with its own branding, saved variables, features, and product logic. RGX provides reusable building blocks:

- `RequiredDeps: RGX-Framework`
- lifecycle helpers
- event, timer, and slash-command APIs
- minimap button creation
- options UI controls
- media, font, texture, and sound helpers
- theme/highlight tokens
- common gameplay callback modules

Use the existing RGX-native addons as references:

| Reference pattern | Use As Reference For |
|---|---|
| Traveler's-log utility | lifecycle, Traveler's Log events, minimap launchers |
| Options-heavy addon | options panels, UI controls, fonts, nameplate-heavy event wiring |
| Small utility addon | direct events/timers/slash/minimap structure |
| Large suite | broad migration, sound categories, media registry pressure |

The intended migration is incremental: keep the addon working, move one repeated system at a time into RGX, and leave addon-specific behavior in the addon.

---

## From standalone code

### Addon object and lifecycle

| Hand-built | RGX |
|---|---|
| A global table and an `ADDON_LOADED` frame | `RGXAddon "Name" { ... }` or `local RGX = assert(_G.RGXFramework, "Addon: RGX not loaded")` |
| Work after the framework is ready | `RGX:OnReady(function() ... end)` |
| Work at login | `on = { login = fn }` or `RGX:RegisterEvent("PLAYER_LOGIN", fn, id)` |
| Copying methods onto a table | `RGX:Mixin(target, source)` |

Your addon stays a plain Lua table; there is no base class and nothing is embedded.

### Events

| Hand-built | RGX |
|---|---|
| `CreateFrame("Frame")` + `RegisterEvent` + `OnEvent` | `RGX:RegisterEvent("EVENT", handler, id)` |
| `frame:UnregisterEvent("EVENT")` | `RGX:UnregisterEvent("EVENT", id)` |
| Cross-file signalling through globals | `RGX:RegisterMessage("MSG", handler, id)` / `RGX:SendMessage("MSG", ...)` |

The `id` string makes cleanup explicit and names the owner of every handler.

### Timers

| Hand-built | RGX |
|---|---|
| `C_Timer.After(delay, fn)` | `RGX:After(delay, fn)` |
| `C_Timer.NewTicker(interval, fn)` | `RGX:Every(interval, fn)` or declarative `every` |
| `ticker:Cancel()` | `RGX:CancelTimer(timer)` |

RGX timers run on one framework driver with a frame budget. The `Every` callback receives the timer reference for self-cancellation.

### Hooks

| Hand-built | RGX |
|---|---|
| `hooksecurefunc(target, "Method", fn)` | `RGX:Hook(target, "Method", fn)` |

RGX hooks are post-only and permanent. Do not replace Blizzard functions as a migration shortcut.

### Slash commands

| Hand-built | RGX |
|---|---|
| `SLASH_X1 = "/cmd"` + `SlashCmdList.X = fn` | `RGX:RegisterSlashCommand("cmd", handler, id)` or declarative `slash` |

### Saved variables

| Hand-built | RGX |
|---|---|
| Reading the SavedVariables global and filling defaults by hand | `RGX:DB("MyAddonDB", defaults)` (basic) |
| Profiles and per-character data | `RGX:NewDatabase(name, defaults, opts)`; profile switching and global data |

Profiles, migrations and `SerializeProfile`/`DeserializeProfile` are implemented
in `core/systems/database.lua`. Preserve explicit `false`, nested defaults,
global data and reload persistence when migrating. See [API](API.md) and
[Testing](TESTING.md); do not treat a visually correct options panel as proof
that its SavedVariables owner is correct.

### Media

| Hand-built | RGX |
|---|---|
| Font path strings | `Fonts:Register(name, path, info)` / `Fonts:GetPath(name)` / `Fonts:ListAvailable()` |
| Status bar texture paths | `Textures:RegisterBar(name, path, opts)` / `Textures:GetBar(name)` / `Textures:ListBars()` |

RGX fonts carry metadata (family, category, license) and are grouped in dropdowns by category then family.

---

## From Manual Font Management

### Inline Font Application

**Before:**

```lua
local fontPath = "Interface\\AddOns\\MyAddon\\media\\fonts\\MyFont.ttf"
myFontString:SetFont(fontPath, 14, "OUTLINE")
```

**After:**

```lua
local Fonts = RGX:GetFonts()
Fonts:Apply(myFontString, "Inter-Regular", 14, "OUTLINE")
-- or
Fonts:Quick(myFontString, "Inter-Regular", 14, "OUTLINE") -- nil-safe
```

### Font Dropdown

**Before (manual UIDropDownMenu):** 50+ lines of initialization, item creation, event wiring.

**After:**

```lua
local Fonts = RGX:GetFonts()
Fonts:AttachFontSelector(parent, db, "fontFamily", { label = "Font" })
```

### Style Objects

**Before:**

```lua
db.titleFont = "Inter-Regular"
db.titleSize = 14
db.titleFlags = "OUTLINE"
-- apply each separately
myLabel:SetFont(Fonts:GetPath(db.titleFont), db.titleSize, db.titleFlags)
```

**After:**

```lua
Fonts:AttachStyleSelector(parent, db, "titleText")
-- db.titleText is now a style table: { font, size, flags }
Fonts:ApplyStyle(myLabel, db.titleText)
```

---

## From a Legacy Media System

### Font Registration

**Legacy pattern:**

```lua
addon:RegisterMedia("font", "Roboto", "Interface/AddOns/MyAddon/media/fonts/Roboto.ttf")
local path = addon:FetchMedia("font", selectedFont)
```

**With RGX:**

```lua
local Fonts = RGX:GetFonts()
local path = Fonts:GetPath(selectedFont)
```

No per-addon font registration needed — RGX fonts are already available.

### Context Menu Fonts

**Legacy pattern:** Build font items manually for UIDropDownMenu context menus.

**With RGX:**

```lua
local fontItems = Fonts:CreateFontMenuItems({
    current = db.fontFamily,
    onSelect = function(name)
        db.fontFamily = name
        addon:RefreshFonts()
    end,
})
-- dual-schema: legacy func + RGX onClick, legacy menuList + RGX children
```

### Saved Variables

The legacy saved-variable keys are preserved:

- `fontFamily` — font name string
- `killFontFamily` — font name string
- `lootFontFamily` — font name string
- `percentFontFamily` — font name string

These can be read by `Fonts:ResolveName(db.fontFamily)` which handles both name and path values.

---

## From a Legacy Suite

This table maps each legacy system of a large suite to its RGX equivalent.

| Legacy system | RGX Equivalent | Status |
|---|---|---|
| `core/systems/database.lua` | `RGX:NewDatabase(name, defaults, opts)` — profile-aware proxy | Done |
| `core/sounds/sharedmedia.lua` | `RGXSharedMedia` (a thin bridge into the suite's own registry) | Done |
| `core/events.lua` | `RGX:RegisterEvent` / `RGX:RegisterMessage` | Done |
| `core/runtime.lua` | `RGX:After` / `RGX:Every` / `RGX:Hook` | Done |

---

## Checklist

When migrating an addon to RGX-Framework:

1. Add `## RequiredDeps: RGX-Framework` to your TOC
2. Add `local RGX = assert(_G.RGXFramework, "AddonName: RGX-Framework not loaded")` at the top of each file that uses RGX
3. Replace `C_Timer.After` with `RGX:After`
4. Replace manual `CreateFrame("Frame")` event frames with `RGX:RegisterEvent`
5. Replace `SLASH_X1 = ...` patterns with `RGX:RegisterSlashCommand`
6. Replace manual font path strings with `Fonts:GetPath(name)`
7. Replace manual font dropdowns with `Fonts:CreateFontDropdown` or `Fonts:AttachFontSelector`
8. Replace hardcoded RGB values with `Colors:Get(name)` / `Colors:Wrap(text, name)`
9. Wrap module-dependent init code in `RGX:OnReady(function() ... end)`
10. Remove any embedded third-party libraries the addon no longer needs
