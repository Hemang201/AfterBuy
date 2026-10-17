import test from "node:test";
import assert from "node:assert/strict";

import {
  createRunState,
  hasItem,
  showDialogue,
} from "../src/game/state.js";
import { interactWith } from "../src/game/interactions.js";
import { allInteractables, createParcel, openParcel } from "../src/game/economy.js";
import { INTERACTABLES, PLAYER_START } from "../src/game/world.js";

const byId = (id) => INTERACTABLES.find((entry) => entry.id === id);

test("a new run starts with ₹4,000, day 1, and nothing owned", () => {
  const state = createRunState();
  assert.equal(state.money, 4000);
  assert.equal(state.day, 1);
  assert.deepEqual(state.inventory, []);
  assert.deepEqual(state.parcels, []);
  assert.deepEqual(state.history, []);
  assert.deepEqual(state.pendingDecisions, []);
  assert.deepEqual(state.borrowed, []);
  assert.equal(state.player.x, PLAYER_START.x);
  assert.equal(state.player.y, PLAYER_START.y);
  assert.equal(state.ui.dialogue, null);
  assert.equal(state.ui.phone.open, false);
});

test("desk interaction adds worn headphones once", () => {
  const state = createRunState();
  const first = interactWith(state, byId("desk"));
  assert.equal(first.itemAdded, "headphones");
  assert.equal(state.inventory.length, 1);
  assert.equal(state.inventory[0].condition, "Worn");
  assert.equal(state.ui.dialogue.title, "Old Headphones");

  const second = interactWith(state, byId("desk"));
  assert.equal(second.type, "care");
  assert.equal(second.itemId, "headphones");
  assert.equal(state.inventory.length, 1);
  assert.equal(state.ui.care.open, true);
  assert.equal(state.ui.care.view, "actions");
  assert.equal(state.money, 4000);
});

test("wardrobe interaction adds the unused hoodie once", () => {
  const state = createRunState();
  interactWith(state, byId("wardrobe"));
  assert.equal(state.inventory.length, 1);
  assert.equal(state.inventory[0].itemId, "hoodie");
  assert.equal(state.inventory[0].condition, "Unused");

  interactWith(state, byId("wardrobe"));
  assert.equal(state.inventory.length, 1);
});

test("storage crate reveals the worn everyday sneakers once", () => {
  const state = createRunState();
  const first = interactWith(state, byId("storage"));
  assert.equal(first.itemAdded, "sneakers");
  assert.equal(state.inventory.length, 1);
  assert.equal(state.inventory[0].itemId, "sneakers");
  assert.equal(state.inventory[0].condition, "Worn");
  assert.equal(state.ui.dialogue.title, "Everyday Sneakers");

  const second = interactWith(state, byId("storage"));
  assert.equal(second.type, "care");
  assert.equal(second.itemId, "sneakers");
  assert.equal(state.inventory.length, 1);
  assert.equal(state.money, 4000);
});

test("the shopping phone opens the device on the product list", () => {
  const state = createRunState();
  const result = interactWith(state, byId("phone"));
  assert.equal(result.type, "phone");
  assert.equal(state.ui.phone.open, true);
  assert.equal(state.ui.phone.view, "products");
  assert.equal(state.money, 4000);
  assert.deepEqual(state.inventory, []);
});

test("parcels are interactable, open once, and never duplicate a possession", () => {
  const state = createRunState();
  const product = {
    id: "trendy_sneakers",
    itemId: "trendy_sneakers",
  };
  const parcel = createParcel(state, product);
  assert.equal(state.parcels.length, 1);

  const entries = allInteractables(state);
  const parcelEntry = entries.find((entry) => entry.kind === "parcel");
  assert.ok(parcelEntry, "parcel has a world interactable");
  assert.equal(entries.length, INTERACTABLES.length + 1);
  assert.equal(parcelEntry.verb, "Open");

  const first = openParcel(state, parcel.id);
  assert.equal(first.ok, true);
  assert.equal(first.first, true);
  assert.equal(state.parcels[0].opened, true);
  assert.deepEqual(state.history.map((entry) => entry.type), ["open-parcel"]);

  const second = openParcel(state, parcel.id);
  assert.equal(second.ok, true);
  assert.equal(second.first, false);
  assert.equal(state.parcels[0].opened, true);
  assert.deepEqual(state.history.map((entry) => entry.type), ["open-parcel"]);
});

test("the empty station and the bed open their own in-game panels", () => {
  const state = createRunState();
  interactWith(state, byId("donation"));
  assert.equal(state.ui.dialogue.title, "Second-Life Station");

  interactWith(state, byId("bed"));
  assert.equal(state.ui.evening.open, true);
  assert.equal(state.ui.dialogue, null);

  showDialogue(state, { title: "Test", lines: ["hello"] });
  assert.equal(state.ui.dialogue.lines.length, 1);
  assert.equal(hasItem(state, "headphones"), false);
});
