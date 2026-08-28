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
    case "unsdg":
    case "comtrade":
    case "faostatfbs":
    case "eia":
    case "unhcr":
    case "pewreligion":
    case "smithsoniangvp":
    case "usgs":
    case "worldcover":
    case "hydrosheds":
    case "elevation":
    case "unescoheritage":
    case "aquastat":
    case "usgsminerals":
    case "faofisheries":
    case "unmembership":
    case "ipu":
    case "constitute":
    case "unwpp":
    case "worldbankclimate":
    case "imfweo":
    case "unescoich":
    case "noaatsunami":
    case "whoghed":
    case "undesamigrant":
    case "wtoservices":
    case "untourismdirect":
    case "fifa":
    case "ioc":
    case "worldbankhistory":
    case "globalfindex2025":
    case "faofra2025":
    case "unicefdata":
    case "undphdr":
    case "vdemv16":
    case "faostatfoodsecurity":
    case "koppengeiger":
    case "worldbankinfra":
    case "faostatlanduse":
    case "faostatworldcover":
    case "worldbankwbl":
    case "jmpwash":
    case "unwup2025":
    case "unwupcities2025":
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
        description: item.plainLanguageDescription ?? dataset.category.description,
        plainLanguageDescription: item.plainLanguageDescription ?? dataset.category.plainLanguageDescription,
        technicalDefinition: item.technicalDefinition ?? dataset.category.technicalDefinition,
        unitExplanation: item.unitExplanation ?? dataset.category.unitExplanation,
        sourceUrl: item.sourceUrl ?? dataset.category.sourceUrl,
        methodologyUrl: item.methodologyUrl ?? dataset.category.methodologyUrl,
        evidenceLabel: (item.evidenceLabel as Category["evidenceLabel"]) ?? dataset.category.evidenceLabel,
        credibilityScore: item.credibilityScore ?? dataset.category.credibilityScore,
        trustStatus: (item.trustStatus as Category["trustStatus"]) ?? dataset.category.trustStatus,
        trustReason: item.trustReason ?? dataset.category.trustReason,
        sourcePageUrl: item.sourcePageUrl ?? dataset.category.sourcePageUrl,
        playerSourceUrl: item.playerSourceUrl ?? dataset.category.playerSourceUrl,
        playerSourceStatus: (item.playerSourceStatus as Category["playerSourceStatus"]) ?? dataset.category.playerSourceStatus,
        playerSourceReason: item.playerSourceReason ?? dataset.category.playerSourceReason,
        playerSourceCheckedAt: item.playerSourceCheckedAt ?? dataset.category.playerSourceCheckedAt,
        contentReviewStatus: (item.contentReviewStatus as Category["contentReviewStatus"]) ?? dataset.category.contentReviewStatus,
        contentReviewReason: item.contentReviewReason ?? dataset.category.contentReviewReason,
        contentReviewVersion: item.contentReviewVersion ?? dataset.category.contentReviewVersion,
        immediateComprehensionScore: item.immediateComprehensionScore ?? dataset.category.immediateComprehensionScore,
        gameplayInterestScore: item.gameplayInterestScore ?? dataset.category.gameplayInterestScore,
        uniquenessScore: item.uniquenessScore ?? dataset.category.uniquenessScore,
        linkQualityScore: item.linkQualityScore ?? dataset.category.linkQualityScore,
        exactQueryUrl: item.exactQueryUrl ?? dataset.category.exactQueryUrl,
        downloadUrl: item.downloadUrl ?? dataset.category.downloadUrl,
        apiUrl: item.apiUrl ?? dataset.category.apiUrl,
        datasetRelease: item.datasetRelease ?? dataset.category.datasetRelease,
        retrievedAt: item.retrievedAt ?? dataset.category.retrievedAt,
        licenseName: item.licenseName ?? dataset.category.licenseName,
        licenseUrl: item.licenseUrl ?? dataset.category.licenseUrl,
        sourceQuery: item.sourceQuery ?? dataset.category.sourceQuery,
        derivationMethod: item.derivationMethod ?? dataset.category.derivationMethod,
        derivationVersion: item.derivationVersion ?? dataset.category.derivationVersion,
        inputDatasets: item.inputDatasets ?? dataset.category.inputDatasets,
        verifiabilityScore: item.verifiabilityScore ?? dataset.category.verifiabilityScore,
        verifiabilityStatus: item.verifiabilityStatus ?? dataset.category.verifiabilityStatus,
        understandabilityScore: item.understandabilityScore ?? dataset.category.understandabilityScore,
        funScore: item.funScore ?? dataset.category.funScore,
        objectiveStatus: (item.objectiveStatus as Category["objectiveStatus"]) ?? dataset.category.objectiveStatus,
        playerQualityStatus: (item.playerQualityStatus as Category["playerQualityStatus"]) ?? dataset.category.playerQualityStatus,
        playerQualityReason: item.playerQualityReason ?? dataset.category.playerQualityReason,
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
        sourcePageUrl: item.sourcePageUrl ?? dataset.sourcePageUrl,
        playerSourceUrl: item.playerSourceUrl ?? dataset.playerSourceUrl,
        playerSourceStatus: item.playerSourceStatus ?? dataset.playerSourceStatus,
        playerSourceReason: item.playerSourceReason ?? dataset.playerSourceReason,
        playerSourceCheckedAt: item.playerSourceCheckedAt ?? dataset.playerSourceCheckedAt,
        contentReviewStatus: item.contentReviewStatus ?? dataset.contentReviewStatus,
        contentReviewReason: item.contentReviewReason ?? dataset.contentReviewReason,
        immediateComprehensionScore: item.immediateComprehensionScore ?? dataset.immediateComprehensionScore,
        gameplayInterestScore: item.gameplayInterestScore ?? dataset.gameplayInterestScore,
        uniquenessScore: item.uniquenessScore ?? dataset.uniquenessScore,
        linkQualityScore: item.linkQualityScore ?? dataset.linkQualityScore,
        exactQueryUrl: item.exactQueryUrl ?? dataset.exactQueryUrl,
        downloadUrl: item.downloadUrl ?? dataset.downloadUrl,
        apiUrl: item.apiUrl ?? dataset.apiUrl,
        datasetRelease: item.datasetRelease ?? dataset.datasetRelease,
        retrievedAt: item.retrievedAt ?? dataset.retrievedAt,
        licenseName: item.licenseName ?? dataset.licenseName,
        licenseUrl: item.licenseUrl ?? dataset.licenseUrl,
        sourceQuery: item.sourceQuery ?? dataset.sourceQuery,
        derivationMethod: item.derivationMethod ?? dataset.derivationMethod,
        derivationVersion: item.derivationVersion ?? dataset.derivationVersion,
        inputDatasets: item.inputDatasets ?? dataset.inputDatasets,
        verifiabilityScore: item.verifiabilityScore ?? dataset.verifiabilityScore,
        verifiabilityStatus: item.verifiabilityStatus ?? dataset.verifiabilityStatus,
        understandabilityScore: item.understandabilityScore ?? dataset.understandabilityScore,
        funScore: item.funScore ?? dataset.funScore,
        objectiveStatus: item.objectiveStatus ?? dataset.objectiveStatus,
        playerQualityStatus: item.playerQualityStatus ?? dataset.playerQualityStatus,
        playerQualityReason: item.playerQualityReason ?? dataset.playerQualityReason,
      };
    }),
  };
}
