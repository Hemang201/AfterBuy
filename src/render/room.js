/**
 * Room bake.
 *
 * The static part of the world is drawn once into an offscreen canvas and
 * blitted each frame, so the per-frame cost of the environment is one
 * drawImage. The hand-drawn floor tile is kept as a warm texture wash; the
 * plank structure, light and shading are painted here so the floor reads as a
 * room rather than a grid.
 */
import { ROOM, VIEW } from "../game/world.js";
import { COLOR } from "./theme.js";
import { fillRR, roundRect } from "./ui.js";

const TILE = 32;

function drawTiles(ctx, image, rect, fallback, gridColor) {
  if (!image) {
    ctx.fillStyle = fallback;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let x = rect.x; x <= rect.x + rect.w; x += TILE) {
      ctx.beginPath();
      ctx.moveTo(x, rect.y);
      ctx.lineTo(x, rect.y + rect.h);
      ctx.stroke();
    }
    for (let y = rect.y; y <= rect.y + rect.h; y += TILE) {
      ctx.beginPath();
      ctx.moveTo(rect.x, y);
      ctx.lineTo(rect.x + rect.w, y);
      ctx.stroke();
    }
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  for (let y = rect.y; y < rect.y + rect.h; y += TILE) {
    for (let x = rect.x; x < rect.x + rect.w; x += TILE) {
      ctx.drawImage(image, x, y, TILE, TILE);
    }
  }
  ctx.restore();
}

/** Tiny deterministic grain tile, used at very low alpha. */
function grainTile(size = 64, alpha = 10) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(size, size);
  let seed = 20261017;
  for (let i = 0; i < size * size; i += 1) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const shade = seed / 4294967296 < 0.5 ? 40 : 255;
    image.data[i * 4] = shade;
    image.data[i * 4 + 1] = shade;
    image.data[i * 4 + 2] = shade;
    image.data[i * 4 + 3] = alpha;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

/**
 * Warm plank floor. Boards run left-to-right with staggered joints; each board
 * gets a slightly different tone so the eye reads material, not repetition.
 */
function drawFloor(ctx, asset, area) {
  const base = ctx.createLinearGradient(0, area.y, 0, area.y + area.h);
  base.addColorStop(0, "#CDA774");
  base.addColorStop(0.55, "#C39A69");
  base.addColorStop(1, "#B98C5D");
  ctx.fillStyle = base;
  ctx.fillRect(area.x, area.y, area.w, area.h);

  // The player's hand-drawn tile contributes its sand tone as a soft wash.
  // Blurring it keeps the material colour without re-introducing a square grid
  // under the plank seams.
  if (asset) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    if ("filter" in ctx) ctx.filter = "blur(3px)";
    drawTiles(ctx, asset, area, "#CDA774", "rgba(116, 105, 87, 0.2)");
    ctx.filter = "none";
    ctx.restore();
  }

  const board = 46;
  const joint = 168;
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();

  let row = 0;
  for (let y = area.y; y < area.y + area.h; y += board, row += 1) {
    // Alternate board tone.
    ctx.fillStyle = row % 2 === 0 ? "rgba(255, 233, 196, 0.10)" : "rgba(97, 67, 41, 0.06)";
    ctx.fillRect(area.x, y, area.w, board - 1);

    // Long seam at the bottom of every board.
    ctx.fillStyle = "rgba(94, 66, 42, 0.30)";
    ctx.fillRect(area.x, y + board - 2, area.w, 1.5);
    ctx.fillStyle = "rgba(255, 240, 210, 0.18)";
    ctx.fillRect(area.x, y + board - 0.5, area.w, 1);

    // Staggered end joints.
    const offset = row % 2 === 0 ? 0 : joint / 2;
    for (let x = area.x + offset; x < area.x + area.w; x += joint) {
      ctx.fillStyle = "rgba(94, 66, 42, 0.24)";
      ctx.fillRect(x, y + 2, 1.5, board - 4);
      ctx.fillStyle = "rgba(255, 240, 210, 0.14)";
      ctx.fillRect(x + 1.5, y + 2, 1, board - 4);
    }

    // Wood grain: a couple of soft strokes per board.
    ctx.strokeStyle = "rgba(120, 86, 54, 0.16)";
    ctx.lineWidth = 1;
    for (let g = 0; g < 2; g += 1) {
      const gy = y + 12 + g * 16 + ((row * 7 + g * 5) % 6);
      ctx.beginPath();
      ctx.moveTo(area.x + 8, gy);
      ctx.bezierCurveTo(
        area.x + area.w * 0.3,
        gy - 2,
        area.x + area.w * 0.6,
        gy + 2,
        area.x + area.w - 8,
        gy - 1,
      );
      ctx.stroke();
    }
  }
  ctx.restore();

  // Grain wash over everything.
  const grain = ctx.createPattern(grainTile(64, 12), "repeat");
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = grain;
  ctx.fillRect(area.x, area.y, area.w, area.h);
  ctx.restore();
}

function drawWindow(ctx) {
  const x = 590;
  const y = 56;
  const w = 160;
  const h = 30;

  // Wall reveal around the frame.
  ctx.fillStyle = "rgba(37, 61, 45, 0.18)";
  ctx.fillRect(x - 6, y, w + 12, h + 4);

  // Cafe curtains: short coral panels that sit inside the wall band.
  for (const side of [0, 1]) {
    const cx = side === 0 ? x - 16 : x + w + 4;
    const gradient = ctx.createLinearGradient(cx, y, cx + 12, y);
    gradient.addColorStop(0, side === 0 ? "#B97057" : "#D08F73");
    gradient.addColorStop(1, side === 0 ? "#D08F73" : "#B97057");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(cx, y - 4);
    ctx.lineTo(cx + 12, y - 4);
    ctx.quadraticCurveTo(cx + 13, y + h * 0.55, cx + 8, y + h + 4);
    ctx.lineTo(cx + 2, y + h + 4);
    ctx.quadraticCurveTo(cx - 2, y + h * 0.5, cx, y - 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(74, 48, 33, 0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 240, 210, 0.28)";
    ctx.beginPath();
    ctx.moveTo(cx + 4, y - 3);
    ctx.quadraticCurveTo(cx + 5, y + h * 0.5, cx + 3, y + h + 2);
    ctx.stroke();
  }

  // Frame + glass.
  fillRR(ctx, x - 4, y - 3, w + 8, h + 7, 3, COLOR.paperShade, COLOR.forestDeep, 2);
  const glass = ctx.createLinearGradient(x, y, x, y + h);
  glass.addColorStop(0, "#DCE7E6");
  glass.addColorStop(0.5, "#C6D8D8");
  glass.addColorStop(1, "#EFE6CF");
  fillRR(ctx, x, y, w, h, 2, glass, null);

  // Abstract hills outside.
  ctx.save();
  roundRect(ctx, x, y, w, h, 2);
  ctx.clip();
  ctx.fillStyle = "rgba(175, 194, 162, 0.55)";
  ctx.beginPath();
  ctx.moveTo(x, y + h - 5);
  ctx.quadraticCurveTo(x + 30, y + h - 18, x + 62, y + h - 6);
  ctx.quadraticCurveTo(x + 96, y + h - 20, x + 130, y + h - 5);
  ctx.quadraticCurveTo(x + 146, y + h - 12, x + w, y + h - 4);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Mullions and a cream sill.
  ctx.strokeStyle = COLOR.forestDeep;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h * 0.46);
  ctx.lineTo(x + w, y + h * 0.46);
  ctx.stroke();
  ctx.fillStyle = COLOR.paperLight;
  ctx.fillRect(x - 10, y + h + 3, w + 20, 4);
  ctx.fillStyle = "rgba(37, 61, 45, 0.30)";
  ctx.fillRect(x - 10, y + h + 7, w + 20, 3);
}

function drawLamp(ctx) {
  const x = 250;
  const top = 56;
  const shadeY = 100;
  ctx.strokeStyle = "rgba(37, 61, 45, 0.55)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top);
  ctx.lineTo(x, shadeY - 5);
  ctx.stroke();

  ctx.save();
  ctx.shadowColor = "rgba(27, 45, 33, 0.22)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = COLOR.terracotta;
  ctx.strokeStyle = COLOR.forestDeep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 3, shadeY - 6);
  ctx.lineTo(x + 3, shadeY - 6);
  ctx.lineTo(x + 18, shadeY + 13);
  ctx.lineTo(x - 18, shadeY + 13);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(255, 236, 189, 0.95)";
  ctx.beginPath();
  ctx.ellipse(x, shadeY + 13, 17, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(201, 155, 65, 0.6)";
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawLight(ctx, area) {
  // Lamp pool.
  const pool = ctx.createRadialGradient(250, 255, 10, 250, 255, 210);
  pool.addColorStop(0, "rgba(255, 226, 166, 0.34)");
  pool.addColorStop(0.45, "rgba(255, 226, 166, 0.14)");
  pool.addColorStop(1, "rgba(255, 226, 166, 0)");
  ctx.fillStyle = pool;
  ctx.fillRect(40, 110, 430, 330);

  // Window daylight falling across the floor.
  ctx.save();
  roundRect(ctx, area.x, area.y, area.w, area.h, 2);
  ctx.clip();
  const shaft = ctx.createLinearGradient(660, 96, 470, 500);
  shaft.addColorStop(0, "rgba(255, 249, 230, 0.30)");
  shaft.addColorStop(0.55, "rgba(255, 249, 230, 0.12)");
  shaft.addColorStop(1, "rgba(255, 249, 230, 0)");
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(596, 96);
  ctx.lineTo(748, 96);
  ctx.lineTo(700, 520);
  ctx.lineTo(444, 520);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Pool of light at the sill.
  const sill = ctx.createRadialGradient(670, 96, 4, 670, 96, 130);
  sill.addColorStop(0, "rgba(255, 249, 232, 0.36)");
  sill.addColorStop(1, "rgba(255, 249, 232, 0)");
  ctx.fillStyle = sill;
  ctx.fillRect(530, 60, 290, 200);
}

function drawEdgeShading(ctx, area) {
  const vignette = ctx.createRadialGradient(480, 330, 220, 480, 330, 640);
  vignette.addColorStop(0, "rgba(27, 45, 33, 0)");
  vignette.addColorStop(0.72, "rgba(27, 45, 33, 0.10)");
  vignette.addColorStop(1, "rgba(27, 45, 33, 0.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const top = ctx.createLinearGradient(0, area.y, 0, area.y + 26);
  top.addColorStop(0, "rgba(37, 61, 45, 0.30)");
  top.addColorStop(1, "rgba(37, 61, 45, 0)");
  ctx.fillStyle = top;
  ctx.fillRect(area.x, area.y, area.w, 26);

  const bottom = ctx.createLinearGradient(0, area.y + area.h - 30, 0, area.y + area.h);
  bottom.addColorStop(0, "rgba(37, 61, 45, 0)");
  bottom.addColorStop(1, "rgba(37, 61, 45, 0.26)");
  ctx.fillStyle = bottom;
  ctx.fillRect(area.x, area.y + area.h - 30, area.w, 30);

  for (const [x, dir] of [
    [area.x, 1],
    [area.x + area.w, -1],
  ]) {
    const side = ctx.createLinearGradient(x, 0, x + dir * 40, 0);
    side.addColorStop(0, "rgba(37, 61, 45, 0.28)");
    side.addColorStop(1, "rgba(37, 61, 45, 0)");
    ctx.fillStyle = side;
    ctx.fillRect(dir > 0 ? x : x - 40, area.y, 40, area.h);
  }
}

export function buildBackground(assets) {
  const canvas = document.createElement("canvas");
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext("2d");
  const area = ROOM.interior;

  // The wall above/behind the room is a deep mat that the HUD sits on.
  ctx.fillStyle = COLOR.forestNight;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  // Wall bands. The tiles are the player's replaceable art, so they stay.
  const wallRects = [
    { x: 16, y: 56, w: 928, h: 32 },
    { x: 16, y: 572, w: 928, h: 24 },
    { x: 16, y: 56, w: 24, h: 540 },
    { x: 920, y: 56, w: 24, h: 540 },
  ];
  for (const rect of wallRects) {
    drawTiles(ctx, assets.get("wall_tile"), rect, COLOR.paperDeep, "rgba(64, 55, 46, 0.10)");
  }

  // Vertical shading + a picture-rail line so the wall reads as a surface.
  const wallShade = ctx.createLinearGradient(0, 56, 0, 88);
  wallShade.addColorStop(0, "rgba(37, 61, 45, 0.16)");
  wallShade.addColorStop(0.75, "rgba(255, 249, 240, 0.10)");
  wallShade.addColorStop(1, "rgba(37, 61, 45, 0.06)");
  ctx.fillStyle = wallShade;
  ctx.fillRect(16, 56, 928, 32);
  ctx.fillStyle = "rgba(255, 249, 240, 0.35)";
  ctx.fillRect(16, 60, 928, 1.5);
  ctx.fillStyle = "rgba(37, 61, 45, 0.12)";
  ctx.fillRect(16, 56, 24, 540);
  ctx.fillRect(920, 56, 24, 540);

  drawFloor(ctx, assets.get("floor_tile"), area);
  drawWindow(ctx);
  drawLamp(ctx);
  drawLight(ctx, area);

  // Skirting board with a lit top edge.
  ctx.fillStyle = COLOR.forestDeep;
  ctx.fillRect(area.x, area.y, area.w, 5);
  ctx.fillRect(area.x, area.y + area.h - 5, area.w, 5);
  ctx.fillStyle = "rgba(255, 249, 240, 0.35)";
  ctx.fillRect(area.x, area.y + 5, area.w, 1.5);
  ctx.fillRect(area.x, area.y + area.h - 6.5, area.w, 1.5);
  ctx.fillStyle = COLOR.forestDeep;
  ctx.fillRect(area.x, area.y, 5, area.h);
  ctx.fillRect(area.x + area.w - 5, area.y, 5, area.h);
  ctx.fillStyle = "rgba(255, 249, 240, 0.28)";
  ctx.fillRect(area.x + 5, area.y, 1.5, area.h);
  ctx.fillRect(area.x + area.w - 6.5, area.y, 1.5, area.h);

  // Picture frame.
  ctx.strokeStyle = "#0E1F15";
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 54, 932, 544);

  drawEdgeShading(ctx, area);

  return canvas;
}
