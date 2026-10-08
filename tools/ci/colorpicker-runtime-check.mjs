#!/usr/bin/env node
// Honeycomb ColorPicker runtime harness: executes the real dialog + embedded
// picker against a mocked widget layer. Engine seams the mock cannot provide
// (frame left/bottom, cursor position) are assigned directly by the scenarios.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Lua } from "wasmoon-lua5.1";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const lua = await Lua.create();
lua.ctx.colorpicker = readFileSync(join(root, "library/colors/colorpicker.lua"), "utf8");
lua.ctx.design = readFileSync(join(root, "library/design/design.lua"), "utf8");
lua.ctx.scenarios = readFileSync(join(root, "tools/ci/colorpicker-runtime-test.lua"), "utf8");

// Asset verification: the runtime reads media/hexmask.tga and media/hexring.tga
// directly, so the checked-in bytes must match the geometry the picker assumes
// -- 64x64 power-of-two, 32bpp with 8 alpha bits, a centred flat-top hexagon of
// aspect 2:sqrt(3) with symmetric transparent top/bottom padding, and a ring
// that traces the fill boundary.
function readTga(path) {
  const buf = readFileSync(path);
  if (buf.length < 18) throw new Error(`${path}: too small for a TGA header`);
  const idLen = buf.readUInt8(0);
  const colorMap = buf.readUInt8(1);
  const imageType = buf.readUInt8(2);
  const width = buf.readUInt16LE(12);
  const height = buf.readUInt16LE(14);
  const bpp = buf.readUInt8(16);
  const desc = buf.readUInt8(17);
  const offset = 18 + idLen;
  if (buf.length - offset < width * height * (bpp / 8)) throw new Error(`${path}: truncated pixel data`);
  return {
    width, height, bpp, desc, imageType, colorMap, offset,
    alphaAt: (x, y) => buf[offset + (y * width + x) * 4 + 3],
  };
}

function visibleBox(tga) {
  let minX = tga.width, maxX = -1, minY = tga.height, maxY = -1;
  for (let y = 0; y < tga.height; y++) {
    for (let x = 0; x < tga.width; x++) {
      if (tga.alphaAt(x, y) > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

function checkAsset(cond, msg) {
  if (!cond) throw new Error("hex asset check failed: " + msg);
}

function verifyHexAssets() {
  const fill = readTga(join(root, "media/hexmask.tga"));
  const ring = readTga(join(root, "media/hexring.tga"));
  for (const [name, tga] of [["hexmask.tga", fill], ["hexring.tga", ring]]) {
    checkAsset(tga.imageType === 2 && tga.colorMap === 0, `${name}: not an uncompressed true-colour TGA`);
    checkAsset(tga.width === 64 && tga.height === 64, `${name}: ${tga.width}x${tga.height} is not 64x64 POT`);
    checkAsset((tga.width & (tga.width - 1)) === 0, `${name}: width is not a power of two`);
    checkAsset(tga.bpp === 32 && (tga.desc & 0x0f) === 8, `${name}: not 32bpp with 8 alpha bits`);
  }
  const fb = visibleBox(fill);
  const fw = fb.maxX - fb.minX + 1;
  const fh = fb.maxY - fb.minY + 1;
  const topPad = fb.minY;
  const botPad = fill.height - 1 - fb.maxY;
  checkAsset(fw === 64, `hexmask.tga: visible width ${fw} != 64`);
  checkAsset(Math.abs(fh - (64 * Math.sqrt(3)) / 2) <= 1.5, `hexmask.tga: visible height ${fh} is not 2:sqrt(3)`);
  checkAsset(Math.abs(topPad - botPad) <= 1, `hexmask.tga: padding not symmetric (${topPad}/${botPad})`);
  checkAsset(fill.alphaAt(32, 32) > 250, "hexmask.tga: centre is not opaque");
  checkAsset(fill.alphaAt(0, 0) < 5, "hexmask.tga: corner is not transparent");
  const rb = visibleBox(ring);
  checkAsset(rb.minX === fb.minX && rb.maxX === fb.maxX && rb.minY === fb.minY && rb.maxY === fb.maxY,
    "hexring.tga: ring does not trace the fill boundary");
  checkAsset(ring.alphaAt(32, 32) < 5, "hexring.tga: ring centre is not hollow");
  console.log("HEX ASSETS 64x64 POT, aspect 2:sqrt(3), symmetric padding, ring subset OK");
}

verifyHexAssets();

try {
  lua.doStringSync(`
    -- wasmoon's Lua 5.1 build may omit math.atan2; the grid hue mapping needs it.
    if not math.atan2 then
      math.atan2 = function(y, x) return math.atan(y, x) end
    end

    CREATED = {}
    local function widget(kind, parent)
      local w = { kind = kind, parent = parent, scripts = {}, points = {}, enabled = true, children = {} }
      if parent and parent.children then parent.children[#parent.children + 1] = w end
      function w:SetPoint(...) self.points[#self.points + 1] = {...} end
      function w:ClearAllPoints() self.points = {} end
      function w:SetAllPoints() self.allPoints = true end
      function w:SetScript(name, fn) self.scripts[name] = fn end
      function w:GetScript(name) return self.scripts[name] end
      function w:SetSize(width, height) self.width, self.height = width, height end
      function w:SetWidth(width) self.width = width end
      function w:SetHeight(height) self.height = height end
      function w:GetWidth() return self.width or 200 end
      function w:GetHeight() return self.height or 20 end
      function w:Show() self.shown = true end
      function w:Hide() self.shown = false end
      function w:IsShown() return self.shown ~= false end
      function w:SetColorTexture(...) self.color = {...} end
      function w:SetVertexColor(...) self.vertex = {...} end
      function w:GetVertexColor()
        local v = self.vertex or {}
        return v[1] or 1, v[2] or 1, v[3] or 1, v[4] or 1
      end
      function w:SetTexture(path) self.texture = path end
      function w:SetMask(path) self.mask = path end
      function w:SetGradient(orientation, from, to) self.gradient = { orientation, from, to } end
      function w:SetAlpha(a) self.alpha = a end
      function w:SetEffectiveScale(s) self.scale = s end
      function w:GetEffectiveScale() return self.scale or 1 end
      function w:SetScale(s) self.dialogScale = s end
      function w:GetLeft() return self.left or 0 end
      function w:GetBottom() return self.bottom or 0 end
      function w:GetParent() return self.parent end
      function w:GetText() return self.text end
      function w:SetText(text)
        self.text = text
        if self.kind == "EditBox" and self.scripts.OnTextChanged then
          self.scripts.OnTextChanged(self)
        end
      end
      function w:CreateTexture(...) return widget("Texture", self) end
      function w:CreateFontString(...) return widget("FontString", self) end
      for _, name in ipairs({
        "SetTextColor", "SetBackdrop", "SetBackdropColor", "SetBackdropBorderColor", "SetFontObject",
        "SetAutoFocus", "SetMaxLetters", "SetNumeric", "ClearFocus", "SetNormalTexture",
        "SetPushedTexture", "SetHighlightTexture", "SetCheckedTexture", "SetShadowColor",
        "SetShadowOffset", "SetJustifyH", "SetJustifyV", "SetOwner", "EnableMouse", "EnableKeyboard",
        "EnableMouseWheel", "SetMovable", "SetClampedToScreen", "SetFrameStrata", "SetResizable",
        "SetMinResize", "SetMaxResize", "RegisterForDrag", "StartMoving", "StopMovingOrSizing",
        "SetTexCoord", "SetFont", "SetTextInsets",
      }) do w[name] = function() end end
      function w:SetBackdropBorderColor(r, g, b, a) self.borderColor = { r, g, b, a } end
      return w
    end
    function CreateFrame(kind, _, parent)
      local w = widget(kind, parent)
      CREATED[#CREATED + 1] = w
      return w
    end
    function CreateColor(r, g, b, a) return { r = r, g = g, b = b, a = a } end

    cursorX, cursorY = 0, 0
    mouseDown = false
    function GetCursorPosition() return cursorX, cursorY end
    function IsMouseButtonDown() return mouseDown end
    function GetCVar() return "Interface\\Cursor\\Point" end
    function SetCVar() end

    UIParent = widget("Frame")
    GameTooltip = widget("Tooltip")

    RAID_CLASS_COLORS = {
      WARRIOR      = { r = 0.78, g = 0.61, b = 0.43 },
      PALADIN      = { r = 0.96, g = 0.55, b = 0.73 },
      HUNTER       = { r = 0.67, g = 0.83, b = 0.45 },
      ROGUE        = { r = 1.00, g = 0.96, b = 0.41 },
      PRIEST       = { r = 1.00, g = 1.00, b = 1.00 },
      DEATHKNIGHT  = { r = 0.77, g = 0.12, b = 0.23 },
      SHAMAN       = { r = 0.00, g = 0.44, b = 0.87 },
      MAGE         = { r = 0.41, g = 0.80, b = 0.94 },
      WARLOCK      = { r = 0.58, g = 0.51, b = 0.79 },
      MONK         = { r = 0.00, g = 1.00, b = 0.59 },
      DRUID        = { r = 1.00, g = 0.49, b = 0.04 },
      DEMONHUNTER  = { r = 0.64, g = 0.19, b = 0.79 },
      EVOKER       = { r = 0.20, g = 0.58, b = 0.50 },
      ADVENTURER   = { r = 0.70, g = 0.70, b = 0.70 },
      TRAVELER     = { r = 0.60, g = 0.60, b = 0.60 },
    }
    -- One entry exercises the ColorMixin GetRGB() path.
    RAID_CLASS_COLORS.MAGE.GetRGB = function(self) return self.r, self.g, self.b end

    local modules = {}
    RGXFramework = {}
    function RGXFramework:RegisterModule(name, module) modules[name] = module end
    function RGXFramework:GetModule(name) return modules[name] end
    function RGXFramework:GetDesign() return modules.design end
    function RGXFramework:Error() end

    assert(loadstring(design))("RGX-Framework", RGXFramework)
    assert(loadstring(colorpicker))("RGX-Framework", RGXFramework)
    CP = modules.colorpicker
    assert(CP, "colorpicker module did not register")
  `);
  lua.doStringSync(lua.ctx.scenarios);
} finally {
  lua.global.close();
}
