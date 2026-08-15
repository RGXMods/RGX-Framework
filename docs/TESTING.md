# Testing — RGX-Hello

[RGX-Hello](https://github.com/DonnieDice/RGX-Hello) is two things in one install:

1. **The reference addon** — `data/core.lua` is the canonical hello-world: the smallest complete RGX addon, written in the declarative `RGXAddon` style you should copy when starting your own.
2. **The framework's in-game test suite** — `data/visualtest.lua` exercises every user-facing framework module through the manual API, and doubles as the reference for going beyond the declarative surface.

## Commands

| Command | Opens |
|---------|-------|
| `/rgxhello` | RGX-Hello's own options panel (the hello-world addon) |
| `/rgxvisual` or `/rgxviz` | The full test suite |
| `/rgxcolor` or `/rgxcp` | The color picker directly |

## Suite coverage

| Tab | Framework features exercised |
|-----|------------------------------|
| Colors | `RGXColorPicker` (SV box, hue bar, HEX/RGB, presets), `UI:CreateColorPicker` swatches + Reset |
| Controls | `UI:CreateToggle` / `CreateSlider` / `CreateVolumeSlider`, reset buttons, label word-wrap |
| Dropdowns | `RGXDropdowns:CreateNestedDropdown` (groups, separators, checked state) |
| Media | `RGXFonts` font dropdown, `RGXTextures` statusbar textures |
| Tooltip | `Tip:Attach` builder, manual `Show`/`Hide`, `HookNative("item")` injection |
| Auras | Accessible-only player/target scans, `WatchUnit` + `OnApplied`/`OnUpdated`/`OnRemoved`, phase counter snapshots, restricted-target suppression, unsubscribe |
| Minimap | `MM:Create` (icon, tooltip, drag, persistent angle), `Toggle`/`IsShown` |
| Design | `RGX:Font` one-call styling, `RGXDesign` primitives, theme tokens |
| System | declarative `every` self-cancellation, `RGX:After`, `RGX:Every`, `RGX:CancelTimer` |

Sound is intentionally untested here — the sound module is a per-addon registry that [BLU](https://github.com/DonnieDice/BLU) exercises in production, which is a more honest test than a synthetic registration.

## The standing pattern

When a framework module ships or changes, its test tab lands in RGX-Hello **in the same cycle**. Contract-side, the loop closes from the other direction too: the framework's [[RGX-MCP]] end-to-end test validates and audits RGX-Hello on every run.

CI also executes focused framework behavior in a real Lua 5.1 VM.
`tools/ci/declarative-every-runtime-test.lua` verifies strict validation before
resource registration, ADDON_LOADED setup ordering, deterministic dispatch,
owner/name metadata, self-cancellation, duplicate rejection, and callback
failure isolation with 166 checks.

`tools/ci/aura-runtime-test.lua` adds 86 restricted-boundary checks: predicate
precedence, poison-table access ordering, index/instance preflight, event-unit
filtering/copying, cache invalidation, reentrant callback transactions, callback
suppression/isolation, and current secrecy rechecks. Instrumented Lua values
prove ordering but cannot emulate WoW taint or engine secret values; the Retail
RGX-Hello check remains mandatory.

### Retail restricted-aura acceptance

Use Retail `12.1.0.69283`, record the commit and Framework ZIP SHA-256, enable
`scriptErrors 1` and `taintLog 2`, then follow the Auras-tab procedure in
[[Auras]]. The scan must report restriction `ACTIVE`; observing only combat is
insufficient. Both watches must register, and accessible setup must exercise all
three callback counters plus a target callback. Use **Snapshot Aura Counters**
immediately before and after a visible restricted target aura change; all three
values must remain equal. After restrictions end, snapshot after the first
controlled event and use a second if the first performed the documented silent
rebuild; recovery must advance a counter by the second snapshot. Stop the log,
induce one more change and snapshot unchanged totals to prove unsubscribe,
then record Lua-error output, blocked-action output, and `_retail_/Logs/taint.log`
on #36.
