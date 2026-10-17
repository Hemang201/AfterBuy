import test from "node:test";
import assert from "node:assert/strict";

import {
  addInventoryItem,
  createRunState,
  discoverItem,
  getInventoryItem,
  hasItem,
  restartRun,
} from "../src/game/state.js";
import {
  advanceDay,
  availableItemActions,
  backCare,
  closeEvening,
  confirmCareSelection,
  confirmEveningSelection,
  getSummary,
  moveCareSelection,
  openCare,
  openEvening,
  performItemAction,
  selectedCareItem,
} from "../src/game/care.js";
import { formatMoney } from "../src/game/items.js";

const actionFor = (state, itemId, actionId) =>
  availableItemActions(state, getInventoryItem(state, itemId)).find(
    (entry) => entry.id === actionId,
  );

function ownedState(itemIds = ["headphones"]) {
  const state = createRunState();
  for (const itemId of itemIds) discoverItem(state, itemId, { source: "test" });
  return state;
}

test("discovery is remembered so a passed-on item is never found twice", () => {
  const state = createRunState();
  assert.equal(discoverItem(state, "headphones", { source: "desk" }), true);
  assert.equal(discoverItem(state, "headphones", { source: "desk" }), false);
  assert.deepEqual(state.discoveredItemIds, ["headphones"]);

  performItemAction(state, "headphones", "donate");
  assert.equal(hasItem(state, "headphones"), false);
  assert.equal(discoverItem(state, "headphones", { source: "desk" }), false);
  assert.equal(state.inventory.length, 0);
});

test("items age into unused after two days and use clears it again", () => {
  const state = ownedState();
  const item = getInventoryItem(state, "headphones");
  assert.equal(item.status, "stored");

  advanceDay(state);
  assert.equal(state.day, 2);
  assert.equal(item.unusedDays, 1);
  assert.notEqual(item.status, "unused");

  advanceDay(state);
  assert.equal(state.day, 3);
  assert.equal(item.status, "unused");
  assert.equal(item.unusedDays, 2);
  assert.equal(getSummary(state).unused.length, 1);

  const used = performItemAction(state, "headphones", "use");
  assert.equal(used.ok, true);
  assert.equal(item.status, "in-use");
  assert.equal(item.unusedDays, 0);
  assert.equal(state.money, 4000);
  assert.deepEqual(getSummary(state).unused, []);
});

test("an item cannot be used twice on the same day", () => {
  const state = ownedState();
  performItemAction(state, "headphones", "use");
  const again = performItemAction(state, "headphones", "use");
  assert.equal(again.ok, false);
  assert.equal(again.reason, "use");
  assert.match(again.message, /already used/i);
  assert.equal(state.history.filter((entry) => entry.type === "use").length, 1);
});

test("repair deducts its cost and changes the condition exactly once", () => {
  const state = ownedState(["headphones"]);
  const item = getInventoryItem(state, "headphones");
  assert.equal(actionFor(state, "headphones", "repair").label, "Repair · ₹250");

  const result = performItemAction(state, "headphones", "repair");
  assert.equal(result.ok, true);
  assert.equal(state.money, 4000 - 250);
  assert.equal(state.stats.spent, 250);
  assert.equal(item.condition, "Repaired");
  assert.equal(item.status, "repaired");
  assert.equal(item.repairedDay, 1);
  assert.deepEqual(
    state.secondLife.map((entry) => `${entry.itemId}:${entry.action}`),
    ["headphones:repair"],
  );
  assert.deepEqual(
    state.history.map((entry) => entry.type),
    ["repair"],
  );

  // Already repaired: no second charge and no second record.
  const again = performItemAction(state, "headphones", "repair");
  assert.equal(again.ok, false);
  assert.match(again.message, /already repaired/i);
  assert.equal(state.money, 3750);
  assert.equal(state.secondLife.length, 1);
});

test("repair is refused when the wallet is short, with no deduction", () => {
  const state = ownedState(["headphones"]);
  state.money = 100;
  const action = actionFor(state, "headphones", "repair");
  assert.equal(action.enabled, false);
  assert.equal(action.reason, `You need ${formatMoney(150)} more.`);

  const result = performItemAction(state, "headphones", "repair");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "repair");
  assert.equal(state.money, 100);
  assert.equal(getInventoryItem(state, "headphones").condition, "Worn");
  assert.equal(state.secondLife.length, 0);
});

test("repair is not offered for items that are not worn", () => {
  const state = ownedState(["hoodie", "trendy_sneakers"]);
  assert.equal(actionFor(state, "hoodie", "repair"), undefined);

  const sneakerRepair = actionFor(state, "trendy_sneakers", "repair");
  assert.equal(sneakerRepair.enabled, false);
  assert.match(sneakerRepair.reason, /nothing to repair/i);

  const refused = performItemAction(state, "trendy_sneakers", "repair");
  assert.equal(refused.ok, false);
  assert.equal(state.money, 4000);
});

test("donation removes the item, records a second life, and pays nothing", () => {
  const state = ownedState(["hoodie"]);
  const result = performItemAction(state, "hoodie", "donate");

  assert.equal(result.ok, true);
  assert.equal(result.removed, true);
  assert.equal(hasItem(state, "hoodie"), false);
  assert.equal(state.inventory.length, 0);
  assert.equal(state.money, 4000);
  assert.deepEqual(
    state.secondLife.map((entry) => `${entry.itemId}:${entry.action}`),
    ["hoodie:donate"],
  );
  assert.deepEqual(state.history.map((entry) => entry.type), ["donate"]);

  const again = performItemAction(state, "hoodie", "donate");
  assert.equal(again.ok, false);
  assert.equal(again.reason, "missing");
  assert.equal(state.money, 4000);
  assert.equal(state.secondLife.length, 1);
});

test("resale removes the item and adds its value exactly once", () => {
  const state = ownedState(["sneakers"]);
  const result = performItemAction(state, "sneakers", "resell");

  assert.equal(result.ok, true);
  assert.equal(hasItem(state, "sneakers"), false);
  assert.equal(state.money, 4000 + 500);
  assert.equal(state.stats.earned, 500);
  assert.deepEqual(
    state.secondLife.map((entry) => `${entry.itemId}:${entry.action}`),
    ["sneakers:resell"],
  );
  assert.equal(state.history[0].price, 500);

  const again = performItemAction(state, "sneakers", "resell");
  assert.equal(again.ok, false);
  assert.equal(state.money, 4500);
  assert.equal(state.secondLife.length, 1);
});

test("the care sheet navigates items → actions → back → closed", () => {
  const state = ownedState(["headphones", "hoodie"]);
  assert.equal(openCare(state).ok, true);
  assert.equal(state.ui.care.open, true);
  assert.equal(state.ui.care.view, "items");

  moveCareSelection(state, 1);
  assert.equal(state.ui.care.itemIndex, 1);
  assert.equal(selectedCareItem(state).itemId, "hoodie");

  confirmCareSelection(state);
  assert.equal(state.ui.care.view, "actions");
  assert.equal(state.ui.care.actionIndex, 0);

  backCare(state);
  assert.equal(state.ui.care.view, "items");
  assert.equal(state.ui.care.open, true);

  backCare(state);
  assert.equal(state.ui.care.open, false);
});

test("opening care for a specific item jumps straight to its actions", () => {
  const state = ownedState(["headphones", "hoodie"]);
  openCare(state, { focusItemId: "hoodie" });
  assert.equal(state.ui.care.view, "actions");
  assert.equal(selectedCareItem(state).itemId, "hoodie");
});

test("care cannot open with an empty bag, and asks the player to look around", () => {
  const state = createRunState();
  assert.equal(openCare(state).ok, false);
  assert.equal(state.ui.care.open, false);
});

test("a disabled care action reports why and changes nothing", () => {
  const state = ownedState(["headphones"]);
  state.money = 0;
  openCare(state, { focusItemId: "headphones" });
  state.ui.care.actionIndex = 1; // repair

  const before = JSON.stringify(state.history);
  const result = confirmCareSelection(state);
  assert.equal(result.result.ok, false);
  assert.match(state.ui.care.note, /need/i);
  assert.equal(state.money, 0);
  assert.equal(JSON.stringify(state.history), before);
});

test("the evening sheet sleeps a day, finishes the run, or closes safely", () => {
  const state = ownedState();
  openEvening(state);
  assert.equal(state.ui.evening.open, true);

  closeEvening(state);
  assert.equal(state.ui.evening.open, false);
  assert.equal(state.status, "exploring");

  openEvening(state);
  const slept = confirmEveningSelection(state);
  assert.equal(slept.type, "sleep");
  assert.equal(state.day, 2);
  assert.equal(state.ui.evening.open, false);
  assert.equal(state.ui.dialogue.title, "Day 2");
  assert.equal(state.status, "exploring");

  openEvening(state);
  state.ui.evening.selectedIndex = 1;
  const ended = confirmEveningSelection(state);
  assert.equal(ended.type, "ended");
  assert.equal(state.status, "ended");
  assert.equal(state.ui.dialogue, null);
});

test("the reflection reports money, purchases, choices, and second lives", () => {
  const state = ownedState(["headphones", "hoodie", "sneakers"]);

  // Buy the wireless headphones, then age the room and care for what is worn.
  state.money = 4000;
  state.history.push({ day: 1, type: "buy", productId: "wireless_headphones", itemId: "wireless_headphones", price: 1899 });
  state.money -= 1899;
  state.stats.spent += 1899;
  addInventoryItem(state, "wireless_headphones", { source: "phone" });

  state.history.push({ day: 1, type: "wait", productId: "party_speaker" });
  advanceDay(state);
  performItemAction(state, "headphones", "repair");
  performItemAction(state, "hoodie", "donate");
  performItemAction(state, "sneakers", "resell");

  const summary = getSummary(state);
  assert.equal(summary.day, 2);
  assert.equal(summary.money, 4000 - 1899 - 250 + 500);
  assert.equal(summary.purchaseCount, 1);
  assert.deepEqual(summary.purchases, ["Wireless Headphones"]);
  assert.equal(summary.waits, 1);
  assert.equal(summary.repairs, 1);
  assert.equal(summary.donations, 1);
  assert.equal(summary.resells, 1);
  assert.equal(summary.thoughtfulChoices, 4);
  assert.equal(summary.secondLives.length, 3);
  assert.deepEqual(
    summary.secondLives.map((entry) => entry.action),
    ["repair", "donate", "resell"],
  );
  assert.deepEqual(summary.unused, []);
});

test("an item repaired and then passed on is reported once in the reflection", () => {
  const state = ownedState(["headphones"]);
  performItemAction(state, "headphones", "repair");
  performItemAction(state, "headphones", "donate");

  const summary = getSummary(state);
  assert.equal(summary.secondLives.length, 1);
  assert.equal(summary.secondLives[0].action, "donate");
  assert.equal(summary.repairs, 1);
  assert.equal(summary.donations, 1);
  assert.equal(summary.thoughtfulChoices, 2);
});

test("a full three-life run works end to end and restart clears it", () => {
  const state = createRunState();

  // Discover the household items.
  discoverItem(state, "headphones", { source: "desk" });
  discoverItem(state, "hoodie", { source: "wardrobe" });
  discoverItem(state, "sneakers", { source: "storage" });
  assert.equal(state.inventory.length, 3);

  // Two nights make the worn items visible as unused.
  advanceDay(state);
  advanceDay(state);
  state.parcels.push({ id: "parcel_test", itemId: "trendy_sneakers", x: 512, y: 508 });
  assert.equal(state.day, 3);
  assert.equal(state.inventory.filter((item) => item.status === "unused").length, 3);

  // Repair one, donate one, sell one.
  assert.equal(performItemAction(state, "headphones", "repair").ok, true);
  assert.equal(performItemAction(state, "hoodie", "donate").ok, true);
  assert.equal(performItemAction(state, "sneakers", "resell").ok, true);

  assert.equal(state.money, 4000 - 250 + 500);
  assert.equal(state.inventory.length, 1);
  assert.equal(getInventoryItem(state, "headphones").condition, "Repaired");

  openEvening(state);
  state.ui.evening.selectedIndex = 1;
  confirmEveningSelection(state);
  assert.equal(state.status, "ended");

  const summary = getSummary(state);
  assert.equal(summary.money, 4250);
  assert.equal(summary.purchaseCount, 0);
  assert.equal(summary.secondLives.length, 3);

  const fresh = restartRun(state);
  assert.equal(fresh.money, 4000);
  assert.equal(fresh.day, 1);
  assert.equal(fresh.status, "exploring");
  assert.deepEqual(fresh.inventory, []);
  assert.deepEqual(fresh.discoveredItemIds, []);
  assert.deepEqual(fresh.secondLife, []);
  assert.deepEqual(fresh.history, []);
  assert.deepEqual(fresh.parcels, []);
  assert.deepEqual(fresh.pendingDecisions, []);
  assert.deepEqual(fresh.borrowed, []);
  assert.equal(fresh.stats.itemsFound, 0);
  assert.equal(fresh.stats.spent, 0);
  assert.equal(fresh.stats.earned, 0);
  assert.equal(fresh.ui.care.open, false);
  assert.equal(fresh.ui.evening.open, false);
  assert.deepEqual(state.inventory, []);
  assert.deepEqual(state.secondLife, []);
  assert.deepEqual(state.history, []);
  assert.deepEqual(state.parcels, []);
});
