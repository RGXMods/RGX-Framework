--[[
    RGX-Framework - Runtime Helpers

    BLU already proved that a WoW addon can provide its own lightweight
    framework runtime without leaning on LibStub-era dependency chains.

    RGX keeps the same philosophy here:
    - native timer helpers
    - native hook helpers
    - native slash command registration
--]]

local addonName, RGX = ...

RGX.timers = RGX.timers or {}
RGX._hookRegistry = RGX._hookRegistry or {}
RGX.slashCommands = RGX.slashCommands or {}
RGX._slashCommandCounter = RGX._slashCommandCounter or 0

local function reportRuntimeError(scope, err)
    local message = string.format("[RGX:%s] %s", tostring(scope), tostring(err))

    if type(_G.geterrorhandler) == "function" then
        _G.geterrorhandler()(message)
        return
    end

    print("|cFFFF4444" .. message .. "|r")
end

function RGX:EnsureTimerDriver()
    if self.timerFrame then
        self.timerFrame:SetScript("OnUpdate", function(_, elapsed)
            self:UpdateTimers(elapsed)
        end)
        return
    end

    self.timerFrame = CreateFrame("Frame")
    self.timerFrame:SetScript("OnUpdate", function(_, elapsed)
        self:UpdateTimers(elapsed)
    end)
end

function RGX:CreateTimer(duration, callback, repeating)
    duration = tonumber(duration) or 0
    if duration < 0 then
        duration = 0
    end

    if type(callback) ~= "function" then
        return nil
    end

    local timer = {
        duration = duration,
        callback = callback,
        repeating = repeating == true,
        elapsed = 0,
        active = true,
    }

    self.timers[#self.timers + 1] = timer
    self:EnsureTimerDriver()
    return timer
end

function RGX:After(duration, callback)
    return self:CreateTimer(duration, callback, false)
end

function RGX:Every(duration, callback)
    return self:CreateTimer(duration, callback, true)
end

function RGX:CancelTimer(timer)
    if type(timer) ~= "table" then
        return false
    end

    timer.active = false
    return true
end

function RGX:CancelAllTimers()
    local cancelled = 0

    for index = 1, #self.timers do
        local timer = self.timers[index]
        if timer and timer.active then
            timer.active = false
            cancelled = cancelled + 1
        end
    end

    return cancelled
end

function RGX:UpdateTimers(elapsed)
    for index = #self.timers, 1, -1 do
        local timer = self.timers[index]

        if not timer or not timer.active then
            table.remove(self.timers, index)
        else
            timer.elapsed = timer.elapsed + elapsed

            if timer.elapsed >= timer.duration then
                local ok, err = pcall(timer.callback, timer)
                if not ok then
                    reportRuntimeError("timer", err)
                end

                if timer.repeating and timer.active then
                    timer.elapsed = timer.elapsed - timer.duration
                    if timer.elapsed < 0 then
                        timer.elapsed = 0
                    end
                else
                    table.remove(self.timers, index)
                end
            end
        end
    end

    if #self.timers == 0 and self.timerFrame then
        self.timerFrame:SetScript("OnUpdate", nil)
    end
end

-- Post-hook target[method] via hooksecurefunc. callback receives the same args
-- as the original. Safe for Blizzard UI functions; cannot be unhooked.
function RGX:Hook(target, method, callback)
    if type(target) ~= "table" or type(method) ~= "string" or method == "" then
        return false
    end
    if type(callback) ~= "function" then
        return false
    end
    if type(target[method]) ~= "function" then
        return false
    end

    self._hookRegistry[target] = self._hookRegistry[target] or {}
    if self._hookRegistry[target][method] then
        return false
    end
    self._hookRegistry[target][method] = true

    hooksecurefunc(target, method, callback)
    return true
end

function RGX:RegisterSlashCommand(commands, callback, id)
    if type(callback) ~= "function" then
        return false
    end

    local commandList = type(commands) == "table" and commands or { commands }
    local normalized = {}

    for index = 1, #commandList do
        local command = tostring(commandList[index] or "")
        command = command:gsub("^%s*/?", ""):gsub("%s+$", "")
        if command ~= "" then
            normalized[#normalized + 1] = command
        end
    end

    if #normalized == 0 then
        return false
    end

    self._slashCommandCounter = self._slashCommandCounter + 1
    local token = tostring(id or (addonName .. "_CMD_" .. self._slashCommandCounter))
    token = token:gsub("[^%w_]", "_"):upper()

    for index = 1, #normalized do
        _G["SLASH_" .. token .. index] = "/" .. normalized[index]
    end

    SlashCmdList[token] = callback
    self.slashCommands[token] = {
        commands = normalized,
        callback = callback,
    }

    return token
end

-- Shorthand: RGX:Slash("mycommand", fn)  →  RGX:RegisterSlashCommand({"mycommand"}, fn)
function RGX:Slash(command, callback)
    return self:RegisterSlashCommand({ command }, callback)
end
