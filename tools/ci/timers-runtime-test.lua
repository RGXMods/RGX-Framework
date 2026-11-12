-- Runtime scenarios for the RGXTimers bar module. Executed by
-- tools/ci/timers-runtime-check.mjs, which has already installed a minimal RGX
-- stand-in and loaded libraries/timers/timers.lua as the global `RGXTimers`.
--
-- Covers the acceptance criteria for issue #94 (LibCandyBar replacement):
--   1. module registers as RGXTimers with category "library"
--   2. New returns a hidden frame-based bar whose frame methods work
--   3. the realmgx-guides call sites round-trip: SetDuration, SetLabel,
--      SetIcon, SetColor, SetTexture, SetHeight, SetScript, exp
--   4. countdown completion fires onComplete once, never onCancel, and hides
--   5. Stop mid-run fires onCancel once; Stop on an idle bar only hides
--   6. progress mode fills from 0 to duration
--   7. SetValue clamps, CancelAll stops every running bar
--   8. Start requires a duration and re-arms the expiry on repeat calls

local pass, fail = 0, 0

local function scenario(name, fn)
  local ok, err = pcall(fn)
  if ok then
    pass = pass + 1
    print("PASS " .. name)
  else
    fail = fail + 1
    print("FAIL " .. name .. ": " .. tostring(err))
  end
end

local Timers = _G.RGXTimers
assert(Timers, "RGXTimers did not register as a global")

scenario("module registers as a library module with New and CancelAll", function()
  assert(Timers.name == "timers", "module name should be timers")
  assert(Timers.category == "library", "timers is a library module")
  assert(type(Timers.New) == "function", "New should exist")
  assert(type(Timers.CancelAll) == "function", "CancelAll should exist")
end)

scenario("New returns a hidden frame-based bar with frame methods available", function()
  __rgxTimersReset()
  local bar = Timers:New("Interface\\textures\\bar", 100, 16)
  assert(type(bar) == "table", "New should return the bar frame")
  assert(bar:IsShown() == false, "new bars start hidden")
  assert(type(bar.SetPoint) == "function", "frame methods should be reachable")
  assert(type(bar.SetScript) == "function", "SetScript should be reachable")
  assert(type(bar.SetScale) == "function", "SetScale should be reachable")
  assert(type(bar.ClearAllPoints) == "function", "ClearAllPoints should be reachable")
  assert(bar:IsRunning() == false, "bars start idle")
  assert(bar:GetDuration() == 0, "bars start with no duration")
  assert(bar:GetValue() == 0, "bars start at zero")
  assert(bar:IsCountdown() == true, "countdown is the default mode")
end)

scenario("LibCandyBar-style configure and Start exposes exp and running state", function()
  __rgxTimersReset()
  local bar = Timers:New("bar.tga", 100, 16)
  local hidden = 0
  bar:SetScript("OnHide", function() hidden = hidden + 1 end)
  bar:SetDuration(5)
  bar:SetLabel("Flight")
  bar:SetIcon("icon.tga")
  bar:SetColor(1, 0.5, 0, 1)
  bar:SetTexture("other.tga")
  bar:SetHeight(20)

  assert(bar:GetDuration() == 5, "duration should round-trip")
  assert(bar.remaining == 5, "remaining should mirror duration")
  assert(bar:GetLabel() == "Flight", "label should round-trip")
  assert(bar.statusBar.color[2] == 0.5, "color should apply to the status bar")
  assert(bar.statusBar.statusBarTexture == "other.tga", "texture should apply")
  assert(bar.height == 20, "SetHeight should resize the frame")
  assert(bar.icon.width == 20 and bar.icon.height == 20, "icon should stay square")
  assert(bar.icon:IsShown() == true, "SetIcon should show the icon")

  local started = bar:Start()
  assert(started == true, "Start should succeed with a duration")
  assert(bar:IsRunning() == true, "bar should be running")
  assert(bar:IsShown() == true, "Start should show the bar")
  assert(bar.exp == bar.start + 5, "exp should stamp the absolute expiry")
  assert(bar.value == 5, "countdown bars start full")

  __rgxTimersTick(10) -- 1 second on the shared clock
  assert(bar.exp == 5, "exp should stay absolute, got " .. tostring(bar.exp))
  assert(bar.value > 3.9 and bar.value < 4.1,
    "value should drain with the clock, got " .. tostring(bar.value))
  assert(hidden == 0, "running bars should not fire OnHide")
end)

scenario("countdown completes: onComplete once, onCancel never, bar hides", function()
  __rgxTimersReset()
  local bar = Timers:New()
  local completes, cancels, hides = 0, 0, 0
  bar:SetScript("OnHide", function() hides = hides + 1 end)
  bar:SetOnComplete(function() completes = completes + 1 end)
  bar:SetOnCancel(function() cancels = cancels + 1 end)
  bar:SetDuration(0.5)
  bar:Start()

  __rgxTimersTick(4) -- 0.4s: still running
  assert(completes == 0 and bar:IsRunning(), "bar should still run before expiry")

  __rgxTimersTick(2) -- 0.6s: complete
  assert(completes == 1, "onComplete should fire exactly once")
  assert(cancels == 0, "completion must not fire onCancel")
  assert(bar:IsRunning() == false, "completed bars stop running")
  assert(bar:IsShown() == false, "completion hides the bar")
  assert(hides == 1, "OnHide should run for pooled consumers")
  assert(bar.value == 0, "completed countdown bars rest at zero")
  assert(__rgxTimersActiveCount() == 0, "the updater timer should be cancelled")
end)

scenario("Stop fires onCancel once; Stop on an idle bar only hides", function()
  __rgxTimersReset()
  local bar = Timers:New()
  local completes, cancels = 0, 0
  bar:SetOnComplete(function() completes = completes + 1 end)
  bar:SetOnCancel(function() cancels = cancels + 1 end)
  bar:SetDuration(10)
  bar:Start()
  __rgxTimersTick(2)

  bar:Stop()
  assert(cancels == 1, "Stop should fire onCancel once")
  assert(completes == 0, "Stop must not fire onComplete")
  assert(bar:IsRunning() == false, "stopped bars are idle")
  assert(bar:IsShown() == false, "Stop hides the bar")
  assert(__rgxTimersActiveCount() == 0, "Stop should cancel the updater")

  bar:Show()
  assert(bar:IsShown() == true, "Show should reveal the bar")
  bar:Stop()
  assert(cancels == 1, "Stop on an idle bar must not fire callbacks again")
  assert(bar:IsShown() == false, "Stop hides idle bars for pool cleanup")
end)

scenario("progress mode fills from zero to duration", function()
  __rgxTimersReset()
  local bar = Timers:New(nil, 100, 16)
  assert(bar:SetFill(true) == bar, "SetFill should be chainable")
  assert(bar:IsFill() == true, "SetFill(true) selects progress mode")
  assert(bar:IsCountdown() == false, "progress mode is not countdown")
  bar:SetDuration(1)
  bar:Start()
  assert(bar.value == 0, "progress bars start empty")

  __rgxTimersTick(5)
  local mid = bar.value
  assert(mid > 0.4 and mid < 0.6, "progress should fill steadily, got " .. tostring(mid))

  __rgxTimersTick(6)
  assert(bar.value == 1, "progress bars end full")
  assert(bar:IsRunning() == false, "progress bars stop on completion")

  bar:SetCountdown(true)
  assert(bar:IsCountdown() == true and bar:IsFill() == false, "SetCountdown switches back")
end)

scenario("SetValue clamps to the configured range", function()
  __rgxTimersReset()
  local bar = Timers:New()
  bar:SetDuration(10)
  bar:SetValue(25)
  assert(bar:GetValue() == 10, "values above duration clamp down")
  bar:SetValue(-5)
  assert(bar:GetValue() == 0, "negative values clamp to zero")
  bar:SetValue(4)
  assert(bar:GetValue() == 4, "in-range values pass through")
end)

scenario("CancelAll stops every running bar", function()
  __rgxTimersReset()
  Timers:CancelAll() -- clear bars left running by earlier scenarios
  local first = Timers:New()
  local second = Timers:New()
  for _, bar in ipairs({ first, second }) do
    bar:SetDuration(30)
    bar:Start()
  end
  assert(__rgxTimersActiveCount() == 2, "both bars should have an updater")

  local cancelled = Timers:CancelAll()
  assert(cancelled == 2, "CancelAll should report two bars, got " .. tostring(cancelled))
  assert(first:IsRunning() == false and second:IsRunning() == false, "bars should stop")
  assert(__rgxTimersActiveCount() == 0, "CancelAll should cancel every updater")
end)

scenario("Start requires a duration and repeat Start re-arms a single updater", function()
  __rgxTimersReset()
  local bar = Timers:New()
  assert(bar:Start() == false, "no duration means no start")
  assert(bar:IsRunning() == false, "failed starts leave the bar idle")

  bar:SetDuration(2)
  bar:Start()
  __rgxTimersTick(5) -- 0.5s
  bar:SetDuration(10)
  assert(bar.exp == __rgxTimersClock() + 10,
    "mid-run duration changes should re-arm the expiry, got " .. tostring(bar.exp))
  assert(bar.value == 10, "mid-run duration changes reset the displayed value")

  bar:Start()
  assert(__rgxTimersActiveCount() == 1, "repeat Start should leave a single updater")
  bar:Stop()
  assert(__rgxTimersActiveCount() == 0, "Stop clears the re-armed updater")
end)

scenario("label and time visibility toggles", function()
  __rgxTimersReset()
  local bar = Timers:New()
  bar:SetTimeVisible(false)
  assert(bar.time:IsShown() == false, "time text should hide")
  bar:SetTimeVisible(true)
  assert(bar.time:IsShown() == true, "time text should show")
  bar:SetLabelVisible(false)
  assert(bar.label:IsShown() == false, "label should hide")
  bar:SetLabelVisible(true)
  assert(bar.label:IsShown() == true, "label should show")
end)

scenario("every bar gets a distinct updater label", function()
  __rgxTimersReset()
  local first = Timers:New()
  local second = Timers:New()
  first:SetDuration(5)
  second:SetDuration(5)
  first:Start()
  second:Start()
  local labels = __rgxTimersLabels()
  assert(labels ~= "", "running bars should register labelled updaters")
  assert(labels:find("RGXTimersBar", 1, true) ~= nil,
    "updater labels should be RGXTimers-branded, got " .. labels)
  assert(labels:find(",", 1, true) ~= nil, "two bars must not share one label, got " .. labels)
  first:Stop()
  second:Stop()
end)

local function render()
  return string.format(
    "RGXTimers harness: %d passed, %d failed\nRESULT %s",
    pass, fail, (fail == 0 and "PASSED" or "FAILED")
  )
end

__rgxTimersTestResult = render()
