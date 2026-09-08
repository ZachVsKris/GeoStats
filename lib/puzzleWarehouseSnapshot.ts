import "server-only";

import { gzipSync, gunzipSync } from "node:zlib";
import { unstable_cache } from "next/cache";
import { fetchServerWarehouseCategories } from "./serverWarehouseCategoriesV16_2_7";
import { loadServerPlayableCategoryCatalog } from "./serverPlayableCatalog";
import { CATEGORY_SET_VERSION, DATASET_VERSION, PLAYABLE_CATALOG_CACHE_VERSION } from "./version";

export type SerializableWarehouseSnapshot = Awaited<ReturnType<typeof fetchServerWarehouseCategories>> & {
  catalogSize: number;
};

const loadVersionedWarehouseSnapshot = unstable_cache(
  async (): Promise<string> => {
    const catalog = await loadServerPlayableCategoryCatalog();
    const bulk = await fetchServerWarehouseCategories(catalog);
    // Lossless compression keeps the complete snapshot below the Data Cache
    // entry limit; no observations or category metadata are discarded.
    return gzipSync(JSON.stringify({ ...bulk, catalogSize: catalog.length })).toString("base64");
  },
  ["geostats-puzzle-warehouse-snapshot", DATASET_VERSION, CATEGORY_SET_VERSION, PLAYABLE_CATALOG_CACHE_VERSION, "warehouse-gzip-v1"],
  { revalidate: 60 * 60, tags: ["geostats-puzzle-warehouse-snapshot"] },
);

export async function loadCachedPuzzleWarehouseSnapshot() {
  const compressed = await loadVersionedWarehouseSnapshot();
  return JSON.parse(gunzipSync(Buffer.from(compressed, "base64")).toString("utf8")) as SerializableWarehouseSnapshot;
}
