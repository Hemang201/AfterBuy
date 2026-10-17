import test from "node:test";
import assert from "node:assert/strict";

import { ASSET_MANIFEST } from "../src/assets/manifest.js";
import { loadAssets } from "../src/assets/loader.js";
import { drawFallback } from "../src/render/fallback.js";

/**
 * Minimal stand-in for the browser `Image`. The loader only sets `decoding`,
 * `onload`/`onerror`, and `src`, so the fake resolves on a microtask and fails
 * for paths listed in `failures`.
 */
function installFakeImage(failures = []) {
  const created = [];
  class FakeImage {
    constructor() {
      created.push(this);
      this.decoding = "";
    }

    set src(value) {
      this.currentSrc = value;
      queueMicrotask(() => {
        if (failures.some((fragment) => value.includes(fragment))) {
          this.onerror?.(new Error(`failed: ${value}`));
        } else {
          this.onload?.();
        }
      });
    }

    get src() {
      return this.currentSrc;
    }
  }
  globalThis.Image = FakeImage;
  return created;
}

/** Records canvas calls so the fallback can be exercised without a DOM. */
function stubContext() {
  const calls = [];
  const record =
    (name) =>
    (...args) => {
      calls.push({ name, args });
    };
  const ctx = {
    calls,
    save: record("save"),
    restore: record("restore"),
    beginPath: record("beginPath"),
    closePath: record("closePath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    quadraticCurveTo: record("quadraticCurveTo"),
    arc: record("arc"),
    ellipse: record("ellipse"),
    rect: record("rect"),
    fill: record("fill"),
    stroke: record("stroke"),
    fillText: record("fillText"),
    setLineDash: record("setLineDash"),
    measureText: () => ({ width: 10 }),
  };
  return ctx;
}

test("a missing image is recorded and warned about, never thrown", async () => {
  installFakeImage(["broken.png"]);
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));

  try {
    const assets = await loadAssets({
      good: { file: "assets/items/good.png", kind: "item" },
      bad: { file: "assets/items/broken.png", kind: "item" },
    });

    assert.deepEqual(assets.missingIds, ["bad"]);
    assert.equal(assets.get("bad"), null);
    assert.equal(assets.has("bad"), false);
    assert.deepEqual(assets.missing[0], { id: "bad", file: "assets/items/broken.png" });
    assert.ok(assets.get("good"), "the healthy image still loads");
    assert.equal(assets.has("good"), true);

    const missingWarnings = warnings.filter((line) =>
      line.includes('[AFTERBUY] Missing art for "bad"'),
    );
    assert.equal(missingWarnings.length, 1, "warned exactly once for the missing file");
    assert.match(missingWarnings[0], /fallback placeholder/);
    assert.match(missingWarnings[0], /broken\.png/);
  } finally {
    console.warn = originalWarn;
  }
});

test("every manifest entry has a fallback drawing that never throws", () => {
  for (const [id, entry] of Object.entries(ASSET_MANIFEST)) {
    const ctx = stubContext();
    assert.doesNotThrow(
      () => drawFallback(ctx, id, entry, 0, 0, entry.width, entry.height),
      `${id} fallback threw`,
    );
    const drew = ctx.calls.some((call) => call.name === "fill" || call.name === "fillText");
    assert.ok(drew, `${id} fallback drew nothing`);
    assert.ok(
      ctx.calls.some((call) => call.name === "save") &&
        ctx.calls.some((call) => call.name === "restore"),
      `${id} fallback left the canvas state unbalanced`,
    );
  }
});

test("a fallback with no manifest entry still draws the generic placeholder", () => {
  const ctx = stubContext();
  assert.doesNotThrow(() => drawFallback(ctx, "unknown_thing", undefined, 0, 0, 40, 40));
  assert.ok(ctx.calls.some((call) => call.name === "setLineDash"));
  assert.ok(ctx.calls.some((call) => call.name === "fillText"));
});
