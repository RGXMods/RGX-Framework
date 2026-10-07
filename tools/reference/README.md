# WoW UI Source Reference

This tooling maintains an ignored local reference cache from
[Gethe/wow-ui-source](https://github.com/Gethe/wow-ui-source), a third-party Git
mirror of Blizzard's shipped UI source. It is a development reference, never an
RGX runtime or release dependency.

## Build The Reference

```powershell
node tools/reference/sync-wow-ui-source.mjs
node tools/reference/build-wow-api-graph.mjs
```

The sync is a shallow sparse checkout of generated API documentation, FrameXML,
and SharedXML for every configured flavor. The build adapts Blizzard's generated
Lua table format into Graphify-compatible per-flavor graphs plus a merged graph:

```text
.reference/wow-ui-graph/retail/graphify-out/graph.json  exact Retail graph
.reference/wow-ui-graph/<flavor>/graphify-out/graph.json
.reference/wow-ui-graph/graphify-out/graph.json         merged cross-flavor graph
```

## Search Exact Source

```powershell
node tools/reference/search-wow-api.mjs "SecretWhenAurasRestricted"
node tools/reference/search-wow-api.mjs "UNIT_AURA" --flavor=retail --api-only
node tools/reference/search-wow-api.mjs "canaccessvalue" --regex
```

Exact source is evidence. Results include flavor, client version, upstream ref,
commit, file, and line.

## Explore The Graph

```powershell
graphify query "How is UNIT_AURA handled?" --graph .reference/wow-ui-graph/retail/graphify-out/graph.json
graphify explain "C_UnitAuras.GetAuraDataByIndex" --graph .reference/wow-ui-graph/retail/graphify-out/graph.json
graphify path "UNIT_AURA" "C_UnitAuras.GetAuraDataByIndex" --graph .reference/wow-ui-graph/retail/graphify-out/graph.json
```

Use the merged graph only for cross-flavor discovery. Every graph is an index,
not evidence. Confirm conclusions in the underlying generated documentation or
UI source before changing runtime compatibility behavior.

## Find Runtime API Gaps

```powershell
node tools/reference/sync-wow-api-dump.mjs
node tools/reference/find-wow-api-gaps.mjs
node tools/reference/find-wow-api-gaps.mjs --kind=events --flavor=forever
node tools/reference/find-wow-api-gaps.mjs --json > gaps.json
```

Scans the RGX runtime source (`core/`, `modules/`) for client API references
and checks each against the synced API dump inventories for every flavor. Each
finding is grouped by severity:

- `[A]` absent from every dumped flavor (stale/renamed, or defensive probes)
- `[B]` absent on forever (primary test platform) but present elsewhere
- `[C]` absent on some flavors (flavor-gating candidates)

Each reference site carries a status:

- `g` gated — the owning module declares `flavors` excluding the absent flavor
- `u` guarded — a local capability probe/guard covers the reference
- `s` event dispatcher pcall — registration is isolated by `core/systems/events.lua`
- `!` open — needs confirmation

The site statuses are heuristics over surrounding source lines. A reference is
not a gap until confirmed against the dump records and verified in the
generated documentation or UI source. The tool is an analysis aid; it is not a
CI gate.
