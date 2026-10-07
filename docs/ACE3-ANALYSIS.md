# Ace3 and RGX: Capabilities, Architecture, and Direction

This document is not here to dismiss Ace3.

Ace3 became popular because it solved a real problem:

- WoW addon authors kept rebuilding the same boring infrastructure

RGX should preserve that outcome: remove repeated infrastructure work while
keeping consumer addons simple. It is not an Ace3 clone or a ranking of libraries.

BLU supplied useful design references. RGX's current ownership model is:

- one shared framework runtime
- one framework-owned module registry
- one framework-owned event system

Consumers depend on that instance through `RequiredDeps: RGX-Framework`.
Actual adoption must be verified per addon and flavor; BLU_Classic still uses Ace3.

## The Architectural Distinction

Ace3 supplies reusable runtime libraries. RGX combines reusable runtime
infrastructure with a declarative authoring contract, design/media primitives,
development-time validation and generation, and centralized WoW compatibility
and safety infrastructure.

The distinction is the authoring path, not a blanket claim that each RGX module
is better or that Ace3 has no safety features or surrounding tooling ecosystem.

```text
Human / agent / editor
        │
        ├─ RGXAddon definition ────────┐
        └─ supported direct Lua API ──┤
                                      ▼
                        RGX runtime (Lua, in WoW)
                        ├─ core lifecycle/events/timers/DB
                        ├─ library UI/design/media modules
                        └─ capability-gated game modules
                                      │
                                compatibility → WoW API

Development time only:
canonical contract/schema/docs → shared authoring engine → MCP/editor/CI
                 ↕ conformance with the same runtime forms
```

Tools can validate and generate supported definitions before WoW loads them.
Hand-written Lua uses the same public forms without requiring those tools.
The runtime never imports the JSON schema, Node engine, MCP, or Studio.

Five capabilities distinguish RGX's framework direction:

1. **Declarative authoring:** `RGXAddon "Name" { ... }` composes existing
   runtime primitives. Simple forms supply defaults; advanced forms expose
   supported choices. Future keys are explicitly marked, not silently promised.
2. **Machine-checkable contract:** the canonical schema, shared engine and
   conformance fixtures connect docs, validation, generation and runtime. Their
   agreement is a maintained invariant, not something the schema guarantees alone.
3. **Centralized safety:** isolated callback dispatch, combat queues, flavor
   gates and restricted-data adapters remove repeated consumer plumbing.
   `pcall` isolates failures; it does not establish taint safety.
4. **Design and UI ownership:** controls and layout consume shared design/media
   primitives. Color presets are available; complete flavor-native swappable
   frame skins remain a separate implementation and client-validation task.
5. **Repeatable verification:** Lua/runtime, DB/control, flavor, contract,
   packaging and MCP/RGX-Hello checks support regression evidence. In-game
   geometry, taint and protected execution still require client evidence.

See [Architecture](ARCHITECTURE.md), [Declarative API](DECLARATIVE-API.md),
[Theming](THEMING.md), and [Testing](TESTING.md) for the concrete contracts.

## The Real Reason People Use Ace3

Most authors do not use Ace3 because they love `LibStub` or because they specifically want `CallbackHandler`.

They use Ace3 because it gives them a fast way to get this list of problems off their plate:

- addon lifecycle
- module organization
- event handling
- timers
- hooks
- saved variables and profiles
- slash commands
- options UI
- addon communication
- serialization
- localization

Ace3 also became a social default because:

- many example addons already use it
- many developers already know its patterns
- it reduces decision-making
- it feels safer to depend on something familiar

That means RGX does not need to copy Ace3 line-for-line.

It does need to make addon development feel easier, safer, and faster than Ace3 does.

## What Each Ace3 Piece Is Actually Solving

### `AceAddon-3.0`

Problem solved:

- addon object creation
- module registration
- lifecycle callbacks like `OnInitialize` and `OnEnable`

What RGX should keep:

- one clean addon/module lifecycle
- easy module registration
- predictable startup order

What RGX should avoid:

- unnecessary embed complexity
- making every addon author think about framework internals

### `AceEvent-3.0` + `CallbackHandler-1.0`

Problem solved:

- event registration
- message dispatch
- callback bookkeeping

What RGX should keep:

- Blizzard event handling
- framework messages
- local callback emitters

What RGX should avoid:

- external dependency chains when native RGX dispatch already solves it

### `AceTimer-3.0`

Problem solved:

- delayed and repeating work

What RGX should keep:

- the shipped `After`, `Every`, and `CancelTimer` timer interface

What RGX should avoid:

- duplicating timer drivers in consumers or adding a second scheduling system

### `AceHook-3.0`

Problem solved:

- safe function hooking
- hook cleanup

What RGX should keep:

- the shipped secure post-hook helper, with its permanent-hook limitation explicit

What RGX should avoid:

- implying AceHook's pre-hook and unhook semantics are interchangeable with RGX hooks

### `AceDB-3.0`

Problem solved:

- SavedVariables handling
- defaults
- namespaces
- profile support

What RGX should keep:

- strong defaults
- simple storage model
- shipped profile-aware defaults, switching, persistence and profile import/export

What RGX should avoid:

- database complexity that authors do not actually need

### `AceConsole-3.0`

Problem solved:

- slash commands
- command routing
- formatted framework output

What RGX should keep:

- a tiny command registration helper

What RGX should avoid:

- over-engineered command parsing unless real addons need it

### `AceGUI-3.0` + `AceConfig-3.0`

Problem solved:

- reusable settings widgets
- options layout generation
- standard configuration flow

What RGX should keep:

- shared widgets
- shared layout primitives
- one-line control binding
- live preview behavior

What RGX should avoid:

- giant declarative config tables that are harder to maintain than the UI they generate

The goal is fewer consumer layout repairs and consistent persisted visual state,
not a claim of universal widget parity.

### `AceComm-3.0` + `AceSerializer-3.0`

Problem solved:

- addon communication
- chunked message transport
- structured data transport

What RGX should keep:

- existing profile serialization/import-export, distinguished from network transport
- addon communication only when a maintained consumer needs it

What RGX should avoid:

- carrying comm infrastructure before that use case exists

### `AceLocale-3.0`

Problem solved:

- localization tables

What RGX should keep:

- the shipped locale registry and framework translation blocks

What RGX should avoid:

- assuming framework localization automatically translates every consumer

### `LibStub`

Problem solved:

- runtime version negotiation for separately embedded libraries

What RGX should keep:

- nothing from this unless RGX starts shipping as separately embedded versioned sub-libraries

What RGX should avoid:

- pretending a single dependency addon needs embedded-library version arbitration

Preferred RGX replacement:

- native framework services shared by dependent consumers

## What Remains To Build

Timers, hooks, profiles, profile serialization, localization, sound, shared
media, minimap and broker infrastructure are already implemented. The priority
is reliability and coherent composition, not reintroducing them as future work.

The [Roadmap](ROADMAP.md) and GitLab track remaining outcomes: consumer
persistence/adoption, authoring-contract congruence, full declarative page/card
composition, and modular native skins with real flavor evidence. Cross-client
communication and higher-level RGXMod systems remain need-driven.

## How RGX Reduces Consumer Work

RGX should not try to win by having more tiny libraries.

RGX should win by being easier to consume.

### 1. One shared dependency

Ace3 often feels powerful because it is broad.

It also feels fragmented because authors end up thinking in terms of many small library names and embedding patterns.

RGX should feel like:

- install one addon
- depend on one addon
- call one family of APIs

### 2. Strong defaults

RGX's common path should combine capability with defaults:

- curated media
- ready-made controls
- consistent styling
- built-in preview behavior

### 3. Less boilerplate

Ace3 often reduces raw implementation work but still leaves a lot of structure for the author to assemble.

RGX should prefer APIs like:

- `AttachFontSelector`
- `AttachBarSelector`
- `AttachColorSelector`
- `ApplyTextStyle`

instead of pushing authors toward big generic setup tables whenever a direct helper would be clearer.

### 4. Consistent visual integration

Ace3 is often used because it is functional.

RGX should be functional and visually opinionated in a good way:

- good media
- good previews
- good selector behavior
- consistent suite identity

### 5. Fewer accidental architecture decisions for addon authors

Ace3 gives a lot of flexibility, which is useful, but it can also spread complexity into consumer addons.

RGX should keep more of the complexity internal so authors do not have to reinvent patterns.

### 6. Build from real suite needs

RGX should only grow when real addons need the feature:

- SQP
- BPU
- BLU
- future RGX-Mod

That keeps the framework honest.

## The Best RGX Position

The strongest position for RGX is not:

- "we replaced Ace3 with our own Ace3 clone"

The strongest position is:

- RGX owns reusable mechanics once, behind small supported interfaces
- consumers describe their content, settings and feature behavior
- runtime, declarative forms and authoring tools agree on one contract
- shared design/layout and compatibility fixes benefit multiple consumers

## Final Standard

When deciding whether a new RGX subsystem belongs in the framework, ask:

1. What real addon problem is this solving?
2. Does it benefit a current maintained consumer and, where relevant, the RGXMod foundation?
3. Can RGX solve it with one clean native system instead of another external-style compatibility layer?
4. Will this make addon authors faster, or just make RGX look more like Ace3?

If the answer is "faster and simpler for real addons," it belongs.

If the answer is "Ace3 had one, so we should too," it probably does not.

---

## Source Capability Review — 2026-10-06

Baseline: the TOC identifies candidate `2.7.15-beta.3`; [Roadmap](ROADMAP.md) records
`2.7.14` stable. This is a source/load-path review, not a new release or an
all-client certification. Local changes do not inherit the TOC's publication status.

| Capability / comparison reference | RGX baseline | Evidence and limits |
|---|---|---|
| Lifecycle/modules (AceAddon) | `RGXAddon`, `RegisterModule`, readiness lifecycle | `core/core.lua`, `core/initialization.lua`; one shared runtime, not embedded modules |
| Events/messages (AceEvent/CallbackHandler) | events, unit events, messages and emitters | `core/systems/events.lua`; isolated dispatch, addon-scoped registrations |
| Timers (AceTimer) | `After`, `Every`, `CancelTimer` | `core/systems/runtime.lua`; named declarative `every` binds through these primitives |
| Hooks (AceHook) | `RGX:Hook` | `core/systems/runtime.lua`; secure permanent post-hooks, not full AceHook parity |
| DB/profiles (AceDB) | defaults, profiles, switching, migrations and global data | `core/systems/database.lua`; not an interchangeable AceDB scope/namespace model |
| Serialization (AceSerializer use case) | profile serialization/import-export | `SerializeProfile`/`DeserializeProfile` in the DB; not generic network transport |
| Commands (AceConsole) | centralized slash registration and declarative `slash` | `core/systems/runtime.lua`, addon factory |
| Options/widgets (AceConfig/AceGUI) | DB-bound declarative controls and imperative UI/layout | `modules/ui/`; supported forms in [Declarative API](DECLARATIVE-API.md) |
| Localization (AceLocale) | locale registry and framework translations | `modules/locale/locale.lua`, `overrides.lua`; consumer translations remain consumer content |
| Shared media (LibSharedMedia, adjacent to Ace3) | native registries and media bridge | `modules/fonts/`, `modules/textures/`, `modules/sound/`, `modules/sharedmedia/`; adoption varies by consumer |
| Minimap/broker (LibDBIcon/LDB, adjacent to Ace3) | minimap persistence and broker module | `modules/minimap/`, `modules/databroker/`; not an Ace3 library comparison |
| Auras/tooltip | restricted-data aura adapter and tooltip composition | `modules/auras/`, `modules/tooltip/`; capabilities and client evidence vary by flavor |
| Buckets/cross-client comm | no equivalent implemented baseline | need-driven roadmap work; in-process framework messages are not addon network traffic |

Module files are loaded through `RGX-Framework.xml`; registration and
`core/initialization.lua` govern activation. A loaded game module is not proof
that its APIs/events exist on every flavor.

### Layout and Skin Status

The composable target remains **panel → main page/tabs → pages → card grid →
rows/cards → widgets**. Imperative `CreateScrollPage`, `CreateColumns`,
`CreatePager`, and `CreateCard` exist in the UI implementation.

The published beta's one-line controls are distinct from the local
`options.columns = 1|2|3` work. That local slice distributes controls into
balanced sequential column flows; it does not create declarative cards or
multi-page tabs and does not complete [#11](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/11).
Human `on` triggers remain outside this branch's implemented contract.

Design currently owns primary/accent themes, derived shades, presets and frame
primitives. Complete per-consumer texture/frame skin selection, predictable
structural token overrides and a verified Forever skin remain
[#21](https://gitlab.dicematrix.cloud/rgxmods/warcraft/RGX-Framework/-/issues/21).
UI owns geometry and interaction; Design/media own presentation resources.
Switching a skin must not fork consumer layout, DB ownership or callback behavior.

### Modularity Is An Implementation Requirement

The registry and system/module directories provide useful separation. They do
not make every implementation modular. The tagged beta.3 addon factory still
combines lifecycle, declaration interpretation and options rendering; the
untagged follow-on moves rendering into the existing UI options owner through
a private seam. MCP validation delegates to the shared engine; see [Architecture](ARCHITECTURE.md) for the
verified ownership seams and ordered changes. Extend existing modules before
creating new ones; modularity means coherent ownership and intentional
dependencies, not more files or more public APIs.
