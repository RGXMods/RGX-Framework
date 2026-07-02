# RGX Declarative Layer & DSL — Design Vision

> **Status:** Design parking doc on the `dsl` branch. Nothing here is built yet.
> This captures the direction so we can think on it while we justify the next
> concrete framework work. Do not merge to `main` until a phase is actually
> implemented and tested.

---

## The one-line thesis

**Make authoring an addon so simple that a human writes it by hand in a minute
and an agent generates it correctly on the first try — because the surface has
almost no syntax to get wrong.**

Every rule the framework already enforces (no manual event frames, no raw
`C_Timer`, no raw `SLASH_X`, pcall-wrapped dispatch, combat-lockdown guards)
becomes *invisible* — the author declares intent, the runtime does it safely.
Easy for humans **is** easy for agents. Same goal, one surface.

---

## THE SIMPLICITY CONTRACT — frozen

This is the binding contract for the authoring surface. Every future change to
`RGX.Addon`, the docs, the Tier 5 schema, and the MCP validates against it.
**We do not renegotiate this per pass — that is why docs kept getting
rewritten. Evolution is additive-only from here.**

### The target shape (what a whole addon looks like)

```lua
-- MyAddon.lua — this is the entire addon. Line 1 is the addon.
RGXAddon "MyAddon" {
    slash   = "myaddon",                 -- optional; defaults to lowercase name
    minimap = true,                      -- true = default icon, or "path\\to\\icon.tga"
    db      = { enabled = true, volume = 80 },

    on = {
        login    = function(self) self:Print("Ready!") end,
        levelup  = function(self, level) self:Play("fanfare") end,
        ["quest.turnin"] = function(self) self:Play("questdone") end,
        ["combat.start"] = function(self) self:Hide() end,
    },

    every = {
        scan = { 30, function(self) self:Scan() end },
    },

    options = {
        columns = 2,                     -- 1 / 2 / 3 column card grid
        General = {
            "header Settings",
            "toggle enabled",            -- label inferred: "Enabled"
            "slider volume 0-100",       -- label inferred: "Volume"
            "dropdown theme dark|light|system",
        },
        About = {
            "label 'Made with RGX-Framework'",
        },
    },
}
```

No `local`, no `assert`, no `ADDON_LOADED`, no frames, no WoW event names, no
SavedVariables plumbing. The heavy machinery lives in the framework; the
author file reads like a config with behavior attached.

### The seven rules (non-negotiable)

1. **Zero boilerplate.** Line 1 of the addon file is the addon. `_G.RGXAddon`
   is a global provided by the framework — `RequiredDeps` guarantees it exists.
   Any example that opens with `local RGX = assert(...)` is documenting the
   escape hatch, not the surface.
2. **Human vocabulary, never WoW internals.** Trigger names are plain words
   (`login`, `levelup`, `quest.turnin`, `combat.start`, `pet.capture`,
   `aura.applied`). The framework — never the author — knows the WoW event
   names and which RGX module serves each trigger. If an author has to look up
   an event name on Wowpedia, the surface has failed.
3. **One line per concept.** Each option control is one string. Each trigger is
   one key. Each timer is one entry. If a common concept costs more than one
   line, the framework grows until it doesn't; author code never compensates.
4. **Infer everything inferable.** Labels from keys (`enabled` → "Enabled"),
   `dbName` from addon name (`MyAddonDB`), panel title from name, slash from
   name. Explicit values always win, but omission always works.
5. **Strings first, functions when needed.** Every string form has a table/
   function long-form for edge cases (`{ toggle = "enabled", label = "...",
   tooltip = "..." }`). The long-form is never required for the common case,
   and the à la carte imperative API remains underneath for anything the
   declarative surface doesn't cover yet.
6. **Additive forever.** Existing keys and string grammars never change
   meaning. New capability = new keys / new grammar; old addons never break,
   docs never rewrite. The Tier 5 JSON schema freezes this mechanically.
7. **Errors teach.** An unknown trigger name or malformed control string raises
   a clear error listing the valid options — the surface is self-documenting
   at the point of failure, for humans and agents alike.

### Control-string grammar (options)

```
"header 'Text'"                          section header
"label 'Text'"                           static text
"toggle <key> ['Label']"                 checkbox bound to db[key]
"slider <key> <min>-<max> [step] ['Label']"
"dropdown <key> a|b|c ['Label']"         values from the pipe list
"color <key> ['Label']"                  color swatch bound to db[key]
"font <key> ['Label']"                   db-bound font style selector
"button 'Text' <method>"                 calls addon:<method>() on click
```

Quoted `'Label'` is always optional; omitted labels are inferred from the key.
Every control binds to `addon.db` with automatic save AND restore — the
BLU/SQP slider-persistence bug class becomes impossible by construction.

### Trigger vocabulary (`on = { ... }`)

Maps 1:1 onto shipped framework modules — this table only grows:

| Trigger | Backed by |
|---|---|
| `login` | PLAYER_LOGIN |
| `levelup` | RGXLevelUp |
| `achievement`, `achievement.criteria` | RGXAchievement |
| `quest.accepted` / `quest.complete` / `quest.turnin` / `quest.progress` | RGXQuest |
| `combat.start` / `combat.stop` / `combat.kill` / `combat.died` / `combat.crit` / `combat.lowhealth` | RGXCombat |
| `pet.levelup` / `pet.capture` / `pet.battlestart` / `pet.battleend` | RGXPetBattles |
| `rep.gain` / `rep.rankup` / `rep.renown` | RGXReputation |
| `honor` | RGXHonor |
| `delve.companion` / `delve.lifelost` / `delve.lifegained` | RGXDelves |
| `housing.favor` / `housing.levelup` / `housing.rewards` / `housing.decor` | RGXHousing |
| `tradingpost.purchase` / `tradingpost.currency` | RGXTradingPost |
| `prey.start` / `prey.ambush` / `prey.capped` / `prey.complete` | RGXPrey |
| `collect.mount` / `collect.toy` / `collect.transmog` / `collect.heirloom` | RGXCollectibles |
| `loot.rare` / `loot.currency` | RGXLoot |
| `aura.applied` / `aura.removed` / `aura.updated` | RGXAuras |
| `media.updated` | RGX_SHAREDMEDIA_UPDATED |
| any `UPPER_CASE_NAME` | passed through as a raw WoW event (escape hatch) |

### What ships when

- **Today (v2.1.x):** `RGXAddon` global alias; `slash` / `minimap` / `db` /
  `options` (table-form controls) / `welcome` / `onInit`; scoped
  `addon:RegisterEvent` etc.
- **Tier 4:** `on = {}` trigger vocabulary, `every = {}`, string control
  grammar, label inference, `columns` card grid, `RGXAddon "Name" { }`
  curried-call form.
- **Tier 5:** the schema that mechanically freezes rules 1–7.

---

## The layered architecture (dependency direction matters)

```
human-written .rgx  (optional, later)
        │  compiles to
        ▼
declarative RGX Lua table   ← THE CANONICAL FOUNDATION
        │  passed to
        ▼
RGX.Addon({ ... })          ← maps intent to safe runtime calls
        │  calls
        ▼
RGX-Framework runtime       ← plain WoW Lua engine (events/timers/DB/UI/media)
        │  produces
        ▼
WoW addon behavior
```

**Hard rules on direction:**

- `RGX-Framework` (the in-game addon) stays **plain WoW Lua**. It is the engine.
- The declarative layer lives **inside** the framework (`core/systems/declarative.lua`).
- The `.rgx` file syntax (if built) compiles **to the Lua table**, never to raw low-level Lua. The Lua table is the stable intermediate target.
- The **MCP server is a separate project** (`rgx-mcp`) — it depends on RGX docs/schema/rules; the framework never depends on it. MCP is a developer/agent tool, not addon runtime.

```
rgx-mcp            depends on →  RGX docs / schema / rules
consumer addons    depend on  →  RGX-Framework
RGX-Framework      depends on →  (nothing external)
```

---

## Phase 1 — Declarative Lua table (the foundation)

Harden `RGX.Addon()` so one declarative object defines the whole addon. Still
normal Lua, but it reads like config. This is the immediate, highest-value step
because it helps humans and agents today with zero new tooling.

```lua
local RGX = assert(_G.RGXFramework, "MyAddon: RGX-Framework not loaded")

RGX.Addon("MyAddon", {
    savedVariables = "MyAddonDB",

    defaults = { profile = { enabled = true, sound = true } },

    slash = { "myaddon", "ma", handler = function(addon) addon:ToggleOptions() end },

    events = {
        PLAYER_LOGIN = function(addon) addon:Print("Loaded") end,
        UNIT_AURA = { unit = "player", handler = function(addon, _, unit) addon:ScanAuras(unit) end },
    },

    timers = { scan = { every = 5, run = function(addon) addon:Scan() end } },

    minimap = { icon = "media/logo.tga", onLeftClick = function(addon) addon:ToggleOptions() end },
})
```

The framework enforces safety underneath: `events` → `RGX:RegisterEvent` /
`RegisterUnitEvent`; `timers` → `RGX:Every`; `slash` → `RegisterSlashCommand`;
`minimap` → `RGX:CreateMinimapButton`. The author never touches the unsafe
primitives.

---

## Phase 1b — Grid/matrix options UI (declarative, card-based)

**This is the piece the current RGXUI does not have.** Options panels should be
declared as a **matrix grid**: pick a column count (1 / 2 / 3), drop config
**cards** into a flexible number of rows, and let the framework handle layout,
sizing, spacing, and anchoring.

Mental model:

```
options = {
    layout = "grid",
    columns = 3,          -- 1, 2, or 3 column matrix

    cards = {
        -- each card is a config unit; rows flow automatically,
        -- filling left-to-right across the column count
        { title = "General", span = 1, rows = {
            { toggle = "enabled", label = "Enable Addon" },
            { toggle = "sound",   label = "Play Sounds" },
        }},
        { title = "Volume", span = 1, rows = {
            { slider = "volume", min = 0, max = 100, label = "Master Volume" },
        }},
        { title = "Appearance", span = 1, rows = {
            { dropdown = "theme", label = "Theme", options = {...} },
            { color = "accent", label = "Accent Color" },
        }},
        { title = "Notes", span = 3, rows = {  -- span all 3 columns
            { label = "A full-width card spanning the whole row." },
        }},
    },
}
```

Design intent:

- **Columns are a fixed matrix** — 1/2/3 — not free-floating. Predictable, agent-generatable, visually consistent across the suite.
- **Rows are flexible** — a card holds N element-rows; cards flow into the grid and wrap by column count.
- **`span`** lets a card occupy 1..columns cells for full-width sections.
- **Each row is one config element** bound to `addon.db` automatically (toggle / slider / dropdown / color / label / button).
- The grid engine owns all `SetPoint`/`SetSize` math — combat-safe via `RGX:Safe*` where needed. Authors never position frames.

This generalizes what BLU/BPU options panels do by hand today into one declarative
grid primitive. It is also the display-layout primitive `rgx-mod` needs later
(dynamic groups are grids of display regions).

---

## Phase 2 — Schema for the declarative shape

Write the allowed table shape as a schema so agents (and the future MCP) can
validate authored addons without running WoW.

```
docs/DECLARATIVE-API.md        -- human reference for the table shape
schemas/rgx-addon.schema.json  -- machine-checkable shape (events/timers/slash/minimap/options-grid/db)
```

Lua doesn't consume JSON Schema directly, but the schema is the contract the MCP
and agents check against.

---

## Phase 3 — `rgx-mcp` (separate project, read-only first)

A standalone developer/agent tool. Reads RGX docs, schema, roadmap, and consumer
repos. Starts **read-only**: audit and report, generate patches, never commits.

Candidate tools:

```
rgx.validate_declarative_addon   -- check an addon table against the schema
rgx.audit_consumer_addon         -- find raw C_Timer / manual event frames / slash boilerplate
rgx.detect_raw_ctimer
rgx.detect_manual_event_frames
rgx.generate_lua_dsl             -- emit a declarative RGX.Addon table from intent
rgx.compile_rgx_file             -- .rgx -> Lua table
rgx.plan_next_roadmap_step
rgx.sync_docs_with_code
```

Candidate resources:

```
rgx://docs/api          rgx://rules/taint-safety
rgx://docs/roadmap      rgx://schemas/addon-dsl
rgx://schemas/options   rgx://consumer-status
```

---

## Phase 4 — `.rgx` human syntax (optional, last)

Only once the Lua declarative layer feels good. A prettier file syntax that
compiles to the canonical Lua table — **even simpler than the Lua table**, closer
to plain English config:

```
addon MyAddon
db MyAddonDB

default profile.enabled = true
default profile.sound = true

slash /myaddon /ma -> ToggleOptions

event PLAYER_LOGIN -> OnLogin
unit_event UNIT_AURA player -> ScanAuras

timer scan every 5s -> Scan

minimap icon "media/logo.tga" -> ToggleOptions

options grid 3
  card "General"
    toggle enabled "Enable Addon"
    toggle sound   "Play Sounds"
  card "Volume"
    slider volume 0..100 "Master Volume"
  card "Appearance"
    dropdown theme "Theme"
    color accent "Accent Color"
```

The compiler targets `RGX.Addon({ ... })`, not raw Lua. WoW never loads `.rgx`
files — they compile to Lua on the developer's machine (or via a dev tool), and
only the generated Lua ships. WoW's sandbox has no file I/O, so there is no
runtime interpreter in the addon.

---

## Build order & scope guard

1. **Phase 1** — declarative `RGX.Addon` table (events/timers/slash/minimap/db). Helps everything immediately.
2. **Phase 1b** — grid/matrix options UI (1/2/3-col cards, flexible rows). The missing UI primitive; also feeds rgx-mod displays.
3. **Phase 2** — schema doc + JSON schema.
4. **Phase 3** — `rgx-mcp` separate repo, read-only audits first.
5. **Phase 4** — `.rgx` syntax compiler → Lua table.

**Scope guard (unchanged from CLAUDE.md):** build what a current maintained addon
needs AND rgx-mod can leverage. The declarative layer + grid UI qualify — every
consumer addon writes events/timers/options today, and rgx-mod needs the grid as
its display-group primitive. The `.rgx` syntax and MCP are tooling around the
canonical Lua table, never the foundation.

> **Do not make the MCP the product. Do not make the custom `.rgx` syntax the
> foundation. Make the declarative RGX Lua table the foundation — MCP and `.rgx`
> are helpers around it.**
