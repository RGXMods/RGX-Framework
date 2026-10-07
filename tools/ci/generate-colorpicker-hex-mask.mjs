#!/usr/bin/env node
// Generates the ColorPicker honeycomb assets:
//   media/hexmask.tga  - filled flat-top hexagon (white RGB + antialiased alpha)
//   media/hexring.tga  - flat-top hexagon outline band (hover/selection ring)
//
// Both are 64x64 (power-of-two) 32-bit uncompressed true-color TGAs
// (bottom-left origin, 8 alpha bits) so they load on every supported flavor
// without AtlasInfo, which only ships the hexagon atlas on Modern clients.
//
// The hexagon has circumradius R = W/2 = 32, so its visible box is
// 64 x sqrt(3)*32 ~= 55.43 px. It is centred in the square canvas with
// symmetric transparent padding top and bottom; because each cell quad is
// SQUARE (2*size) and centred on the cell, the visible hexagon keeps the exact
// 2:sqrt(3) flat-top aspect and tiles like the honeycomb grid -- no SetMask.
//
// Run: node tools/ci/generate-colorpicker-hex-mask.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = join(root, "media");

// Square power-of-two canvas. 64x64 keeps R=32 -> 64px wide, sqrt(3)*32 tall.
const W = 64;
const H = 64;
const R = W / 2; // circumradius: flat-top hexagon is 2R wide, sqrt(3)R tall
const SQRT3 = Math.sqrt(3);
const SAMPLES = 4; // supersampling per axis for the antialiased edge

// Homogeneous "hexagon distance": <= 1 inside, == 1 on the boundary. Works for
// the flat-top orientation (flat top/bottom edges, left/right vertices).
function hexDistance(x, y) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  return Math.max(ax / R, ay / (R * SQRT3 / 2), (SQRT3 * ax + ay) / (R * SQRT3));
}

function coverage(x0, y0, test) {
  let hits = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const x = x0 + (sx + 0.5) / SAMPLES - 0.5;
      const y = y0 + (sy + 0.5) / SAMPLES - 0.5;
      if (test(hexDistance(x, y))) hits++;
    }
  }
  return hits / (SAMPLES * SAMPLES);
}

function buildMask(name, test) {
  const alpha = Buffer.alloc(W * H);
  const pixels = Buffer.alloc(W * H * 4);
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      // Pixel centre relative to the hexagon centre.
      const x = px + 0.5 - W / 2;
      const y = py + 0.5 - H / 2;
      const a = Math.round(coverage(x, y, test) * 255);
      alpha[py * W + px] = a;
      // TGA stores BGRA, bottom-left origin: row 0 of the file is the bottom.
      const tgaRow = H - 1 - py;
      const offset = (tgaRow * W + px) * 4;
      pixels[offset] = 255; // B
      pixels[offset + 1] = 255; // G
      pixels[offset + 2] = 255; // R
      pixels[offset + 3] = a; // A
    }
  }

  const header = Buffer.alloc(18);
  header.writeUInt8(0, 0); // no image id
  header.writeUInt8(0, 1); // no colour map
  header.writeUInt8(2, 2); // uncompressed true-color
  header.writeUInt16LE(0, 3); // colour map origin
  header.writeUInt16LE(0, 5); // colour map length
  header.writeUInt8(0, 7); // colour map entry size
  header.writeUInt16LE(0, 8); // x origin
  header.writeUInt16LE(0, 10); // y origin
  header.writeUInt16LE(W, 12);
  header.writeUInt16LE(H, 14);
  header.writeUInt8(32, 16); // 32 bpp
  header.writeUInt8(8, 17); // bottom-left origin, 8 alpha bits

  const path = join(outDir, name);
  writeFileSync(path, Buffer.concat([header, pixels]));
  return { path, bytes: header.length + pixels.length, alpha };
}

// Alpha bounding box used to self-check geometry before writing is accepted.
function visibleBox(mask) {
  let minX = W, maxX = -1, minY = H, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (mask.alpha[y * W + x] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { minX, maxX, minY, maxY };
}

function assert(cond, msg) {
  if (!cond) throw new Error("hex asset self-check failed: " + msg);
}

mkdirSync(outDir, { recursive: true });

// Filled hexagon: inside the boundary.
const fill = buildMask("hexmask.tga", (d) => d <= 1);

// Outline: a band just inside the boundary (1.0 -> ~0.82 of the hexagon radius).
const RING_INNER = 0.82;
const ring = buildMask("hexring.tga", (d) => d <= 1 && d >= RING_INNER);

// Self-check the geometry so a bad regeneration fails loudly.
assert(W === H && (W & (W - 1)) === 0, `canvas ${W}x${H} is not square power-of-two`);
const fb = visibleBox(fill);
const fw = fb.maxX - fb.minX + 1;
const fh = fb.maxY - fb.minY + 1;
const topPad = fb.minY;
const botPad = H - 1 - fb.maxY;
assert(fw === W, `visible width ${fw} != ${W}`);
assert(Math.abs(fh - W * SQRT3 / 2) <= 1.5, `visible height ${fh} is not 2:sqrt(3)`);
assert(Math.abs(topPad - botPad) <= 1, `padding not symmetric (${topPad}/${botPad})`);
assert(fill.alpha[32 * W + 32] > 250, "fill centre is not opaque");
assert(fill.alpha[0] < 5, "fill corner is not transparent");
const rb = visibleBox(ring);
assert(rb.minX === fb.minX && rb.maxX === fb.maxX && rb.minY === fb.minY && rb.maxY === fb.maxY,
  "ring does not trace the fill boundary");
assert(ring.alpha[32 * W + 32] < 5, "ring centre is not hollow");

console.log(`wrote ${fill.path} (${fill.bytes} bytes) visible ${fw}x${fh}`);
console.log(`wrote ${ring.path} (${ring.bytes} bytes) visible ${rb.maxX - rb.minX + 1}x${rb.maxY - rb.minY + 1}`);
