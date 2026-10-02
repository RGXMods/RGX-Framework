# RGX-Framework

## Project At A Glance

- **Purpose:** one shared foundation for the RGX Mods WoW addon suite, making
  client-specific bugs impossible at the consumer boundary rather than repairing
  the same event, timer, database, or UI plumbing in every addon.
- **Ownership:** RGX-Framework owns shared runtime APIs, compatibility and safety
  boundaries, persistence, UI/layout/design/media, and reusable DSL, validation,
  editor, and authoring infrastructure. Consumer addons supply feature-specific
  definitions, content, settings, and behavior through those APIs. Put reusable
  fixes here; keep consumer declarations thin.
- **Dependency architecture:** all RGX addons are intended to depend on the
  framework through `RequiredDeps: RGX-Framework`, sharing one runtime instance.
  Verify each product's actual TOC and code before claiming it has migrated;
  legacy exceptions such as BLU_Classic still need real implementation work.
- **North star:** RGXMod is a WeakAuras-replacement consumer with the rule model
  Trigger → Conditions → Display → Actions → Load. Its rules/content consume
  framework primitives; reusable rule/editor machinery belongs in the framework.
- **Execution boundary:** WoW runtime is Lua 5.1-era Lua (`core/`, `modules/`,
  `media/`). Developer tooling is Node.js (`tools/`). Tooling, MCP, knowledge
  graphs, external models, and local reference mirrors are never runtime
  dependencies or player-package contents.
- **Compatibility:** preserve existing public semantics and consumer behavior.
  Retail, Classic flavors, and Forever are distinct capability targets, not
  interchangeable copies of one addon.
- **Authority:** GitLab `rgxmods/warcraft/RGX-Framework` owns development, issues,
  MRs, and CI; GitHub `RGXMods/RGX-Framework` is downstream distribution. `docs/`
  is canonical; the Wiki is generated. Read versions and Interfaces from TOCs,
  not this file or session summaries.
- **Shipped versus planned:** a design document, parked branch, passing mock,
  or module file alone does not prove support. Verify runtime loading, lifecycle
  wiring, schema availability, and consumer-facing behavior before advertising it.

## Start Here — Any Harness

This file is the repository entry point. Local skills, MCP servers, Graphify,
workstation paths, and previous chat context are optional aids, not prerequisites
for understanding or following the project rules.

1. Read this overview and the sections relevant to the task. Inspect `git status`,
   the current branch/diff, and canonical remote identity; preserve concurrent
   agent/user changes, stashes, and untracked files. Never expose remote credentials.
2. Resolve the canonical GitLab task. Search open and closed issues before
   creating one; record scope, acceptance criteria, dependencies, and automated
   versus manual checks. Read existing notes/MRs to avoid overlapping other work.
3. Follow the source map below and read scoped instructions in affected
   directories. Verify the affected consumers, flavor TOCs, loaded modules, and
   shipped contract; do not implement from a summary alone.
4. Work on a task branch from the appropriate verified base. Extend framework
   primitives additively and update affected contract/docs layers together.
5. Run the applicable checks below. Record exact commands, results, client/source
   revisions, and remaining in-game checks. A failed or unavailable check is a
   blocker to the corresponding completion claim, not permission to bypass it.
6. Inspect the final diff and `git diff --check`. Commit/push only when requested,
   stage only intended files, and use a GitLab MR for integration. Require actual
   CI success and the task's review/manual gates before merge or release.
7. Attach evidence and blockers to the canonical task; leave it open when required
   acceptance criteria remain. Report the issue/MR URL and the deployment state.

Use supported GitLab APIs/CLI if harness integrations are absent. If required
access, credentials, tools, or client evidence are unavailable, report the exact
blocker; do not silently change authority or claim partial work is complete.

## Source Map — Read When Relevant

| Task / fact | Authoritative source and navigation |
|---|---|
| Installation, product scope, consumer usage | `README.md`, `docs/QUICK-START.md`, `docs/SUPER-SIMPLE.md` |
| Runtime load order / module activation | `RGX-Framework.xml`, `core/initialization.lua`, module registration/getters; `docs/ARCHITECTURE.md` |
| Version / Interfaces / SavedVariables | `RGX-Framework.toc` and `RGX-Framework_*.toc`; consumer TOCs separately |
| Lifecycle, events, timers, combat queue, DB | `core/core.lua`, `core/systems/`; `docs/API.md`, `docs/FOUNDATION.md` |
| Client capabilities / restricted data | `core/compat.lua`, `core/compat_api.lua`, `modules/auras/auras.lua`; `docs/AURAS.md` and **WoW API Reference** below |
| Options, controls, layout, themes, media | `modules/ui/`, `modules/design/`, media modules; `docs/UI-CONTROLS.md`, `docs/THEMING.md` |
| Shipped declarative API / DSL | `core/core.lua`, `contract/schemas/rgx-addon.schema.json`, `docs/DECLARATIVE-API.md`; check each key's availability |
| Authoring, validation, generation, audit | `tools/rgx-mcp/`, scoped `tools/rgx-mcp/AGENTS.md`, `docs/RGX-MCP.md`; keep tooling dependent on the canonical contract |
| Design direction / subsystem priority | `docs/ROADMAP.md`, `docs/ACE3-ANALYSIS.md`, `docs/STUDIO-ROADMAP.md`, canonical GitLab issues; proposals are not shipped APIs |
| Verification / regressions | `tools/ci/package.json`, `tools/ci/*-check.mjs`, runtime fixtures, `docs/TESTING.md`, RGX-Hello E2E |
| Player archive / publishing | `.pkgmeta`, `tools/ci/package-manifest-check.mjs`, `tools/release/publish-release.mjs`, `.gitlab/ci/addon.yml`, `docs/DISTRIBUTION.md` |
| Generated Wiki | `tools/wiki/`; edit `docs/`, never a competing Wiki source |

## Commands

Run from the repository root; install tooling dependencies with
`npm --prefix tools/ci ci` when needed. The package scripts remain authoritative.

Runtime/shared-boundary changes:

```bash
npm --prefix tools/ci run lua-check
npm --prefix tools/ci run lua-runtime-check
npm --prefix tools/ci run flavor-check
npm --prefix tools/ci run docs-check
npm --prefix tools/ci run schema-check
npm --prefix tools/ci run package-check
```

Validation branches:

- **Documentation/instructions only:** check referenced files/commands, run
  `docs-check`, and inspect the diff; no fabricated runtime or in-game result.
- **Declarative/schema/MCP changes:** run the runtime checks above plus MCP/RGX-Hello
  E2E below. Runtime, schema, documentation, generation, validation, and audit must
  agree; run contract-bundle checks when bundle contents/format change.
- **Database:** the runtime command includes the database regression harness;
  additionally verify reload persistence, migration/profile switching, and
  visually restored controls in the affected client.
- **UI:** test geometry, scrolling, resize/show/hide, tab/page transitions,
  callback arguments, persisted visual restoration, and unaffected consumers.
  Aura/event mocks do not cover frame geometry.
- **Compatibility/safety:** inspect all affected flavor sources and run flavor
  checks. Actual combat, protected-action, taint, and secret-value behavior needs
  client evidence; `pcall` and headless tests do not establish safety.
- **Packaging/release:** build/check the allowlisted runtime archive, verify
  flavor inventories and exclusions, then verify each requested distribution.
  XML must pass the shared CI's `xmllint` validation.

Wiki manifest (replace the output placeholder with a temporary directory):

```bash
node tools/wiki/build-wiki.mjs "<temporary-wiki-directory>"
```

MCP setup:

```bash
npm --prefix tools/rgx-mcp ci --no-audit --no-fund
npm --prefix tools/rgx-mcp start
```

MCP/RGX-Hello end-to-end:

```bash
node tools/rgx-mcp/test/test-rgx-hello.mjs "<RGX-Hello-checkout>"
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

1. Shared runtime for the RGX Mods addon suite — including BLU,
   SimpleQuestPlates, BattlePetUtility, EnhancedTravelersLog,
   RemoveNameplateDebuffs, and LevelUp sound-pack products. The dependency
   architecture is one load and one instance; verify adoption per product/flavor.
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

An inaccessible result is not an absent result. Rules that alert on absence or
readiness must retain an explicit unknown state and fail closed when evidence is
restricted, missing, or unverifiable; mocks must cover denied data and predicate
failures rather than inventing Blizzard APIs to make a test pass.

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

The repository's local `graphify-out/` is also discovery-only. Symbol-name matches
do not establish an exported API or documentation coverage: distinguish local
helpers from registered public methods and corroborate each reported gap in code.

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
contract/schemas/rgx-addon.schema.json
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

- **Runtime API:** the Lua interface used by addons (`RGXAddon`, addon methods,
  module getters/methods); this is the framework's primary product. See `docs/API.md`.
- **Compatibility adapters:** `RGX.API` in `core/compat*.lua` normalizes client
  differences; it is not a remote service or a substitute for documented consumer APIs.
- **Contract:** schema and declarative documentation describe supported authoring
  forms. They are framework-owned, not a second runtime or an MCP-only vocabulary.
- **MCP:** `tools/rgx-mcp/` exposes source-only validation, generation, audit, and
  contract context over stdio for developer clients. It is optional tooling, not
  required to run addons, edit framework Lua, or build a Studio application.
- **Studio:** a planned downstream authoring application. Its shell and
  application-specific integrations consume the framework's shared contract and
  reusable infrastructure; Studio does not own the runtime API.

Prioritize the runtime API, its contract/docs, and consumer regressions. Preserve
the existing MCP/RGX-Hello conformance coverage while reusable contract logic is
extracted for other tooling (GitLab #8); a separate shared engine is planned, not
already implemented. Expand MCP transport features only for a verified developer
need, not as a prerequisite for framework work.

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

SavedVariables names must match the consumer TOC; addon lifecycle matching uses
the actual loaded addon name, which may differ from its display/product name.
Keep database ownership, adoption, reset defaults, and profile visual refresh
consistent across reloads. Controls must share one layout/scroll owner rather than
creating competing canvases for declarative and imperative entry points.

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

## Deployment And Local Artifacts

Build test installs from the validated runtime manifest/archive, including media,
rather than recursively copying the checkout. Preserve the previous install in a
recoverable backup and verify the installed TOC, load list, inventory, and changed
file hashes. Confirm the intended client's AddOns path before copying; host
installs are deployment targets, not a source to reverse-sync into Git.

Keep `.reference/`, `graphify-out/`, `.agents/`, local skills, `node_modules/`,
`artifacts/`, and `.release/` out of player installs and releases. `.release/`
remains ignored and excluded even though the old staging workflow is retired.
Preserve unrelated files and stashes; review contents and establish a recoverable
path before removing local artifacts. Never store credentials in repository files,
task text, generated reports, or command output.

## Flavor-Specific Consumer Boundaries

- Treat Retail, Classic, and Forever as distinct clients and addon products. Inspect each consumer's TOC, load list, runtime module registry, README, and actual client capabilities before suggesting a framework change or porting behavior. A shared addon name does not imply identical modules, option pages, tab counts, tab rows, or event sources.
- `rgxmods/warcraft/BLU`, `rgxmods/warcraft/BLU_Forever`, and `rgxmods/warcraft/BLU_Classic` have different feature inventories and UI layouts. The Forever fork keeps only client-supported modules; its tabs and pages are intentionally distinct from Retail. The Classic addon uses Ace3 intentionally: do not claim it already depends on RGX-Framework or add that dependency as a metadata-only change.
- `rgxmods/warcraft/SimpleQuestPlates`, `rgxmods/warcraft/SimpleQuestPlates_Classic`, and `rgxmods/warcraft/SimpleQuestPlates_Forever` have separate TOCs, compatibility paths, settings, and interface targets. Verify a fix in each flavor's own code and supported client; do not assume a copied layout or event handler is portable.
- Keep RGX modules capability-gated at the framework boundary. Verify generated API signatures and shipped UI behavior for every affected flavor, including restricted values and combat-safe behavior. A missing feature is a capability difference, not a reason to register nonexistent events or synthesize unavailable modules.
- For any cross-flavor change, enumerate affected products, compare their module inventories and tab/page specifications, run the framework's flavor checks, and record which clients were actually validated. Preserve each addon's own UI arrangement unless a separately verified requirement changes it.
