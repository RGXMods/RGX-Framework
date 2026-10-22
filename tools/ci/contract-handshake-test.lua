-- Contract compatibility handshake runtime gate: exercises the contract
-- format constant, the additive capability query, robust version
-- comparison, the RequireContract guard, and the generated-consumer guard
-- emitted by the shared engine inside a Lua 5.1 VM (wasmoon).
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

-- ── Contract format constant
check(RGX.CONTRACT_FORMAT_VERSION == 1, "contract format constant is 1")

-- ── Additive capability query never errors
check(RGX:SupportsContract(1) == true, "format 1 is supported")
check(RGX:SupportsContract(1.0) == true, "format 1.0 equals 1")
check(RGX:SupportsContract(0) == false, "format 0 is unsupported")
check(RGX:SupportsContract(-1) == false, "negative formats are unsupported")
check(RGX:SupportsContract(1.5) == false, "fractional formats are unsupported")
check(RGX:SupportsContract(2) == false, "future formats are unsupported")
check(RGX:SupportsContract("1") == false, "string formats are unsupported")
check(RGX:SupportsContract(true) == false, "boolean formats are unsupported")
check(RGX:SupportsContract(nil) == false, "nil formats are unsupported")

-- ── Robust version comparison
local comparisons = {
    { "2.10.0", "2.9.0", 1, "2.10.0 > 2.9.0 numerically" },
    { "2.9.0", "2.10.0", -1, "2.9.0 < 2.10.0 numerically" },
    { "2.9.0", "2.9.0", 0, "equal versions compare equal" },
    { "v2.9", "2.9.0", 0, "v prefix and short forms normalize" },
    { "2.9", "2.9.0", 0, "missing segments count as zero" },
    { "2", "2.0.0", 0, "single-segment versions normalize" },
    { "2.7.15-beta.3", "2.7.15", -1, "prerelease sorts before release" },
    { "2.7.15", "2.7.15-beta.3", 1, "release sorts after prerelease" },
    { "2.9.0", "banana", nil, "unparseable right side yields nil" },
    { "unknown", "2.9.0", nil, "unparseable left side yields nil" },
    { nil, "2.9.0", nil, "nil left side yields nil" },
    { "2.9.0", nil, nil, "nil right side yields nil" },
    { 2, "2.9.0", nil, "non-string left side yields nil" },
}
for _, case in ipairs(comparisons) do
    local result = RGX:CompareVersions(case[1], case[2])
    check(result == case[3],
        string.format("CompareVersions(%s, %s) => %s (want %s)",
            tostring(case[1]), tostring(case[2]), tostring(result), tostring(case[3]))
            .. " -- " .. case[4])
end

-- ── RequireContract: the happy path
check(RGX:RequireContract("TestAddon", 1, "2.0.0") == true, "floor met returns true")
check(RGX:RequireContract("TestAddon", 1) == true, "no floor returns true")

-- ── RequireContract: clear failure modes (pcall keeps this test running)
local function failsWith(fragment, run, label)
    local ok, err = pcall(run)
    check(ok == false, label .. " must error")
    check(contains(err, fragment), label .. " mentions '" .. fragment .. "': " .. tostring(err))
    return err
end

failsWith("invalid RGX contract format", function()
    RGX:RequireContract("TestAddon", 0)
end, "format 0")
failsWith("invalid RGX contract format", function()
    RGX:RequireContract("TestAddon", 1.5)
end, "fractional format")
failsWith("invalid RGX contract format", function()
    RGX:RequireContract("TestAddon", "1")
end, "string format")
failsWith("TestAddon requires RGX contract format 2; this RGX-Framework supports format 1", function()
    RGX:RequireContract("TestAddon", 2)
end, "future format")
failsWith("TestAddon requires RGX-Framework 3.0.0 or newer; installed RGX-Framework is 2.9.0", function()
    RGX:RequireContract("TestAddon", 1, "3.0.0")
end, "version below floor")
failsWith("could not be verified", function()
    RGX:RequireContract("TestAddon", 1, "banana")
end, "unparseable floor")

-- ── Generated-consumer guard: old frameworks fail clearly
local generatedGuard = _G.__rgxHandshakeGuard
check(type(generatedGuard) == "string" and #generatedGuard > 0, "generated guard snippet was provided")

local realFramework = _G.RGXFramework
_G.RGXFramework = {}
local oldOk, oldErr = pcall(loadstring(generatedGuard, "@generated-guard.lua"))
check(oldOk == false, "guard errors on a framework without the handshake")
check(contains(oldErr, "with the RGX contract compatibility handshake"),
    "old-framework guard message names the handshake: " .. tostring(oldErr))
check(contains(oldErr, "RGX-Framework 2.9.0"),
    "old-framework guard message names the floor: " .. tostring(oldErr))
_G.RGXFramework = realFramework

local newOk, newErr = pcall(loadstring(generatedGuard, "@generated-guard.lua"))
check(newOk == true, "guard passes on the current framework: " .. tostring(newErr))

_G.__rgxHandshakeCheckCount = checks
_G.__rgxHandshakeTestResult = string.format(
    "CONTRACT HANDSHAKE OK  format query, version compare, RequireContract (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
