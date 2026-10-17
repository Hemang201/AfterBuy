import { ITEM_DEFS, formatMoney } from "./items.js";
import { getInventoryItem, showDialogue } from "./state.js";

export const EVENING_OPTIONS = [
  { id: "sleep", label: "Sleep until tomorrow" },
  { id: "finish", label: "Finish the run" },
];

const DAYS_BEFORE_UNUSED = 2;

export function selectedCareItem(state) {
  const care = state.ui.care;
  return state.inventory[care.itemIndex] || state.inventory[0] || null;
}

export function itemStatusLine(item) {
  if (item.status === "unused") {
    return item.unusedDays ? `Unused for ${item.unusedDays} days` : "Unused";
  }
  if (item.status === "repaired") return "Repaired";
  if (item.status === "in-use") return "In use";
  return item.condition;
}

/**
 * Actions offered for one possession. Repair exists only on worn items, costs
 * its defined price, and becomes unavailable once repaired. Donate/resell
 * remove the item, so they can never reward the same item twice.
 */
export function availableItemActions(state, item) {
  if (!item) return [];
  const def = ITEM_DEFS[item.itemId] || {};
  const actions = [];

  const usedToday = item.lastUsedDay === state.day;
  actions.push({
    id: "use",
    label: item.condition === "Unused" ? "Wear it today" : "Use it today",
    enabled: !usedToday,
    reason: usedToday ? "Already used today." : null,
    note: "Free. Keeps the item in rotation.",
  });

  if (def.repairCost) {
    const worn = item.condition === "Worn";
    const affordable = state.money >= def.repairCost;
    actions.push({
      id: "repair",
      label: `Repair · ${formatMoney(def.repairCost)}`,
      enabled: worn && affordable,
      reason: !worn
        ? item.condition === "Repaired"
          ? "Already repaired."
          : "Nothing to repair right now."
        : !affordable
          ? `You need ${formatMoney(def.repairCost - state.money)} more.`
          : null,
      note: `${item.condition} → Repaired, and the cost is deducted.`,
    });
  }

  actions.push({
    id: "donate",
    label: "Donate to the station",
    enabled: true,
    reason: null,
    note: "Leaves your bag and the room. No money back.",
  });

  actions.push({
    id: "resell",
    label: `Resell · +${formatMoney(def.resaleValue || 0)}`,
    enabled: true,
    reason: null,
    note: "Leaves your bag and the room. Money returns.",
  });

  return actions;
}

export function currentItemActions(state) {
  return availableItemActions(state, selectedCareItem(state));
}

export function openCare(state, { focusItemId = null } = {}) {
  if (state.inventory.length === 0) return { ok: false, reason: "empty" };

  state.ui.care = {
    open: true,
    view: "items",
    itemIndex: 0,
    actionIndex: 0,
    note: null,
  };
  state.ui.dialogue = null;

  if (focusItemId) {
    const index = state.inventory.findIndex((item) => item.itemId === focusItemId);
    if (index >= 0) {
      state.ui.care.itemIndex = index;
      state.ui.care.view = "actions";
    }
  }
  return { ok: true };
}

export function closeCare(state) {
  state.ui.care.open = false;
  state.ui.care.view = "items";
  state.ui.care.note = null;
}

export function moveCareSelection(state, delta) {
  const care = state.ui.care;
  if (care.view === "items") {
    const count = state.inventory.length;
    if (!count) return;
    care.itemIndex = (care.itemIndex + delta + count) % count;
    care.actionIndex = 0;
  } else {
    const count = currentItemActions(state).length;
    if (!count) return;
    care.actionIndex = (care.actionIndex + delta + count) % count;
  }
  care.note = null;
}

/** E in the care sheet: item list → actions, or apply the selected action. */
export function confirmCareSelection(state) {
  const care = state.ui.care;

  if (care.view === "items") {
    if (!selectedCareItem(state)) return { type: "empty" };
    care.view = "actions";
    care.actionIndex = 0;
    care.note = null;
    return { type: "open-actions", item: selectedCareItem(state) };
  }

  const item = selectedCareItem(state);
  if (!item) return { type: "empty" };
  const action = currentItemActions(state)[care.actionIndex];
  if (!action) return { type: "empty" };

  const result = performItemAction(state, item.itemId, action.id);
  care.note = result.message;

  if (result.removed) {
    if (state.inventory.length === 0) {
      closeCare(state);
      showDialogue(state, {
        title: "The Room Feels Lighter",
        lines: [result.message, "Nothing else is waiting for a second life."],
      });
      return { type: "action", result, closed: true };
    }
    care.view = "items";
    care.itemIndex = Math.min(care.itemIndex, state.inventory.length - 1);
    care.actionIndex = 0;
  }

  return { type: "action", result };
}

/** Esc in the care sheet: actions → item list → closed. */
export function backCare(state) {
  const care = state.ui.care;
  if (care.view === "actions") {
    care.view = "items";
    care.actionIndex = 0;
    care.note = null;
    return { type: "back" };
  }
  closeCare(state);
  return { type: "close" };
}

export function removeInventoryItem(state, itemId) {
  state.inventory = state.inventory.filter((item) => item.itemId !== itemId);
}

export function performItemAction(state, itemId, actionId) {
  const item = getInventoryItem(state, itemId);
  if (!item) return { ok: false, reason: "missing", message: "That item is no longer yours." };
  const def = ITEM_DEFS[itemId] || {};
  const action = availableItemActions(state, item).find((entry) => entry.id === actionId);
  if (!action) return { ok: false, reason: "unknown", message: "No such action." };
  if (!action.enabled) {
    return { ok: false, reason: actionId, message: action.reason || "Not possible right now." };
  }

  if (actionId === "use") {
    item.status = "in-use";
    item.lastUsedDay = state.day;
    item.unusedDays = 0;
    if (item.condition === "Unused") item.condition = "Worn";
    state.history.push({ day: state.day, type: "use", itemId });
    return {
      ok: true,
      type: "use",
      message: `You use the ${item.name} today. It stays in the room and out of the "unused" pile.`,
    };
  }

  if (actionId === "repair") {
    if (item.condition !== "Worn") {
      return { ok: false, reason: "not-repairable", message: "Nothing to repair." };
    }
    const cost = def.repairCost || 0;
    if (state.money < cost) {
      return { ok: false, reason: "funds", message: `You need ${formatMoney(cost - state.money)} more.` };
    }
    state.money -= cost;
    state.stats.spent += cost;
    item.condition = "Repaired";
    item.status = "repaired";
    item.lastUsedDay = state.day;
    item.unusedDays = 0;
    item.repairedDay = state.day;
    state.secondLife.push({ itemId, action: "repair", day: state.day, cost });
    state.history.push({ day: state.day, type: "repair", itemId, price: cost });
    return {
      ok: true,
      type: "repair",
      message: `${item.name} repaired for ${formatMoney(cost)}. Condition: Worn → Repaired.`,
    };
  }

  if (actionId === "donate") {
    removeInventoryItem(state, itemId);
    state.secondLife.push({ itemId, action: "donate", day: state.day });
    state.history.push({ day: state.day, type: "donate", itemId });
    return {
      ok: true,
      type: "donate",
      removed: true,
      message: `${item.name} goes to the second-life station for someone else.`,
    };
  }

  if (actionId === "resell") {
    const value = def.resaleValue || 0;
    removeInventoryItem(state, itemId);
    state.money += value;
    state.stats.earned += value;
    state.secondLife.push({ itemId, action: "resell", day: state.day, value });
    state.history.push({ day: state.day, type: "resell", itemId, price: value });
    return {
      ok: true,
      type: "resell",
      removed: true,
      message: `${item.name} sold for ${formatMoney(value)}.`,
    };
  }

  return { ok: false, reason: "unknown", message: "No such action." };
}

/** Advances the clock and marks possessions unused after a couple of days. */
export function advanceDay(state) {
  state.day += 1;
  const newlyUnused = [];

  for (const item of state.inventory) {
    const last = item.lastUsedDay ?? item.acquiredDay ?? 1;
    item.unusedDays = Math.max(0, state.day - last);
    if (item.unusedDays >= DAYS_BEFORE_UNUSED && item.status !== "unused") {
      item.status = "unused";
      newlyUnused.push(item);
    }
  }

  return { day: state.day, newlyUnused };
}

export function openEvening(state) {
  state.ui.evening = { open: true, selectedIndex: 0 };
  state.ui.dialogue = null;
}

export function closeEvening(state) {
  state.ui.evening.open = false;
}

export function moveEveningSelection(state, delta) {
  const count = EVENING_OPTIONS.length;
  state.ui.evening.selectedIndex =
    (state.ui.evening.selectedIndex + delta + count) % count;
}

/**
 * E in the evening sheet: sleep to age the home, or finish the run and show the
 * reflection. Esc simply closes the sheet (the run never ends by accident).
 */
export function confirmEveningSelection(state) {
  const option = EVENING_OPTIONS[state.ui.evening.selectedIndex];

  if (option.id === "sleep") {
    const { day, newlyUnused } = advanceDay(state);
    closeEvening(state);
    const lines = ["You sleep, and the room keeps its own quiet time."];
    if (newlyUnused.length > 0) {
      lines.push(
        `${newlyUnused.map((item) => item.name).join(", ")} ${newlyUnused.length === 1 ? "has" : "have"} gone unused. Check the room.`,
      );
    } else {
      lines.push("Nothing has been sitting unused for long.");
    }
    showDialogue(state, { title: `Day ${day}`, lines });
    return { type: "sleep", day, newlyUnused: newlyUnused.map((item) => item.itemId) };
  }

  finishRun(state);
  return { type: "ended" };
}

export function finishRun(state) {
  state.status = "ended";
  closeEvening(state);
  closeCare(state);
  state.ui.phone.open = false;
  state.ui.dialogue = null;
}

export function getSummary(state) {
  const count = (type) => state.history.filter((entry) => entry.type === type).length;
  const purchases = state.history
    .filter((entry) => entry.type === "buy")
    .map((entry) => ITEM_DEFS[entry.itemId]?.name || entry.itemId);
  // One line per item: if an item was repaired and later donated, the
  // reflection reports where it ended up, not the same item twice.
  const latestByItem = new Map();
  for (const entry of state.secondLife) latestByItem.set(entry.itemId, entry);
  const secondLives = [...latestByItem.values()].map((entry) => ({
    ...entry,
    name: ITEM_DEFS[entry.itemId]?.name || entry.itemId,
  }));
  const unused = state.inventory
    .filter((item) => item.status === "unused" || item.condition === "Unused")
    .map((item) => item.name);

  return {
    day: state.day,
    money: state.money,
    spent: state.stats.spent,
    earned: state.stats.earned,
    purchases,
    purchaseCount: purchases.length,
    waits: count("wait"),
    reuses: count("reuse"),
    borrows: count("borrow"),
    repairs: count("repair"),
    donations: count("donate"),
    resells: count("resell"),
    secondLives,
    unused,
    inventory: state.inventory.map((item) => ({
      name: item.name,
      condition: item.condition,
      status: item.status,
    })),
    thoughtfulChoices:
      count("wait") +
      count("reuse") +
      count("borrow") +
      count("repair") +
      count("donate") +
      count("resell"),
  };
}
