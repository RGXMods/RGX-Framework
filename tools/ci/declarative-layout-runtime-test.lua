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

local capturedPanels = {}
local builtPagers = {}
local builtCards = {}
local builtFlows = {}

local function widget(host, kind, opts)
    return { host = host, kind = kind, opts = opts }
end

local function newCanvas(parent)
    local canvas = { parent = parent, width = 320, height = 0, scripts = {} }
    function canvas:GetWidth() return self.width end
    function canvas:SetHeight(height) self.height = height end
    function canvas:HookScript(name, fn) self.scripts[name] = fn end
    return canvas
end

local function newFlow(host)
    local flow = { host = host, added = {} }
    function flow:Add(child) self.added[#self.added + 1] = child end
    function flow:Apply() return #self.added * 10 end
    builtFlows[#builtFlows + 1] = flow
    return flow
end

local stubUI = { _BuildAddonOptionTabs = __rgxBuildAddonOptionTabs }

function stubUI:CreateScrollPage(parent)
    return newCanvas(parent)
end

function stubUI:CreateFlowLayout(parent)
    return newFlow(parent)
end

function stubUI:CreateColumns(parent, count)
    local columns = {}
    for index = 1, count do
        columns[index] = { parent = parent, column = index, width = 160 }
    end
    return unpack(columns)
end

function stubUI:CreatePager(parent, opts)
    local frames = {}
    for index = 1, opts.pages do
        frames[index] = { parent = parent, index = index, shown = index == 1 }
        frames[index].SetShown = function(self, shown) self.shown = shown end
    end
    local pager = {
        parent = parent,
        frames = frames,
        page = 1,
        pageCount = opts.pages,
        SetPage = function(self, page)
            page = math.min(math.max(1, page), self.pageCount)
            self.page = page
            for index = 1, self.pageCount do
                frames[index]:SetShown(index == page)
            end
        end,
    }
    builtPagers[#builtPagers + 1] = pager
    return pager
end

function stubUI:CreateCard(parent, opts)
    local card = {
        parent = parent,
        title = opts.title,
        requestedColumns = opts.columns,
        columns = {},
        flows = {},
        autoHeightCalls = 0,
    }
    local count = opts.columns or 1
    for index = 1, count do
        local host = { parent = card, cardColumn = index }
        card.columns[index] = host
        card.flows[index] = newFlow(host)
    end
    card.flow = card.flows[1]
    function card:AutoHeight() self.autoHeightCalls = self.autoHeightCalls + 1 end
    builtCards[#builtCards + 1] = card
    return card
end

function stubUI:CreateOptionsPanel(opts)
    capturedPanels[#capturedPanels + 1] = opts
    return { ready = true }
end

function stubUI:CreateSwitch(parent, opts)
    local control = widget(parent, "switch", opts)
    control.scripts = {}
    function control:HookScript(name, fn) self.scripts[name] = fn end
    function control:Refresh() self.refreshCount = (self.refreshCount or 0) + 1 end
    return control
end

function stubUI:CreateSlider(parent, opts) return widget(parent, "slider", opts) end
function stubUI:CreateTextInput(parent, opts) return widget(parent, "textbox", opts) end
function stubUI:CreatePanelAlpha(parent, opts) return widget(parent, "panel_alpha", opts) end
function stubUI:CreateColorPicker(parent, opts) return widget(parent, "color", opts) end
function stubUI:CreateButton(parent, opts) return widget(parent, "button", opts) end
function stubUI:CreateLabel(parent, opts) return widget(parent, "label", opts) end

function RGX:GetUI() return stubUI end
function RGX:GetDropdowns() return nil end
function RGX:GetFonts() return nil end
function RGX:NewDatabase() return {} end

local function expectInvalid(name, options, expected)
    local handlerCount = loadHandlerCount()
    local ok, err = pcall(function()
        RGXAddon(name, { db = {}, options = options })
    end)
    check(not ok, name .. " should be rejected")
    check(contains(err, expected), name .. " should explain the validation failure")
    check(RGX:GetAddon(name) == nil, name .. " should not register an addon")
    check(loadHandlerCount() == handlerCount, name .. " should not register a load handler")
end

local function layoutPage(cards, grid)
    local page = { page = "Basics", cards = cards }
    if grid then page.grid = grid end
    return page
end

local function layoutCard(controls, columns)
    local card = { card = "Display", controls = controls }
    if columns then card.columns = columns end
    return card
end

local enabledControl = { { toggle = "enabled" } }

expectInvalid("LayoutGridThree", { General = { layoutPage({ layoutCard(enabledControl) }, 3) } }, "grid for page 'Basics' must be 1 or 2")
expectInvalid("LayoutCardColumnsThree", { General = { layoutPage({ layoutCard(enabledControl, 3) }) } }, "columns for card 'Display' must be 1 or 2")
expectInvalid("LayoutNoCards", { General = { layoutPage({}) } }, "page 'Basics' must contain at least one card")
expectInvalid("LayoutEmptyCards", { General = { layoutPage({}) } }, "page 'Basics' must contain at least one card")
expectInvalid("LayoutNoControls", { General = { layoutPage({ layoutCard({}) }) } }, "must contain at least one control")
expectInvalid("LayoutEmptyControls", { General = { layoutPage({ layoutCard({}) }) } }, "must contain at least one control")
expectInvalid("LayoutMixed", { General = { layoutPage({ layoutCard(enabledControl) }), { toggle = "outside" } } }, "cannot mix pages with controls")
expectInvalid("LayoutColumnsAndPages", { columns = 2, General = { layoutPage({ layoutCard(enabledControl) }) } }, "options.columns cannot be combined with page layouts")
expectInvalid("LayoutNestedPage", { General = { layoutPage({ layoutCard({ { page = "Nested" } }) }) } }, "pages and cards cannot nest")
expectInvalid("LayoutNestedCard", { General = { layoutPage({ layoutCard({ { card = "Nested" } }) }) } }, "pages and cards cannot nest")
expectInvalid("LayoutBadString", { General = { { page = "Basics", cards = { { card = "Display", controls = { "slider bad" } } } } } }, "invalid control string")

builtPagers, builtCards, builtFlows = {}, {}, {}
local layoutAddon = RGXAddon("LayoutValid", {
    db = {},
    options = {
        General = {
            {
                page = "Basics",
                grid = 2,
                cards = {
                    { card = "Display", columns = 2, controls = { { toggle = "first" }, { toggle = "second" }, { toggle = "third" } } },
                    { card = "Audio", controls = { { toggle = "fourth" }, { toggle = "fifth" } } },
                    { card = "Notifications", controls = { { toggle = "sixth" } } },
                },
            },
            {
                page = "Advanced",
                cards = { { card = "Profiles", controls = { { toggle = "seventh" } } } },
            },
        },
    },
})
RGX:FireEvent("ADDON_LOADED", "LayoutValid")
check(#capturedPanels == 1, "layout declaration should build one panel")
local tabs = capturedPanels[1].tabs
check(#tabs == 1 and tabs[1].text == "General", "layout declaration should keep the declared tab")
capturedPanels = {}

local contentFrame = { width = 640 }
tabs[1].content(contentFrame)
check(#builtPagers == 1 and builtPagers[1].pageCount == 2, "two page nodes should create one two-page pager")
check(#builtCards == 4, "four declared cards should be built")
check(builtCards[1].title == "Display" and builtCards[1].requestedColumns == 2, "the first card should retain its title and column count")
check(builtCards[1].autoHeightCalls == 1, "every card should auto-height exactly once after its controls are added")

-- Build order: page one grid flows, then card flows, then page two grid/card flows.
check(#builtFlows == 8, "the declaration should create eight flows total")
local pageOneGridFlows = { builtFlows[1], builtFlows[2] }
check(#pageOneGridFlows[1].added == 2 and #pageOneGridFlows[2].added == 1, "three cards should fill the two-column grid 2 + 1")
check(pageOneGridFlows[1].added[1] == builtCards[1] and pageOneGridFlows[1].added[2] == builtCards[2], "cards should fill grid column one in declaration order")
check(pageOneGridFlows[2].added[1] == builtCards[3], "the last card should lead grid column two")

local displayFlows = { builtFlows[3], builtFlows[4] }
check(#displayFlows[1].added == 2 and #displayFlows[2].added == 1, "three controls should fill the two-column card 2 + 1")
check(displayFlows[1].added[1].opts.key == "first" and displayFlows[1].added[2].opts.key == "second", "card column one should preserve control order")
check(displayFlows[2].added[1].opts.key == "third", "card column two should receive the remaining control")
local audioFlow = builtFlows[5]
check(#audioFlow.added == 2 and audioFlow.added[1].opts.key == "fourth", "the one-column audio card should receive controls in order")

local pager = builtPagers[1]
pager:SetPage(2)
check(pager.page == 2 and pager.frames[2].shown and not pager.frames[1].shown, "pager transitions should show only the selected page")

local pageTwoFlow = builtFlows[7]
check(pageTwoFlow.added[1] == builtCards[4], "the second page's card should fill its grid flow")

-- Reopen restore: the card switch keeps the same OnShow re-projection as plain tabs.
local firstSwitch = displayFlows[1].added[1]
check(type(firstSwitch.scripts.OnShow) == "function", "card controls should install the switch OnShow re-projection")
firstSwitch.scripts.OnShow()
check(firstSwitch.refreshCount == 1, "reopening a page should refresh displayed switch state")

-- ── Declaration-time validation: malformed layouts fail before registering.
local function failsWith(fragment, run)
    local ok, err = pcall(run)
    check(ok == false, "declaration must be rejected: " .. fragment)
    check(contains(err, fragment), "error must mention '" .. fragment .. "': " .. tostring(err))
end

failsWith("options without db", function()
    RGXAddon("OptsNoDb", { options = { General = { "toggle enabled" } } })
end)

failsWith("unrecognized control table", function()
    RGXAddon("TypoControl", {
        db = { enabled = true },
        options = { General = { { page = "P", cards = {
            { card = "C", controls = { { toogle = "enabled" } } },
        } } } },
    })
end)

failsWith("unrecognized control table", function()
    RGXAddon("EmptyControl", {
        db = { enabled = true },
        options = { General = { { page = "P", cards = {
            { card = "C", controls = { {} } },
        } } } },
    })
end)

failsWith("declares multiple kinds", function()
    RGXAddon("MultiKind", {
        db = { enabled = true },
        options = { General = { { page = "P", cards = {
            { card = "C", controls = { { toggle = "a", slider = "b" } } },
        } } } },
    })
end)

failsWith("requires an action function", function()
    RGXAddon("ButtonNoAction", {
        db = { enabled = true },
        options = { General = { { page = "P", cards = {
            { card = "C", controls = { { button = "Click" } } },
        } } } },
    })
end)

-- Punch a hole after construction so the list length spans it.
do
    local spec = {
        db = { enabled = true },
        options = { General = { { page = "P", cards = {
            { card = "C", controls = { "toggle enabled", "toggle extra" } },
        } } } },
    }
    spec.options.General[1].cards[1].controls[4] = "toggle fourth"
    local ok, err = pcall(RGXAddon, "HoleyList", spec)
    check(ok == false and contains(err, "has a hole at position"),
        "a hole in a control list must be rejected: " .. tostring(err))
end

-- ── Slash without a panel prints guidance, not a "v?" placeholder.
do
    local addon = RGXAddon("SlashNoPanel", { slash = "snp" })
    check(addon ~= nil, "slash-only addon must register")
    local captured
    addon.Print = function(_, msg) captured = tostring(msg) end
    local handler
    for _, id in pairs({ "SLASHNOPANEL", "SlashNoPanel" }) do
        if SlashCmdList[id] then handler = SlashCmdList[id] end
    end
    check(handler ~= nil, "the slash command must be registered in SlashCmdList")
    handler("")
    check(captured ~= nil and contains(captured, "no options panel"),
        "the no-panel message must explain the situation: " .. tostring(captured))
    check(captured == nil or not contains(captured, "v?"),
        "the literal 'v?' placeholder must be gone")
end

_G.__rgxRuntimeLayoutTestResult = string.format(
    "LUA RUNTIME OK  declarative layout (%d checks, Lua %s)",
    checks,
    tostring(_VERSION)
)
