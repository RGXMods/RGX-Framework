# RGXTimers

Countdown and progress bars for RGX consumers that previously embedded
LibCandyBar-3.0. Bars are real WoW frames: anchors, scripts, show/hide, scale
and every other frame method work directly on the returned bar, so pooled
guide timers keep their existing call sites.

- **Module:** `RGX:GetTimers()` (also `RGX:GetModule("timers")`)
- **Global:** `RGXTimers`
- **Category:** library (all flavors)
- **Runtime:** `libraries/timers/timers.lua`
- **Harness:** `tools/ci/timers-runtime-check.mjs`

---

## Getting the module

```lua
local Timers = RGX:GetTimers()
```

## Creating and running a bar

```lua
local bar = Timers:New(texture, width, height) -- texture/width/height optional
bar:SetDuration(45)
bar:SetLabel("Flight to Stormwind")
bar:SetIcon("Interface\\Icons\\INV_Misc_PocketWatch_02")
bar:SetColor(1, 0.82, 0, 1)
bar:SetOnComplete(function(bar) end) -- unregister from the pool
bar:SetOnCancel(function(bar) end)   -- interrupted by the consumer
bar:Start()
```

`New` returns a hidden frame. `Start` shows it; completion or `Stop` hides it
again, so consumers can keep a small pool and reuse bars by `IsShown()`.

## Module API

| Method | Description |
|---|---|
| `Timers:New(texture, width, height)` | Create a bar. Defaults: Blizzard status bar texture, `200 x 16`. The bar starts hidden. |
| `Timers:CancelAll()` | Stop every running bar; returns how many were stopped. |

## Bar API

| Method | Description |
|---|---|
| `bar:SetDuration(seconds)` | Total time. Countdown drains from it; progress fills to it. Re-arms the expiry when called mid-run. |
| `bar:GetDuration()` | Last configured duration. |
| `bar:SetLabel(text)` | Label text (left side). |
| `bar:GetLabel()` | Current label text. |
| `bar:SetIcon(texture)` | Icon texture; `nil` hides the icon. |
| `bar:SetColor(r, g, b, a)` | Status bar color, 0-1 range. |
| `bar:SetTexture(texture)` | Status bar texture; `nil` restores the default. |
| `bar:SetHeight(height)` | Frame height; keeps the icon square. |
| `bar:SetCountdown(bool)` | `true` (default) drains to zero; `false` fills to the duration. |
| `bar:SetFill(bool)` | Inverse of `SetCountdown`, LibCandyBar naming (`fill = true` means progress). |
| `bar:IsCountdown()` / `bar:IsFill()` | Current display mode. |
| `bar:SetTimeVisible(bool)` | Show/hide the remaining-time text. |
| `bar:SetLabelVisible(bool)` | Show/hide the label text. |
| `bar:SetOnComplete(callback)` | Fired once when the bar reaches its end. |
| `bar:SetOnCancel(callback)` | Fired once when `Stop()` interrupts a running bar. |
| `bar:Start()` | Start timing and show the bar. Returns `false` when no duration is set. |
| `bar:Stop()` | Stop a running bar (fires `onCancel`) and hide it. On an idle bar it only hides. |
| `bar:SetValue(value)` | Manual update, clamped to `[0, duration]`. |
| `bar:GetValue()` | Current value. |
| `bar:IsRunning()` | `true` while the bar is timing. |

Frame methods (`SetPoint`, `ClearAllPoints`, `SetScript`, `Show`, `Hide`,
`IsShown`, `SetScale`, `SetFrameStrata`, ...) resolve natively on the bar.

### Compatibility fields

Pooled consumers that sort or reconcile bars can rely on:

| Field | Meaning |
|---|---|
| `bar.start` / `bar.exp` | Absolute `GetTime()` values stamped by `Start`; `exp` is the expiry time. |
| `bar.duration` / `bar.remaining` | Configured duration. |
| `bar.value` | Current display value. |
| `bar.running` | Timer state. |
| `bar.statusBar` / `bar.icon` / `bar.label` / `bar.time` | The underlying widgets. |

## Lifecycle semantics

- Completion fires `onComplete`, never `onCancel`, and hides the bar. The
  `OnHide` script runs, so pooled consumers can unregister there.
- `Stop()` on a running bar fires `onCancel`, never `onComplete`.
- `Stop()` on an idle bar only hides it.
- One updater runs per running bar (`RGX:Every` at 0.1 s, labelled
  `RGXTimersBar<N>`); completion and `Stop` cancel it.
- Remaining time is computed from `GetTime()` against `bar.exp`, so timer
  jitter does not accumulate drift.

## LibCandyBar mapping

For the realmgx-guides port (LibCandyBar-3.0 → RGXTimers):

| LibCandyBar | RGXTimers |
|---|---|
| `candy:New(texture, width, height)` | `Timers:New(texture, width, height)` |
| `bar:SetDuration(t)` | `bar:SetDuration(t)` |
| `bar:SetLabel(text)` / `GetLabel()` | same |
| `bar:SetIcon(icon)` | same |
| `bar:SetColor(r, g, b, a)` | same |
| `bar:SetTexture(tex)` | same |
| `bar:SetHeight(h)` | same |
| `bar:SetFill(bool)` | same (progress mode) |
| `bar:Start()` / `bar:Stop()` | same |
| `bar:Hide()` / `Show()` / `IsShown()` | same (frame methods) |
| `bar:SetScript("OnHide", fn)` | same (frame method) |
| `bar.exp` | same |

`SetTimeVisible`/`SetLabelVisible` replace LibCandyBar's
`SetTimeVisibility`/`SetLabelVisibility`. Gradients, shadows, pause/resume and
time callbacks are intentionally out of scope.
