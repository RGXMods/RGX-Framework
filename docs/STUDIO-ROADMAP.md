# RGX Studio Roadmap

## Milestone Status

RGX Studio is a **future, blocked milestone**, not current implementation work.
RGX-Framework must reach production readiness before anyone creates the Tauri
repository, builds a prototype, or starts application code.

```text
ACTIVE NOW
WoW - RGX Framework milestone
    -> stable production framework release
    -> production-readiness gate completed
    -> only then unblock the next milestone

BLOCKED FUTURE WORK
RGX Studio milestone
    -> repository bootstrap
    -> contract explorer and project model
    -> visual authoring and mock game window
    -> constrained behavior simulation
    -> export/deploy loop
    -> signed cross-platform release
```

The GitLab gate is
[`#30 Declare RGX-Framework production ready and unblock RGX Studio`](https://gitlab.dicematrix.cloud/rgxmods/warcraft/monorepo/-/work_items/30).
Planning may be refined while blocked, but implementation, prototyping, and
repository creation must not begin until that issue is completed. The Studio
milestone intentionally has no due date and no implementation assignees while
blocked.

Public status snapshot, updated 2026-08-15: RGX-Framework `v2.7.0` is live as a
runtime-only addon release with declarative named timers and an accessible-only
aura boundary. The production gate remains open pending completed in-game
validation. The
[`RGXAuras restricted-value boundary`](https://gitlab.dicematrix.cloud/rgxmods/warcraft/monorepo/-/work_items/36)
has automated accessible-only verification; Retail in-game validation is pending.
Studio is still blocked. GitLab is the authoritative tracker and may require
sign-in; this page is the public roadmap snapshot.

Framework production readiness requires all of the following:

- a stable production release through the canonical pipeline
- congruent runtime, DSL, schema, docs, MCP/contract tooling, and RGX-Hello
- regression coverage for database/profile behavior, events, timers, lifecycle,
  UI save/restore, packaging, compatibility, and failure isolation
- completed in-game validation for combat lockdown, taint, secret values,
  lifecycle, persistence, and rendering paths that automation cannot prove
- a runtime-only reproducible player package
- a documented compatibility/deprecation policy and canonical source contract
- no unresolved production blocker, unless explicitly accepted and documented

## Product Boundary

RGX Studio will be a cross-platform Tauri application for visually authoring,
previewing, testing, and exporting WoW addons. It is not a WoW addon and does
not belong inside this repository's player package.

The application has one deliberately narrow product rule:

> RGX Studio authors and previews only addons built with the shipped
> `RGXAddon` DSL and approved RGX-Framework APIs. Every export declares
> `## RequiredDeps: RGX-Framework`; Studio never embeds or replaces RGX.

This constraint is a feature. It lets Studio provide reliable defaults,
deterministic validation, constrained behavior simulation, and clean addon
output without pretending to emulate arbitrary WoW Lua.

## Repository Placement

After the production gate opens, create Studio as a separate sibling repository,
not under `tools/` and not in the WoW addon aggregation repository:

```text
C:\Users\Joey\Projects\rgxmods\
    warcraft\        suite inventory and integration corpus
    rgx-studio\      Tauri desktop application (new repository)

C:\Users\Joey\RGX-Framework\
    WoW runtime and canonical contract producer
```

The roadmap tracks bootstrap work under `rgx-studio`; the boundary should not
change even if the final display name does.
Tauri/Rust/web code needs its own release cadence, OS build matrix, code-signing
secrets, updater, issue board, and version namespace. Putting it in
RGX-Framework would couple desktop releases to `RGX-Framework.toc` and create a
permanent risk of desktop source or binaries entering the player archive.

## Dependency Rules

```text
RGX runtime Lua
    <-> schemas/rgx-addon.schema.json
    <-> docs/DECLARATIVE-API.md
    <-> contract tooling and rgx-mcp
    <-> RGX-Hello and runtime contract tests
                       |
                       v
                versioned contract bundle
                       |
                       v
                  RGX Studio
                       |
                       v
             generated consumer addon
                       |
             RequiredDeps: RGX-Framework
                       v
                 World of Warcraft
```

Hard prohibitions:

- RGX runtime never imports Node, Rust, Tauri, MCP, Studio, CI, or `tools/`.
- Studio never becomes a dependency of RGX or a generated addon.
- Generated addons never embed RGX, LibStub, Ace3, Studio project data, or
  arbitrary third-party runtime libraries.
- Studio does not execute arbitrary imported Lua or inject into the WoW client.
- The player archive contains runtime Lua/XML/media only, plus required addon
  metadata and license files.

## Canonical Contract

RGX-Framework remains authoritative. Studio is a downstream contract consumer,
not another source of runtime semantics.

The contract must evolve as one tandem product:

```text
runtime + schema + docs + contract data + RGX-Hello + Studio tooling fixtures
```

RGX-Framework publishes only its WoW addon runtime. Canonical schemas and docs
remain in Framework source, but Framework does not publish a second product,
contract bundle, MCP service, or editor tooling. Those distributions belong to
RGX Studio.
The future Studio-specific contract catalog is:

```text
rgx-contract-vX.Y.Z/
    manifest.json
    schemas/rgx-addon.schema.json
    schemas/rgx-api.catalog.json
    docs/DECLARATIVE-API.md
    assets/design-tokens.json
    assets/media-manifest.json
    test-vectors/
```

The bundle is generated from canonical framework sources. It is not a manually
maintained second schema.

`manifest.json` should identify at least:

- contract format version
- framework version and source commit/tag
- WoW Interface and supported flavor
- schema/catalog/document hashes
- bundle hash and provenance

Studio projects pin an exact bundle. Opening a project must never silently
upgrade it. Unsupported contract formats open read-only, and contract upgrades
are explicit project migrations.

## Approved API Catalog

The existing addon schema describes the `RGXAddon` table but not every advanced
RGX call that a constrained behavior editor may emit. Before Studio permits
advanced actions, RGX needs one machine-readable API catalog generated and
checked in this repository.

Each authorable API entry should declare:

- owner/module and method
- argument and callback signatures
- framework version introduced
- flavor and availability status
- safety and side-effect category
- preview support: simulated, fixture-driven, placeholder, or unavailable
- canonical documentation anchor

Studio may emit only catalog-approved calls. Raw `CreateFrame`, `C_Timer`,
`SLASH_*`, global hook replacement, and unlisted libraries remain unavailable.

## Preview Model

Studio is a structural and interaction preview, not a WoW emulator.

```text
Studio project
    -> pinned-contract validation
    -> normalized RGX model
       -> addon Lua/TOC exporter
       -> neutral Preview IR
          -> HTML/CSS renderer in the Tauri WebView
```

The preview renderer models RGX concepts such as options panels, tabs, controls,
minimap interactions, saved state, and synthetic human triggers. It does not
load the production WoW Lua runtime, reproduce Blizzard's secure environment,
or claim to prove taint/combat behavior.

Behavior simulation should use constrained action graphs backed by the approved
API catalog. Synthetic fixtures can dispatch `login`, `quest.turnin`, named
timers, and other supported triggers. Callback dispatch remains failure-isolated
to match RGX. Gameplay-dependent values are labeled fixtures, not live data.

Real in-game testing remains authoritative for Blizzard templates, combat
lockdown, taint, secret values, event payloads, and exact rendering.

## Studio Repository Shape

```text
rgx-studio/
    apps/desktop/
        src/                    TypeScript editor and preview UI
        src-tauri/              Rust filesystem/export/update boundary
    packages/
        project-model/          versioned Studio document format
        contract-client/        bundle verification, cache, and pinning
        preview-compiler/       normalized RGX model -> Preview IR
        preview-web/            Preview IR -> mock game-window UI
        exporter/               deterministic Lua/TOC/media output
    contracts/bundled/          generated pinned baseline bundle
    tests/
        contract/
        golden/
        preview/
        e2e/
```

A user's authoring project and its installable output stay separate:

```text
MyAddon-project/
    project.rgxstudio.json
    assets/
    build/MyAddon/
        MyAddon.toc
        MyAddon.lua
        media/
```

Only `build/MyAddon/` is deployable to `Interface/AddOns`.

## Milestone Sequence

### Active Milestone: RGX-Framework Production

The work below belongs to `WoW - RGX Framework`, not to Studio application
development:

- finish and harden the public runtime and loaded modules
- complete declarative vertical slices across every contract layer
- prove database/profile persistence and migrations
- prove event/timer ownership, lifecycle, ordering, and failure isolation
- prove UI controls save and visually restore state
- verify combat-lockdown, taint, secret-value, and compatibility boundaries
- make player packaging and release automation deterministic
- stabilize the source schema/docs that future Studio tooling will consume
- complete required consumer and in-game production validation

The terminal deliverable is production gate `#30`. Studio packaging and tooling
do not begin while the framework itself remains pre-production.

### Future Milestone: RGX Studio

Every phase below is blocked until production gate `#30` is completed. They are
recorded now so framework decisions remain compatible with the future product,
not because application work should start early.

## Studio Delivery Phases

### Prerequisite: Framework Contract Foundation

- Keep Framework packaging strictly runtime-only.
- Add an exact player-archive inventory test.
- Track dependency lockfiles and use reproducible installs.
- Define Studio's future contract bundle manifest and deterministic build.
- Add feature-introduction metadata to declarative keys.
- Add the approved RGX API catalog.
- Extract reusable pure contract validation/generation logic from MCP transport.
- Move public MCP/API transport and editor integrations into RGX Studio; retain
  the in-framework MCP only as a temporary source-tree conformance fixture until
  that replacement is operational.
- Add deterministic runtime fixtures for behavior the Studio will simulate.

Exit: one tagged Framework revision produces its runtime archive and exposes a
stable canonical source contract that Studio can consume after gate #30.

### Phase 1: Studio Shell And Contract Explorer

- After gate `#30`, create the separate Tauri repository.
- Build, load, and verify Studio-owned pinned RGX contract bundles from the
  canonical Framework source contract.
- Implement Studio project-format versioning and migrations.
- Browse the shipped schema, docs, APIs, modules, and preview capabilities.
- Open incompatible projects read-only with a clear reason.

Exit: current, old, and deliberately incompatible contract fixtures produce
deterministic compatibility results on Windows, macOS, and Linux CI.

### Phase 2: Visual Authoring MVP

- Author metadata, brand, DB defaults, options tabs, sections, toggles, sliders,
  colors, dropdowns, basic minimap settings, slash command, and welcome text.
- Preview state changes and verify save/reopen visual restoration.
- Export a clean addon folder with matching TOC, SavedVariables, dependency,
  Lua entrypoint, metadata, media paths, validation, and audit reports.
- Make `RequiredDeps: RGX-Framework` non-optional.

Exit: Studio can reproduce an RGX-Hello-level addon that passes schema, Lua 5.1
syntax, MCP audit, and reference-addon conformance checks.

### Phase 3: Constrained Behavior Authoring

- Add human `on` triggers and named `every` timers.
- Add action graphs for approved messages, output, timers, and module calls.
- Dispatch synthetic event/timer fixtures in the preview.
- Reject arbitrary Lua and calls absent from the approved API catalog.

Exit: every generated call maps to a tagged RGX capability and an automated
contract fixture.

### Phase 4: Visual Fidelity And Media

- Generate design tokens and media manifests from framework sources.
- Add the mock game-window shell, scale presets, panel layering, and interaction
  states without copying Blizzard assets that cannot be redistributed.
- Add cross-platform visual snapshots and accessibility checks.
- Label preview approximations explicitly.

Exit: representative RGX controls render consistently across supported desktop
WebViews while remaining traceable to framework design tokens.

### Phase 5: Export, Deploy, And In-Game Loop

- Validate, audit, and atomically export consumer folders.
- Optionally deploy to a user-selected WoW AddOns directory.
- Inspect the installed RGX TOC and warn about contract incompatibility.
- Keep deployment explicit and never write into the framework folder.
- Maintain RGX-Hello/manual in-game acceptance checks.

Exit: generated addons install cleanly and fail clearly when the installed
framework cannot support their contract.

### Phase 6: Compatibility Handshake

- Add an additive runtime contract-capability query to RGX.
- Emit framework/contract provenance in generated TOCs.
- Compute minimum framework versions from features actually used.
- Add explicit Studio project and contract upgrade flows.

Exit: an old framework produces a clear compatibility failure rather than
silently ignoring a newer generated feature.

### Phase 7: Independent Studio Release

- Build and sign desktop installers independently of framework tags.
- Publish a Studio compatibility matrix and stable/beta channels.
- Sign updater artifacts and contract bundles.
- Keep framework, contract-format, Studio, project-format, and generated-addon
  versions independent.

## Framework Priorities

Studio depends on RGX being deterministic and machine-describable. Continue the
framework in this order:

1. Complete one declarative vertical slice at a time across runtime, schema,
   docs, MCP, runtime tests, and RGX-Hello.
2. Keep Framework packaging separate from future Studio API/MCP distributions.
3. Let Studio publish deterministic contract metadata and approved API bundles.
4. Harden ownership, teardown, ordering, state restoration, and diagnostics.
5. Add display/layout primitives only when their runtime and preview semantics
   can be specified and tested together.

Do not pause framework work to create a Studio mock. Do not create the Tauri
repository or prototype while RGX-Framework is pre-production. The first Studio
implementation begins only after gate `#30` and consumes a production framework
contract rather than defining missing framework behavior itself.
