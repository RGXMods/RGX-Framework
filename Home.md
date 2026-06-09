# RGX-Framework Wiki

Welcome to the RGX-Framework wiki, the complete reference for the modern WoW addon framework.

## Quick Links

- [[Architecture]] - Load order, module system, lifecycle, conventions
- [[API Reference]] - Complete public API by module
- [[Fonts]] - Registry, blocked fonts, apply helpers, dropdowns, style objects
- [[Dropdowns]] - CreateNestedDropdown, item schema, auto-width, inline buttons
- [[Theming & Design]] - Design palette, color usage, font styling, templates
- [[Troubleshooting]] - Common issues and fixes
- [[Migration Guide]] - From Ace3, LibSharedMedia, standalone implementations

## What Is RGX-Framework?

A modern WoW addon framework: one `RequiredDeps` entry, everything included. No embedding, no version conflicts, no library chains.

## Project Goal

RGX-Framework exists to make building World of Warcraft addons easier for other authors.

It is the shared platform for the RGX addon family and future community addons:

- addon authors should be able to build options panels, minimap buttons, slash commands, events, timers, media dropdowns, themes, and common WoW event callbacks without rebuilding the same foundation every time
- existing RGX addons are reference implementations, not throwaway examples
- ETL, SQP, and RND show the framework consumer pattern that BLU v7 is migrating toward
- BLU, ETL, SQP, RND, and future addons should all feed lessons back into RGX when a pattern is reusable

The boundary is intentional: RGX owns reusable addon-building tools; each addon owns its product behavior, branding, data model, and feature decisions.
