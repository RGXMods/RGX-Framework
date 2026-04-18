# SUPER SIMPLE RGX Integration

## The Absolute Minimum Code

### 1. Add RequiredDeps

```
## RequiredDeps: RGX-Framework
```

### 2. Get Font Path

```lua
local path = _G.RGXFonts:GetPath("Inter-Regular")
myText:SetFont(path, 12, "OUTLINE")
```

## That's It!

## Complete Example

```lua
-- .toc file
## Interface: 110002
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

## PB2 Example

```lua
-- Add RGX fonts to PB2's list
for _, info in ipairs(_G.RGXFonts:ListAvailable()) do
    addon:RegisterMedia("font", info.name, info.path)
end

-- Use RGX font (one line!)
local path = _G.RGXFonts:GetPath(selectedFont)
myText:SetFont(path, 12, "OUTLINE")
```

## Available Fonts

- Inter-Regular
- Inter-Bold
- DejaVuSans
- DejaVuSans-Bold
- LiberationSans-Regular
- LiberationSans-Bold
- Ubuntu-Regular
- Ubuntu-Bold
- FRIZQT (WoW default)
- ARIALN (WoW default)
- And more...

## Why This Works

1. `## RequiredDeps: RGX-Framework` ensures RGX loads first
2. `_G.RGXFonts` is created by RGX-Framework
3. Just call `:_G.RGXFonts:GetPath("fontname")` to get any font

No bridges, no complex API, just `_G.RGXFonts` and `GetPath()`.
