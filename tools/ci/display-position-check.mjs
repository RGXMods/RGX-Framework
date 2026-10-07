import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lua } from 'wasmoon-lua5.1';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const lua = await Lua.create();
lua.ctx.source = readFileSync(join(root, 'modules/display/display.lua'), 'utf8');
try {
  lua.doStringSync(`
    local effectiveScale = 1
    local cursor = { x = 0, y = 0 }
    local errors = {}

    local function TextureMock()
      return {
        SetAllPoints = function() end,
        SetColorTexture = function() end,
      }
    end

    local function FrameMock(parent)
      local f = { scripts = {}, shown = true, width = 0, height = 0, parent = parent }      function f:SetSize(w, h) self.width, self.height = w, h end
      function f:GetWidth() return self.width end
      function f:GetHeight() return self.height end
      function f:ClearAllPoints()
        self.point, self.relativeTo, self.relativePoint, self.ox, self.oy = nil, nil, nil, nil, nil
      end
      function f:SetPoint(point, relativeTo, relativePoint, x, y)
        self.point, self.relativeTo, self.relativePoint, self.ox, self.oy = point, relativeTo, relativePoint, x, y
      end
      function f:SetAllPoints(other) self.allPoints = other end
      function f:SetScale(value) self.scale = value end
      function f:GetScale() return self.scale end
      function f:SetAlpha(value) self.alpha = value end
      function f:GetAlpha() return self.alpha end
      function f:SetShown(value) self.shown = value and true or false end
      function f:Show() self.shown = true end
      function f:Hide() self.shown = false end
      function f:IsShown() return self.shown end
      function f:EnableMouse() end
      function f:RegisterForDrag() end
      function f:SetScript(key, handler) self.scripts[key] = handler end
      function f:GetScript(key) return self.scripts[key] end
      function f:GetEffectiveScale() return effectiveScale end
      function f:CreateTexture() return TextureMock() end
      return f
    end

    function CreateFrame(_, _, parent) return FrameMock(parent) end
    UIParent = FrameMock(nil)

    function SetEffectiveScale(value) effectiveScale = value end
    function SetCursor(x, y) cursor.x, cursor.y = x, y end
    function GetCursorPosition() return cursor.x, cursor.y end

    RGXFramework = {}
    local RGX = {}
    function RGX:Error(message) errors[#errors + 1] = message end
    function RGX:RegisterModule(name, module, opts)
      assert(name == 'display', 'module must register as display')
      assert(type(module) == 'table', 'module must be a table')
      assert(opts and opts.category == 'library', 'display must register as a library module')
      assert(_G.RGXDisplay == module, 'RGXDisplay global must alias the registered module')
    end

    assert(loadstring(source))('RGX-Framework', RGX)

    local Display = RGXDisplay
    assert(Display and Display.name == 'display' and Display.version == '1.0.0', 'module identity')

    local names = Display:ListPositions()
    assert(#names == 7, 'expected 7 built-in positions, got ' .. #names)

    assert(Display:RegisterPosition('TEST', { point = 'TOPLEFT', x = 4 }) == true)
    names = Display:ListPositions()
    assert(#names == 8, 'expected 8 positions after register')
    assert(names[1] == 'BOTTOM' and names[8] == 'TOP', 'positions must be sorted')
    local copy = Display:GetPosition('TEST')
    copy.x = 999
    assert(Display:GetPosition('TEST').x == 4, 'GetPosition must return a copy')
    copy = Display:GetPosition('LEFT')
    copy.spreadX = 99
    assert(Display:GetPosition('LEFT').spreadX == -1, 'built-in spec must stay immutable')
    assert(Display:GetPosition('NOPE') == nil, 'unknown position must return nil')

    local ok, err = Display:RegisterPosition('', { point = 'CENTER' })
    assert(ok == nil and err, 'empty position name must reject')
    ok, err = Display:RegisterPosition('BAD', { point = 7 })
    assert(ok == nil and err, 'non-string point must reject')
    ok, err = Display:RegisterPosition('BAD', { point = 'CENTER', x = 'left' })
    assert(ok == nil and err, 'non-numeric offset must reject')

    local left = assert(Display:CreateElement({ name = 'Left', position = 'LEFT', x = 5, spread = 2 }))
    assert(left.frame.point == 'RIGHT' and left.frame.relativePoint == 'LEFT', 'LEFT anchor pair')
    assert(left.frame.ox == 3 and left.frame.oy == 0, 'LEFT applied offset math')

    local outside = assert(Display:CreateElement({ name = 'Out', position = 'LEFTOUTSIDE' }))
    assert(outside.frame.ox == -160 and outside.frame.oy == 0, 'LEFTOUTSIDE offset')

    assert(left.frame.width == 64 and left.frame.height == 64, 'default size must be 64')
    assert(left.content.allPoints == left.frame, 'content must fill the container')

    local scaled = assert(Display:CreateElement({ name = 'Scaled', scale = 80, alpha = 0.5 }))
    assert(scaled.content.scale == 0.8 and scaled.content.alpha == 0.5, 'content scale/alpha')

    assert(Display:RegisterDefaults('combat', { scale = 150, alpha = 2 }) == true)
    local combatDefaults = Display:GetDefaults('combat')
    assert(combatDefaults.scale == 150 and combatDefaults.alpha == 1, 'alpha must clamp to 1')
    local unknownDefaults = Display:GetDefaults('unknown')
    assert(unknownDefaults.scale == 100 and unknownDefaults.alpha == 1, 'unknown context fallback')
    ok, err = Display:RegisterDefaults('bad', { scale = 0 })
    assert(ok == nil and err, 'context scale must be > 0')

    local combat = assert(Display:CreateElement({ name = 'Combat', context = 'combat' }))
    assert(combat.content.scale == 1.5, 'context scale resolution')
    assert(combat:SetScale(nil) == true and combat.content.scale == 1.5, 'nil scale inherits context')
    assert(combat:SetAlpha(nil) == true and combat.content.alpha == 1, 'nil alpha inherits context')
    ok, err = combat:SetScale(-5)
    assert(ok == nil and err, 'negative explicit scale must reject')

    ok, err = Display:CreateElement({})
    assert(ok == nil and err, 'missing name must reject')
    ok, err = Display:CreateElement({ name = '' })
    assert(ok == nil and err, 'empty name must reject')
    ok, err = Display:CreateElement({ name = 'Left' })
    assert(ok == nil and err, 'duplicate name must reject')
    ok, err = Display:CreateElement({ name = 'BadPos', position = 'NOWHERE' })
    assert(ok == nil and err, 'unknown position name must reject')

    local inline = assert(Display:CreateElement({
      name = 'Inline',
      position = { point = 'TOPLEFT', relativePoint = 'TOPLEFT', x = 1, y = 2 },
    }))
    assert(inline.frame.point == 'TOPLEFT' and inline.frame.ox == 1 and inline.frame.oy == 2, 'inline spec anchor')
    assert(Display:GetDefaults('default').scale == 100, 'default context scale is 100')
    assert(inline:SetPositionName('CENTER') == true)
    assert(inline.frame.point == 'CENTER' and inline.frame.ox == 0, 'named position switch')
    ok, err = inline:SetPositionName('NOWHERE')
    assert(ok == nil and err, 'unknown position switch must reject')
    assert(inline:GetResolved().position == 'CENTER', 'resolved named position')

    RGXFrameworkDB = { RGXDisplayPositions = { Durable = { x = 12, y = -7 } } }
    local consumerStorage = { Durable = { x = 1, y = 1 } }
    local durable = assert(Display:CreateElement({ name = 'Durable', storage = consumerStorage }))
    assert(durable.frame.ox == 12 and durable.frame.oy == -7, 'durable offset must win')
    assert(consumerStorage.Durable.x == 12 and consumerStorage.Durable.y == -7, 'durable win must mirror to consumer storage')

    local storageEntry = { x = 4, y = 6 }
    local restored = assert(Display:CreateElement({ name = 'Restored', storage = { Restored = storageEntry } }))
    assert(restored.frame.ox == 4 and restored.frame.oy == 6, 'consumer storage restore')

    assert(restored:SetOffset(9, -3) == true)
    assert(restored.frame.ox == 9 and restored.frame.oy == -3, 'SetOffset applies')
    assert(storageEntry.x == 9 and storageEntry.y == -3, 'SetOffset persists to consumer storage')
    assert(RGXFrameworkDB.RGXDisplayPositions.Restored.x == 9, 'SetOffset persists to durable store')
    ok, err = restored:SetOffset('9', 0)
    assert(ok == nil and err, 'SetOffset requires numbers')

    assert(left:SetSpread(4) == true)
    assert(left.frame.ox == 1, 'spread applies along the position axis')
    assert(restored:SetContext('combat') == true and restored.content.scale == 1.5, 'SetContext switch')
    assert(restored:SetSize(40, 30) == true and restored.frame.width == 40 and restored.frame.height == 30)
    ok, err = restored:SetSize(0, 30)
    assert(ok == nil and err, 'SetSize must reject non-positive')
    restored:SetShown(false)
    assert(restored:IsShown() == false and restored.frame.shown == false)
    restored:SetShown(true)
    assert(restored:IsShown() == true)

    local resolved = restored:GetResolved()
    assert(resolved.position == 'CENTER' and resolved.x == 9, 'GetResolved offset')
    assert(resolved.scale == 150 and resolved.alpha == 1, 'GetResolved context values')

    SetEffectiveScale(2)
    Display:SetEditMode(true)
    assert(Display:IsEditMode() == true)
    local moveCalls = 0
    local dragged
    dragged = assert(Display:CreateElement({
      name = 'Dragged',
      position = 'CENTER',
      onMove = function(element)
        moveCalls = moveCalls + 1
        assert(element == dragged, 'onMove receives the element')
      end,
    }))
    assert(dragged._mover and dragged._mover.parent == dragged.content, 'mover must be a content child')
    assert(dragged._mover.shown == true, 'mover must show in edit mode')

    SetCursor(200, 100)
    dragged._mover.scripts.OnDragStart()
    SetCursor(260, 60)
    dragged._mover.scripts.OnUpdate()
    assert(dragged.frame.ox == 30 and dragged.frame.oy == -20, 'drag delta at parent scale 2')
    dragged._mover.scripts.OnDragStop()
    assert(dragged._mover.scripts.OnUpdate == nil, 'OnUpdate must clear after drag stops')
    assert(moveCalls == 1, 'onMove must fire once per drag')
    assert(RGXFrameworkDB.RGXDisplayPositions.Dragged.x == 30, 'drag persists to durable store')

    local isolated = assert(Display:CreateElement({
      name = 'Isolated',
      onMove = function() error('boom') end,
    }))
    SetCursor(10, 10)
    isolated._mover.scripts.OnDragStart()
    SetCursor(20, 20)
    isolated._mover.scripts.OnUpdate()
    isolated._mover.scripts.OnDragStop()
    assert(#errors == 1 and errors[1]:find('onMove error', 1, true), 'onMove errors must be isolated')

    Display:SetEditMode(false)
    assert(Display:IsEditMode() == false)
    assert(dragged._mover.shown == false and isolated._mover.shown == false, 'movers hidden when edit mode off')

    assert(dragged:Destroy() == true)
    local reused = assert(Display:CreateElement({ name = 'Dragged' }))
    assert(reused ~= nil and reused.frame.ox == 30, 'name reusable and durable offset survives Destroy')
  `);
  console.log('DISPLAY POSITION OK: anchors, offsets, scale/alpha resolution, defaults contexts, durable restore, drag/mover and onMove isolation');
} finally { lua.global.close(); }
