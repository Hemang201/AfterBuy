import { discoverItem, hasItem, openPhone, showDialogue } from "./state.js";
import { openParcel } from "./economy.js";
import { openCare, openEvening } from "./care.js";

/**
 * Runs the interaction for a world object. The caller checks that the player is
 * within range first.
 */
export function interactWith(state, interactable) {
  state.stats.interactions += 1;

  if (interactable.kind === "parcel") {
    const result = openParcel(state, interactable.parcelId);

    if (result.first) {
      showDialogue(state, {
        title: interactable.name,
        lines: [result.message],
      });
      return { type: "parcel", parcelId: interactable.parcelId, ...result };
    }

    // The box stays in the room; later visits open that item's care sheet.
    if (hasItem(state, interactable.itemId) && openCare(state, { focusItemId: interactable.itemId }).ok) {
      return { type: "care", itemId: interactable.itemId, source: "parcel" };
    }
    showDialogue(state, { title: interactable.name, lines: [result.message] });
    return { type: "parcel", parcelId: interactable.parcelId, ...result };
  }

  switch (interactable.id) {
    case "desk": {
      if (!state.discoveredItemIds.includes("headphones")) {
        discoverItem(state, "headphones", { source: "desk" });
        showDialogue(state, {
          title: "Old Headphones",
          lines: [
            "Behind a mug: headphones with a frayed cable. They still play.",
            "Worn, but worth repairing before replacing. Press E here to care for them.",
          ],
        });
        return { type: "dialogue", itemAdded: "headphones" };
      }
      if (hasItem(state, "headphones")) {
        openCare(state, { focusItemId: "headphones" });
        return { type: "care", itemId: "headphones" };
      }
      showDialogue(state, {
        title: "Desk",
        lines: ["Notes, a cold mug, and a clear spot where the headphones used to sit."],
      });
      return { type: "dialogue" };
    }

    case "wardrobe": {
      if (!state.discoveredItemIds.includes("hoodie")) {
        discoverItem(state, "hoodie", { source: "wardrobe" });
        showDialogue(state, {
          title: "Coral Hoodie",
          lines: [
            "Deep in the wardrobe: a soft hoodie with the tags still on.",
            "Unused. Press E here again to decide what should happen to it.",
          ],
        });
        return { type: "dialogue", itemAdded: "hoodie" };
      }
      if (hasItem(state, "hoodie")) {
        openCare(state, { focusItemId: "hoodie" });
        return { type: "care", itemId: "hoodie" };
      }
      showDialogue(state, {
        title: "Wardrobe",
        lines: ["The empty hanger sways. Everything else here is in rotation."],
      });
      return { type: "dialogue" };
    }

    case "storage": {
      if (!state.discoveredItemIds.includes("sneakers")) {
        discoverItem(state, "sneakers", { source: "storage" });
        showDialogue(state, {
          title: "Everyday Sneakers",
          lines: [
            "At the bottom of the crate: your everyday sneakers, hole in the left toe.",
            "Worn, but wearable. Press E here again to repair or pass them on.",
          ],
        });
        return { type: "dialogue", itemAdded: "sneakers" };
      }
      if (hasItem(state, "sneakers")) {
        openCare(state, { focusItemId: "sneakers" });
        return { type: "care", itemId: "sneakers" };
      }
      showDialogue(state, {
        title: "Storage Crate",
        lines: ["Cables, jars, and a space where the sneakers used to sit."],
      });
      return { type: "dialogue" };
    }

    case "phone": {
      openPhone(state);
      return { type: "phone" };
    }

    case "donation": {
      const opened = openCare(state);
      if (opened.ok) return { type: "care" };
      showDialogue(state, {
        title: "Second-Life Station",
        lines: [
          "A table for things that deserve another home.",
          "Find something in the room first, then bring it back here.",
        ],
      });
      return { type: "dialogue" };
    }

    case "bed": {
      openEvening(state);
      return { type: "evening" };
    }

    default:
      return { type: "none" };
  }
}
