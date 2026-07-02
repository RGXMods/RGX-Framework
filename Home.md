# RGX-Framework

## Directive

**Make addon building fast, easy, and fun.** Everything in RGX-Framework exists to serve this goal:

- An addon author should be able to spin up a complete addon with options, minimap icon, slash commands, themed UI, nested dropdowns, sound playback, profiles, and event handling **in minutes** â€” not days.
- Every API should work with **one or two lines of code** for the common case.
- Complexity lives inside the framework. The consumer surface stays simple.
- New features are extracted from real addon usage (BLU, ETL, SQP, RND), not designed in isolation.
- As of v2.1.0 every in-tree module ships active — no dormant code.

When adding or changing anything in RGX-Framework, ask: _does this make addon building easier for the next author?_

## What It Is

One `RequiredDeps` entry, everything included. No embedding, no version conflicts, no library chains. A modern alternative to Ace3.

## Quick Start

```toc
## RequiredDeps: RGX-Framework
```

```lua
local RGX = assert(_G.RGXFramework, "RGX-Framework is required")

-- A complete addon in one declarative call: saved settings with profiles,
-- a tabbed options panel with db-bound controls, slash command, minimap
-- button, branded output — all routed through taint-safe framework paths.
local addon = RGX.Addon("MyAddon", {
    slash   = "myaddon",
    minimap = "Interface\\Icons\\inv_misc_questionmark",
    db      = { enabled = true, volume = 80 },
    options = {
        General = {
            { toggle = "enabled", label = "Enable Addon" },
            { slider = "volume",  label = "Volume", min = 0, max = 100 },
            { dropdown = "sound", label = "Choose Sound", items = { "Fanfare", "Chime" } },
        },
    },
    welcome = "loaded — /myaddon for options",
    onInit  = function(self)
        self:RegisterEvent("PLAYER_LOGIN", function() self:Print("Hello!") end)
    end,
})
```

À la carte — the same systems individually:

```lua
addonTable.db = RGX:NewDatabase("MyAddonDB", { enabled = true, volume = 1.0 })
RGX:RegisterEvent("PLAYER_LOGIN", function() print("Hello!") end)
RGX:CreateMinimapButton({ name = "MyAddon", icon = "Interface\\Icons\\inv_misc_questionmark" })
RGX:RegisterSlashCommand("myaddon", function(msg) print("/myaddon:", msg) end)

local dd = RGX:GetDropdowns():CreateNestedDropdown(parent, {
    label = "Choose Sound",
    items = {
        { text = "Fanfare", value = "fanfare" },
        { text = "Chime",   value = "chime"   },
    },
    onChange = function(value) print("selected:", value) end,
})

local panel = RGX:Options({
    addonName = "MyAddon",
    title = "MyAddon",
    tabs = {
        { text = "General", content = function(frame)
            RGX:Toggle(frame, { key = "enabled", label = "Enabled", storage = addonTable.db })
        end },
    },
})
```

## Reference Addons

| Addon | What It Proves |
|---|---|
| BLU | Full sound/progression suite â€” profiles, shared media, combat, 15+ event triggers |
| ETL | Traveler's Log handling, minimap, slash commands |
| SQP | Large options panels, UI controls, fonts, nameplate events |
| RND | Small utility addon pattern â€” events, timers, minimap, settings |

Lessons from these addons feed back into RGX-Framework when a pattern is reusable.

## Docs

- [[Architecture]] - Load order, module system, lifecycle, conventions
- [[API Reference]] - Complete public API by module
- [[Fonts]] - Registry, blocked fonts, apply helpers, dropdowns, style objects
- [[Dropdowns]] - CreateNestedDropdown, item schema, auto-width, inline buttons
- [[Theming & Design]] - Design palette, color usage, font styling, templates
- [[Troubleshooting]] - Common issues and fixes
- [[Migration Guide]] - From Ace3, LibSharedMedia, standalone implementations
