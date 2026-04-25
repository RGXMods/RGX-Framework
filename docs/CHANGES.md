# v1.5.2 - 2026-04-25

## Options — Auto-Layout (add helper)

Tab content functions now receive an `add` helper instead of a raw frame. Widgets
stack vertically automatically — no `SetPoint`, no `storage =`, no `key =` verbosity.

```lua
{ text = "General", content = function(add)
    add:Toggle("Enable",    db, "enabled")
    add:Slider("Volume",    db, "volume",   0, 100)
    add:Color("Bar Color",  db, "barColor")
    add:Section("Advanced")
    add:Text("Some note")
end }
```

The raw frame is still accessible as `add._frame` for advanced use.

Methods: `Toggle(label, db, key)`, `Slider(label, db, key, min, max)`,
`Color(label, db, key)`, `Section(title)`, `Text(text)`.
