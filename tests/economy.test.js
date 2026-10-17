import test from "node:test";
import assert from "node:assert/strict";

import {
  START_MONEY,
  createRunState,
  getInventoryItem,
  hasItem,
  restartRun,
} from "../src/game/state.js";
import { PRODUCTS, formatMoney, getProduct } from "../src/game/items.js";
import {
  allInteractables,
  availableActions,
  backDevice,
  borrowedFor,
  confirmDeviceSelection,
  moveDeviceSelection,
  pendingFor,
  performAction,
  productStatus,
} from "../src/game/economy.js";
import { openPhone } from "../src/game/state.js";

const sneakers = getProduct("trendy_sneakers");
const headphones = getProduct("wireless_headphones");
const speaker = getProduct("party_speaker");
const actionIds = (state, product) => availableActions(state, product).map((a) => a.id);
const actionFor = (state, product, id) =>
  availableActions(state, product).find((entry) => entry.id === id);

test("the catalogue has the required rupee prices", () => {
  assert.equal(sneakers.name, "Trendy Sneakers");
  assert.equal(sneakers.price, 2499);
  assert.equal(headphones.name, "Wireless Headphones");
  assert.equal(headphones.price, 1899);
  assert.equal(formatMoney(2499), "₹2,499");
  assert.equal(formatMoney(4000), "₹4,000");
  assert.equal(formatMoney(150000), "₹1,50,000");
});

test("buying deducts the exact amount and creates exactly one possession", () => {
  const state = createRunState();
  const result = performAction(state, sneakers.id, "buy");

  assert.equal(result.ok, true);
  assert.equal(state.money, 4000 - 2499);
  assert.equal(state.money, 1501);
  assert.equal(state.inventory.length, 1);
  assert.equal(state.inventory[0].itemId, "trendy_sneakers");
  assert.equal(state.inventory[0].condition, "New");
  assert.equal(state.inventory[0].source, "phone");
  assert.equal(state.stats.spent, 2499);
  assert.equal(state.parcels.length, 1);
  assert.equal(state.parcels[0].itemId, "trendy_sneakers");
  assert.equal(state.parcels[0].opened, false);
  assert.deepEqual(state.history.map((entry) => entry.type), ["buy"]);
  assert.equal(productStatus(state, sneakers), "owned");
  assert.equal(state.money, START_MONEY - state.stats.spent);
});

test("the purchased item stays discoverable through a world parcel", () => {
  const state = createRunState();
  performAction(state, headphones.id, "buy");
  const entries = allInteractables(state);
  const parcel = entries.find((entry) => entry.kind === "parcel");
  assert.ok(parcel, "the parcel remains in the world after checkout");
  assert.equal(parcel.anchor.x, state.parcels[0].x);
  assert.equal(parcel.anchor.y, state.parcels[0].y);
  assert.match(parcel.name, /Wireless Headphones/);
});

test("buying the same product twice cannot duplicate or double-charge", () => {
  const state = createRunState();
  performAction(state, sneakers.id, "buy");
  const moneyAfterFirst = state.money;

  const second = performAction(state, sneakers.id, "buy");
  assert.equal(second.ok, false);
  assert.equal(second.reason, "owned");
  assert.equal(state.money, moneyAfterFirst);
  assert.equal(state.inventory.length, 1);
  assert.equal(state.parcels.length, 1);
  assert.deepEqual(state.history.map((entry) => entry.type), ["buy"]);
  assert.equal(actionFor(state, sneakers, "buy").enabled, false);
  assert.match(actionFor(state, sneakers, "buy").reason, /already own/i);
});

test("insufficient funds refuse the purchase and never deduct money", () => {
  const state = createRunState();
  performAction(state, sneakers.id, "buy");
  assert.equal(state.money, 1501);

  const buyAction = actionFor(state, headphones, "buy");
  assert.equal(buyAction.enabled, false);
  assert.equal(buyAction.reason, `You need ${formatMoney(1899 - 1501)} more.`);
  assert.equal(state.money < headphones.price, true);

  const refused = performAction(state, headphones.id, "buy");
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "funds");
  assert.equal(state.money, 1501);
  assert.equal(state.inventory.length, 1);
  assert.equal(hasItem(state, "wireless_headphones"), false);
  assert.equal(state.parcels.length, 1);
});

test("having exactly enough money succeeds", () => {
  const state = createRunState();
  state.money = headphones.price;
  const result = performAction(state, headphones.id, "buy");
  assert.equal(result.ok, true);
  assert.equal(state.money, 0);
  assert.equal(state.inventory.length, 1);
});

test("waiting advances the day and records a pending decision without buying", () => {
  const state = createRunState();
  const result = performAction(state, headphones.id, "wait");

  assert.equal(result.ok, true);
  assert.equal(state.day, 2);
  assert.equal(state.money, 4000);
  assert.deepEqual(state.inventory, []);
  assert.deepEqual(state.parcels, []);
  assert.equal(pendingFor(state, headphones.id).days, 1);
  assert.deepEqual(state.history.map((entry) => entry.type), ["wait"]);
  assert.equal(productStatus(state, headphones), "waiting");

  performAction(state, headphones.id, "wait");
  assert.equal(state.day, 3);
  assert.equal(pendingFor(state, headphones.id).days, 2);
  assert.equal(state.pendingDecisions.length, 1, "one pending record per product");
  assert.equal(state.money, 4000);

  // Buying later clears the pending decision but keeps the history.
  performAction(state, headphones.id, "buy");
  assert.equal(pendingFor(state, headphones.id), null);
  assert.deepEqual(state.history.map((entry) => entry.type), ["wait", "wait", "buy"]);
});

test("reuse is refused until the matching worn item is owned", () => {
  const state = createRunState();
  const action = actionFor(state, headphones, "reuse");
  assert.equal(action.enabled, false);
  assert.match(action.reason, /do not own/i);

  const refused = performAction(state, headphones.id, "reuse");
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, "not-owned");
  assert.equal(state.money, 4000);
  assert.deepEqual(state.history, []);
});

test("reuse spends no money, creates nothing, and marks the owned item in use", () => {
  const state = createRunState();
  state.inventory.push({
    itemId: "headphones",
    name: "Old Headphones",
    asset: "headphones",
    condition: "Worn",
    source: "desk",
    acquiredDay: 1,
    status: "stored",
  });

  const result = performAction(state, headphones.id, "reuse");
  assert.equal(result.ok, true);
  assert.equal(state.money, 4000);
  assert.equal(state.inventory.length, 1);
  assert.equal(state.parcels.length, 0);
  assert.equal(getInventoryItem(state, "headphones").status, "in-use");
  assert.equal(getInventoryItem(state, "headphones").lastUsedDay, 1);
  assert.deepEqual(state.history.map((entry) => entry.type), ["reuse"]);

  // Repeating reuse is refused so run history cannot fill with duplicates.
  const again = performAction(state, headphones.id, "reuse");
  assert.equal(again.ok, false);
  assert.equal(again.reason, "in-use");
  assert.equal(actionFor(state, headphones, "reuse").enabled, false);
  assert.deepEqual(state.history.map((entry) => entry.type), ["reuse"]);
  assert.equal(state.money, 4000);
});

test("borrow is only offered where sharing makes sense and never costs money", () => {
  const state = createRunState();
  assert.equal(actionIds(state, speaker).includes("borrow"), true);
  assert.equal(actionIds(state, sneakers).includes("borrow"), false);
  assert.equal(actionIds(state, headphones).includes("borrow"), false);

  const result = performAction(state, speaker.id, "borrow");
  assert.equal(result.ok, true);
  assert.equal(state.money, 4000);
  assert.deepEqual(state.inventory, []);
  assert.deepEqual(state.parcels, []);
  assert.equal(state.borrowed.length, 1);
  assert.equal(state.borrowed[0].from, "Noor");
  assert.equal(borrowedFor(state, speaker.id).from, "Noor");
  assert.deepEqual(state.history.map((entry) => entry.type), ["borrow"]);

  const again = performAction(state, speaker.id, "borrow");
  assert.equal(again.ok, false);
  assert.equal(state.borrowed.length, 1);
});

test("borrowing after waiting clears the stale pending decision", () => {
  const state = createRunState();
  performAction(state, speaker.id, "wait");
  assert.equal(state.pendingDecisions.length, 1);
  assert.equal(productStatus(state, speaker), "waiting");

  const result = performAction(state, speaker.id, "borrow");
  assert.equal(result.ok, true);
  assert.equal(state.pendingDecisions.length, 0);
  assert.equal(productStatus(state, speaker), "borrowing");
  assert.deepEqual(state.history.map((entry) => entry.type), ["wait", "borrow"]);
  assert.equal(state.money, 4000);
});

test("multiple purchases get unique parcels, items, and slots", () => {
  const state = createRunState();
  state.money = 10000;

  performAction(state, sneakers.id, "buy");
  performAction(state, headphones.id, "buy");

  assert.equal(state.inventory.length, 2);
  assert.deepEqual(
    state.inventory.map((item) => item.itemId),
    ["trendy_sneakers", "wireless_headphones"],
  );
  assert.equal(state.parcels.length, 2);
  assert.notEqual(state.parcels[0].id, state.parcels[1].id);
  assert.notEqual(state.parcels[0].x, state.parcels[1].x);
  assert.equal(state.money, 10000 - 2499 - 1899);
  assert.equal(state.stats.spent, 2499 + 1899);
  assert.equal(state.money, 10000 - state.stats.spent);
});

test("device navigation walks products → actions → back → closed", () => {
  const state = createRunState();
  openPhone(state);

  assert.equal(state.ui.phone.view, "products");
  confirmDeviceSelection(state);
  assert.equal(state.ui.phone.view, "actions");
  assert.equal(state.ui.phone.actionIndex, 0);

  moveDeviceSelection(state, 1);
  assert.equal(state.ui.phone.actionIndex, 1);
  moveDeviceSelection(state, -1);
  assert.equal(state.ui.phone.actionIndex, 0);

  backDevice(state);
  assert.equal(state.ui.phone.view, "products");
  assert.equal(state.ui.phone.open, true);

  moveDeviceSelection(state, -1);
  assert.equal(state.ui.phone.selectedIndex, PRODUCTS.length - 1);

  backDevice(state);
  assert.equal(state.ui.phone.open, false);
});

test("confirming a disabled action reports why and changes nothing", () => {
  const state = createRunState();
  openPhone(state);
  state.ui.phone.selectedIndex = PRODUCTS.findIndex((p) => p.id === headphones.id);
  confirmDeviceSelection(state); // open actions
  state.ui.phone.actionIndex = 2; // reuse, not owned yet

  const before = JSON.stringify(state.history);
  const result = confirmDeviceSelection(state);

  assert.equal(result.type, "action");
  assert.equal(result.result.ok, false);
  assert.match(state.ui.phone.note, /do not own/i);
  assert.equal(state.money, 4000);
  assert.equal(JSON.stringify(state.history), before);
});

test("restart clears money, possessions, parcels, decisions, and history", () => {
  const state = createRunState();
  state.money = 10000;
  performAction(state, sneakers.id, "buy");
  performAction(state, speaker.id, "borrow");
  performAction(state, headphones.id, "wait");
  openPhone(state);

  const fresh = restartRun(state);

  assert.equal(fresh.money, 4000);
  assert.equal(fresh.day, 1);
  assert.deepEqual(fresh.inventory, []);
  assert.deepEqual(fresh.parcels, []);
  assert.deepEqual(fresh.pendingDecisions, []);
  assert.deepEqual(fresh.borrowed, []);
  assert.deepEqual(fresh.history, []);
  assert.equal(fresh.stats.spent, 0);
  assert.equal(fresh.ui.phone.open, false);

  // The old state is inert and shares no arrays with the new run.
  assert.deepEqual(state.inventory, []);
  assert.deepEqual(state.parcels, []);
  assert.deepEqual(state.history, []);
  assert.notEqual(fresh.history, state.history);
});
