/**
 * Central asset manifest.
 *
 * Gameplay and rendering code refer to these logical IDs only. To replace a
 * placeholder with hand-drawn art, overwrite the file at `file` (or change
 * `file` here) without touching game logic. Images must match the documented
 * pixel dimensions and use a transparent background where noted.
 *
 * Frames are laid out left-to-right in a single row. `anchor` describes where
 * a sprite attaches to its world position: "feet" (bottom-center) or "topLeft".
 */
export const ASSET_MANIFEST = {
  // Characters ---------------------------------------------------------------
  player_idle: {
    file: "assets/characters/player_idle.png",
    kind: "character",
    width: 32,
    height: 48,
    frames: 1,
    anchor: "feet",
    animated: false,
  },
  player_walk: {
    file: "assets/characters/player_walk.png",
    kind: "character",
    width: 128,
    height: 48,
    frameWidth: 32,
    frameHeight: 48,
    frames: 4,
    fps: 9,
    anchor: "feet",
    animated: true,
  },

  // Environment --------------------------------------------------------------
  floor_tile: {
    file: "assets/environments/floor_tile.png",
    kind: "environment",
    width: 32,
    height: 32,
    frames: 1,
    anchor: "topLeft",
  },
  wall_tile: {
    file: "assets/environments/wall_tile.png",
    kind: "environment",
    width: 32,
    height: 32,
    frames: 1,
    anchor: "topLeft",
  },
  rug: {
    file: "assets/environments/rug.png",
    kind: "environment",
    width: 200,
    height: 120,
    frames: 1,
    anchor: "topLeft",
  },

  // Furniture ----------------------------------------------------------------
  bed: {
    file: "assets/furniture/bed.png",
    kind: "furniture",
    width: 128,
    height: 104,
    frames: 1,
    anchor: "topLeft",
  },
  desk: {
    file: "assets/furniture/desk.png",
    kind: "furniture",
    width: 144,
    height: 64,
    frames: 1,
    anchor: "topLeft",
  },
  wardrobe: {
    file: "assets/furniture/wardrobe.png",
    kind: "furniture",
    width: 80,
    height: 136,
    frames: 1,
    anchor: "topLeft",
  },
  storage_box: {
    file: "assets/furniture/storage_box.png",
    kind: "furniture",
    width: 76,
    height: 64,
    frames: 1,
    anchor: "topLeft",
  },
  shopping_phone: {
    file: "assets/furniture/shopping_phone.png",
    kind: "furniture",
    width: 80,
    height: 96,
    frames: 1,
    anchor: "topLeft",
  },
  donation_station: {
    file: "assets/furniture/donation_station.png",
    kind: "furniture",
    width: 88,
    height: 92,
    frames: 1,
    anchor: "topLeft",
  },
  plant: {
    file: "assets/furniture/plant.png",
    kind: "furniture",
    width: 44,
    height: 64,
    frames: 1,
    anchor: "topLeft",
  },

  // Items --------------------------------------------------------------------
  headphones: {
    file: "assets/items/headphones.png",
    kind: "item",
    width: 32,
    height: 32,
    frames: 1,
    anchor: "topLeft",
  },
  hoodie: {
    file: "assets/items/hoodie.png",
    kind: "item",
    width: 32,
    height: 32,
    frames: 1,
    anchor: "topLeft",
  },
  sneakers: {
    file: "assets/items/sneakers.png",
    kind: "item",
    width: 32,
    height: 32,
    frames: 1,
    anchor: "topLeft",
  },
  water_bottle: {
    file: "assets/items/water_bottle.png",
    kind: "item",
    width: 32,
    height: 32,
    frames: 1,
    anchor: "topLeft",
  },
  // Products bought from the device. Each has its own ID so a delivered
  // purchase can be redrawn without changing the household item it resembles.
  trendy_sneakers: {
    file: "assets/items/trendy_sneakers.png",
    kind: "item",
    width: 32,
    height: 32,
    frames: 1,
    anchor: "topLeft",
  },
  wireless_headphones: {
    file: "assets/items/wireless_headphones.png",
    kind: "item",
    width: 32,
    height: 32,
    frames: 1,
    anchor: "topLeft",
  },
  party_speaker: {
    file: "assets/items/party_speaker.png",
    kind: "item",
    width: 32,
    height: 32,
    frames: 1,
    anchor: "topLeft",
  },
  parcel: {
    file: "assets/items/parcel.png",
    kind: "item",
    width: 40,
    height: 40,
    frames: 1,
    anchor: "topLeft",
  },

  // UI -----------------------------------------------------------------------
  interaction_icon: {
    file: "assets/ui/interaction_icon.png",
    kind: "ui",
    width: 24,
    height: 24,
    frames: 1,
    anchor: "topLeft",
  },
};

/**
 * IDs the current build actually draws, so they are mandatory for this version
 * and their files must exist at the documented size. Household items are drawn
 * at their spot in the room; product items are drawn once bought (at their
 * parcel); `parcel` is the delivery box; `water_bottle` is intentionally not
 * listed because nothing in this build draws it.
 */
export const REQUIRED_ASSET_IDS = [
  "player_idle",
  "player_walk",
  "floor_tile",
  "wall_tile",
  "rug",
  "bed",
  "desk",
  "wardrobe",
  "storage_box",
  "shopping_phone",
  "donation_station",
  "plant",
  "headphones",
  "hoodie",
  "sneakers",
  "trendy_sneakers",
  "wireless_headphones",
  "party_speaker",
  "parcel",
  "interaction_icon",
];

export function assetEntry(id) {
  const entry = ASSET_MANIFEST[id];
  if (!entry) throw new Error(`Unknown asset id: ${id}`);
  return entry;
}
