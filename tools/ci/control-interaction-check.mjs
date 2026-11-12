#!/usr/bin/env node
// Execute the shipped factories and callbacks; mouse delivery is an engine seam.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const lua = await Lua.create();
lua.ctx.controls = readFileSync(join(root, "libraries/ui/controls.lua"), "utf8");
lua.ctx.design = readFileSync(join(root, "libraries/design/design.lua"), "utf8");
lua.ctx.layout = readFileSync(join(root, "libraries/ui/layout.lua"), "utf8");
try {
  lua.doStringSync(`
    local function widget(kind, parent)
      local w = { kind = kind, parent = parent, scripts = {}, points = {}, enabled = true }
      function w:SetPoint(...) self.points[#self.points + 1] = {...} end
      function w:SetScript(name, fn) self.scripts[name] = fn end
      function w:HookScript(name, fn)
        local previous = self.scripts[name]
        self.scripts[name] = function(self, ...)
          if previous then previous(self, ...) end
          fn(self, ...)
        end
      end
      function w:SetChecked(value) self.checked = value end
      function w:GetChecked() return self.checked end
      function w:IsEnabled() return self.enabled end
      function w:Disable() self.enabled = false end
      function w:Click(button)
        if not self.enabled then return end
        if self.kind == 'CheckButton' then self.checked = not self.checked end
        if self.scripts.OnClick then self.scripts.OnClick(self, button or 'LeftButton') end
      end
      function w:SetColorTexture(...) self.color = {...} end
      function w:SetTextColor(...) self.textColor = {...} end
      function w:SetBackdropBorderColor(...) self.borderColor = {...} end
      function w:SetBackdropColor(...) self.backdropColor = {...} end
      function w:SetText(text) self.text = text end
      function w:GetText() return self.text end
      function w:SetFocus()
        self.focused = true
        if self.scripts.OnEditFocusGained then self.scripts.OnEditFocusGained(self) end
      end
      function w:ClearFocus()
        if self.focused then
          self.focused = false
          if self.scripts.OnEditFocusLost then self.scripts.OnEditFocusLost(self) end
        end
      end
      function w:HasFocus() return self.focused == true end
      function w:SetSize(width, height) self.width=width self.height=height end
      function w:SetWidth(width) self.width=width end
      function w:SetHeight(height) self.height=height end
      function w:GetWidth() return self.width or 200 end
      function w:GetHeight() return self.height or 20 end
      function w:SetResizeBounds(...) self.resizeBounds={...} end
      function w:SetResizable(value) self.resizable=value end
      function w:StartSizing(corner) self.sizing=corner end
      function w:StopMovingOrSizing() self.sizing=nil end
      function w:SetAllPoints() end
      function w:ClearAllPoints() self.points={} end
      function w:Show() self.shown=true end
      function w:Hide() self.shown=false end
      function w:IsShown() return self.shown~=false end
      function w:GetFont() return 'test', 12 end
      function w:SetFont() return true end
      function w:CreateTexture() return widget('Texture', self) end
      function w:CreateFontString() return widget('FontString', self) end
      for _, name in ipairs({
        'SetNormalTexture', 'SetPushedTexture', 'SetHighlightTexture', 'SetCheckedTexture',
        'SetFontObject', 'SetShadowColor', 'SetShadowOffset', 'SetJustifyH', 'SetJustifyV', 'SetWordWrap',
        'SetBackdrop', 'SetOwner', 'EnableMouseWheel', 'SetTexture', 'SetVertexColor', 'SetTexCoord',
        'SetFrameStrata', 'SetClampedToScreen', 'EnableMouse', 'SetMovable', 'RegisterForDrag'}) do w[name] = function() end end
      return w
    end
    function CreateFrame(kind, _, parent) return widget(kind, parent) end
    GameTooltip = widget('Tooltip')
    local modules = {}
    RGXFramework = { errors = 0 }
    function RGXFramework:RegisterModule(name, module) modules[name] = module end
    function RGXFramework:GetModule(name) return modules[name] end
    function RGXFramework:GetDesign() return modules.design end
    function RGXFramework:Error() self.errors = self.errors + 1 end
    assert(loadstring(design))('RGX-Framework', RGXFramework)
    assert(loadstring(controls))('RGX-Framework', {})
    UI = modules.ui
    D = modules.design
    assert(loadstring(layout))('RGX-Framework', UI)
  `);
  const scenarios = [
    ["dialogs resize only when enabled and preserve the theme surface", `
      local resized=false
      local dialog=UI:CreateConfigDialog({}, {resizable=true,width=500,height=300,minWidth=320,minHeight=200,
        onResize=function(w,h,owner) resized=w==500 and h==300 and owner.resizeGrip~=nil end})
      assert(dialog.SetPanelColor and dialog._panelFill,'dialog bypassed Design surface')
      assert(dialog.resizable and dialog.resizeBounds[1]==320 and dialog.resizeBounds[2]==200)
      dialog.resizeGrip.scripts.OnDragStart(); assert(dialog.sizing=='BOTTOMRIGHT')
      dialog.resizeGrip.scripts.OnDragStop(); assert(resized and dialog.sizing==nil)
      local fixed=UI:CreateConfigDialog({}, {})
      assert(fixed.resizeGrip==nil)
    `],
    ["a slider's reset button sits at the right edge of the slider's own row, not the parent's", `
      local parent = {}
      local slider = UI:CreateSlider(parent, {key='amount', storage={}, min=0, max=10, default=5})
      local reset = slider.resetButton
      assert(reset, 'slider has a reset button')
      -- the reset is centred on an anchor frame that CreateRowReset... AnchorRowReset pins to the row's right edge
      local anchorFrame = reset.points[#reset.points][2]
      assert(anchorFrame, 'reset is anchored to a row anchor frame')
      local right
      for _, p in ipairs(anchorFrame.points) do if p[1] == 'RIGHT' then right = p end end
      assert(right, 'the row anchor is pinned to the right edge')
      assert(right[2] == slider, 'the reset follows the slider row, not its parent (anchored to ' .. tostring(right[2] == parent and 'parent' or 'other') .. ')')
      assert(right[4] == 0, 'the reset sits flush in the 28px the row reserves, not 8px inside it (inset ' .. tostring(right[4]) .. ')')
    `],
    ["slider snapping is relative to min so every slider can reach its own minimum", `
      local storage={amount=1}
      -- min=1, max=9, step=2: old zero-relative snapping reached 2,4,6,8
      -- and never 1; min-relative snapping must hit 1,3,5,7,9.
      local slider=UI:CreateSlider({}, {key='amount',storage=storage,min=1,max=9,step=2,default=1})
      slider:SetValue(1)
      assert(storage.amount==1, "min must be reachable, got "..tostring(storage.amount))
      slider:SetValue(3.7)
      assert(storage.amount==3, "mid-track snap must be min-relative, got "..tostring(storage.amount))
      slider:SetValue(9)
      assert(storage.amount==9, "max must be reachable, got "..tostring(storage.amount))
      slider:SetValue(2)
      assert(storage.amount==3, "2 is not on the 1+2n lattice; nearest is 3, got "..tostring(storage.amount))
      -- Even lattices still work.
      local plain=UI:CreateSlider({}, {key='plain',storage=storage,min=0,max=10,step=5,default=5})
      plain:SetValue(7)
      assert(storage.plain==5, "0-relative lattice unchanged, got "..tostring(storage.plain))
    `],
    ["slider values are optionally hover-only without changing save/reset behavior", `
      local storage={amount=25}
      local slider=UI:CreateSlider({}, {key='amount',storage=storage,default=10,valueDisplay='hover',suffix='%'})
      assert(not slider.valueLabel:IsShown() and not slider.hoverValueLabel:IsShown())
      slider.button.scripts.OnEnter(slider.button)
      assert(slider.hoverValueLabel:IsShown() and slider.hoverValueLabel:GetText()=='25%')
      slider:SetValue(45)
      assert(storage.amount==45 and not slider.valueLabel:IsShown() and slider.hoverValueLabel:GetText()=='45%')
      slider.button.scripts.OnLeave(slider.button); assert(not slider.hoverValueLabel:IsShown())
      slider.resetButton:Click(); assert(storage.amount==10 and not slider.valueLabel:IsShown())
      local none=UI:CreateSlider({}, {valueDisplay='none'})
      none.button.scripts.OnEnter(none.button)
      assert(not none.valueLabel:IsShown() and not none.hoverValueLabel:IsShown())
      local legacy=UI:CreateSlider({}, {})
      assert(legacy.valueLabel:IsShown())
    `],
    ["resize bounds prefer supported modern setter over obsolete aliases", `
      local called=false
      local frame={SetResizeBounds=function(_,a,b,c,d) called=true; assert(a==640 and b==420 and c==1400 and d==1000) end,
        SetMinResize=function() error('obsolete setter called') end, SetMaxResize=function() error('obsolete setter called') end}
      assert(UI:SetResizeBounds(frame,640,420,1400,1000) and called)
    `],
    ["legacy resize bounds and missing capabilities report accurately", `
      local calls=0
      local frame={SetMinResize=function(_,a,b) calls=calls+1; assert(a==640 and b==420) end,
        SetMaxResize=function(_,a,b) calls=calls+1; assert(a==1400 and b==1000) end}
      assert(UI:SetResizeBounds(frame,640,420,1400,1000) and calls==2)
      assert(not UI:SetResizeBounds({},640,420,1400,1000))
      assert(not UI:SetResizeBounds(frame,640,420,1400,nil) and calls==2)
    `],
    ["main-color aliases and shades follow scoped themes", `
      D:SetTheme({ main = {0.8, 0.4, 0.2} })
      assert(D:GetColor('primary')[1] == 0.8 and D:GetColor('mainColor')[2] == 0.4)
      assert(math.abs(D:GetColor('mainBorder')[1] - 0.28) < 0.000001)
      D:WithTheme({ mainColor = {0.2, 0.6, 1} }, function()
        assert(D:GetColor('mainHover')[3] == 0.2)
      end)
      assert(D:GetColor('main')[1] == 0.8)
      D:SetMainColor({0, 0.902, 1})
      assert(D:GetColor('primary')[1] == 0)
    `],
    ["selected buttons keep hover styling after the pointer leaves", `
      local first = UI:CreateButton({}, 'Kill')
      local second = UI:CreateButton({}, 'Loot')
      first.scripts.OnEnter(first)
      first:SetSelected(true)
      first.scripts.OnLeave(first)
      assert(first:IsSelected() and first.bg.color[1] ~= D:GetColor('surface')[1])
      assert(first.label.textColor[1] == D:GetColor('primary')[1])
      second.scripts.OnEnter(second)
      second:SetSelected(true)
      first:SetSelected(false)
      assert(second.bg.color[1] ~= D:GetColor('surface')[1])
      assert(first.bg.color[1] == D:GetColor('surface')[1])
      assert(first.label.textColor[1] == D:GetColor('subtext')[1])
      second:SetSelected(false)
      second.scripts.OnLeave(second)
      assert(second.bg.color[1] == D:GetColor('surface')[1])
    `],
    ["unbound label forwards one native checkbox click and current handler", `
      local row = UI:CreateCheckbox({}, 'Enable option')
      local calls = 0
      row.checkbox:SetScript('OnClick', function(self, button)
        calls = calls + 1
        assert(self == row.checkbox and button == 'LeftButton' and self:GetChecked())
      end)
      row.labelButton:Click()
      assert(calls == 1 and row.checkbox:GetChecked())
      row.checkbox:SetScript('OnClick', function() calls = calls + 10 end)
      row.labelButton:Click()
      assert(calls == 11 and not row.checkbox:GetChecked())
      assert(row.labelButton.points[1][2] == row.label and row.labelButton.points[2][2] == row.label)
    `],
    ["bound label, box, and reset share persisted state", `
      local storage, calls = {flag = false}, 0
      local reset
      local factory = UI.CreateResetButton
      UI.CreateResetButton = function(_, parent, action) reset = action; return CreateFrame('Button', nil, parent) end
      local row = UI:CreateToggle({}, {key = 'flag', storage = storage, default = false,
        onChange = function(value) calls = calls + 1; assert(storage.flag == value) end})
      UI.CreateResetButton = factory
      row.labelButton:Click()
      assert(storage.flag and row.check:GetChecked() and calls == 1)
      row.check:Click()
      assert(not storage.flag and not row.check:GetChecked() and calls == 2)
      row.labelButton:Click(); reset()
      assert(not storage.flag and not row.check:GetChecked() and calls == 4)
    `],
    ["toggle hover callbacks compose with the control and stay isolated", `
      local storage, events, seen = {flag = true}, {}, {}
      local toggle = UI:CreateToggle({}, {key = 'flag', storage = storage, default = false,
        onEnter = function(self) events[#events + 1] = 'enter'; seen.enter = self end,
        onLeave = function(self) events[#events + 1] = 'leave'; seen.leave = self end})
      assert(toggle.check.scripts.OnEnter and toggle.check.scripts.OnLeave, 'toggle hover hooks missing')
      toggle.check.scripts.OnEnter(toggle.check)
      toggle.check.scripts.OnLeave(toggle.check)
      assert(events[1] == 'enter' and events[2] == 'leave', 'toggle hover callbacks must fire in enter/leave order')
      assert(seen.enter == toggle.check and seen.leave == toggle.check, 'toggle hover self must be the check')
      assert(storage.flag == true and toggle.check:GetChecked(), 'hover must not change persisted state')
      local reported = RGXFramework.errors
      local leaves, later = 0, 0
      local failing = UI:CreateToggle({}, {key = 'x', storage = {}, default = true,
        onEnter = function() error('hover boom') end, onLeave = function() leaves = leaves + 1 end})
      failing.check.scripts.OnEnter(failing.check)
      assert(RGXFramework.errors == reported + 1, 'failing hover callback must be reported')
      failing.check:HookScript('OnEnter', function() later = later + 1 end)
      failing.check.scripts.OnEnter(failing.check)
      failing.check.scripts.OnLeave(failing.check)
      assert(later == 1 and leaves == 1, 'later hooks and OnLeave must still run after a failure')
    `],
    ["checkbox hover callbacks fire without breaking label forwarding", `
      local events, seen = {}, {}
      local row = UI:CreateCheckbox({}, 'Enable option', {
        onEnter = function(self) events[#events + 1] = 'in'; seen.enter = self end,
        onLeave = function() events[#events + 1] = 'out' end})
      assert(row.checkbox.scripts.OnEnter and row.checkbox.scripts.OnLeave, 'checkbox hover hooks missing')
      row.checkbox.scripts.OnEnter(row.checkbox)
      row.checkbox.scripts.OnLeave(row.checkbox)
      assert(events[1] == 'in' and events[2] == 'out', 'checkbox hover must fire in enter/leave order')
      assert(seen.enter == row.checkbox, 'checkbox hover self must be the checkbox')
      row.labelButton:Click()
      assert(row.checkbox:GetChecked(), 'hover hooks must not break label forwarding')
    `],
    ["bound text input commits, projects placeholder, and resets", `
      local storage, committed = {}, {}
      local reset
      local factory = UI.CreateResetButton
      UI.CreateResetButton = function(_, parent, action) reset = action; return CreateFrame('Button', nil, parent) end
      local control = UI:CreateTextInput({}, {key = 'keyword', storage = storage, default = '',
        placeholder = 'Type here', onChange = function(text) committed[#committed + 1] = text end})
      UI.CreateResetButton = factory
      assert(control.input and control.label and control.resetButton, 'parts missing')
      assert(control:GetValue() == '', 'text input did not bind storage')
      assert(control.input:GetText() == 'Type here', 'placeholder not projected while empty')
      assert(control.input.textColor[1] == D:GetColor('subtext')[1], 'placeholder must render muted')
      control.input.scripts.OnEditFocusGained(control.input)
      assert(control.input:GetText() == '', 'placeholder must clear on focus')
      control.input:SetText('Warcraft')
      control.input.scripts.OnEnterPressed(control.input)
      assert(storage.keyword == 'Warcraft' and committed[1] == 'Warcraft', 'Enter must commit')
      assert(control.input.textColor[1] ~= D:GetColor('subtext')[1], 'committed text must not stay muted')
      control.input:SetText('')
      control.input.scripts.OnEscapePressed(control.input)
      assert(storage.keyword == '' and committed[2] == '', 'empty commit must fall back to default')
      assert(control.input:GetText() == 'Type here', 'placeholder must return after empty commit')
      control.input:SetText('Uncommitted')
      control.input.scripts.OnEditFocusLost(control.input)
      assert(storage.keyword == '' and control.input:GetText() == 'Type here', 'blur must discard uncommitted text')
      reset()
      assert(storage.keyword == '' and committed[3] == '', 'reset must commit the default')
    `],
    ["text input SetValue and Refresh stay storage-bound", `
      local store, fired = { keyword = 'old' }, 0
      local control = UI:CreateTextInput({}, {key = 'keyword', storage = store, default = 'fallback',
        onChange = function() fired = fired + 1 end})
      assert(control:GetValue() == 'old', 'stored value must win over the default')
      store.keyword = nil
      control:Refresh()
      assert(control.input:GetText() == 'fallback' and fired == 0, 'Refresh must re-project without firing')
      control:SetValue('new')
      assert(store.keyword == 'new' and control.input:GetText() == 'new' and fired == 1, 'SetValue must commit like a user edit')
    `],
    ["panel alpha persists, snaps to presets, and resets", `
      local storage = {}
      local reset
      local factory = UI.CreateResetButton
      UI.CreateResetButton = function(_, parent, action) reset = action; return CreateFrame('Button', nil, parent) end
      local control = UI:CreatePanelAlpha({}, {
        key = 'panelAlpha', storage = storage, default = 80,
        presets = { { label = 'Low', value = 25 }, { label = 'High', value = 100 } },
      })
      UI.CreateResetButton = factory
      assert(control.button and control.valueLabel and control.presetRow, 'panel alpha parts missing')
      assert(#control.presetButtons == 2, 'preset buttons missing')
      assert(storage.panelAlpha == 80 and control.valueLabel:GetText() == '80%', 'default must bind and project')
      control.presetButtons[1]:Click()
      assert(storage.panelAlpha == 25 and control.valueLabel:GetText() == '25%', 'preset must snap the slider')
      control:SetValue(42)
      assert(storage.panelAlpha == 42 and control.valueLabel:GetText() == '42%', 'SetValue must persist')
      reset()
      assert(storage.panelAlpha == 80 and control.valueLabel:GetText() == '80%', 'reset must restore the default')
    `],
    ["disabled checkbox rejects label activation", `
      local row = UI:CreateCheckbox({}, 'Disabled')
      row.checkbox:SetChecked(false)
      row.checkbox:SetScript('OnClick', function() error('disabled handler called') end)
      row.checkbox:Disable(); row.labelButton:Click()
      assert(row.checkbox:GetChecked() == false)
    `],
    ["hover callbacks compose with real design styling", `
      local enter, leave = 0, 0
      local btn = UI:CreateButton({}, {text = 'Preview',
        onEnter = function(self) enter = enter + 1; assert(self.bg.color[1] == D:GetColor('hover')[1]) end,
        onLeave = function(self) leave = leave + 1; assert(self.bg.color[1] == D:GetColor('surface')[1]) end})
      btn.scripts.OnEnter(btn); btn.scripts.OnLeave(btn)
      assert(enter == 1 and leave == 1)
    `],
    ["failing hover observer leaves styling and later hooks working", `
      local before, called = RGXFramework.errors, false
      local btn = UI:CreateButton({}, {text = 'Preview', onEnter = function() error('expected') end})
      btn:HookScript('OnEnter', function() called = true end)
      btn.scripts.OnEnter(btn)
      assert(called and RGXFramework.errors == before + 1)
      assert(btn.bg.color[1] == D:GetColor('hover')[1])
      btn.scripts.OnLeave(btn)
      assert(btn.bg.color[1] == D:GetColor('surface')[1])
    `],
    ["bound color control re-projects storage on Refresh and before opening", `
      local captured = nil
      RGXFramework:RegisterModule('colorpicker', {
        Show = function(_, color) captured = color end,
      })
      local store = { color = { r = 1, g = 1, b = 1 } }
      local control = UI:CreateColorPicker({}, { key = 'color', storage = store, default = { r = 1, g = 1, b = 1 } })
      assert(type(control.Refresh) == 'function', 'color control exposes no Refresh')
      assert(control.swatch and control.swatch.tex, 'color control exposes no swatch texture')
      store.color = { r = 0, g = 0.5, b = 1 }
      control:Refresh()
      local c = control.swatch.tex.color
      assert(c[1] == 0 and c[2] == 0.5 and c[3] == 1, 'Refresh did not repaint the swatch from storage')
      control.swatch:Click()
      assert(captured and captured.r == 0 and captured.g == 0.5 and captured.b == 1, 'opening used a stale color')
    `],
    ["SetTheme accepts named RGB values and WithTheme scopes them", `
      D:SetTheme({ primary = { r = 0.1, g = 0.2, b = 0.3 }, accent = { r = 0.4, g = 0.5, b = 0.6 } })
      assert(D:GetColor('primary')[1] == 0.1 and D:GetColor('primary')[3] == 0.3)
      assert(D:GetColor('accent')[2] == 0.5)
      D:WithTheme({ primary = { r = 0.7, g = 0.8, b = 0.9 } }, function()
        assert(D:GetColor('primary')[1] == 0.7)
      end)
      assert(D:GetColor('primary')[1] == 0.1)
    `],
    ["Design styles own corners and palette, not color tokens", `
      local pr, pg, pb = D:Unpack('primary')
      assert(D:SetStyle('classic') and D:GetStyle() == 'classic')
      assert(D.cornerStyle == 'square', 'classic must be square')
      assert(D:GetColor('border')[1] == 0.25, 'classic palette did not apply')
      assert(D:SetStyle('retail') and D.cornerStyle == 'rounded')
      assert(not D:SetStyle('bogus') and D:GetStyle() == 'retail', 'unknown style changed state')
      local qr, qg, qb = D:Unpack('primary')
      assert(qr == pr and qg == pg and qb == pb, 'style touched primary')
      assert(D:SetStyle('framework') and D.cornerStyle == 'rounded')
      assert(D:GetColor('border')[1] == 0.137, 'framework palette did not restore')
    `],
    ["RGX styles: framework, materialround and classic are listed in order with their names", `
      local labels = {}
      for _, id in ipairs(D.STYLE_ORDER) do labels[#labels + 1] = D.STYLES[id].label end
      assert(table.concat(labels, '|') == 'RGX Framework|RGX Material Round|RGX Classic|RGX Forever', 'style names: ' .. table.concat(labels, '|'))
      assert(D.STYLES.retail == nil, 'the retail alias must not be listed')
      assert(D:ResolveStyle('retail') == 'framework' and D:ResolveStyle('forever') == 'forever', 'retail alias or forever id lost')
      assert(D:ResolveStyle('bogus') == nil)
      assert(D:SetStyle('forever') and D:GetStyleId() == 'forever' and D.cornerStyle == 'square')
      assert(D:GetStyleLabel() == 'RGX Forever')
      assert(D:SetStyle('framework') and D:GetStyleId() == 'framework')
    `],
    ["RGX Forever: square, bronze frame line, parchment text; titles follow the mod's accent", `
      assert(D:SetStyle('forever') and D:GetStyleId() == 'forever' and D.cornerStyle == 'square')
      assert(D:GetStyleLabel() == 'RGX Forever')
      local ring, text = D:GetColor('ring'), D:GetColor('text')
      assert(ring[1] > ring[3] * 2, 'ring must be a bronze line, not grey')
      assert(text[1] > text[3], 'text must be warm parchment')
      assert(D.styleOptions.titleFrom == 'accent' and D.styleOptions.controlStyle == 'square' and D.styleOptions.frameArt == 'forever')
      local f = D:CreateFrame(UIParent, { width = 100, height = 50 })
      assert(f._panelLine and f._panelFill and f._panelBorder, 'a Forever panel draws the framed art: ring, fill and inner line')
      local g = D:CreateFrame(UIParent, { width = 100, height = 50, square = true })
      assert(g._panelFill == nil, 'an explicit square request still gets the plain backdrop')
      assert(D:SetStyle('framework'))
      local h = D:CreateFrame(UIParent, { width = 100, height = 50 })
      assert(h._panelLine == nil, 'other styles draw no inner line')
      assert(D:SetStyle('forever'))
      assert(D:SetStyle('framework') and D:GetColor('ring')[1] == 0.137, 'framework palette did not restore')
    `],
    ["RGX Material Round: rounded cards, header bands and buttons; ring and titles come from the mod's primary/accent", `
      local RED, CORAL = { 0.545, 0.082, 0.220 }, { 0.929, 0.420, 0.522 }
      assert(D:SetStyle('materialround') and D:GetStyleId() == 'materialround' and D.cornerStyle == 'rounded')
      local fill = D:GetColor('surface')
      assert(fill[1] == fill[2] and fill[3] > fill[1] and fill[1] < 0.2, 'fills stay grey/dark, never brand coloured')
      local parent = CreateFrame('Frame')
      D:WithTheme({ primary = RED, accent = CORAL }, function()
        local ring = D:GetColor('ring')
        assert(ring[1] == RED[1] and ring[2] == RED[2] and ring[3] == RED[3], 'ring must be the mod primary colour')
        local header = D:CreateSectionHeader(parent, 'Materials')
        assert(header._panelBorder and header._panelFill, 'material round header is a rounded band')
        local c = header.label.textColor
        assert(c[1] == CORAL[1] and c[2] == CORAL[2] and c[3] == CORAL[3], 'card titles must be the mod accent colour')
        local card = D:CreateFrame(parent, {})
        assert(card._panelBorder and card._panelFill, 'cards are rounded panels')
        local btn = D:CreateButton(parent, 'Go', 100, 24)
        assert(btn._panelBorder and btn._panelFill, 'buttons are rounded in material round')
        assert(btn.bg and btn.bg.SetColorTexture and btn.border and btn.border.SetBackdropBorderColor, 'bg/border surface is kept for callers')
        btn.scripts.OnEnter(btn)
        assert(btn.label.textColor[1] == CORAL[1] and btn.label.textColor[3] == CORAL[3], 'hover label is the mod accent colour')
        btn.scripts.OnLeave(btn)
      end)
      -- a different mod, a different brand: the same style, branded by that mod
      D:WithTheme({ primary = { 0.1, 0.6, 0.9 }, accent = { 0.9, 0.9, 0.2 } }, function()
        local ring = D:GetColor('ring')
        assert(ring[1] == 0.1 and ring[2] == 0.6 and ring[3] == 0.9, 'another mod gets its own ring colour')
        local c = D:CreateSectionHeader(parent, 'Other').label.textColor
        assert(c[1] == 0.9 and c[2] == 0.9 and c[3] == 0.2, 'another mod gets its own title colour')
      end)
      assert(D:SetStyle('framework'))
      local plain = D:CreateButton(parent, 'Go', 100, 24)
      assert(not plain._panelBorder, 'framework style keeps its square button')
      local plainHeader = D:CreateSectionHeader(parent, 'Plain')
      assert(not plainHeader._panelBorder, 'framework style keeps its square header')
      assert(D:GetColor('ring')[1] == 0.137, 'framework ring is the border colour again, whatever the brand colour')
    `],
    ["Design:WithStyle builds in a style and restores the operator's choice", `
      assert(D:SetStyle('classic'))
      local seen
      D:WithTheme({ primary = { 0.545, 0.082, 0.220 } }, function()
        D:WithStyle('materialround', function()
          seen = { id = D:GetStyleId(), corner = D.cornerStyle, ring = D:GetColor('ring')[1], rounded = D:CreateButton(CreateFrame('Frame'), 'x')._panelBorder ~= nil }
        end)
        assert(D:GetColor('ring')[1] == 0.25, 'classic ring must be back after WithStyle')
      end)
      assert(seen.id == 'materialround' and seen.corner == 'rounded' and seen.ring == 0.545 and seen.rounded, 'scoped style not applied')
      assert(D:GetStyleId() == 'classic' and D.cornerStyle == 'square', 'style not restored')
      assert(D:GetColor('border')[1] == 0.25 and D:GetColor('ring')[1] == 0.25, 'palette not restored')
      assert(D:CreateButton(CreateFrame('Frame'), 'x')._panelBorder == nil, 'button treatment not restored')
      local ok = pcall(function() D:WithStyle('materialround', function() error('boom') end) end)
      assert(not ok and D:GetStyleId() == 'classic', 'a failing builder must still restore the style')
      assert(not pcall(function() D:WithStyle('bogus', function() end) end), 'unknown style must be rejected')
      D:SetStyle('framework')
    `],
    ["a rounded button keeps the building mod's ring colour on hover, after the mod's theme scope has ended", `
      local RED = { 0.545, 0.082, 0.220 }
      local btn
      D:WithTheme({ primary = RED, accent = { 0.9, 0.4, 0.5 } }, function()
        D:WithStyle('materialround', function() btn = D:CreateButton(CreateFrame('Frame'), 'Go', 100, 24) end)
      end)
      D:SetTheme({ primary = { 0.1, 0.8, 0.2 } })   -- another mod owns the shared theme now
      local seen
      btn.SetPanelColor = function(_, fill, border) if border then seen = border end end
      btn.scripts.OnEnter(btn)
      assert(seen and seen[1] == RED[1] and seen[2] == RED[2] and seen[3] == RED[3], 'hover ring must stay the building mod colour')
      D:SetTheme({ primary = { 0, 0.902, 1 }, accent = { 0.737, 0.435, 0.659 } })
    `],
    ["WithTheme and WithStyle hand back what the builder returns", `
      local frame = D:WithTheme({ primary = { 0.5, 0.5, 0.5 } }, function() return D:WithStyle('materialround', function() return 'built', 7 end) end)
      assert(frame == 'built', 'builder result lost')
      local a, b = D:WithStyle('classic', function() return 'x', 'y' end)
      assert(a == 'x' and b == 'y', 'multiple results lost')
      D:SetStyle('framework')
    `],
    ["every style is branded by the mod: highlights follow primary/accent in framework, classic and material round", `
      local BRAND = { 0.2, 0.7, 0.3 }
      D:WithTheme({ primary = BRAND, accent = { 0.8, 0.2, 0.6 } }, function()
        for _, id in ipairs({ 'framework', 'classic', 'materialround' }) do
          D:WithStyle(id, function()
            local p = D:GetColor('primary')
            assert(p[1] == BRAND[1] and p[2] == BRAND[2] and p[3] == BRAND[3], id .. ' must pass the mod primary through')
            assert(D:GetColor('accent')[1] == 0.8, id .. ' must pass the mod accent through')
          end)
        end
      end)
    `],
    ["confirm dialog fires once, hides, and joins UISpecialFrames", `
      UISpecialFrames = {}
      local fired = 0
      local d = UI:Confirm({ title = 'Reset', message = 'Sure?', confirm = 'Yes', cancel = 'No',
        onConfirm = function() fired = fired + 1 end })
      assert(d:IsShown(), 'confirm did not show')
      assert(d.message:GetText() == 'Sure?', 'message not projected')
      local listed = 0
      for _, name in ipairs(UISpecialFrames) do if name == 'RGXConfirmDialog' then listed = listed + 1 end end
      assert(listed == 1, 'ESC registration missing or duplicated')
      d.cancelButton:Click()
      assert(fired == 0 and not d:IsShown(), 'cancel fired or stayed open')
      UI:Confirm({ title = 'Reset', message = 'Again?', onConfirm = function() fired = fired + 1 end })
      assert(d.message:GetText() == 'Again?', 'singleton did not reconfigure')
      assert(d.confirmButton.label:GetText() == 'Confirm', 'button text did not reset to default')
      d.confirmButton:Click()
      assert(fired == 1 and not d:IsShown(), 'confirm did not fire and close')
      local before = RGXFramework.errors
      UI:Confirm({ message = 'Boom', onConfirm = function() error('expected') end })
      d.confirmButton:Click()
      assert(RGXFramework.errors == before + 1 and not d:IsShown(), 'failing confirm was not isolated')
    `],
  ];
  for (const [name, script] of scenarios) {
    lua.doStringSync(script);
    console.log(`PASS ${name}`);
  }
  console.log(`CONTROL INTERACTION OK ${scenarios.length} scenarios (engine geometry remains manual).`);
} finally { lua.global.close(); }
