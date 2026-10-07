#!/usr/bin/env node
// Execute the shipped factories and callbacks; mouse delivery is an engine seam.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";
const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const lua = await Lua.create();
lua.ctx.controls = readFileSync(join(root, "library/ui/controls.lua"), "utf8");
lua.ctx.design = readFileSync(join(root, "library/design/design.lua"), "utf8");
lua.ctx.layout = readFileSync(join(root, "library/ui/layout.lua"), "utf8");
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
      function w:SetText(text) self.text = text end
      function w:GetText() return self.text end
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
