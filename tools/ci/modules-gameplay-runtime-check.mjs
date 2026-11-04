#!/usr/bin/env node
// Runtime behavior gate for the game modules the audit found untested:
// reputation deltas/spurious events, loot first-currency-of-session gains,
// and quest progress lost to the 0.25s cooldown. Fresh VM per module.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const source = (path) => readFileSync(join(ROOT, path), "utf8");

const failures = [];
let count = 0;
async function scenario(name, script, files) {
  const lua = await Lua.create();
  try {
    for (const [key, path] of Object.entries(files)) lua.ctx[key] = source(path);
    lua.doStringSync(script);
    count++;
    console.log(`PASS ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`FAIL ${name}: ${error.message}`);
  } finally {
    lua.global.close();
  }
}

function rgxStub(lua) {
  // Minimal RGX stand-in: capture registrations, provide API seams per module.
  // The stub must run BEFORE the scenario script.
  const stub = `
    local events = {}
    RGX = {
      _events = events,
      RegisterModule = function(_, name, module) _G["RGX" .. name] = _G["RGX" .. name] or module end,
      Debug = function() end,
      Error = function() end,
      RegisterEvent = function(_, event, handler) events[event] = handler return true end,
      RegisterUnitEvent = function() return true end,
      After = function() end,
      SendMessage = function() end,
      GetModule = function() return nil end,
      API = {},
    }
    _G.RGXFramework = RGX
    local function loadModule(text, path)
      local chunk, err = loadstring(text, "@" .. path)
      assert(chunk, err)
      return chunk("RGX-Framework", RGX)
    end
  `;
  return stub + lua;
}

await scenario("reputation reports true deltas, seeds silently, splits duplicate names", rgxStub(`
  local factions = {}
  local function faction(id, name, standing, value)
    return { factionID = id, name = name, reaction = standing, currentStanding = value,
             currentReactionThreshold = 0, nextReactionThreshold = 100 }
  end
  RGX.API.GetFactionCount = function() local n = 0 for _ in pairs(factions) do n = n + 1 end return n end
  RGX.API.GetFactionDataByIndex = function(index)
    local i = 0
    for _, f in pairs(factions) do
      i = i + 1
      if i == index then return f end
    end
    return nil
  end

  loadModule(__repSource, "modules/reputation/reputation.lua")
  local Rep = _G.RGXReputation
  assert(Rep, "reputation module did not register")

  local gains, rankUps = {}, {}
  Rep:OnGain(function(name, id, amount, total) gains[#gains + 1] = { name, id, amount, total } end)
  Rep:OnRankUp(function(name, id, oldR, newR) rankUps[#rankUps + 1] = { name, id, oldR, newR } end)

  -- Seed: A id 1001 Friendly 1000; B id 1002 Hated -30000; two factions
  -- sharing the name "Guild Rep" with different ids.
  factions.a = faction(1001, "Kirin Tor", 5, 1000)
  factions.b = faction(1002, "Bloodsail", 1, -30000)
  factions.d1 = faction(2001, "Guild Rep", 5, 10)
  factions.d2 = faction(2002, "Guild Rep", 5, 500)
  Rep:Scan()
  assert(#gains == 0 and #rankUps == 0, "Scan must seed without firing events")

  -- Same-rank tick: 1000 -> 1250 fires the delta 250.
  factions.a.currentStanding = 1250
  Rep:CheckChanges()
  assert(#gains == 1 and gains[1][3] == 250 and gains[1][4] == 1250,
    "same-rank gain must fire the 250 delta, got " .. tostring(gains[1] and gains[1][3]))

  -- Rank-up crossing: reseed at Honored 9000, then cross to Revered 9100.
  -- The old code reported the absolute standing (9100) as the gain.
  factions.a.currentStanding, factions.a.reaction = 9000, 6
  Rep:Scan()
  factions.a.currentStanding, factions.a.reaction = 9100, 7
  Rep:CheckChanges()
  assert(#gains == 2 and gains[2][3] == 100,
    "rank-up gain must be the 100 delta, got " .. tostring(gains[2] and gains[2][3]))
  assert(#rankUps == 1 and rankUps[1][4] == 7 and rankUps[1][3] == 6,
    "rank-up must fire with old and new standing")

  -- Negative-scale faction gaining out of Hated: the old rank-up branch
  -- reported the absolute (-25000) and dropped the event entirely.
  factions.b.currentStanding, factions.b.reaction = -25000, 2
  Rep:CheckChanges()
  assert(#gains == 3 and gains[3][3] == 5000,
    "negative-faction gain must fire 5000, got " .. tostring(gains[3] and gains[3][3]))

  -- A newly discovered faction (Classic header expanded, new encounter):
  -- must seed silently, no spurious rank-up from 0 and no phantom gain.
  factions.new = faction(1003, "Newly Met", 5, 400)
  Rep:CheckChanges()
  assert(#gains == 3, "first sighting must not fire a gain, fired " .. #gains)
  assert(#rankUps == 2, "first sighting must not fire a spurious rank-up beyond the real crossings, fired " .. #rankUps)

  -- Duplicate names track separately by faction id.
  factions.d1.currentStanding = 20
  factions.d2.currentStanding = 510
  Rep:CheckChanges()
  assert(#gains == 5, "both duplicate-named factions must fire their own gains, fired " .. #gains)
  assert(gains[4][3] == 10 and gains[5][3] == 10,
    "duplicate-name deltas must be 10 each, got " .. tostring(gains[4][3]) .. " and " .. tostring(gains[5][3]))
`), { __repSource: "modules/reputation/reputation.lua" });

await scenario("loot delivers the session's first currency gain", rgxStub(`
  local wallet = { [1234] = 100 }
  C_CurrencyInfo = { GetCurrencyInfo = function(id) return { quantity = wallet[id] or 0 } end }

  loadModule(__lootSource, "modules/loot/loot.lua")
  local Loot = _G.RGXLoot
  assert(Loot, "loot module did not register")
  Loot:Init()

  local gained = {}
  Loot:OnCurrencyGained(function(id, delta, total) gained[#gained + 1] = { id, delta, total } end)

  -- First event of the session carries its own delta; the old cold-cache
  -- diff gate swallowed exactly this one.
  RGX._events.CURRENCY_DISPLAY_UPDATE(nil, 1234, 100, 25)
  assert(#gained == 1 and gained[1][2] == 25 and gained[1][3] == 100,
    "first-session gain must fire from quantityChange, got " .. #gained)

  -- A flavor without quantityChange still fires via the cache diff.
  RGX._events.CURRENCY_DISPLAY_UPDATE(nil, 1234, 110, nil)
  assert(#gained == 2 and gained[2][2] == 10,
    "later gain must fire the 10 cache diff, got " .. tostring(gained[2] and gained[2][2]))

  -- Both signals present: fires exactly once (elseif guard).
  RGX._events.CURRENCY_DISPLAY_UPDATE(nil, 1234, 120, 10)
  assert(#gained == 3 and gained[3][2] == 10,
    "delta present on both paths must fire once, fired " .. #gained)

  -- Losses and no-ops stay silent.
  RGX._events.CURRENCY_DISPLAY_UPDATE(nil, 1234, 100, -20)
  assert(#gained == 3, "a loss must not fire a gain, fired " .. #gained)
`), { __lootSource: "modules/loot/loot.lua" });

await scenario("quest progress suppressed by cooldown is delivered, not lost", rgxStub(`
  local now = 1000
  GetTime = function() return now end

  -- One quest, id 50, one objective whose fulfilled count we control.
  local fulfilled, required = 1, 5
  RGX.API.GetNumQuestLogEntries = function() return 1 end
  RGX.API.GetQuestLogInfo = function(index)
    if index == 1 then return { questID = 50 } end
    return nil
  end
  RGX.API.GetQuestObjectives = function(questID)
    if questID ~= 50 then return nil end
    return { { text = "Slain: " .. fulfilled .. "/" .. required,
               numFulfilled = fulfilled, numRequired = required,
               finished = fulfilled >= required } }
  end

  loadModule(__questSource, "modules/quest/quest.lua")
  local Quest = _G.RGXQuest
  assert(Quest, "quest module did not register")
  Quest:Init()

  local progress = {}
  Quest:OnProgress(function(questID, snapshot, source) progress[#progress + 1] = { questID, snapshot and snapshot[1] and snapshot[1].fulfilled, source } end)

  RGX._events.QUEST_ACCEPTED(nil, 50)
  assert(Quest._objectiveCache[50] and Quest._objectiveCache[50][1].fulfilled == 1, "accept must seed the cache")

  -- 1 -> 2 fires immediately.
  fulfilled = 2
  RGX._events.QUEST_LOG_UPDATE()
  assert(#progress == 1 and progress[1][2] == 2, "first advance must fire, fired " .. #progress)

  -- 2 -> 3 lands inside the 0.25s cooldown: suppressed, but the cache
  -- must keep the delivered 2/5 snapshot so the increment still reports.
  now = now + 0.10
  fulfilled = 3
  RGX._events.QUEST_LOG_UPDATE()
  assert(#progress == 1, "advance inside the cooldown must be suppressed, fired " .. #progress)
  assert(Quest._objectiveCache[50][1].fulfilled == 2,
    "suppressed fire must keep the delivered snapshot; cache advanced to "
    .. tostring(Quest._objectiveCache[50][1].fulfilled) .. " and the increment would be lost")

  -- After the cooldown, the next watch update delivers the full state.
  now = now + 1.0
  RGX._events.QUEST_WATCH_UPDATE(nil, 50)
  assert(#progress == 2 and progress[2][2] == 3,
    "the pending increment must be delivered after the cooldown, saw " .. tostring(progress[2] and progress[2][2]))
`), { __questSource: "modules/quest/quest.lua" });

if (failures.length) {
  console.error(`MODULES GAMEPLAY FAILED  ${failures.join(", ")}`);
  process.exit(1);
}
console.log(`MODULES GAMEPLAY OK  ${count} reputation/loot/quest scenario(s)`);
