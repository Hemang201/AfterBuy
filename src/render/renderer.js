import {
  FURNITURE,
  ITEM_SPOTS,
  PALETTE,
  ROOM,
  RUG,
  VIEW,
} from "../game/world.js";
import { selectedProduct } from "../game/state.js";
import { PRODUCTS, formatMoney, getItemDef } from "../game/items.js";
import { STATUS_LABELS, currentActions, productStatus } from "../game/economy.js";
import {
  EVENING_OPTIONS,
  currentItemActions,
  getSummary,
  itemStatusLine,
  selectedCareItem,
} from "../game/care.js";
import { drawFallback } from "./fallback.js";

const ink = PALETTE.ink;
const FONT_UI = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const FONT_TITLE = 'Georgia, "Times New Roman", serif';

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function fillRoundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth = 2) {
  roundRect(ctx, x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Fits text on one line, adding an ellipsis when it has to be shortened. */
function fitLine(ctx, text, maxWidth) {
  const value = String(text);
  if (ctx.measureText(value).width <= maxWidth) return value;
  let clipped = value;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped.trimEnd()}…`;
}

/** Keeps the first `maxLines` wrapped lines and marks omitted text. */
function wrapClamped(ctx, text, maxWidth, maxLines) {
  const lines = wrapText(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;
  const shown = lines.slice(0, maxLines);
  shown[maxLines - 1] = fitLine(ctx, `${shown[maxLines - 1]} …`, maxWidth);
  return shown;
}

function drawTiles(ctx, image, rect, fallbackColor, gridColor) {
  const tile = 32;
  if (!image) {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let x = rect.x; x <= rect.x + rect.w; x += tile) {
      ctx.beginPath();
      ctx.moveTo(x, rect.y);
      ctx.lineTo(x, rect.y + rect.h);
      ctx.stroke();
    }
    for (let y = rect.y; y <= rect.y + rect.h; y += tile) {
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
  for (let y = rect.y; y < rect.y + rect.h; y += tile) {
    for (let x = rect.x; x < rect.x + rect.w; x += tile) {
      ctx.drawImage(image, x, y, tile, tile);
    }
  }
  ctx.restore();
}

function buildBackground(assets) {
  const canvas = document.createElement("canvas");
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext("2d");
  const area = ROOM.interior;

  ctx.fillStyle = PALETTE.night;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  const wallRects = [
    { x: 16, y: 56, w: 928, h: 32 },
    { x: 16, y: 572, w: 928, h: 24 },
    { x: 16, y: 56, w: 24, h: 540 },
    { x: 920, y: 56, w: 24, h: 540 },
  ];
  for (const rect of wallRects) {
    drawTiles(ctx, assets.get("wall_tile"), rect, PALETTE.creamDeep, "rgba(46,74,58,0.12)");
  }

  drawTiles(
    ctx,
    assets.get("floor_tile"),
    area,
    PALETTE.cream,
    "rgba(154, 106, 69, 0.16)",
  );

  // Soft checker variation keeps the floor from reading as flat colour.
  ctx.fillStyle = "rgba(234, 217, 188, 0.22)";
  for (let row = 0; row * 32 < area.h; row += 1) {
    for (let col = 0; col * 32 < area.w; col += 1) {
      if ((row + col) % 3 === 0) {
        ctx.fillRect(area.x + col * 32, area.y + row * 32, 32, 32);
      }
    }
  }

  // Pale window on the top wall.
  ctx.fillStyle = PALETTE.blue;
  roundRect(ctx, 612, 58, 124, 28, 4);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 249, 236, 0.82)";
  ctx.beginPath();
  ctx.arc(712, 68, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.cream;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(674, 58);
  ctx.lineTo(674, 86);
  ctx.moveTo(612, 72);
  ctx.lineTo(736, 72);
  ctx.stroke();

  // Baseboard and room edge.
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(area.x - 2, area.y - 2, area.w + 4, area.h + 4);
  ctx.strokeStyle = "rgba(255, 249, 236, 0.55)";
  ctx.lineWidth = 2;
  ctx.strokeRect(area.x + 1, area.y + 1, area.w - 2, area.h - 2);

  // Warm vignette.
  const gradient = ctx.createRadialGradient(480, 320, 180, 480, 320, 620);
  gradient.addColorStop(0, "rgba(46, 74, 58, 0)");
  gradient.addColorStop(1, "rgba(46, 74, 58, 0.16)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);

  return canvas;
}

export function createRenderer(canvas, assets) {
  const ctx = canvas.getContext("2d");
  const background = buildBackground(assets);

  function drawAsset(id, x, y, w, h, alpha = 1) {
    const entry = assets.manifest[id];
    const image = assets.get(id);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (image) {
      ctx.drawImage(image, x, y, w, h);
    } else {
      drawFallback(ctx, id, entry, x, y, w, h);
    }
    ctx.restore();
  }

  function drawShadow(x, y, rx, ry, alpha = 0.16) {
    ctx.save();
    ctx.fillStyle = `rgba(46, 74, 58, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    const walk = player.moving;
    const image = assets.get(walk ? "player_walk" : "player_idle");
    const frameCount = walk ? assets.manifest.player_walk.frames : 1;
    const frameWidth = 32;
    const frameHeight = 48;
    const frame = walk
      ? Math.floor(player.walkTime * assets.manifest.player_walk.fps) % frameCount
      : 0;

    drawShadow(player.x, player.y + 1, 13, 5, 0.2);

    ctx.save();
    if (player.facing === "left") {
      ctx.translate(player.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-player.x, 0);
    }
    if (image) {
      ctx.drawImage(
        image,
        frame * frameWidth,
        0,
        frameWidth,
        frameHeight,
        Math.round(player.x - 16),
        Math.round(player.y - 48),
        frameWidth,
        frameHeight,
      );
    } else {
      drawFallback(
        ctx,
        walk ? "player_walk" : "player_idle",
        assets.manifest.player_idle,
        Math.round(player.x - 16),
        Math.round(player.y - 48),
        32,
        48,
      );
    }
    ctx.restore();
  }

  function itemSpot(state, itemId) {
    const fixed = ITEM_SPOTS[itemId];
    if (fixed) return fixed;
    const parcel = state.parcels.find((entry) => entry.itemId === itemId);
    if (!parcel) return null;
    const def = getItemDef(itemId);
    return {
      x: parcel.x - 12,
      y: parcel.y - 66,
      w: 26,
      h: 26,
      asset: def ? def.asset : "parcel",
    };
  }

  function drawItemBadge(spot, kind) {
    const x = spot.x + spot.w - 3;
    const y = spot.y - 3;
    if (kind === "care") {
      ctx.save();
      ctx.fillStyle = PALETTE.yellow;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.font = `700 9px ${FONT_UI}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", x, y + 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.restore();
    } else if (kind === "repaired") {
      ctx.save();
      ctx.strokeStyle = PALETTE.leafDark;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 3, y);
      ctx.lineTo(x, y + 3);
      ctx.lineTo(x + 5, y - 4);
      ctx.stroke();
      ctx.restore();
    } else if (kind === "in-use") {
      ctx.save();
      ctx.fillStyle = PALETTE.leaf;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function itemBadgeKind(item) {
    if (item.condition === "Worn" || item.status === "unused") return "care";
    if (item.status === "repaired" || item.condition === "Repaired") return "repaired";
    if (item.status === "in-use") return "in-use";
    return null;
  }

  function drawItemSpots(state) {
    // Undiscovered household items stay visible in their hiding places.
    for (const itemId of ["headphones", "hoodie", "sneakers"]) {
      if (state.discoveredItemIds.includes(itemId)) continue;
      const spot = ITEM_SPOTS[itemId];
      drawAsset(spot.asset, spot.x, spot.y, spot.w, spot.h);
    }

    for (const item of state.inventory) {
      const spot = itemSpot(state, item.itemId);
      if (!spot) continue;
      drawShadow(spot.x + spot.w / 2, spot.y + spot.h + 2, 10, 3, 0.14);
      drawAsset(spot.asset, spot.x, spot.y, spot.w, spot.h);
      const badge = itemBadgeKind(item);
      if (badge) drawItemBadge(spot, badge);
    }
  }

  function drawStationMarker(state) {
    if (state.secondLife.length === 0) return;
    const x = 324;
    const y = 410;
    fillRoundRect(ctx, x - 32, y - 13, 64, 22, 8, PALETTE.cream, ink, 1.6);
    ctx.fillStyle = PALETTE.leafDark;
    ctx.beginPath();
    ctx.ellipse(x - 18, y - 2, 5, 3.4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const items = new Set(state.secondLife.map((entry) => entry.itemId)).size;
    ctx.fillText(`${items} second ${items === 1 ? "life" : "lives"}`, x - 8, y - 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawParcel(state, parcel) {
    const bob = parcel.opened ? 0 : Math.sin(state.elapsed * 2.4) * 2;
    const x = parcel.x - 20;
    const y = parcel.y - 40 + bob;

    drawShadow(parcel.x, parcel.y - 1, 18, 6, 0.18);
    drawAsset("parcel", x, y, 40, 40);

    if (parcel.opened) {
      ctx.save();
      ctx.strokeStyle = "rgba(46, 74, 58, 0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 7, y + 13);
      ctx.lineTo(x + 33, y + 13);
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = PALETTE.yellow;
      ctx.beginPath();
      ctx.arc(parcel.x + 16, y + 5, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawRoom(state) {
    ctx.drawImage(background, 0, 0);

    drawAsset(RUG.asset, RUG.x, RUG.y, RUG.w, RUG.h);

    const entities = [];
    for (const furniture of FURNITURE) {
      entities.push({
        sortY: furniture.y + furniture.h,
        draw: () => {
          drawShadow(
            furniture.x + furniture.w / 2,
            furniture.y + furniture.h - 2,
            furniture.w * 0.38,
            5,
            0.14,
          );
          drawAsset(furniture.asset, furniture.x, furniture.y, furniture.w, furniture.h);
        },
      });
    }
    for (const parcel of state.parcels) {
      entities.push({
        sortY: parcel.y,
        draw: () => drawParcel(state, parcel),
      });
    }
    entities.push({ sortY: state.player.y, draw: () => drawPlayer(state) });
    entities.sort((a, b) => a.sortY - b.sortY);
    for (const entity of entities) entity.draw();

    drawItemSpots(state);
    drawStationMarker(state);
  }

  function drawInteraction(state, nearest) {
    if (!nearest || state.ui.dialogue || state.ui.phone.open) return;
    const { anchor, name, verb } = nearest.interactable;
    const pulse = 0.55 + Math.sin(state.elapsed * 4.5) * 0.22;

    ctx.save();
    ctx.strokeStyle = PALETTE.yellow;
    ctx.globalAlpha = pulse;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(anchor.x, anchor.y, 30, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.font = `600 15px ${FONT_UI}`;
    const label = `${verb} ${name}`;
    const textWidth = ctx.measureText(label).width;
    const bubbleW = Math.round(textWidth + 62);
    const bubbleH = 38;
    let bubbleX = Math.round(anchor.x - bubbleW / 2);
    bubbleX = Math.max(14, Math.min(VIEW.width - bubbleW - 14, bubbleX));
    let bubbleY = Math.round(anchor.y - 72);
    bubbleY = Math.max(66, Math.min(VIEW.height - bubbleH - 120, bubbleY));
    const tailX = Math.max(bubbleX + 22, Math.min(bubbleX + bubbleW - 22, anchor.x));

    ctx.save();
    ctx.shadowColor = "rgba(46, 74, 58, 0.26)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    fillRoundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 10, PALETTE.cream, ink, 2);
    ctx.restore();

    ctx.fillStyle = PALETTE.cream;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tailX - 7, bubbleY + bubbleH - 1);
    ctx.lineTo(tailX + 7, bubbleY + bubbleH - 1);
    ctx.lineTo(tailX, bubbleY + bubbleH + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Hide the bubble border behind the tail.
    ctx.fillStyle = PALETTE.cream;
    ctx.fillRect(tailX - 6, bubbleY + bubbleH - 3, 12, 4);

    drawAsset("interaction_icon", bubbleX + 9, bubbleY + 7, 24, 24);
    ctx.fillStyle = ink;
    ctx.font = `600 15px ${FONT_UI}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, bubbleX + 40, bubbleY + bubbleH / 2 + 1);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawHud(state) {
    const x = 20;
    const y = 12;
    const w = 486;
    const h = 42;

    ctx.save();
    ctx.shadowColor = "rgba(46, 74, 58, 0.22)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    fillRoundRect(ctx, x, y, w, h, 12, PALETTE.cream, ink, 2);
    ctx.restore();

    ctx.textBaseline = "middle";
    ctx.textAlign = "left";

    // Day
    ctx.fillStyle = PALETTE.yellow;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 22, y + 21, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillText("DAY", x + 36, y + 17);
    ctx.font = `700 16px ${FONT_UI}`;
    ctx.fillText(String(state.day), x + 36, y + 31);

    const divider = (dx) => {
      ctx.strokeStyle = "rgba(46, 74, 58, 0.22)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(dx, y + 11);
      ctx.lineTo(dx, y + h - 11);
      ctx.stroke();
    };
    divider(x + 80);

    // Money
    ctx.fillStyle = PALETTE.yellow;
    ctx.beginPath();
    ctx.arc(x + 100, y + 21, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = `700 9px ${FONT_UI}`;
    ctx.textAlign = "center";
    ctx.fillText("₹", x + 100, y + 22);
    ctx.textAlign = "left";
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillText("WALLET", x + 114, y + 17);
    ctx.font = `700 16px ${FONT_UI}`;
    ctx.fillText(formatMoney(state.money), x + 114, y + 31);

    divider(x + 214);

    // Bag
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    roundRect(ctx, x + 232, y + 14, 16, 14, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + 240, y + 14, 5, Math.PI, 0);
    ctx.stroke();
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillText("BAG", x + 256, y + 17);
    ctx.font = `700 16px ${FONT_UI}`;
    const count = state.inventory.length;
    ctx.fillText(`${count} ${count === 1 ? "item" : "items"}`, x + 256, y + 31);

    divider(x + 352);

    // Ledger: the run history the player has written so far.
    ctx.fillStyle = PALETTE.leaf;
    ctx.beginPath();
    ctx.arc(x + 370, y + 21, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = PALETTE.cream;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 366, y + 21);
    ctx.lineTo(x + 369, y + 24);
    ctx.lineTo(x + 374, y + 18);
    ctx.stroke();
    ctx.strokeStyle = ink;
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = ink;
    ctx.fillText("LEDGER", x + 384, y + 17);
    ctx.font = `700 16px ${FONT_UI}`;
    const moves = state.history.length;
    ctx.fillText(`${moves} ${moves === 1 ? "move" : "moves"}`, x + 384, y + 31);

    // Small location note on the right.
    ctx.font = `italic 13px ${FONT_UI}`;
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(246, 237, 220, 0.9)";
    ctx.fillText("a quiet afternoon at home", VIEW.width - 22, 36);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  function drawDialogue(state) {
    const dialogue = state.ui.dialogue;
    if (!dialogue) return;
    const x = 150;
    const y = 400;
    const w = 660;
    const h = 164;

    ctx.save();
    ctx.shadowColor = "rgba(34, 57, 44, 0.4)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    fillRoundRect(ctx, x, y, w, h, 16, PALETTE.cream, ink, 3);
    ctx.restore();
    fillRoundRect(ctx, x + 10, y + 14, 6, h - 28, 3, PALETTE.coral);

    ctx.fillStyle = PALETTE.ink;
    ctx.font = `700 21px ${FONT_TITLE}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(dialogue.title, x + 30, y + 36);

    ctx.font = `400 15px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    let lineY = y + 62;
    for (const line of dialogue.lines) {
      for (const wrapped of wrapText(ctx, line, w - 60)) {
        if (lineY > y + h - 30) break;
        ctx.fillText(wrapped, x + 30, lineY);
        lineY += 21;
      }
      lineY += 2;
    }

    ctx.font = `600 12px ${FONT_UI}`;
    ctx.fillStyle = "rgba(46, 74, 58, 0.65)";
    ctx.textAlign = "right";
    ctx.fillText(dialogue.footer, x + w - 26, y + h - 16);
    ctx.textAlign = "left";
  }

  /**
   * The shopping device. It stays small and anchored beside the terminal in the
   * world, so the room and the character remain visible while it is open.
   */
  const DEVICE = { x: 388, y: 176, w: 356, h: 332 };

  function drawDeviceChrome(state) {
    const { x, y, w, h } = DEVICE;

    // Dashed link down to the terminal's screen: this is that device's display.
    ctx.save();
    ctx.strokeStyle = "rgba(46, 74, 58, 0.45)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x + w - 12, y + 176);
    ctx.lineTo(792, 424);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(20, 34, 25, 0.45)";
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 8;
    fillRoundRect(ctx, x, y, w, h, 24, PALETTE.ink, "#16261c", 3);
    ctx.restore();

    fillRoundRect(
      ctx,
      x + 9,
      y + 9,
      w - 18,
      h - 18,
      18,
      PALETTE.cream,
      "rgba(246, 237, 220, 0.45)",
      1.5,
    );

    ctx.save();
    roundRect(ctx, x + 9, y + 9, w - 18, h - 18, 18);
    ctx.clip();
    ctx.fillStyle = "rgba(46, 74, 58, 0.09)";
    ctx.fillRect(x + 9, y + 9, w - 18, 50);
    ctx.restore();

    fillRoundRect(ctx, x + w / 2 - 26, y + 15, 52, 6, 3, "rgba(46, 74, 58, 0.32)");

    ctx.fillStyle = PALETTE.inkSoft;
    for (let i = 0; i < 3; i += 1) {
      ctx.fillRect(x + 22 + i * 5, y + 24 - i * 2, 3, 3 + i * 2);
    }
    ctx.strokeStyle = PALETTE.inkSoft;
    ctx.lineWidth = 1.5;
    roundRect(ctx, x + w - 40, y + 18, 17, 8, 2);
    ctx.stroke();
    ctx.fillStyle = PALETTE.leafDark;
    ctx.fillRect(x + w - 38, y + 20, 10, 4);

    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillStyle = ink;
    ctx.font = `700 15px ${FONT_UI}`;
    ctx.fillText("PocketShop", x + 22, y + 46);

    ctx.textAlign = "right";
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText(`Day ${state.day}  ·  ${formatMoney(state.money)}`, x + w - 22, y + 46);
    ctx.textAlign = "left";
  }

  function drawDeviceProducts(state) {
    // Product list rows sit above the note and footer inside the screen.

    const { x, y, w, h } = DEVICE;
    const phone = state.ui.phone;
    const rowX = x + 20;
    const rowW = w - 40;

    PRODUCTS.forEach((product, index) => {
      const rowY = y + 62 + index * 62;
      const selected = index === phone.selectedIndex;
      const status = productStatus(state, product);
      const badge = STATUS_LABELS[status];

      if (selected) {
        fillRoundRect(ctx, rowX, rowY, rowW, 52, 12, PALETTE.creamDeep, PALETTE.coral, 2);
        fillRoundRect(ctx, rowX + 8, rowY + 9, 5, 34, 2, PALETTE.coral);
      } else {
        fillRoundRect(
          ctx,
          rowX,
          rowY,
          rowW,
          52,
          12,
          "#fffaf0",
          "rgba(46, 74, 58, 0.16)",
          1.5,
        );
      }

      ctx.fillStyle = ink;
      ctx.font = `700 15px ${FONT_UI}`;
      ctx.textAlign = "left";
      ctx.fillText(product.name, rowX + 22, rowY + 22);

      ctx.font = `400 11px ${FONT_UI}`;
      ctx.fillStyle = PALETTE.inkSoft;
      ctx.fillText(product.tag, rowX + 22, rowY + 40);

      ctx.textAlign = "right";
      ctx.font = `700 15px ${FONT_UI}`;
      ctx.fillStyle = PALETTE.coralDark;
      ctx.fillText(formatMoney(product.price), rowX + rowW - 18, rowY + 22);

      if (badge) {
        ctx.font = `700 10px ${FONT_UI}`;
        ctx.fillStyle =
          status === "owned"
            ? PALETTE.leafDark
            : status === "waiting"
              ? PALETTE.coralDark
              : PALETTE.blueDark;
        ctx.fillText(badge, rowX + rowW - 18, rowY + 40);
      }
      ctx.textAlign = "left";
    });

    ctx.font = phone.note ? `600 11px ${FONT_UI}` : `italic 11px ${FONT_UI}`;
    const note = phone.note
      ? wrapClamped(ctx, phone.note, rowW, 3)
      : ["Buy what you will use. Wait when you are unsure."];
    ctx.fillStyle = phone.note ? PALETTE.coralDark : "rgba(46, 74, 58, 0.6)";
    note.forEach((line, index) => ctx.fillText(line, rowX + 2, y + 262 + index * 15));

    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = "rgba(46, 74, 58, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText("W / S select      E open      Esc close", x + w / 2, y + h - 22);
    ctx.textAlign = "left";
  }

  function drawDeviceActions(state) {
    const { x, y, w, h } = DEVICE;
    const phone = state.ui.phone;
    const product = selectedProduct(state);
    const actions = currentActions(state);
    const rowX = x + 20;
    const rowW = w - 40;

    ctx.fillStyle = ink;
    ctx.font = `700 16px ${FONT_UI}`;
    ctx.textAlign = "left";
    ctx.fillText(product.name, rowX + 2, y + 70);

    ctx.textAlign = "right";
    ctx.font = `700 15px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.coralDark;
    ctx.fillText(formatMoney(product.price), rowX + rowW - 2, y + 70);

    ctx.textAlign = "left";
    ctx.font = `400 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText(fitLine(ctx, product.blurb, rowW - 4), rowX + 2, y + 88);

    actions.forEach((action, index) => {
      const rowY = y + 100 + index * 44;
      const selected = index === phone.actionIndex;

      if (selected) {
        fillRoundRect(ctx, rowX, rowY, rowW, 42, 10, PALETTE.creamDeep, PALETTE.coral, 2);
        fillRoundRect(ctx, rowX + 7, rowY + 8, 4, 26, 2, PALETTE.coral);
      } else {
        fillRoundRect(
          ctx,
          rowX,
          rowY,
          rowW,
          42,
          10,
          action.enabled ? "#fffaf0" : "rgba(46, 74, 58, 0.07)",
          "rgba(46, 74, 58, 0.14)",
          1.2,
        );
      }

      ctx.textAlign = "left";
      ctx.font = `600 13px ${FONT_UI}`;
      ctx.fillStyle = action.enabled ? ink : "rgba(46, 74, 58, 0.45)";
      ctx.fillText(action.label, rowX + 20, rowY + 17);

      ctx.font = `400 10px ${FONT_UI}`;
      ctx.fillStyle = action.enabled ? PALETTE.inkSoft : PALETTE.coralDark;
      ctx.fillText(action.reason || action.note || "", rowX + 20, rowY + 32);
    });

    const noteTop = y + 100 + actions.length * 44 + 10;
    const available = Math.max(1, Math.floor((y + h - 34 - noteTop) / 15) + 1);
    ctx.font = `600 11px ${FONT_UI}`;
    const note = phone.note
      ? wrapClamped(ctx, phone.note, rowW, available)
      : ["No money moves unless you choose to buy."];
    ctx.fillStyle = phone.note ? PALETTE.coralDark : "rgba(46, 74, 58, 0.6)";
    note.forEach((line, index) => ctx.fillText(line, rowX + 2, noteTop + index * 15));

    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = "rgba(46, 74, 58, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText("W / S select      E choose      Esc back", x + w / 2, y + h - 18);
    ctx.textAlign = "left";
  }

  const CARE = { w: 420, h: 330 };

  function drawSheetChrome(header, state) {
    const x = state.player.x < 480 ? 480 : 60;
    const y = 150;
    const { w, h } = CARE;

    ctx.save();
    ctx.strokeStyle = "rgba(46, 74, 58, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(state.player.x, state.player.y - 34);
    ctx.lineTo(x < 480 ? x : x + w, y + h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = "rgba(20, 34, 25, 0.4)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    fillRoundRect(ctx, x, y, w, h, 18, PALETTE.ink, "#16261c", 3);
    ctx.restore();
    fillRoundRect(ctx, x + 8, y + 8, w - 16, h - 16, 14, PALETTE.cream, null);

    ctx.save();
    roundRect(ctx, x + 8, y + 8, w - 16, h - 16, 14);
    ctx.clip();
    ctx.fillStyle = "rgba(46, 74, 58, 0.09)";
    ctx.fillRect(x + 8, y + 8, w - 16, 46);
    ctx.restore();

    ctx.fillStyle = ink;
    ctx.font = `700 16px ${FONT_UI}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(header, x + 22, y + 40);

    ctx.textAlign = "right";
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText(`Day ${state.day}  ·  ${formatMoney(state.money)}`, x + w - 22, y + 40);
    ctx.textAlign = "left";

    return { x, y, w, h };
  }

  function drawCare(state) {
    const care = state.ui.care;
    if (!care.open) return;
    const { x, y, w, h } = drawSheetChrome("Second Life", state);
    const rowX = x + 16;
    const rowW = w - 32;

    if (care.view === "items") {
      state.inventory.slice(0, 6).forEach((item, index) => {
        const rowY = y + 58 + index * 40;
        const selected = index === care.itemIndex;

        if (selected) {
          fillRoundRect(ctx, rowX, rowY, rowW, 36, 10, PALETTE.creamDeep, PALETTE.coral, 2);
          fillRoundRect(ctx, rowX + 7, rowY + 7, 4, 22, 2, PALETTE.coral);
        } else {
          fillRoundRect(ctx, rowX, rowY, rowW, 36, 10, "#fffaf0", "rgba(46, 74, 58, 0.14)", 1.2);
        }

        ctx.fillStyle = ink;
        ctx.font = `600 12px ${FONT_UI}`;
        ctx.fillText(item.name, rowX + 20, rowY + 16);
        ctx.font = `400 10px ${FONT_UI}`;
        ctx.fillStyle = PALETTE.inkSoft;
        ctx.fillText(itemStatusLine(item), rowX + 20, rowY + 29);

        const needs = item.condition === "Worn" || item.status === "unused";
        if (needs) {
          ctx.fillStyle = PALETTE.yellow;
          ctx.beginPath();
          ctx.arc(rowX + rowW - 16, rowY + 18, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = ink;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      });

      ctx.font = `600 11px ${FONT_UI}`;
      ctx.fillStyle = "rgba(46, 74, 58, 0.7)";
      ctx.textAlign = "center";
      ctx.fillText("W / S select      E actions      Esc close", x + w / 2, y + h - 18);
      ctx.textAlign = "left";
      return;
    }

    const item = selectedCareItem(state);
    const actions = currentItemActions(state);
    const def = item ? getItemDef(item.itemId) : null;

    ctx.fillStyle = ink;
    ctx.font = `700 15px ${FONT_UI}`;
    ctx.fillText(item ? item.name : "Item", rowX + 2, y + 74);

    ctx.textAlign = "right";
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText(item ? itemStatusLine(item) : "", rowX + rowW - 2, y + 74);
    ctx.textAlign = "left";

    ctx.font = `italic 10px ${FONT_UI}`;
    ctx.fillStyle = "rgba(46, 74, 58, 0.62)";
    ctx.fillText(fitLine(ctx, (def && def.careNote) || "", rowW - 4), rowX + 2, y + 92);

    actions.forEach((action, index) => {
      const rowY = y + 104 + index * 42;
      const selected = index === care.actionIndex;

      if (selected) {
        fillRoundRect(ctx, rowX, rowY, rowW, 38, 10, PALETTE.creamDeep, PALETTE.coral, 2);
        fillRoundRect(ctx, rowX + 7, rowY + 8, 4, 22, 2, PALETTE.coral);
      } else {
        fillRoundRect(
          ctx,
          rowX,
          rowY,
          rowW,
          38,
          10,
          action.enabled ? "#fffaf0" : "rgba(46, 74, 58, 0.07)",
          "rgba(46, 74, 58, 0.14)",
          1.2,
        );
      }

      ctx.font = `600 12px ${FONT_UI}`;
      ctx.fillStyle = action.enabled ? ink : "rgba(46, 74, 58, 0.45)";
      ctx.fillText(action.label, rowX + 20, rowY + 16);

      ctx.font = `400 10px ${FONT_UI}`;
      ctx.fillStyle = action.enabled ? PALETTE.inkSoft : PALETTE.coralDark;
      ctx.fillText(action.reason || action.note || "", rowX + 20, rowY + 30);
    });

    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = care.note ? PALETTE.coralDark : "rgba(46, 74, 58, 0.6)";
    ctx.fillText(
      fitLine(ctx, care.note || "Repair keeps it longer. Donating or selling passes it on.", rowW),
      rowX + 2,
      y + h - 42,
    );

    ctx.fillStyle = "rgba(46, 74, 58, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText("W / S select      E choose      Esc back", x + w / 2, y + h - 18);
    ctx.textAlign = "left";
  }

  function drawEvening(state) {
    if (!state.ui.evening.open) return;
    const x = 380;
    const y = 292;
    const w = 340;
    const h = 206;

    ctx.save();
    ctx.shadowColor = "rgba(20, 34, 25, 0.4)";
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    fillRoundRect(ctx, x, y, w, h, 16, PALETTE.ink, "#16261c", 3);
    ctx.restore();
    fillRoundRect(ctx, x + 7, y + 7, w - 14, h - 14, 12, PALETTE.cream, null);

    ctx.save();
    roundRect(ctx, x + 7, y + 7, w - 14, h - 14, 12);
    ctx.clip();
    ctx.fillStyle = "rgba(46, 74, 58, 0.09)";
    ctx.fillRect(x + 7, y + 7, w - 14, 44);
    ctx.restore();

    ctx.fillStyle = ink;
    ctx.font = `700 15px ${FONT_UI}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("Evening", x + 20, y + 36);

    ctx.textAlign = "right";
    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText(`Day ${state.day}  ·  ${formatMoney(state.money)}`, x + w - 20, y + 36);
    ctx.textAlign = "left";

    EVENING_OPTIONS.forEach((option, index) => {
      const rowY = y + 60 + index * 46;
      const selected = index === state.ui.evening.selectedIndex;
      if (selected) {
        fillRoundRect(ctx, x + 16, rowY, w - 32, 40, 10, PALETTE.creamDeep, PALETTE.coral, 2);
        fillRoundRect(ctx, x + 23, rowY + 8, 4, 24, 2, PALETTE.coral);
      } else {
        fillRoundRect(ctx, x + 16, rowY, w - 32, 40, 10, "#fffaf0", "rgba(46, 74, 58, 0.14)", 1.2);
      }
      ctx.fillStyle = ink;
      ctx.font = `600 13px ${FONT_UI}`;
      ctx.fillText(option.label, x + 36, rowY + 25);
    });

    ctx.font = `400 10px ${FONT_UI}`;
    ctx.fillStyle = "rgba(46, 74, 58, 0.66)";
    ctx.fillText("Sleeping ages the home. Finishing shows your reflection.", x + 18, y + 154);

    ctx.font = `600 11px ${FONT_UI}`;
    ctx.fillStyle = "rgba(46, 74, 58, 0.7)";
    ctx.textAlign = "center";
    ctx.fillText("W / S select      E choose      Esc not yet", x + w / 2, y + h - 16);
    ctx.textAlign = "left";
  }

  function drawSummary(state) {
    if (state.status !== "ended") return;
    const summary = getSummary(state);

    ctx.save();
    ctx.fillStyle = "rgba(34, 57, 44, 0.82)";
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const x = 120;
    const y = 62;
    const w = 720;
    const h = 482;
    ctx.shadowColor = "rgba(10, 20, 14, 0.5)";
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 10;
    fillRoundRect(ctx, x, y, w, h, 20, PALETTE.cream, ink, 3);
    ctx.shadowColor = "transparent";

    ctx.fillStyle = ink;
    ctx.font = `700 27px ${FONT_TITLE}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("A Little More Life", x + 36, y + 56);

    ctx.font = `400 13px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText(
      `Day ${summary.day}  ·  ${formatMoney(summary.money)} still in the wallet`, 
      x + 36,
      y + 78,
    );

    ctx.strokeStyle = "rgba(46, 74, 58, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 364, y + 100);
    ctx.lineTo(x + 364, y + h - 66);
    ctx.stroke();

    const left = x + 36;
    const right = x + 396;
    let ly = y + 116;

    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText("MONEY REMAINING", left, ly);
    ctx.font = `700 26px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.leafDark;
    ctx.fillText(formatMoney(summary.money), left, ly + 30);

    ly += 62;
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText("PURCHASES", left, ly);
    ctx.font = `400 12px ${FONT_UI}`;
    ctx.fillStyle = ink;
    const purchaseText =
      summary.purchaseCount === 0
        ? "None. You bought nothing this run."
        : `${summary.purchaseCount}: ${summary.purchases.join(", ")}`;
    wrapClamped(ctx, purchaseText, 300, 2).forEach((line, index) => {
      ctx.fillText(line, left, ly + 18 + index * 15);
    });

    ly += 62;
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText("THOUGHTFUL CHOICES", left, ly);
    ctx.font = `400 12px ${FONT_UI}`;
    ctx.fillStyle = ink;
    ctx.fillText(`${summary.thoughtfulChoices} recorded`, left, ly + 18);
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.font = `400 11px ${FONT_UI}`;
    ctx.fillText(
      `waited ${summary.waits}  ·  reused ${summary.reuses}  ·  borrowed ${summary.borrows}`, 
      left,
      ly + 34,
    );
    ctx.fillText(
      `repaired ${summary.repairs}  ·  donated ${summary.donations}  ·  resold ${summary.resells}`,
      left,
      ly + 49,
    );

    ly += 74;
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText("SECOND LIVES GIVEN", left, ly);
    ctx.font = `400 12px ${FONT_UI}`;
    ctx.fillStyle = ink;
    ctx.fillText(
      summary.secondLives.length === 0
        ? "None yet. Nothing was repaired, donated, or resold."
        : `${summary.secondLives.length} item${summary.secondLives.length === 1 ? "" : "s"}`,
      left,
      ly + 18,
    );

    let ry = y + 116;
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText("ITEMS GIVEN A SECOND LIFE", right, ry);
    ctx.font = `400 12px ${FONT_UI}`;
    ctx.fillStyle = ink;
    if (summary.secondLives.length === 0) {
      ctx.fillText("—", right, ry + 18);
    } else {
      summary.secondLives.slice(0, 6).forEach((entry, index) => {
        const label = `${entry.name} — ${entry.action}`;
        ctx.fillText(fitLine(ctx, label, 280), right, ry + 18 + index * 16);
      });
    }

    ry += 132;
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText("STILL IN THE ROOM", right, ry);
    ctx.font = `400 12px ${FONT_UI}`;
    ctx.fillStyle = ink;
    ctx.fillText(
      summary.inventory.length === 0
        ? "Nothing. Every item moved on."
        : `${summary.inventory.length} item${summary.inventory.length === 1 ? "" : "s"}`,
      right,
      ry + 18,
    );

    ry += 56;
    ctx.font = `700 11px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.inkSoft;
    ctx.fillText("LEFT UNUSED", right, ry);
    ctx.font = `400 12px ${FONT_UI}`;
    ctx.fillStyle = summary.unused.length ? PALETTE.coralDark : ink;
    ctx.fillText(
      summary.unused.length === 0
        ? "Nothing sat unused at the end."
        : summary.unused.join(", "),
      right,
      ry + 18,
    );

    ctx.font = `600 12px ${FONT_UI}`;
    ctx.fillStyle = "rgba(46, 74, 58, 0.68)";
    ctx.textAlign = "center";
    ctx.fillText("R  start again — a fresh room, wallet, and day", x + w / 2, y + h - 24);
    ctx.textAlign = "left";
    ctx.restore();
  }

  function drawDevice(state) {
    if (!state.ui.phone.open) return;
    ctx.save();
    drawDeviceChrome(state);
    if (state.ui.phone.view === "products") {
      drawDeviceProducts(state);
    } else {
      drawDeviceActions(state);
    }
    ctx.restore();
  }

  return {
    render(state, nearest) {
      ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      drawRoom(state);
      drawInteraction(state, nearest);
      drawHud(state);
      drawDialogue(state);
      drawDevice(state);
      drawCare(state);
      drawEvening(state);
      drawSummary(state);
    },
    background,
  };
}
