import type { Category } from "./categories";
import type { CategoryDataset } from "./worldBank";
import { fetchWorldBankCategory } from "./worldBank";
import { fetchFaostatCategory } from "./faostat";
import { fetchDistributedIndicator } from "./distributedIndicators";
import { fetchWarehouseCategory } from "./warehouseCategories";

export async function fetchCategory(category: Category): Promise<CategoryDataset> {
  if (!category.certified || category.enabled === false) {
    throw new Error(`${category.shortName} is not certified for playable rounds.`);
  }
  if (category.warehouseBacked) return fetchWarehouseCategory(category);

  switch (category.source) {
    case "worldbank":
      return fetchWorldBankCategory(category);
    case "faostat":
      return fetchFaostatCategory(category);
    case "who":
    case "unesco":
    case "untourism":
      return fetchDistributedIndicator(category);
    case "comtrade":
    case "eia":
    case "unhcr":
      return fetchWarehouseCategory(category);
    case "naturalearth":
    case "ilostat":
      throw new Error(`${category.shortName} must be loaded from the curated warehouse snapshot.`);
    default: {
      const exhaustive: never = category.source;
      throw new Error(`Unsupported data source: ${exhaustive}`);
    }
  }
}
