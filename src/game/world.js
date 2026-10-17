/** World-space layout. All coordinates are in canvas pixels. */
export const VIEW = { width: 960, height: 600 };

/** Walkable floor. Walls are drawn just outside this rectangle. */
export const ROOM = {
  interior: { x: 40, y: 88, w: 880, h: 484 },
  wall: 24,
};

export const PLAYER_START = { x: 480, y: 380 };

/** Movement tuning, in pixels per second. Delta time keeps this frame-rate safe. */
export const PLAYER_TUNING = {
  speed: 158,
  width: 24,
  height: 18,
  interactionRadius: 76,
};

/**
 * Solid furniture. `w`/`h` are both the collision footprint and the size the
 * furniture asset is drawn at, so replacing art never shifts collision.
 */
export const FURNITURE = [
  { id: "bed", asset: "bed", label: "Bed", x: 64, y: 96, w: 128, h: 104 },
  { id: "desk", asset: "desk", label: "Desk", x: 344, y: 96, w: 144, h: 64 },
  { id: "plant_desk", asset: "plant", label: "Plant", x: 556, y: 96, w: 44, h: 64 },
  { id: "wardrobe", asset: "wardrobe", label: "Wardrobe", x: 816, y: 100, w: 80, h: 136 },
  { id: "plant_side", asset: "plant", label: "Plant", x: 112, y: 286, w: 44, h: 64 },
  { id: "storage_box", asset: "storage_box", label: "Storage crate", x: 64, y: 420, w: 76, h: 64 },
  { id: "donation_station", asset: "donation_station", label: "Second-life station", x: 280, y: 420, w: 88, h: 92 },
  { id: "shopping_phone", asset: "shopping_phone", label: "Shopping phone", x: 744, y: 372, w: 80, h: 96 },
];

/** Decorative, non-solid floor pieces drawn below everything else. */
export const RUG = { asset: "rug", label: "Rug", x: 380, y: 284, w: 200, h: 120 };

/**
 * Fixed places in the room where a household possession is visible and can be
 * approached, keyed by item ID. `asset` is a logical manifest ID, so replacing
 * the drawing never touches this layout. Items bought from the device have no
 * fixed spot: their parcel's position is used instead (see the renderer).
 */
export const ITEM_SPOTS = {
  headphones: { x: 424, y: 100, w: 28, h: 28, asset: "headphones" },
  hoodie: { x: 834, y: 142, w: 28, h: 28, asset: "hoodie" },
  sneakers: { x: 84, y: 428, w: 30, h: 30, asset: "sneakers" },
};

/**
 * Proximity interaction points. The prompt only appears while the player's feet
 * are within `radius` of the anchor.
 */
export const INTERACTABLES = [
  {
    id: "desk",
    name: "Desk",
    verb: "Inspect",
    anchor: { x: 416, y: 168 },
    radius: 78,
  },
  {
    id: "wardrobe",
    name: "Wardrobe",
    verb: "Open",
    anchor: { x: 856, y: 244 },
    radius: 78,
  },
  {
    id: "phone",
    name: "Shopping phone",
    verb: "Check",
    anchor: { x: 784, y: 476 },
    radius: 80,
  },
  {
    id: "storage",
    name: "Storage crate",
    verb: "Open",
    anchor: { x: 102, y: 492 },
    radius: 72,
  },
  {
    id: "donation",
    name: "Second-life station",
    verb: "Visit",
    anchor: { x: 324, y: 520 },
    radius: 76,
  },
  {
    id: "bed",
    name: "Bed",
    verb: "Rest",
    anchor: { x: 128, y: 210 },
    radius: 70,
  },
];

/** Collision rectangles for every solid piece of furniture. */
export function getSolids() {
  return FURNITURE.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
}

export function getInteractable(id) {
  return INTERACTABLES.find((entry) => entry.id === id) || null;
}

/** Doorway gap in the top wall + trim colors are renderer-only concerns. */
export const PALETTE = {
  ink: "#2e4a3a",
  inkSoft: "#4c6b58",
  cream: "#f6eddc",
  creamDeep: "#ead9bc",
  leaf: "#6fa36b",
  leafDark: "#4c7c55",
  coral: "#ef7c6a",
  coralDark: "#cf5f50",
  yellow: "#f2c861",
  blue: "#6e93a8",
  blueDark: "#56798c",
  wood: "#c58e5e",
  woodDark: "#9a6a45",
  white: "#fff9ec",
  skin: "#f2c9a3",
  night: "#22392c",
};
