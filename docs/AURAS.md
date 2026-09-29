# Auras - `RGXAuras`

`RGXAuras` is the framework's accessible-only aura boundary. It checks
Blizzard's aura-specific and generic access predicates before querying,
indexing, iterating, comparing, caching, formatting, or forwarding aura data.
Restricted or unverifiable values fail closed and never reach consumer
callbacks. `pcall` still isolates ordinary API/callback errors; it does not
prevent taint and is not used as authorization.

Implemented in `v2.7.0` (current). Previous release `v2.6.2` had best-effort arbitrary-unit behavior.

```lua
local Auras = RGX:GetAuras()
```

## Queries

```lua
-- RequiresNonSecretAura player lookup. A restricted match returns no result.
if Auras:HasPlayerAura(33264) then ... end
local data = Auras:GetPlayerAura(160599)

-- Any-unit lookup returns only predicate-approved AuraData.
if Auras:HasAura(spellId, "target") then ... end
local data = Auras:GetAura(spellId, "target")

-- Return false to stop early. A restricted entry stops before the callback.
local delivered = Auras:IterateAuras("target", "HARMFUL", function(aura)
    print(aura.name, aura.spellId)
end)
```

`Get*` returns `nil`, `Has*` returns `false`, and `IterateAuras` returns the
number of accessible snapshots delivered before the first denied or
unverifiable entry. A zero count can mean no aura or a fail-closed restriction;
the API intentionally does not reveal which.

## Watching

```lua
Auras:WatchUnit("target")            -- idempotent; player is watched by default
Auras:UnwatchUnit("target")

local stop = Auras:OnApplied(function(unit, aura) ... end)
Auras:OnRemoved(function(unit, auraInstanceID) ... end)
Auras:OnUpdated(function(unit, aura) ... end)
stop()

local aura = Auras:GetAuraByInstanceID("player", instanceID)
```

The watcher validates a complete incremental delta, commits the whole cache
transaction, and only then dispatches callbacks. Callback batches are
non-reentrant: if a callback causes a newer accessible or restricted event, the
cache generation advances and stale callbacks from the older batch stop. If the
event, a child container, an instance ID, or AuraData is denied, the watched
cache is emptied and marked invalid. No callback fires and no synthetic removal
is emitted. The next accessible event rebuilds a snapshot silently; transitions
missed while restricted are not replayed.

Callback `unit`, `auraData`, and instance-ID arguments are predicate-approved
and may be used normally. Callback failures remain isolated from one another.

## Raw Events

`RGX:RegisterEvent("UNIT_AURA", ...)` transports Blizzard's raw UNIT_AURA
payload, which remains unsanitized by design. Do not inspect or forward it from
normal consumer code.
Use `RGXAuras` queries/watchers. `RGX:RegisterUnitEvent` checks access before its
unit-token comparison, but it does not sanitize the remaining event payload.

Current Retail, Classic Era, TBC, Wrath/Titan, and Mists clients expose the
required access/secrecy predicates. The supported Cataclysm 4.4.2 contract has
no secret-value system and preserves unrestricted behavior. An unknown or
partially supported secret-capable environment fails closed.

## Verified Client Sources

| Flavor | Client | Upstream ref | Commit |
|---|---|---|---|
| Retail | `12.1.0.69283` | `live` | `710f59e457317676c0f699e6addaf2c405c2a1a4` |
| Classic Era | `1.15.9.69109` | `classic_era` | `7285babcfa6931f7c4265ce8672fa6d99c7bcaf1` |
| TBC | `2.5.6.69110` | `classic_anniversary` | `e9bbe81652a6a3fddc6fb547c379218341899792` |
| Wrath/Titan | `3.80.2.69137` | `classic_titan` | `825d29d3662b372f0bead725ee6abd339e4a77b5` |
| Mists | `5.5.4.69155` | `classic` | `ee771c39c640884d58d599f6c824f63d055b3ad7` |
| Cataclysm baseline | `4.4.2.60895` | tag `4.4.2` | `a1ca983a43a7aa73b5764d3245925ba40869fce3` |

Evidence comes from each mirror's generated `FrameScriptDocumentation.lua`,
`SecretPredicateAPIDocumentation.lua`, `UnitAuraDocumentation.lua`, and
`UnitConstantsDocumentation.lua`, confirmed against Blizzard SharedXML call
ordering. The mirrors are references, never runtime or release dependencies.

## Required Retail Check

Automation cannot emulate engine secret values or prove absence of taint. Validate on Retail `12.1.0.69283` and record the commit and ZIP SHA-256:

1. Install matching RGX-Framework and RGX-Hello.
2. Run `/console scriptErrors 1`, `/console taintLog 2`, then `/reload`.
3. Open `/rgxvisual`, select Auras, scan player/target once, and start the live
   log outside restrictions. It must report that both player and target watches
   registered; a failed watch invalidates the test.
4. Apply, refresh, and remove accessible player or target effects until the
   applied/updated/removed counters are all nonzero, including at least one chat
   callback whose unit is `target`. Record an initial snapshot.
5. Enter dungeon, raid, or PvP combat and repeat the target scan until its status
   reads `Aura restriction: ACTIVE`.
6. Immediately before a visible target aura change, click **Snapshot Aura
   Counters** and record the numeric applied/updated/removed values. Observe the
   icon change in Blizzard's UI, then click the snapshot button again. All three
   values must be identical; no raw aura data, Lua error, or blocked-action
   warning may appear.
7. Leave the restricted state and repeat the target scan. Cause one accessible
   aura change and take a snapshot. If the counters remain unchanged, that event
   performed the intentional silent cache rebuild; cause a second controlled
   change. By the second snapshot, at least one value must advance, proving
   callback recovery. An earlier increment means an intervening event already
   rebuilt the cache and also proves recovery.
8. Stop the live log, record its final totals, then cause another accessible aura
   change and take one final snapshot. The counters and chat log must remain
   unchanged, proving unsubscribe.
9. Exit the client and inspect `_retail_/Logs/taint.log` for RGX-Framework or
   RGX-Hello entries. Attach the result to GitLab #36.

## API

| Method | Returns |
|---|---|
| `Auras:GetPlayerAura(spellId)` / `HasPlayerAura(spellId)` | accessible AuraData \| nil / boolean |
| `Auras:GetAura(spellId, unit)` / `HasAura(spellId, unit)` | accessible AuraData \| nil / boolean |
| `Auras:IterateAuras(unit, filter, callback)` | delivered accessible count |
| `Auras:WatchUnit(unit)` / `UnwatchUnit(unit)` | boolean |
| `Auras:OnApplied(fn)` / `OnRemoved(fn)` / `OnUpdated(fn)` | unsubscribe closure |
| `Auras:GetAuraByInstanceID(unit, id)` | accessible AuraData \| nil |

Source: [`modules/auras/auras.lua`](https://github.com/RGXMods/RGX-Framework/blob/main/modules/auras/auras.lua). Test it in-game via [[RGX-Hello|Testing]]'s Auras tab.
