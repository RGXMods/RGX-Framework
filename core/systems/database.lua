--[[
RGX-Framework - Database

  Three APIs:

  Simple — RGX:DB("MyAddonDB", defaults)
      Initializes the SavedVariables global, deep-merges defaults, returns the table.
      Use for flat or simple saved-variable structures.

  Full — local db = RGX:OpenDB("MyAddonDB", opts)
      Returns a database handle with profile management, path accessors,
      serialization, and import/export dialogs.

      opts = {
          profile  = { ... default profile values ... },
          global   = { ... default global values ... },
          onSwitch = function(name, profile) ... end,
      }

  Modern — local db = RGX:NewDatabase("MyAddonDB", defaults, opts)
      Returns a proxy table with metamethod-based active-profile access.

      db.enabled         -- reads from active profile, falls back to default
      db.enabled = false -- writes to active profile
      db.global.foo      -- cross-character storage
      db:CreateProfile("Tank")
      db:LoadProfile("Tank")
      db:OnProfileChanged(fn)
--]]

local _, RGX = ...

-- ── Private helpers ───────────────────────────────────────────────────────────

local function deepMerge(target, source)
  for k, v in pairs(source) do
    if target[k] == nil then
      if type(v) == "table" then
        target[k] = {}
        deepMerge(target[k], v)
      else
        target[k] = v
      end
    elseif type(v) == "table" and type(target[k]) == "table" then
      deepMerge(target[k], v)
    end
  end
end

local function getByPath(tbl, path, default)
  if not path then return tbl end
  local value = tbl
  if type(path) == "table" then
    for _, key in ipairs(path) do
      if type(value) ~= "table" then return default end
      value = value[key]
      if value == nil then return default end
    end
  elseif type(path) == "string" then
    for key in path:gmatch("[^%.]+") do
      if type(value) ~= "table" then return default end
      value = value[key]
      if value == nil then return default end
    end
  else
    return default
  end
  return value
end

local function setByPath(tbl, path, value)
  if not path then return false end
  local keys = {}
  if type(path) == "table" then
    keys = path
  elseif type(path) == "string" then
    for key in path:gmatch("[^%.]+") do
      keys[#keys + 1] = key
    end
  else
    return false
  end
  local current = tbl
  for i = 1, #keys - 1 do
    local key = keys[i]
    if type(current[key]) ~= "table" then
      current[key] = {}
    end
    current = current[key]
  end
  current[keys[#keys]] = value
  return true
end

local PROTECTED_PROFILE = "Default"
local SERIAL_PREFIX = "RGX_DB_v1:"

-- ── RGX's own internal database ──────────────────────────────────────────────

function RGX:InitDatabase()
  _G.RGXFrameworkDB = _G.RGXFrameworkDB or {}
  self.db = _G.RGXFrameworkDB
  _G.RGXFrameworkDBChar = _G.RGXFrameworkDBChar or {}
  self.dbChar = _G.RGXFrameworkDBChar
  if type(self.defaults) == "table" and type(self.defaults.global) == "table" then
    deepMerge(self.db, self.defaults.global)
  end
  self:Debug("Database initialized")
end

function RGX:GetDB()
  return self.db
end

-- ── Simple DB helper (flat SavedVariables) ──────────────────────────────────

function RGX:DB(name, defaults)
  _G[name] = _G[name] or {}
  local db = _G[name]
  if type(defaults) == "table" then
    self:MergeTable(db, defaults)
  end
  return db
end

-- ── Version-based DB migration ──────────────────────────────────────────────

function RGX:MigrateDB(db, name, currentVersion, migrations)
  if type(currentVersion) ~= "number" or currentVersion < 1 then return end
  if type(migrations) ~= "table" then return end

  local storedVersion = db._dbVersion or 0

  if storedVersion >= currentVersion then return end

  for v = storedVersion + 1, currentVersion do
    if type(migrations[v]) == "function" then
      local ok, err = pcall(migrations[v], db)
      if not ok then
        self:Error(string.format("DB migration %s v%d failed: %s", name, v, tostring(err)))
        return
      end
    end
  end

  db._dbVersion = currentVersion
end

-- ── Serialization ───────────────────────────────────────────────────────────

function RGX:SerializeTable(t)
  if type(t) ~= "table" then return "" end
  local parts = {}
  for k, v in pairs(t) do
    if type(v) ~= "table" then
      parts[#parts + 1] = tostring(k) .. "=" .. tostring(v)
    end
  end
  table.sort(parts)
  return SERIAL_PREFIX .. table.concat(parts, ";")
end

function RGX:DeserializeTable(str)
  if type(str) ~= "string" or not str:find("^" .. SERIAL_PREFIX, 1, true) then
    return nil
  end
  local t = {}
  local body = str:sub(#SERIAL_PREFIX + 1)
  for pair in body:gmatch("([^;]+)") do
    local k, v = pair:match("([^=]+)=(.+)")
    if k and v then
      if v == "true" then
        t[k] = true
      elseif v == "false" then
        t[k] = false
      elseif tonumber(v) then
        t[k] = tonumber(v)
      else
        t[k] = v
      end
    end
  end
  return t
end

-- ── Export / Import dialogs ─────────────────────────────────────────────────

function RGX:ShowExportDialog(title, data)
  if type(StaticPopupDialogs) ~= "table" or type(StaticPopup_Show) ~= "function" then return end
  StaticPopupDialogs["RGX_EXPORT"] = {
    text = title or "Copy this data:",
    button1 = "Close",
    hasEditBox = true,
    editBoxWidth = 350,
    OnShow = function(self)
      if self.editBox then
        self.editBox:SetText(data or "")
        self.editBox:HighlightText()
      end
    end,
    timeout = 0,
    whileDead = true,
    hideOnEscape = true,
  }
  StaticPopup_Show("RGX_EXPORT")
end

function RGX:ShowImportDialog(title, onImport)
  if type(onImport) ~= "function" then return end
  if type(StaticPopupDialogs) ~= "table" or type(StaticPopup_Show) ~= "function" then return end
  StaticPopupDialogs["RGX_IMPORT"] = {
    text = title or "Paste data to import:",
    button1 = "Import",
    button2 = "Cancel",
    hasEditBox = true,
    editBoxWidth = 350,
    OnAccept = function(self)
      if self.editBox then
        onImport(self.editBox:GetText() or "")
      end
    end,
    timeout = 0,
    whileDead = true,
    hideOnEscape = true,
  }
  StaticPopup_Show("RGX_IMPORT")
end

-- ── Path accessors (operate on any table) ───────────────────────────────────

function RGX:DBGet(db, path, default)
  return getByPath(db, path, default)
end

function RGX:DBSet(db, path, value)
  return setByPath(db, path, value)
end

-- ── Full database handle (DBHandle) ─────────────────────────────────────────

local DBHandle = {}
DBHandle.__index = DBHandle

function DBHandle:GetProfile()
  return self._raw.profiles[self._raw.activeProfile]
end

function DBHandle:GetProfileName()
  return self._raw.activeProfile
end

function DBHandle:ListProfiles()
  local names = {}
  for name in pairs(self._raw.profiles) do
    names[#names + 1] = name
  end
  table.sort(names)
  return names
end

function DBHandle:_applyDefaults(profile)
  if self._profileDefaults then
    deepMerge(profile, self._profileDefaults)
  end
end

function DBHandle:_ensureDefault()
  self._raw.profiles = self._raw.profiles or {}
  if not self._raw.profiles[PROTECTED_PROFILE] then
    local tpl = {}
    self:_applyDefaults(tpl)
    tpl.currentProfile = PROTECTED_PROFILE
    self._raw.profiles[PROTECTED_PROFILE] = tpl
  end
end

function DBHandle:_switchTo(name)
  self._raw.activeProfile = name
  local profile = self._raw.profiles[name]
  profile.currentProfile = name
  self:_applyDefaults(profile)
  if self._onSwitch then
    self._onSwitch(name, profile)
  end
end

function DBHandle:CopyProfile(sourceName, targetName)
  if not targetName or targetName == "" or targetName == PROTECTED_PROFILE then return false end
  sourceName = sourceName or self._raw.activeProfile
  local source = self._raw.profiles and self._raw.profiles[sourceName]
  if not source then return false end
  local RGX = _G.RGXFramework
  local copy = RGX and RGX:DeepCopy(source) or {}
  copy.currentProfile = targetName
  self._raw.profiles[targetName] = copy
  self:_switchTo(targetName)
  return true
end

function DBHandle:CreateProfile(name)
  if not name or name == "" or name == PROTECTED_PROFILE then return false end
  self._raw.profiles = self._raw.profiles or {}
  local profile = {}
  self:_applyDefaults(profile)
  profile.currentProfile = name
  self._raw.profiles[name] = profile
  self:_switchTo(name)
  return true
end

function DBHandle:LoadProfile(name)
  if not name or not self._raw.profiles[name] then return false end
  self:_switchTo(name)
  return true
end

function DBHandle:DeleteProfile(name)
  if not name or name == PROTECTED_PROFILE then return false end
  if not self._raw.profiles or not self._raw.profiles[name] then return false end
  self._raw.profiles[name] = nil
  if self._raw.activeProfile == name then
    local fallback = PROTECTED_PROFILE
    for pname in pairs(self._raw.profiles) do
      if pname ~= PROTECTED_PROFILE then fallback = pname; break end
    end
    self:_switchTo(fallback)
  elseif self._onSwitch then
    self._onSwitch(self._raw.activeProfile, self:GetProfile())
  end
  return true
end

function DBHandle:RenameProfile(oldName, newName)
  if not oldName or not newName then return false end
  if oldName == PROTECTED_PROFILE or newName == PROTECTED_PROFILE then return false end
  if not self._raw.profiles or not self._raw.profiles[oldName] then return false end
  self._raw.profiles[newName] = self._raw.profiles[oldName]
  self._raw.profiles[oldName] = nil
  if self._raw.activeProfile == oldName then
    self._raw.activeProfile = newName
    self._raw.profiles[newName].currentProfile = newName
  end
  if self._onSwitch then
    self._onSwitch(self._raw.activeProfile, self:GetProfile())
  end
  return true
end

function DBHandle:SerializeProfile(name)
  name = name or self._raw.activeProfile
  local profile = self._raw.profiles and self._raw.profiles[name]
  if not profile then return "" end
  return RGX:SerializeTable(profile)
end

function DBHandle:DeserializeProfile(str)
  return RGX:DeserializeTable(str)
end

function DBHandle:ShowExportDialog(name)
  local data = self:SerializeProfile(name)
  RGX:ShowExportDialog("Copy profile data:", data)
end

function DBHandle:ShowImportDialog()
  RGX:ShowImportDialog("Paste profile data:", function(str)
    local profile = self:DeserializeProfile(str)
    if profile then
      local name = "Imported_" .. date("%Y%m%d_%H%M%S")
      self._raw.profiles = self._raw.profiles or {}
      self._raw.profiles[name] = profile
      self:LoadProfile(name)
    end
  end)
end

function DBHandle:Get(path, default)
  return getByPath(self:GetProfile(), path, default)
end

function DBHandle:Set(path, value)
  return setByPath(self:GetProfile(), path, value)
end

-- ── RGX:OpenDB ──────────────────────────────────────────────────────────────

function RGX:OpenDB(globalName, opts)
  opts = opts or {}
  _G[globalName] = _G[globalName] or {}
  local raw = _G[globalName]
  raw.profiles = raw.profiles or {}
  raw.global = raw.global or {}

  local handle = setmetatable({
    _raw = raw,
    _profileDefaults = opts.profile or opts.defaults,
    _onSwitch = opts.onSwitch,
  }, DBHandle)

  if type(opts.global) == "table" then
    deepMerge(raw.global, opts.global)
  end

  handle:_ensureDefault()

  local active = raw.activeProfile
  if not active or not raw.profiles[active] then
    active = PROTECTED_PROFILE
  end
  handle:_switchTo(active)

  return handle
end

-- ── RGX:NewDatabase — metamethod-based profile proxy ────────────────────────

local NewDBMeta = {}

function NewDBMeta:OnProfileChanged(callback)
  if type(callback) ~= "function" then return end
  if not self._callbacks then self._callbacks = {} end
  self._callbacks[#self._callbacks + 1] = callback
end

function NewDBMeta:ResetProfile(name)
  name = name or self._raw.activeProfile
  if name == PROTECTED_PROFILE then return false end
  local profile = self._raw.profiles and self._raw.profiles[name]
  if not profile then return false end
  for k in pairs(profile) do
    if k ~= "currentProfile" then
      profile[k] = nil
    end
  end
  if self._defaults then
    deepMerge(profile, self._defaults)
  end
  profile.currentProfile = name
  if name == self._raw.activeProfile then
    self:_notifySwitch(name, profile)
  end
  return true
end

function NewDBMeta:GetProfiles()
  return self:ListProfiles()
end

function NewDBMeta:GetActiveProfile()
  return self._raw.activeProfile
end

function NewDBMeta:_notifySwitch(name, profile)
  if self._onSwitch then
    self._onSwitch(name, profile)
  end
  if self._callbacks then
    for _, cb in ipairs(self._callbacks) do
      cb(name, profile)
    end
  end
end

NewDBMeta.__index = function(self, key)
  local method = DBHandle[key] or NewDBMeta[key]
  if method then return method end
  if key == "global" then
    if not self._raw.global then
      self._raw.global = {}
    end
    return self._raw.global
  end
  if key == "_callbacks" or key == "_raw" or key == "_defaults" or key == "_onSwitch" then
    return rawget(self, key)
  end
  local profile = self._raw.profiles and self._raw.profiles[self._raw.activeProfile]
  if profile then
    local val = profile[key]
    if val ~= nil then return val end
  end
  return self._defaults and self._defaults[key]
end

NewDBMeta.__newindex = function(self, key, value)
  if key == "global" then return end
  local profile = self._raw.profiles and self._raw.profiles[self._raw.activeProfile]
  if profile then
    profile[key] = value
  end
end

-- Override _switchTo to also fire new-style callbacks.
function DBHandle._switchTo(self, name)
  self._raw.activeProfile = name
  local profile = self._raw.profiles[name]
  profile.currentProfile = name
  self:_applyDefaults(profile)
  if self._onSwitch then
    self._onSwitch(name, profile)
  end
  if self._callbacks then
    for _, cb in ipairs(self._callbacks) do
      cb(name, profile)
    end
  end
end

function RGX:NewDatabase(globalName, defaults, opts)
  opts = opts or {}
  _G[globalName] = _G[globalName] or {}
  local raw = _G[globalName]
  raw.profiles = raw.profiles or {}
  raw.global = raw.global or {}

  local db = setmetatable({
    _raw = raw,
    _defaults = defaults or {},
    _profileDefaults = defaults or {},
    _callbacks = {},
    _onSwitch = opts.onSwitch,
  }, NewDBMeta)

  if type(opts.global) == "table" then
    deepMerge(raw.global, opts.global)
  end

  -- Ensure Default profile
  if not raw.profiles[PROTECTED_PROFILE] then
    local tpl = {}
    if defaults then
      deepMerge(tpl, defaults)
    end
    tpl.currentProfile = PROTECTED_PROFILE
    raw.profiles[PROTECTED_PROFILE] = tpl
  end

  -- Determine active profile
  local active = raw.activeProfile
  if not active or not raw.profiles[active] then
    active = PROTECTED_PROFILE
  end
  raw.activeProfile = active
  local profile = raw.profiles[active]
  if defaults then
    deepMerge(profile, defaults)
  end
  profile.currentProfile = active

  if opts.onSwitch then
    opts.onSwitch(active, profile)
  end

  return db
end
