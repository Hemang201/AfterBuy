/**
 * Canvas UI kit.
 *
 * Small drawing primitives with one consistent material language: ink outlines
 * of a single weight, cream paper surfaces, soft layered shadows, and a
 * mustard/terracotta accent used sparingly. Everything here is stateless so the
 * renderer can compose panels without a component tree.
 */
import { COLOR, FONT, RADIUS, TEXT, TYPE } from "./theme.js";

export function roundRect(ctx, x, y, w, h, r = RADIUS.md) {
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

export function fillRR(ctx, x, y, w, h, r, fill, stroke, lineWidth = 2) {
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

export function hairline(ctx, x1, y1, x2, y2, color = COLOR.paperEdge, width = 1) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Two-pass shadow: a wide soft pass and a tighter contact pass. */
export function withShadow(ctx, { blur = 16, y = 5, color = COLOR.shadow }, draw) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = y;
  draw();
  ctx.restore();
}

export function softShadow(ctx, x, y, rx, ry, alpha = 0.16, color = "37, 61, 45") {
  ctx.save();
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  gradient.addColorStop(0, `rgba(${color}, ${alpha})`);
  gradient.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function text(ctx, value, x, y, options = {}) {
  const {
    font = `${TYPE.body}px ${FONT.body}`,
    color = TEXT.strong,
    align = "left",
    baseline = "alphabetic",
    letterSpacing = 0,
  } = options;
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (letterSpacing && "letterSpacing" in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  ctx.fillText(value, x, y);
  if (letterSpacing && "letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.restore();
}

export function sectionLabel(ctx, value, x, y, color = COLOR.inkSoft) {
  text(ctx, value.toUpperCase(), x, y, {
    font: `700 ${TYPE.label}px ${FONT.body}`,
    color,
    letterSpacing: 1.1,
  });
}

export function wrapText(ctx, value, maxWidth) {
  const words = String(value).split(/\s+/);
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

export function fitLine(ctx, value, maxWidth) {
  const original = String(value);
  if (ctx.measureText(original).width <= maxWidth) return original;
  let clipped = original;
  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  return `${clipped.trimEnd()}…`;
}

export function wrapClamped(ctx, value, maxWidth, maxLines) {
  const lines = wrapText(ctx, value, maxWidth);
  if (lines.length <= maxLines) return lines;
  const shown = lines.slice(0, maxLines);
  shown[maxLines - 1] = fitLine(ctx, `${shown[maxLines - 1]} …`, maxWidth);
  return shown;
}

/** A small paper label, e.g. "OWNED" or "WAITING". */
export function chip(ctx, label, x, y, options = {}) {
  const {
    bg = COLOR.paperDeep,
    fg = COLOR.ink,
    border = null,
    align = "left",
    height = 16,
    pad = 7,
  } = options;
  ctx.save();
  ctx.font = `700 ${TYPE.micro}px ${FONT.body}`;
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0.6px";
  const width = ctx.measureText(label).width + pad * 2;
  const left = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  fillRR(ctx, left, y, width, height, height / 2, bg, border, 1);
  ctx.font = `700 ${TYPE.micro}px ${FONT.body}`;
  ctx.fillStyle = fg;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, left + width / 2, y + height / 2 + 0.5);
  if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
  ctx.restore();
  return width;
}

/** The keycap used by prompts and footers: mustard tile, ink glyph. */
export function keycap(ctx, label, x, y, size = 20) {
  ctx.save();
  fillRR(ctx, x, y + 2, size, size, RADIUS.sm, "rgba(64, 55, 46, 0.18)");
  fillRR(ctx, x, y, size, size, RADIUS.sm, COLOR.mustard, COLOR.forest, 1.5);
  ctx.fillStyle = COLOR.paperLight;
  ctx.globalAlpha = 0.35;
  ctx.fillRect(x + 2.5, y + 2.5, size - 5, 1.5);
  ctx.globalAlpha = 1;
  ctx.font = `700 ${Math.round(size * 0.5)}px ${FONT.body}`;
  ctx.fillStyle = COLOR.forest;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + size / 2, y + size / 2 + 0.5);
  ctx.restore();
}

/** A row of "key → label" hints for panel footers. */
export function keyHints(ctx, hints, centerX, y, color = COLOR.inkSoft) {
  ctx.save();
  ctx.font = `600 ${TYPE.small}px ${FONT.body}`;
  const gap = 16;
  const items = hints.map(([key, label]) => {
    const keyWidth = Math.max(20, ctx.measureText(key).width + 10);
    const labelWidth = ctx.measureText(label).width;
    return { key, label, keyWidth, width: keyWidth + 5 + labelWidth };
  });
  const total = items.reduce((sum, item) => sum + item.width, 0) + gap * (items.length - 1);
  let x = centerX - total / 2;
  for (const item of items) {
    keycap(ctx, item.key, x, y - 13, 19);
    ctx.font = `600 ${TYPE.small}px ${FONT.body}`;
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, x + item.keyWidth + 5, y - 3);
    x += item.width + gap;
  }
  ctx.restore();
}

/** Shared panel shell: paper card, accent tab, title bar, footer strip. */
export function panel(ctx, rect, options = {}) {
  const {
    title = "",
    meta = "",
    accent = COLOR.terracotta,
    titleFont = `700 ${TYPE.title}px ${FONT.display}`,
    footer = null,
    alpha = 1,
    sub = "",
  } = options;
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.globalAlpha = alpha;

  // Cast shadow + ink edge.
  withShadow(ctx, { blur: 26, y: 9, color: "rgba(16, 30, 21, 0.34)" }, () => {
    fillRR(ctx, x, y, w, h, RADIUS.lg, COLOR.forestDeep, "#0E1F15", 2.5);
  });
  // Paper surface.
  fillRR(ctx, x + 4, y + 4, w - 8, h - 8, RADIUS.lg - 2, COLOR.paperLight);

  // Very subtle paper grain: short fibres, deterministic so it never shimmers.
  ctx.save();
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, RADIUS.lg - 2);
  ctx.clip();
  ctx.globalAlpha = alpha * 0.5;
  ctx.strokeStyle = "rgba(64, 55, 46, 0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 26; i += 1) {
    const fy = y + 14 + ((i * 37) % (h - 26));
    const fx = x + 12 + ((i * 53) % (w - 30));
    ctx.beginPath();
    ctx.moveTo(fx, fy);
    ctx.lineTo(fx + 7 + (i % 4) * 3, fy + ((i % 3) - 1));
    ctx.stroke();
  }
  ctx.restore();

  if (title) {
    // Header band + accent tab.
    ctx.save();
    roundRect(ctx, x + 4, y + 4, w - 8, h - 8, RADIUS.lg - 2);
    ctx.clip();
    ctx.fillStyle = "rgba(254, 249, 240, 0.75)";
    ctx.fillRect(x + 4, y + 4, w - 8, 46);
    ctx.fillStyle = accent;
    ctx.fillRect(x + 4, y + 4, 6, h - 8);
    ctx.restore();
    hairline(ctx, x + 16, y + 50, x + w - 16, y + 50, "rgba(64, 55, 46, 0.12)");

    text(ctx, title, x + 24, y + 33, {
      font: titleFont,
      color: COLOR.forest,
    });
    if (sub) {
      text(ctx, sub, x + 24, y + 44, {
        font: `italic 11px ${FONT.display}`,
        color: COLOR.inkSoft,
      });
    }
    if (meta) {
      text(ctx, meta, x + w - 22, y + 33, {
        font: `700 ${TYPE.label}px ${FONT.body}`,
        color: COLOR.inkSoft,
        align: "right",
        letterSpacing: 0.8,
      });
    }
  }

  if (footer) {
    ctx.save();
    roundRect(ctx, x + 4, y + 4, w - 8, h - 8, RADIUS.lg - 2);
    ctx.clip();
    ctx.fillStyle = "rgba(239, 227, 204, 0.55)";
    ctx.fillRect(x + 4, y + h - 34, w - 8, 30);
    ctx.restore();
    hairline(ctx, x + 16, y + h - 34, x + w - 16, y + h - 34, "rgba(64, 55, 46, 0.14)");
  }

  ctx.restore();
  return { x, y, w, h };
}

/**
 * One selectable row. Used by every list in the game so hover/selected/disabled
 * states look identical wherever they appear.
 */
export function row(ctx, rect, options = {}) {
  const {
    selected = false,
    disabled = false,
    title = "",
    sub = "",
    right = "",
    rightSub = "",
    note = "",
    icon = null,
    accent = COLOR.terracotta,
    radius = RADIUS.md,
  } = options;
  const { x, y, w, h } = rect;
  ctx.save();
  if (selected) {
    ctx.save();
    ctx.shadowColor = "rgba(37, 61, 45, 0.18)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    fillRR(ctx, x, y, w, h, radius, COLOR.paperDeep, COLOR.forest, 2);
    ctx.restore();
    fillRR(ctx, x + 7, y + 7, 3.5, h - 14, 2, accent);
  } else {
    fillRR(ctx, x, y, w, h, radius, disabled ? "rgba(246, 240, 228, 0.55)" : COLOR.paper, COLOR.paperEdge, 1.2);
  }

  if (icon) icon(x + 14, y + (h - 26) / 2);

  const left = icon ? x + 50 : x + 16;
  const rightWidth = Math.max(
    ctx.measureText(right).width,
    ctx.measureText(rightSub).width,
  );
  const textWidth = w - (left - x) - rightWidth - 28;

  text(ctx, title, left, y + (sub ? 18 : h / 2 + 5), {
    font: `600 ${TYPE.body}px ${FONT.body}`,
    color: disabled ? COLOR.inkFaint : COLOR.ink,
  });
  if (sub) {
    ctx.save();
    ctx.font = `400 ${TYPE.small}px ${FONT.body}`;
    text(ctx, fitLine(ctx, sub, textWidth), left, y + 31, {
      font: `400 ${TYPE.small}px ${FONT.body}`,
      color: disabled ? "rgba(118, 110, 98, 0.7)" : COLOR.inkSoft,
    });
    ctx.restore();
  }
  if (note) {
    text(ctx, fitLine(ctx, note, w - 150), left, y + h - 6, {
      font: `italic ${TYPE.micro}px ${FONT.display}`,
      color: COLOR.inkSoft,
    });
  }
  if (right) {
    text(ctx, right, x + w - 16, y + (rightSub ? 18 : h / 2 + 5), {
      font: `700 ${TYPE.body}px ${FONT.body}`,
      color: disabled ? COLOR.inkFaint : TEXT.accent,
      align: "right",
    });
  }
  if (rightSub) {
    text(ctx, rightSub, x + w - 16, y + 31, {
      font: `700 ${TYPE.label}px ${FONT.body}`,
      color: disabled ? COLOR.inkFaint : COLOR.inkSoft,
      align: "right",
      letterSpacing: 0.5,
    });
  }
  ctx.restore();
}

/** Tiny vector glyphs so icons match the art instead of emoji. */
export const glyph = {
  coin(ctx, x, y, size = 16, color = COLOR.mustard, ink = COLOR.forest) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 4, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(37, 61, 45, 0.45)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  },
  bag(ctx, x, y, size = 16, color = COLOR.terracotta, ink = COLOR.forest) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.4;
    fillRR(ctx, x + 1, y + size * 0.32, size - 2, size * 0.66, 2.5, color, ink, 1.4);
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.36, size * 0.24, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  },
  check(ctx, x, y, size = 16, color = COLOR.leafDeep) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + size * 0.2, y + size * 0.55);
    ctx.lineTo(x + size * 0.43, y + size * 0.78);
    ctx.lineTo(x + size * 0.82, y + size * 0.25);
    ctx.stroke();
    ctx.restore();
  },
  leaf(ctx, x, y, size = 16, color = COLOR.leaf) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.14, y + size * 0.86);
    ctx.quadraticCurveTo(x + size * 0.1, y + size * 0.18, x + size * 0.88, y + size * 0.12);
    ctx.quadraticCurveTo(x + size * 0.9, y + size * 0.82, x + size * 0.14, y + size * 0.86);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 249, 240, 0.65)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + size * 0.24, y + size * 0.8);
    ctx.quadraticCurveTo(x + size * 0.5, y + size * 0.5, x + size * 0.82, y + size * 0.22);
    ctx.stroke();
    ctx.restore();
  },
  moon(ctx, x, y, size = 16, color = COLOR.mustard) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 1, Math.PI * 0.35, Math.PI * 1.65);
    ctx.arc(x + size * 0.62, y + size * 0.4, size * 0.3, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();
  },
  tag(ctx, x, y, size = 16, color = COLOR.terracotta) {
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = color;
    fillRR(ctx, -size * 0.42, -size * 0.3, size * 0.84, size * 0.6, 2, color, COLOR.forest, 1.3);
    ctx.fillStyle = COLOR.paperLight;
    ctx.beginPath();
    ctx.arc(-size * 0.26, 0, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};
