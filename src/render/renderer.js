import {
  FURNITURE,
  ITEM_SPOTS,
  RUG,
  VIEW,
} from "../game/world.js";
import { selectedProduct } from "../game/state.js";
import { PRODUCTS, formatMoney, getItemDef } from "../game/items.js";
import { currentActions, productStatus } from "../game/economy.js";
import {
  EVENING_OPTIONS,
  currentItemActions,
  getSummary,
  itemStatusLine,
  selectedCareItem,
} from "../game/care.js";
import { drawFallback } from "./fallback.js";
import { buildBackground } from "./room.js";
import { COLOR, FONT, RADIUS, TEXT, TYPE, approach, prefersReducedMotion } from "./theme.js";
import {
  chip,
  fillRR,
  fitLine,
  glyph,
  hairline,
  keyHints,
  keycap,
  panel,
  row,
  sectionLabel,
  softShadow,
  text,
  withShadow,
  wrapClamped,
} from "./ui.js";

/**
 * AFTERBUY renderer.
 *
 * Structure:
 *   drawRoom      — baked environment, rug, furniture, parcels, character, items
 *   drawPrompt    — proximity hint with an eased entry
 *   drawHud       — compact journal strip: day, wallet, bag, ledger
 *   drawDialogue  — the notebook card used by finds and day changes
 *   drawDevice    — PocketShop (product list / actions)
 *   drawCare      — Second Life sheet (items / actions)
 *   drawEvening   — the two evening choices
 *   drawSummary   — the closing reflection
 *
 * Every panel uses the same paper, outline, row and footer language from
 * ./ui.js, and every value drawn comes from the run state.
 */

const DEVICE = { x: 388, y: 176, w: 356, h: 332 };
const CARE = { w: 420, h: 330 };

const STATUS_TONE = {
  owned: { bg: "rgba(110, 150, 112, 0.20)", fg: COLOR.leafDeep, label: "OWNED" },
  waiting: { bg: "rgba(201, 127, 97, 0.18)", fg: COLOR.terracottaDeep, label: "WAITING" },
  borrowed: { bg: "rgba(130, 158, 176, 0.22)", fg: COLOR.blueDeep, label: "BORROWED" },
  available: { bg: "rgba(64, 55, 46, 0.07)", fg: COLOR.inkSoft, label: "" },
};

export function createRenderer(canvas, assets) {
  const ctx = canvas.getContext("2d");
  const background = buildBackground(assets);
  const reducedMotion = prefersReducedMotion();

  // Renderer-local presentation state. Gameplay never reads this.
  const eased = new Map();
  let promptAlpha = 0;
  let lastFrame = 0;
  let clock = 0;

  function frameDelta() {
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const dt = lastFrame ? Math.min(0.05, Math.max(0, (now - lastFrame) / 1000)) : 0.016;
    lastFrame = now;
    return dt;
  }

  function ease(key, open, dt, speed = 20) {
    const target = open ? 1 : 0;
    const current = eased.has(key) ? eased.get(key) : target;
    const next = reducedMotion ? target : approach(current, target, dt, speed);
    eased.set(key, next);
    return next;
  }

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

  function itemBadgeKind(item) {
    if (item.condition === "Worn" || item.status === "unused") return "care";
    if (item.status === "repaired" || item.condition === "Repaired") return "repaired";
    if (item.status === "in-use") return "in-use";
    return null;
  }

  function drawBadge(spot, kind) {
    const x = spot.x + spot.w - 4;
    const y = spot.y - 2;
    if (kind === "care") {
      ctx.save();
      ctx.fillStyle = COLOR.mustard;
      ctx.strokeStyle = COLOR.forest;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      text(ctx, "!", x, y + 0.5, {
        font: `700 9px ${FONT.body}`,
        color: COLOR.forest,
        align: "center",
        baseline: "middle",
      });
      ctx.restore();
    } else if (kind === "repaired") {
      ctx.save();
      ctx.fillStyle = COLOR.paperLight;
      ctx.strokeStyle = COLOR.leafDeep;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x, y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      glyph.check(ctx, x - 5, y - 5, 10, COLOR.leafDeep);
      ctx.restore();
    } else if (kind === "in-use") {
      ctx.save();
      ctx.fillStyle = COLOR.leaf;
      ctx.strokeStyle = COLOR.paperLight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    const walk = player.moving;
    const image = assets.get(walk ? "player_walk" : "player_idle");
    const frameCount = walk ? assets.manifest.player_walk.frames : 1;
    const frame = walk
      ? Math.floor(player.walkTime * assets.manifest.player_walk.fps) % frameCount
      : 0;

    softShadow(ctx, player.x, player.y + 1.5, 15, 5.5, 0.28);

    ctx.save();
    if (player.facing === "left") {
      ctx.translate(player.x, 0);
      ctx.scale(-1, 1);
      ctx.translate(-player.x, 0);
    }
    if (image) {
      ctx.drawImage(image, frame * 32, 0, 32, 48, Math.round(player.x - 16), Math.round(player.y - 48), 32, 48);
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

  function drawFurniture(furniture) {
    // Contact shadow, then a tight occlusion line under the silhouette.
    softShadow(
      ctx,
      furniture.x + furniture.w / 2,
      furniture.y + furniture.h - 1,
      furniture.w * 0.46,
      Math.max(4, furniture.w * 0.05),
      0.24,
    );
    drawAsset(furniture.asset, furniture.x, furniture.y, furniture.w, furniture.h);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = COLOR.forestDeep;
    ctx.lineWidth = 1;
    ctx.strokeRect(furniture.x + 0.5, furniture.y + 0.5, furniture.w - 1, furniture.h - 1);
    ctx.restore();
  }

  function drawParcel(state, parcel) {
    const bob = parcel.opened || reducedMotion ? 0 : Math.sin(clock * 2.2) * 1.6;
    const x = parcel.x - 20;
    const y = parcel.y - 40 + bob;

    softShadow(ctx, parcel.x, parcel.y - 2, 19, 6, 0.22);
    drawAsset("parcel", x, y, 40, 40);

    // Kraft tape + a hand-written label, so a delivery reads as one.
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = COLOR.mustardDeep;
    ctx.fillRect(x + 8, y + 18, 24, 3);
    ctx.globalAlpha = 1;
    if (!parcel.opened) {
      ctx.fillStyle = COLOR.paperLight;
      ctx.strokeStyle = COLOR.forest;
      ctx.lineWidth = 1;
      fillRR(ctx, x + 6, y + 5, 14, 9, 2, COLOR.paperLight, COLOR.forest, 1);
      ctx.fillStyle = "rgba(64, 55, 46, 0.4)";
      ctx.fillRect(x + 8, y + 8, 10, 1);
      ctx.fillRect(x + 8, y + 11, 7, 1);
      if (!reducedMotion) {
        ctx.globalAlpha = 0.55 + Math.sin(clock * 3.2) * 0.25;
        glyph.leaf(ctx, x + 30, y + 3, 9, COLOR.leaf);
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }

  function drawItemSpots(state) {
    for (const itemId of ["headphones", "hoodie", "sneakers"]) {
      if (state.discoveredItemIds.includes(itemId)) continue;
      const spot = ITEM_SPOTS[itemId];
      softShadow(ctx, spot.x + spot.w / 2, spot.y + spot.h - 1, spot.w * 0.4, 3, 0.18);
      drawAsset(spot.asset, spot.x, spot.y, spot.w, spot.h);
    }

    for (const item of state.inventory) {
      const spot = itemSpot(state, item.itemId);
      if (!spot) continue;
      softShadow(ctx, spot.x + spot.w / 2, spot.y + spot.h + 1, 11, 3, 0.16);
      drawAsset(spot.asset, spot.x, spot.y, spot.w, spot.h);
      const badge = itemBadgeKind(item);
      if (badge) drawBadge(spot, badge);
    }
  }

  function drawStationMarker(state) {
    if (state.secondLife.length === 0) return;
    const x = 324;
    const y = 408;
    const lives = new Set(state.secondLife.map((entry) => entry.itemId)).size;
    const label = `${lives} second ${lives === 1 ? "life" : "lives"}`;
    ctx.save();
    ctx.font = `700 ${TYPE.label}px ${FONT.body}`;
    const width = ctx.measureText(label).width + 34;
    withShadow(ctx, { blur: 8, y: 2, color: "rgba(37, 61, 45, 0.25)" }, () => {
      fillRR(ctx, x - width / 2, y - 13, width, 22, 11, COLOR.paperLight, COLOR.forest, 1.4);
    });
    glyph.leaf(ctx, x - width / 2 + 8, y - 9, 12, COLOR.leaf);
    text(ctx, label, x - width / 2 + 24, y + 1, {
      font: `700 ${TYPE.label}px ${FONT.body}`,
      color: COLOR.forest,
      baseline: "middle",
    });
    ctx.restore();
  }

  function drawRoom(state) {
    ctx.drawImage(background, 0, 0);

    // Rug: shadow, then its own art, with a warm glaze that ties it to the
    // room's lighting without repainting the player's drawing.
    softShadow(ctx, RUG.x + RUG.w / 2, RUG.y + RUG.h - 6, RUG.w * 0.52, 14, 0.16);
    drawAsset(RUG.asset, RUG.x, RUG.y, RUG.w, RUG.h);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(RUG.x + RUG.w / 2, RUG.y + RUG.h / 2, RUG.w * 0.47, RUG.h * 0.47, 0, 0, Math.PI * 2);
    ctx.clip();
    const glaze = ctx.createRadialGradient(
      RUG.x + RUG.w / 2,
      RUG.y + RUG.h / 2,
      10,
      RUG.x + RUG.w / 2,
      RUG.y + RUG.h / 2,
      RUG.w * 0.5,
    );
    glaze.addColorStop(0, "rgba(255, 240, 208, 0.10)");
    glaze.addColorStop(0.7, "rgba(37, 61, 45, 0.05)");
    glaze.addColorStop(1, "rgba(37, 61, 45, 0.16)");
    ctx.fillStyle = glaze;
    ctx.fillRect(RUG.x, RUG.y, RUG.w, RUG.h);
    ctx.restore();

    const entities = [];
    for (const furniture of FURNITURE) {
      entities.push({
        sortY: furniture.y + furniture.h,
        draw: () => drawFurniture(furniture),
      });
    }
    for (const parcel of state.parcels) {
      entities.push({ sortY: parcel.y, draw: () => drawParcel(state, parcel) });
    }
    entities.push({ sortY: state.player.y, draw: () => drawPlayer(state) });
    entities.sort((a, b) => a.sortY - b.sortY);
    for (const entity of entities) entity.draw();

    drawItemSpots(state);
    drawStationMarker(state);
  }

  function drawPrompt(state, nearest, dt) {
    const visible =
      nearest && !state.ui.dialogue && !state.ui.phone.open && !state.ui.care.open && !state.ui.evening.open;
    const target = visible ? 1 : 0;
    promptAlpha = reducedMotion ? target : approach(promptAlpha, target, dt, 16);
    if (!visible || promptAlpha < 0.02) return;

    const { anchor, name, verb } = nearest.interactable;
    const rise = reducedMotion ? 0 : (1 - promptAlpha) * 6;

    ctx.save();
    ctx.globalAlpha = promptAlpha;

    // Ring around the object the player would act on.
    ctx.save();
    ctx.strokeStyle = COLOR.mustard;
    ctx.lineWidth = 2;
    ctx.globalAlpha = promptAlpha * (reducedMotion ? 0.7 : 0.55 + Math.sin(clock * 4) * 0.16);
    ctx.beginPath();
    ctx.ellipse(anchor.x, anchor.y, 30, 11, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = promptAlpha * 0.22;
    ctx.fillStyle = COLOR.mustard;
    ctx.fill();
    ctx.restore();

    ctx.font = `600 ${TYPE.heading}px ${FONT.body}`;
    const label = `${verb} ${name}`;
    const bubbleW = Math.round(ctx.measureText(label).width + 74);
    const bubbleH = 40;
    let bubbleX = Math.round(anchor.x - bubbleW / 2);
    bubbleX = Math.max(14, Math.min(VIEW.width - bubbleW - 14, bubbleX));
    let bubbleY = Math.round(anchor.y - 76 - rise);
    bubbleY = Math.max(64, Math.min(VIEW.height - bubbleH - 120, bubbleY));
    const tailX = Math.max(bubbleX + 24, Math.min(bubbleX + bubbleW - 24, anchor.x));

    withShadow(ctx, { blur: 14, y: 5, color: "rgba(27, 45, 33, 0.28)" }, () => {
      fillRR(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 11, COLOR.paperLight, COLOR.forest, 2);
    });
    // Tail.
    ctx.fillStyle = COLOR.paperLight;
    ctx.strokeStyle = COLOR.forest;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tailX - 8, bubbleY + bubbleH - 1);
    ctx.lineTo(tailX + 8, bubbleY + bubbleH - 1);
    ctx.lineTo(tailX, bubbleY + bubbleH + 9);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = COLOR.paperLight;
    ctx.fillRect(tailX - 7, bubbleY + bubbleH - 4, 14, 5);

    keycap(ctx, "E", bubbleX + 10, bubbleY + 9, 22);
    text(ctx, label, bubbleX + 42, bubbleY + bubbleH / 2 + 1, {
      font: `600 ${TYPE.heading}px ${FONT.body}`,
      color: COLOR.forest,
      baseline: "middle",
    });
    ctx.restore();
  }

  function drawHud(state) {
    const x = 20;
    const y = 12;
    const w = 468;
    const h = 44;

    ctx.save();
    withShadow(ctx, { blur: 14, y: 4, color: "rgba(10, 22, 14, 0.35)" }, () => {
      fillRR(ctx, x, y, w, h, RADIUS.md, COLOR.paperLight, COLOR.forest, 2);
    });

    const blocks = [
      { key: "DAY", value: String(state.day), icon: (ix, iy) => glyph.moon(ctx, ix, iy, 14, COLOR.mustard) },
      {
        key: "WALLET",
        value: formatMoney(state.money),
        icon: (ix, iy) => glyph.coin(ctx, ix, iy, 14),
      },
      {
        key: "BAG",
        value: `${state.inventory.length} ${state.inventory.length === 1 ? "item" : "items"}`,
        icon: (ix, iy) => glyph.bag(ctx, ix, iy, 14),
      },
      {
        key: "LEDGER",
        value: `${state.history.length} ${state.history.length === 1 ? "move" : "moves"}`,
        icon: (ix, iy) => glyph.check(ctx, ix, iy, 14, COLOR.leafDeep),
      },
    ];
    const columns = [x + 16, x + 128, x + 268, x + 380];

    blocks.forEach((block, index) => {
      const left = columns[index];
      block.icon(left, y + 8);
      sectionLabel(ctx, block.key, left + 19, y + 19, COLOR.inkSoft);
      text(ctx, block.value, left, y + 35, {
        font: `700 ${TYPE.heading}px ${FONT.body}`,
        color: COLOR.forest,
      });
      if (index > 0) {
        hairline(ctx, left - 12, y + 10, left - 12, y + h - 10, "rgba(64, 55, 46, 0.16)");
      }
    });

    // Location caption sits on the dark mat above the wall.
    text(ctx, "a quiet afternoon at home", VIEW.width - 24, y + 28, {
      font: `italic ${TYPE.body}px ${FONT.display}`,
      color: "rgba(246, 240, 228, 0.82)",
      align: "right",
    });
    glyph.leaf(ctx, VIEW.width - 24 - 176, y + 17, 13, COLOR.leaf);
    ctx.restore();
  }

  function drawDialogue(state) {
    const dialogue = state.ui.dialogue;
    if (!dialogue) return;
    const rect = { x: 150, y: 396, w: 660, h: 168 };
    panel(ctx, rect, {
      title: dialogue.title,
      meta: `Day ${state.day}`,
      accent: COLOR.mustard,
      alpha: 1,
      footer: true,
    });

    const bodyX = rect.x + 24;
    let lineY = rect.y + 74;
    ctx.save();
    for (const line of dialogue.lines) {
      const lines = wrapClamped(ctx, line, rect.w - 48, 3);
      for (const wrapped of lines) {
        if (lineY > rect.y + rect.h - 44) break;
        text(ctx, wrapped, bodyX, lineY, {
          font: `400 ${TYPE.body}px ${FONT.body}`,
          color: TEXT.body,
        });
        lineY += 19;
      }
      lineY += 3;
    }
    ctx.restore();

    keycap(ctx, "E", rect.x + rect.w - 132, rect.y + rect.h - 26, 18);
    text(ctx, "close", rect.x + rect.w - 108, rect.y + rect.h - 17, {
      font: `600 ${TYPE.small}px ${FONT.body}`,
      color: COLOR.inkSoft,
    });
  }

  function deviceScreen(state) {
    const { x, y, w, h } = DEVICE;
    // Hardware shell.
    withShadow(ctx, { blur: 24, y: 8, color: "rgba(10, 22, 14, 0.4)" }, () => {
      fillRR(ctx, x, y, w, h, 22, COLOR.forestDeep, "#101F16", 3);
    });
    fillRR(ctx, x + 8, y + 8, w - 16, h - 16, 16, COLOR.paperLight, "rgba(37, 61, 45, 0.25)", 1.5);
    // Speaker slit + camera dot.
    fillRR(ctx, x + w / 2 - 24, y + 13, 48, 4, 2, "rgba(37, 61, 45, 0.30)");
    ctx.fillStyle = "rgba(37, 61, 45, 0.35)";
    ctx.beginPath();
    ctx.arc(x + w - 26, y + 15, 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Header.
    text(ctx, "PocketShop", x + 22, y + 46, {
      font: `700 ${TYPE.title}px ${FONT.display}`,
      color: COLOR.forest,
    });
    text(ctx, `DAY ${state.day}   ·   ${formatMoney(state.money)}`, x + w - 22, y + 45, {
      font: `700 ${TYPE.label}px ${FONT.body}`,
      color: COLOR.inkSoft,
      align: "right",
      letterSpacing: 0.7,
    });
    hairline(ctx, x + 20, y + 56, x + w - 20, y + 56, "rgba(64, 55, 46, 0.16)");
    return { x, y, w, h };
  }

  function drawDeviceProducts(state) {
    const { x, y, w, h } = deviceScreen(state);
    const phone = state.ui.phone;
    const rowX = x + 18;
    const rowW = w - 36;

    PRODUCTS.forEach((product, index) => {
      const rowY = y + 66 + index * 64;
      const selected = index === phone.selectedIndex;
      const status = productStatus(state, product);
      const tone = STATUS_TONE[status] || STATUS_TONE.available;
      const def = getItemDef(product.itemId);

      row(
        ctx,
        { x: rowX, y: rowY, w: rowW, h: 56 },
        {
          selected,
          title: product.name,
          sub: product.tag,
          right: formatMoney(product.price),
          icon: def
            ? (ix, iy) => {
                fillRR(ctx, ix - 2, iy - 1, 36, 36, RADIUS.sm, "rgba(239, 227, 204, 0.55)");
                softShadow(ctx, ix + 16, iy + 31, 13, 3, 0.12);
                drawAsset(def.asset, ix + 2, iy + 2, 32, 32);
              }
            : null,
          accent: COLOR.terracotta,
        },
      );
      if (tone.label) {
        chip(ctx, tone.label, rowX + rowW - 14, rowY + 36, {
          bg: tone.bg,
          fg: tone.fg,
          align: "right",
          height: 15,
        });
      }
    });

    // Note area: a recessed paper strip, so feedback never moves the layout.
    const noteY = y + 268;
    fillRR(ctx, rowX, noteY, rowW, 42, RADIUS.sm, "rgba(239, 227, 204, 0.55)");
    ctx.save();
    const note = phone.note
      ? wrapClamped(ctx, phone.note, rowW - 20, 2)
      : ["Buy what you will use. Wait when you are unsure."];
    note.forEach((line, index) => {
      text(ctx, line, rowX + 10, noteY + 17 + index * 14, {
        font: `${phone.note ? 600 : 400} italic ${TYPE.small}px ${FONT.display}`,
        color: phone.note ? TEXT.accent : COLOR.inkSoft,
      });
    });
    ctx.restore();

    keyHints(ctx, [["W/S", "select"], ["E", "open"], ["Esc", "close"]], x + w / 2, y + h - 19);
  }

  function drawDeviceActions(state) {
    const { x, y, w, h } = deviceScreen(state);
    const phone = state.ui.phone;
    const product = selectedProduct(state);
    const actions = currentActions(state);
    const rowX = x + 18;
    const rowW = w - 36;
    const def = getItemDef(product.itemId);

    if (def) {
      fillRR(ctx, rowX, y + 62, 46, 46, RADIUS.sm, "rgba(239, 227, 204, 0.6)");
      softShadow(ctx, rowX + 23, y + 104, 17, 3, 0.14);
      drawAsset(def.asset, rowX + 5, y + 66, 36, 36);
    }
    const infoX = rowX + (def ? 58 : 2);
    text(ctx, product.name, infoX, y + 80, {
      font: `700 ${TYPE.heading}px ${FONT.body}`,
      color: COLOR.forest,
    });
    ctx.save();
    ctx.font = `400 ${TYPE.label}px ${FONT.display}`;
    text(ctx, product.tag.toUpperCase(), infoX, y + 93, {
      font: `700 ${TYPE.micro}px ${FONT.body}`,
      color: COLOR.inkSoft,
      letterSpacing: 0.9,
    });
    ctx.restore();
    text(ctx, formatMoney(product.price), rowX + rowW, y + 80, {
      font: `700 ${TYPE.heading}px ${FONT.body}`,
      color: TEXT.accent,
      align: "right",
    });

    ctx.save();
    ctx.font = `italic ${TYPE.small}px ${FONT.display}`;
    const blurb = wrapClamped(ctx, product.blurb, rowW - (def ? 58 : 0), 2);
    blurb.forEach((line, index) => {
      text(ctx, line, infoX, y + 108 + index * 13, {
        font: `italic ${TYPE.small}px ${FONT.display}`,
        color: COLOR.inkSoft,
      });
    });
    ctx.restore();

    hairline(ctx, rowX, y + 138, rowX + rowW, y + 138, "rgba(64, 55, 46, 0.14)");

    actions.forEach((action, index) => {
      const rowY = y + 146 + index * 42;
      row(
        ctx,
        { x: rowX, y: rowY, w: rowW, h: 38 },
        {
          selected: index === phone.actionIndex,
          disabled: !action.enabled,
          title: action.label,
          sub: action.reason || action.note || "",
          accent: action.id === "buy" ? COLOR.terracotta : COLOR.leaf,
        },
      );
    });

    // Decision note, in the recessed strip used by the product list.
    const noteY = y + 146 + actions.length * 42 + 6;
    const noteH = Math.max(34, y + h - 38 - noteY);
    fillRR(ctx, rowX, noteY, rowW, noteH, RADIUS.sm, "rgba(239, 227, 204, 0.55)");
    const note = phone.note
      ? wrapClamped(ctx, phone.note, rowW - 20, Math.max(1, Math.floor((noteH - 10) / 14)))
      : ["No money moves unless you choose to buy."];
    note.forEach((line, index) => {
      text(ctx, line, rowX + 10, noteY + 17 + index * 14, {
        font: `${phone.note ? 600 : 400} italic ${TYPE.small}px ${FONT.display}`,
        color: phone.note ? TEXT.accent : COLOR.inkSoft,
      });
    });

    keyHints(ctx, [["W/S", "select"], ["E", "choose"], ["Esc", "back"]], x + w / 2, y + h - 19);
  }

  function drawCare(state, dt) {
    const care = state.ui.care;
    const alpha = ease("care", care.open, dt, 22);
    if (alpha < 0.02) return;

    const x = state.player.x < 480 ? 480 : 60;
    const y = 150;
    const { w, h } = CARE;
    const rect = { x, y, w, h };

    panel(ctx, rect, {
      title: "Second Life",
      meta: `DAY ${state.day}   ·   ${formatMoney(state.money)}`,
      accent: COLOR.leaf,
      alpha,
      footer: true,
    });

    ctx.save();
    ctx.globalAlpha = alpha;
    const rowX = x + 16;
    const rowW = w - 32;

    if (care.view === "items") {
      const visible = state.inventory.slice(0, 6);
      if (visible.length === 0) {
        text(ctx, "Your bag is empty.", rowX + 2, y + 86, {
          font: `italic ${TYPE.body}px ${FONT.display}`,
          color: COLOR.inkSoft,
        });
      }
      visible.forEach((item, index) => {
        const rowY = y + 62 + index * 40;
        const selected = index === care.itemIndex;
        const def = getItemDef(item.itemId);
        row(
          ctx,
          { x: rowX, y: rowY, w: rowW, h: 36 },
          {
            selected,
            title: item.name,
            sub: itemStatusLine(item),
            icon: def
              ? (ix, iy) => {
                  softShadow(ctx, ix + 12, iy + 22, 11, 2.5, 0.14);
                  drawAsset(def.asset, ix, iy + 2, 24, 24);
                }
              : null,
            accent: COLOR.leaf,
          },
        );
        if (item.condition === "Worn" || item.status === "unused") {
          ctx.fillStyle = COLOR.mustard;
          ctx.strokeStyle = COLOR.forest;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(rowX + rowW - 18, rowY + 18, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          text(ctx, "!", rowX + rowW - 18, rowY + 18.5, {
            font: `700 8px ${FONT.body}`,
            color: COLOR.forest,
            align: "center",
            baseline: "middle",
          });
        }
      });

      keyHints(ctx, [["W/S", "select"], ["E", "actions"], ["Esc", "close"]], x + w / 2, y + h - 19);
      ctx.restore();
      return;
    }

    const item = selectedCareItem(state);
    const actions = currentItemActions(state);
    const def = item ? getItemDef(item.itemId) : null;

    if (def && item) {
      fillRR(ctx, rowX, y + 60, 48, 44, RADIUS.sm, "rgba(239, 227, 204, 0.6)");
      softShadow(ctx, rowX + 24, y + 102, 17, 3, 0.14);
      drawAsset(def.asset, rowX + 6, y + 63, 36, 36);
      text(ctx, item.name, rowX + 60, y + 78, {
        font: `700 ${TYPE.heading}px ${FONT.body}`,
        color: COLOR.forest,
      });
      text(ctx, def.careNote ? fitLine(ctx, def.careNote, rowW - 66) : "", rowX + 60, y + 94, {
        font: `italic ${TYPE.micro}px ${FONT.display}`,
        color: COLOR.inkSoft,
      });
      const stateLabel = itemStatusLine(item).toUpperCase();
      chip(ctx, stateLabel, rowX + rowW, y + 64, {
        bg: "rgba(110, 150, 112, 0.18)",
        fg: COLOR.leafDeep,
        align: "right",
        height: 15,
      });
    }

    hairline(ctx, rowX, y + 108, rowX + rowW, y + 108, "rgba(64, 55, 46, 0.14)");

    actions.forEach((action, index) => {
      const rowY = y + 114 + index * 40;
      row(
        ctx,
        { x: rowX, y: rowY, w: rowW, h: 36 },
        {
          selected: index === care.actionIndex,
          disabled: !action.enabled,
          title: action.label,
          sub: action.reason || action.note || "",
          accent: action.id === "donate" || action.id === "use" ? COLOR.leaf : COLOR.terracotta,
        },
      );
    });

    const noteY = y + 114 + actions.length * 40 + 6;
    const note = wrapClamped(
      ctx,
      care.note || "Repair keeps it longer. Donating or selling passes it on.",
      rowW,
      2,
    );
    note.forEach((line, index) => {
      text(ctx, line, rowX + 2, noteY + 12 + index * 13, {
        font: `${care.note ? 600 : 400} italic ${TYPE.small}px ${FONT.display}`,
        color: care.note ? TEXT.accent : COLOR.inkSoft,
      });
    });

    keyHints(ctx, [["W/S", "select"], ["E", "choose"], ["Esc", "back"]], x + w / 2, y + h - 19);
    ctx.restore();
  }

  function drawEvening(state, dt) {
    const even = state.ui.evening;
    const alpha = ease("evening", even.open, dt, 22);
    if (alpha < 0.02) return;
    const x = 360;
    const y = 288;
    const w = 360;
    const h = 218;

    panel(ctx, { x, y, w, h }, {
      title: "Evening",
      meta: `DAY ${state.day}`,
      accent: COLOR.mustard,
      alpha,
      footer: true,
    });

    ctx.save();
    ctx.globalAlpha = alpha;
    EVENING_OPTIONS.forEach((option, index) => {
      const rowY = y + 66 + index * 50;
      const selected = index === even.selectedIndex;
      row(
        ctx,
        { x: x + 16, y: rowY, w: w - 32, h: 42 },
        {
          selected,
          title: option.label,
          accent: option.id === "finish" ? COLOR.terracotta : COLOR.mustardDeep,
          icon:
            option.id === "finish"
              ? (ix, iy) => glyph.check(ctx, ix, iy + 4, 20, COLOR.leafDeep)
              : (ix, iy) => glyph.moon(ctx, ix, iy + 2, 22, COLOR.mustard),
        },
      );
    });

    text(ctx, "Sleeping ages the room. Finishing shows your reflection.", x + 18, y + h - 46, {
      font: `italic ${TYPE.small}px ${FONT.display}`,
      color: COLOR.inkSoft,
    });
    keyHints(ctx, [["W/S", "select"], ["E", "choose"], ["Esc", "not yet"]], x + w / 2, y + h - 19);
    ctx.restore();
  }

  function drawSummary(state, dt) {
    if (state.status !== "ended") return;
    const summary = getSummary(state);
    const alpha = ease("summary", true, dt, 8);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = `rgba(16, 30, 21, ${0.78 * alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = alpha;

    const x = 118;
    const y = 58;
    const w = 724;
    const h = 488;

    withShadow(ctx, { blur: 34, y: 12, color: "rgba(8, 18, 12, 0.5)" }, () => {
      fillRR(ctx, x, y, w, h, RADIUS.lg + 2, COLOR.paperLight, COLOR.forestDeep, 3);
    });
    // Accent rule along the top, like a stitched binding.
    ctx.fillStyle = COLOR.terracotta;
    ctx.fillRect(x + 18, y, w - 36, 4);

    // Header.
    text(ctx, "A Little More Life", x + 36, y + 50, {
      font: `700 30px ${FONT.display}`,
      color: COLOR.forest,
    });
    text(ctx, `Day ${summary.day} · ${formatMoney(summary.money)} still in the wallet`, x + 36, y + 72, {
      font: `italic ${TYPE.body}px ${FONT.display}`,
      color: COLOR.inkSoft,
    });
    glyph.leaf(ctx, x + w - 62, y + 26, 26, COLOR.leaf);
    glyph.leaf(ctx, x + w - 40, y + 34, 18, COLOR.sage);
    hairline(ctx, x + 36, y + 86, x + w - 36, y + 86, "rgba(64, 55, 46, 0.18)");
    hairline(ctx, x + 372, y + 104, x + 372, y + h - 62, "rgba(64, 55, 46, 0.14)");

    const left = x + 36;
    const right = x + 398;
    let ly = y + 112;

    sectionLabel(ctx, "Money remaining", left, ly);
    text(ctx, formatMoney(summary.money), left, ly + 34, {
      font: `700 30px ${FONT.display}`,
      color: COLOR.forest,
    });
    // Small scale: what came in and what went out.
    text(ctx, `spent ${formatMoney(summary.spent)}  ·  recovered ${formatMoney(summary.earned)}`, left, ly + 50, {
      font: `400 ${TYPE.small}px ${FONT.body}`,
      color: COLOR.inkSoft,
    });

    ly += 72;
    sectionLabel(ctx, "Purchases", left, ly);
    ctx.font = `400 ${TYPE.body}px ${FONT.body}`;
    const purchaseText =
      summary.purchaseCount === 0
        ? "None. You bought nothing this run."
        : `${summary.purchaseCount}: ${summary.purchases.join(", ")}`;
    wrapClamped(ctx, purchaseText, 300, 2).forEach((line, index) => {
      text(ctx, line, left, ly + 18 + index * 15, {
        font: `400 ${TYPE.body}px ${FONT.body}`,
        color: TEXT.body,
      });
    });

    ly += 66;
    sectionLabel(ctx, "Thoughtful choices", left, ly);
    text(ctx, `${summary.thoughtfulChoices} recorded`, left, ly + 19, {
      font: `700 ${TYPE.body}px ${FONT.body}`,
      color: COLOR.forest,
    });
    text(ctx, `waited ${summary.waits} · reused ${summary.reuses} · borrowed ${summary.borrows}`, left, ly + 35, {
      font: `400 ${TYPE.small}px ${FONT.body}`,
      color: COLOR.inkSoft,
    });
    text(ctx, `repaired ${summary.repairs} · donated ${summary.donations} · resold ${summary.resells}`, left, ly + 49, {
      font: `400 ${TYPE.small}px ${FONT.body}`,
      color: COLOR.inkSoft,
    });

    ly += 74;
    sectionLabel(ctx, "Second lives given", left, ly);
    text(
      ctx,
      summary.secondLives.length === 0
        ? "None yet. Nothing was repaired, donated, or resold."
        : `${summary.secondLives.length} item${summary.secondLives.length === 1 ? "" : "s"}`,
      left,
      ly + 19,
      { font: `400 ${TYPE.body}px ${FONT.body}`, color: TEXT.body },
    );

    let ry = y + 112;
    sectionLabel(ctx, "Items given a second life", right, ry);
    if (summary.secondLives.length === 0) {
      text(ctx, "—", right, ry + 20, { font: `400 ${TYPE.body}px ${FONT.body}`, color: TEXT.body });
    } else {
      summary.secondLives.slice(0, 6).forEach((entry, index) => {
        const rowY = ry + 12 + index * 20;
        ctx.fillStyle = COLOR.leaf;
        ctx.beginPath();
        ctx.arc(right + 3, rowY + 4, 2.5, 0, Math.PI * 2);
        ctx.fill();
        text(ctx, fitLine(ctx, `${entry.name} — ${entry.action}`, 292), right + 12, rowY + 8, {
          font: `400 ${TYPE.body}px ${FONT.body}`,
          color: TEXT.body,
        });
      });
    }

    ry += 142;
    sectionLabel(ctx, "Still in the room", right, ry);
    text(
      ctx,
      summary.inventory.length === 0
        ? "Nothing. Every item moved on."
        : `${summary.inventory.length} item${summary.inventory.length === 1 ? "" : "s"}`,
      right,
      ry + 19,
      { font: `400 ${TYPE.body}px ${FONT.body}`, color: TEXT.body },
    );

    ry += 54;
    sectionLabel(ctx, "Left unused", right, ry);
    text(
      ctx,
      summary.unused.length === 0 ? "Nothing sat unused at the end." : summary.unused.join(", "),
      right,
      ry + 19,
      {
        font: `400 ${TYPE.body}px ${FONT.body}`,
        color: summary.unused.length ? TEXT.warning : TEXT.body,
      },
    );

    // Closing note.
    hairline(ctx, x + 36, y + h - 48, x + w - 36, y + h - 48, "rgba(64, 55, 46, 0.16)");
    keycap(ctx, "R", x + 36, y + h - 38, 22);
    text(ctx, "start again — a fresh room, wallet, and day", x + 66, y + h - 23, {
      font: `600 ${TYPE.body}px ${FONT.body}`,
      color: COLOR.inkSoft,
    });
    text(ctx, "AFTERBUY", x + w - 36, y + h - 23, {
      font: `700 ${TYPE.label}px ${FONT.body}`,
      color: "rgba(64, 55, 46, 0.35)",
      align: "right",
      letterSpacing: 2,
    });
    ctx.restore();
  }

  function drawDevice(state, dt) {
    const alpha = ease("device", state.ui.phone.open, dt, 22);
    if (alpha < 0.02) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Dashed link to the terminal, drawn only while the device is open.
    const { x, y, w, h } = DEVICE;
    ctx.save();
    ctx.strokeStyle = "rgba(37, 61, 45, 0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(x + w - 14, y + h - 20);
    ctx.lineTo(792, 424);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    if (state.ui.phone.view === "products") {
      drawDeviceProducts(state);
    } else {
      drawDeviceActions(state);
    }
    ctx.restore();
  }

  return {
    render(state, nearest) {
      const dt = frameDelta();
      clock += dt;

      ctx.clearRect(0, 0, VIEW.width, VIEW.height);
      drawRoom(state);
      drawPrompt(state, nearest, dt);
      drawHud(state);
      drawDialogue(state);
      drawDevice(state, dt);
      drawCare(state, dt);
      drawEvening(state, dt);
      drawSummary(state, dt);
    },
    background,
  };
}
