# v1.5.0 - 2026-04-25

## API — Easier to Write, Correct to Run

### New
- `RGX:Slash("cmd", fn)` — shorthand for `RGX:RegisterSlashCommand({"cmd"}, fn)`. Single-command registration no longer requires a table.
- `RGX:DB("GlobalName")` — initialize and return a SavedVariables global. Optional second arg is a defaults table. Call inside `OnLogin` or `OnLoad` after WoW has restored saved values. Replaces the `MyAddonDB = MyAddonDB or {}` boilerplate every addon had to write.

### Fixed
- `RGX:Hook(target, method, fn)` — switched to `hooksecurefunc` internally. The previous implementation passed the original function as the first argument to the callback instead of calling it, so hooks were silently broken. The callback now receives the same arguments as the original, matching the behavior addon authors expected.

### Removed
- `RGX:Unhook` and `RGX:UnhookAll` — `hooksecurefunc` cannot be reversed; these methods were misleading. No consumer addons used them.
