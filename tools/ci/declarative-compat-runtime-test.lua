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

local function tableCount(tbl)
    local count = 0
    for _ in pairs(tbl or {}) do count = count + 1 end
    return count
end

local function loadHandlerCount()
    return tableCount(RGX.events and RGX.events.ADDON_LOADED)
end

local function expectInvalid(name, compat, expected)
    local handlerCount = loadHandlerCount()
    local slashCount = tableCount(RGX.slashCommands)
    local ok, err = pcall(function()
        RGXAddon(name, { compat = compat, slash = name:lower() })
    end)
    check(not ok, name .. " should be rejected")
    check(contains(err, expected), name .. " should explain the validation failure")
    check(RGX:GetAddon(name) == nil, name .. " should not register an addon")
    check(loadHandlerCount() == handlerCount, name .. " should not register a load handler")
    check(tableCount(RGX.slashCommands) == slashCount, name .. " should not register a slash command")
end

CompatFixture = {
    Modern = function(a, b)
        return "modern", a, b
    end,
}
function CompatLegacy(a, b)
    return "legacy", a, b
end

expectInvalid("CompatNotTable", true, "'compat' must be a table")
expectInvalid("CompatBadName", { ["bad name"] = "CompatLegacy" }, "non-empty identifier")
expectInvalid("CompatBadDeclaration", { Get = 1 }, "path, path list, or prefer/fallback table")
expectInvalid("CompatEmptyList", { Get = {} }, "at least one API path")
expectInvalid("CompatMissingPaths", { Get = { "Missing.Path", "Missing.Other" } }, "no callable path")
expectInvalid("CompatBareMissingPath", { Get = "Missing.Path" }, "no callable path")
expectInvalid("CompatBadNormalize", {
    Get = { prefer = "CompatLegacy", normalize = true },
}, "must be a function")

local bare = RGXAddon("CompatBare", {
    compat = { Modern = "CompatFixture.Modern" },
})
check(type(bare.compat) == "table" and type(bare.compat.Modern) == "function", "bare path should compile to addon.compat")
check(bare.compat.Modern("a", "b") == "modern", "bare path should call the preferred function")

local list = RGXAddon("CompatList", {
    compat = { Modern = { "CompatFixture.Missing", "CompatLegacy" } },
})
check(list.compat.Modern("a", "b") == "legacy", "path list should fall back to the first callable path")

local advanced = RGXAddon("CompatAdvanced", {
    compat = {
        Quests = {
            prefer = "CompatFixture.Modern",
            fallback = "CompatLegacy",
            normalize = function(source, a, b)
                return { source = source, left = a, right = b }
            end,
        },
    },
})
local normalized = advanced.compat.Quests("left", "right")
check(type(normalized) == "table" and normalized.source == "modern", "advanced path should resolve the preferred function")
check(normalized.left == "left" and normalized.right == "right", "normalize should receive raw return values")

CompatFixture.Modern = nil
local fallback = RGXAddon("CompatFallback", {
    compat = { Quests = { prefer = "CompatFixture.Modern", fallback = "CompatLegacy" } },
})
check(fallback.compat.Quests() == "legacy", "prefer/fallback should use the fallback when the preferred path is absent")
CompatFixture.Modern = function(a, b) return "modern", a, b end

local preexisting = { compat = { Existing = function() return "kept" end } }
local merged = RGXAddon("CompatMerge", {
    table = preexisting,
    compat = { Modern = "CompatFixture.Modern" },
})
check(merged == preexisting, "declarative compat should augment a pre-existing addon table")
check(merged.compat.Existing() == "kept", "declarative compat should preserve existing shim entries")
check(merged.compat.Modern() == "modern", "declarative compat should add the declared shim")

local withoutCompat = RGXAddon("CompatNone", {})
check(withoutCompat.compat == nil, "an addon without compat should not grow a compat table")

_G.__rgxRuntimeCompatTestResult = string.format(
    "LUA RUNTIME OK  declarative compat (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
