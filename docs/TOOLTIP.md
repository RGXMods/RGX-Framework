# Tooltip — `RGXTooltip`

Tooltip composition and native-tooltip augmentation. Replaces the `SetOwner → ClearLines → AddLine × N → Show` boilerplate (71 call sites in BattlePetUtility alone) with one call, and wraps Blizzard's `TooltipDataProcessor` so one addon's erroring hook can no longer break tooltip rendering for every other addon — Blizzard does **not** pcall-wrap that dispatch; RGX does.

```lua
local Tip = RGX:GetTooltip()
```

## Composed tooltips

```lua
-- Show a fully composed tooltip anchored to a frame
Tip:Show(frame, {
    anchor = "ANCHOR_RIGHT",         -- default
    title  = "Pet Charms",           -- optional first line, white
    lines  = {
        "Plain string line (wraps).",
        { "Total", tostring(amount) },                 -- double line: left, right
        { text = "Missing", r = 1, g = 0.2, b = 0.2 }, -- colored single line
        { text = detail, wrap = true },
    },
})
Tip:Hide()
```

## One-call hover wiring

```lua
-- Wires OnEnter/OnLeave in one call; builder runs at hover time so
-- content can be computed live. Return nil to skip showing.
Tip:Attach(frame, function(self)
    return { title = "Live", lines = { "Computed at hover time" } }
end)
```

## Native tooltip augmentation

```lua
-- Human vocabulary, never Enum.TooltipDataType values.
-- Valid types: item, spell, unit, aura, pet, mount, macro
Tip:HookNative("item", function(tooltip, data)
    tooltip:AddLine("Extra RGX line", 1, 1, 1)
end)
```

One real Blizzard registration per type, ever — all RGX consumers for that type share a single pcall-guarded entry point. Registrations are session-persistent by design (Blizzard offers no unregister).

## API

| Method | Returns | Notes |
|---|---|---|
| `Tip:Show(anchorFrame, opts)` | boolean | `opts.anchor`, `opts.offsetX/Y`, `opts.title`, `opts.lines` |
| `Tip:Hide()` | — | |
| `Tip:Attach(frame, builder)` | boolean | `builder(frame)` → opts table or nil |
| `Tip:HookNative(typeName, callback)` | boolean | `callback(tooltip, data)`; false on unknown type |

Source: [`modules/tooltip/tooltip.lua`](https://github.com/RGXMods/RGX-Framework/blob/main/modules/tooltip/tooltip.lua). Test it in-game via [[RGX-Hello|Testing]]'s Tooltip tab.
