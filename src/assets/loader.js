import { ASSET_MANIFEST } from "./manifest.js";

/**
 * Loads every image in the manifest. A missing or broken image never rejects:
 * it is recorded in `missing`, warned about once, and rendering falls back to a
 * visible shape instead of crashing.
 */
export async function loadAssets(manifest = ASSET_MANIFEST) {
  const images = new Map();
  const missing = [];

  await Promise.all(
    Object.entries(manifest).map(
      ([id, entry]) =>
        new Promise((resolve) => {
          const image = new Image();
          image.decoding = "async";
          image.onload = () => {
            images.set(id, image);
            resolve();
          };
          image.onerror = () => {
            missing.push({ id, file: entry.file });
            console.warn(
              `[AFTERBUY] Missing art for "${id}" at ${entry.file}. ` +
                "Drawing a fallback placeholder. Replace the PNG or run `npm run art`.",
            );
            resolve();
          };
          image.src = entry.file;
        }),
    ),
  );

  return {
    manifest,
    missing,
    get(id) {
      return images.get(id) || null;
    },
    has(id) {
      return images.has(id);
    },
    get missingIds() {
      return missing.map((entry) => entry.id);
    },
  };
}
