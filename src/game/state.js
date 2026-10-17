import { ITEM_DEFS, PRODUCTS } from "./items.js";
import { PLAYER_START } from "./world.js";

/** Starting wallet in rupees. Not enough for every product: choice matters. */
export const START_MONEY = 4000;
export const START_DAY = 1;

/**
 * The single source of truth for one run: money, day, possessions, decisions,
 * parcels, history, player position, stats, and overlay UI. Restart replaces
 * this object with a brand-new one; nothing else keeps independent run progress.
 */
export function createRunState() {
  return {
    version: 2,
    status: "exploring",
    day: START_DAY,
    money: START_MONEY,
    inventory: [],
    /** Items already found in the home, so a donated item is never re-found. */
    discoveredItemIds: [],
    /** Every item given a second life: {itemId, action, day, cost?, value?}. */
    secondLife: [],
    /** Decisions the player deliberately delayed: {productId, day, days}. */
    pendingDecisions: [],
    /** Items lent by someone else: {productId, from, day}. Never owned. */
    borrowed: [],
    /** Delivery boxes in the world: {id, itemId, productId, x, y, opened, day}. */
    parcels: [],
    /** Chronological run history: {day, type, productId, itemId?, price?}. */
    history: [],
    player: {
      x: PLAYER_START.x,
      y: PLAYER_START.y,
      facing: "down",
      moving: false,
      walkTime: 0,
    },
    stats: {
      itemsFound: 0,
      interactions: 0,
      distanceWalked: 0,
      spent: 0,
      earned: 0,
    },
    elapsed: 0,
    ui: {
      dialogue: null,
      phone: {
        open: false,
        view: "products",
        selectedIndex: 0,
        actionIndex: 0,
        note: null,
      },
      care: {
        open: false,
        view: "items",
        itemIndex: 0,
        actionIndex: 0,
        note: null,
      },
      evening: {
        open: false,
        selectedIndex: 0,
      },
    },
  };
}

export function hasItem(state, itemId) {
  return state.inventory.some((item) => item.itemId === itemId);
}

export function getInventoryItem(state, itemId) {
  return state.inventory.find((item) => item.itemId === itemId) || null;
}

/**
 * Adds an item exactly once. Returns false if the player already owns it, which
 * prevents duplicate records when the same source is inspected again or when a
 * purchase is repeated.
 */
export function addInventoryItem(state, itemId, { condition, source } = {}) {
  if (hasItem(state, itemId)) return false;
  const def = ITEM_DEFS[itemId];
  if (!def) throw new Error(`Unknown inventory item: ${itemId}`);
  state.inventory.push({
    itemId,
    name: def.name,
    asset: def.asset,
    condition: condition || def.condition,
    source: source || "home",
    acquiredDay: state.day,
    status: "stored",
  });
  state.stats.itemsFound += 1;
  return true;
}

/**
 * Finds an item in the world exactly once. Donating or reselling it later must
 * not make it discoverable again, so discovery is tracked separately.
 */
export function discoverItem(state, itemId, { source } = {}) {
  if (state.discoveredItemIds.includes(itemId)) return false;
  const added = addInventoryItem(state, itemId, { source });
  if (added) state.discoveredItemIds.push(itemId);
  return added;
}

export function showDialogue(state, { title, lines, footer }) {
  state.ui.dialogue = {
    title,
    lines: Array.isArray(lines) ? lines : [lines],
    footer: footer || "E / Space to close",
  };
}

export function closeDialogue(state) {
  state.ui.dialogue = null;
}

export function isAnyOverlayOpen(state) {
  return (
    Boolean(state.ui.dialogue) ||
    state.ui.phone.open ||
    state.ui.care.open ||
    state.ui.evening.open
  );
}

export function openPhone(state) {
  state.ui.phone = {
    open: true,
    view: "products",
    selectedIndex: 0,
    actionIndex: 0,
    note: null,
  };
  state.ui.dialogue = null;
}

export function closePhone(state) {
  state.ui.phone.open = false;
  state.ui.phone.note = null;
  state.ui.phone.view = "products";
}

export function selectedProduct(state) {
  return PRODUCTS[state.ui.phone.selectedIndex] || PRODUCTS[0];
}

export function isOverlayOpen(state) {
  return Boolean(state.ui.dialogue) || state.ui.phone.open;
}

export function restartRun(previous) {
  const fresh = createRunState();
  // Keep no references to the previous run's arrays or overlay objects.
  if (previous) {
    previous.inventory.length = 0;
    previous.discoveredItemIds.length = 0;
    previous.secondLife.length = 0;
    previous.pendingDecisions.length = 0;
    previous.borrowed.length = 0;
    previous.parcels.length = 0;
    previous.history.length = 0;
    previous.ui.dialogue = null;
    previous.ui.phone = {
      open: false,
      view: "products",
      selectedIndex: 0,
      actionIndex: 0,
      note: null,
    };
    previous.ui.care = {
      open: false,
      view: "items",
      itemIndex: 0,
      actionIndex: 0,
      note: null,
    };
    previous.ui.evening = { open: false, selectedIndex: 0 };
  }
  return fresh;
}
