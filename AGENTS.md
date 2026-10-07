# RGX-Framework

## Project At A Glance

- **Purpose:** one shared foundation for the RGX Mods WoW addon suite, making client-specific bugs impossible at the consumer boundary rather than repairing the same event, timer, database, UI, compatibility, or authoring plumbing in every addon.
- **Ownership:** RGX-Framework owns shared runtime APIs, compatibility and safety boundaries, persistence, UI/layout/design/media, reusable game-domain primitives, and reusable DSL, contract, validation, editor, MCP, and authoring infrastructure.
- **Consumers:** addons supply feature-specific definitions, content, settings, presentation choices, and behavior through framework APIs. Put reusable mechanics and fixes here; keep consumer declarations thin.
- **Dependency architecture:** RGX addons are intended to depend on the framework through `RequiredDeps: RGX-Framework`, sharing one runtime instance. Verify each product's actual TOC and code before claiming it has migrated; legacy exceptions such as BLU_Classic still require real implementation work.
- **North star:** RGXMod is a WeakAuras-replacement consumer using the model `Trigger → Conditions → Display → Actions → Load`. Its rules/content consume framework primitives; reusable rule/editor machinery belongs in the framework.
- **Execution boundary:** WoW runtime is Lua 5.1-era Lua (`core/`, `library/`, `modules/`, `media/`). Developer tooling is Node.js (`tools/`). Tooling, MCP, knowledge graphs, editors, external models, CI helpers, and local reference mirrors are never runtime dependencies or player-package contents.
- **Compatibility:** preserve existing public semantics and consumer behavior. Retail, Classic flavors, and Forever are separate capability targets, not interchangeable copies of one addon.
- **Authority:** GitLab `rgxmods/warcraft/RGX-Framework` owns development, issues, merge requests, and CI. GitHub `RGXMods/RGX-Framework` is downstream distribution. `docs/` is canonical; the Wiki is generated. Read versions and Interfaces from TOCs, not this file, the Wiki, or session summaries.
- **Shipped versus planned:** a design document, schema draft, parked branch, module file, passing mock, future syntax example, or roadmap entry does not prove support. Verify runtime loading, lifecycle wiring, contract/schema availability, and observable consumer behavior before claiming something ships.

---

# Maintainer Operating Contract

Use these rules whenever modifying, extending, refactoring, reviewing, or designing RGX-Framework itself.

The goal is not merely:

> make the requested code work.

The goal is:

> evolve RGX while remaining inside its established scope, architecture, module boundaries, simplicity contract, compatibility rules, public contracts, and conformance system.

The repository is authoritative.

Do not redesign RGX from memory.

Do not infer current architecture from old chat context.

Do not create a new abstraction before finding the current baseline.

Do not silently expand task scope.

Do not bypass an established rail because a local implementation would be easier.

---

# RGX Framework Rails

Every framework task must remain inside these rails.

## 1. Scope Rail

Know exactly what problem is being solved.

Keep separate:

- requested behavior
- reusable framework mechanics
- consumer-specific behavior
- adjacent improvements
- roadmap work
- speculative architecture

A framework task is not permission to fix everything nearby.

## 2. Ownership Rail

Every capability needs one clear architectural owner.

Classify it before implementation:

### Core

Fundamental shared runtime behavior:

- lifecycle
- addon registration
- events
- timers
- messages
- hooks
- DB foundation
- combat queue
- module registry
- initialization
- compatibility foundation

Primary locations:

```text
core/
core/systems/
```

### Library Module

Reusable framework infrastructure that is not fundamental enough for core.

Examples include reusable UI, design, media, tooltip, layout, or similar infrastructure.

Primary location:

```text
library/
```

with the appropriate library/module category. Game-domain modules live
under `modules/` instead; the directory is the boundary, the category
confirms it.

### Game Module

Reusable WoW-domain capability.

Examples include reusable game-state abstractions, aura behavior, quest behavior, combat information, or similar client-domain systems.

These must respect flavor capability boundaries.

### Consumer API

The supported imperative Lua interface used by addons:

```lua
RGXAddon(...)
addon:RegisterEvent(...)
addon:After(...)
RGX:GetUI()
RGX:GetModule(...)
```

Public API should expose framework capability without requiring consumers to understand framework internals.

### DSL / Declarative API

The human-friendly declarative authoring surface.

It describes what a consumer wants while the framework owns mechanics.

The DSL is not a second framework.

### Contract

Machine-readable description and reusable interpretation of supported authoring forms.

Primary authority includes:

```text
contract/
contract/schemas/
```

and any shared contract engine that actually exists in the current checkout.

### SDK / Authoring Surface

"SDK" in RGX means the complete developer-facing authoring experience composed from the existing:

- runtime API
- addon-scoped API
- DSL
- contract
- schema
- documentation
- validation
- generation
- audit
- MCP/editor tooling

It is **not** permission to create another runtime layer, parallel API, or arbitrary `sdk/` subsystem.

### MCP / Editor / Tooling

Developer-facing adapters over the framework and canonical contract.

Primary location:

```text
tools/
```

They do not own runtime semantics.

### Consumer

Feature-specific behavior, content, configuration, presentation, rules, and policy belonging to one addon.

Keep that in the consumer unless the underlying mechanic is genuinely reusable.

---

# Mandatory Framework Build Loop

For every non-trivial framework change, use this loop.

```text
CURRENT STATE
    ↓
SCOPE
    ↓
BASELINE
    ↓
OWNER
    ↓
AFFECTED LAYERS
    ↓
SMALLEST CONGRUENT CHANGE
    ↓
VALIDATION
    ↓
FINAL RAIL CHECK
```

Do not skip directly from request to implementation.

---

## Step 1 — Establish Current State

Before designing anything:

1. Inspect `git status`.
2. Inspect the current branch.
3. Inspect the current diff.
4. Verify the canonical remote.
5. Preserve concurrent user/agent changes, stashes, and untracked work.
6. Resolve the canonical GitLab issue/task when one exists.
7. Search open and closed issues before creating a duplicate.
8. Read relevant MR notes and existing implementation work.
9. Read this file and any scoped `AGENTS.md` files.
10. Inspect the implementation, not just docs.
11. Verify affected consumers.
12. Verify flavor TOCs.
13. Verify module activation/load order.
14. Verify the shipped contract.
15. Distinguish:
    - shipped
    - partially implemented
    - frozen/intended contract
    - planned
    - unsupported

Never implement from a session summary alone.

Never assume a documented future form already ships.

---

## Step 2 — Freeze Task Scope

Before writing code, establish:

```text
REQUEST:
What behavior is actually requested?

WHY RGX:
Why does this belong in the framework?

IN SCOPE:
What must change?

OUT OF SCOPE:
What must not change?

CONSUMERS:
Which current addon(s) exercise the capability?

RGXMOD:
Does this also advance the RGXMod foundation where relevant?
```

Keep this scope active throughout the task.

If implementation starts requiring unrelated work, do not silently absorb it.

Record it separately.

---

## Step 3 — Find The Existing Baseline

Never begin with:

> How would I design this?

Begin with:

> How does RGX already solve this class of problem?

Search the relevant:

```text
AGENTS.md
README.md
docs/
core/
library/
modules/
contract/
tools/
tests / fixtures
RGX-Hello
.reference/
```

Identify the existing:

- subsystem
- public vocabulary
- lifecycle
- ownership
- dependency direction
- validation path
- compatibility strategy
- simple form
- advanced form

Prefer extending an established baseline over creating a second one.

---

## Step 4 — Classify The Owner

Before creating files or public API, decide whether the change belongs to:

```text
CORE
LIBRARY MODULE
GAME MODULE
PUBLIC API
DSL
CONTRACT
AUTHORING / SDK EXPERIENCE
MCP / EDITOR / TOOLING
CONSUMER
```

If ownership is unclear, inspect adjacent systems until it is clear.

Do not solve ownership ambiguity by spreading logic across layers.

---

## Step 5 — Trace Affected Layers

Determine which existing surfaces are affected.

Possible surfaces include:

```text
runtime kernel
module implementation
compatibility adapter
public API
addon-scoped API
DSL
contract engine
schema
documentation
MCP
editor/shared tooling
generator
validator
audit
fixtures
RGX-Hello E2E
consumer regression
flavor compatibility
package manifest
```

Tracing a layer does **not** mean every layer must change.

It means the agent must understand whether established RGX contracts require those layers to remain synchronized.

---

## Step 6 — Choose The Smallest Congruent Extension

Preference order:

```text
use existing primitive
    ↓
extend existing primitive
    ↓
extend existing module
    ↓
extend existing vocabulary
    ↓
add a primitive inside an existing subsystem
    ↓
add a new subsystem only when the architecture requires one
```

Avoid:

- parallel APIs
- parallel DSL vocabularies
- duplicate state systems
- duplicate event systems
- duplicate timer systems
- duplicate databases
- duplicate layout systems
- duplicate validators
- duplicate schemas
- duplicate contract interpretation
- MCP-only semantics
- editor-only semantics

---

## Step 7 — Implement Through Existing Rails

Use RGX to build RGX.

Prefer existing framework systems over lower-level plumbing.

Do not bypass an RGX abstraction merely because the underlying WoW API is available.

Do not introduce raw consumer-style plumbing inside modules unless that subsystem is specifically responsible for owning that boundary.

---

## Step 8 — Validate

Run the applicable existing repository gates.

Do not invent substitute validation when authoritative checks already exist.

Record:

- exact commands
- results
- source/client revisions where relevant
- unexecuted manual checks
- blockers

Never claim an unexecuted check passed.

---

## Step 9 — Final Rail Check

Before completion, verify:

```text
[ ] Request is satisfied.
[ ] Original scope is still intact.
[ ] Correct subsystem owns the implementation.
[ ] Existing baseline was extended instead of duplicated.
[ ] Dependency direction remains valid.
[ ] Runtime/tooling boundary remains intact.
[ ] Public surface did not expand unnecessarily.
[ ] Simplicity contract remains intact.
[ ] DSL vocabulary remains coherent.
[ ] Contract/runtime remain synchronized.
[ ] MCP/editor/tooling remain adapters.
[ ] Human and agent authoring remain congruent.
[ ] WoW/flavor constraints were verified where relevant.
[ ] Applicable repository gates pass.
[ ] No unrelated cleanup entered the diff.
[ ] Consumer experience stayed the same or became simpler.
```

If a required item fails, the framework change is not complete.

---

# Continuous Drift Check

Long tasks drift.

After every meaningful implementation stage, re-check:

```text
SCOPE
Am I still solving the requested problem?

OWNER
Is this still in the correct subsystem?

BASELINE
Am I extending the established RGX pattern?

BOUNDARY
Did I cross a dependency/runtime/tooling boundary incorrectly?

SIMPLICITY
Did this make the consumer path simpler or at least no worse?

DUPLICATION
Did I recreate something RGX already owns?

CONTRACT
Did affected runtime/schema/docs/tooling surfaces remain congruent?

COMPATIBILITY
Did I preserve supported flavor semantics?
```

Correct drift immediately.

Do not wait until final review.

---

# Architectural Escalation Rule

Framework rails may evolve, but an agent must never break one silently.

If satisfying a task appears to require violating an established architectural rule:

1. identify the requested behavior;
2. identify the rail blocking it;
3. show why the existing architecture cannot satisfy the requirement;
4. identify the smallest architectural change that would resolve it;
5. enumerate affected APIs, contracts, consumers, flavors, tooling, and validation;
6. make the architecture change explicit in the task/MR.

An architectural exception is an architectural decision, not an implementation shortcut.

---

# Start Here — Any Harness

This file is the repository entry point.

Local skills, MCP servers, Graphify, workstation paths, IDE integrations, and previous chat context are optional aids, not prerequisites for understanding or following repository rules.

1. Read this overview and the sections relevant to the task.
2. Inspect repository state and preserve concurrent work.
3. Resolve the canonical GitLab task and acceptance criteria.
4. Follow the source map below.
5. Read scoped instructions in affected directories.
6. Establish the mandatory rail state:
   - scope
   - owner
   - baseline
   - affected layers
   - required gates
7. Work from the appropriate verified base on a task branch.
8. Extend framework primitives additively.
9. Update required contract/docs/tooling surfaces together.
10. Run applicable checks.
11. Inspect the final diff and `git diff --check`.
12. Commit/push only when requested.
13. Stage only intended files.
14. Integrate through a GitLab merge request.
15. Require actual CI success and required manual/review gates before merge/release.
16. Attach evidence and blockers to the canonical task.
17. Leave the task open when required acceptance criteria remain.
18. Report issue/MR URL and deployment state.

Use supported GitLab APIs/CLI if harness integrations are absent.

If required access, credentials, tooling, or client evidence are unavailable, report the exact blocker.

Do not silently change authority.

Do not claim partial work is complete.

---

# Source Map — Read When Relevant

| Task / fact | Authoritative source and navigation |
|---|---|
| Installation, product scope, consumer usage | `README.md`, `docs/QUICK-START.md`, `docs/SUPER-SIMPLE.md` |
| Runtime load order / module activation | `RGX-Framework.xml`, `core/initialization.lua`, module registration/getters, `docs/ARCHITECTURE.md` |
| Version / Interfaces / SavedVariables | `RGX-Framework.toc`, `RGX-Framework_*.toc`; consumer TOCs separately |
| Lifecycle, events, timers, combat queue, DB | `core/core.lua`, `core/systems/`, `docs/API.md`, `docs/FOUNDATION.md` |
| Client capabilities / restricted data | `core/compat.lua`, `core/compat_api.lua`, relevant game modules, `docs/`, and the WoW API reference process below |
| Options, controls, layout, themes, media | `library/ui/`, `library/design/`, media modules, `docs/UI-CONTROLS.md`, `docs/THEMING.md` |
| Shipped declarative API / DSL | runtime implementation, `contract/schemas/rgx-addon.schema.json`, `docs/DECLARATIVE-API.md`; verify each key |
| Contract behavior / reusable authoring logic | current `contract/` implementation; verify what actually exists before claiming a shared engine/capability |
| Authoring, validation, generation, audit | `tools/rgx-mcp/`, scoped `tools/rgx-mcp/AGENTS.md`, `docs/RGX-MCP.md`; tooling follows the canonical contract |
| Design direction / subsystem priority | `docs/ROADMAP.md`, `docs/ACE3-ANALYSIS.md`, `docs/STUDIO-ROADMAP.md`, canonical GitLab issues; proposals are not shipped APIs |
| Verification / regressions | `tools/ci/package.json`, `tools/ci/*-check.mjs`, runtime fixtures, `docs/TESTING.md`, RGX-Hello E2E |
| Player archive / publishing | `.pkgmeta`, `tools/ci/package-manifest-check.mjs`, `tools/release/publish-release.mjs`, `.gitlab/ci/addon.yml`, `docs/DISTRIBUTION.md` |
| Generated Wiki | `tools/wiki/`; edit `docs/`, never a competing Wiki source |

---

# Commands

Run from repository root.

Install CI tooling dependencies when needed:

```bash
npm --prefix tools/ci ci
```

The package scripts remain authoritative.

## Runtime / Shared-Boundary Changes

```bash
npm --prefix tools/ci run lua-check
npm --prefix tools/ci run lua-runtime-check
npm --prefix tools/ci run flavor-check
npm --prefix tools/ci run docs-check
npm --prefix tools/ci run schema-check
npm --prefix tools/ci run package-check
```

## Validation Branches

### Documentation / Instructions Only

- verify referenced files and commands;
- run `docs-check`;
- inspect the diff;
- do not fabricate runtime or in-game results.

### Declarative / Schema / Contract / MCP Changes

Run the runtime checks above plus relevant contract and MCP/RGX-Hello validation.

Runtime, schema, documentation, generation, validation, audit, and tooling must agree.

Run contract-bundle checks when bundle contents or format change.

### Database

The runtime validation includes the database regression harness.

Also verify as applicable:

- reload persistence
- migrations
- profile switching
- explicit `false` versus `nil`
- nested defaults
- global data
- visual restoration of bound controls

### UI

Verify:

- geometry
- scrolling
- resizing
- show/hide
- tab transitions
- page transitions
- callback arguments
- persisted visual restoration
- unaffected consumers

Aura/event mocks do not establish frame geometry correctness.

### Compatibility / Safety

Inspect all affected flavor sources and run flavor checks.

Actual:

- combat behavior
- protected-action behavior
- taint behavior
- restricted/secret-value behavior

requires appropriate client evidence.

`pcall` and headless tests do not establish safety.

### Packaging / Release

Build/check the allowlisted runtime archive.

Verify:

- flavor inventories
- exclusions
- requested distributions
- XML through the shared CI `xmllint` validation

---

# Wiki Manifest

Build generated Wiki content into a temporary directory:

```bash
node tools/wiki/build-wiki.mjs "<temporary-wiki-directory>"
```

`docs/` remains canonical.

---

# MCP Setup

```bash
npm --prefix tools/rgx-mcp ci --no-audit --no-fund
npm --prefix tools/rgx-mcp start
```

---

# MCP / RGX-Hello End-To-End

```bash
node tools/rgx-mcp/test/test-rgx-hello.mjs "<RGX-Hello-checkout>"
```

Run the MCP E2E after changing:

- schema
- declarative runtime
- contract behavior
- generator
- validator
- audit rules
- declarative API contract

Never claim tests or in-game validation passed unless they were actually run.

---

# Runtime Architecture

RGX is one shared framework instance.

```lua
local addonName, RGX = ...
_G.RGXFramework = RGX
```

Consumers use:

```toc
## RequiredDeps: RGX-Framework
```

Never:

- add LibStub;
- embed RGX inside consumers;
- add Ace3 as a framework runtime dependency.

A file under `library/` or `modules/` is not active merely because it exists.

It must actually participate in the runtime load/registration path, including `RGX-Framework.xml` and relevant initialization.

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

Prefer the module registry and supported getters over direct global aliases.

Do not enlarge the global surface merely for convenience.

---

# Design Thesis

## Make The Bug Unrepresentable

Most WoW addon maintenance is reactive: repairing deprecated APIs, lifecycle errors, combat violations, taint, and duplicated plumbing after consumers have already implemented them.

RGX exists to prevent those bug classes at the consumer boundary.

Normal consumers should not need:

- manual event dispatcher frames
- raw `C_Timer`
- raw `SLASH_X`
- duplicated DB systems
- duplicated compatibility logic
- duplicated combat queues
- duplicated layout ownership

Shared callback dispatch must remain failure-isolated.

One consumer callback must not break unrelated consumers.

When designing a new framework subsystem, do not ask only:

> Is this convenient?

Ask:

> Does this make a whole class of WoW-specific consumer bugs impossible or substantially harder to write?

Do not describe `pcall` or arbitrary restricted-value handling as taint safety.

---

# Simplicity Contract

RGX should be easier to consume than the systems it replaces.

The consumer experience is the optimization target.

Complexity may exist inside the framework when it removes complexity from every consumer.

## Bare Forms Assume; Advanced Forms Unlock

Every declarative concept should favor:

```lua
feature = true
```

with progressive disclosure when required:

```lua
feature = {
    option = ...,
}
```

Do not create:

```text
simpleFeature
advancedFeature
customFeature
featureManager
```

for one conceptual capability.

Use one vocabulary.

If a caller repeatedly needs to specify an argument the framework can safely infer, investigate whether the framework abstraction is wrong.

## Human And Agent Congruence

Something simple for a human to author should also be simple for an agent to generate.

Do not create:

- agent-only DSL
- MCP-only authoring semantics
- editor-only definitions
- alternative machine-only vocabulary

The same canonical RGX contract should serve every authoring surface.

---

# Modular Structure

"Modular" does not mean "create another module whenever convenient."

Every subsystem must have:

- a coherent responsibility
- one clear owner
- intentional dependencies
- a stable boundary
- a reason to exist independently

Prefer composition over cross-module knowledge.

Avoid:

- god modules
- generic dumping-ground utility modules
- circular dependencies
- duplicated state ownership
- hidden coupling
- consumers reaching into module internals

A new module needs a real architectural boundary, not merely enough code to justify another file.

Do not add modules that no current maintained addon uses.

Do not enable dormant modules without verifying their `Init()` / `TryInit` wiring in `core/initialization.lua`.

---

# Baselines

For each problem class, RGX should have one canonical way to solve it.

Examples include:

- addon lifecycle baseline
- event baseline
- timer baseline
- message baseline
- hook baseline
- combat-safety baseline
- persistence/database baseline
- UI baseline
- layout baseline
- controls baseline
- theming/design baseline
- media baseline
- compatibility baseline
- game-domain baseline
- DSL baseline
- contract baseline
- authoring-validation baseline

Before implementing a new mechanism, identify the relevant baseline.

Use it or extend it.

Do not build beside it.

---

# RGXMod Context — North Star

RGX-Framework serves two connected roles.

## 1. Shared Runtime

Shared foundation for RGX Mods products including:

- BLU
- SimpleQuestPlates
- BattlePetUtility
- EnhancedTravelersLog
- RemoveNameplateDebuffs
- LevelUp sound-pack products
- other maintained RGX consumers

The intended dependency model is one framework load and one shared instance.

Verify actual adoption per product and flavor.

## 2. RGXMod Foundation

RGXMod is a WeakAuras-replacement consumer built on top of RGX-Framework.

Reusable systems supporting:

```text
Trigger
Conditions
Display
Actions
Load
```

belong in the framework when they also provide general value.

## Build Priority

Build a subsystem when it benefits:

```text
a current maintained addon
        AND
RGXMod
```

If something benefits only RGXMod and has no current reusable consumer need, defer it.

Do not distort the framework around hypothetical future RGXMod requirements.

---

# Consumer API

Preferred consumer entry point:

```lua
local addon = RGXAddon("MyAddon", {
    db = { enabled = true },
    slash = "myaddon",
})
```

The advanced/à-la-carte escape hatch:

```lua
local RGX = assert(_G.RGXFramework, ...)
```

is not the normal front door.

Consumers should use the highest-level safe RGX capability that fits their requirement.

---

# Framework-First Rules

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

Use existing RGX:

- events
- timers
- messages
- hooks
- combat queue
- DB
- UI
- layout
- design
- media
- minimap
- aura
- tooltip
- game-domain modules
- compatibility adapters

before creating another implementation.

---

# Unknown Is Not Absent

An inaccessible result is not an absent result.

Logic alerting on:

- absence
- readiness
- completion
- availability

must retain an explicit unknown/unverifiable state where the client does not provide trustworthy evidence.

Fail closed when evidence is:

- restricted
- missing
- secret
- unverifiable

Mocks must cover denied data and predicate failures.

Never invent Blizzard APIs or synthetic capability merely to make a test pass.

---

# WoW Safety

Do not guess Blizzard APIs.

Verify against the Interface version in the relevant TOC.

Respect:

- combat lockdown
- protected frames
- protected attributes
- taint
- secret/restricted values
- addon load order
- SavedVariables lifecycle
- flavor capability differences

Do not fix taint by suppressing errors.

Fix the unsafe path.

Prefer secure hooks and RGX/framework wrappers over replacing Blizzard functions.

---

# WoW API Reference

## Primary Discovery Reference — API Dump

Use `Ketho/BlizzardInterfaceResources` client-state dumps for discovery of:

- global API functions
- widget/handler tables
- templates
- mixins
- events
- enums
- frames
- CVars

The dump is generated from a running client.

Its license is unverified.

Treat it as an internal development reference.

Never package or redistribute it.

Record dump branch, commit, and build from:

```text
.reference/wow-api-dump/manifest.json
```

or corresponding build information when a runtime-driving conclusion depends on it.

### Flavor Routes

| RGX flavor | Local path | Dump branch |
|---|---|---|
| Retail | `.reference/wow-api-dump/retail/` | `live` |
| Classic Era | `.reference/wow-api-dump/classic-era/` | `classic_era` |
| Burning Crusade Classic | `.reference/wow-api-dump/tbc/` | `classic_anniversary` |
| Mists Classic | `.reference/wow-api-dump/mists/` | `classic` |
| WoW Forever beta | `.reference/wow-api-dump/forever/` | `forever` |
| Wrath/Titan | no dump branch upstream; use wow-ui-source | — |
| Cataclysm historical baseline | no dump ref; use wow-ui-source tag | — |

Examples:

```powershell
node tools/reference/sync-wow-api-dump.mjs
node tools/reference/sync-wow-api-dump.mjs --flavor forever
node tools/reference/search-wow-api-dump.mjs "C_Secrets." --flavor=retail
node tools/reference/search-wow-api-dump.mjs "EDIT_MODE_LAYOUTS_UPDATED" --flavor=forever
```

---

## Confirmation Layer — Shipped UI Source

Use `Gethe/wow-ui-source`, a third-party Git mirror of Blizzard's shipped UI source, for:

- generated API documentation
- FrameXML
- SharedXML
- actual Blizzard call patterns
- secure execution patterns

Local sparse mirrors live under:

```text
.reference/wow-ui-source/
```

They are development references only.

### Flavor Routes

| RGX flavor | Local path | Upstream ref |
|---|---|---|
| Retail | `.reference/wow-ui-source/retail/` | `live` |
| Classic Era | `.reference/wow-ui-source/classic-era/` | `classic_era` |
| Burning Crusade Classic | `.reference/wow-ui-source/tbc/` | `classic_anniversary` |
| Wrath/Titan | `.reference/wow-ui-source/wrath/` | `classic_titan` |
| Mists Classic | `.reference/wow-ui-source/mists/` | `classic` |
| Cataclysm historical baseline | `.reference/wow-ui-source/cata-4.4.2/` | tag `4.4.2` |

Branches move.

Before citing or changing compatibility behavior, record:

- `version.txt`
- upstream ref
- commit

Do not infer client version from a branch name alone.

Reference routes:

```text
Interface/AddOns/Blizzard_APIDocumentationGenerated/
Interface/AddOns/Blizzard_FrameXML/
Interface/AddOns/Blizzard_SharedXML/
```

---

## Graphify

Graphify is for discovery and relationship analysis.

Example:

```powershell
node tools/reference/sync-wow-ui-source.mjs
node tools/reference/search-wow-api.mjs "UNIT_AURA" --flavor=retail --api-only
node tools/reference/build-wow-api-graph.mjs
graphify query "How is UNIT_AURA handled?" --graph .reference/wow-ui-graph/graphify-out/graph.json
```

Graphify is an index, not evidence.

Confirm runtime-driving conclusions in:

- dump records
- generated API documentation
- FrameXML
- SharedXML

Record:

- flavor
- client version
- ref/commit
- file
- relevant line/location

Local symbol-name matches do not prove public API availability.

Distinguish local helpers from exported methods.

---

# Forward Compatibility Rules

For compatibility work:

- check every affected supported flavor, not only Retail;
- prefer generated API documentation for signatures and payloads;
- use FrameXML/SharedXML to verify actual Blizzard usage;
- treat missing APIs as capability differences;
- treat missing fields/templates/enums as capability differences;
- never synthesize unavailable APIs merely to normalize a test;
- treat secret/restricted values as opaque;
- use Blizzard-supported secrecy predicates before boolean tests, comparison, indexing, iteration, formatting, or forwarding;
- remember that a caught Lua error does not undo taint;
- fix unsafe reads at the framework boundary;
- re-sync references when Interface versions or upstream branches advance.

MCP `rgx_search_wow_api` may provide deterministic local dump search with provenance.

It does not represent live-game state and does not replace the confirmation layer.

---

# Declarative Contract

These surfaces must remain synchronized where affected:

```text
RGXAddon / RGX.Addon runtime
        ↕
canonical contract behavior
        ↕
contract/schemas/rgx-addon.schema.json
        ↕
docs/DECLARATIVE-API.md
        ↕
tools/rgx-mcp
        ↕
RGX-Hello E2E
```

If a declarative key changes, inspect every layer.

A schema accepting behavior the runtime ignores is a bug.

Runtime supporting behavior the schema rejects is contract drift.

A generator emitting different semantics is a bug.

A validator interpreting the contract differently is a bug.

Existing declarative keys must not silently change meaning.

---

# DSL Development Rules

The DSL already exists and is under active development.

Do not "design a DSL" from scratch.

Before changing a declarative capability classify it as:

```text
SHIPPED
PARTIALLY IMPLEMENTED
FROZEN / INTENDED CONTRACT
PLANNED
UNDEFINED
```

If an established future form already exists, continue toward that contract unless the task explicitly changes it.

Do not introduce competing syntax for local convenience.

The DSL should expose RGX capability declaratively.

It must not become:

- a second runtime;
- a parallel module architecture;
- an alternate state system;
- an alternate layout engine;
- an MCP-specific language.

---

# MCP Boundary

## Runtime API

The Lua interface used by addons:

- `RGXAddon`
- addon methods
- module getters
- module methods
- supported framework APIs

This is the framework's primary runtime product.

See `docs/API.md`.

## Compatibility Adapters

`RGX.API` in `core/compat*.lua` normalizes client differences.

It is not:

- a remote service;
- MCP;
- a replacement for documented consumer APIs.

## Contract

Schemas, declarative docs, and any actually-shipped shared contract implementation describe supported authoring forms.

They are framework-owned.

They are not a second runtime.

## MCP

`tools/rgx-mcp/` exposes development-time facilities such as:

- validation
- generation
- audit
- contract context
- supported source/reference lookup

over developer tooling interfaces.

MCP is optional.

The runtime must never require it.

## Studio

Studio is downstream authoring software.

It consumes framework contracts and reusable authoring infrastructure.

Studio does not own RGX runtime semantics.

## Hard Dependency Direction

```text
MCP/editor/tools  → RGX contract/docs/source
consumer addons   → RGX runtime

RGX runtime       → NEVER tools/rgx-mcp
RGX runtime       → NEVER Node tooling
```

Do not maintain a second MCP-specific contract.

Do not add MCP-only semantics.

Do not require MCP transport features as a prerequisite for normal framework work.

---

# Database

Do not casually change `NewDatabase` proxy/profile behavior.

Preserve:

- explicit `false` versus `nil`
- nested defaults
- profiles
- global data
- migrations
- profile switching
- SavedVariables persistence

Run the database regression harness and required in-game checks when DB internals change.

---

# UI / Layout

Use existing RGX controls, layout, design, and media systems before creating custom equivalents.

DB-bound controls must:

1. persist state correctly;
2. visually restore that state correctly.

A control that saves correctly but reopens with the wrong visual value is broken.

SavedVariables names must match the consumer TOC.

Addon lifecycle matching uses the actual loaded addon name, which may differ from display/product name.

Keep:

- database ownership
- adoption
- reset defaults
- profile refresh
- visual refresh

consistent across reloads.

Controls must share one layout/scroll owner.

Do not create competing canvases for declarative and imperative entry points.

## Layout Vocabulary

RGX layout is one composable vocabulary.

Conceptually:

```text
panel
  ↓
main page / tabs
  ↓
pages
  ↓
1–2 column card grid
  ↓
rows / cards
  ↓
widgets / content
```

Tabs, pages, rows, columns, and cards must compose rather than become unrelated layout systems.

---

# Documentation

`docs/` is canonical.

The GitHub Wiki is generated.

Edit:

```text
docs/
```

Never manually maintain the Wiki as a competing source.

Update documentation in the same change when public behavior changes.

Documentation must distinguish:

- shipped
- partially implemented
- frozen/intended
- planned

Do not advertise future contract forms as current runtime support.

---

# Hard Boundaries

Never:

- commit secrets or credentials;
- expose remote credentials;
- add runtime dependencies on `tools/`, Node, MCP, CI, editors, or external models;
- add LibStub/Ace3 embedding;
- add Ace3 as an RGX runtime dependency;
- add raw `C_Timer` for normal framework work;
- add raw `SLASH_X` registrations outside the centralized system;
- create duplicate event systems;
- create duplicate timer systems;
- create duplicate database systems;
- create duplicate layout systems;
- create duplicate contract interpretations;
- guess Blizzard APIs;
- treat `pcall` as taint safety;
- silently change public API semantics;
- create a second simple/advanced vocabulary;
- create MCP-only or editor-only semantics;
- expand task scope with unrelated refactors;
- perform repository-wide formatting during targeted work;
- edit generated Wiki output directly;
- change `.pkgmeta`, release workflow, version, or release metadata unless the task requires it;
- add modules no current maintained addon uses;
- enable dormant modules without verifying initialization wiring;
- reverse-sync host/test installs into Git;
- claim planned behavior is shipped.

---

# Git

Do not commit directly to `main`.

Work on:

- `dev`, when appropriate;
- or a task branch from the verified base.

Merge through a GitLab merge request.

Keep commits scoped to the requested change.

Do not mix unrelated cleanup into feature/fix commits.

Before finishing:

```bash
git diff --check
```

and inspect the complete diff.

---

# Repository Workflow

- GitLab under `rgxmods/warcraft` is authoritative.
- Normal work belongs on task branches.
- Integration occurs through GitLab merge requests.
- Shared CI is included from `rgxmods/warcraft/RGX-Framework` at `/.gitlab/ci/addon.yml`.
- Validation must pass before publishing downstream.
- GitHub `RGXMods/RGX-Framework` is distribution, not development authority.
- Releases use the in-house packaging pipeline.
- `tools/ci/package-manifest-check.mjs` builds/inspects the deterministic runtime archive.
- `tools/release/publish-release.mjs` handles release publication and configured distribution integrations.
- BigWigsMods/packager and the historical `.release/` staging workflow are retired.
- Keep GitLab and GitHub release tags identical.
- Use protected GitLab release tags.
- Preserve any existing working Wago connection and ID exactly.
- Never create a new Wago connection without explicit user direction.
- Do not restore publishing integrations prohibited by shared validation policy.
- Keep root `README.md` detailed and project-specific.
- Narrow distribution edits must not truncate installation, features, compatibility, usage, media, or support content.
- Verify relative README assets.
- Do not overwrite newer compatibility facts with stale historical text.

---

# Deployment And Local Artifacts

Build test installs from the validated runtime manifest/archive, including media.

Do not recursively copy the checkout as the deployment procedure.

Preserve the previous install in a recoverable backup.

Verify:

- intended AddOns path
- installed TOC
- load list
- inventory
- changed file hashes

Host installs are deployment targets.

They are not sources to reverse-sync into Git.

Keep these out of player installs/releases:

```text
.reference/
graphify-out/
.agents/
local skills
node_modules/
artifacts/
.release/
```

`.release/` remains ignored/excluded even though its old staging workflow is retired.

Preserve unrelated files and stashes.

Establish a recoverable path before removing local artifacts.

Never store credentials in:

- repository files
- issue/task text
- generated reports
- command output

---

# Flavor-Specific Consumer Boundaries

Treat Retail, Classic, Forever, and other supported client lines as distinct capability targets.

Do not infer identical behavior from a shared addon name.

Before framework changes affecting a consumer, inspect that product's:

- TOC
- load list
- module inventory
- settings
- UI structure
- event sources
- interface target
- actual client capabilities

## BLU Family

`rgxmods/warcraft/BLU`, `BLU_Forever`, and `BLU_Classic` have different feature inventories and UI layouts.

Forever intentionally contains only supported modules.

Classic uses Ace3 intentionally.

Do not claim BLU_Classic already depends on RGX-Framework.

Do not perform a metadata-only migration.

## SimpleQuestPlates Family

`SimpleQuestPlates`, `SimpleQuestPlates_Classic`, and `SimpleQuestPlates_Forever` have separate:

- TOCs
- compatibility paths
- settings
- interface targets

Verify fixes independently.

Do not assume copied layout/event behavior is portable.

## Framework Boundary

Keep RGX modules capability-gated at the framework boundary.

A missing capability is a capability difference.

It is not justification to:

- register nonexistent events;
- fabricate payloads;
- synthesize unavailable modules;
- mask missing APIs.

For cross-flavor changes:

1. enumerate affected products;
2. compare module inventories;
3. compare relevant tab/page/layout specifications;
4. inspect client APIs;
5. run framework flavor checks;
6. record which clients were actually validated.

Preserve each addon's own UI arrangement unless a separately verified requirement changes it.

---

# Definition Of Done

A framework change is complete only when all applicable conditions hold.

## Scope

- [ ] Canonical task/request is satisfied.
- [ ] No unrelated work entered the change.
- [ ] Consumer policy did not leak into the framework.

## Architecture

- [ ] Correct subsystem owns the capability.
- [ ] Existing baseline was used or extended.
- [ ] No parallel framework mechanism was introduced.
- [ ] Dependency direction remains valid.
- [ ] Runtime remains independent of developer tooling.

## Simplicity

- [ ] Common consumer path remains simple.
- [ ] Advanced behavior uses progressive disclosure where appropriate.
- [ ] No unnecessary new vocabulary was created.
- [ ] Consumer boilerplate did not increase without justification.

## Modular Structure

- [ ] Responsibility is clear.
- [ ] Dependencies are intentional.
- [ ] No hidden cross-module coupling was introduced.
- [ ] No duplicate ownership exists.

## API / DSL / Contract

- [ ] Existing public semantics remain compatible unless explicitly changed.
- [ ] Runtime and contract agree.
- [ ] Schema and runtime agree.
- [ ] Docs reflect shipped behavior.
- [ ] Generators/validators/auditors agree where affected.
- [ ] MCP/editor tooling consumes canonical behavior rather than redefining it.
- [ ] RGX-Hello/conformance coverage remains valid where applicable.

## WoW Safety

- [ ] Relevant APIs were verified.
- [ ] Affected flavors were checked.
- [ ] Restricted/secret values are handled correctly.
- [ ] Combat/protected execution was considered.
- [ ] No claim of taint safety relies on `pcall`.

## Validation

- [ ] Applicable automated checks passed.
- [ ] `git diff --check` passed.
- [ ] Required manual/in-game checks were executed or explicitly recorded as blockers.
- [ ] CI status is real, not assumed.

## Integration

- [ ] Diff contains only intended files.
- [ ] Canonical GitLab task contains evidence/blockers.
- [ ] MR is used for integration.
- [ ] Release/deployment state is reported accurately.

---

# Primary Maintainer Invariant

**Build RGX with RGX.**

Use the framework's existing:

- architecture
- module boundaries
- APIs
- DSL vocabulary
- contracts
- compatibility system
- validation
- reference process
- tooling conventions
- design principles

to evolve the framework.

Do not build around them.

Do not build beside them.

Do not bypass them.

And after every framework change ask:

> Did RGX become easier, safer, and more consistent to build with without becoming structurally worse to build on?
