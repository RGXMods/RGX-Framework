--[[
    RGX-Framework - Fonts Module
    
    Simple font management for WoW addons.
    
    For Addon Developers:
        1. Add ## RequiredDeps: RGX-Framework to your .toc
        2. Get fonts: local Fonts = RGX:GetModule("fonts")
        3. Use fonts: local path = Fonts:GetPath("Inter-Regular")
    
    API:
        Fonts:GetPath(name)          - Get font file path
        Fonts:Get(name, size, flags) - Get path, size, flags
        Fonts:GetFont(name)          - Get Font object
        Fonts:Apply(fontString, name, size, flags) - Apply to FontString
        Fonts:List()                 - Get all fonts
        Fonts:ListAvailable()        - Get only available fonts
        Fonts:Register(name, path, info) - Add custom font
        Fonts:SetDefault(name)       - Set default font
        Fonts:GetDefault()           - Get default font name
    
    Quick Apply:
        Fonts:Quick(textObject, "Inter-Bold", 14, "OUTLINE")
        Fonts:Quick(textObject, "default")  -- Uses default font
--]]

local _, Fonts = ...
local RGX = _G.RGXFramework

if not RGX then
    error("RGX Fonts: RGX-Framework not loaded")
    return
end

Fonts.name = "fonts"
Fonts.version = "1.0.0"

-- Storage
Fonts.registry = {}
Fonts.objects = {}
Fonts.categories = {}

-- Settings
Fonts.default = nil
Fonts.defaultSize = 12
Fonts.defaultFlags = ""
Fonts.autoScale = true

-- Font base path
Fonts.fontPath = "Interface/AddOns/RGX-Framework/media/fonts/"

-- Font definitions - ACTUAL fonts we have in media/fonts/
Fonts.definitions = {
    -- Inter (OFL 1.1) - https://rsms.me/inter/
    ["Inter-Regular"] = {
        file = "Inter-Regular.otf",
        family = "Inter",
        category = "Sans-serif",
        license = "OFL 1.1",
    },
    ["Inter-Bold"] = {
        file = "Inter-Bold.otf",
        family = "Inter",
        category = "Sans-serif",
        license = "OFL 1.1",
    },

    -- Crimson Text (OFL 1.1) - https://fonts.google.com/specimen/Crimson+Text
    ["CrimsonText-Regular"] = {
        file = "CrimsonText-Regular.ttf",
        family = "Crimson Text",
        category = "Serif",
        license = "OFL 1.1",
    },

    -- Press Start 2P (OFL 1.1) - https://fonts.google.com/specimen/Press+Start+2P
    ["PressStart2P-Regular"] = {
        file = "PressStart2P-Regular.ttf",
        family = "Press Start 2P",
        category = "Pixel",
        license = "OFL 1.1",
    },

    -- VT323 (OFL 1.1) - https://fonts.google.com/specimen/VT323
    ["VT323-Regular"] = {
        file = "VT323-Regular.ttf",
        family = "VT323",
        category = "Pixel",
        license = "OFL 1.1",
    },
    
    -- DejaVu (Public Domain) - https://dejavu-fonts.github.io/
    ["DejaVuSans"] = {
        file = "DejaVuSans.ttf",
        family = "DejaVu Sans",
        category = "Sans-serif",
        license = "Public Domain",
    },
    ["DejaVuSans-Bold"] = {
        file = "DejaVuSans-Bold.ttf",
        family = "DejaVu Sans",
        category = "Sans-serif",
        license = "Public Domain",
    },
    ["DejaVuSansCondensed"] = {
        file = "DejaVuSansCondensed.ttf",
        family = "DejaVu Sans Condensed",
        category = "Sans-serif",
        license = "Public Domain",
    },
    ["DejaVuSansCondensed-Bold"] = {
        file = "DejaVuSansCondensed-Bold.ttf",
        family = "DejaVu Sans Condensed",
        category = "Sans-serif",
        license = "Public Domain",
    },
    
    -- Liberation (OFL 1.1) - https://github.com/liberationfonts
    ["LiberationSans-Regular"] = {
        file = "LiberationSans-Regular.ttf",
        family = "Liberation Sans",
        category = "Sans-serif",
        license = "OFL 1.1",
    },
    ["LiberationSans-Bold"] = {
        file = "LiberationSans-Bold.ttf",
        family = "Liberation Sans",
        category = "Sans-serif",
        license = "OFL 1.1",
    },
    ["LiberationSans-Italic"] = {
        file = "LiberationSans-Italic.ttf",
        family = "Liberation Sans",
        category = "Sans-serif",
        license = "OFL 1.1",
    },
    ["LiberationSans-BoldItalic"] = {
        file = "LiberationSans-BoldItalic.ttf",
        family = "Liberation Sans",
        category = "Sans-serif",
        license = "OFL 1.1",
    },
    
    -- Ubuntu Font Family (Ubuntu Font License) - https://design.ubuntu.com/font
    ["Ubuntu-Regular"] = {
        file = "Ubuntu-Regular.ttf",
        family = "Ubuntu",
        category = "Sans-serif",
        license = "Ubuntu Font License",
    },
    ["Ubuntu-Bold"] = {
        file = "Ubuntu-Bold.ttf",
        family = "Ubuntu",
        category = "Sans-serif",
        license = "Ubuntu Font License",
    },

    -- IBM Plex Mono (OFL 1.1) - https://fonts.google.com/specimen/IBM+Plex+Mono
    ["IBMPlexMono-Regular"] = {
        file = "IBMPlexMono-Regular.ttf",
        family = "IBM Plex Mono",
        category = "Monospace",
        license = "OFL 1.1",
    },

    -- Bebas Neue (OFL 1.1) - https://fonts.google.com/specimen/Bebas+Neue
    ["BebasNeue-Regular"] = {
        file = "BebasNeue-Regular.ttf",
        family = "Bebas Neue",
        category = "Display",
        license = "OFL 1.1",
    },

    -- Bangers (OFL 1.1) - https://fonts.google.com/specimen/Bangers
    ["Bangers-Regular"] = {
        file = "Bangers-Regular.ttf",
        family = "Bangers",
        category = "Display",
        license = "OFL 1.1",
    },

    -- Creepster (OFL 1.1) - https://fonts.google.com/specimen/Creepster
    ["Creepster-Regular"] = {
        file = "Creepster-Regular.ttf",
        family = "Creepster",
        category = "Display",
        license = "OFL 1.1",
    },

    -- Silkscreen (OFL 1.1) - https://fonts.google.com/specimen/Silkscreen
    ["Silkscreen-Regular"] = {
        file = "Silkscreen-Regular.ttf",
        family = "Silkscreen",
        category = "Pixel",
        license = "OFL 1.1",
    },

    -- Uncial Antiqua (OFL 1.1) - https://fonts.google.com/specimen/Uncial+Antiqua
    ["UncialAntiqua-Regular"] = {
        file = "UncialAntiqua-Regular.ttf",
        family = "Uncial Antiqua",
        category = "Fantasy",
        license = "OFL 1.1",
    },
}

--[[============================================================================
    REGISTRATION
============================================================================]]

function Fonts:Register(name, path, info)
    if type(name) ~= "string" or name == "" then
        RGX:Debug("Fonts: Invalid font name")
        return nil
    end
    
    if self.registry[name] then
        return self.registry[name]
    end

    info = info or {}

    self.registry[name] = {
        path = path,
        name = info.displayName or name,
        family = info.family or name,
        category = info.category or "Sans-serif",
        license = info.license or "Unknown",
        available = info.available,
        isCustom = info.isCustom or false
    }

    self.categories[info.category or "Sans-serif"] = true

    RGX:Debug("Fonts: Registered", name)
    return self.registry[name]
end

function Fonts:RegisterAddonFont(addonName, fontName, fontFile, info)
    info = info or {}
    info.isCustom = true
    info.addon = addonName
    
    local path = string.format("Interface/AddOns/%s/fonts/%s", addonName, fontFile)
    return self:Register(fontName, path, info)
end

--[[============================================================================
    RETRIEVAL
============================================================================]]

function Fonts:Exists(name)
    return self.registry[name] ~= nil
end

function Fonts:IsAvailable(name)
    local font = self.registry[name]
    if not font then return false end
    if font.available == nil then
        local testFont = CreateFont("RGX_Test_" .. name:gsub("[^%w]", "_"))
        font.available = pcall(function()
            testFont:SetFont(font.path, 12, "")
        end)
    end
    return font.available
end

function Fonts:GetPath(name)
    name = name or self.default
    
    local font = self.registry[name]
    if font and self:IsAvailable(name) then
        return font.path
    end

    -- Fall back to default
    if name ~= self.default and self.default then
        return self:GetPath(self.default)
    end

    -- Ultimate fallback
    return "Fonts/FRIZQT__.TTF"
end

function Fonts:Get(name, size, flags)
    local path = self:GetPath(name)
    local s = size or self.defaultSize
    local f = flags or self.defaultFlags
    
    if self.autoScale then
        s = s * UIParent:GetEffectiveScale()
    end
    
    return path, s, f
end

function Fonts:GetFont(name, size, flags)
    name = name or self.default
    
    if not self:Exists(name) then
        return nil
    end

    if not size and not flags then
        if not self.objects[name] then
            local path = self:GetPath(name)
            local obj = CreateFont("RGX_Font_" .. name:gsub("[^%w]", "_"))
            obj:SetFont(path, self.defaultSize, self.defaultFlags)
            self.objects[name] = obj
        end
        return self.objects[name]
    end

    local path = self:GetPath(name)
    local tempName = string.format("RGX_Font_%s_%d_%s", 
        name:gsub("[^%w]", "_"), 
        size or 0, 
        flags or "")
    
    local temp = _G[tempName]
    if not temp then
        temp = CreateFont(tempName)
        temp:SetFont(path, size or self.defaultSize, flags or self.defaultFlags)
    end
    
    return temp
end

--[[============================================================================
    APPLICATION
============================================================================]]

function Fonts:Apply(fontString, name, size, flags)
    if not fontString or not fontString.SetFont then
        return false
    end
    
    local path, s, f = self:Get(name, size, flags)
    fontString:SetFont(path, s, f)
    return true
end

function Fonts:Quick(fontString, name, size, flags)
    if not fontString then return false end
    
    name = name or self.default
    
    -- Handle keywords
    if name == "default" or name == "normal" then
        name = self.default
    elseif name == "header" then
        size = size or 16
        flags = flags or "OUTLINE"
        name = self.default
    elseif name == "title" then
        size = size or 18
        flags = flags or "OUTLINE"
        name = self.default
    elseif name == "small" then
        size = size or 10
        name = self.default
    end
    
    return self:Apply(fontString, name, size, flags)
end

function Fonts:ApplyChildren(frame, name, size, flags)
    if not frame then return end
    
    local regions = {frame:GetRegions()}
    for _, region in ipairs(regions) do
        if region.SetFont then
            self:Apply(region, name, size, flags)
        end
    end
    
    for _, child in ipairs({frame:GetChildren()}) do
        self:ApplyChildren(child, name, size, flags)
    end
end

--[[============================================================================
    LISTING
============================================================================]]

function Fonts:List()
    local list = {}
    for name, data in pairs(self.registry) do
        table.insert(list, {
            name = name,
            displayName = data.name,
            family = data.family,
            category = data.category,
            path = data.path,
            available = data.available,
            isCustom = data.isCustom
        })
    end
    table.sort(list, function(a, b) return a.name < b.name end)
    return list
end

function Fonts:ListAvailable()
    local list = {}
    for name, data in pairs(self.registry) do
        if self:IsAvailable(name) then
            table.insert(list, {
                name = name,
                displayName = data.name,
                family = data.family,
                category = data.category,
                path = data.path,
                isCustom = data.isCustom
            })
        end
    end
    table.sort(list, function(a, b) return a.name < b.name end)
    return list
end

function Fonts:ListByCategory(category)
    local list = {}
    for name, data in pairs(self.registry) do
        if data.category == category then
            table.insert(list, name)
        end
    end
    table.sort(list)
    return list
end

function Fonts:GetCategories()
    local cats = {}
    for cat in pairs(self.categories) do
        table.insert(cats, cat)
    end
    table.sort(cats)
    return cats
end

--[[============================================================================
    DEFAULTS
============================================================================]]

function Fonts:SetDefault(name)
    if not self:Exists(name) then
        RGX:Debug("Fonts: Cannot set default - font not found:", name)
        return false
    end
    if not self:IsAvailable(name) then
        RGX:Debug("Fonts: Cannot set default - font unavailable:", name)
        return false
    end
    self.default = name
    return true
end

function Fonts:GetDefault()
    return self.default
end

function Fonts:SetDefaultSize(size)
    self.defaultSize = size
end

function Fonts:SetDefaultFlags(flags)
    self.defaultFlags = flags
end

function Fonts:SetAutoScale(enable)
    self.autoScale = enable
end

--[[============================================================================
    FONT CREATION HELPERS
============================================================================]]

function Fonts:CreateString(parent, fontName, size, flags, layer)
    parent = parent or UIParent
    layer = layer or "OVERLAY"
    
    local fs = parent:CreateFontString(nil, layer)
    self:Quick(fs, fontName, size, flags)
    
    return fs
end

function Fonts:FromTemplate(parent, template, text, layer)
    local settings = {
        header = { size = 16, flags = "OUTLINE" },
        title = { size = 18, flags = "OUTLINE" },
        body = { size = 12, flags = "" },
        caption = { size = 10, flags = "" },
        small = { size = 9, flags = "" },
    }
    
    local setting = settings[template] or settings.body
    local fs = self:CreateString(parent, self.default, setting.size, setting.flags, layer)
    if text then fs:SetText(text) end
    
    return fs
end

--[[============================================================================
    AUTO-DISCOVERY
============================================================================]]

-- Scan font folder and register any fonts not in definitions
function Fonts:ScanForNewFonts()
    -- This would need file system access which WoW doesn't allow
    -- Instead, we check on init which fonts are actually available
    RGX:Debug("Fonts: Scanning for available fonts...")
end

--[[============================================================================
    INITIALIZATION
============================================================================]]

function Fonts:Init()
    -- Register WoW default fonts
    self:Register("FRIZQT", "Fonts/FRIZQT__.TTF", {
        displayName = "Friz Quadrata",
        family = "Friz Quadrata",
        category = "Sans-serif",
        available = true
    })
    
    self:Register("ARIALN", "Fonts/ARIALN.TTF", {
        displayName = "Arial Narrow",
        family = "Arial",
        category = "Sans-serif",
        available = true
    })
    
    self:Register("skurri", "Fonts/skurri.ttf", {
        displayName = "Skurri",
        family = "Skurri",
        category = "Serif",
        available = true
    })
    
    self:Register("MORPHEUS", "Fonts/MORPHEUS.ttf", {
        displayName = "Morpheus",
        family = "Morpheus",
        category = "Serif",
        available = true
    })

    -- Register packaged fonts
    for name, def in pairs(self.definitions) do
        self:Register(name, self.fontPath .. def.file, {
            displayName = def.family,
            family = def.family,
            category = def.category,
            license = def.license
        })
    end

    -- Check availability
    for name, data in pairs(self.registry) do
        if data.available == nil then
            local testFont = CreateFont("RGX_Test_" .. name:gsub("[^%w]", "_"))
            data.available = pcall(function()
                testFont:SetFont(data.path, 12, "")
            end)
        end
    end

    -- Set default
    if self:IsAvailable("Inter-Regular") then
        self:SetDefault("Inter-Regular")
    else
        self:SetDefault("FRIZQT")
    end
    
	-- Register with framework
	RGX:RegisterModule("fonts", self)
	
	-- SUPER SIMPLE: Make Fonts globally accessible
	_G.RGXFonts = self
end

Fonts:Init()
