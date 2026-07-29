import "server-only";

import type { Category } from "./categories";
import { fetchCategory } from "./dataSources";
import { fetchServerWarehouseCategory } from "./serverWarehouseCategories";
import type { CategoryDataset } from "./worldBank";

export async function fetchServerCategory(
  category: Category,
): Promise<CategoryDataset> {
  if (!category.certified || category.enabled === false) {
    throw new Error(
      `${category.shortName} is not certified for playable rounds.`,
    );
  }

  if (category.warehouseBacked) {
    return fetchServerWarehouseCategory(category);
  }

  return fetchCategory(category);
}
