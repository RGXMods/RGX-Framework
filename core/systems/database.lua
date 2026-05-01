--[[
RGX-Framework - Database
--]]

local _, RGX = ...

function RGX:InitDatabase()
  _G.RGXFrameworkDB = _G.RGXFrameworkDB or {}
  self.db = _G.RGXFrameworkDB

  _G.RGXFrameworkDBChar = _G.RGXFrameworkDBChar or {}
  self.dbChar = _G.RGXFrameworkDBChar

  self:MergeTable(self.db, self.defaults.global)

  self:Debug("Database initialized")
end

function RGX:GetDB()
  return self.db
end

-- Initialize a SavedVariables global and return it. Call inside OnLoad/OnLogin
-- so WoW has already restored saved values. Optional defaults table is deep-
-- merged (nested tables are recursed; existing keys are never overwritten).
-- local db = RGX:DB("MyAddonDB")
-- local db = RGX:DB("MyAddonDB", { volume = 1.0, debug = false })
-- local db = RGX:DB("MyAddonDB", { nested = { a = 1, b = 2 } })
function RGX:DB(name, defaults)
  _G[name] = _G[name] or {}
  local db = _G[name]
  if type(defaults) == "table" then
    self:MergeTable(db, defaults)
  end
  return db
end

-- Version-based DB migration.
-- Call after RGX:DB() to run ordered migration functions when the stored
-- version is older than the current version.
--
--   RGX:MigrateDB(db, "MyAddonDB", 3, {
--     [1] = function(db) db.newKey = true end,
--     [2] = function(db) db.oldKey = nil end,
--     [3] = function(db) db.nested = { a = 1 } end,
--   })
--
-- Migrations run once each from (storedVersion + 1) through currentVersion.
-- On first install (no stored version) no migrations run — defaults from
-- RGX:DB() are already applied. The stored version is updated after all
-- migrations succeed.
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
