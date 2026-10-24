#!/usr/bin/env node
// First runtime harness for modules/combat: drives the combat-log dispatch
// (COMBAT_LOG_EVENT_UNFILTERED) with a mock CombatLogGetCurrentEventInfo,
// proves the heal payload maps overheal (not absorbed) into OnPlayerHealed,
// and asserts the payload is captured exactly once per event.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const lua = await Lua.create();
try {
  Object.assign(lua.ctx, {
    __combatSource: readFileSync(join(ROOT, "modules", "combat", "combat.lua"), "utf8"),
  });

  lua.doStringSync(`
    -- ── RGX stand-in: capture registrations, no real event system.
    local events = {}
    RGX = {
      _events = events,
      RegisterModule = function() end,
      Debug = function() end,
      Error = function() end,
      HasCapability = function(_, name) return name == "combatLogEvent" end,
      RegisterEvent = function(_, event, handler)
        events[event] = handler
        return true
      end,
      RegisterUnitEvent = function() return true end,
      After = function() end,
    }
    _G.RGXFramework = RGX

    UnitGUID = function(unit) if unit == "player" then return "Player-1234" end return nil end
    InCombatLockdown = function() return false end
    UnitAffectingCombat = function() return false end
    GetTime = function() return 1000 end
    COMBATLOG_OBJECT_TYPE_PLAYER = 0x00000400

    -- Lua 5.1 has no bit library.
    bit = bit or {}
    function bit.band(a, b)
      local result, place = 0, 1
      while a > 0 and b > 0 do
        if a % 2 == 1 and b % 2 == 1 then result = result + place end
        a = math.floor(a / 2)
        b = math.floor(b / 2)
        place = place * 2
      end
      return result
    end

    -- ── Mock combat log payload.
    local payload = {}
    local callCount = 0
    function CombatLogGetCurrentEventInfo()
      callCount = callCount + 1
      return unpack(payload)
    end

    local function loadCombat()
      local chunk, err = loadstring(__combatSource, "@modules/combat/combat.lua")
      assert(chunk, err)
      chunk("RGX-Framework", RGX)
    end
    loadCombat()
    local Combat = _G.RGXCombat
    assert(Combat, "combat module did not register its global")
    Combat:Init()
    assert(events.COMBAT_LOG_EVENT_UNFILTERED, "Init must register the combat-log event")

    local checks = 0
    local function check(cond, msg)
      if not cond then error("CHECK FAILED: " .. msg, 2) end
      checks = checks + 1
    end

    local function setPayload(...)
      payload = { ... }
      callCount = 0
    end

    -- Base payload: 1 ts, 2 subEvent, 3 hideCaster, 4 sourceGUID,
    -- 5 sourceName, 6 sourceFlags, 7 sourceRaidFlags, 8 destGUID,
    -- 9 destName, 10 destFlags, 11 destRaidFlags, then subevent fields.
    -- The tail varargs sit in the final argument position so they expand.
    local function base(subEvent, sourceGUID, destGUID, ...)
      setPayload(0, subEvent, false, sourceGUID, "Source", 0x0400, 0,
                 destGUID, "Dest", 0x0400, 0, ...)
    end

    -- ── 1: heal payload — overheal reaches OnPlayerHealed, absorbed does not.
    local healed = {}
    Combat:OnPlayerHealed(function(amount, spellName, overheal)
      healed[#healed + 1] = { amount, spellName, overheal }
    end)

    Combat._inCombat = true
    base("SPELL_HEAL", "Healer-1", "Player-1234",
      1234, "Healing Wave", 1, 1000, 400, 50, false)
    events.COMBAT_LOG_EVENT_UNFILTERED()
    check(#healed == 1, "SPELL_HEAL to player must fire OnPlayerHealed once, got " .. #healed)
    check(healed[1][1] == 1000, "heal amount must be 1000, got " .. tostring(healed[1][1]))
    check(healed[1][2] == "Healing Wave", "heal spell name must pass through")
    check(healed[1][3] == 400,
      "overheal must be the overheal field (400), got " .. tostring(healed[1][3])
      .. " (the old code passed the absorbed amount here)")
    check(callCount == 1,
      "payload must be captured exactly once per event, got " .. callCount .. " calls")

    -- ── 2: spell damage to the player.
    local damaged = {}
    Combat:OnPlayerDamaged(function(amount, spellName)
      damaged[#damaged + 1] = { amount, spellName }
    end)
    base("SPELL_DAMAGE", "Boss-9", "Player-1234",
      555, "Fireball", 4, 250, 0, 2, 0, 10, false)
    events.COMBAT_LOG_EVENT_UNFILTERED()
    check(#damaged == 1 and damaged[1][1] == 250 and damaged[1][2] == "Fireball",
      "SPELL_DAMAGE must fire OnPlayerDamaged(250, Fireball)")
    check(callCount == 1, "damage dispatch must also capture the payload once, got " .. callCount)

    -- ── 3: swing damage to the player reads index 12 and reports Melee.
    base("SWING_DAMAGE", "Boss-9", "Player-1234",
      80, 0, 1, 0, 0, 5, false)
    events.COMBAT_LOG_EVENT_UNFILTERED()
    check(#damaged == 2 and damaged[2][1] == 80 and damaged[2][2] == "Melee",
      "SWING_DAMAGE must fire OnPlayerDamaged(80, Melee)")

    -- ── 4: damage to another unit never reaches player callbacks.
    base("SPELL_DAMAGE", "Boss-9", "Victim-7",
      555, "Fireball", 4, 999, 0, 2, 0, 10, false)
    events.COMBAT_LOG_EVENT_UNFILTERED()
    check(#damaged == 2, "damage to a non-player must not fire OnPlayerDamaged")

    -- ── 5: player crits fire OnCrit; player crit heals fire OnCritHeal.
    local crits, critHeals = {}, {}
    Combat:OnCrit(function(amount, spellName, isSwing) crits[#crits + 1] = { amount, spellName, isSwing } end)
    Combat:OnCritHeal(function(amount, spellName) critHeals[#critHeals + 1] = { amount, spellName } end)
    base("SPELL_DAMAGE", "Player-1234", "Boss-9",
      555, "Pyroblast", 4, 3000, 0, 2, 0, 0, 10, true)
    events.COMBAT_LOG_EVENT_UNFILTERED()
    check(#crits == 1 and crits[1][1] == 3000 and crits[1][2] == "Pyroblast" and crits[1][3] == false,
      "player spell crit must fire OnCrit(3000, Pyroblast, false)")
    base("SWING_DAMAGE", "Player-1234", "Boss-9",
      900, 0, 1, 0, 0, 5, true)
    events.COMBAT_LOG_EVENT_UNFILTERED()
    check(#crits == 2 and crits[2][2] == "Melee" and crits[2][3] == true,
      "player swing crit must fire OnCrit(_, Melee, true)")
    base("SPELL_HEAL", "Player-1234", "Player-1234",
      1234, "Regrowth", 8, 2000, 0, 0, true)
    events.COMBAT_LOG_EVENT_UNFILTERED()
    check(#critHeals == 1 and critHeals[1][1] == 2000 and critHeals[1][2] == "Regrowth",
      "player critical heal must fire OnCritHeal(2000, Regrowth)")

    -- ── 6: killing blow by the player fires OnKill with the victim info.
    local kills = {}
    Combat:OnKill(function(name, guid, isPlayer) kills[#kills + 1] = { name, guid, isPlayer } end)
    base("UNIT_DIED", "Player-1234", "Victim-7")
    events.COMBAT_LOG_EVENT_UNFILTERED()
    check(#kills == 1 and kills[1][2] == "Victim-7" and kills[1][3] == true,
      "player UNIT_DIED must fire OnKill with the victim guid and player flag; got "
      .. tostring(kills[1] and kills[1][2]) .. "/" .. tostring(kills[1] and kills[1][3]))

    _G.__rgxCombatCheckCount = checks
    _G.__rgxCombatTestResult = string.format(
      "COMBAT RUNTIME OK  combat-log dispatch, heal overheal, single capture (%d checks, Lua %s)",
      checks, tostring(_VERSION))
  `);

  const count = lua.ctx.__rgxCombatCheckCount ?? 0;
  if (count < 12) throw new Error(`combat harness ran too few checks: ${count}`);
  console.log(lua.ctx.__rgxCombatTestResult);
} finally {
  lua.global.close();
}
