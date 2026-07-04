# Quick Start

> **The fast path is the [[Declarative API]].** For most addons, `RGXAddon "MyAddon" { ... }` is the entire integration — saved settings, options panel, slash command, minimap button, events, all in one call. The rest of this page is the **à la carte** path: reaching individual modules directly through `_G.RGXFramework`, for addons that need to go beyond the declarative surface (see [RGX-Hello's](https://github.com/DonnieDice/RGX-Hello) `data/visualtest.lua` for a full worked example of this style).

This page walks you through integrating RGX-Framework into a consumer addon, from TOC setup to first font/color/module usage.

---

## Prerequisites

- World of Warcraft retail (Interface 120007+)
- RGX-Framework installed in `Interface/AddOns/RGX-Framework/`
- RGX-Framework is **load-on-demand: false** — it loads on startup if present

---

## 1. TOC Dependency

In your addon's `.toc` file, add RGX-Framework as a required dependency:

```toc
## Title: MyAddon
## Dependencies: RGX-Framework
```

This guarantees RGX-Framework loads **before** your addon. Alternatively, use `## OptionalDeps: RGX-Framework` and guard your code with availability checks.

---

## 2. Get the Framework Reference

At the top of any Lua file:

```lua
local RGX = _G.RGXFramework
if not RGX then return end
```

Or, if you want a hard error when the framework is missing:

```lua
local RGX = assert(_G.RGXFramework, "MyAddon requires RGX-Framework")
```

---

## 3. Wait for Readiness

RGX-Framework finishes initialization during `ADDON_LOADED`. Always wrap setup code in `OnReady`:

```lua
RGX:OnReady(function()
    -- All modules are safe to use here
    local Fonts = RGX:GetFonts()
    local Colors = RGX:GetColors()
    local Design = RGX:GetDesign()
end)
```

`OnReady` calls your function **immediately** if the framework is already initialized, or **queues** it otherwise. Either way, you never need to worry about timing.

---

## 4. Use a Font

```lua
local Fonts = RGX:GetFonts()

-- Apply a font to a FontString
Fonts:Apply(myFontString, "Inter-Bold", 14, "OUTLINE")

-- Quick-apply defaults
Fonts:Quick(myFontString)

-- Get a font path for SetFont calls
local path = Fonts:GetPath("Inter-Regular")
myFontString:SetFont(path, 12, "")
```

---

## 5. Use Colors

```lua
local Colors = RGX:GetColors()

-- Get a named color
local red = Colors:Get("red")
myTexture:SetColorTexture(red:GetRGB())

-- Class-colored text
local classColor = Colors:GetClass("WARLOCK")
myFontString:SetText("|c" .. classColor.colorStr .. "Warlock|r")

-- Wrap text with hex color
local wrapped = Colors:Wrap("Important!", "warning")
myFontString:SetText(wrapped)

-- Open the color picker
Colors:OpenPicker(r, g, b, function(newColor)
    print("Picked:", newColor:GetRGB())
end)
```

---

## 6. Create UI Controls

```lua
local UI = RGX:GetUI()
local Design = RGX:GetDesign()

-- Create a slider
local slider = UI:CreateSlider(parent, {
    label = "Font Size",
    min = 8,
    max = 24,
    step = 1,
    value = 12,
    onChange = function(val) print("Size:", val) end,
})

-- Create a toggle
local toggle = UI:CreateToggle(parent, {
    label = "Enable Feature",
    value = true,
    onChange = function(val) print("Enabled:", val) end,
})

-- Create a font dropdown
local fontDropdown = UI:CreateFontDropdown(parent, {
    label = "Font Family",
    onChange = function(fontName)
        print("Selected:", fontName)
    end,
})
```

---

## 7. Build an Options Panel

```lua
local panel = RGX:GetUI():CreateOptionsPanel("MyAddonOptions", {
    title = "My Addon",
    subtitle = "Configuration",
    width = 800,
    height = 600,
})

panel:AddTab("General", function(container)
    local UI = RGX:GetUI()
    UI:CreateToggle(container, { label = "Enable", value = true })
    UI:CreateSlider(container, { label = "Scale", min = 0.5, max = 2.0, step = 0.1, value = 1.0 })
end)

panel:AddTab("Fonts", function(container)
    local UI = RGX:GetUI()
    UI:CreateFontDropdown(container, { label = "Header Font" })
end)

-- Register with WoW's Interface Options
InterfaceOptions_AddCategory(panel.frame)
```

---

## 8. Register Events

```lua
-- Single event
RGX:RegisterEvent("PLAYER_ENTERING_WORLD", function(event, isLogin, isReload)
    if isLogin then
        print("First login!")
    end
end, "myAddon_enterWorld")

-- Unit event
RGX:RegisterUnitEvent("UNIT_AURA", function(event, unit)
    if unit == "player" then
        -- aura changed
    end
end, "player", "myAddon_auraTracker")

-- Unregister later
RGX:UnregisterEvent("UNIT_AURA", "myAddon_auraTracker")
```

---

## 9. Use Timers

```lua
-- One-shot timer (seconds)
RGX:After(3, function()
    print("3 seconds later")
end)

-- Repeating timer
local timer = RGX:Every(1, function()
    print("Every second")
end)

-- Cancel
RGX:CancelTimer(timer)
```

---

## 10. Combat-Safe Operations

```lua
-- These work in and out of combat
RGX:SafeShow(myFrame)
RGX:SafeHide(myFrame)
RGX:SafeSetPoint(myFrame, "CENTER", UIParent, "CENTER", 0, 0)
RGX:SafeSetSize(myFrame, 200, 100)
RGX:SafeSetText(myFontString, "Updated text")

-- Queue arbitrary code for after combat
RGX:QueueForCombat(function()
    myFrame:SetBackdrop(someBackdrop)
end)
```

---

## 11. Minimap Button

```lua
local Minimap = RGX:GetMinimap()

local button = Minimap:Create({
    texture = "Interface\\AddOns\\MyAddon\\icon",
    position = 225,
    storage = MyAddonDB,
    storageKey = "minimapAngle",
    tooltip = "MyAddon",
    onClick = function()
        MyAddon:Toggle()
    end,
})
```

---

## 12. Sound Effects

```lua
local Sound = RGX:GetSound()

-- Register a sound
local handle = Sound:Register("myAddon_ready", {
    path = "Interface\\AddOns\\MyAddon\\Sounds\\ready.ogg",
    name = "Ready Sound",
})

-- Play it
handle:Play()

-- Register with variant playback
local kill = Sound:Register("myAddon_kill", {
    path = "Interface\\AddOns\\MyAddon\\Sounds\\kill_%d.ogg",
    variants = 5,
    name = "Kill Sound",
})
kill:Play() -- picks a random variant 1-5
```

---

## 13. DataBroker Object

```lua
local DataBroker = RGX:GetDataBroker()

local myObj = DataBroker:NewDataObject("MyAddon", {
    type = "launcher",
    icon = "Interface\\AddOns\\MyAddon\\icon",
    label = "MyAddon",
    OnClick = function(_, button)
        if button == "LeftButton" then MyAddon:Toggle() end
    end,
    tooltipName = "MyAddon",
    tooltipText = "Click to toggle",
})
```

---

## Complete Example Addon

### MyAddon.toc

```toc
## Interface: 120005
## Title: MyAddon
## Author: Me
## Version: 1.0.0
## Dependencies: RGX-Framework
## SavedVariables: MyAddonDB

MyAddon.lua
```

### MyAddon.lua

```lua
local addonName, ns = ...
local RGX = assert(_G.RGXFramework, "MyAddon requires RGX-Framework")

ns.defaults = {
    profile = {
        enabled = true,
        fontSize = 12,
        fontFamily = "Inter-Regular",
        minimapAngle = 225,
    },
}

RGX:OnReady(function()
    local Fonts = RGX:GetFonts()
    local Colors = RGX:GetColors()
    local UI = RGX:GetUI()
    local Minimap = RGX:GetMinimap()
    local db = RGX:DB("MyAddonDB", ns.defaults)

    -- Create main frame
    local frame = CreateFrame("Frame", "MyAddonMainFrame", UIParent)
    frame:SetSize(300, 200)
    frame:SetPoint("CENTER")

    -- Apply design backdrop
    RGX:GetDesign():ApplyBackdrop(frame, "dark")

    -- Apply font
    local title = frame:CreateFontString(nil, "OVERLAY")
    Fonts:Apply(title, db.profile.fontFamily, db.profile.fontSize, "OUTLINE")
    title:SetPoint("TOP", 0, -10)
    title:SetText(Colors:Wrap("My Addon", "primary"))

    -- Minimap button
    Minimap:Create({
        texture = "Interface\\Icons\\INV_Misc_QuestionMark",
        position = db.profile.minimapAngle,
        storage = db.profile,
        storageKey = "minimapAngle",
        tooltip = "MyAddon",
        onClick = function()
            frame:SetShown(not frame:IsShown())
        end,
    })

    -- Event
    RGX:RegisterEvent("PLAYER_ENTERING_WORLD", function(_, isLogin)
        if isLogin then
            RGX:After(2, function()
                print(Colors:Wrap("MyAddon loaded!", "success"))
            end)
        end
    end, "MyAddon_PEW")
end)
```

---

## Common Patterns

### Always Check Module Availability

```lua
local Fonts = RGX:GetFonts()
if not Fonts then
    -- module not loaded (shouldn't happen for active modules)
    return
end
```

### Use Debug Mode During Development

```lua
/rgx debug
```

Toggle it off when done — debug mode prints extensive trace information.

### Hook with Fallback

```lua
RGX:Hook(SomeObject, "SomeMethod", function(orig, ...)
    -- pre-hook logic
    local result = orig(...)
    -- post-hook logic
    return result
end)
```

### Message Bus (Addon-Internal Events)

```lua
-- Create an emitter for your addon
local emitter = RGX:CreateEmitter("MyAddon")

-- Subscribe
emitter:RegisterCallback("OnConfigChanged", function(key, value)
    print("Config changed:", key, value)
end)

-- Fire
emitter:Fire("OnConfigChanged", "fontSize", 14)
```
