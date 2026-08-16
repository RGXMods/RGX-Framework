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
