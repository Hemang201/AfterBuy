/**
 * Generates the original placeholder art in assets/.
 * Run with `npm run art`. No dependencies; the PNGs are encoded with node:zlib.
 *
 * These are intentionally simple geometric drawings. Replace any PNG with a
 * hand-drawn file of the same dimensions and transparent background.
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const SCALE = 4;

const hex = (value) => {
  const clean = value.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
    255,
  ];
};

const C = {
  ink: hex("#2e4a3a"),
  inkSoft: hex("#4c6b58"),
  cream: hex("#f6eddc"),
  creamDeep: hex("#ead9bc"),
  white: hex("#fff9ec"),
  leaf: hex("#6fa36b"),
  leafDark: hex("#4c7c55"),
  leafPale: hex("#a8c9a0"),
  coral: hex("#ef7c6a"),
  coralDark: hex("#cf5f50"),
  yellow: hex("#f2c861"),
  yellowDark: hex("#d9a93e"),
  blue: hex("#6e93a8"),
  blueDark: hex("#56798c"),
  wood: hex("#c58e5e"),
  woodDark: hex("#9a6a45"),
  skin: hex("#f2c9a3"),
  hair: hex("#3a5440"),
  blush: hex("#e9a48f"),
};

class Bitmap {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  blend(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const [r, g, b, a = 255] = color;
    const i = (y * this.width + x) * 4;
    const sa = a / 255;
    const da = this.data[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    this.data[i] = (r * sa + this.data[i] * da * (1 - sa)) / outA;
    this.data[i + 1] = (g * sa + this.data[i + 1] * da * (1 - sa)) / outA;
    this.data[i + 2] = (b * sa + this.data[i + 2] * da * (1 - sa)) / outA;
    this.data[i + 3] = outA * 255;
  }
}

class Painter {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.bitmap = new Bitmap(width * SCALE, height * SCALE);
  }

  rect(x, y, w, h, color) {
    const x0 = Math.round(x * SCALE);
    const y0 = Math.round(y * SCALE);
    const x1 = Math.round((x + w) * SCALE);
    const y1 = Math.round((y + h) * SCALE);
    for (let py = y0; py < y1; py += 1) {
      for (let px = x0; px < x1; px += 1) this.bitmap.blend(px, py, color);
    }
  }

  ellipse(cx, cy, rx, ry, color) {
    this.ring(cx, cy, rx, ry, color, Math.max(rx, ry) * 2 + 2);
  }

  ring(cx, cy, rx, ry, color, width) {
    const x0 = Math.round((cx - rx - width) * SCALE);
    const x1 = Math.round((cx + rx + width) * SCALE);
    const y0 = Math.round((cy - ry - width) * SCALE);
    const y1 = Math.round((cy + ry + width) * SCALE);
    const outer = 1;
    const inner = Math.max(0, 1 - width / Math.max(rx, ry));
    for (let py = y0; py <= y1; py += 1) {
      for (let px = x0; px <= x1; px += 1) {
        const nx = (px / SCALE - cx) / rx;
        const ny = (py / SCALE - cy) / ry;
        const d = nx * nx + ny * ny;
        if (d <= outer && d >= inner * inner) {
          this.bitmap.blend(px, py, color);
        }
      }
    }
  }

  line(x0, y0, x1, y1, color, width = 1) {
    const pad = width + 2;
    const minX = Math.round((Math.min(x0, x1) - pad) * SCALE);
    const maxX = Math.round((Math.max(x0, x1) + pad) * SCALE);
    const minY = Math.round((Math.min(y0, y1) - pad) * SCALE);
    const maxY = Math.round((Math.max(y0, y1) + pad) * SCALE);
    const half = (width * SCALE) / 2;
    const ax = x0 * SCALE;
    const ay = y0 * SCALE;
    const bx = x1 * SCALE;
    const by = y1 * SCALE;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy || 1;
    for (let py = minY; py <= maxY; py += 1) {
      for (let px = minX; px <= maxX; px += 1) {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
        const dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
        if (dist <= half) this.bitmap.blend(px, py, color);
      }
    }
  }

  strokeRect(x, y, w, h, color, width = 1) {
    this.rect(x, y, w, width, color);
    this.rect(x, y + h - width, w, width, color);
    this.rect(x, y, width, h, color);
    this.rect(x + w - width, y, width, h, color);
  }

  arc(cx, cy, rx, ry, start, end, color, width = 2) {
    const steps = Math.ceil((Math.abs(end - start) * Math.max(rx, ry)) / 0.6) + 8;
    let prev = null;
    for (let i = 0; i <= steps; i += 1) {
      const angle = start + ((end - start) * i) / steps;
      const point = [cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry];
      if (prev) this.line(prev[0], prev[1], point[0], point[1], color, width);
      prev = point;
    }
  }

  finish() {
    const out = new Bitmap(this.width, this.height);
    const s = SCALE;
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        let r = 0;
        let g = 0;
        let b = 0;
        let a = 0;
        for (let sy = 0; sy < s; sy += 1) {
          for (let sx = 0; sx < s; sx += 1) {
            const i = ((y * s + sy) * this.bitmap.width + (x * s + sx)) * 4;
            const alpha = this.bitmap.data[i + 3] / 255;
            r += this.bitmap.data[i] * alpha;
            g += this.bitmap.data[i + 1] * alpha;
            b += this.bitmap.data[i + 2] * alpha;
            a += alpha;
          }
        }
        const count = s * s;
        const o = (y * this.width + x) * 4;
        if (a === 0) continue;
        out.data[o] = r / a;
        out.data[o + 1] = g / a;
        out.data[o + 2] = b / a;
        out.data[o + 3] = (a / count) * 255;
      }
    }
    return out;
  }
}

// PNG encoding ---------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePNG(bitmap) {
  const { width, height, data } = bitmap;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(data.buffer, y * width * 4, width * 4).copy(
      raw,
      y * (width * 4 + 1) + 1,
    );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Artwork --------------------------------------------------------------------
function drawPlayer(p, offsetX = 0, frame = 0) {
  const x = offsetX;
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  const legShift = [
    [0, 0],
    [-2, 2],
    [0, 0],
    [2, -2],
  ][frame];

  // Shoes and legs
  p.rect(x + 9 + legShift[0], 42, 7, 5, C.ink);
  p.rect(x + 16 + legShift[1], 42, 7, 5, C.ink);
  p.rect(x + 9 + legShift[0], 36, 7, 7, C.leafDark);
  p.rect(x + 16 + legShift[1], 36, 7, 7, C.leafDark);

  // Body / hoodie
  p.rect(x + 7, 23 + bob, 18, 15, C.coral);
  p.strokeRect(x + 6.5, 22.5 + bob, 19, 16, C.ink, 1.4);
  p.rect(x + 4, 25 + bob, 4, 11, C.coral);
  p.rect(x + 24, 25 + bob, 4, 11, C.coral);
  p.strokeRect(x + 4, 25 + bob, 4, 11, C.ink, 1);
  p.strokeRect(x + 24, 25 + bob, 4, 11, C.ink, 1);
  p.rect(x + 14, 27 + bob, 4, 7, C.coralDark);
  p.line(x + 12, 24 + bob, 12, 29 + bob, C.cream, 1.2);
  p.line(x + 20, 24 + bob, 20, 29 + bob, C.cream, 1.2);

  // Neck + head
  p.rect(x + 14, 19 + bob, 4, 4, C.skin);
  p.ellipse(x + 16, 13 + bob, 8.5, 8.5, C.skin);
  p.arc(x + 16, 13 + bob, 8.5, 8.5, Math.PI * 0.95, Math.PI * 2.05, C.hair, 3.4);
  p.ellipse(x + 16, 8 + bob, 8.2, 4.6, C.hair);
  p.line(x + 9, 11 + bob, x + 9, 16 + bob, C.hair, 2);
  p.line(x + 23, 11 + bob, x + 23, 16 + bob, C.hair, 2);
  p.rect(x + 12.5, 14 + bob, 1.6, 2, C.ink);
  p.rect(x + 18, 14 + bob, 1.6, 2, C.ink);
  p.rect(x + 10.5, 17 + bob, 2, 1.4, C.blush);
  p.rect(x + 20, 17 + bob, 2, 1.4, C.blush);
  p.line(x + 14.5, 18 + bob, x + 17.5, 18 + bob, C.inkSoft, 0.9);
}

const artworks = {
  "characters/player_idle.png": [32, 48, (p) => drawPlayer(p, 0, 0)],
  "characters/player_walk.png": [128, 48, (p) => {
    for (let frame = 0; frame < 4; frame += 1) drawPlayer(p, frame * 32, frame);
  }],

  "environments/floor_tile.png": [32, 32, (p) => {
    p.rect(0, 0, 32, 32, C.cream);
    p.rect(0, 0, 32, 1, C.creamDeep);
    p.rect(0, 0, 1, 32, C.creamDeep);
    p.rect(5, 8, 3, 1, hex("#e6d5b9"));
    p.rect(23, 21, 2, 1, hex("#e6d5b9"));
    p.rect(11, 26, 1, 3, hex("#e6d5b9"));
  }],

  "environments/wall_tile.png": [32, 32, (p) => {
    p.rect(0, 0, 32, 32, C.creamDeep);
    p.rect(0, 0, 32, 2, hex("#dfcbaa"));
    p.rect(15, 0, 2, 32, hex("#e2cfae"));
    p.rect(15, 0, 1, 32, hex("#d9c4a1"));
    p.ellipse(8, 16, 3.2, 4.6, C.leafPale);
    p.line(8, 13, 8, 20, C.leafPale, 0.8);
    p.ellipse(24, 16, 3.2, 4.6, C.leafPale);
    p.line(24, 13, 24, 20, C.leafPale, 0.8);
  }],

  "environments/rug.png": [200, 120, (p) => {
    p.ellipse(100, 60, 95, 55, C.ink);
    p.ellipse(100, 60, 92, 52, C.cream);
    p.ring(100, 60, 82, 44, C.yellow, 6);
    p.ring(100, 60, 68, 35, C.coral, 5);
    p.ring(100, 60, 54, 26, C.blue, 3);
    p.ellipse(100, 60, 40, 17, C.creamDeep);
    // Woven fringe
    for (let i = 0; i < 9; i += 1) {
      const angle = Math.PI * (0.12 + i * 0.095);
      const x = 100 - Math.cos(angle) * 94;
      const y = 60 + Math.sin(angle) * 53;
      p.line(x, y, x - 5, y + 1, C.creamDeep, 1);
      p.line(200 - x, y, 205 - x, y + 1, C.creamDeep, 1);
    }
    p.ellipse(100, 60, 10, 5, C.coral);
  }],

  "furniture/bed.png": [128, 104, (p) => {
    p.rect(5, 8, 118, 92, C.wood);
    p.strokeRect(5, 8, 118, 92, C.ink, 2);
    p.rect(5, 4, 118, 16, C.woodDark);
    p.strokeRect(5, 4, 118, 16, C.ink, 1.6);
    p.rect(11, 20, 106, 73, C.cream);
    p.strokeRect(11, 20, 106, 73, C.inkSoft, 1.4);
    p.rect(11, 50, 106, 43, C.blue);
    p.strokeRect(11, 50, 106, 43, C.ink, 1.6);
    p.rect(11, 58, 106, 7, C.coral);
    p.rect(11, 82, 106, 5, C.blueDark);
    // Folded leaf-green throw
    p.rect(74, 68, 38, 20, C.leaf);
    p.strokeRect(74, 68, 38, 20, C.ink, 1.4);
    p.line(74, 76, 112, 76, C.leafDark, 1.4);
    // Pillows
    p.ellipse(37, 35, 23, 12, C.white);
    p.ring(37, 35, 23, 12, C.creamDeep, 1.6);
    p.ellipse(94, 35, 20, 11, C.white);
    p.ring(94, 35, 20, 11, C.creamDeep, 1.6);
    p.rect(23, 32, 11, 2, C.creamDeep);
    p.rect(84, 32, 11, 2, C.creamDeep);
    p.ellipse(27, 12, 2, 2, C.yellow);
    p.ellipse(64, 12, 2, 2, C.yellow);
    p.ellipse(101, 12, 2, 2, C.yellow);
  }],

  "furniture/desk.png": [144, 64, (p) => {
    p.rect(12, 46, 10, 16, C.woodDark);
    p.rect(122, 46, 10, 16, C.woodDark);
    p.strokeRect(12, 46, 10, 16, C.ink, 1.2);
    p.strokeRect(122, 46, 10, 16, C.ink, 1.2);
    p.rect(5, 10, 134, 36, C.wood);
    p.strokeRect(5, 10, 134, 36, C.ink, 2);
    p.rect(9, 13, 126, 5, hex("#dcb080"));
    p.rect(36, 34, 72, 10, C.creamDeep);
    p.strokeRect(36, 34, 72, 10, C.inkSoft, 1.2);
    p.ellipse(108, 39, 4, 2.5, C.yellow);
    // Papers and pencil
    p.rect(96, 17, 27, 14, C.white);
    p.strokeRect(96, 17, 27, 14, C.inkSoft, 1);
    p.line(100, 21, 118, 21, C.inkSoft, 0.8);
    p.line(100, 25, 114, 25, C.inkSoft, 0.8);
    p.rect(21, 18, 6, 18, C.coral);
    p.strokeRect(21, 18, 6, 18, C.ink, 1);
    p.rect(20, 15, 8, 4, C.cream);
    p.strokeRect(20, 15, 8, 4, C.ink, 1);
  }],

  "furniture/wardrobe.png": [80, 136, (p) => {
    p.rect(10, 131, 10, 5, C.woodDark);
    p.rect(60, 131, 10, 5, C.woodDark);
    p.rect(4, 4, 72, 128, C.wood);
    p.strokeRect(4, 4, 72, 128, C.ink, 2);
    p.rect(4, 4, 72, 10, C.woodDark);
    p.strokeRect(4, 4, 72, 10, C.ink, 1.4);
    p.rect(10, 18, 28, 104, C.cream);
    p.rect(42, 18, 28, 104, C.cream);
    p.strokeRect(10, 18, 28, 104, C.inkSoft, 1.4);
    p.strokeRect(42, 18, 28, 104, C.inkSoft, 1.4);
    p.ellipse(35, 70, 2.4, 2.4, C.yellow);
    p.ellipse(45, 70, 2.4, 2.4, C.yellow);
    p.ellipse(35, 70, 1, 1, C.ink);
    p.ellipse(45, 70, 1, 1, C.ink);
    p.line(40, 22, 40, 116, C.inkSoft, 1.2);
    // A coral scarf peeking from the top
    p.rect(25, 12, 8, 10, C.coral);
    p.rect(51, 12, 7, 8, C.blue);
    p.ellipse(20, 12, 1.8, 1.8, C.yellow);
    p.ellipse(59, 12, 1.8, 1.8, C.yellow);
  }],

  "furniture/storage_box.png": [76, 64, (p) => {
    p.rect(5, 12, 66, 48, C.wood);
    p.strokeRect(5, 12, 66, 48, C.ink, 2);
    p.line(5, 28, 71, 28, C.woodDark, 1.4);
    p.line(5, 44, 71, 44, C.woodDark, 1.4);
    p.rect(2, 6, 72, 12, C.creamDeep);
    p.strokeRect(2, 6, 72, 12, C.ink, 1.6);
    p.rect(30, 18, 16, 12, C.cream);
    p.strokeRect(30, 18, 16, 12, C.inkSoft, 1);
    // Sprig on the lid
    p.line(38, 6, 38, 1, C.leafDark, 1.4);
    p.ellipse(34, 2.5, 3.5, 1.8, C.leaf);
    p.ellipse(42, 3.5, 3.5, 1.8, C.leafPale);
  }],

  "furniture/shopping_phone.png": [80, 96, (p) => {
    p.rect(33, 68, 14, 14, C.inkSoft);
    p.rect(22, 82, 36, 8, C.woodDark);
    p.strokeRect(22, 82, 36, 8, C.ink, 1.2);
    p.rect(8, 8, 64, 62, C.ink);
    p.strokeRect(8, 8, 64, 62, C.ink, 2);
    p.rect(14, 14, 52, 40, C.blue);
    p.strokeRect(14, 14, 52, 40, C.inkSoft, 1.2);
    p.rect(14, 14, 52, 5, C.blueDark);
    // App tiles
    p.rect(18, 24, 10, 10, C.leaf);
    p.rect(31, 24, 10, 10, C.yellow);
    p.rect(44, 24, 10, 10, C.coral);
    p.rect(18, 38, 10, 10, C.cream);
    p.rect(31, 38, 10, 10, C.white);
    p.rect(44, 38, 10, 10, C.leafPale);
    p.ellipse(23, 29, 3, 2, C.cream);
    p.ellipse(40, 43, 2.5, 2.5, C.coral);
    p.ellipse(40, 59, 4, 4, C.cream);
    p.strokeRect(40, 59, 0.2, 0.2, C.ink, 1);
    p.ellipse(12, 11, 1.5, 1.5, C.yellow);
  }],

  "furniture/donation_station.png": [88, 92, (p) => {
    p.rect(14, 38, 10, 50, C.woodDark);
    p.rect(66, 38, 10, 50, C.woodDark);
    p.strokeRect(14, 38, 10, 50, C.ink, 1.2);
    p.strokeRect(66, 38, 10, 50, C.ink, 1.2);
    p.rect(5, 26, 78, 16, C.wood);
    p.strokeRect(5, 26, 78, 16, C.ink, 2);
    p.rect(20, 6, 48, 26, C.creamDeep);
    p.strokeRect(20, 6, 48, 26, C.ink, 1.6);
    p.ellipse(38, 15, 5.5, 5, C.coral);
    p.ellipse(46, 15, 5.5, 5, C.coral);
    p.rect(33, 16, 18, 7, C.coral);
    p.line(38, 22, 36, 28, C.coral, 3);
    p.line(46, 22, 48, 28, C.coral, 3);
    // Reuse arrows
    p.line(28, 62, 42, 62, C.leafDark, 2.4);
    p.line(42, 62, 38, 58, C.leafDark, 2);
    p.line(42, 62, 38, 66, C.leafDark, 2);
    p.line(60, 74, 46, 74, C.leafDark, 2.4);
    p.line(46, 74, 50, 70, C.leafDark, 2);
    p.line(46, 74, 50, 78, C.leafDark, 2);
  }],

  "furniture/plant.png": [44, 64, (p) => {
    p.rect(13, 43, 18, 17, C.coral);
    p.strokeRect(13, 43, 18, 17, C.ink, 1.6);
    p.rect(10, 39, 24, 7, C.creamDeep);
    p.strokeRect(10, 39, 24, 7, C.ink, 1.4);
    p.line(22, 42, 22, 12, C.leafDark, 1.8);
    p.ellipse(15, 31, 8, 4, C.leaf);
    p.ellipse(29, 27, 8, 4, C.leaf);
    p.ellipse(14, 21, 7, 3.5, C.leafPale);
    p.ellipse(28, 17, 7, 3.5, C.leaf);
    p.ellipse(22, 10, 5, 3.5, C.leafPale);
    p.line(13, 31, 21, 31, C.leafDark, 0.8);
    p.line(23, 27, 31, 27, C.leafDark, 0.8);
    p.line(23, 18, 31, 17, C.leafDark, 0.8);
  }],

  "items/headphones.png": [32, 32, (p) => {
    p.arc(16, 17, 11, 10, Math.PI, Math.PI * 2, C.ink, 3);
    p.rect(4, 16, 7, 11, C.coral);
    p.strokeRect(4, 16, 7, 11, C.ink, 1.2);
    p.rect(21, 16, 7, 11, C.coral);
    p.strokeRect(21, 16, 7, 11, C.ink, 1.2);
    p.rect(6, 19, 3, 5, C.creamDeep);
    p.rect(23, 19, 3, 5, C.creamDeep);
    p.arc(16, 17, 7, 7, Math.PI * 1.15, Math.PI * 1.85, C.cream, 1);
  }],

  "items/hoodie.png": [32, 32, (p) => {
    p.rect(9, 10, 14, 15, C.coral);
    p.strokeRect(9, 10, 14, 15, C.ink, 1.4);
    p.rect(3, 11, 6, 13, C.coral);
    p.strokeRect(3, 11, 6, 13, C.ink, 1.2);
    p.rect(23, 11, 6, 13, C.coral);
    p.strokeRect(23, 11, 6, 13, C.ink, 1.2);
    p.arc(16, 11, 7, 4, Math.PI, Math.PI * 2, C.coralDark, 4);
    p.rect(13, 15, 6, 5, C.coralDark);
    p.line(13, 11, 13, 17, C.cream, 1);
    p.line(19, 11, 19, 17, C.cream, 1);
    p.rect(12, 22, 8, 3, C.coralDark);
  }],

  "items/sneakers.png": [32, 32, (p) => {
    p.rect(4, 19, 21, 8, C.blue);
    p.strokeRect(4, 19, 21, 8, C.ink, 1.3);
    p.rect(4, 25, 21, 3, C.cream);
    p.rect(9, 21, 3, 2, C.cream);
    p.rect(14, 21, 3, 2, C.cream);
    p.rect(19, 21, 3, 2, C.cream);
    p.rect(8, 9, 21, 8, C.blueDark);
    p.strokeRect(8, 9, 21, 8, C.ink, 1.3);
    p.rect(8, 15, 21, 3, C.cream);
    p.rect(13, 11, 3, 2, C.cream);
    p.rect(18, 11, 3, 2, C.cream);
  }],

  "items/water_bottle.png": [32, 32, (p) => {
    p.rect(13, 5, 6, 4, C.ink);
    p.rect(12, 9, 8, 19, C.blue);
    p.strokeRect(12, 9, 8, 19, C.ink, 1.4);
    p.rect(13, 4, 6, 3, C.creamDeep);
    p.strokeRect(13, 4, 6, 3, C.ink, 1);
    p.rect(14, 12, 2, 12, C.cream);
    p.rect(12, 17, 8, 4, C.leaf);
    p.line(12, 21, 20, 21, C.leafDark, 1);
    p.rect(13, 26, 6, 2, C.blueDark);
  }],

  // Product items. Each is a separate file so a delivered purchase can be
  // redrawn on its own, without touching the household item it resembles.
  "items/trendy_sneakers.png": [32, 32, (p) => {
    // Chunky sneaker with a coral swoosh and yellow sole stripe.
    p.rect(4, 20, 24, 8, C.white);
    p.strokeRect(3.5, 19.5, 25, 9, C.ink, 1.3);
    p.rect(4, 25, 24, 3, C.coral);
    p.rect(9, 10, 19, 9, C.white);
    p.strokeRect(8.5, 9.5, 20, 10, C.ink, 1.3);
    p.line(10, 16, 24, 20, C.coralDark, 2.2);
    p.rect(11, 12, 3, 2, C.yellow);
    p.rect(16, 12, 3, 2, C.yellow);
    p.rect(21, 13, 3, 2, C.yellow);
    p.rect(5, 23, 4, 2, C.creamDeep);
    p.rect(4, 27, 24, 1.4, C.coralDark);
  }],

  "items/wireless_headphones.png": [32, 32, (p) => {
    // Over-ear pair with no cable: blue band, yellow cups.
    p.arc(16, 18, 12, 11, Math.PI, Math.PI * 2, C.blueDark, 3.4);
    p.arc(16, 18, 12, 11, Math.PI * 0.98, Math.PI * 2.02, C.ink, 1);
    p.rect(3, 17, 8, 12, C.yellow);
    p.strokeRect(2.5, 16.5, 9, 13, C.ink, 1.3);
    p.rect(22, 17, 8, 12, C.yellow);
    p.strokeRect(21.5, 16.5, 9, 13, C.ink, 1.3);
    p.rect(5, 20, 4, 6, C.creamDeep);
    p.rect(23, 20, 4, 6, C.creamDeep);
    p.arc(16, 18, 8, 7, Math.PI * 1.15, Math.PI * 1.85, C.cream, 1);
  }],

  "items/party_speaker.png": [32, 32, (p) => {
    // Small speaker box: coral handle, cream grille, yellow knob.
    p.rect(6, 8, 20, 21, C.woodDark);
    p.strokeRect(6, 8, 20, 21, C.ink, 1.4);
    p.rect(9, 12, 14, 11, C.cream);
    p.strokeRect(9, 12, 14, 11, C.inkSoft, 1);
    p.ellipse(16, 17.5, 3.4, 3.4, C.inkSoft);
    p.ellipse(16, 17.5, 1.6, 1.6, C.creamDeep);
    p.ellipse(11.6, 14.6, 1.1, 1.1, C.ink);
    p.ellipse(20.4, 20.4, 1.1, 1.1, C.ink);
    p.rect(11, 26, 10, 2.4, C.yellow);
    p.arc(16, 8, 5, 4, Math.PI, Math.PI * 2, C.coral, 2);
    p.line(11, 8, 11, 6, C.coral, 1.6);
    p.line(21, 8, 21, 6, C.coral, 1.6);
  }],

  "items/parcel.png": [40, 40, (p) => {
    p.rect(6, 12, 28, 23, C.wood);
    p.strokeRect(6, 12, 28, 23, C.ink, 1.6);
    p.rect(6, 12, 28, 5, C.woodDark);
    p.rect(19, 12, 6, 23, C.yellow);
    p.line(9, 20, 17, 20, C.woodDark, 1.2);
    p.line(9, 27, 17, 27, C.woodDark, 1.2);
    p.rect(27, 24, 5, 7, C.cream);
    p.strokeRect(27, 24, 5, 7, C.inkSoft, 0.9);
    p.ellipse(29.5, 26.5, 1.5, 1.2, C.leaf);
  }],

  "ui/interaction_icon.png": [24, 24, (p) => {
    p.rect(2, 2, 20, 20, C.cream);
    p.strokeRect(2, 2, 20, 20, C.ink, 1.8);
    p.rect(9, 7, 8, 2.2, C.ink);
    p.rect(9, 7, 2.2, 10, C.ink);
    p.rect(9, 11.5, 6, 2, C.ink);
    p.rect(9, 15, 8, 2.2, C.ink);
  }],
};

// `--only a,b` regenerates just those placeholders (match by logical ID, e.g.
// `trendy_sneakers`, or by relative path like `items/trendy_sneakers.png`).
// This exists so a single deleted or wanted placeholder can be restored without
// overwriting hand-drawn art that has replaced the others.
const force = process.argv.includes("--force");

// `--out <dir>` writes somewhere other than assets/ (for audits, previews, or a
// throwaway comparison against the shipped placeholders). Default: assets/.
const outIndex = process.argv.findIndex(
  (arg) => arg === "--out" || arg.startsWith("--out="),
);
const outArg =
  outIndex === -1
    ? ""
    : process.argv[outIndex].includes("=")
      ? process.argv[outIndex].slice(process.argv[outIndex].indexOf("=") + 1)
      : process.argv[outIndex + 1] || "";
if (outIndex !== -1 && !outArg) {
  console.error("--out needs a directory, e.g. `npm run art -- --out /tmp/placeholders`.");
  process.exit(1);
}
const OUT_DIR = outArg ? resolve(process.cwd(), outArg) : join(ROOT, "assets");

const onlyIndex = process.argv.findIndex(
  (arg) => arg === "--only" || arg.startsWith("--only="),
);
const onlyRaw =
  onlyIndex === -1
    ? ""
    : process.argv[onlyIndex].includes("=")
      ? process.argv[onlyIndex].slice(process.argv[onlyIndex].indexOf("=") + 1)
      : process.argv[onlyIndex + 1] || "";
const onlyIds = onlyRaw.split(",").map((value) => value.trim()).filter(Boolean);

const selected = Object.entries(artworks).filter(([relative]) => {
  if (onlyIds.length === 0) return true;
  const base = relative.split("/").pop().replace(/\.png$/, "");
  return onlyIds.some(
    (id) => id === relative || id === `${relative}.png` || id === base,
  );
});

if (selected.length === 0) {
  console.error(
    `No placeholder matches --only ${onlyIds.join(", ")}. Known IDs: ` +
      Object.keys(artworks)
        .map((relative) => relative.split("/").pop().replace(/\.png$/, ""))
        .join(", "),
  );
  process.exit(1);
}

const written = [];
const kept = [];
for (const [relative, [width, height, draw]] of selected) {
  const painter = new Painter(width, height);
  draw(painter);
  const bitmap = painter.finish();
  const output = join(OUT_DIR, relative);
  const png = encodePNG(bitmap);

  // Never clobber hand-drawn art by accident. If the file on disk is not what
  // this generator produces, it has been replaced by hand: leave it alone unless
  // `--force` is passed. A deleted placeholder is simply written again.
  let existing = null;
  try {
    existing = readFileSync(output);
  } catch {
    existing = null;
  }
  if (existing && !force && !existing.equals(png)) {
    kept.push(`${relative} (${width}×${height})`);
    continue;
  }

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, png);
  written.push(`${relative} (${width}×${height})`);
}

console.log(
  `Generated ${written.length} placeholder image${written.length === 1 ? "" : "s"}` +
    (onlyIds.length ? ` (--only ${onlyIds.join(", ")}):` : ":"),
);
for (const line of written) console.log(`  ${line}`);

if (kept.length) {
  console.log(
    `Kept ${kept.length} file${kept.length === 1 ? "" : "s"} that no longer match the generator ` +
      "(hand-drawn art is never overwritten):",
  );
  for (const line of kept) console.log(`  ${line}`);
  console.log("Add --force to overwrite them with placeholders anyway.");
}

if (onlyIds.length) {
  const untouched = Object.keys(artworks).length - written.length - kept.length;
  if (untouched > 0) {
    console.log(
      `Skipped ${untouched} other placeholder${untouched === 1 ? "" : "s"} not named by --only.`,
    );
  }
}
