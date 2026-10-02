#!/usr/bin/env node
// CLI integration against real BLU Forever/SQP Forever source checkouts.
// Not a WoW emulator: event delivery and rendering are explicit seams.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const bluPath = process.argv[2];
const sqpPath = process.argv[3];
if (!bluPath || !sqpPath) throw new Error("Usage: consumer-persistence-check.mjs <BLU_Forever> <SQP_Forever>");
const read = (root, file) => readFileSync(join(root, file), "utf8");
const sqpToc = read(sqpPath, "SQP_Forever.toc");
const bluToc = read(bluPath, "BLU_Forever.toc");
assert.match(sqpToc, /^## SavedVariables: SQPForeverSettings$/m);
assert.match(bluToc, /^## SavedVariables: BLUForeverDB$/m);
const lua = await Lua.create();
try {
  Object.assign(lua.ctx, {
    __core: read(ROOT, "core/core.lua"), __db: read(ROOT, "core/systems/database.lua"),
    __bluCore: read(bluPath, "core/core.lua"), __bluConfig: read(bluPath, "core/systems/config.lua"),
    __bluDb: read(bluPath, "core/systems/database.lua"), __sqpCore: read(sqpPath, "data/core.lua"),
    __bluMinimap: read(bluPath, "core/interface/minimap.lua"),
    __sqpPlates: read(sqpPath, "data/nameplates.lua"),
  });
  lua.doStringSync(`
    function UnitName() return "TestPlayer" end
    function GetRealmName() return "TestRealm" end
    function GetLocale() return "enUS" end
    function GetBuildInfo() return "1.60.1", "69893", "test", 16001 end
    function CreateFrame()
      return { SetScript = function() end, RegisterEvent = function() end, UnregisterEvent = function() end }
    end
    C_AddOns = { GetAddOnMetadata = function(name, key)
      if key == "Version" then return "test" end
      if key == "Interface" then return "16001" end
      if key == "IconTexture" then return "Interface/Icons/INV_Misc_QuestionMark" end
      return name
    end }
    local function load(source) return assert(loadstring(source)) end
    RGX = {}
    load(__core)("RGX-Framework", RGX)
    _G.RGXFramework = RGX
    RGX._handlers = {}
    function RGX:RegisterEvent(event, fn, id) self._handlers[id or event] = { event = event, fn = fn }; return id end
    function RGX:UnregisterEvent(_, id) self._handlers[id] = nil end
    function RGX:RegisterSlashCommand() end
    local minimapCreates = 0
    function RGX:GetMinimap() return { Create = function(_, opts)
      minimapCreates = minimapCreates + 1
      return { SetVisible = function() end, storage = opts.storage }
    end } end
    function RGX:Debug() end
    function RGX:Error(message) error(message) end
    load(__db)("RGX-Framework", RGX)

    load(__bluCore)("BLU_Forever", {})
    assert(BLU.name == "BLU_Forever", "bootstrap name does not match loaded folder")
    load(__bluConfig)("BLU_Forever", {})
    load(__bluDb)("BLU_Forever", {})
    BLUForeverDB = { profiles = { Default = {}, Quiet = { soundChannel = "SFX", minimapIconEnabled = false } }, activeProfile = "Quiet" }
    local handler = assert(RGX._handlers.BLU_Forever_RGXAddon)
    handler.fn("ADDON_LOADED", "BLU_Forever")
    assert(BLU.db and BLU.db._raw == BLUForeverDB)
    assert(minimapCreates == 0, "bootstrap created a second minimap owner")
    BLU.Modules.database:Init()
    assert(BLU.db:GetActiveProfile() == "Quiet" and BLU.db.minimapIconEnabled == false)
    assert(BLU.db._defaults == BLU.Modules.config.defaults.profile)
    assert(BLU.db:CreateProfile("New"))
    assert(BLU.db.soundChannel ~= nil and BLU.db.modules ~= nil, "new profile lacks late defaults")
    BLU.db.soundChannel = "Master"
    assert(BLU.db:ResetProfile() and BLU.db.soundChannel == BLU.Modules.config.defaults.profile.soundChannel)
    assert(BLU.db:LoadProfile("Quiet") and BLU.db.soundChannel == "SFX")
    load(__bluMinimap)("BLU_Forever", {})
    BLU.Modules.minimap:Init()
    BLU.Modules.minimap:Init()
    assert(minimapCreates == 1 and BLU.Modules.minimap.button.storage.minimapIconEnabled == false)

    SQP = { L = {} }
    load(__sqpCore)("SimpleQuestPlates", SQP)
    assert(SQP.db._defaults == SQP.DEFAULTS and SQPSettings.enabled == true)
    SQPForeverSettings = { profiles = { Default = { enabled = false, offsetX = 0, scale = 1.2, killFontSize = 12, killFontOutline = "", fontSize = 24 } }, activeProfile = "Default" }
    assert(SQP.db:Adopt())
    assert(SQPSettings.enabled == false and SQPSettings.scale == 1.2 and SQPSettings.offsetX == 0)
    SQP:MigrateLegacyFontDefaults()
    assert(SQPSettings.killFontSize == 12 and SQPSettings.killFontOutline == "", "migration removed explicit font overrides")
    SQP:ResetSettings()
    SQPSettings.killColor[1] = 0.9
    assert(SQP.DEFAULTS.killColor[1] == 1, "reset aliased mutable defaults")
    SQP:ResetSettings()
    assert(SQPSettings.killColor[1] == 1)
    assert(SQPForeverSettings == SQP.db._raw)

    load(__sqpPlates)("SimpleQuestPlates", SQP)
    local group = { plays = 0, stopped = false, loop = "NONE" }
    function group:CreateAnimation()
      local animation = {}
      for _, key in ipairs({ "SetOrder", "SetFromAlpha", "SetToAlpha", "SetSmoothing" }) do animation[key] = function() end end
      function animation:SetOffset(x, y) self.y = y end
      function animation:SetDuration(value) self.duration = value end
      return animation
    end
    function group:SetLooping(value) self.loop = value end
    function group:IsPlaying() return self.playing == true end
    function group:Play() self.plays = self.plays + 1; self.playing = true end
    function group:Stop() self.stopped = true; self.playing = false end
    local qmark = {}
    for _, key in ipairs({ "SetPoint", "SetTexture", "SetTexCoord" }) do qmark[key] = function() end end
    function qmark:SetSize(x) self.size = x end
    function qmark:SetAlpha(value) self.alpha = value end
    function qmark:CreateAnimationGroup() return group end
    local frame = { CreateTexture = function() return qmark end }
    SQP:CreateQuestToast(frame, {})
    -- Live behavior: plate show replays when selected/enabled.
    SQP:SetQuestToastSelected(frame, true)
    SQPSettings.enabled, SQPSettings.showQuestMarker = true, true
    SQPSettings.toastHeight, SQPSettings.toastDuration, SQPSettings.questMarkerSize = 42, 1.8, 34
    local playsBefore = group.plays
    SQP:UpdateQuestToast(frame, true)
    assert(group.plays == playsBefore + 1 and frame.toastTranslation.y == 42 and frame.toastFade.duration == 1.8 and qmark.size == 34)
    -- Deselected/disabled hides; a later generic update does not trigger replay.
    SQP:SetQuestToastSelected(frame, false)
    assert(group.playing == false and qmark.alpha == 0)
    SQPSettings.showQuestMarker = false
    SQP:UpdateQuestToast(frame, true)
    assert(group.plays == playsBefore + 1 and qmark.alpha == 0)
  `);
  console.log("CONSUMER PERSISTENCE OK actual BLU/SQP lifecycle, defaults, migration/reset, shared toast settings and disable behavior");
} finally { lua.global.close(); }
