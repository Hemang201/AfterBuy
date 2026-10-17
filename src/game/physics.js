/** Pure movement and collision helpers. No rendering or DOM here. */

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function playerBox(x, y, width, height) {
  return {
    left: x - width / 2,
    right: x + width / 2,
    top: y - height,
    bottom: y,
  };
}

export function boxesOverlap(a, b) {
  return (
    a.left < b.right &&
    a.right > b.left &&
    a.top < b.bottom &&
    a.bottom > b.top
  );
}

/** Supports both {left,right,top,bottom} boxes and world {x,y,w,h} rects. */
function toBox(rect) {
  if (rect.left !== undefined) return rect;
  return {
    left: rect.x,
    right: rect.x + rect.w,
    top: rect.y,
    bottom: rect.y + rect.h,
  };
}

/** True when a player's feet position would intersect any solid rectangle. */
export function collidesAt(x, y, body, solids) {
  const box = playerBox(x, y, body.width, body.height);
  return solids.some((solid) => boxesOverlap(box, toBox(solid)));
}

/**
 * Moves with axis separation so the player slides along walls instead of
 * sticking. `area` is the walkable floor rectangle; `body` is {x, y, width, height}.
 */
export function moveBody(body, dx, dy, area, solids) {
  let x = clamp(body.x, area.x + body.width / 2, area.x + area.w - body.width / 2);
  let y = clamp(body.y, area.y + body.height, area.y + area.h);

  const nextX = clamp(
    x + dx,
    area.x + body.width / 2,
    area.x + area.w - body.width / 2,
  );
  if (!collidesAt(nextX, y, body, solids)) {
    x = nextX;
  }

  const nextY = clamp(y + dy, area.y + body.height, area.y + area.h);
  if (!collidesAt(x, nextY, body, solids)) {
    y = nextY;
  }

  body.x = x;
  body.y = y;
  return body;
}

/**
 * Advances the player by a normalized input vector and a delta in seconds.
 * Returns the distance actually moved, useful for stats and tests.
 */
export function stepPlayer(player, input, dt, area, solids, tuning) {
  const length = Math.hypot(input.x, input.y);
  const moving = length > 0.001;
  let dx = 0;
  let dy = 0;

  if (moving) {
    dx = (input.x / length) * tuning.speed * dt;
    dy = (input.y / length) * tuning.speed * dt;
    if (Math.abs(input.x) > Math.abs(input.y)) {
      player.facing = input.x < 0 ? "left" : "right";
    } else {
      player.facing = input.y < 0 ? "up" : "down";
    }
  }

  const beforeX = player.x;
  const beforeY = player.y;
  const body = {
    x: player.x,
    y: player.y,
    width: tuning.width,
    height: tuning.height,
  };
  moveBody(body, dx, dy, area, solids);
  player.x = body.x;
  player.y = body.y;
  const distance = Math.hypot(player.x - beforeX, player.y - beforeY);
  player.moving = moving && distance > 0.01;
  player.walkTime = (player.walkTime || 0) + (player.moving ? dt : 0);
  return distance;
}

/**
 * Nearest interactable whose anchor is inside its radius. Distant objects are
 * never returned, so they can never be interacted with.
 */
export function findNearestInteractable(player, interactables) {
  let best = null;
  let bestDistance = Infinity;

  for (const entry of interactables) {
    const distance = Math.hypot(
      player.x - entry.anchor.x,
      player.y - entry.anchor.y,
    );
    if (distance <= entry.radius && distance < bestDistance) {
      best = entry;
      bestDistance = distance;
    }
  }

  return best ? { interactable: best, distance: bestDistance } : null;
}
