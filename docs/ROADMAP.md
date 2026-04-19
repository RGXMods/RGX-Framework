# RGX-Framework Roadmap

## Direction

RGX-Framework is meant to grow into a shared UI foundation for the wider addon suite, not just a loose bundle of fonts and textures.

The main goal is simple:

- addon authors should be able to install one library addon
- hook into a small API
- get polished, reusable UI/media building blocks without rewriting the same option controls in every project

The player-facing experience should stay quiet. The author-facing experience should be powerful, predictable, and easy to adopt.

## Core Principles

- Keep modules separate so each one has a clear responsibility.
- Make addon-side integration extremely simple.
- Keep the implementation inside RGX robust even if the public API stays tiny.
- Prefer reusable controls over one-off addon-specific option widgets.
- Build things once in RGX, then consume them across the suite.

## Module Boundaries

### RGXFonts

This module is responsible for the font library itself and the tools needed to use it well.

Scope includes:

- bundled curated font library
- font lookup and fallback-safe paths
- grouped font families and categories
- font selection controls
- font styling controls for WoW text flags and related text presentation
- shared style objects that can be applied to `FontString`s
- helper APIs that let another addon adopt RGX font options in one or two lines

Long-term goal:

- make RGX the easiest way for an addon to offer high-quality font selection and styling
- make RGX the strongest curated font addon/library in the suite

### RGXColors

This module is responsible for color data and color selection workflows.

Scope includes:

- named shared colors
- color conversion and utility helpers
- shared color picker helpers
- reusable option controls for choosing and saving colors
- easy color application to text, textures, and status bars

Long-term goal:

- make color selection feel just as reusable and standardized as font selection

### RGXDropdowns

This is a planned future module and should be treated as separate from the font module.

The font module may use dropdowns, but dropdowns should not be defined only in terms of fonts.

Planned scope includes:

- reusable dropdown menu framework inspired by the BLU setup
- nested grouped menus
- submenu support
- menu item metadata and callbacks
- consistent shared visual behavior across addons
- reusable option menu building blocks that other RGX modules can consume

Long-term goal:

- allow any addon to reuse the same dropdown framework for fonts, colors, themes, profiles, categories, filters, and future settings UIs

### RGXFrames

This is a future-facing concept rather than a current module.

Planned scope may include:

- frame creation helpers
- frame selection and display helpers
- frame style and layout presets
- reusable themed frame containers
- shared controls for applying frame appearance options

Long-term goal:

- give addon authors a reusable framework for frame presentation and theme selection instead of re-building panel UI logic in each addon

## Integration Philosophy

The public API should stay stupid simple.

Ideal addon-side usage looks like this:

- install `RGX-Framework`
- declare it as a dependency
- call one or two RGX helper lines
- inherit the shared selector UI and application logic

That means the complexity belongs inside RGX, not inside consuming addons.

## Current Practical Path

### SimpleQuestPlates

SQP is a good proving ground for RGX module design because it already needs:

- font selection
- font styling
- color picking
- compact options UI
- reusable preview behavior

That makes it a useful place to refine:

- what a shared RGX font selector should feel like
- what a shared RGX color control should feel like
- how a shared dropdown framework should be structured

The goal is not to stuff SQP with custom one-off controls forever.

The goal is to refine the RGX-backed controls there and then reuse them elsewhere.

### PetBuddy2

PB2 is part of the active integration path for RGX and should consume shared RGX font tooling instead of owning custom font plumbing when practical.

The long-term direction is:

- PB2 consumes RGX
- PB2 does not become the place where shared font infrastructure lives

### BLU

BLU is part of the roadmap for future RGX integration.

Important distinction:

- BLU's current dropdown/menu behavior is an inspiration source
- RGX should eventually provide reusable framework pieces so BLU-style patterns can be implemented across multiple addons
- RGX should not be hard-coupled to BLU-specific addon logic

## Near-Term Roadmap

- Keep strengthening `RGXFonts` as the shared font library and font styling system.
- Keep strengthening `RGXColors` as the shared color picker and color utility system.
- Continue simplifying consumer integration so addon authors need as little setup code as possible.
- Refine shared selector controls inside real addon integrations like SQP and PB2.
- Standardize grouped and nested selector behavior in preparation for a dedicated dropdown framework.
- Keep the public API small while expanding the internal framework capabilities.

## Longer-Term Roadmap

- Create a dedicated dropdown/menu GUI framework module.
- Expand reusable option controls across fonts, colors, and other setting types.
- Explore a future frame library for display, selection, and themed containers.
- Make RGX the common UI/media layer across more of the addon suite.
- Continue improving documentation so addon authors can integrate RGX quickly without reverse-engineering example addons.

## Non-Goals

- RGX is not meant to become a bloated everything-framework.
- Each module should stay focused.
- Fonts, colors, dropdowns, and future frame tooling should stay distinct even when they work well together.
- Consuming addons should not need to understand RGX internals to benefit from it.
