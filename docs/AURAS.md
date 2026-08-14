# Auras — `RGXAuras`

Aura scanning and watching with a guaranteed player fast path and guarded
incremental update containers. Midnight secret aura values are opaque: boolean
tests, comparisons, indexing, iteration, formatting, or forwarding can taint
execution, and `pcall` does not prevent taint. Only
`C_UnitAuras.GetPlayerAuraBySpellID` and never-secret aura instance IDs are
treated as unconditional primitives here. Any-unit aura data remains
best-effort for unrestricted units and is not a general secrecy boundary.

```lua
local Auras = RGX:GetAuras()
```

## Queries

```lua
-- Player fast path (always taint-safe)
if Auras:HasPlayerAura(33264) then ... end
local data = Auras:GetPlayerAura(160599)

-- Unrestricted units only; do not use this as a secret-value boundary.
if Auras:HasAura(spellId, "target") then ... end
local data = Auras:GetAura(spellId, "target")

-- Enumerate: filter is "HELPFUL" | "HARMFUL" | nil (both).
-- Return false from the callback to stop early.
Auras:IterateAuras("target", "HARMFUL", function(aura) ... end)
```

Do not inspect fields from a potentially restricted `auraData` table. Use the
player spell-ID helpers when possible. Any-unit queries may return `nil` after
an access error, but a caught error does not undo taint from an unsafe read.

## Watching (incremental UNIT_AURA cache)

```lua
Auras:WatchUnit("target")            -- idempotent; player is watched by default
Auras:UnwatchUnit("target")

-- Change callbacks fire only for watched units.
-- Each registration returns an unsubscribe closure.
-- auraData fields may still be restricted and must remain opaque.
local stop = Auras:OnApplied(function(unit, aura) ... end)
Auras:OnRemoved(function(unit, auraInstanceID) ... end)
Auras:OnUpdated(function(unit, aura) ... end)
stop()  -- unsubscribe

-- Cached lookup for watched units (live scan fallback otherwise)
local aura = Auras:GetAuraByInstanceID("player", instanceID)
```

## API

| Method | Returns |
|---|---|
| `Auras:GetPlayerAura(spellId)` / `HasPlayerAura(spellId)` | auraData \| nil / boolean |
| `Auras:GetAura(spellId, unit)` / `HasAura(spellId, unit)` | auraData \| nil / boolean |
| `Auras:IterateAuras(unit, filter, callback)` | visited count |
| `Auras:WatchUnit(unit)` / `UnwatchUnit(unit)` | boolean |
| `Auras:OnApplied(fn)` / `OnRemoved(fn)` / `OnUpdated(fn)` | unsubscribe closure |
| `Auras:GetAuraByInstanceID(unit, id)` | auraData \| nil |

Source: [`modules/auras/auras.lua`](https://github.com/DonnieDice/RGX-Framework/blob/main/modules/auras/auras.lua). Test it in-game via [[RGX-Hello|Testing]]'s Auras tab.
