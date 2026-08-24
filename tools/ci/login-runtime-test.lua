local RGX = assert(_G.RGXFramework, "RGX framework did not load")

local checks = 0
local function check(condition, message)
    if not condition then
        error("CHECK FAILED: " .. message, 2)
    end
    checks = checks + 1
end

local function contains(haystack, needle)
    return string.find(tostring(haystack), tostring(needle), 1, true) ~= nil
end

-- print capture
local realPrint = print
local captured = {}
local function startCapture()
    captured = {}
    _G.print = function(...)
        local parts = {}
        for i = 1, select("#", ...) do parts[#parts + 1] = tostring(select(i, ...)) end
        captured[#captured + 1] = table.concat(parts, " ")
    end
end
local function stopCapture()
    _G.print = realPrint
end

-- ── Framework version must come from TOC metadata (mocked: 2.7.4)
check(RGX.version == "2.7.4",
    "framework version must come from addon metadata, got " .. tostring(RGX.version))

-- ── 1: login messages default ON
check(RGX:IsLoginMessagesEnabled() == true, "login messages default ON")

-- ── framework startup: exactly one login line, icon + [RGX] tag
startCapture()
RGX.eventFrame.scripts.OnEvent(RGX.eventFrame, "ADDON_LOADED", "RGX-Framework")
stopCapture()
check(#captured == 1, "framework init should emit exactly one startup line, got " .. #captured)
check(contains(captured[1], "RGX-Framework v2.7.4 loaded."), "startup line text")
check(contains(captured[1], "[|r|cff58be81RGX|r|cffffffff]|r"),
    "startup line carries the colored [RGX] tag")
check(contains(captured[1], "logo.tga"), "startup line carries the framework icon")
check(contains(captured[1], " - "), "startup line carries the icon-tag spacer")

-- ── 6: CreateChatPrefix bare form = icon + spacer + [RGX]
local prefix = RGX:CreateChatPrefix()
check(contains(prefix, "[|r|cff58be81RGX|r|cffffffff]|r"), "bare prefix carries [RGX]")
check(contains(prefix, "logo.tga"), "bare prefix carries the framework icon")
check(contains(prefix, " - "), "bare prefix carries the spacer")
check(not contains(RGX:CreateChatPrefix({ icon = "" }), "|T"), "icon='' suppresses the icon")
check(contains(RGX:CreateChatPrefix({ tag = "RGXHELLO" }), "RGXHELLO"), "custom tag unlocks")

-- ── 2: SetLoginMessagesEnabled(false) persists false
RGX:SetLoginMessagesEnabled(false)
check(RGXFrameworkDB.showLoginMessages == false, "setting persists false in SavedVariables")
check(RGX:IsLoginMessagesEnabled() == false, "reports disabled after set")

-- ── 3: LoginMessage produces nothing when disabled
startCapture()
local loginReturn = RGX:LoginMessage("should not appear")
stopCapture()
check(#captured == 0, "LoginMessage prints nothing when disabled")
check(loginReturn == false, "LoginMessage returns false when suppressed")

-- ── declarative welcome obeys the login gate (7 + no duplicate output: 8)
-- The declarative init handler fires once per addon load, so use separate
-- addons for the disabled and enabled legs.
local welcomeDisabledAddon = RGXAddon("LoginWelcomeOff", { welcome = "welcome while off" })
startCapture()
RGX:FireEvent("ADDON_LOADED", "LoginWelcomeOff")
stopCapture()
check(#captured == 0, "welcome prints nothing while login messages are disabled")

-- ── 4: normal Print still prints while login messages are disabled
startCapture()
RGX:Print("normal output")
stopCapture()
check(#captured == 1 and contains(captured[1], "normal output"), "Print always works")

-- ── /rgx login off confirmation is a normal command response (always prints)
local slash = RGX.slashCommands and RGX.slashCommands.RGX and RGX.slashCommands.RGX.callback
check(type(slash) == "function", "/rgx slash handler registered")
startCapture()
slash("login off")
stopCapture()
check(#captured == 1 and contains(captured[1], "Login messages: OFF"),
    "/rgx login off still prints its confirmation")

-- status with explicit boolean normalization
check(RGX:SetLoginMessagesEnabled(false) == false, "setter returns normalized false")
check(RGX:SetLoginMessagesEnabled(nil) == false, "setter normalizes nil to false")

-- ── 5: re-enable restores login output
startCapture()
slash("login on")
stopCapture()
check(#captured == 1 and contains(captured[1], "Login messages: ON"), "/rgx login on confirms")
check(RGX:IsLoginMessagesEnabled() == true and RGXFrameworkDB.showLoginMessages == true,
    "re-enable persists true")
startCapture()
loginReturn = RGX:LoginMessage("hello again")
stopCapture()
check(#captured == 1, "LoginMessage prints after re-enable")
check(loginReturn == true, "LoginMessage returns true when printed")
check(contains(captured[1], "hello again"), "login output contains the message")

-- ── 7: welcome goes through LoginMessage when enabled
local welcomeAddon = RGXAddon("LoginWelcome", { welcome = "welcome when on" })
startCapture()
RGX:FireEvent("ADDON_LOADED", "LoginWelcome")
stopCapture()
check(#captured == 1, "welcome emits exactly one line when enabled, got " .. #captured)
check(contains(captured[1], "welcome when on"), "welcome text present")
check(contains(captured[1], "RGX") and contains(captured[1], "logo.tga"),
    "welcome uses the framework login prefix")

-- ── /rgx login status
startCapture()
slash("login status")
stopCapture()
check(#captured == 1 and contains(captured[1], "Login messages:"), "/rgx login status prints state")

check(welcomeAddon.name == "LoginWelcome", "addon object intact after welcome flow")

_G.__rgxLoginCheckCount = checks
_G.__rgxLoginTestResult = string.format(
    "LUA RUNTIME OK  login messages (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
