import { loadAssets } from "./assets/loader.js";
import { createRenderer } from "./render/renderer.js";
import { createInput } from "./game/input.js";
import {
  closeDialogue,
  createRunState,
  isAnyOverlayOpen,
} from "./game/state.js";
import { findNearestInteractable, stepPlayer } from "./game/physics.js";
import { PLAYER_TUNING, ROOM, getSolids } from "./game/world.js";
import {
  allInteractables,
  backDevice,
  confirmDeviceSelection,
  moveDeviceSelection,
} from "./game/economy.js";
import { interactWith } from "./game/interactions.js";
import {
  backCare,
  closeEvening,
  confirmCareSelection,
  confirmEveningSelection,
  getSummary,
  moveCareSelection,
  moveEveningSelection,
} from "./game/care.js";

const canvas = document.getElementById("game");
const boot = document.getElementById("boot");

async function start() {
  const assets = await loadAssets();
  const renderer = createRenderer(canvas, assets);
  const input = createInput(window);
  const solids = getSolids();

  let state = createRunState();
  let nearest = null;
  let lastTime = performance.now();

  function restart() {
    state = createRunState();
    nearest = null;
    input.reset();
    lastTime = performance.now();
  }

  function update(dt) {
    state.elapsed += dt;

    if (input.consume("restart")) {
      restart();
      return;
    }

    // The run is over: the reflection stays on screen until R restarts.
    if (state.status === "ended") {
      nearest = null;
      return;
    }

    if (state.ui.care.open) {
      nearest = null;
      if (input.consume("cancel")) {
        backCare(state);
        return;
      }
      if (input.consume("up")) moveCareSelection(state, -1);
      if (input.consume("down")) moveCareSelection(state, 1);
      if (input.consume("interact")) confirmCareSelection(state);
      return;
    }

    if (state.ui.evening.open) {
      nearest = null;
      if (input.consume("cancel")) {
        closeEvening(state);
        return;
      }
      if (input.consume("up")) moveEveningSelection(state, -1);
      if (input.consume("down")) moveEveningSelection(state, 1);
      if (input.consume("interact")) confirmEveningSelection(state);
      return;
    }

    if (state.ui.phone.open) {
      nearest = null;
      if (input.consume("cancel")) {
        backDevice(state);
        return;
      }
      if (input.consume("up")) moveDeviceSelection(state, -1);
      if (input.consume("down")) moveDeviceSelection(state, 1);
      if (input.consume("interact")) confirmDeviceSelection(state);
      return;
    }

    if (state.ui.dialogue) {
      nearest = null;
      if (input.consume("interact") || input.consume("cancel")) {
        closeDialogue(state);
      }
      return;
    }

    if (input.consume("cancel")) {
      // Escape has nothing to close while walking; the run never resets on Esc.
    }

    nearest = findNearestInteractable(state.player, allInteractables(state));

    if (input.consume("interact") && nearest) {
      interactWith(state, nearest.interactable);
      if (isAnyOverlayOpen(state)) return;
    }

    const moveX = (input.isDown("right") ? 1 : 0) - (input.isDown("left") ? 1 : 0);
    const moveY = (input.isDown("down") ? 1 : 0) - (input.isDown("up") ? 1 : 0);
    const moved = stepPlayer(
      state.player,
      { x: moveX, y: moveY },
      dt,
      ROOM.interior,
      solids,
      PLAYER_TUNING,
    );
    state.stats.distanceWalked += moved;
  }

  function step(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt);
    renderer.render(state, nearest);
    input.endFrame();
  }

  function frame(now) {
    step(now);
    requestAnimationFrame(frame);
  }

  // Browsers stop requestAnimationFrame while a visible window is not being
  // composited (for example a fully occluded window). Keep simulating with a
  // watchdog so the game never appears frozen; timing still comes from delta
  // time, so no time is double-counted. Hidden tabs stay paused.
  const watchdog = window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    const now = performance.now();
    if (now - lastTime > 250) step(now);
  }, 120);

  if (boot) boot.hidden = true;
  requestAnimationFrame(frame);

  // Test/debug handle. It exposes state for verification only; gameplay still
  // runs through the real input handlers above.
  window.__AFTERBUY__ = {
    get state() {
      return state;
    },
    snapshot() {
      const phone = state.ui.phone;
      return {
        player: {
          x: Math.round(state.player.x * 100) / 100,
          y: Math.round(state.player.y * 100) / 100,
          facing: state.player.facing,
          moving: state.player.moving,
        },
        nearest: nearest ? nearest.interactable.id : null,
        distance: nearest ? Math.round(nearest.distance * 10) / 10 : null,
        dialogue: state.ui.dialogue ? state.ui.dialogue.title : null,
        device: phone.open
          ? { view: phone.view, product: phone.selectedIndex, action: phone.actionIndex, note: phone.note }
          : null,
        care: state.ui.care.open
          ? { view: state.ui.care.view, item: state.ui.care.itemIndex, action: state.ui.care.actionIndex, note: state.ui.care.note }
          : null,
        evening: state.ui.evening.open ? state.ui.evening.selectedIndex : null,
        status: state.status,
        summary: state.status === "ended" ? getSummary(state) : null,
        inventory: state.inventory.map((item) => ({
          id: item.itemId,
          condition: item.condition,
          status: item.status,
          unusedDays: item.unusedDays ?? 0,
        })),
        money: state.money,
        day: state.day,
        spent: state.stats.spent,
        earned: state.stats.earned,
        history: state.history.map((entry) => entry.type),
        discovered: [...state.discoveredItemIds],
        secondLife: state.secondLife.map((entry) => `${entry.itemId}:${entry.action}`),
        parcels: state.parcels.map((parcel) => ({
          id: parcel.id,
          itemId: parcel.itemId,
          opened: parcel.opened,
          x: parcel.x,
          y: parcel.y,
        })),
        pending: state.pendingDecisions.map((entry) => `${entry.productId}:${entry.days}`),
        borrowed: state.borrowed.map((entry) => entry.productId),
        interactions: state.stats.interactions,
      };
    },
    teleport(x, y) {
      state.player.x = x;
      state.player.y = y;
      state.player.moving = false;
    },
    /**
     * Test-only: advance one real game step by `ms` milliseconds. This exists
     * because preview/background tabs can throttle timers, and it still routes
     * through the same update and render path as the normal loop.
     */
    tick(ms = 16) {
      step(lastTime + ms);
    },
    restart,
    interactables: () => allInteractables(state),
    solids,
    room: ROOM.interior,
    missingAssets: assets.missing.map((entry) => entry.id),
    assetManifest: assets.manifest,
  };
}

start().catch((error) => {
  console.error("[AFTERBUY] Failed to start:", error);
  if (boot) {
    boot.hidden = false;
    boot.textContent = `The room could not open. ${error.message}`;
  }
});
