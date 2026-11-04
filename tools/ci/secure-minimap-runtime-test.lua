-- Actual minimap source with a frame fixture: wiring/order, not WoW security.
local env = setmetatable({}, { __index = _G })
env._G = env
local combat, uses, preparations = false, 0, 0
local methods = {}
function methods:SetScript(key, fn) self.scripts[key] = fn end
function methods:HookScript(key, fn) self.scripts[key] = fn end
function methods:SetAttribute(key, value)
    assert(not combat, "attribute write in combat")
    self.attrs[key] = value
end
function methods:GetParent() return self.parent end
function methods:GetFrameLevel() return 1 end
function methods:GetScale() return 1 end
function methods:GetWidth() return 140 end
function methods:GetHeight() return 140 end
function methods:SetPoint() assert(not (combat and self.secure)) end
function methods:Show() assert(not (combat and self.secure)); self.shown = true end
function methods:Hide() assert(not (combat and self.secure)); self.shown = false end
function methods:IsShown() return self.shown end
function methods:CreateTexture() return setmetatable({}, { __index = methods }) end
setmetatable(methods, { __index = function(_, key)
    if key:match("^[A-Z]") then return function() end end
end })
env.CreateFrame = function(_, name, parent, template)
    local frame = setmetatable({ scripts = {}, attrs = {}, parent = parent,
        secure = template == "SecureActionButtonTemplate" }, { __index = methods })
    if frame.secure then
        frame.secureHandler = function(self, button, down)
            if not down and button == "LeftButton" and self.attrs.type1 == "item" then
                uses = uses + 1
            end
        end
        frame.scripts.OnClick = frame.secureHandler
    end
    if name then env[name] = frame end
    return frame
end
env.Minimap = env.CreateFrame()
env.InCombatLockdown = function() return combat end
env.IsControlKeyDown = function() return false end
env.RGXFramework = { RegisterModule = function() end }
local source = assert(loadstring(__rgxMinimapSource, "minimap.lua"))
setfenv(source, env)
source()
local button = env.RGXMinimap:Create({ name = "SecureFixture", icon = "icon",
    secure = true, onLeftClick = function(btn)
        preparations = preparations + 1
        assert(btn:SetItemAction(65274))
    end })
local frame = button.frame
assert(frame.scripts.OnClick == frame.secureHandler)
assert(frame.attrs.useOnKeyDown == false)
local function click(mouseButton)
    for _, down in ipairs({ true, false }) do
        frame.scripts.OnClick(frame, mouseButton, down)
        frame.scripts.PostClick(frame, mouseButton, down)
    end
end
click("LeftButton")
assert(uses == 0 and preparations == 1, "first click must prepare only")
assert(frame.attrs.item1 == "item:65274")
click("RightButton")
assert(uses == 0 and preparations == 1)
click("LeftButton")
assert(uses == 1 and preparations == 2, "second same-icon click must use item")
assert(not button:SetItemAction("bad"))
combat = true
assert(not button:SetItemAction(nil))
assert(not button:Show() and not button:Hide() and not button:SetVisible(false))
button:PlaceAtAngle()
frame.scripts.OnDragStart()
assert(not frame.isDragging)
assert(env.RGXMinimap:Create({ name = "CombatFixture", icon = "icon", secure = true }) == nil)
combat = false
assert(button:SetItemAction(nil) and frame.attrs.type1 == nil and frame.attrs.item1 == nil)
local calls = 0
local ordinary = env.RGXMinimap:Create({ name = "OrdinaryFixture", icon = "icon",
    onLeftClick = function() calls = calls + 1 end })
ordinary.frame.scripts.OnClick(ordinary.frame, "LeftButton")
assert(calls == 1 and not ordinary._secure and not ordinary:SetItemAction(65274))
print("PASS secure minimap: preserved handler, two-click order, right-click exclusion, combat guards and ordinary mode")
