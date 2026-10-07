import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lua } from 'wasmoon-lua5.1';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const lua = await Lua.create();
lua.ctx.source = readFileSync(join(root, 'modules/ui/layout.lua'), 'utf8');
const controls = readFileSync(join(root, 'modules/ui/controls.lua'), 'utf8');
lua.ctx.columns = controls.slice(controls.indexOf('function UI:CreateColumns'), controls.indexOf('-- Versioned label definitions'));
try {
  lua.doStringSync(`
    RGXFramework = {}
    local UI = {}
    assert(loadstring(source))('RGX-Framework', UI)
    local function frame(width, height)
      local f = { width = width, height = height, scripts = {} }
      function f:HookScript(key, callback)
        local previous = self.scripts[key]
        self.scripts[key] = function(...) if previous then previous(...) end callback(...) end
      end
      function f:GetWidth() return self.width end
      function f:GetHeight() return self.height end
      function f:SetWidth(value) self.width = value end
      function f:SetHeight(value) self.height = value end
      function f:ClearAllPoints() end
      function f:SetPoint(_, x, y) self.x = x; self.y = y end
      return f
    end
    function UI:CreateSection()
      local card = frame(300, 200)
      card.headerBand = {}
      card.content = frame(300, 146)
      return card
    end
    function CreateFrame(_, _, parent) return frame(parent:GetWidth(), parent:GetHeight()) end
    assert(loadstring('return function(UI) '..columns..' end'))()(UI)
    local card = UI:CreateCard(frame(300, 300), { title = 'Quest Toast' })
    local size, reset = frame(200, 38), frame(190, 20)
    card.flow:Add(size, { fill = true })
    card.flow:Add(reset, { fill = true })
    assert(card:AutoHeight() == card, 'method call must return card')
    assert(reset.y <= size.y - size.height - 8, 'reset overlaps slider')
    assert(card.height == 42 + 38 + 8 + 20 + 12, 'incorrect flow height')
    card:AutoHeight(6)
    assert(card.height == 126, 'method extra padding ignored')
    card.AutoHeight(2)
    assert(card.height == 122, 'legacy dot call padding changed')
    card.AutoHeight()
    assert(card.height == 120, 'legacy dot call failed')
    card.content.width = 180
    card:AutoHeight()
    assert(size.width == 180 and reset.width == 180, 'reflow width not restored')
    card.content.width = 240
    card.content.scripts.OnSizeChanged()
    assert(size.width == 240, 'card did not automatically reflow on width change')
    local rowHost, field, button = frame(300, 60), frame(10, 30), frame(40, 20)
    local flow = UI:CreateFlowLayout(rowHost)
    flow:AddRow({{child=field,fill=true},{child=button,align='right'}})
    flow:Apply()
    assert(field.width == 252 and button.x == 260, 'fill overlaps right-aligned control')
    assert(field.y == 0 and button.y == -5, 'row elements do not share a vertical center')
    button.width = 60; rowHost.width = 400; flow:Apply()
    assert(field.width == 332 and button.x == 340, 'row cached stale natural dimensions')
    local natural = frame(40, 20)
    local naturalFlow = UI:CreateFlowLayout(frame(200, 40)); naturalFlow:Add(natural)
    naturalFlow:Apply(); natural.width = 70; naturalFlow:Apply()
    assert(natural.width == 70, 'natural width was overwritten by cached layout')
    local function fontString(naturalWidth, lineHeight)
      local fs = frame(naturalWidth, lineHeight)
      fs.characterWidth = naturalWidth
      function fs:SetWordWrap(v) self.wrapped = v end
      function fs:GetHeight()
        if not self.width or self.width <= 0 then return self.height end
        if self.width >= self.characterWidth then return self.height end
        return self.height * math.ceil(self.characterWidth / self.width)
      end
      return fs
    end
    local textHost, text = frame(300, 60), fontString(600, 12)
    local textFlow = UI:CreateFlowLayout(textHost); textFlow:Add(text)
    textFlow:Apply()
    assert(text.width == 300 and text.wrapped, 'over-wide fontstring was not clamped and wrapped')
    assert(text:GetHeight() == 24, 'wrapped height was not measured for the row')
    textHost.width = 800; textFlow:Apply()
    assert(text.width == 600, 'clamped fontstring did not restore its natural width')
    textHost.width = 200; textFlow:Apply()
    assert(text.width == 200, 'fontstring was not re-clamped on narrow hosts')
    local two = UI:CreateCard(frame(300, 300), {columns=2})
    local short, tall = frame(10,20), frame(10,60)
    two.flows[1]:Add(short,{fill=true}); two.flows[2]:Add(tall,{fill=true}); two:AutoHeight()
    assert(two.height==114 and short.width==146 and tall.width==146,'two-column card does not fit its tallest column')
    two.content.width=100; two.content.scripts.OnSizeChanged()
    assert(short.width==46 and tall.width==46,'columns overflow the available narrow width')
    local one=UI:CreateCard(frame(300,300),{columns=1})
    one.flow:Add(frame(10,25),{fill=true});one:AutoHeight()
    assert(one.height==79 and one.columns[1]:GetWidth()==300,'single-column card drifted')
  `);
  console.log('LAYOUT CARD OK: actual CreateCard/AutoHeight, colon/dot calls, padding, non-overlap and reflow');
} finally { lua.global.close(); }
