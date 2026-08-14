# SUPER SIMPLE RGX Integration

## A Complete Addon In One Call

### 1. Add RequiredDeps

```
## RequiredDeps: RGX-Framework
## SavedVariables: MyAddonDB
```

### 2. Declare the addon

```lua
-- MyAddon.lua — this is the entire addon. Line 1 is the addon.
RGXAddon "MyAddon" {
    slash   = "myaddon",
    minimap = true,
    db      = { enabled = true, volume = 80 },
    options = {
        General = {
            { toggle = "enabled", label = "Enable Addon" },
            { slider = "volume",  label = "Volume", min = 0, max = 100, suffix = "%" },
        },
    },
    welcome = "loaded — /myaddon for options",
}
```

No `local`, no `assert`, no event frames, no `C_Timer`, no `SLASH_X`, and no
manual SavedVariables handling. Declare `MyAddonDB` once in the TOC; `RGXAddon`
creates and manages its profile-aware proxy. `RequiredDeps` guarantees the
framework global exists before your Lua loads.

Behavior goes in `onInit`:

```lua
    onInit = function(self)
        self:RegisterEvent("PLAYER_LOGIN", function() self:Print("Ready!") end)
        self:Every(30, function() self:Scan() end)
    end,
```

> **This surface is governed by the frozen [[Declarative API]] contract.** Tier 4 adds human trigger words (`on = { levelup = fn }`), named timers, one-line control strings (`"slider volume 0-100"`), and grid card layouts. Everything is additive: what you write today keeps working forever.

## Just Want Fonts?

### Apply a Font

```lua
RGX:Font(myText)                      -- framework default font/size/flags
RGX:Font(myText, "Inter-Regular")     -- named font, default size/flags
RGX:Font(myText, "Inter-Regular", 16, "OUTLINE")  -- everything explicit
```

`RGX:Font` never requires more than the one thing you actually want to change — name, size, and flags all default to the framework's own settings when omitted.

## That's It!

### Font UI, one line each

```lua
_G.RGXFonts:AttachStyleSelector(parent, db, "titleText")  -- mounts a db-bound style picker
_G.RGXFonts:ApplyTextStyle(myText, db.titleText)          -- applies it
_G.RGXFonts:AttachFontSelector(parent, db, "titleFont")   -- font-only binding
```

Anything beyond one line (style objects, standalone selectors, previews) lives in [FONTS.md](FONTS.md) — it does not belong in the super-simple path.

## Complete Example

```lua
-- .toc file
## Interface: 120100
## Title: MyAddon
## RequiredDeps: RGX-Framework
## SavedVariables: MyAddonDB

MyAddon.lua
```

```lua
-- MyAddon.lua — a whole working addon
RGXAddon "MyAddon" {
    slash   = "myaddon",
    db      = { enabled = true },
    options = {
        General = {
            { toggle = "enabled", label = "Enable Addon" },
        },
    },
    onInit = function(self)
        local text = UIParent:CreateFontString(nil, "OVERLAY")
        RGX:Font(text, "Inter-Regular", 14, "OUTLINE")
        text:SetPoint("CENTER")
        text:SetText("Hello with Inter font!")
    end,
}
```

## BPU Example

```lua
-- Add RGX fonts to BPU's list
for _, info in ipairs(_G.RGXFonts:ListAvailable()) do
    addon:RegisterMedia("font", info.name, info.path)
end

-- Use RGX font (one line!)
RGX:Font(myText, selectedFont)
```

## What Addon Authors Should Actually Use

**For the addon itself:**

- `RGX.Addon(name, opts)` — the front door: slash, minimap, db, options tabs, welcome, onInit in one call
- `addon:RegisterEvent` / `addon:After` / `addon:Every` / `addon:Print` — scoped plumbing on the returned object

**For fonts specifically:**

- `GetPath(fontName)` when you only need a path
- `CreateStyle(styleTable)` when you want one normalized style object
- `ApplyTextStyle(fontString, style)` when you want one-call application
- `CreateSimpleFontSelector(parent, opts)` for a grouped nested font dropdown
- `CreateSimpleStyleSelector(parent, opts)` for a reusable style widget
- `AttachFontSelector(parent, db, key)` for one-line DB-bound font UI
- `AttachStyleSelector(parent, db, key)` for one-line DB-bound style UI

## Why This Works

1. `## RequiredDeps: RGX-Framework` ensures RGX loads first
2. `RGX.Addon()` maps your declarative table onto framework-managed paths — no event frames, no `C_Timer`, no `SLASH_X`, no SavedVariables boilerplate
3. Module globals like `_G.RGXFonts` are created by RGX-Framework, so à la carte helpers are one line each

No bridge layer, no per-addon plumbing, and no need to rebuild dropdowns by hand.
