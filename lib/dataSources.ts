import type { Category } from "./categories";
import type { CategoryDataset } from "./worldBank";
import { fetchWorldBankCategory } from "./worldBank";
import { fetchFaostatCategory } from "./faostat";
import { fetchDistributedIndicator } from "./distributedIndicators";
import { fetchWarehouseCategory } from "./warehouseCategories";
import { fetchCategorySourceMetadataBatch } from "./categoryMetadata";
import type { Round } from "./challengeCodec";

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


export async function hydrateRoundMetadata(round: Round): Promise<Round> {
  const metadata = await fetchCategorySourceMetadataBatch(round.categories.map((dataset) => dataset.category));
  if (!metadata.size) return round;
  return {
    ...round,
    categories: round.categories.map((dataset) => {
      const item = metadata.get(dataset.category.id);
      if (!item) return dataset;
      const category = {
        ...dataset.category,
        sourceUrl: item.sourceUrl ?? dataset.category.sourceUrl,
        methodologyUrl: item.methodologyUrl ?? dataset.category.methodologyUrl,
        evidenceLabel: (item.evidenceLabel as Category["evidenceLabel"]) ?? dataset.category.evidenceLabel,
        credibilityScore: item.credibilityScore ?? dataset.category.credibilityScore,
        trustStatus: (item.trustStatus as Category["trustStatus"]) ?? dataset.category.trustStatus,
        trustReason: item.trustReason ?? dataset.category.trustReason,
      };
      return {
        ...dataset,
        category,
        sourceUrl: item.sourceUrl ?? dataset.sourceUrl,
        methodologyUrl: item.methodologyUrl ?? dataset.methodologyUrl,
        evidenceLabel: item.evidenceLabel ?? dataset.evidenceLabel,
        credibilityScore: item.credibilityScore ?? dataset.credibilityScore,
        trustStatus: item.trustStatus ?? dataset.trustStatus,
        trustReason: item.trustReason ?? dataset.trustReason,
      };
    }),
  };
}
