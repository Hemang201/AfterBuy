import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ASSET_MANIFEST } from "../src/assets/manifest.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const doc = readFileSync(resolve(root, "ART_REPLACEMENT.md"), "utf8");

/**
 * Reads the asset inventory table from ART_REPLACEMENT.md. Columns are looked up
 * by header name, so the table can grow without breaking this test:
 * ID | File | Size | Transparency | Type | Frames | Anchor | Priority | Status
 */
function parseAssetTable(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^\|\s*ID\s*\|/i.test(line));
  if (headerIndex === -1) return new Map();

  const header = lines[headerIndex]
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim().toLowerCase());

  const rows = new Map();
  for (const line of lines.slice(headerIndex + 1)) {
    if (!line.trim().startsWith("|")) {
      if (rows.size) break;
      continue;
    }
    // Cells may wrap code spans in backticks; compare plain text.
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/`/g, ""));
    if (!/^[a-z0-9_]+$/i.test(cells[0])) continue; // skip the header separator row
    const row = {};
    header.forEach((name, index) => {
      row[name] = cells[index] ?? "";
    });
    rows.set(cells[0].replace(/`/g, ""), row);
  }
  return rows;
}

const table = parseAssetTable(doc);
const TILE_IDS = ["floor_tile", "wall_tile"];

test("ART_REPLACEMENT.md documents exactly the manifest's asset IDs", () => {
  assert.ok(table.size > 0, "no asset table was found in ART_REPLACEMENT.md");
  assert.deepEqual(
    [...table.keys()].sort(),
    Object.keys(ASSET_MANIFEST).sort(),
    "the art table and src/assets/manifest.js disagree about which assets exist",
  );
});

test("every documented path and size matches the manifest", () => {
  for (const [id, entry] of Object.entries(ASSET_MANIFEST)) {
    const row = table.get(id);
    assert.ok(row, `${id} is missing from the art table`);
    assert.equal(row.file, entry.file, `${id} path differs from the manifest`);

    const size = row.size.match(/(\d+)\s*[x×]\s*(\d+)/);
    assert.ok(size, `${id} row has no readable W×H size: "${row.size}"`);
    assert.equal(Number(size[1]), entry.width, `${id} documented width`);
    assert.equal(Number(size[2]), entry.height, `${id} documented height`);
  }
});

test("documented frame counts, sheet layout and frame rate match the manifest", () => {
  for (const [id, entry] of Object.entries(ASSET_MANIFEST)) {
    const row = table.get(id);
    const frames = Number(row.frames.match(/^\d+/)?.[0]);
    assert.equal(frames, entry.frames, `${id} documented frame count`);

    if (entry.frames > 1) {
      assert.match(row.frames, /each/i, `${id} should document its per-frame size`);
      assert.match(row.type, /sheet/i, `${id} should be documented as a sprite sheet`);
      assert.equal(entry.width, entry.frameWidth * entry.frames, `${id} sheet width`);
      assert.ok(
        new RegExp(`\\b${entry.fps}\\s*fps\\b`).test(doc),
        `${id} frame rate (${entry.fps} fps) should appear in the doc`,
      );
    } else {
      assert.match(row.type, /single/i, `${id} should be documented as a single image`);
    }
  }
});

test("documented transparency matches how the asset is drawn", () => {
  for (const [id, entry] of Object.entries(ASSET_MANIFEST)) {
    const row = table.get(id);
    if (TILE_IDS.includes(id)) {
      // Tiles are repeated edge-to-edge, so they must be opaque.
      assert.match(row.transparency, /^opaque/i, `${id} must be documented as opaque`);
      assert.equal(entry.width, entry.height, `${id} tiles are square`);
    } else {
      assert.match(row.transparency, /alpha/i, `${id} needs an alpha channel`);
      assert.doesNotMatch(row.transparency, /^opaque/i, `${id} must not be opaque-only`);
    }
  }
});

test("every asset row records a priority and a status from the allowed set", () => {
  const allowedStatus = ["placeholder", "needed", "imported", "tested"];
  for (const [id, row] of table) {
    assert.match(row.priority, /\b(mandatory|optional)\b/i, `${id} priority is unclear`);
    assert.ok(row.anchor.trim().length > 0, `${id} anchor is missing`);
    const status = allowedStatus.find((value) => row.status.includes(value));
    assert.ok(status, `${id} status must be one of ${allowedStatus.join(", ")}`);
  }
});

test("unused art is declared optional or explained", () => {
  // water_bottle is loaded but drawn nowhere: the table must say so.
  const bottle = table.get("water_bottle");
  assert.match(bottle.priority, /optional/i, "water_bottle should be optional");
  assert.match(doc, /not drawn anywhere/i, "the doc should say water_bottle is unused");
});

test("the doc explains the workflow, the overwrite hazard and the fallback", () => {
  assert.match(doc, /manifest\.js/, "should point at the central manifest");
  assert.match(doc, /npm run art/, "should mention the placeholder generator");
  assert.match(doc, /--only/, "should document targeted regeneration");
  assert.match(doc, /overwrites/i, "should warn that full generation overwrites art");
  assert.match(doc, /drawFallback|fallback/i, "should describe the missing-art fallback");
  assert.match(doc, /missingAssets/, "should name the debug handle for missing art");
});
