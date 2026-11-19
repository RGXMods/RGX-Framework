# RGXWorldMap

World-map pin and waypoint primitives for RGX consumers. This module is
implemented entirely over the native WoW C_Map API; the framework writes
its own libraries and no external coordinate library is referenced or
embedded. Argument shapes follow the legacy pin call sites addons already
ship so ports stay 1:1.

Module key: `worldmap` (short key for `RGX:GetWorldMap()`)
Compat alias: `RGXWorldMap`
Registered global: `RGXWorldMap`
Category: `game`
Flavors: all supported clients (retail, classic-era, tbc, wrath, cata, mists).
Every coordinate call is capability-gated: a flavor that lacks an API (e.g.
`C_Map.GetMapWorldSize` on classic-era/tbc/mists) yields documented nils,
never errors.

## Initialization

```lua
local worldMap = RGX:GetWorldMap()
worldMap:Init()
```

`Init()` is idempotent; calling it again clears all existing pins.

## Pin lifecycle

### World map

```lua
local frame = worldMap:AddWorldMapIcon(nil, "Interface\\Minimap\\Vehicle-AllianceGVG", 0, 0.5, 0.5, "my-pin")
```

| Method | Signature | Returns |
|---|---|---|
| `AddWorldMapIcon` | `(pinFrame, icon, mapID, x, y, name)` | the pin frame or `nil` |
| `RemoveWorldMapIcon` | `(name)` | `true` when removed |
| `UpdateWorldMapIcon` | `(name, x, y)` | `true` when updated |
| `RemoveAllWorldMapIcons` | `()` | always `true` |

- `pinFrame` may be `nil` to allocate an internal frame. Supply an existing
  frame when the consumer owns the visual.
- `mapID` is a `uiMapID`; use `0` or `nil` to target the player's current
  zone via the `GetPlayerZone` adapter.
- `name` is optional and auto-generated when omitted.

### Minimap

```lua
worldMap:AddMinimapIcon(nil, "Interface\\Minimap\\POI-Neutral", 0, 0.5, 0.5, "my-mini")
```

| Method | Signature | Returns |
|---|---|---|
| `AddMinimapIcon` | `(pinFrame, icon, mapID, x, y, name)` | the pin frame or `nil` |
| `RemoveMinimapIcon` | `(name)` | `true` when removed |
| `UpdateMinimapIcon` | `(name, x, y)` | `true` when updated |
| `RemoveAllMinimapIcons` | `()` | always `true` |

- Coordinates `0-1` are interpreted as map-space and scaled onto the minimap
  radius. Coordinates outside `0-1` are treated as raw pixel offsets from
  minimap center.

## User waypoints

```lua
local wasSet = worldMap:SetWaypoint(mapID, 52.6, 55.5)
-- Preserve the current tracking selection:
local wasSetWithoutTracking = worldMap:SetWaypoint(mapID, 52.6, 55.5, { track = false })
```

- `mapID` must be an accessible, finite positive integer. Zone coordinates
  `x` and `y` must be accessible finite numbers in the inclusive range `0-100`.
  Values are not coerced or clamped. Invalid inputs return `false` before
  client queries, vector creation or pin changes.
- `CanSetWaypoint(mapID)` requires the setter, vector constructor and
  map-permission query. Only an accessible, explicit `true` result from the
  permission query permits setting a pin. A missing query, denied/unknown result
  or query/access-check error returns `false`; function presence alone does
  not establish permission.
- `SetWaypoint` returns `true` only when the native setter returns an
  accessible, explicit `true`. Setter rejection, unknown results or errors
  return `false` and never start tracking. The caller decides what to tell
  the player.
- After a successful set, tracking is best-effort when available. Pass
  `{ track = false }` to leave tracking alone. Failure to track does not
  change the successful pin result.
- `ClearWaypoint()` asks the client to remove its user waypoint, returning
  `false` if the clear API is absent or raises an error.

These methods are capability-gated; they do not synthesize waypoints for clients
without the native APIs. Headless tests do not certify rendered pins or taint
safety.

## Coordinate adapter

All coordinate conversions go through `RGXWorldMap:GetCoordsAdapter()`. The
adapter wraps the native `C_Map` API only - no external coordinate library
is referenced or embedded - and it is the one supported seam: consumers never
call `C_Map` directly. Every call is capability-gated per flavor.

### GetCoordsAdapter

```lua
local adapter = worldMap:GetCoordsAdapter()
```

| Method | Signature | Returns |
|---|---|---|
| `GetPlayerWorldPosition` | `()` | `worldX, worldY` (continent yards), `continentID`; nils when unresolvable |
| `GetPlayerZone` | `()` | `uiMapID` or `nil` |
| `GetZoneSize` | `(mapID)` | `width, height` in yards (retail/forever); nils where `C_Map.GetMapWorldSize` is absent |
| `GetWorldCoordinatesFromZone` | `(zoneX, zoneY, mapID, floor)` | `worldX, worldY, continentID`; `floor` is accepted for call-shape compatibility only |
| `GetZoneCoordinatesFromWorld` | `(worldX, worldY, continentID)` | `zoneX, zoneY` (0-100), `uiMapID` |
| `GetWorldVector` | `(instance, x1, y1, x2, y2)` | `angle, distance` (`instance` unused) |
| `GetWorldDistance` | `(instance, x1, y1, x2, y2)` | distance (`instance` unused) |

## Implementation notes

- Every `C_Map` signature is verified against the client API dumps and
  Blizzard's generated API documentation; a capability absent on a flavor
  yields nils, never errors.
- Pin frames are created with the `BackdropTemplate` mixin so they render
  above the map or minimap.
- `RemoveAllWorldMapIcons` / `RemoveAllMinimapIcons` clear the whole registry;
  any consumer pins dropped during frame-cleanup remain cleaned.
- This module is a **public API**: downstream addons must go through
  `RGX:GetWorldMap()` and not reach into `_pins` or the adapter internals.
