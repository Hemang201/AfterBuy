import { PRODUCTS, getItemDef, getProduct, formatMoney } from "./items.js";
import {
  addInventoryItem,
  closePhone,
  getInventoryItem,
  hasItem,
  selectedProduct,
} from "./state.js";
import { INTERACTABLES } from "./world.js";
import { advanceDay } from "./care.js";

/** Floor slots where delivery parcels appear, in order of purchase. */
export const PARCEL_SLOTS = [
  { x: 512, y: 508 },
  { x: 596, y: 508 },
  { x: 680, y: 508 },
];

export const PARCEL_INTERACTION_RADIUS = 66;

export const STATUS_LABELS = {
  owned: "OWNED",
  waiting: "WAITING",
  borrowing: "BORROWED",
  available: null,
};

export function pendingFor(state, productId) {
  return state.pendingDecisions.find((entry) => entry.productId === productId) || null;
}

export function borrowedFor(state, productId) {
  return state.borrowed.find((entry) => entry.productId === productId) || null;
}

export function productStatus(state, product) {
  if (hasItem(state, product.itemId)) return "owned";
  if (borrowedFor(state, product.id)) return "borrowing";
  if (pendingFor(state, product.id)) return "waiting";
  return "available";
}

/**
 * The actions the device offers for a product. Buy is refused when the item is
 * already owned or the wallet is short; reuse is only offered when the player
 * owns the matching worn item; borrow only exists on products where sharing is
 * plausible.
 */
export function availableActions(state, product) {
  const owned = hasItem(state, product.itemId);
  const affordable = state.money >= product.price;
  const waiting = pendingFor(state, product.id);

  const actions = [
    {
      id: "buy",
      label: `Buy now · ${formatMoney(product.price)}`,
      cost: product.price,
      enabled: !owned && affordable,
      reason: owned
        ? "You already own this."
        : affordable
          ? null
          : `You need ${formatMoney(product.price - state.money)} more.`,
      note: `Wallet after: ${formatMoney(Math.max(0, state.money - product.price))}`,
    },
    {
      id: "wait",
      label: waiting ? "Wait another day" : "Wait a day",
      cost: 0,
      enabled: true,
      reason: null,
      note: waiting
        ? `Thinking about it since day ${waiting.day}.`
        : "Nothing bought today. The day moves on.",
    },
  ];

  if (product.reuse) {
    const ownedItem = getInventoryItem(state, product.reuse.itemId);
    const alreadyUsing = Boolean(ownedItem) && ownedItem.status === "in-use";
    actions.push({
      id: "reuse",
      label: product.reuse.label,
      cost: 0,
      enabled: Boolean(ownedItem) && !alreadyUsing,
      reason: !ownedItem
        ? "You do not own one of these yet."
        : alreadyUsing
          ? `You are already using your ${ownedItem.name}.`
          : null,
      note: ownedItem
        ? `Uses your ${ownedItem.name} (${ownedItem.condition}).`
        : "Find your old pair somewhere at home.",
    });
  }

  if (product.borrow) {
    const already = borrowedFor(state, product.id);
    actions.push({
      id: "borrow",
      label: product.borrow.label,
      cost: 0,
      enabled: !already,
      reason: already ? `Already borrowed on day ${already.day}.` : null,
      note: "No money, nothing owned. It goes back afterwards.",
    });
  }

  return actions;
}

/**
 * Applies an action to the central state. Never charges money for wait, reuse,
 * or borrow, and never creates a second possession for an item already owned.
 */
export function performAction(state, productId, actionId) {
  const product = getProduct(productId);
  if (!product) return { ok: false, reason: "unknown", message: "Unknown product." };

  const action = availableActions(state, product).find((entry) => entry.id === actionId);
  if (!action) return { ok: false, reason: "unknown-action", message: "No such action." };
  if (!action.enabled) {
    const reuseItem = product.reuse
      ? getInventoryItem(state, product.reuse.itemId)
      : null;
    const reasons = {
      buy: hasItem(state, product.itemId) ? "owned" : "funds",
      reuse:
        reuseItem && reuseItem.status === "in-use" ? "in-use" : "not-owned",
      borrow: "borrowed",
    };
    return {
      ok: false,
      reason: reasons[actionId] || "unavailable",
      message: action.reason || "Not possible right now.",
    };
  }

  if (actionId === "buy") {
    state.money -= product.price;
    const added = addInventoryItem(state, product.itemId, {
      source: "phone",
      condition: "New",
    });
    if (!added) {
      // Safety net: never keep the money if the possession could not be created.
      state.money += product.price;
      return { ok: false, reason: "owned", message: "You already own this." };
    }
    state.stats.spent += product.price;
    state.pendingDecisions = state.pendingDecisions.filter(
      (entry) => entry.productId !== product.id,
    );
    const parcel = createParcel(state, product);
    state.history.push({
      day: state.day,
      type: "buy",
      productId: product.id,
      itemId: product.itemId,
      price: product.price,
    });
    return {
      ok: true,
      type: "buy",
      product,
      parcel,
      itemId: product.itemId,
      message: `Bought ${product.name} for ${formatMoney(product.price)}. A parcel is waiting in the room.`,
    };
  }

  if (actionId === "wait") {
    const existing = pendingFor(state, product.id);
    if (existing) {
      existing.days += 1;
      existing.day = state.day;
    } else {
      state.pendingDecisions.push({ productId: product.id, day: state.day, days: 1 });
    }
    const { day, newlyUnused } = advanceDay(state);
    state.history.push({ day, type: "wait", productId: product.id });
    const unusedNote =
      newlyUnused.length > 0
        ? ` ${newlyUnused.map((item) => item.name).join(", ")} ${newlyUnused.length === 1 ? "has" : "have"} gone unused.`
        : "";
    return {
      ok: true,
      type: "wait",
      product,
      message: `You leave ${product.name} for later. It is day ${day} now.${unusedNote}`,
    };
  }

  if (actionId === "reuse") {
    const ownedItem = getInventoryItem(state, product.reuse.itemId);
    if (!ownedItem) {
      return { ok: false, reason: "not-owned", message: "You do not own one of these." };
    }
    ownedItem.status = "in-use";
    ownedItem.lastUsedDay = state.day;
    ownedItem.unusedDays = 0;
    state.pendingDecisions = state.pendingDecisions.filter(
      (entry) => entry.productId !== product.id,
    );
    state.secondLife.push({
      itemId: ownedItem.itemId,
      action: "reuse",
      day: state.day,
    });
    state.history.push({
      day: state.day,
      type: "reuse",
      productId: product.id,
      itemId: ownedItem.itemId,
    });
    return {
      ok: true,
      type: "reuse",
      product,
      itemId: ownedItem.itemId,
      message: product.reuse.text,
    };
  }

  if (actionId === "borrow") {
    if (borrowedFor(state, product.id)) {
      return { ok: false, reason: "borrowed", message: "You are already borrowing this." };
    }
    state.borrowed.push({
      productId: product.id,
      from: product.borrow.from,
      day: state.day,
    });
    // Borrowing settles any earlier "think about it" note for this product.
    state.pendingDecisions = state.pendingDecisions.filter(
      (entry) => entry.productId !== product.id,
    );
    state.history.push({ day: state.day, type: "borrow", productId: product.id });
    return { ok: true, type: "borrow", product, message: product.borrow.text };
  }

  return { ok: false, reason: "unknown-action", message: "No such action." };
}

/** Runs the currently highlighted action in the device's action list. */
export function confirmDeviceSelection(state) {
  const phone = state.ui.phone;

  if (phone.view === "products") {
    phone.view = "actions";
    phone.actionIndex = 0;
    phone.note = null;
    return { type: "open-actions", product: selectedProduct(state) };
  }

  const product = selectedProduct(state);
  const actions = availableActions(state, product);
  const action = actions[phone.actionIndex] || actions[0];
  const result = performAction(state, product.id, action.id);
  phone.note = result.ok ? result.message : result.message || "Not possible right now.";
  return { type: "action", result };
}

export function currentActions(state) {
  return availableActions(state, selectedProduct(state));
}

export function moveDeviceSelection(state, delta) {
  const phone = state.ui.phone;
  if (phone.view === "products") {
    const count = PRODUCTS.length;
    phone.selectedIndex = (phone.selectedIndex + delta + count) % count;
  } else {
    const count = currentActions(state).length;
    phone.actionIndex = (phone.actionIndex + delta + count) % count;
  }
  phone.note = null;
}

/** Esc in the device: actions → product list → closed. */
export function backDevice(state) {
  const phone = state.ui.phone;
  if (phone.view === "actions") {
    phone.view = "products";
    phone.actionIndex = 0;
    phone.note = null;
    return { type: "back" };
  }
  closePhone(state);
  return { type: "close" };
}

export function createParcel(state, product) {
  const slot = PARCEL_SLOTS[state.parcels.length % PARCEL_SLOTS.length];
  const parcel = {
    id: `parcel_${state.parcels.length + 1}_${product.id}`,
    itemId: product.itemId,
    productId: product.id,
    x: slot.x,
    y: slot.y,
    opened: false,
    day: state.day,
  };
  state.parcels.push(parcel);
  return parcel;
}

/**
 * World interactables for parcels. The parcel is the box for a possession that
 * already exists exactly once in the inventory, so it never counts as a second
 * item record.
 */
export function parcelInteractables(state) {
  return state.parcels.map((parcel) => {
    const def = getItemDef(parcel.itemId);
    return {
      id: `parcel:${parcel.id}`,
      kind: "parcel",
      parcelId: parcel.id,
      itemId: parcel.itemId,
      name: def ? `${def.name} parcel` : "Parcel",
      verb: parcel.opened ? "Look in" : "Open",
      anchor: { x: parcel.x, y: parcel.y },
      radius: PARCEL_INTERACTION_RADIUS,
    };
  });
}

export function openParcel(state, parcelId) {
  const parcel = state.parcels.find((entry) => entry.id === parcelId);
  if (!parcel) return { ok: false, reason: "missing", message: "The box is gone." };
  const def = getItemDef(parcel.itemId);
  const name = def ? def.name : "your order";

  if (!parcel.opened) {
    parcel.opened = true;
    parcel.openedDay = state.day;
    state.history.push({
      day: state.day,
      type: "open-parcel",
      productId: parcel.productId,
      itemId: parcel.itemId,
    });
    return {
      ok: true,
      first: true,
      message: `You open the box: ${name}, condition ${def ? def.condition : "New"}. It is yours now.`,
    };
  }

  return {
    ok: true,
    first: false,
    message: `The box ${name} arrived in. You keep it here until recycling day.`,
  };
}

export function allInteractables(state) {
  return [...INTERACTABLES, ...parcelInteractables(state)];
}
