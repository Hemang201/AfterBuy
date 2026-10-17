import test from "node:test";
import assert from "node:assert/strict";

import {
  findNearestInteractable,
  moveBody,
  stepPlayer,
} from "../src/game/physics.js";
import {
  INTERACTABLES,
  PLAYER_TUNING,
  PLAYER_START,
  ROOM,
  getSolids,
} from "../src/game/world.js";

const solids = getSolids();

function makePlayer(x = PLAYER_START.x, y = PLAYER_START.y) {
  return { x, y, facing: "down", moving: false, walkTime: 0 };
}

function simulate(player, input, seconds, fps = 60) {
  const steps = Math.round(seconds * fps);
  for (let i = 0; i < steps; i += 1) {
    stepPlayer(player, input, 1 / fps, ROOM.interior, solids, PLAYER_TUNING);
  }
  return player;
}

test("movement distance is independent of frame rate", () => {
  const sixtyFps = simulate(makePlayer(), { x: 1, y: 0 }, 1, 60);
  const thirtyFps = simulate(makePlayer(), { x: 1, y: 0 }, 1, 30);
  const singleStep = makePlayer();
  stepPlayer(singleStep, { x: 1, y: 0 }, 1, ROOM.interior, solids, PLAYER_TUNING);

  assert.ok(Math.abs(sixtyFps.x - 638) < 0.001, `60fps x=${sixtyFps.x}`);
  assert.ok(Math.abs(thirtyFps.x - 638) < 0.001, `30fps x=${thirtyFps.x}`);
  assert.ok(Math.abs(singleStep.x - 638) < 0.001, `1s x=${singleStep.x}`);
  assert.equal(sixtyFps.y, PLAYER_START.y);
});

test("diagonal movement is normalized", () => {
  const player = makePlayer(480, 380);
  simulate(player, { x: 1, y: 1 }, 1);
  const distance = Math.hypot(player.x - 480, player.y - 380);
  assert.ok(distance <= PLAYER_TUNING.speed + 0.01, `distance=${distance}`);
  assert.ok(distance > PLAYER_TUNING.speed - 1, `distance=${distance}`);
  assert.equal(player.facing, "down");
});

test("player cannot pass through the left wall", () => {
  const body = { x: 60, y: 300, width: 24, height: 18 };
  moveBody(body, -500, 0, ROOM.interior, solids);
  assert.equal(body.x, ROOM.interior.x + body.width / 2);
  moveBody(body, -500, 0, ROOM.interior, solids);
  assert.equal(body.x, ROOM.interior.x + body.width / 2);
});

test("player cannot pass through the bottom wall", () => {
  const body = { x: 480, y: 550, width: 24, height: 18 };
  moveBody(body, 0, 500, ROOM.interior, solids);
  assert.equal(body.y, ROOM.interior.y + ROOM.interior.h);
});

test("desk blocks upward movement", () => {
  const player = makePlayer(416, 200);
  simulate(player, { x: 0, y: -1 }, 1);

  assert.ok(player.y >= 178 && player.y < 180, `feet y=${player.y}`);
  assert.equal(player.x, 416);
});

test("diagonal input slides along a desk instead of sticking", () => {
  const player = makePlayer(416, 200);
  simulate(player, { x: 1, y: -1 }, 0.25);

  assert.ok(player.y >= 178 && player.y < 180, `feet y=${player.y}`);
  assert.ok(player.x > 435, `x=${player.x}`);
});

test("wardrobe blocks walking through it", () => {
  const player = makePlayer(856, 280);
  simulate(player, { x: 0, y: -1 }, 1.5);
  assert.ok(player.y >= 254 && player.y <= 257, `feet y=${player.y}`);
  assert.equal(player.facing, "up");
});

test("proximity returns only the nearest object in range", () => {
  const nearDesk = findNearestInteractable(
    { x: 416, y: 190 },
    INTERACTABLES,
  );
  assert.equal(nearDesk?.interactable.id, "desk");

  const farAway = findNearestInteractable(
    { x: 480, y: 380 },
    INTERACTABLES,
  );
  assert.equal(farAway, null);
});

test("interaction range boundary is respected", () => {
  const desk = INTERACTABLES.find((entry) => entry.id === "desk");

  const inside = findNearestInteractable(
    { x: desk.anchor.x, y: desk.anchor.y + desk.radius - 1 },
    INTERACTABLES,
  );
  assert.equal(inside?.interactable.id, "desk");

  const outside = findNearestInteractable(
    { x: desk.anchor.x, y: desk.anchor.y + desk.radius + 1 },
    INTERACTABLES,
  );
  assert.equal(outside, null);
});

test("restart player start is inside the walkable room and clear of furniture", () => {
  const body = {
    x: PLAYER_START.x,
    y: PLAYER_START.y,
    width: PLAYER_TUNING.width,
    height: PLAYER_TUNING.height,
  };
  const inRoom =
    body.x > ROOM.interior.x &&
    body.x < ROOM.interior.x + ROOM.interior.w &&
    body.y > ROOM.interior.y &&
    body.y < ROOM.interior.y + ROOM.interior.h;
  assert.ok(inRoom, "start position is inside the room");
  for (const solid of solids) {
    const overlaps =
      body.x + body.width / 2 > solid.x &&
      body.x - body.width / 2 < solid.x + solid.w &&
      body.y > solid.y &&
      body.y - body.height < solid.y + solid.h;
    assert.equal(overlaps, false, `start overlaps ${solid.id}`);
  }
});
