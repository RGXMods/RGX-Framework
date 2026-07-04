# Auras — `RGXAuras`

Taint-safe aura scanning and watching. Built for Midnight's **secret auras**: on restricted units, aura fields are secret values and comparing them taints execution — and `pcall` does **not** prevent taint. RGXAuras leans exclusively on the taint-safe primitives (`C_UnitAuras.GetPlayerAuraBySpellID` is `AllowedWhenTainted`; `UNIT_AURA` instance IDs are `NeverSecretContents`), so consumers can never write the tainting comparison themselves.

```lua
local Auras = RGX:GetAuras()
```

## Queries

```lua
-- Player fast path (always taint-safe)
if Auras:HasPlayerAura(33264) then ... end
local data = Auras:GetPlayerAura(160599)

-- Any unit (PvE-safe; returns nil/false on secret-restricted units by design)
if Auras:HasAura(spellId, "target") then ... end
local data = Auras:GetAura(spellId, "target")

-- Enumerate: filter is "HELPFUL" | "HARMFUL" | nil (both).
-- Return false from the callback to stop early.
Auras:IterateAuras("target", "HARMFUL", function(aura) ... end)
```

## Watching (incremental UNIT_AURA cache)

```lua
Auras:WatchUnit("target")            -- idempotent; player is watched by default
Auras:UnwatchUnit("target")

-- Change callbacks fire only for watched units.
-- Each registration returns an unsubscribe closure.
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

Source: [`modules/auras/auras.lua`](https://github.com/DonnieDice/RGX-Framework/blob/main/modules/auras/auras.lua). Test it in-game via [[Testing|RGX-Hello]]'s Auras tab.
