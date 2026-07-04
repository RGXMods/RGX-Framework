# RGX-Framework

**A modern WoW addon framework — one dependency, everything included.**

RGX-Framework is a single `RequiredDeps` entry that provides a declarative addon front door, events, timers, hooks, combat queueing, slash commands, saved-variable profiles, fonts, colors, a color picker, textures, dropdowns, UI controls, a theming system, tooltips, aura scanning, minimap buttons, sound playback, DataBroker support, and more. No embedding. No version conflicts. No library chains.

> **Related:** [CurseForge](https://www.curseforge.com/wow/addons/rgx-framework) · [GitHub](https://github.com/DonnieDice/RGX-Framework) · [Issues](https://github.com/DonnieDice/RGX-Framework/issues) · [RGX-Hello (reference addon + test suite)](https://github.com/DonnieDice/RGX-Hello)

---

## Quick Start — the whole addon in one call

```lua
-- MyAddon.toc
## Interface: 120007
## Title: MyAddon
## RequiredDeps: RGX-Framework
## SavedVariables: MyAddonDB

MyAddon.lua
```

```lua
-- MyAddon.lua — this is the entire addon
RGXAddon "MyAddon" {
    slash   = "myaddon",
    minimap = true,
    db      = { enabled = true, volume = 80 },
    options = {
        General = {
            { toggle = "enabled" },
            { slider = "volume", min = 0, max = 100, suffix = "%" },
        },
    },
    welcome = "loaded — /myaddon for options",
}
```

That gives you saved settings with profiles, a tabbed options panel with controls that save **and restore**, a slash command, a minimap button whose position persists, and branded chat output. Every key works bare with assumed arguments and accepts an advanced form when you need more — see [[Declarative API]].

`local RGX = _G.RGXFramework` remains available for à la carte use ([[Quick Start]]) — it is the escape hatch, not the front door.

---

## Why RGX?

| Problem | Ace3 / Legacy | RGX |
|---|---|---|
| Dependency model | Embed 8+ libraries per addon | One `RequiredDeps` entry |
| Version conflicts | LibStub arbitration at runtime | Single shared instance |
| Addon setup | AceAddon + AceDB + AceConfig assembly | `RGXAddon "Name" { }` |
| Options UI | AceConfig mega-tables → unstyled AceGUI | Small declarative tables → themed, db-bound controls |
| Taint safety | Your problem | By construction — pcall-wrapped dispatch, lockdown guards, Midnight secret-aura handling |
| Tooling | None | JSON schema + in-tree MCP server (validate/audit/generate) + in-game test suite |

The full audited comparison lives in [`docs/ACE3-ANALYSIS.md`](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/ACE3-ANALYSIS.md).

---

## Module Overview

| Module | Global | Getter | Status |
|---|---|---|---|
| Core (events, timers, hooks, slash, combat queue, db) | `RGXFramework` | — | Active |
| Fonts | `RGXFonts` | `RGX:GetFonts()` | Active |
| Colors | `RGXColors` | `RGX:GetColors()` | Active |
| ColorPicker | `RGXColorPicker` | `RGX:GetColorPicker()` | Active |
| Textures | `RGXTextures` | `RGX:GetTextures()` | Active |
| Dropdowns | `RGXDropdowns` | `RGX:GetDropdowns()` | Active |
| Design | `RGXDesign` | `RGX:GetDesign()` | Active |
| UI | `RGXUI` | `RGX:GetUI()` | Active |
| Tooltip | `RGXTooltip` | `RGX:GetTooltip()` | Active |
| Auras | `RGXAuras` | `RGX:GetAuras()` | Active |
| Minimap | `RGXMinimap` | `RGX:GetMinimap()` | Active |
| Sound | `RGXSound` | `RGX:GetSound()` | Active |
| DataBroker | `RGXDataBroker` | `RGX:GetDataBroker()` | Active |
| SharedMedia | `RGXSharedMedia` | `RGX:GetSharedMedia()` | Active |
| PetBattles | `RGXPetBattles` | `RGX:GetPetBattles()` | Active |
| Combat | `RGXCombat` | `RGX:GetCombat()` | Active |
| Reputation | `RGXReputation` | `RGX:GetReputation()` | Active |

All modules load from `RGX-Framework.xml`; the dormant tier was re-enabled in v2.0.0–v2.1.0.

---

## Wiki Pages

### Start Here

- [[Declarative API]] — the `RGXAddon` front door: shipped keys, bare/advanced forms, controls, layout model
- [[Quick Start]] — TOC setup, à la carte integration, complete examples
- [[Architecture]] — load order, module registration, lifecycle
- [[API Reference]] — full public API

### Module Deep-Dives

- [[Fonts]] · [[Dropdowns]] · [[Colors]] · [[ColorPicker]] · [[UI Controls]] · [[Textures]] · [[Theming]] · [[Tooltip]] · [[Auras]] · [[Minimap]] · [[Sound]] · [[DataBroker]]

### Tooling & Testing

- [[RGX-MCP]] — the in-tree MCP server: validate, audit, and generate RGX addons (ships in the addon zip)
- [[Testing]] — RGX-Hello, the reference addon and in-game visual test suite

### Guides

- [[Migration]] — from Ace3, LibSharedMedia, manual patterns
- [[Troubleshooting]] — common issues, debug mode

---

## Versions

Framework releases are tagged `vX.Y.Z` and packaged to CurseForge automatically; the canonical changelog is [`docs/CHANGES.md`](https://github.com/DonnieDice/RGX-Framework/blob/main/docs/CHANGES.md).
