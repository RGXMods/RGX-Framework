# RGXWorldMap

World-map pin and waypoint primitives for RGX consumers. This module provides
HereBeDragons-Pins-compatible semantics so addons (guides, waypoint digests,
quest trackers) can place and manage pins on the world map and minimap without
embedding the full HereBeDragons suite.

Module key: `worldmap` (short key for `RGX:GetWorldMap()`)
Compat alias: `RGXWorldMap`
Registered global: `RGXWorldMap`
Category: `game`
Flavors: all supported clients (retail, classic-era, tbc, wrath, cata, mists); C_Map is
universal across every supported flavor so no compat gate is required.

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

## Coordinate adapter

All coordinate conversions go through `RGXWorldMap:GetCoordsAdapter()`. The
adapter wraps `C_Map` on Retail and falls back to `LibStub("HereBeDragons-2.0")`
on Classic-era clients when the C_Map call returns nothing. Consumers must not
embed HereBeDragons; the adapter is the only supported seam.

### GetCoordsAdapter

```lua
local adapter = worldMap:GetCoordsAdapter()
```

| Method | Signature | Returns |
|---|---|---|
| `GetPlayerWorldPosition` | `()` | `x, y, instance` or `nil` when unavailable |
| `GetPlayerZone` | `()` | `uiMapID` or `nil` |
| `GetZoneSize` | `(mapID)` | `width, height` in yards or `nil` |
| `GetWorldCoordinatesFromZone` | `(zoneX, zoneY, mapID, floor)` | world coords |
| `GetZoneCoordinatesFromWorld` | `(worldX, worldY, mapID)` | zone 0-100 coords |
| `GetWorldVector` | `(instance, x1, y1, x2, y2)` | `angle, distance` |
| `GetWorldDistance` | `(instance, x1, y1, x2, y2)` | distance |

## Implementation notes

- Pin frames are created with the `BackdropTemplate` mixin so they render
  above the map or minimap.
- `RemoveAllWorldMapIcons` / `RemoveAllMinimapIcons` clear the whole registry;
  any consumer pins dropped during frame-cleanup remain cleaned.
- This module is a **public API**: downstream addons must go through
  `RGX:GetWorldMap()` and not reach into `_pins` or the adapter internals.
