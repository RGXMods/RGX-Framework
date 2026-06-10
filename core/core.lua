--[[
    RGX-Framework - Core Library

    A modular framework providing fonts, colors, textures, events, timers,
    and UI controls for WoW addons.

    Quick start:
        ## RequiredDeps: RGX-Framework

        local RGX = _G.RGXFramework

        -- Module shortcuts
        local Fonts      = RGX:GetFonts()
        local Colors     = RGX:GetColors()
        local Textures   = RGX:GetTextures()
        local Drops      = RGX:GetDropdowns()
        local UI         = RGX:GetUI()
        local PetBattles = RGX:GetPetBattles()

        -- Pet battle callbacks
        PetBattles:OnLevelUp(function(petID, petSlot, newLevel, oldLevel) end)
        PetBattles:OnCapture(function(petID, petSlot) end)
        PetBattles:OnBattleStart(function() end)
        PetBattles:OnBattleEnd(function() end)

        -- Generic getter (normalizes name)
        local mod = RGX:GetModule("fonts")

        -- Hard dependency (logs error if missing)
        local mod = RGX:RequireModule("fonts")

        -- Events / messages
        RGX:RegisterEvent("PLAYER_LOGIN", myHandler)
        RGX:SendMessage("MY_ADDON_READY", data)

        -- Timers
        RGX:After(1.0, function() print("one second later") end)
        local ticker = RGX:Every(5.0, myCallback)
        RGX:CancelTimer(ticker)

        -- Slash commands
        RGX:RegisterSlashCommand("mycommand", function(msg) end, "MYADDON")
--]]

local addonName, RGX = ...
_G.RGXFramework = RGX

local function GetAddOnMetadataCompat(name, field)
    if C_AddOns and type(C_AddOns.GetAddOnMetadata) == "function" then
        return C_AddOns.GetAddOnMetadata(name, field)
    end

    if type(GetAddOnMetadata) == "function" then
        return GetAddOnMetadata(name, field)
    end

    return nil
end

local function NormalizeModuleName(name)
    if type(name) ~= "string" or name == "" then
        return nil
    end

    return string.lower(name)
end

RGX.version = GetAddOnMetadataCompat(addonName, "Version") or "1.0.0"
RGX.debugMode = false

-- Module storage
RGX.modules = {}
RGX.loadedModules = {}
RGX.moduleAliases = {
  fonts = "RGXFonts",
  colors = "RGXColors",
  textures = "RGXTextures",
  dropdowns = "RGXDropdowns",
  ui = "RGXUI",
  colorpicker = "RGXColorPicker",
  minimap = "RGXMinimap",
  petbattles = "RGXPetBattles",
  sharedmedia = "RGXSharedMedia",
  design = "RGXDesign",
  combat = "RGXCombat",
  reputation = "RGXReputation",
  databroker = "RGXDataBroker",
  sound = "RGXSound",
  collectibles = "RGXCollectibles",
  loot = "RGXLoot",
  achievement = "RGXAchievement",
  levelup = "RGXLevelUp",
  quest = "RGXQuest",
  honor = "RGXHonor",
  delves = "RGXDelves",
  housing = "RGXHousing",
  tradingpost = "RGXTradingPost",
  prey = "RGXPrey",
}

local function ResolveModuleAlias(self, normalizedName)
    local alias = self.moduleAliases and self.moduleAliases[normalizedName]
    if type(alias) ~= "string" then
        return nil
    end

    local module = rawget(_G, alias)
    if type(module) ~= "table" then
        return nil
    end

    self.modules[normalizedName] = module
    self.loadedModules[normalizedName] = true
    return module
end

-- Module management
function RGX:RegisterModule(name, module, opts)
    local normalizedName = NormalizeModuleName(name)
    if not normalizedName then return false end
    if type(module) ~= "table" then return false end
    if self.modules[normalizedName] and self.modules[normalizedName] ~= module then return false end

    module.name = module.name or normalizedName
    module.framework = self

    self.modules[normalizedName] = module
    self.loadedModules[normalizedName] = true

    local globalAlias = type(opts) == "table" and opts.global or self.moduleAliases[normalizedName]
    if type(globalAlias) == "string" and rawget(_G, globalAlias) == nil then
        _G[globalAlias] = module
    end

    return true
end

function RGX:GetModule(name)
    local normalizedName = NormalizeModuleName(name)
    if not normalizedName then
        return nil
    end

    return self.modules[normalizedName] or ResolveModuleAlias(self, normalizedName)
end

function RGX:RequireModule(name)
    local module = self:GetModule(name)
    if not module then
        local msg = string.format("[RGX] RequireModule: '%s' not loaded", tostring(name))
        if type(_G.geterrorhandler) == "function" then
            _G.geterrorhandler()(msg)
        else
            print("|cFFFF4444" .. msg .. "|r")
        end
    end
    return module
end

-- Module shortcuts
function RGX:GetFonts()       return self:GetModule("fonts")       end
function RGX:GetColors()      return self:GetModule("colors")      end
function RGX:GetTextures()    return self:GetModule("textures")    end
function RGX:GetDropdowns()   return self:GetModule("dropdowns")   end
function RGX:GetUI()          return self:GetModule("ui")          end
function RGX:GetColorPicker() return self:GetModule("colorpicker") end
function RGX:GetMinimap()      return self:GetModule("minimap")      end
function RGX:GetPetBattles()   return self:GetModule("petbattles")   end
function RGX:GetSharedMedia()  return self:GetModule("sharedmedia")  end
function RGX:GetDesign()       return self:GetModule("design")       end
function RGX:GetCombat()       return self:GetModule("combat")       end
function RGX:GetReputation()   return self:GetModule("reputation")   end
function RGX:GetDataBroker() return self:GetModule("databroker") end
function RGX:GetSound()        return self:GetModule("sound")        end
function RGX:GetCollectibles() return self:GetModule("collectibles") end
function RGX:GetLoot()         return self:GetModule("loot")         end
function RGX:GetAchievement()  return self:GetModule("achievement")  end
function RGX:GetLevelUp()      return self:GetModule("levelup")      end
function RGX:GetQuest()        return self:GetModule("quest")        end
function RGX:GetHonor()        return self:GetModule("honor")        end
function RGX:GetDelves()       return self:GetModule("delves")       end
function RGX:GetHousing()      return self:GetModule("housing")      end
function RGX:GetTradingPost()  return self:GetModule("tradingpost")  end
function RGX:GetPrey()         return self:GetModule("prey")         end

function RGX:SetTheme(config)
    local Design = self:GetDesign()
    if Design and type(Design.SetTheme) == "function" then
        Design:SetTheme(config)
    end
end

function RGX:SetHighlightColor(color, accent)
    local Design = self:GetDesign()
    if Design and type(Design.SetHighlightColor) == "function" then
        Design:SetHighlightColor(color, accent)
    end
end

-- One-call sound playback: looks up path from RGXSharedMedia and plays it.
-- RGX:PlaySound("mysoundpack:Kill Shot")
-- RGX:PlaySound("mysoundpack:Kill Shot", "SFX")
function RGX:PlaySound(id, channel)
    local SM = self:GetModule("sharedmedia")
    if not SM then return false end
    local path = SM:GetPath("sound", id)
    if not path then return false end
    return PlaySoundFile(path, channel or "Master")
end

function RGX:IsModuleLoaded(name)
    local normalizedName = NormalizeModuleName(name)
    if not normalizedName then
        return false
    end

    return self.loadedModules[normalizedName] == true or ResolveModuleAlias(self, normalizedName) ~= nil
end

function RGX:GetLoadedModules()
    local list = {}
    for name in pairs(self.loadedModules) do
        table.insert(list, name)
    end
    table.sort(list)
    return list
end

-- Object composition: copy all fields from source mixins into target
function RGX:Mixin(target, ...)
    for i = 1, select("#", ...) do
        local source = select(i, ...)
        if type(source) == "table" then
            for k, v in pairs(source) do
                target[k] = v
            end
        end
    end
    return target
end

-- Utilities
function RGX:Debug(...)
    if not self.debugMode then return end
    print("|cFF00FF00[RGX]|r", ...)
end

function RGX:CopyTable(orig)
    local copy
    if type(orig) == "table" then
        copy = {}
        for k, v in next, orig, nil do
            copy[self:CopyTable(k)] = self:CopyTable(v)
        end
        setmetatable(copy, self:CopyTable(getmetatable(orig)))
    else
        copy = orig
    end
    return copy
end

function RGX:Clamp(val, min, max)
    return math.min(math.max(val, min), max)
end

function RGX:Lerp(a, b, t)
    t = self:Clamp(tonumber(t) or 0, 0, 1)
    return a + (b - a) * t
end

-- Table helpers
function RGX:TableCount(tbl)
    local count = 0
    for _ in pairs(tbl) do count = count + 1 end
    return count
end

-- ── RGX.Addon — one call to set up an addon ──────────────────────────────────

--[[
        local MyAddon = RGX.Addon("MyAddon", {
            db,
            slash   = "myaddon",
            minimap = "Interface\\AddOns\\MyAddon\\icon.tga",
            brand   = "05dffa",
            welcome = "MyAddon loaded!",
            options = {
                General = {
                    { toggle = "enabled" },
                    { slider = "volume", min = 0, max = 100 },
                },
            },
        })

    What you get:
      self.name       — "MyAddon"
      self.db         — proxy (db.enabled reads/writes profile)
      self.panel      — options panel, opens via /myaddon
      self:Print(msg) — |cff05dffa[MYADDON]|r message

    opts:
      db      → true = empty defaults, or { key = val } = with defaults
      dbName  → override DB name (default: "<Name>DB")
      global  → cross-character defaults for db.global
      slash   → "cmd" or { "cmd1", "cmd2" } — registers /cmd
      minimap → "path/to/icon.tga" — simple string, not a table
      brand   → "hexcolor" — string, not a table.  Default "58be81"
      welcome → "message" — printed on ADDON_LOADED

    No onInit.  Anything beyond these basics uses modules directly:
        local Combat = RGX:GetCombat()
        Combat:OnEnter(function() ... end)
--]]
function RGX.Addon(name, opts)
    if type(name) ~= "string" or name == "" then return end
    opts = opts or {}

    local addon = opts.table or {}
    addon.name = name
    addon.framework = self

    -- Brand: hex string or default green
    local color = type(opts.brand) == "string" and opts.brand or "58be81"
    local tag = name:upper()
    local prefix = "|cff" .. color .. "[" .. tag .. "]|r "
    function addon:Print(msg)  print(prefix .. msg) end
    function addon:Warn(msg)   print("|cffffcc00" .. prefix .. msg .. "|r") end
    function addon:Error(msg)  print("|cffff4444" .. prefix .. msg .. "|r") end

    -- Deferred init
    self:RegisterEvent("ADDON_LOADED", function(_, loaded)
        if loaded ~= name then return end

        -- Database: opts.db = true  → empty defaults;  { key = val } → with defaults
        if opts.db ~= nil then
            local defaults = type(opts.db) == "table" and opts.db or {}
            local dbName = opts.dbName or (name .. "DB")
            addon.db = self:NewDatabase(dbName, defaults, {
                global = opts.global,
            })
        end

        -- Minimap: string = icon path
        if type(opts.minimap) == "string" then
            local MM = self:GetMinimap()
            if MM then
                MM:CreateButton(name, { icon = opts.minimap })
            end
        end

        -- Slash commands
        if opts.slash then
            local cmds = type(opts.slash) == "table" and opts.slash or { opts.slash }
            for _, cmd in ipairs(cmds) do
                self:RegisterSlashCommand(cmd, function(msg)
                    if addon.OpenOptions then
                        addon:OpenOptions()
                    else
                        addon:Print(name .. " v" .. (addon.tocVersion or "?"))
                    end
                end, name:upper())
            end
        end

        -- Options panel — declarative { General = { { toggle = "key" } } }
        if type(opts.options) == "table" and addon.db then
            local UI = self:GetUI()
            if UI and UI.CreateOptionsPanel then
                local tabs = {}
                for tabName, controls in pairs(opts.options) do
                    tabs[#tabs + 1] = {
                        text = tabName,
                        content = function(frame)
                            for _, ctrl in ipairs(controls) do
                                local ctype = type(ctrl) == "table" and #ctrl > 0 and ctrl[1] or ctrl
                                if type(ctrl) == "table" then
                                    if type(ctrl.toggle) == "string" then
                                        UI:CreateToggle(frame, {
                                            key = ctrl.toggle, label = ctrl.label or ctrl.toggle:gsub("^%l", string.upper),
                                            storage = addon.db, default = ctrl.default })
                                    elseif type(ctrl.slider) == "string" then
                                        UI:CreateSlider(frame, {
                                            key = ctrl.slider, label = ctrl.label or ctrl.slider:gsub("^%l", string.upper),
                                            storage = addon.db, min = ctrl.min or 0, max = ctrl.max or 100,
                                            step = ctrl.step or 1, suffix = ctrl.suffix or "" })
                                    elseif type(ctrl.section) == "string" then
                                        UI:CreateSection(frame, ctrl.section)
                                    end
                                end
                            end
                        end,
                    }
                end
                addon.panel = UI:CreateOptionsPanel({
                    addonName = name,
                    title    = opts.title or name,
                    subtitle = opts.subtitle,
                    icon     = opts.icon,
                    tabs     = tabs,
                })
                -- Slash command auto-opens the panel
                addon.OpenOptions = function() addon.panel:Open() end
            end
        end

        -- Welcome message
        if opts.welcome then
            addon:Print(opts.welcome)
        end

        self:UnregisterEvent("ADDON_LOADED", name .. "_RGXAddon")
    end, name .. "_RGXAddon")

    return addon
end
