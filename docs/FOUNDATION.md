# RGX Foundation Decisions

This document answers a simple question:

Which capabilities does RGX own, which are already implemented, and how do we
keep the runtime and authoring experience coherent as the framework grows?

Requirements below describe ownership, not an unimplemented shopping list.
See [Architecture](ARCHITECTURE.md) for load order and modularity findings.

## Core Rule

RGX should be elite-simple for addon authors:

- one dependency addon
- one clear API surface
- strong built-in defaults
- no unnecessary library chains
- no historical baggage unless it solves a real current problem

That means we only keep a foundation piece if it is required by real addon behavior.

## North Star

RGX-Framework is a shared runtime and addon-author toolkit. Its supported Lua
API, declarative forms, canonical contract and optional authoring tools serve
the same consumer experience. Developer tools are never runtime dependencies.

The goal is to let someone build a polished WoW addon quickly without first rebuilding the same low-level systems:

- lifecycle and load-order safety
- Blizzard event registration and cleanup
- timers, hooks, slash commands, and safe UI operations
- minimap buttons
- options panels and reusable controls
- shared fonts, textures, sounds, dropdowns, and theme colors
- callback modules for common WoW gameplay signals

Existing addons are the design references:

| Reference pattern | Framework lesson |
|---|---|
| Traveler's-log utility | Traveler's Log events, lifecycle, minimap, and slash command ergonomics |
| Options-heavy addon | large options panels, fonts, nameplate events, and reusable controls |
| Small utility addon | direct events, timers, minimap, and settings |
| Large sound/progression suite | sound categories, progression triggers, and shared media needs |

When these reference patterns repeat a mechanic that another addon could reuse, that pattern belongs in RGX. When the behavior is product-specific, it stays in the addon.

## What Is Actually Required

These are real framework requirements for the RGX direction.

### 1. Core addon object and module registry

RGX needs:

- one global framework object
- named module registration
- module lookup
- predictable initialization order
- a small lifecycle model
- production-proven native runtime helpers for shared framework behaviors

Why this matters:

- every serious framework needs a stable place for shared systems to live

### 2. Shared media registries

RGX needs native registries for:

- fonts
- textures
- colors
- sounds

Why this matters:

- addon suites need one canonical source of shared media
- every addon in a suite should see the same fonts, sounds and textures

Design note:

- the registries are RGX-owned; addons register into them and read from them

### 3. Event and message dispatch

RGX needs:

- Blizzard event registration
- framework-wide messages
- module-local callback signaling when shared registries change

Why this matters:

- modules and consuming addons need a reliable way to react to game state and framework changes

Design note:

- one framework dispatcher owns events, messages and callbacks

Related note:

- production suites already proved this direction with their own event/runtime layers, and RGX should absorb that style of native framework capability where it improves simplicity

### 4. SavedVariables and defaults

RGX needs a clean persistence layer for:

- global settings
- character settings
- profile-aware settings, switching and profile import/export (implemented)
- default application and reset behavior

Why this matters:

- any reusable framework eventually owns saved settings and defaults

Design note:

- RGX profiles define their own scopes; map each consumer's storage explicitly
- simple defaults and clear storage rules matter more than feature count

### 5. Reusable option controls

RGX needs shared controls for:

- dropdowns
- color pickers
- font selectors
- texture selectors
- sound selectors
- toggles, sliders, edit boxes, tabs, grouped settings layouts

Why this matters:

- this is the difference between a media pack and a framework

### 6. Safe apply helpers

RGX needs one-line helpers that apply settings cleanly to:

- `FontString`s
- status bars
- textures
- frames
- sounds

Why this matters:

- addon authors should not rebuild glue code every time they use RGX data

## What RGX Does Not Do

- no library discovery or version negotiation: one addon, one `_G.RGXFramework` instance
- no embedding into consumers
- no network communication layer until a maintained addon needs one; profile
  serialization already exists
- no generated settings UI from a config table beyond the declarative `options` grammar

## RGX Direction

Keep three states explicit:

### Implemented baseline

- registry/lifecycle, events/messages, timers, hooks, slash and combat queue
- profile-aware database, defaults, migrations and profile serialization
- fonts, colors, textures, sound and shared-media registries
- controls, options panels, imperative pages/columns/cards and design primitives
- minimap, broker, locale, auras/tooltip and capability-gated game modules
- `RGXAddon`, canonical schema and source-only authoring/conformance tooling

Implementation does not prove universal consumer adoption or client safety.
Verify load/registration, flavor capabilities and observable behavior separately.

### Current hardening and composition

- reliable DB ownership and persisted visual restoration in consumers
- one declaration vocabulary across runtime, schema, engine and MCP
- modular options rendering through existing UI/layout factories
- complete page/card composition beyond local declarative column flows
- theme/skin contracts that separate presentation from geometry and behavior

### Need-driven future work

- bucket events and cross-client communication when maintained consumers need them
- broader trigger/condition/display evaluation on top of the shipped clone-keyed trigger state substrate, with current consumer value
- full native skins after source/asset evidence and client geometry acceptance

The [Roadmap](ROADMAP.md) orders these outcomes; GitLab owns acceptance state.

## Modularity Standard

Each module has one coherent owner and a small consumer interface. Internally
it may compose private helpers without turning each helper into another public
module. Library/game classification, declared dependencies and capability gates
must agree with XML loading and initialization.

- Core owns shared lifecycle, dispatch, persistence and addon registration.
- UI owns controls, layout and rendering; Design/media own styling resources.
- Game modules own reusable WoW-domain state behind flavor adapters.
- Contract owns canonical authoring semantics; MCP/editor tooling adapts them.
- Consumers own feature policy, content and presentation choices.

Core owns declaration-time options validation and addon lifecycle; lazy
control/layout rendering lives in the UI options module. MCP validation
delegates to the shared engine.
Neither requires another SDK/runtime or duplicate contract.
See the ordered modularity work in [Architecture](ARCHITECTURE.md).

## Final Decision

RGX owns the capabilities addon suites actually need:

- module organization
- dispatch
- persistence
- controls
- media registries
- profile serialization; network communication when a real need exists

That is the standard to hold:

- keep the capability
- keep the architecture simple
- add nothing an addon is not using
