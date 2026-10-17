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
  woodMid: hex("#b8845a"),
  woodLight: hex("#d8a978"),
  inkBrown: hex("#5b4633"),
  sage: hex("#afc2a2"),
  sageLight: hex("#c8d6ba"),
  paper: hex("#fff9f0"),
  mustard: hex("#e5bb62"),
  mustardDeep: hex("#c99b41"),
  terracotta: hex("#c97f61"),
  terracottaDeep: hex("#a9614a"),
  blueDeep: hex("#5f7c8e"),
  forest: hex("#254d3a"),
  leafDeep: hex("#4f7554"),
  forestDeep: hex("#1b3a2b"),
  paperDeep: hex("#efe3cc"),
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

/** Same colour at a different alpha, for soft shading passes. */
const A = (color, alpha) => [color[0], color[1], color[2], Math.round(alpha * 255)];

/** A one-pixel bevel: light on the top/left, shade on the bottom/right. */
function bevel(p, x, y, w, h, light = C.paper, dark = C.inkBrown) {
  p.rect(x + 1, y + 1, w - 2, 1.2, A(light, 0.45));
  p.rect(x + 1, y + 1, 1.2, h - 2, A(light, 0.3));
  p.rect(x + 1, y + h - 2.4, w - 2, 1.4, A(dark, 0.22));
  p.rect(x + w - 2.4, y + 1, 1.4, h - 2, A(dark, 0.16));
}

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
    // Frame and feet.
    p.rect(6, 12, 116, 88, C.woodMid);
    p.rect(6, 88, 116, 10, C.wood);
    p.strokeRect(5, 11, 118, 90, C.ink, 2);
    bevel(p, 6, 12, 116, 88, C.paper, C.inkBrown);
    p.rect(10, 100, 10, 3, C.woodDark);
    p.rect(108, 100, 10, 3, C.woodDark);

    // Headboard with two panels.
    p.rect(4, 2, 120, 18, C.woodDark);
    p.strokeRect(4, 2, 120, 18, C.ink, 2);
    p.rect(12, 7, 48, 8, C.wood);
    p.rect(68, 7, 48, 8, C.wood);
    p.strokeRect(12, 7, 48, 8, A(C.ink, 0.5), 1);
    p.strokeRect(68, 7, 48, 8, A(C.ink, 0.5), 1);
    bevel(p, 4, 2, 120, 18, C.cream, C.inkBrown);

    // Mattress and sheet.
    p.rect(12, 20, 104, 72, C.paper);
    p.strokeRect(12, 20, 104, 72, A(C.ink, 0.55), 1.4);
    p.rect(12, 20, 104, 8, C.cream);
    p.rect(12, 86, 104, 6, C.creamDeep);

    // Duvet: sage, folded back at the top, stitched.
    p.rect(12, 44, 104, 44, C.sage);
    p.rect(12, 44, 104, 5, C.sageLight);
    p.strokeRect(12, 44, 104, 44, A(C.ink, 0.45), 1.4);
    for (let x = 20; x <= 108; x += 18) {
      p.line(x, 50, x, 86, A(C.leafDark, 0.35), 0.8);
    }
    p.line(12, 60, 116, 60, A(C.leafDark, 0.3), 0.8);

    // Mustard throw folded across the foot.
    p.rect(70, 68, 46, 20, C.mustard);
    p.strokeRect(70, 68, 46, 20, A(C.ink, 0.6), 1.3);
    p.rect(70, 74, 46, 2, C.mustardDeep);
    p.rect(70, 81, 46, 2, C.mustardDeep);
    p.rect(70, 68, 46, 2, A(C.paper, 0.5));

    // Pillows.
    p.ellipse(40, 32, 24, 11, C.paper);
    p.ring(40, 32, 24, 11, A(C.ink, 0.35), 1.4);
    p.ellipse(40, 29, 18, 5, A(C.paper, 0.9));
    p.ellipse(92, 32, 21, 10, C.paper);
    p.ring(92, 32, 21, 10, A(C.ink, 0.35), 1.4);
    p.ellipse(92, 29, 15, 4, A(C.paper, 0.9));
    p.line(28, 36, 52, 36, A(C.inkBrown, 0.25), 1);
  }],

  "furniture/desk.png": [144, 64, (p) => {
    // Legs.
    for (const lx of [12, 124]) {
      p.rect(lx, 42, 9, 20, C.woodDark);
      p.strokeRect(lx, 42, 9, 20, A(C.ink, 0.7), 1.1);
      p.rect(lx + 1, 43, 2, 16, A(C.paper, 0.25));
    }

    // Top and apron.
    p.rect(4, 8, 136, 32, C.wood);
    p.strokeRect(4, 8, 136, 32, C.ink, 1.8);
    p.rect(4, 8, 136, 4, C.woodLight);
    p.rect(4, 36, 136, 4, C.woodDark);
    for (let x = 12; x < 136; x += 22) {
      p.line(x, 13, x + 14, 13, A(C.woodDark, 0.35), 0.8);
      p.line(x + 6, 30, x + 22, 30, A(C.woodDark, 0.25), 0.8);
    }

    // Drawer with a brass pull.
    p.rect(52, 36, 44, 9, C.woodMid);
    p.strokeRect(52, 36, 44, 9, A(C.ink, 0.6), 1.1);
    p.rect(68, 39, 12, 2.2, C.mustardDeep);

    // Notebook.
    p.rect(84, 14, 34, 17, C.paper);
    p.strokeRect(84, 14, 34, 17, A(C.ink, 0.55), 1.2);
    p.rect(84, 14, 4, 17, C.terracotta);
    for (let i = 0; i < 3; i += 1) {
      p.line(92, 19 + i * 4, 113, 19 + i * 4, A(C.inkSoft, 0.5), 0.9);
    }

    // Pencil cup with three pencils.
    p.rect(20, 18, 12, 18, C.creamDeep);
    p.strokeRect(20, 18, 12, 18, A(C.ink, 0.65), 1.2);
    p.rect(20, 33, 12, 3, A(C.inkBrown, 0.18));
    p.line(23, 18, 21, 8, C.mustard, 1.8);
    p.line(26, 18, 26, 6, C.leaf, 1.8);
    p.line(29, 18, 32, 9, C.terracotta, 1.8);
    p.ellipse(21, 8, 1, 1, C.inkBrown);
    p.ellipse(26, 6, 1, 1, C.inkBrown);
    p.ellipse(32, 9, 1, 1, C.inkBrown);

    // Small brass desk lamp.
    p.ellipse(120, 22, 7, 3, C.mustardDeep);
    p.line(120, 22, 114, 12, C.mustardDeep, 1.6);
    p.ellipse(113, 11, 5, 3.4, C.mustard);
    p.ring(113, 11, 5, 3.4, A(C.ink, 0.4), 0.9);
  }],

  "furniture/wardrobe.png": [80, 136, (p) => {
    // Feet.
    p.rect(10, 128, 10, 6, C.woodDark);
    p.rect(60, 128, 10, 6, C.woodDark);

    // Carcass.
    p.rect(4, 8, 72, 122, C.wood);
    p.strokeRect(3, 7, 74, 124, C.ink, 2);
    bevel(p, 4, 8, 72, 122, C.woodLight, C.inkBrown);

    // Cornice.
    p.rect(1, 2, 78, 10, C.woodDark);
    p.strokeRect(1, 2, 78, 10, C.ink, 1.6);
    p.rect(1, 2, 78, 2.5, C.woodLight);

    // Doors with inset panels.
    for (const dx of [9, 41]) {
      p.rect(dx, 16, 30, 106, C.cream);
      p.strokeRect(dx, 16, 30, 106, A(C.ink, 0.7), 1.4);
      p.rect(dx + 4, 22, 22, 44, A(C.sage, 0.55));
      p.strokeRect(dx + 4, 22, 22, 44, A(C.ink, 0.28), 1);
      p.rect(dx + 4, 72, 22, 44, A(C.sage, 0.55));
      p.strokeRect(dx + 4, 72, 22, 44, A(C.ink, 0.28), 1);
    }
    // Brass handles.
    p.ellipse(36, 70, 2.6, 4.6, C.mustard);
    p.ellipse(44, 70, 2.6, 4.6, C.mustard);
    p.ring(36, 70, 2.6, 4.6, A(C.inkBrown, 0.7), 0.9);
    p.ring(44, 70, 2.6, 4.6, A(C.inkBrown, 0.7), 0.9);

    // A coral scarf left hanging out, and a folded blanket on top.
    p.rect(23, 10, 7, 16, C.terracotta);
    p.rect(23, 10, 7, 2, C.terracottaDeep);
    p.line(24, 14, 29, 14, A(C.terracottaDeep, 0.7), 1);
    p.rect(52, 4, 20, 6, C.blue);
    p.rect(52, 4, 20, 2, C.blueDeep);
  }],

  "furniture/storage_box.png": [76, 64, (p) => {
    // Crate body: horizontal slats, corner braces.
    p.rect(4, 16, 68, 44, C.wood);
    p.strokeRect(4, 16, 68, 44, C.ink, 1.8);
    for (let y = 24; y < 56; y += 10) {
      p.line(6, y, 70, y, A(C.woodDark, 0.5), 1.2);
      p.line(6, y + 1.4, 70, y + 1.4, A(C.paper, 0.22), 1);
    }
    for (const bx of [4, 64]) {
      p.rect(bx, 16, 8, 44, C.woodDark);
      p.strokeRect(bx, 16, 8, 44, A(C.ink, 0.45), 1);
    }

    // Lid, slightly ajar, with two boards.
    p.rect(2, 8, 72, 10, C.woodLight);
    p.strokeRect(2, 8, 72, 10, C.ink, 1.6);
    p.line(38, 9, 38, 17, A(C.inkBrown, 0.35), 1.2);

    // Rope handle.
    p.arc(38, 10, 11, 6, Math.PI * 1.05, Math.PI * 1.95, C.creamDeep, 2);

    // Label and a sprig tucked under the lid.
    p.rect(28, 28, 20, 12, C.paper);
    p.strokeRect(28, 28, 20, 12, A(C.ink, 0.5), 1);
    p.line(31, 32, 45, 32, A(C.inkSoft, 0.55), 0.9);
    p.line(31, 36, 41, 36, A(C.inkSoft, 0.55), 0.9);
    p.line(52, 8, 55, 1, C.leafDark, 1.4);
    p.ellipse(50, 3, 3.6, 1.8, C.leaf);
    p.ellipse(58, 4.5, 3.6, 1.8, C.leafPale);
  }],

  "furniture/shopping_phone.png": [80, 96, (p) => {
    // Stand.
    p.rect(31, 62, 18, 10, C.woodDark);
    p.strokeRect(31, 62, 18, 10, A(C.ink, 0.6), 1.2);
    p.rect(22, 80, 36, 9, C.wood);
    p.strokeRect(22, 80, 36, 9, C.ink, 1.4);
    p.rect(22, 80, 36, 2, C.woodLight);
    p.arc(40, 62, 9, 12, Math.PI * 0.15, Math.PI * 0.85, A(C.ink, 0.45), 1.4);

    // Terminal casing.
    p.rect(6, 6, 68, 58, C.forest);
    p.strokeRect(5, 5, 70, 60, C.ink, 2);
    bevel(p, 6, 6, 68, 58, C.leaf, C.forestDeep);

    // Screen with a soft warm glow.
    p.rect(12, 12, 56, 38, C.paperDeep);
    p.strokeRect(12, 12, 56, 38, C.forestDeep, 1.2);
    p.rect(14, 14, 52, 6, C.cream);
    for (let i = 0; i < 3; i += 1) {
      p.ellipse(18 + i * 4, 17, 1.1, 1.1, A(C.ink, 0.5));
    }

    // App tiles: store, second life, ledger, bag.
    const tile = (tx, ty, color, symbol) => {
      p.rect(tx, ty, 11, 11, color);
      p.strokeRect(tx, ty, 11, 11, A(C.ink, 0.35), 0.7);
      symbol(tx, ty);
    };
    tile(17, 24, C.leaf, (x, y) => p.ellipse(x + 5.5, y + 5.5, 3, 2, C.paper));
    tile(32, 24, C.mustard, (x, y) => p.rect(x + 5, y + 3, 2, 6, C.forest));
    tile(47, 24, C.terracotta, (x, y) => p.arc(x + 5.5, y + 6, 3, 2.4, Math.PI, Math.PI * 2, C.paper, 1));
    tile(17, 36, C.blue, (x, y) => p.rect(x + 3, y + 5, 5, 3, C.paper));
    tile(32, 36, C.sage, (x, y) => p.line(x + 3, y + 8, x + 8, y + 3, C.paper, 1.2));
    tile(47, 36, C.creamDeep, (x, y) => p.ellipse(x + 5.5, y + 5.5, 2, 2, C.terracotta));

    // Bottom status bar + power light.
    p.rect(12, 52, 56, 7, A(C.paper, 0.75));
    p.rect(12, 52, 56, 1, A(C.ink, 0.15));
    p.ellipse(68, 30, 1.6, 1.6, C.mustard);
    p.ellipse(40, 58, 1.6, 1.6, C.mustardDeep);
  }],

  "furniture/donation_station.png": [88, 92, (p) => {
    // Legs.
    p.rect(14, 52, 9, 36, C.woodDark);
    p.rect(65, 52, 9, 36, C.woodDark);
    p.strokeRect(14, 52, 9, 36, A(C.ink, 0.6), 1.1);
    p.strokeRect(65, 52, 9, 36, A(C.ink, 0.6), 1.1);

    // Counter.
    p.rect(3, 34, 82, 18, C.wood);
    p.strokeRect(2, 33, 84, 20, C.ink, 1.8);
    p.rect(3, 34, 82, 4, C.woodLight);
    p.rect(3, 48, 82, 4, C.woodDark);

    // Front apron with the reuse mark.
    p.rect(14, 52, 60, 14, C.cream);
    p.strokeRect(14, 52, 60, 14, A(C.ink, 0.45), 1.1);
    p.arc(36, 59, 7, 4, Math.PI * 0.15, Math.PI * 0.85, C.leafDark, 1.8);
    p.arc(36, 59, 7, 4, Math.PI * 1.15, Math.PI * 1.85, C.leafDark, 1.8);
    p.line(29, 56, 26, 59, C.leafDark, 1.6);
    p.line(43, 62, 46, 59, C.leafDark, 1.6);

    // Woven basket on the counter.
    p.rect(24, 8, 40, 26, C.mustard);
    p.strokeRect(23, 7, 42, 28, C.ink, 1.6);
    for (let y = 12; y < 32; y += 5) {
      p.line(25, y, 63, y, A(C.mustardDeep, 0.55), 1.2);
    }
    for (let x = 28; x < 64; x += 6) {
      p.line(x, 9, x, 33, A(C.mustardDeep, 0.3), 0.9);
    }
    p.rect(23, 7, 42, 5, C.mustardDeep);
    p.rect(23, 7, 42, 1.6, C.paper);
    p.ellipse(44, 18, 4, 3, C.leaf);
    p.line(44, 21, 44, 26, C.leafDark, 1);

    // A repaired jar and a folded cloth on the left.
    p.rect(8, 22, 10, 11, C.blue);
    p.strokeRect(8, 22, 10, 11, A(C.ink, 0.5), 1);
    p.rect(7, 20, 12, 3, C.creamDeep);
    p.rect(70, 24, 12, 9, C.terracotta);
    p.rect(70, 24, 12, 2, C.terracottaDeep);
  }],

  "furniture/plant.png": [44, 64, (p) => {
    // Pot.
    p.rect(13, 42, 18, 19, C.terracotta);
    p.strokeRect(12.5, 41.5, 19, 20, C.ink, 1.6);
    p.rect(10, 37, 24, 6, C.terracottaDeep);
    p.strokeRect(9.5, 36.5, 25, 7, C.ink, 1.4);
    p.rect(11, 38, 22, 1.6, A(C.cream, 0.6));
    p.rect(14, 45, 3, 10, A(C.cream, 0.25));
    p.ellipse(22, 42, 8, 2.4, C.inkBrown);

    // Stems and leaves.
    const leaf = (cx, cy, rx, ry, tilt, dark) => {
      p.ellipse(cx, cy, rx, ry, dark ? C.leaf : C.leafPale);
      p.line(cx - rx * 0.7, cy + ry * 0.2, cx + rx * 0.7, cy - ry * 0.2, A(C.leafDark, 0.6), 0.8);
      p.ring(cx, cy, rx, ry, A(C.leafDark, 0.35), 0.7);
    };
    p.line(21, 42, 21, 18, C.leafDark, 1.8);
    p.line(21, 32, 12, 27, C.leafDark, 1.4);
    p.line(21, 26, 30, 20, C.leafDark, 1.4);
    p.line(21, 22, 17, 13, C.leafDark, 1.2);
    leaf(11, 26, 8.5, 4, 0, false);
    leaf(31, 19, 8, 3.8, 0, true);
    leaf(16, 13, 6.5, 3.4, 0, true);
    leaf(23, 8, 6, 3, 0, false);
    leaf(29, 28, 6, 3, 0, false);
  }],

  "items/parcel.png": [40, 40, (p) => {
    // Kraft box.
    p.rect(6, 12, 28, 23, C.wood);
    p.strokeRect(5.5, 11.5, 29, 24, C.ink, 1.6);
    p.rect(6, 12, 28, 4, C.woodDark);
    p.rect(6, 12, 28, 1.4, A(C.cream, 0.35));
    // Flaps seam + tape.
    p.line(20, 12, 20, 35, A(C.inkBrown, 0.4), 1);
    p.rect(18, 12, 5, 23, C.mustard);
    p.rect(18, 12, 5, 1.2, A(C.paper, 0.5));
    // Label.
    p.rect(24, 21, 9, 9, C.paper);
    p.strokeRect(24, 21, 9, 9, A(C.ink, 0.55), 0.9);
    p.line(26, 24, 31, 24, A(C.inkSoft, 0.6), 0.8);
    p.line(26, 27, 30, 27, A(C.inkSoft, 0.6), 0.8);
    p.ellipse(27, 29, 1.2, 1.2, C.leaf);
    // String.
    p.line(8, 15, 14, 15, C.creamDeep, 1.1);
    p.line(8, 15, 8, 33, A(C.creamDeep, 0.8), 1.1);
    // Corner shade.
    p.rect(6, 30, 28, 5, A(C.inkBrown, 0.12));
  }],

  "items/headphones.png": [32, 32, (p) => {
    // Cable.
    p.arc(16, 20, 8, 9, Math.PI * 0.15, Math.PI * 0.95, A(C.ink, 0.5), 1);
    // Band.
    p.arc(16, 18, 12, 11, Math.PI * 1.02, Math.PI * 1.98, C.ink, 3.2);
    p.arc(16, 18, 12, 11, Math.PI * 1.05, Math.PI * 1.95, A(C.cream, 0.35), 1);
    // Cups.
    for (const cx of [5.5, 26.5]) {
      p.rect(cx - 4.5, 15, 9, 12, C.terracotta);
      p.strokeRect(cx - 4.5, 15, 9, 12, C.ink, 1.3);
      p.rect(cx - 3, 17, 6, 8, C.creamDeep);
      p.rect(cx - 4, 16, 1.2, 9, A(C.paper, 0.35));
    }
    p.rect(13.5, 18, 5, 3, A(C.ink, 0.25));
  }],

  "items/hoodie.png": [32, 32, (p) => {
    // Sleeves.
    p.rect(3, 12, 7, 13, C.coral);
    p.rect(22, 12, 7, 13, C.coral);
    p.strokeRect(3, 12, 7, 13, C.ink, 1.2);
    p.strokeRect(22, 12, 7, 13, C.ink, 1.2);
    p.rect(4, 23, 5, 2, C.coralDark);
    p.rect(23, 23, 5, 2, C.coralDark);
    // Body.
    p.rect(9, 11, 14, 16, C.coral);
    p.strokeRect(8.5, 10.5, 15, 17, C.ink, 1.4);
    p.rect(10, 12, 2, 13, A(C.paper, 0.18));
    // Hood.
    p.arc(16, 12, 7, 5, Math.PI, Math.PI * 2, C.coralDark, 4);
    p.ring(16, 12, 6.5, 4.4, A(C.ink, 0.35), 1);
    // Drawstrings + pocket.
    p.line(13, 13, 13, 19, C.cream, 1);
    p.line(19, 13, 19, 19, C.cream, 1);
    p.rect(12, 20, 8, 5, C.coralDark);
    p.strokeRect(12, 20, 8, 5, A(C.ink, 0.45), 1);
    // Ribbed hem.
    p.rect(9, 25, 14, 2.4, C.coralDark);
  }],

  "items/sneakers.png": [32, 32, (p) => {
    // Sole.
    p.rect(4, 23, 24, 5, C.cream);
    p.strokeRect(4, 23, 24, 5, C.ink, 1.3);
    p.rect(4, 26.5, 24, 1.4, C.creamDeep);
    // Upper.
    p.rect(6, 15, 22, 9, C.blue);
    p.strokeRect(5.5, 14.5, 23, 9.5, C.ink, 1.3);
    p.rect(7, 16, 20, 2, A(C.paper, 0.25));
    // Toe cap and heel.
    p.ellipse(26, 20, 3.6, 3.4, C.blueDeep);
    p.ring(26, 20, 3.6, 3.4, A(C.ink, 0.4), 1);
    p.rect(6, 15, 3, 9, C.blueDeep);
    // Laces.
    for (let i = 0; i < 3; i += 1) {
      p.line(11 + i * 5, 16, 14 + i * 5, 21, C.cream, 1.2);
    }
    // Stitching along the sole.
    p.rect(5, 22.5, 22, 1, A(C.ink, 0.18));
  }],

  "items/water_bottle.png": [32, 32, (p) => {
    // Bottle body.
    p.rect(12, 9, 9, 19, C.blue);
    p.strokeRect(11.5, 8.5, 10, 20, C.ink, 1.4);
    p.rect(13, 10, 2, 16, A(C.paper, 0.28));
    // Cap.
    p.rect(13, 4, 7, 5, C.creamDeep);
    p.strokeRect(12.5, 3.5, 8, 6, C.ink, 1.1);
    p.rect(13.5, 4.5, 6, 1.2, C.paper);
    // Label.
    p.rect(12, 16, 9, 6, C.leaf);
    p.strokeRect(12, 16, 9, 6, A(C.ink, 0.4), 0.9);
    p.line(13, 19, 20, 19, A(C.paper, 0.7), 1);
    p.ellipse(16.5, 18, 1.6, 1.2, C.paper);
    // Base shade.
    p.rect(12, 26, 9, 2, C.blueDeep);
  }],

  "items/trendy_sneakers.png": [32, 32, (p) => {
    // Thick cream sole.
    p.rect(3, 21, 26, 7, C.paper);
    p.strokeRect(2.5, 20.5, 27, 8, C.ink, 1.3);
    p.rect(3, 26, 26, 2, C.mustard);
    // Upper.
    p.rect(8, 11, 19, 10, C.paper);
    p.strokeRect(7.5, 10.5, 20, 11, C.ink, 1.3);
    p.rect(9, 12, 17, 1.6, A(C.paperDeep, 0.9));
    // Swoosh.
    p.line(10, 18, 24, 13, C.terracottaDeep, 2.4);
    p.line(11, 19.4, 25, 14.4, A(C.terracotta, 0.7), 1.2);
    // Laces.
    for (let i = 0; i < 3; i += 1) {
      p.line(12 + i * 4, 13, 14 + i * 4, 17, C.mustardDeep, 1);
    }
    // Heel tab.
    p.rect(7, 12, 2.6, 7, C.terracotta);
  }],

  "items/wireless_headphones.png": [32, 32, (p) => {
    // Band.
    p.arc(16, 18, 12, 12, Math.PI * 1.02, Math.PI * 1.98, C.blueDeep, 3.4);
    p.arc(16, 18, 12, 12, Math.PI * 1.06, Math.PI * 1.94, A(C.paper, 0.35), 1);
    p.arc(16, 18, 8, 8, Math.PI * 1.15, Math.PI * 1.85, A(C.cream, 0.5), 1);
    // Cups.
    for (const cx of [5, 27]) {
      p.rect(cx - 4.6, 16, 9.2, 12, C.mustard);
      p.strokeRect(cx - 4.6, 16, 9.2, 12, C.ink, 1.3);
      p.rect(cx - 3, 18, 6, 8, C.creamDeep);
      p.ring(cx, 22, 2.4, 2.4, A(C.ink, 0.25), 0.9);
    }
    // Tiny power light.
    p.ellipse(27, 26, 1, 1, C.leafDeep);
  }],

  "items/party_speaker.png": [32, 32, (p) => {
    // Box.
    p.rect(6, 8, 20, 21, C.woodMid);
    p.strokeRect(5.5, 7.5, 21, 22, C.ink, 1.4);
    p.rect(7, 9, 18, 2, A(C.paper, 0.3));
    // Grille.
    p.rect(9, 12, 14, 12, C.cream);
    p.strokeRect(9, 12, 14, 12, A(C.ink, 0.4), 1);
    p.ellipse(16, 18, 3.6, 3.6, C.inkSoft);
    p.ellipse(16, 18, 2, 2, C.creamDeep);
    p.ellipse(16, 18, 0.9, 0.9, C.ink);
    for (let i = 0; i < 4; i += 1) {
      p.ellipse(12 + i * 2.6, 22.5, 0.7, 0.7, A(C.ink, 0.35));
      p.ellipse(12 + i * 2.6, 13.6, 0.7, 0.7, A(C.ink, 0.35));
    }
    // Knob strip.
    p.rect(11, 26, 10, 2.6, C.mustard);
    p.ellipse(24, 27.2, 1.3, 1.3, C.terracotta);
    // Coral strap.
    p.arc(16, 8, 6, 5, Math.PI, Math.PI * 2, C.terracotta, 2);
  }],

  "ui/interaction_icon.png": [24, 24, (p) => {
    p.rect(3, 4, 19, 19, A(C.ink, 0.25));
    p.rect(2, 2, 20, 20, C.mustard);
    p.strokeRect(2, 2, 20, 20, C.forest, 1.8);
    p.rect(3.5, 3.5, 17, 2, A(C.paper, 0.55));
    p.rect(9, 6.5, 8, 2.4, C.forest);
    p.rect(9, 6.5, 2.4, 11, C.forest);
    p.rect(9, 11.5, 6, 2.2, C.forest);
    p.rect(9, 15.5, 8, 2.4, C.forest);
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
