# Sound Module

The Sound module (`RGXSound`) provides sound registration, variant playback, mute/unmute, persistence, and welcome sounds.

---

## `Sound:Register(id, opts)` → `handle`

Register a sound and get a handle object for playback and control.

### Parameters

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `id` | string | Yes | — | Unique sound identifier |
| `opts.path` | string | Yes | — | Sound file path. Use `%d` for variant placeholder. |
| `opts.name` | string | No | id | Display name |
| `opts.variants` | number | No | 0 | Number of variants (0 = single sound) |
| `opts.defaultVariant` | number | No | 1 | Default variant number |
| `opts.volume` | number | No | 1.0 | Playback volume (0-1) |
| `opts.muted` | bool | No | false | Initial mute state |
| `opts.welcome` | bool | No | false | Play on login |
| `opts.setting` | string | No | nil | Setting key for SavedVariables |
| `opts.welcomeSound` | string | No | nil | Alternate welcome sound path |

### Variant Paths

When `variants > 0`, the `path` should contain `%d` as a placeholder for the variant number:

```lua
local kill = Sound:Register("kill", {
    path = "Interface\\AddOns\\MyAddon\\Sounds\\kill_%d.ogg",
    variants = 5,
    name = "Kill Sound",
})
```

This creates paths: `kill_1.ogg`, `kill_2.ogg`, `kill_3.ogg`, `kill_4.ogg`, `kill_5.ogg`.

---

## Sound Handle API

### `handle:Play(variant)` 

Play the sound.

- If `variant` is a number: play that specific variant
- If `variant` is `"default"`: play the current default variant
- If `variant` is `"random"` or nil: play a random variant (if variants > 0)
- If no variants: play the single sound file

```lua
handle:Play()          -- random variant
handle:Play(3)         -- variant 3
handle:Play("default") -- current default variant
```

### `handle:Init()`

Initialize the sound handle. Validates the file path and applies defaults. Called automatically during registration.

### `handle:MuteDefault()` / `handle:UnmuteDefault()`

Mute or unmute the default variant:

```lua
handle:MuteDefault()
handle:UnmuteDefault()
```

### `handle:Test()`

Play the sound at full volume regardless of mute/enable state. Useful for configuration UIs.

### `handle:GetVariant()` → `number`

Get the current variant number:

```lua
local v = handle:GetVariant() -- → 3
```

### `handle:SetVariant(n)`

Set the current variant. 1-indexed. Clamped to `[1, variants]`:

```lua
handle:SetVariant(2)
```

### `handle:GetSetting()` → `string`

Get the current setting key (for SavedVariables persistence).

### `handle:SetSetting(key)`

Set the setting key. When set, the handle reads/writes its state from `_G.RGXFrameworkDB.sound[key]`.

### `handle:Enable()` / `handle:Disable()`

Enable or disable the sound. Disabled sounds do not play on `:Play()`:

```lua
handle:Disable()
handle:Enable()
```

### `handle:ShowWelcome()`

Play the welcome sound if `welcome = true` was set during registration. Called automatically by the framework on `PLAYER_LOGIN`.

### `handle:Logout()`

Save current state for next login. Called automatically by the framework on `PLAYER_LOGOUT`.

---

## Complete Example

```lua
local Sound = RGX:GetSound()

-- Register a kill sound with 5 variants
local killSound = Sound:Register("myAddon_kill", {
    path = "Interface\\AddOns\\MyAddon\\Sounds\\kill_%d.ogg",
    variants = 5,
    name = "Kill Sound",
    volume = 0.8,
    muted = false,
    setting = "killSound",
})

-- Register a single UI sound
local uiSound = Sound:Register("myAddon_click", {
    path = "Interface\\AddOns\\MyAddon\\Sounds\\click.ogg",
    name = "UI Click",
    volume = 1.0,
})

-- Register a welcome sound
local welcomeSound = Sound:Register("myAddon_welcome", {
    path = "Interface\\AddOns\\MyAddon\\Sounds\\welcome.ogg",
    name = "Welcome",
    welcome = true,
    volume = 0.5,
})

-- In combat handler
killSound:Play()  -- random variant

-- In config UI
uiSound:Test()    -- always plays, ignores mute
```

---

## Persistence

When `setting` is provided during registration:

1. On init: reads `_G.RGXFrameworkDB.sound[setting]` for saved state
2. On play/update: writes current state back to the same key
3. On logout: `handle:Logout()` ensures state is saved

Persisted data includes: variant, muted, enabled, volume.
