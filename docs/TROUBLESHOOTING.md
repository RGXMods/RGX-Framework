# RGX-Framework Troubleshooting

Common issues and their fixes.

---

## Font Issues

### Font not showing in dropdown

**Symptom:** A font is registered but doesn't appear in `CreateFontDropdown` or `ListAvailable()`.

**Cause:** The font is in the `unavailableFonts` blocklist in `definitions.lua`. These 10 fonts have corrupted asset files (HTML placeholders instead of actual font data).

**Fix:** Replace the font file in `media/fonts/` with a valid TTF/OTF file, then remove the font name from the `unavailableFonts` table in `modules/fonts/definitions.lua`.

### Font applies but renders as rectangles

**Symptom:** `Fonts:Apply()` succeeds but the FontString shows boxes or nothing.

**Cause:** The font file on disk is corrupted or is an HTML placeholder (the same issue as the unavailableFonts blocklist fonts). Font files in this state should be added to the `unavailableFonts` list if not already there. `SetFont` in WoW silently fails with invalid font files.

**Fix:** Same as above — replace the file with a valid font asset.

### `Fonts:GetPath()` returns nil

**Symptom:** `GetPath("MyFont")` returns nil even though the font is registered.

**Cause:** The font name may not exactly match the registry key. Font names are case-sensitive. Also, `GetPath` returns nil for unavailable (blocked) fonts.

**Fix:** Use `Fonts:List()` to see all registered names, or `Fonts:ResolveName(value)` to accept either a name or a saved path.

### Saved variable stores a path instead of a name

**Symptom:** `db.fontFamily` contains a full path like `"Interface\\AddOns\\RGX-Framework\\media\\fonts\\Inter-Regular.otf"` instead of `"Inter-Regular"`.

**Cause:** `CreateFontSettingControl` stores the font **path** in `storage[key]` by design (for direct `SetFont` use).

**Fix:** Use `Fonts:ResolveName(db.fontFamily)` to convert the path back to a canonical name, or use `Fonts:ResolvePath(db.fontFamily)` to get both the safe path and the name.

---

## Dropdown Issues

### Dropdown items count seems wrong

**Symptom:** Debug logging shows `items=6` for the font dropdown but there are many more fonts.

**Cause:** `items=6` is the count of **category group headers** (Sans, Serif, Monospace, Display, Pixel, Fantasy), not the total number of fonts. Each group contains nested family submenus with leaf font items.

**Fix:** This is expected behavior. The 6 items are top-level groups; the full font list is nested inside them.

### Dropdown doesn't close after selecting

**Symptom:** The dropdown menu stays open after clicking a font.

**Cause:** Font dropdown items are built with `keepShownOnClick = true` to allow quick browsing of multiple fonts without reopening the menu each time.

**Fix:** This is by design. Click outside the menu or press Escape to close it.

### Nested submenu doesn't open

**Symptom:** Clicking a category group in the font dropdown doesn't open the submenu.

**Cause:** The group item must have both `children` and `menuList` (same table reference) plus `hasArrow = true`. If `hasArrow` is missing, WoW's UIDropDownMenu doesn't render the arrow or enable the submenu click.

**Fix:** This is handled automatically by `BuildGroupedFontItems`. If building custom menu items, ensure `hasArrow = true` on any item with `children`.

---

## Module Issues

### `GetModule()` returns nil

**Symptom:** `RGX:GetSound()` (or any `Get*()`) returns nil.

**Cause:** As of **v2.1.0** every in-tree module is loaded by `RGX-Framework.xml`, so a nil accessor means the framework itself has not finished loading — you called `Get*()` before `OnReady`, or your addon lacks `RequiredDeps: RGX-Framework` so it loaded first.

**Fix:** Wrap module-dependent code in `RGX:OnReady(function() ... end)`, and confirm your TOC declares `## RequiredDeps: RGX-Framework`. Core-only APIs (events, timers, hooks, slash) are available immediately; module accessors need the framework fully loaded.

### `LUA_WARNING: Error loading RGX-Framework/modules/...`

**Symptom:** Login warnings like `Error loading RGX-Framework/modules/achievement/achievement.lua` (and the same for levelup, quest, honor, delves, housing, tradingpost, prey).

**Cause:** v1.9.0-era packages referenced module files that were not shipped. Those `<Script>` entries were removed during the 1.x cycle and the modules were completed and re-enabled in **v2.1.0**, where every referenced file ships in the zip.

**Fix:** Update RGX-Framework to v2.1.0 or later. If the warning persists after updating, the install is stale — delete the `Interface/AddOns/RGX-Framework` folder and reinstall.

### Module method collision

**Symptom:** Two module files define the same method (e.g. `Init`) and the second overwrites the first.

**Cause:** WoW passes the same addon table to every file via `...`. `local _, MyModule = ...` does **not** create a new table — `MyModule` is the same reference as `_G.RGXFramework`.

**Fix:** Use unique method names across split-module files. The fonts sub-modules avoid this by using specific names (`Init`, `Register`, `GetPath`, etc.) — only `init.lua` defines `Fonts:Init()`.

---

## Timer Issues

### Timer callback not firing

**Symptom:** `RGX:After(1, fn)` but `fn` never runs.

**Cause:** The timer driver (`OnUpdate` frame) only runs when active timers exist. If all timers are cancelled before the frame ticks, the driver stops.

**Fix:** Ensure the timer wasn't cancelled before it fires. Check that the callback is a function, not nil.

### Timer budget exceeded

**Symptom:** Chat message: `[RGX:timer-budget] deferred timers after N callbacks in Xms`.

**Cause:** Too many timer callbacks ran in a single frame, exceeding `timerBudget.maxPerFrame` (256) or `maxSeconds` (0.033s). The remaining timers are deferred to the next frame.

**Fix:** Reduce the number of concurrent timers or increase the budget in `RGX.timerBudget`. This is typically only an issue with many `Every(0, ...)` tickers.

### `[RGX:timer-slow] SharedMedia:QueueScan took NNNms`

**Symptom:** A `timer-slow` diagnostic in chat or in an error grabber (BugSack/Bugtraq), often at login.

**Cause:** This is a **diagnostic, not an error** — the framework reports timer callbacks that exceed their slow threshold. The media scan reads addon tables at login and legitimately takes 100–500ms; that is normal I/O, not a fault.

**Fix:** Nothing to fix on current versions. The global threshold is 250ms (raised from 50ms in v2.0.0-alpha.1) and `SharedMedia:QueueScan` has a per-label override of 500ms via `timerBudget.slowByLabel`, so routine scans no longer report. If you see this for your own timer label, either make the callback cheaper or add a `slowByLabel` override for it.

---

## Event Issues

### Event handler not firing

**Symptom:** `RGX:RegisterEvent("MY_EVENT", fn)` but the callback never runs.

**Cause:** WoW rejected the event name (unknown event), or the handler ID collided with an existing registration.

**Fix:** Check the return value of `RegisterEvent` — it returns `false` on failure. Enable `RGX.debugMode = true` to see "RegisterEvent unknown event" messages for invalid event names.

### Handler fires multiple times

**Symptom:** A registered event callback fires more than once per event.

**Cause:** The handler was registered multiple times with different IDs. Each registration creates a separate handler entry.

**Fix:** Use a consistent `id` parameter when registering, and call `UnregisterEvent(event, id)` before re-registering if you need to replace a handler.

---

## Saved Variable Issues

### Settings reset on reload

**Symptom:** Changes to addon settings are lost after `/reload`.

**Cause:** The SavedVariable name in the TOC doesn't match the global table the code is reading/writing. WoW only persists globals that match TOC `## SavedVariables:` entries.

**Fix:** Ensure the TOC `## SavedVariables:` declaration matches the table your code uses. For framework consumers, this means your own addon's TOC must declare its own SavedVariables — RGX's `RGXFrameworkDB` is for the framework itself.

---

## Combat Lockdown Issues

### "Action blocked" errors in chat

**Symptom:** Red error messages like `[RGX:blocked] event=ADDON_ACTION_BLOCKED`.

**Cause:** An addon attempted a protected action (Show, Hide, SetPoint, etc.) during combat lockdown. RGX's `Safe*` helpers and `QueueForCombat` prevent this by deferring the action.

**Fix:** Use `RGX:SafeShow(frame)` instead of `frame:Show()`, `RGX:SafeSetPoint(...)` instead of `frame:SetPoint(...)`, etc. For dropdown operations, use `RGX:SafeUIDropDownMenu_*`.

---

## Debug Mode

Enable framework debug output:

```lua
RGX.debugMode = true
-- or via slash command:
/rgx debug
```

This enables `RGX:Debug()` output including event registration errors, timer budget warnings, and module resolution diagnostics.

Available slash commands:

| Command | Description |
|---|---|
| `/rgx modules` | List loaded modules |
| `/rgx fonts` | List registered fonts |
| `/rgx debug` | Toggle debug mode |
