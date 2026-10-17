import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSET_MANIFEST, REQUIRED_ASSET_IDS } from "../src/assets/manifest.js";
import { ITEM_DEFS, PRODUCTS } from "../src/game/items.js";
import { FURNITURE, ITEM_SPOTS, RUG } from "../src/game/world.js";

const root = fileURLToPath(new URL("..", import.meta.url));

test("every manifest entry points at a real PNG with matching dimensions", () => {
  for (const [id, entry] of Object.entries(ASSET_MANIFEST)) {
    const path = resolve(root, entry.file);
    const buffer = readFileSync(path);

    assert.deepEqual(
      [...buffer.subarray(0, 8)],
      [137, 80, 78, 71, 13, 10, 26, 10],
      `${id} is not a PNG`,
    );
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    assert.equal(width, entry.width, `${id} width`);
    assert.equal(height, entry.height, `${id} height`);
  }
});

test("required asset IDs all exist in the manifest and on disk", () => {
  for (const id of REQUIRED_ASSET_IDS) {
    assert.ok(ASSET_MANIFEST[id], `missing manifest entry ${id}`);
    assert.doesNotThrow(() =>
      readFileSync(resolve(root, ASSET_MANIFEST[id].file)),
    );
  }
});

test("gameplay data only references logical asset IDs in the manifest", () => {
  const referenced = [
    ...Object.values(ITEM_DEFS).map((def) => [`item ${def.id}`, def.asset]),
    ...Object.values(ITEM_SPOTS).map((spot) => [`item spot`, spot.asset]),
    ...FURNITURE.map((entry) => [`furniture ${entry.id}`, entry.asset]),
    ["rug", RUG.asset],
  ];

  for (const [owner, assetId] of referenced) {
    assert.ok(
      ASSET_MANIFEST[assetId],
      `${owner} refers to asset "${assetId}" which is not in the manifest`,
    );
  }

  // A product must point at its own art so a purchase can be redrawn alone.
  for (const product of PRODUCTS) {
    const def = ITEM_DEFS[product.itemId];
    assert.ok(def, `product ${product.id} has no item definition`);
    assert.equal(
      def.asset,
      product.itemId,
      `product ${product.id} should have its own asset ID, not "${def.asset}"`,
    );
    assert.ok(ASSET_MANIFEST[def.asset], `product ${product.id} asset is not in the manifest`);
  }
});

test("only manifest-declared asset paths exist in src (no scattered paths)", () => {
  const files = [
    "src/game/items.js",
    "src/game/world.js",
    "src/game/state.js",
    "src/game/care.js",
    "src/game/economy.js",
    "src/game/interactions.js",
    "src/render/renderer.js",
    "src/render/fallback.js",
    "src/main.js",
  ];

  for (const file of files) {
    const source = readFileSync(resolve(root, file), "utf8");
    const hits = source.match(/assets\/[\w./-]+\.png/g) || [];
    assert.deepEqual(hits, [], `${file} hard-codes an asset path: ${hits.join(", ")}`);
  }
});

test("player walk sheet dimensions match its frame layout", () => {
  const walk = ASSET_MANIFEST.player_walk;
  assert.equal(walk.width, walk.frameWidth * walk.frames);
  assert.equal(walk.height, walk.frameHeight);
  assert.equal(walk.frames, 4);
});
