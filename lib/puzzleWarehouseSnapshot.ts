import "server-only";

import { unstable_cache } from "next/cache";
import { fetchServerWarehouseCategories } from "./serverWarehouseCategoriesV16_2_7";
import { loadServerPlayableCategoryCatalog } from "./serverPlayableCatalog";
import { CATEGORY_SET_VERSION, DATASET_VERSION } from "./version";

export type SerializableWarehouseSnapshot = Awaited<ReturnType<typeof fetchServerWarehouseCategories>> & {
  catalogSize: number;
};

const loadVersionedWarehouseSnapshot = unstable_cache(
  async (): Promise<SerializableWarehouseSnapshot> => {
    const catalog = await loadServerPlayableCategoryCatalog();
    const bulk = await fetchServerWarehouseCategories(catalog);
    return { ...bulk, catalogSize: catalog.length };
  },
  ["geostats-puzzle-warehouse-snapshot", DATASET_VERSION, CATEGORY_SET_VERSION, "warehouse-id-hotfix2"],
  { revalidate: 60 * 60, tags: ["geostats-puzzle-warehouse-snapshot"] },
);

export async function loadCachedPuzzleWarehouseSnapshot() {
  return loadVersionedWarehouseSnapshot();
}
