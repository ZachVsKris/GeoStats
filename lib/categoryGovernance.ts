import type { Category } from "./categories";
import type { CategoryQuality } from "./categoryQuality";

export const GOVERNANCE_VERSION = "geostats-v13.4-provenance-v1";

export type GovernanceStatus = "approved" | "uncertain" | "blocked";
export type CategoryGovernance = {
  provenanceStatus: GovernanceStatus;
  provenanceClass: string;
  provenanceReason: string;
  methodologyUrl: string;
  independentValidation: boolean;
  governmentAssertionRisk: "none" | "low" | "medium" | "high" | "unknown";
  conceptGroup: string;
  sourcePriority: number;
  autoApproved: boolean;
  autoDecisionReason: string;
};

const CONCEPT_GROUPS: Record<string, string> = {
  life: "life-expectancy",
  infantMortality: "infant-mortality",
  roadFatalities: "road-fatality-rate",
  healthSpend: "health-spending-per-person",
  unemploymentLow: "unemployment-rate",
  education: "education-spending-share-gdp",
  sanitation: "safely-managed-sanitation-access",
  basicWater: "drinking-water-access",
  urban: "urbanization-share",
  rural: "urbanization-share",
  forestPct: "forest-cover-share",
  leastForest: "forest-cover-share",
  rain: "average-precipitation",
  dry: "average-precipitation",
};

const PROVENANCE_BY_PREFIX: Array<[string, string, string]> = [
  ["SP.", "internationally_harmonized_demographic_estimate", "UN and national statistical-system demographic data harmonized through WDI"],
  ["EN.POP.", "internationally_harmonized_demographic_estimate", "Population and land denominators harmonized through WDI"],
  ["NY.", "internationally_harmonized_national_accounts", "National accounts compiled under international statistical standards and harmonized through WDI"],
  ["NE.", "internationally_harmonized_national_accounts", "National accounts and balance-of-payments statistics harmonized through WDI"],
  ["NV.", "internationally_harmonized_national_accounts", "National accounts value-added statistics harmonized through WDI"],
  ["AG.", "internationally_harmonized_fao_statistics", "FAO land and agriculture statistics with standardized definitions and validation"],
  ["EG.", "internationally_harmonized_energy_statistics", "International energy statistics and modeled access estimates with published methods"],
  ["IT.", "internationally_harmonized_telecommunications_statistics", "ITU telecommunications statistics assembled from household surveys, operators, and regulators under standardized definitions"],
  ["IS.", "international_transport_administrative_statistics", "International transport administrative and operator statistics"],
  ["ER.", "international_environmental_inventory", "International environmental inventories and standardized resource estimates"],
  ["SH.", "international_health_estimate_or_accounts", "WHO and partner health estimates, surveys, and health-account statistics with published methods"],
  ["SL.", "internationally_harmonized_labor_estimate", "ILO harmonized labor-force surveys and modeled estimates"],
  ["TX.", "transactional_customs_records", "Customs transaction records harmonized through UN trade statistics"],
  ["TM.", "transactional_customs_records", "Customs transaction records harmonized through UN trade statistics"],
  ["IP.", "bibliometric_or_ip_administrative_records", "Bibliometric databases or intellectual-property filing records"],
  ["MS.", "independent_defense_expenditure_estimate", "SIPRI defense-expenditure series using official documents, budgets, and independent estimation"],
];

const QUARANTINE: Record<string, string> = {
  internet: "Internet-use estimates can mix household surveys, administrative reporting, and imputation. This category remains quarantined pending an indicator-specific methodology review.",
};

function provenance(category: Category) {
  const match = PROVENANCE_BY_PREFIX.find(([prefix]) => category.indicator.startsWith(prefix));
  return match ?? ["", "unclassified", "No indicator-level provenance classification is available"];
}

export function governWorldBankCategory(category: Category, quality: CategoryQuality): CategoryGovernance {
  const [, provenanceClass, basis] = provenance(category);
  const blockedReason = QUARANTINE[category.id];
  const classified = provenanceClass !== "unclassified";
  const provenanceStatus: GovernanceStatus = blockedReason ? "uncertain" : classified ? "approved" : "uncertain";
  const autoApproved = quality.eligible && provenanceStatus === "approved";
  const conceptGroup = CONCEPT_GROUPS[category.id] ?? category.id;
  return {
    provenanceStatus,
    provenanceClass,
    provenanceReason: blockedReason ?? `${basis}. The measure is not accepted as a bare assertion from national political leadership.`,
    methodologyUrl: `https://databank.worldbank.org/metadataglossary/world-development-indicators/series/${category.indicator}`,
    independentValidation: classified && !blockedReason,
    governmentAssertionRisk: blockedReason ? "medium" : "low",
    conceptGroup,
    sourcePriority: 40,
    autoApproved,
    autoDecisionReason: autoApproved
      ? "Automatically approved because numerical quality and indicator-level provenance gates passed; duplicate arbitration may still supersede it."
      : blockedReason
        ? `Quarantined by provenance policy: ${blockedReason}`
        : !classified
          ? "Quarantined because no indicator-level provenance classification is available."
          : "Quarantined because the numerical quality gate did not pass.",
  };
}

export function governanceMetadata(governance: CategoryGovernance) {
  return {
    governanceVersion: GOVERNANCE_VERSION,
    provenanceStatus: governance.provenanceStatus,
    provenanceClass: governance.provenanceClass,
    provenanceReason: governance.provenanceReason,
    methodologyUrl: governance.methodologyUrl,
    independentValidation: governance.independentValidation,
    governmentAssertionRisk: governance.governmentAssertionRisk,
    conceptGroup: governance.conceptGroup,
    sourcePriority: governance.sourcePriority,
    autoDecisionReason: governance.autoDecisionReason,
  };
}
