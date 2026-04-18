# Using RGX-Framework in PetBuddy2

## Step 1: Add Dependency

In `PetBuddy2.toc`:
```
## RequiredDeps: RGX-Framework
```

## Step 2: Replace Font Code

**OLD PB2 code (in options.lua):**
```lua
-- Register fonts manually
addon:RegisterMedia("font", "Roboto", "Interface/AddOns/PetBuddy2/media/fonts/Roboto.ttf")
-- ... etc for each font

-- Later: get font path
local fontPath = addon:FetchMedia("font", selectedFont)
```

**NEW with RGX-Framework:**
```lua
local RGX = _G.RGXFramework
local Fonts = RGX:GetModule("fonts")

-- Get font path (automatically falls back to defaults if not available)
local fontPath = Fonts:GetPath("Roboto-Regular")

-- Or get font with size/flags
local path, size, flags = Fonts:Get("Roboto-Bold", 14, "OUTLINE")
myText:SetFont(path, size, flags)
```

## Step 3: Font Dropdown

**OLD:**
```lua
for _, font in ipairs(addon:ListMedia("font")) do
    -- create dropdown item
end
```

**NEW:**
```lua
local Fonts = RGX:GetModule("fonts")
for _, fontInfo in ipairs(Fonts:List()) do
    local fontName = fontInfo.name
    local isAvailable = fontInfo.available
    -- create dropdown item
end
```

## Step 4: Apply Fonts

```lua
-- Get RGX fonts module
local Fonts = RGX:GetModule("fonts")

-- Apply to PetBuddy2's font objects
function addon:RefreshFonts()
    local fontName = self.db.global.fontFace or Fonts:GetDefault()
    local fontSize = self.db.global.fontSize or 10

    local path = Fonts:GetPath(fontName)

    PetBuddyFontTitle:SetFont(path, fontSize + 2, "OUTLINE")
    PetBuddyFontNormal:SetFont(path, fontSize, "OUTLINE")
    PetBuddyFontSmall:SetFont(path, math.max(8, fontSize - 1), "OUTLINE")
end
```

## Benefits

1. **No font files in PB2** - All fonts live in RGX-Framework
2. **Shared fonts** - Other addons using RGX-Framework get the same fonts
3. **Automatic fallbacks** - If a font isn't available, automatically uses defaults
4. **Easy updates** - Update fonts in one place (RGX-Framework)
