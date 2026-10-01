# RGX-Framework

WoW addon framework. Runtime is Lua 5.1-era WoW Lua. Developer tooling is Node.js.

The repo contains cooperating subprojects:

* `core/`, `modules/` — WoW runtime
* `schemas/rgx-addon.schema.json` — declarative contract
* `tools/rgx-mcp/` — Node MCP server
* `tools/ci/` — CI helpers, deterministic package builder and checker
* `tools/release/` — release publisher (GitHub/CurseForge/Wago)
* `tools/wiki/` — docs → GitHub Wiki generator

`RGX-Framework.xml` is the source of truth for runtime load order.
`RGX-Framework.toc` is the source of truth for version, Interface, and SavedVariables.

## Commands

Lua + schema validation:

```bash
cd tools/ci
npm ci
npm run lua-check
npm run schema-check
```

Wiki manifest:

```bash
node tools/wiki/build-wiki.mjs /tmp/rgx-wiki-out
```

MCP setup:

```bash
cd tools/rgx-mcp
npm ci --no-audit --no-fund
npm start
```

MCP/RGX-Hello end-to-end:

```bash
cd tools/rgx-mcp
node test/test-rgx-hello.mjs /path/to/RGX-Hello
```

Run the MCP E2E after changing the schema, declarative runtime, generator, validator, audit rules, or declarative API contract.

Never claim tests or in-game validation passed unless actually run.

## Runtime Architecture

One shared framework instance:

```lua
local addonName, RGX = ...
_G.RGXFramework = RGX
```

Consumers use:

```toc
## RequiredDeps: RGX-Framework
```

Never add LibStub, embed RGX into consumers, or add Ace3 as a framework runtime dependency.

A file under `modules/` is not active unless loaded by `RGX-Framework.xml`.

Modules register through RGX:

```lua
local Example = {}

function Example:GetValue()
    return self.value
end

RGX:RegisterModule("example", Example, {
    global = "RGXExample",
})
```

Use the module registry/getters instead of relying directly on global aliases.

## Design Thesis

Make the bug unrepresentable. Most WoW addon maintenance is reactive: hunting
deprecated APIs and taint in code that already shipped them. RGX-Framework is
built so consumer addons cannot introduce those bug classes in the first place:
no manual event frames, no raw `C_Timer`, no raw `SLASH_X`, all dispatch
pcall-wrapped and failure-isolated, and frame registration deferred through
combat lockdown. When designing a new subsystem, the test is not "is this
convenient" but "does this make a whole class of WoW-specific bug impossible
for the consumer to write." Do not describe `pcall` or arbitrary
restricted-value handling as taint safety.

Progressive disclosure, one vocabulary: every declarative key works bare with
assumed arguments and accepts an advanced form when needed — simple addons stay
one-liner simple, advanced addons remain possible, and the surface never grows
a second API. Options layout is one composable vocabulary: panel → main page +
tabs → tabs can be multi-paged → 1–2 column card grids → rows/cards holding the
widgets; tabs/pages/rows/columns/cards are all the same kind of thing, never
separate systems. If a caller needs an argument the bare form should have
assumed, that is a framework bug.

Positioning: RGX fills Ace3's place by being easier to consume, not by
matching it library-for-library. The audit and the "does this belong" standard
live in `docs/ACE3-ANALYSIS.md`; the DSL, the schema+MCP loop, and the RGX-Hello
test suite are the differentiators.

## rgx-mod Context (North Star)

RGX-Framework serves two roles:

1. Shared runtime for the entire RGX Mods addon suite — BLU,
   SimpleQuestPlates, BattlePetUtility, EnhancedTravelersLog,
   RemoveNameplateDebuffs, and the LevelUp sound-pack addons all declare
   `RequiredDeps: RGX-Framework`. One load, one instance, shared by all.
2. Foundation layer for `rgx-mod`, a WeakAuras replacement built on top of
   this framework. Every subsystem that benefits current addons is also a
   building block for rgx-mod's trigger/condition/display engine.

Build priority rule: build a subsystem when it benefits a current maintained
addon AND rgx-mod. If it only benefits rgx-mod with no current addon use,
defer it.

## Consumer API

Preferred consumer entry point:

```lua
local addon = RGXAddon("MyAddon", {
    db = { enabled = true },
    slash = "myaddon",
})
```

`local RGX = assert(_G.RGXFramework, ...)` is the advanced/à-la-carte escape hatch, not the normal front door.

Declarative API rule: **bare forms assume; advanced forms unlock.**

```lua
-- Simple
minimap = true

-- Advanced
minimap = {
    icon = "...",
    tooltip = "...",
    onRightClick = function() ... end,
}
```

Do not create separate simple and advanced APIs for the same concept. Extend existing forms additively.

## Framework-First Rules

Use RGX infrastructure instead of rebuilding WoW plumbing.

```lua
-- CORRECT
addon:RegisterEvent("PLAYER_LOGIN", handler)
addon:RegisterUnitEvent("UNIT_AURA", "player", handler)
addon:After(1, callback)
RGX:RegisterSlashCommand("foo", handler)
RGX:SafeShow(frame)

-- WRONG for normal consumer/module code
local f = CreateFrame("Frame")
f:SetScript("OnEvent", handler)
C_Timer.After(1, callback)
SLASH_FOO1 = "/foo"
```

Use RGX events, timers, messages, hooks, combat queue, DB, UI, media, minimap, aura, tooltip, and other existing modules before creating another implementation.

All shared callback dispatch must remain failure-isolated. One consumer callback must not break unrelated consumers.

## WoW Safety

Do not guess Blizzard APIs. Verify APIs against the Interface version in `RGX-Framework.toc`.

Respect:

* combat lockdown
* protected frames/attributes
* taint
* secret/restricted values
* addon load order
* SavedVariables lifecycle

Do not fix taint by suppressing errors. Fix the unsafe path.

Prefer secure hooks/framework wrappers over replacing Blizzard functions.

## WoW API Reference

**Main reference: the WoW API dump.** [Ketho/BlizzardInterfaceResources](https://github.com/Ketho/BlizzardInterfaceResources) contains client-state dumps (via the KethoDoc addon) of global API functions, widget/handler tables, templates, mixins, events, enums, frames, and CVars for each client branch. Client-specific capability design in this framework is built around that dump: it is the first answer to "does symbol X exist on client Y."

- Upstream is generated from the running client, not official Blizzard documentation, and its license is unverified — treat it as an internal reference, never packaged or redistributed.
- **Confirmation layer:** answer runtime-driving conclusions for confirmed signatures, payload semantics, and behavior from the wow-ui-source mirrors below. Reviewers must be able to trace each decision: dump inventory line → generated documentation/FrameXML confirmation.
- Record dump branch/commit/build from `.reference/wow-api-dump/manifest.json` (or README build info) with any claim.

Dump routes (synced into `.reference/wow-api-dump/<flavor>/`, not runtime or release dependencies):

| RGX flavor | Local path | Dump branch |
|---|---|---|
| Retail | `.reference/wow-api-dump/retail/` | `live` |
| Classic Era | `.reference/wow-api-dump/classic-era/` | `classic_era` |
| Burning Crusade Classic | `.reference/wow-api-dump/tbc/` | `classic_anniversary` |
| Mists Classic | `.reference/wow-api-dump/mists/` | `classic` |
| WoW Forever beta | `.reference/wow-api-dump/forever/` | `forever` |
| Wrath/Titan | — no dump branch upstream; wow-ui-source mirror only | — |
| Cataclysm historical baseline | — no dump ref; wow-ui-source tag only | — |

```powershell
node tools/reference/sync-wow-api-dump.mjs                    # all flavors
node tools/reference/sync-wow-api-dump.mjs --flavor forever
node tools/reference/search-wow-api-dump.mjs "C_Secrets." --flavor=retail
node tools/reference/search-wow-api-dump.mjs "EDIT_MODE_LAYOUTS_UPDATED" --flavor=forever
```

Confirmation layer: use [Gethe/wow-ui-source](https://github.com/Gethe/wow-ui-source), a third-party Git mirror of Blizzard's shipped UI source, for Blizzard-generated API documentation, FrameXML, and SharedXML. Local sparse mirrors live under `.reference/wow-ui-source/` and are intentionally not runtime or release dependencies. Flavor routes are:

| RGX flavor | Local path | Upstream ref |
|---|---|---|
| Retail | `.reference/wow-ui-source/retail/` | `live` |
| Classic Era | `.reference/wow-ui-source/classic-era/` | `classic_era` |
| Burning Crusade Classic | `.reference/wow-ui-source/tbc/` | `classic_anniversary` |
| Wrath/Titan | `.reference/wow-ui-source/wrath/` | `classic_titan` |
| Mists Classic | `.reference/wow-ui-source/mists/` | `classic` |
| Cataclysm historical baseline | `.reference/wow-ui-source/cata-4.4.2/` | tag `4.4.2` |

Branches move as clients update. Before citing or changing compatibility behavior, record the mirror's `version.txt`, upstream ref, and commit. Do not infer a client version from a branch name alone.

Reference routes inside each mirror:

```text
Interface/AddOns/Blizzard_APIDocumentationGenerated/  generated API signatures, events, payloads, enums
Interface/AddOns/Blizzard_FrameXML/                   Blizzard UI behavior and API call sites
Interface/AddOns/Blizzard_SharedXML/                  shared utilities, mixins, templates, project constants
```

Search both layers; use the Graphify graph at `.reference/wow-ui-graph/graphify-out/graph.json` for discovery, relationships, and call-path questions:

```powershell
node tools/reference/sync-wow-ui-source.mjs
node tools/reference/search-wow-api.mjs "UNIT_AURA" --flavor=retail --api-only
node tools/reference/build-wow-api-graph.mjs
graphify query "How is UNIT_AURA handled?" --graph .reference/wow-ui-graph/graphify-out/graph.json
```

Graphify is an index, not evidence. Confirm every conclusion in the underlying dump record, generated documentation, or UI source and cite the flavor, client version, ref/commit, file, and line when the conclusion drives runtime behavior.

For forward compatibility work:

* Check every supported active flavor, not only Retail.
* Prefer generated API documentation for signatures and event payloads; use FrameXML/SharedXML to verify actual Blizzard usage and secure execution patterns.
* Treat missing APIs, payload fields, templates, and enum values as flavor capabilities, not assumptions to paper over with empty globals.
* Treat secret/restricted values as opaque. Check secrecy with Blizzard's supported predicates before boolean tests, comparison, indexing, iteration, formatting, or forwarding to consumer code.
* A caught Lua error does not undo taint. Fix unsafe reads at the framework boundary rather than relying on `pcall` or suppressing the report.
* Re-sync the dump and mirrors and rebuild the local graph before compatibility audits when `RGX-Framework.toc` changes Interface version or upstream client branches advance.
* MCP tooling offers `rgx_search_wow_api` reading the synced local dumps (`rgx://frames/wow-api-dump`); it is deterministic substring evidence with flavor/build/commit provenance, never live-game state and never a reason to skip the confirmation layer.

## Declarative Contract

These must remain synchronized:

```text
RGXAddon / RGX.Addon runtime
        ↕
schemas/rgx-addon.schema.json
        ↕
docs/DECLARATIVE-API.md
        ↕
tools/rgx-mcp
        ↕
RGX-Hello E2E
```

If a declarative key changes, check every layer.

A schema accepting behavior runtime ignores is a bug.
Runtime supporting behavior the schema rejects is contract drift.
A generator emitting different semantics is a bug.

Existing declarative keys must not silently change meaning.

## MCP Boundary

`tools/rgx-mcp/` is an in-repo Node package, not part of the Lua runtime dependency graph.

Hard dependency direction:

```text
rgx-mcp          → RGX docs/schema/contract
consumer addons  → RGX runtime
RGX runtime      → never tools/rgx-mcp
```

The MCP is read-only by design: validate, audit, generate, and expose contract information.

Never make runtime Lua import, invoke, or require Node/MCP tooling.

Do not maintain a second MCP-specific copy of the declarative contract.

## Database

Do not casually change `NewDatabase` proxy/profile behavior.

Preserve:

* explicit `false` vs `nil`
* nested defaults
* profiles
* global data
* migrations
* profile switching
* SavedVariables persistence

Run the database regression harness/in-game checks when database internals change.

## UI

Use existing RGX controls/design/media systems before creating custom equivalents.

DB-bound controls must both save and visually restore persisted state.

A control that saves correctly but reopens with the wrong displayed value is broken.

## Documentation

`docs/` is canonical. The GitHub Wiki is generated from it.

Edit:

```text
docs/
```

Never manually maintain the wiki as a competing source.

Update docs in the same change when public behavior changes.

## Boundaries

Never:

* commit secrets or credentials
* add runtime dependencies on `tools/`, Node, MCP, or CI
* add LibStub/Ace3 embedding
* add raw `C_Timer` for normal framework work
* add raw `SLASH_X` registrations outside the centralized system
* create duplicate event/timer/database systems
* guess Blizzard APIs
* change public API semantics casually
* change `.pkgmeta`, release workflow, version, or release metadata unless the task requires it
* perform unrelated refactors or repository-wide formatting during a targeted task
* edit generated wiki output directly
* add modules that no current addon uses
* enable dormant modules without verifying `Init()`/`TryInit` wiring in `initialization.lua`

## Git

Do not commit directly to `main`.

Work on `dev` or a task branch and merge through a GitLab merge request.

Keep commits scoped to the requested change. Do not mix unrelated cleanup into feature/fix commits.

Before finishing, inspect the diff and run the applicable validation commands above.

## Repository Workflow

- The GitLab project under `rgxmods/warcraft` is authoritative. Normal work belongs on task branches and must merge through GitLab merge requests, never directly to the default branch.
- Shared CI is included from `rgxmods/warcraft/RGX-Framework` at `/.gitlab/ci/addon.yml`; validation must pass before publishing to the GitHub mirror.
- Releases are built and published by the in-house packager: `tools/ci/package-manifest-check.mjs` builds and inspects the deterministic runtime archive; `tools/release/publish-release.mjs` creates the GitHub release and uploads to CurseForge/Wago. BigWigsMods/packager and its `.release/` staging directory are retired.
- The GitHub `RGXMods` repository is downstream distribution, not development authority.
- Keep GitLab and GitHub release tags identical, and use protected GitLab release tags.
- Preserve any existing working Wago connection and ID exactly. Never create a new Wago connection without explicit user direction.
- Publishing integrations prohibited by the shared validation policy are retired and must not be restored.
- The root `README.md` must remain detailed and project-specific. Narrow distribution edits must not replace or truncate installation, features, compatibility, usage, media, or support content.
- Verify relative README assets. Do not overwrite newer compatibility facts with stale monorepo or history text.

## Flavor-Specific Consumer Boundaries

- Treat Retail, Classic, and Forever as distinct clients and addon products. Inspect each consumer's TOC, load list, runtime module registry, README, and actual client capabilities before suggesting a framework change or porting behavior. A shared addon name does not imply identical modules, option pages, tab counts, tab rows, or event sources.
- `rgxmods/warcraft/BLU`, `rgxmods/warcraft/BLU_Forever`, and `rgxmods/warcraft/BLU_Classic` have different feature inventories and UI layouts. The Forever fork keeps only client-supported modules; its tabs and pages are intentionally distinct from Retail. The Classic addon uses Ace3 intentionally: do not claim it already depends on RGX-Framework or add that dependency as a metadata-only change.
- `rgxmods/warcraft/SimpleQuestPlates`, `rgxmods/warcraft/SimpleQuestPlates_Classic`, and `rgxmods/warcraft/SimpleQuestPlates_Forever` have separate TOCs, compatibility paths, settings, and interface targets. Verify a fix in each flavor's own code and supported client; do not assume a copied layout or event handler is portable.
- Keep RGX modules capability-gated at the framework boundary. Verify generated API signatures and shipped UI behavior for every affected flavor, including restricted values and combat-safe behavior. A missing feature is a capability difference, not a reason to register nonexistent events or synthesize unavailable modules.
- For any cross-flavor change, enumerate affected products, compare their module inventories and tab/page specifications, run the framework's flavor checks, and record which clients were actually validated. Preserve each addon's own UI arrangement unless a separately verified requirement changes it.
