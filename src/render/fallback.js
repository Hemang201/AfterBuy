import { PALETTE } from "../game/world.js";

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
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

/**
 * Last-resort art. Deliberately loud so missing replacements are noticed in
 * game, but still readable as the right kind of object.
 */
export function drawFallback(ctx, id, entry, x, y, w, h) {
  const kind = entry?.kind || "item";
  const fill = {
    character: PALETTE.coral,
    furniture: PALETTE.wood,
    item: PALETTE.yellow,
    environment: PALETTE.creamDeep,
    ui: PALETTE.blue,
  }[kind] || PALETTE.creamDeep;

  ctx.save();

  if (kind === "character") {
    ctx.fillStyle = "rgba(46, 74, 58, 0.2)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h - 3, w * 0.38, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = fill;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    roundRect(ctx, x + w * 0.2, y + h * 0.28, w * 0.6, h * 0.56, 5);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.24, w * 0.24, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.skin;
    ctx.fill();
    ctx.stroke();
  } else if (kind === "ui") {
    ctx.fillStyle = PALETTE.cream;
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `700 ${Math.max(10, Math.round(h * 0.6))}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("E", x + w / 2, y + h / 2 + 1);
  } else {
    ctx.fillStyle = fill;
    ctx.strokeStyle = PALETTE.coralDark;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    roundRect(ctx, x + 1, y + 1, Math.max(4, w - 2), Math.max(4, h - 2), 4);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(46, 74, 58, 0.35)";
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + w - 4, y + h - 4);
    ctx.moveTo(x + w - 4, y + 4);
    ctx.lineTo(x + 4, y + h - 4);
    ctx.stroke();

    ctx.fillStyle = PALETTE.ink;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const label = h >= 40 ? "?" : "";
    if (label) {
      ctx.font = `700 ${Math.min(18, Math.round(h * 0.3))}px system-ui, sans-serif`;
      ctx.fillText(label, x + w / 2, y + h / 2 - 4);
    }
    if (w >= 56 && h >= 44) {
      ctx.font = "600 8px system-ui, sans-serif";
      ctx.fillText(id.slice(0, 14), x + w / 2, y + h - 9);
    }
  }

  ctx.restore();
}
