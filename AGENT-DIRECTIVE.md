# Agent Directive — RGX-Framework

RGX-Framework is a shared WoW addon runtime library, not a player-facing addon.
If you are an AI agent working on or with this addon:

## Start With the Public API

- Use the documented public RGX API. Do not reach into framework internals.
- Read the documentation for the installed framework version. The player
  package does not include the full documentation tree; obtain the matching
  source and docs from the project repository or release page.
- Do not infer shipped behavior from roadmap prose. Verify the runtime,
  schema, and docs for the version you are actually targeting.

## Obtain Reference Data Yourself

WoW client-state dumps and shipped UI source are development references, not
runtime dependencies, and are not shipped in this addon.

- **Client-state dump:** [Ketho/BlizzardInterfaceResources](https://github.com/Ketho/BlizzardInterfaceResources)
- **Shipped UI source:** [Gethe/wow-ui-source](https://github.com/Gethe/wow-ui-source)

Record the client build, upstream ref, and commit for anything you rely on.
Confirm dump-derived conclusions against the shipped UI source. Never invent a
Blizzard API or assume a reference cache is current.

## Safety

- Respect combat lockdown, protected frames, taint, restricted/secret values,
  addon load order, and per-flavor capability differences.
- A caught Lua error does not undo taint. `pcall` is not taint safety.
- Prefer RGX public APIs for events, timers, databases, UI, media, combat,
  auras, tooltips, and minimap integration.

## Development-Only Material

The development `AGENTS.md`, reference cache, graphs, and CI tooling are not
part of the player package. If you need them, use the framework source
repository rather than the installed addon.
