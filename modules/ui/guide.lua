-- One-page, in-game entry point to RGX-Framework. RGX-Hello remains the
-- runnable example and visual test suite; this page is a compact field guide.
local addonName, RGX = ...

local function AddLine(UI, card, text)
    local label = UI:CreateLabel(card.content, {
        text = text, size = "normal", color = "normal", width = 292,
    })
    card.flow:Add(label)
end

local function BuildGuide(content)
    local UI = RGX:GetUI()
    local left, right = UI:CreateColumns(content, 2, { card = false, gap = 8 })

    local start = UI:CreateCard(left, { title = "Build with RGX" })
    AddLine(UI, start, "Require RGX-Framework in your addon's TOC.")
    AddLine(UI, start, 'Start with RGXAddon "MyAddon" { db = { enabled = true }, slash = "myaddon" }.')
    AddLine(UI, start, "Add controls through RGXUI and save settings through the RGX database.")
    start:AutoHeight()

    local credits = UI:CreateCard(left, { title = "Credits & resources" })
    credits:ClearAllPoints()
    credits:SetPoint("TOPLEFT", start, "BOTTOMLEFT", 0, -8)
    credits:SetPoint("TOPRIGHT", start, "BOTTOMRIGHT", 0, -8)
    AddLine(UI, credits, "RGX-Framework by RGX Mods. Modular addon infrastructure for WoW.")
    AddLine(UI, credits, "Docs: github.com/RGXMods/RGX-Framework")
    AddLine(UI, credits, "RGX-Hello provides a complete example and visual controls tour.")
    credits:AutoHeight()

    local modules = UI:CreateCard(right, { title = "Modules" })
    AddLine(UI, modules, "Database, events, timers, messages and combat-safe operations.")
    AddLine(UI, modules, "UI, design, fonts, dropdowns, textures, colors and minimap.")
    AddLine(UI, modules, "Quest, loot, pet battle, reputation, sound and other game integrations.")
    modules:AutoHeight()

    local debugCard = UI:CreateCard(right, { title = "Debug & help" })
    debugCard:ClearAllPoints()
    debugCard:SetPoint("TOPLEFT", modules, "BOTTOMLEFT", 0, -8)
    debugCard:SetPoint("TOPRIGHT", modules, "BOTTOMRIGHT", 0, -8)
    AddLine(UI, debugCard, "/rgx modules - inspect available modules")
    AddLine(UI, debugCard, "/rgx debug - toggle framework diagnostics")
    AddLine(UI, debugCard, "/rgx dbtest - check profile persistence")
    AddLine(UI, debugCard, "/rgxvisual - RGX-Hello's visual suite (if installed)")
    debugCard:AutoHeight()
end

RGX:RegisterEvent("PLAYER_LOGIN", function()
    if RGX.guidePanel then return end
    local UI = RGX:GetUI()
    if not UI or type(UI.CreateOptionsPanel) ~= "function" then return end
    RGX.guidePanel = UI:CreateOptionsPanel({
        addonName = addonName,
        title = "RGX-Framework",
        subtitle = "Help, docs and about",
        icon = "Interface\\AddOns\\RGX-Framework\\media\\logo.tga",
        author = "RGX Mods",
        website = "github.com/RGXMods/RGX-Framework",
        content = BuildGuide,
        registerInSettings = true,
    })
end, "RGX_GUIDE_PANEL")
