# SUPER SIMPLE RGX Integration

## A Complete Addon In One Call

### 1. Add RequiredDeps

```
## RequiredDeps: RGX-Framework
```

### 2. Declare the addon

```lua
-- MyAddon.lua — this is the whole addon
local RGX = assert(_G.RGXFramework, "MyAddon: RGX-Framework not loaded")

RGX.Addon("MyAddon", {
    slash   = "myaddon",                        -- /myaddon opens options
    minimap = true,                             -- minimap button (default icon)
    db      = { enabled = true, volume = 80 },  -- saved settings on addon.db
    options = {
        General = {
            { toggle = "enabled", label = "Enable Addon" },
            { slider = "volume",  label = "Volume", min = 0, max = 100 },
        },
    },
    welcome = "loaded — /myaddon for options",
})
```

Saved variables, profile support, a tabbed options panel with db-bound controls, a slash command, a minimap button, and branded output — no event frames, no `C_Timer`, no `SLASH_X` globals, no SavedVariables boilerplate. The framework owns all of the unsafe plumbing.

Add behavior inside `onInit`:

```lua
    onInit = function(self)
        self:RegisterEvent("PLAYER_LOGIN", function()
            self:Print("Ready!")
        end)
        self:Every(30, function() self:Print("tick") end)
    end,
```

## Just Want Fonts?

### Get Font Path

```lua
local path = _G.RGXFonts:GetPath("Inter-Regular")
myText:SetFont(path, 12, "OUTLINE")
```

## That's It!

## Slightly Better: One Shared Style Table

```lua
local Fonts = _G.RGXFonts

local style = Fonts:CreateStyle({
    font = "Inter-Regular",
    size = 14,
    flags = "OUTLINE",
})

Fonts:ApplyTextStyle(myText, style)
```

## Easiest UI Integration

### Full-Scope Easiest

```lua
_G.RGXFonts:AttachStyleSelector(parent, db, "titleText")
_G.RGXFonts:ApplyTextStyle(myText, db.titleText)
```

That is the intended "one line to mount UI, one line to apply" path.

```lua
local Fonts = _G.RGXFonts

local fontSelector = Fonts:CreateSimpleFontSelector(parent, {
    label = "Font",
    value = "Inter-Regular",
    onChange = function(fontName)
        saved.font = fontName
        Fonts:ApplyTextStyle(myText, saved)
    end,
})

local styleSelector = Fonts:CreateSimpleStyleSelector(parent, {
    label = "Text Style",
    value = saved,
    onChange = function(style)
        saved = style
        Fonts:ApplyTextStyle(myText, saved)
    end,
})
```

### Font-Only Binding

```lua
_G.RGXFonts:AttachFontSelector(parent, db, "titleFont")
```

## Complete Example

```lua
-- .toc file
## Interface: 120007
## Title: MyAddon
## RequiredDeps: RGX-Framework

MyAddon.lua
```

```lua
-- MyAddon.lua
-- Get a font path
local fontPath = _G.RGXFonts:GetPath("Inter-Regular")

-- Create text with RGX font
local text = UIParent:CreateFontString(nil, "OVERLAY")
text:SetFont(fontPath, 14, "OUTLINE")
text:SetPoint("CENTER")
text:SetText("Hello with Inter font!")
```

## BPU Example

```lua
-- Add RGX fonts to BPU's list
for _, info in ipairs(_G.RGXFonts:ListAvailable()) do
    addon:RegisterMedia("font", info.name, info.path)
end

-- Use RGX font (one line!)
local path = _G.RGXFonts:GetPath(selectedFont)
myText:SetFont(path, 12, "OUTLINE")
```

## What Addon Authors Should Actually Use

- `GetPath(fontName)` when you only need a path
- `CreateStyle(styleTable)` when you want one normalized style object
- `ApplyTextStyle(fontString, style)` when you want one-call application
- `CreateSimpleFontSelector(parent, opts)` for a grouped nested font dropdown
- `CreateSimpleStyleSelector(parent, opts)` for a reusable style widget
- `AttachFontSelector(parent, db, key)` for one-line DB-bound font UI
- `AttachStyleSelector(parent, db, key)` for one-line DB-bound style UI

## Why This Works

1. `## RequiredDeps: RGX-Framework` ensures RGX loads first
2. `_G.RGXFonts` is created by RGX-Framework
3. The simple path is just `_G.RGXFonts`, `CreateStyle`, `ApplyTextStyle`, and the selector helpers

No bridge layer, no per-addon font plumbing, and no need to rebuild dropdowns by hand.
