import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Lua } from 'wasmoon-lua5.1';
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const lua = await Lua.create();
lua.ctx.source = readFileSync(join(root, 'modules/ui/layout.lua'), 'utf8');
try {
  lua.doStringSync(`
    RGXFramework = {}
    local UI = {}
    assert(loadstring(source))('RGX-Framework', UI)
    local function frame(width, height)
      local f = { width = width, height = height }
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
  `);
  console.log('LAYOUT CARD OK: actual CreateCard/AutoHeight, colon/dot calls, padding, non-overlap and reflow');
} finally { lua.global.close(); }
