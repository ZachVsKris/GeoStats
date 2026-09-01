import { CATEGORIES, type Category, type DataSourceId } from "./categories";
import type { EvidenceLabel, TrustStatus } from "./categoryTrust";

export type PlayableCategoryRow = {
  id: string;
  title: string;
  short_title?: string | null;
  description: string;
  icon?: string | null;
  unit: string;
  value_type?: string | null;
  measurement_type?: string | null;
  ranking_direction: "high" | "low";
  family: string;
  source_organization: string;
  source_dataset: string;
  source_indicator_code: string;
  source_url: string;
  methodology_url?: string | null;
  plain_language_description?: string | null;
  technical_definition?: string | null;
  unit_explanation?: string | null;
  source_page_url?: string | null;
  player_source_url?: string | null;
  player_source_status?: string | null;
  player_source_reason?: string | null;
  player_source_checked_at?: string | null;
  content_review_status?: string | null;
  content_review_reason?: string | null;
  content_review_version?: string | null;
  immediate_comprehension_score?: number | null;
  gameplay_interest_score?: number | null;
  uniqueness_score?: number | null;
  link_quality_score?: number | null;
  exact_query_url?: string | null;
  download_url?: string | null;
  api_url?: string | null;
  dataset_release?: string | null;
  retrieved_at?: string | null;
  license_name?: string | null;
  license_url?: string | null;
  source_query?: Record<string, unknown> | string | null;
  derivation_method?: string | null;
  derivation_version?: string | null;
  input_datasets?: Array<Record<string, unknown> | string> | null;
  verifiability_score?: number | null;
  verifiability_status?: string | null;
  understandability_score?: number | null;
  fun_score?: number | null;
  objective_status?: string | null;
  player_quality_status?: string | null;
  player_quality_reason?: string | null;
  minimum_year?: number | null;
  common_year?: number | null;
  common_year_coverage?: number | null;
  eligible_universe_type?: string | null;
  eligible_universe_rule?: string | null;
  eligible_country_count?: number | null;
  eligible_country_iso3?: string[] | null;
  coverage_within_eligible_universe?: number | null;
  excluded_country_reason?: string | null;
  quality_score?: number | null;
  concept_group?: string | null;
  semantic_family?: string | null;
  semantic_topic?: string | null;
  metadata?: Record<string, unknown> | null;
  credibility_score?: number | null;
  credibility_status?: string | null;
  credibility_reason?: string | null;
  evidence_label?: string | null;
  enabled?: boolean | null;
  eligible_daily?: boolean | null;
  review_status?: string | null;
  curation_status?: string | null;
  validation_status?: string | null;
  validation_version?: string | null;
  validated_at?: string | null;
  computed_playable_v16?: boolean | null;
  computed_playable_v16_2?: boolean | null;
  promotion_decision_v16_2?: string | null;
  promotion_reason_v16_2?: string | null;
  primary_blocker_v16_2?: string | null;
  blocker_class_v16_2?: string | null;
  ranking_completeness_status?: string | null;
  ranking_completeness_reason?: string | null;
  top_value_distinct_count?: number | null;
  top_value_feasible?: boolean | null;
  editorial_status?: string | null;
  hard_gate_ready?: boolean | null;
  political_self_reported?: boolean | null;
  confusing?: boolean | null;
  esoteric?: boolean | null;
  subjective_or_composite?: boolean | null;
  stale_data?: boolean | null;
  poor_coverage?: boolean | null;
  duplicate_of?: string | null;
  effective_semantic_group?: string | null;
  semantic_audit_status?: string | null;
  semantic_audit_issues?: string[] | null;
  semantic_audit_warnings?: string[] | null;
};

const SOURCE_IDS: Record<string, DataSourceId> = {
  "World Bank": "worldbank",
  FAOSTAT: "faostat",
  "FAOSTAT Food Balances": "faostatfbs",
  WHO: "who",
  "UNESCO UIS": "unesco",
  ILOSTAT: "ilostat",
  "United Nations Statistics Division": "unsdg",
  "Natural Earth": "naturalearth",
  "UN Comtrade": "comtrade",
  "U.S. EIA": "eia",
  UNHCR: "unhcr",
  "UN Tourism": "untourism",
  "Pew Research Center": "pewreligion",
  "Smithsonian GVP": "smithsoniangvp",
  USGS: "usgs",
  "ESA WorldCover": "worldcover",
  HydroSHEDS: "hydrosheds",
  "Global Elevation": "elevation",
  "UNESCO World Heritage Centre": "unescoheritage",
  "FAO AQUASTAT": "aquastat",
  "USGS Minerals": "usgsminerals",
  "FAO Fisheries": "faofisheries",
  "United Nations": "unmembership",
  "Constitute Project": "constitute",
  "Inter-Parliamentary Union": "ipu",
  "United Nations Population Division": "unwpp",
  "World Bank Climate Change Knowledge Portal": "worldbankclimate",
  "International Monetary Fund": "imfweo",
  "UNESCO": "unescoich",
  "NOAA National Centers for Environmental Information": "noaatsunami",
  FIFA: "fifa",
  "International Olympic Committee": "ioc",
  "FAO": "faofra2025",
  "UNICEF": "unicefdata",
  "UNDP": "undphdr",
  "V-Dem Institute": "vdemv16",
  "Beck et al.": "koppengeiger",
  "World Bank WDI Infrastructure & Connectivity": "worldbankinfra",
  "FAOSTAT Land Use": "faostatlanduse",
  "FAOSTAT / ESA WorldCover 2021": "faostatworldcover",
  "World Bank Women, Business and the Law 2026": "worldbankwbl",
  "WHO/UNICEF Joint Monitoring Programme": "jmpwash",
};

const FAMILY_ICONS: Record<string, string> = {
  Agriculture: "🌾", Climate: "🌦️", Crops: "🌾", Dairy: "🥛", Displacement: "🧳",
  Economy: "💰", Education: "🎓", Energy: "⚡", Environment: "🌍", Fruit: "🍎",
  Geography: "🗺️", Government: "🏛️", Health: "⚕️", Infrastructure: "🏗️",
  Knowledge: "📚", Labor: "👷", Land: "🌲", Livestock: "🐄", Population: "👥",
  Technology: "💻", Trade: "📦", Transport: "✈️", Vaccination: "💉", Religion: "🕊️",
  Geology: "🌋", "Food consumption": "🍽️", Hazards: "🌎", "Land cover": "🌿", Terrain: "⛰️", Vegetables: "🥕", History: "🕰️",
};

const HARD_RETIRED_CATEGORY_IDS = new Set([
  "exports",
  "imports",
  "exportsShare",
  "worldbank-catalog:bx-gsr-gnfs-cd",
  "worldbank-catalog:bm-gsr-gnfs-cd",
  "worldbank-catalog:bx-gsr-totl-cd",
  "worldbank-catalog:bx-gsr-nfsv-cd",
  "worldbank-catalog:bm-gsr-nfsv-cd",
  "worldbank-catalog:bn-gsr-gnfs-cd",
  "worldbank-catalog:bx-gsr-cmcp-zs",
  "worldbank-catalog:bm-gsr-cmcp-zs",
  "worldbank-catalog:bx-gsr-ccis-zs",
  "worldbank-catalog:bx-gsr-ccis-cd",
  "worldbank-catalog:bx-gsr-tran-zs",
  "worldbank-catalog:bm-gsr-tran-zs",
  "worldbank-catalog:bx-gsr-trvl-zs",
  "worldbank-catalog:bm-gsr-trvl-zs",
  "pew-religion:jewish-share",
  "undp-hdr:gdi",
  "undp-hdr:gii",
  "undp-hdr:phdi",
  "worldbankclimate:coldest",
  "worldbankclimate:driest",
  "worldbankclimate:hottest",
  "worldbankclimate:wettest",
  "comtrade:most-sports-equipment-exported",
  "koppen-geiger:tropical-savanna-share",
  "natural-earth:largest-geographic-span",
  "natural-earth:largest-north-south-span",
  "natural-earth:largest-east-west-span",
  "natural-earth:farthest-from-equator",
  "natural-earth:most-separate-land-areas",
  "natural-earth:most-large-land-areas",
]);

/** Categories that must never remain in a current or newly published board. */
export function isHardRetiredCategoryId(id: string) {
  return HARD_RETIRED_CATEGORY_IDS.has(id);
}


const FINDEX_SUBGROUP_INDICATOR = /^FX\.OWN\.TOTL\.(YG|FE|MA|OL|40|60|PL|SO)\.ZS$/i;

const HARD_RETIRED_TITLE_PATTERNS = [
  /total reserves.*(?:minus|excluding) gold/i,
  /population in urban agglomerations? of more than 1 million/i,
  /employment[- ]to[- ]population/i,
  /output per worker/i,
  /labor[- ]income share/i,
  /account ownership.*financial institution.*mobile[- ]money.*young adults/i,
];

const PLAYER_TITLE_REWRITES: Array<[RegExp, string]> = [
  [/^Highest safely managed drinking[- ]water access$/i, "Best access to safe drinking water"],
  [/^Highest STEM graduate share$/i, "Most graduates in STEM"],
  [/^Largest potato exports$/i, "Most potato exports"],
  [/^Highest population in the largest city$/i, "Largest population in the largest city"],
  [/^Largest population in largest city$/i, "Largest population in the largest city"],
  [/^Largest poultry-meat exports$/i, "Largest poultry meat exports"],
  [/^Most forest$/i, "Largest forest area"],
  [/^Most stateless people$/i, "Largest stateless population"],
  [/^Largest stateless population residing in the country$/i, "Largest stateless population"],
  [/^Largest agriculture share of freshwater withdrawals$/i, "Largest share of freshwater withdrawals used by agriculture"],
  [/^Highest carbon dioxide \(CO2\) emissions from Power Industry \(Energy\)$/i, "Highest CO₂ emissions from power generation"],
  [/^Highest total greenhouse gas emissions excluding LULUCF per capita$/i, "Highest greenhouse-gas emissions per person"],
  [/^Largest combustible-renewables-and-waste share of energy use$/i, "Largest share of energy from biomass and waste"],
  [/^Highest bird species, threatened$/i, "Most threatened bird species"],
  [/^Highest fish species, threatened$/i, "Most threatened fish species"],
  [/^Highest health spending share$/i, "Highest health-spending share of GDP"],
  [/^Highest farmland share$/i, "Largest share of land used for agriculture"],
  [/^Highest clean-cooking-fuel access$/i, "Highest share using clean cooking fuels"],
];

// These overrides are the player-facing catalog contract. Source refreshes may
// restore technical source labels, but they must never change reviewed copy or
// cause SQL-approved categories to disappear only at runtime.
const PLAYER_TITLE_OVERRIDES: Record<string, string> = {
  agLand: "Highest % of land used for agriculture",
  arablePct: "Highest % of land that is arable",
  education: "Highest education spending as % of GDP",
  forestPct: "Highest % of land covered by forest",
  healthSpendShare: "Highest health spending as % of GDP",
  protected: "Highest % of land protected",
  "natural-earth:highest-mapped-glaciated-share": "Highest % of land covered by glaciers",
  "natural-earth:highest-mapped-lake-share": "Highest % of land covered by lakes and reservoirs",
  "pew-religion:hindu-share": "Highest % of population that is Hindu",
  "unwpp:highest-male-share": "Highest % of population that is male",
  "worldbank-catalog:ag-lnd-crop-zs": "Highest % of land in permanent crops",
  "worldbank-catalog:bx-trf-pwkr-dt-gd-zs": "Highest money sent home from abroad as % of GDP",
  "worldbank-catalog:eg-elc-fosl-zs": "Highest % of electricity from fossil fuels",
  "worldbank-catalog:eg-elc-hyro-zs": "Highest % of electricity from hydropower",
  "worldbank-catalog:eg-elc-ngas-zs": "Highest % of electricity from natural gas",
  "worldbank-catalog:eg-elc-petr-zs": "Highest % of electricity from oil",
  "worldbank-catalog:eg-use-comm-cl-zs": "Highest % of energy from alternative and nuclear sources",
  "worldbank-catalog:eg-use-crnw-zs": "Highest % of energy from biomass and waste",
  "worldbank-catalog:en-ghg-co2-pi-mt-ce-ar5": "Most CO₂ emissions from power generation",
  "worldbank-catalog:en-urb-lcty-ur-zs": "Highest % of urban residents living in the largest city",
  "worldbank-catalog:en-urb-mcty-tl-zs": "Highest % of people in cities over one million",
  "worldbank-catalog:er-h2o-fwag-zs": "Highest % of freshwater withdrawals used by agriculture",
  "worldbank-catalog:er-h2o-fwdm-zs": "Highest % of freshwater withdrawals used by households",
  "worldbank-catalog:er-h2o-fwin-zs": "Highest % of freshwater withdrawals used by industry",
  "worldbank-catalog:er-mrn-ptmr-zs": "Highest % of territorial waters protected",
  "worldbank-catalog:fx-own-totl-zs": "Highest % of adults with a financial or mobile money account",
  "worldbank-catalog:gc-tax-totl-gd-zs": "Highest tax revenue as % of GDP",
  "worldbank-catalog:ms-mil-xpnd-zs": "Highest military spending as % of government spending",
  "faostat-qcl-apricots-production-01343-5510-t": "Most apricots produced",
  "faostat-qcl-avocados-production-01311-5510-t": "Most avocados produced",
  "faostat-qcl-papayas-production-01317-5510-t": "Most papayas produced",
  "faostat-qcl-pineapples-production-01318-5510-t": "Most pineapples produced",
  "faostat-qcl-pulses-total-production-f1726-5510-t": "Most pulses produced",
};

function metadataString(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function metadataBoolean(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function sourceIndicatorKey(source: DataSourceId, indicator: string, direction: Category["direction"]) {
  return `${source}|${indicator}|${direction}`;
}

function staticIndicator(category: Category) {
  return category.warehouseSourceIndicatorCode ?? category.indicator;
}

function staticMatchMaps() {
  const byId = new Map(CATEGORIES.map((category) => [category.id, category]));
  const byIndicator = new Map<string, Category>();
  for (const category of CATEGORIES) {
    const key = sourceIndicatorKey(category.source, staticIndicator(category), category.direction);
    if (!byIndicator.has(key)) byIndicator.set(key, category);
  }
  return { byId, byIndicator };
}

function playerFacingTitle(row: PlayableCategoryRow) {
  const override = PLAYER_TITLE_OVERRIDES[row.id];
  if (override) return override;
  if (row.source_organization === "FAOSTAT Food Balances") {
    const base = row.title
      .replace(/^(?:Most|Highest)\s+/i, "")
      .replace(/^estimated\s+/i, "")
      .replace(/\s+(?:available|supplied|consumed|consumption|intake) per person$/i, "")
      .trim();
    if (/calories?/i.test(base)) return "Highest estimated calorie intake per person";
    if (/protein/i.test(base)) return "Highest estimated protein intake per person";
    const singular = base
      .replace(/^eggs$/i, "egg")
      .replace(/^potatoes$/i, "potato")
      .replace(/^bananas$/i, "banana")
      .replace(/^tomatoes$/i, "tomato")
      .replace(/^onions$/i, "onion")
      .replace(/^vegetables$/i, "vegetable")
      .replace(/^pulses$/i, "pulse")
      .replace(/^wheat products$/i, "wheat-product")
      .replace(/^dairy products$/i, "dairy-product");
    return `Highest estimated ${singular.toLowerCase()} consumption per person`;
  }
  for (const [pattern, replacement] of PLAYER_TITLE_REWRITES) {
    if (pattern.test(row.title)) return replacement;
  }
  return row.title.trim();
}

function cardDescriptionWithoutTerminalPeriod(value: string) {
  return value.replace(/[.]\s*$/, "").trim();
}

function firstCompleteSentence(value: string, maximum = 200) {
  const clean = value.replace(/\s+/g, " ").trim().replace(/(?:…|\.\.\.)\s*$/, "");
  if (!clean) return "Compare the official country value for this measure.";
  const sentences = clean.match(/[^.!?]+[.!?]/g) ?? [];
  const complete = sentences.find((sentence) => sentence.trim().length <= maximum);
  if (complete) return complete.trim();
  if (clean.length <= maximum) return /[.!?]$/.test(clean) ? clean : `${clean}.`;
  return "Compare the official country value for this measure.";
}

function generatedBoardDescription(row: PlayableCategoryRow, title: string) {
  const measure = title.replace(/^(Highest|Lowest|Largest|Most|Fewest|Fastest|Best|Longest|Shortest|Oldest|Youngest|Latest)\s+/i, "").trim();
  const unit = String(row.unit ?? "").replace(/\s+/g, " ").trim();
  const usableUnit = unit && !/^(other|reported value|value)$/i.test(unit);
  const subject = measure ? `${measure[0].toUpperCase()}${measure.slice(1)}` : "Country value";
  const candidates = usableUnit
    ? [`${subject}, measured as ${unit}.`, `Measured as ${unit}.`]
    : [`${subject} for the reference year.`];
  return candidates.find((candidate) => candidate.length <= 82)
    ?? "Official country value in the source's stated units.";
}

function boardDescription(row: PlayableCategoryRow, title: string, existing?: Category) {
  if (row.source_organization === "FAOSTAT Food Balances") {
    return title.includes("calorie") || title.includes("protein")
      ? "Estimated from national food-balance data; not measured household intake."
      : "Estimated consumption from national food-balance data; not measured household intake.";
  }
  if (/^Largest poultry meat exports$/i.test(title)) return "Annual value of poultry meat exported by each country.";
  if (/^Largest forest area$/i.test(title)) return "Total land area covered by forest.";
  if (/^Largest spice exports$/i.test(title)) return "Annual value of spices exported by each country.";
  if (/^Largest stateless population$/i.test(title)) return "Number of stateless people reported as living in each country.";
  if (/computer[- ]chip|semiconductor/i.test(title)) return "Annual value of computer chips exported by each country.";
  if (/greenhouse-gas emissions per person/i.test(title)) return "Greenhouse-gas emissions per person, excluding land-use and forestry emissions.";
  if (/biomass and waste/i.test(title)) return "Share of total energy use supplied by combustible renewables and waste.";
  if (/freshwater withdrawals used by agriculture/i.test(title)) return "Share of total freshwater withdrawals used by agriculture.";
  if (/CO₂ emissions from power generation/i.test(title)) return "Carbon-dioxide emissions from electricity and heat production.";
  const metadata = row.metadata ?? {};
  const explicit = metadataString(metadata, "boardDescription") ?? existing?.boardDescription;
  if (explicit) return firstCompleteSentence(explicit);
  const plain = row.plain_language_description?.trim() || existing?.plainLanguageDescription || row.description;
  const sentence = firstCompleteSentence(plain);
  if (sentence !== "Compare the official country value for this measure.") return sentence;
  return generatedBoardDescription(row, title);
}

function copyClarityAllowed(row: PlayableCategoryRow, title: string) {
  const clean = title.replace(/\s+/g, " ").trim();
  const words = clean.match(/[A-Za-z0-9]+(?:[-’'][A-Za-z0-9]+)*/g) ?? [];
  const commas = (clean.match(/,/g) ?? []).length;
  const nestedFindex = /account ownership.*financial institution.*mobile[- ]money.*(?:young adults|ages? 15[-–]24)/i.test(clean);
  const description = [
    metadataString(row.metadata, "boardDescription"),
    row.plain_language_description,
    row.description,
  ].filter(Boolean).join(" ").trim();
  const genericDescription = !description || /^(?:compare countries using|compare the official country value|official country value for this measure)/i.test(description);
  const internalTitle = /(^|[^a-z])(mapped|reported value|indicator code|source-family|merchandise|intangible cultural heritage|SNA|BoP)([^a-z]|$)/i.test(clean);
  const percentage = String(row.value_type ?? "").toLowerCase() === "percentage";
  const total = String(row.value_type ?? "").toLowerCase() === "total";
  if (nestedFindex) return false;
  if (internalTitle || /(^|[^a-z])share([^a-z]|$)/i.test(clean)) return false;
  if (total && /^Highest\s/i.test(clean)) return false;
  if (percentage && /^(Most|Largest)\s/i.test(clean)) return false;
  if (clean.length > 96 || words.length > 16) return false;
  if (clean.length > 82 && commas >= 2) return false;
  if (genericDescription && clean.length > 68) return false;
  return true;
}

function playerFacingIcon(row: PlayableCategoryRow, existing?: Category) {
  const copy = `${row.title} ${row.short_title ?? ""} ${row.description ?? ""}`.toLowerCase();
  // v16.2.5: prefer a semantically correct neutral icon over a misleading
  // inherited emoji. Specific rules intentionally run before stored icons.
  if (/arms imports?/.test(copy)) return "🪖";
  if (/military (?:spending|expenditure)/.test(copy)) return row.unit === "USD" ? "🛡️" : "🪖";
  if (/tax[- ]?revenue/.test(copy)) return "🧾";
  if (/total country area/.test(copy)) return "🗺️";
  if (/greenhouse|methane|co2|carbon dioxide|carbon intensity/.test(copy)) return "🌫️";
  if (/donkey|asses/.test(copy)) return "🫏";
  if (/mule|hinny/.test(copy)) return "🐎";
  if (/cattle|buffalo/.test(copy)) return "🐄";
  if (/sheep/.test(copy)) return "🐑";
  if (/pig population|swine/.test(copy)) return "🐖";
  if (/pork/.test(copy)) return "🥓";
  if (/eggplant/.test(copy)) return "🍆";
  if (/egg/.test(copy)) return "🥚";
  if (/honey/.test(copy)) return "🍯";
  if (/almond|walnut|tree nut|peanut/.test(copy)) return "🥜";
  if (/apricot|peach|nectarine/.test(copy)) return "🍑";
  if (/pineapple|papaya/.test(copy)) return "🍍";
  if (/apple/.test(copy)) return "🍎";
  if (/avocado/.test(copy)) return "🥑";
  if (/cherr/.test(copy)) return "🍒";
  if (/coconut/.test(copy)) return "🥥";
  if (/lemon|lime/.test(copy)) return "🍋";
  if (/orange|mandarin|tangerine|grapefruit|pomelo/.test(copy)) return "🍊";
  if (/grapes?/.test(copy)) return "🍇";
  if (/mango/.test(copy)) return "🥭";
  if (/pear/.test(copy)) return "🍐";
  if (/strawberr/.test(copy)) return "🍓";
  if (/watermelon|melon/.test(copy)) return "🍉";
  if (/tomato/.test(copy)) return "🍅";
  if (/sweet potato/.test(copy)) return "🍠";
  if (/potato|cassava|roots and tubers/.test(copy)) return "🥔";
  if (/carrot/.test(copy)) return "🥕";
  if (/cucumber|gherkin/.test(copy)) return "🥒";
  if (/chili|pepper/.test(copy)) return "🌶️";
  if (/onion|shallot/.test(copy)) return "🧅";
  if (/mushroom|truffle/.test(copy)) return "🍄";
  if (/broccoli|cauliflower/.test(copy)) return "🥦";
  if (/cabbage|lettuce|vegetable/.test(copy)) return "🥬";
  if (/pumpkin|squash|gourd/.test(copy)) return "🎃";
  if (/corn|maize/.test(copy)) return "🌽";
  if (/rice/.test(copy)) return "🍚";
  if (/beans?|pulses?|peas|soybean/.test(copy)) return "🫘";
  if (/coffee/.test(copy)) return "☕";
  if (/beer/.test(copy)) return "🍺";
  if (/wine/.test(copy)) return "🍷";
  if (/cheese/.test(copy)) return "🧀";
  if (/butter|ghee/.test(copy)) return "🧈";
  if (/milk/.test(copy)) return "🥛";
  if (/cotton/.test(copy)) return "🧵";
  if (/sugar/.test(copy)) return "🍬";
  if (/sunflower|sesame/.test(copy)) return "🌻";
  if (/fig/.test(copy)) return "🧺";
  if (/plum|sloe/.test(copy)) return "🍑";
  if (/fruit (?:produced|production)/.test(copy)) return "🍎";
  if (/tobacco/.test(copy)) return "🚬";
  if (/agricultural land|land used for agriculture|permanent crops|arable land/.test(copy)) return "🚜";
  if (/calorie intake/.test(copy)) return "🍽️";
  if (/other religions|outside (?:the )?(?:five )?major groups/.test(copy)) return "🕯️";
  if (/largest lake/.test(copy)) return "🏞️";
  if (/vegetable oil/.test(copy)) return "🫙";
  if (/spice exports/.test(copy)) return "🫙";
  if (/computer[- ]chip|semiconductor/.test(copy)) return "⚙️";
  if (/territorial waters|marine protected|protected waters/.test(copy)) return "🌊";
  if (/forest/.test(copy)) return "🌲";
  if (/chicken|poultry/.test(copy)) return "🐔";
  if (/duck/.test(copy)) return "🦆";
  if (/turkey/.test(copy)) return "🦃";
  if (/camel/.test(copy)) return "🐪";
  if (/horse/.test(copy)) return "🐎";
  if (/goat/.test(copy)) return "🐐";
  if (/aquaculture|fish species|fish production/.test(copy)) return "🐟";
  if (/bird species/.test(copy)) return "🐦";
  if (/mammal species/.test(copy)) return "🐾";
  if (/vascular plant species/.test(copy)) return "🌿";
  if (/refugee|asylum|stateless|migrant population/.test(copy)) return "🧳";
  if (/hindu/.test(copy)) return "🕉️";
  if (/volcano/.test(copy)) return "🌋";
  if (/freshwater|water stress|water withdrawal/.test(copy)) return "💧";
  if (/health spending/.test(copy)) return "🏥";
  if (/sanitation/.test(copy)) return "🚰";
  if (/new[- ]business/.test(copy)) return "🏢";
  if (/international student|graduates? in stem/.test(copy)) return "🎓";
  if (/banana/.test(copy)) return "🍌";
  if (/wheat/.test(copy)) return "🌾";
  if (/touris|tourist/.test(copy)) return "✈️";
  if (/air freight/.test(copy)) return "✈️";
  if (/rainfall/.test(copy)) return "🌧️";
  if (/life expectancy/.test(copy)) return "❤️";
  if (/inflation/.test(copy)) return "📈";
  return row.icon?.trim() || existing?.icon || FAMILY_ICONS[row.family] || "📊";
}

function coverageFloor(row: PlayableCategoryRow, existing?: Category) {
  // Database playability remains authoritative. Runtime uses the legitimate
  // eligible-universe size only to determine whether a board can be assembled.
  const subset = row.eligible_universe_type === "defined_subset";
  const eligible = Number(row.eligible_country_count ?? existing?.eligibleCountryCount ?? 0);
  if (subset && Number.isFinite(eligible) && eligible > 0) return Math.max(12, Math.min(30, eligible));
  return 30;
}

function normalizedTrustStatus(value: string | null | undefined): TrustStatus | undefined {
  return value === "approved" || value === "caution" || value === "quarantined" ? value : undefined;
}

function normalizedEvidence(value: string | null | undefined): EvidenceLabel | undefined {
  const allowed: EvidenceLabel[] = [
    "Observed/administrative", "Internationally harmonized", "Modeled estimate",
    "Mixed observed and modeled", "Geospatially derived", "Independent bibliometric",
  ];
  return allowed.includes(value as EvidenceLabel) ? value as EvidenceLabel : undefined;
}


export function faostatMeasureAllowed(row: PlayableCategoryRow) {
  if (row.source_organization !== "FAOSTAT") return true;
  const code = String(row.source_indicator_code ?? "").replace(/'/g, "");
  const element = code.match(/:([0-9]+)$/)?.[1] ?? "";
  const copy = `${row.title} ${row.description ?? ""} ${row.plain_language_description ?? ""} ${row.technical_definition ?? ""} ${row.unit ?? ""}`.toLowerCase();
  const unit = String(row.unit ?? "").trim().toLowerCase();
  const blockedCopy = /yield|kg\/ha|tonnes?\/ha|per hectare|area harvested|harvested area|carcass|slaughter|per animal|output per animal|producing animals|milk animals|laying hens?/.test(copy);
  if (blockedCopy) return false;
  if (["5312", "5320", "5412", "5417"].includes(element)) return false;
  if (["5111", "5112"].includes(element)) {
    const livestockCopy = /population|stocks?/.test(copy);
    const animalUnit = /^(?:an|animals?|heads?|number)$/.test(unit) || /animals?|heads?/.test(unit);
    return livestockCopy && animalUnit;
  }
  if (["5510", "5513"].includes(element)) {
    return /produced|production/.test(copy) && !/population|stocks?/.test(copy);
  }
  // Unknown FAOSTAT QCL 5xxx measures fail closed. Non-QCL legacy rows are
  // allowed only when they do not look like a normalized productivity measure.
  if (/^5[0-9]{3}$/.test(element)) return false;
  return true;
}

function failsEditorialConceptGate(row: PlayableCategoryRow) {
  const copy = [row.title, row.description, row.plain_language_description, row.technical_definition]
    .filter(Boolean).join(" ");
  const title = playerFacingTitle(row);
  const worldBankIndicator = String(row.source_indicator_code ?? "").toUpperCase();
  const ownerRetiredServiceTrade = row.source_organization === "World Bank"
    && /^(BM|BX)\.GSR\./.test(worldBankIndicator)
    && !/^(BM|BX)\.GSR\.MRCH\./.test(worldBankIndicator);
  return HARD_RETIRED_CATEGORY_IDS.has(row.id)
    || ownerRetiredServiceTrade
    || FINDEX_SUBGROUP_INDICATOR.test(String(row.source_indicator_code ?? ""))
    || (row.source_organization === "UNESCO World Heritage Centre" && row.source_indicator_code !== "WHC:all-sites")
    || HARD_RETIRED_TITLE_PATTERNS.some((pattern) => pattern.test(copy))
    || !copyClarityAllowed(row, title);
}


function structuredMeasurementType(row: PlayableCategoryRow): Category["measurementType"] {
  const explicit = String(row.measurement_type ?? metadataString(row.metadata, "measurementType") ?? "").toLowerCase();
  if (["total", "share", "per_capita", "historical_date", "rate", "value", "other"].includes(explicit)) return explicit as Category["measurementType"];
  const text = `${row.value_type ?? ""} ${row.unit ?? ""}`.toLowerCase();
  if (/historical|admission date|constitution year|date adopted/.test(text)) return "historical_date";
  if (/per (person|capita)|per 100|per 1,000|per 100,000/.test(text)) return "per_capita";
  if (/%|percent|share/.test(text)) return "share";
  if (/rate|density|per (km|square|area|neighbor|unit)/.test(text)) return "rate";
  if (/index|score|magnitude|degrees|years|kilometers|meters/.test(text)) return "value";
  return "total";
}

function historicalValueFormat(row: PlayableCategoryRow): Category["historicalValueFormat"] {
  const value = metadataString(row.metadata, "historicalValueFormat") ?? metadataString(row.metadata, "historical_value_format");
  return value === "date" ? "date" : value === "year" ? "year" : undefined;
}
function structuredMeasureType(row: PlayableCategoryRow): Category["measureType"] {
  const metadata = row.metadata ?? {};
  if (structuredMeasurementType(row) === "historical_date") return "historical";
  const explicit = metadataString(metadata, "measureType") as Category["measureType"] | undefined;
  if (explicit) return explicit;
  const valueType = String(row.value_type ?? "").toLowerCase();
  const unit = String(row.unit ?? "").toLowerCase();
  if (valueType.includes("percent") || unit.includes("%") || unit.includes("percent")) return "share";
  if (valueType.includes("index") || unit.includes("index")) return "index";
  if (valueType.includes("rate") || unit.includes(" per ")) return "rate";
  if (valueType.includes("count") || unit.includes("people") || unit.includes("number")) return "count";
  if (unit.includes("km") || unit.includes("hectare") || unit.includes("ton") || unit.includes("meter")) return "physical";
  return "total";
}

function structuredNormalization(row: PlayableCategoryRow): Category["normalizationType"] {
  const metadata = row.metadata ?? {};
  const explicit = metadataString(metadata, "normalizationType") as Category["normalizationType"] | undefined;
  if (explicit) return explicit;
  const text = `${row.value_type ?? ""} ${row.unit ?? ""}`.toLowerCase();
  if (/per (person|capita)/.test(text)) return "per-person";
  if (/per (km|square|area|hectare)/.test(text)) return "per-area";
  if (/%|percent|share/.test(text)) return "percentage";
  if (/per 100|per 1,000|per 100,000|rate/.test(text)) return "rate";
  return "absolute";
}

type BuildOptions = {
  playableOnly?: boolean;
};

function resolvedSourceId(row: PlayableCategoryRow): DataSourceId | undefined {
  const slug = typeof row.metadata?.sourceSlug === "string" ? row.metadata.sourceSlug :
    (typeof row.metadata?.source_slug === "string" ? row.metadata.source_slug : undefined);
  const known = slug as DataSourceId | undefined;
  if (known && Object.prototype.hasOwnProperty.call(SOURCE_REGISTRY_COMPAT, known)) return known;
  // Dataset-specific disambiguation for organizations that host multiple GeoStats source families.
  const dataset = String(row.source_dataset || "").toLowerCase();
  if (row.source_organization === "United Nations Population Division" && dataset.includes("migrant stock")) return "undesamigrant";
  if (row.source_organization === "UN Tourism" && !dataset.includes("world development")) return "untourismdirect";
  if (row.source_organization === "World Bank" && dataset.includes("global findex")) return "globalfindex2025";
  if (row.source_organization === "World Bank" && dataset.includes("world development indicators") && /^MILESTONE:/i.test(row.source_indicator_code)) return "worldbankhistory";
  if (row.source_organization === "FAO" && dataset.includes("forest resources assessment")) return "faofra2025";
  if (row.source_organization === "FAO" && dataset.includes("food security")) return "faostatfoodsecurity";
  if (row.source_organization === "United Nations Department of Economic and Social Affairs, Population Division" && dataset.includes("cities")) return "unwupcities2025";
  if (row.source_organization === "United Nations Department of Economic and Social Affairs, Population Division" && dataset.includes("world urbanization prospects")) return "unwup2025";
  return SOURCE_IDS[row.source_organization];
}

// Compile-time/runtime allowlist mirroring DataSourceId. Kept local to avoid circular imports.
const SOURCE_REGISTRY_COMPAT: Record<string, true> = {
  worldbank:true,faostat:true,faostatfbs:true,who:true,unesco:true,untourism:true,naturalearth:true,comtrade:true,eia:true,unhcr:true,ilostat:true,unsdg:true,
  pewreligion:true,smithsoniangvp:true,usgs:true,worldcover:true,hydrosheds:true,elevation:true,unescoheritage:true,aquastat:true,usgsminerals:true,
  faofisheries:true,unmembership:true,constitute:true,ipu:true,unwpp:true,worldbankclimate:true,imfweo:true,unescoich:true,noaatsunami:true,
  whoghed:true,undesamigrant:true,wtoservices:true,untourismdirect:true,fifa:true,ioc:true,worldbankhistory:true,globalfindex2025:true,
  faofra2025:true,unicefdata:true,undphdr:true,vdemv16:true,faostatfoodsecurity:true,koppengeiger:true,worldbankinfra:true,faostatlanduse:true,
  faostatworldcover:true,worldbankwbl:true,jmpwash:true,unwup2025:true,unwupcities2025:true
};

export function buildCategoryCatalog(rows: PlayableCategoryRow[], options: BuildOptions = {}): Category[] {
  const { playableOnly = false } = options;
  const { byId, byIndicator } = staticMatchMaps();
  const catalog = new Map<string, Category>();

  for (const row of rows) {
    const source = resolvedSourceId(row);
    if (!source) continue;
    const existing = byId.get(row.id)
      ?? byIndicator.get(sourceIndicatorKey(source, row.source_indicator_code, row.ranking_direction));
    const metadata = row.metadata ?? {};
    const title = playerFacingTitle(row);
    const measurementType = structuredMeasurementType(row);
    const databasePlayable = (row.computed_playable_v16_2 ?? row.computed_playable_v16) === true;
    const playable = databasePlayable
      && (row.semantic_audit_status == null || row.semantic_audit_status === "pass")
      && !failsEditorialConceptGate(row)
      && faostatMeasureAllowed(row)
      && measurementType !== "other";
    if (playableOnly && databasePlayable && !playable) {
      throw new Error(`Catalog contract drift: SQL marked ${row.id} playable but the runtime safety gate rejected it.`);
    }
    if (playableOnly && !playable) continue;

    const category: Category = {
      ...(existing ?? {} as Category),
      id: existing?.id ?? row.id,
      source,
      dataset: row.source_dataset,
      name: title,
      // Cards should retain the direction word and reviewed player title. Raw
      // source short labels often drop “Highest/Lowest/Largest” or preserve
      // awkward source ordering, which makes the game prompt ambiguous.
      shortName: title,
      indicator: existing?.indicator ?? row.source_indicator_code,
      warehouseSourceIndicatorCode: row.source_indicator_code,
      icon: playerFacingIcon(row, existing),
      unit: row.unit || existing?.unit || "value",
      family: row.family,
      direction: row.ranking_direction,
      description: row.plain_language_description?.trim() || row.description || existing?.description || title,
      boardDescription: cardDescriptionWithoutTerminalPeriod(boardDescription(row, title, existing)),
      plainLanguageDescription: row.plain_language_description?.trim() || row.description || existing?.plainLanguageDescription,
      technicalDefinition: row.technical_definition?.trim() || existing?.technicalDefinition,
      unitExplanation: row.unit_explanation?.trim() || existing?.unitExplanation,
      certified: true,
      certificationGrade: Number(row.quality_score ?? 0) >= 85 ? "A" : "B",
      coverageFloor: coverageFloor(row, existing),
      globalCoverage: Number(row.common_year_coverage ?? existing?.globalCoverage ?? 0) || existing?.globalCoverage,
      commonYear: Number(row.common_year ?? existing?.commonYear ?? 0) || existing?.commonYear,
      eligibleUniverseType: row.eligible_universe_type === "defined_subset" ? "defined_subset" : (existing?.eligibleUniverseType ?? "universal"),
      eligibleUniverseRule: row.eligible_universe_rule || existing?.eligibleUniverseRule || "GeoStats canonical current-country universe",
      eligibleCountryCount: row.eligible_country_count == null ? (existing?.eligibleCountryCount ?? 195) : Number(row.eligible_country_count),
      eligibleCountryIds: row.eligible_country_iso3 ?? existing?.eligibleCountryIds,
      coverageWithinEligibleUniverse: row.coverage_within_eligible_universe == null
        ? (existing?.coverageWithinEligibleUniverse ?? (Number(row.common_year_coverage ?? 0) || undefined))
        : Number(row.coverage_within_eligible_universe),
      excludedCountryReason: row.excluded_country_reason || existing?.excludedCountryReason,
      enabled: playable,
      minimumYear: Math.max(1900, Number(row.minimum_year ?? existing?.minimumYear ?? 2022)),
      requireCommonYear: true,
      warehouseBacked: true,
      sourceUrl: row.source_url || existing?.sourceUrl,
      methodologyUrl: row.methodology_url || existing?.methodologyUrl,
      evidenceLabel: normalizedEvidence(row.evidence_label) ?? existing?.evidenceLabel,
      credibilityScore: row.credibility_score ?? (playable ? 80 : existing?.credibilityScore),
      trustStatus: normalizedTrustStatus(row.credibility_status) ?? (playable ? "approved" : existing?.trustStatus),
      trustReason: row.credibility_reason || existing?.trustReason,
      sourcePageUrl: row.source_page_url || existing?.sourcePageUrl,
      playerSourceUrl: row.player_source_url || existing?.playerSourceUrl,
      playerSourceStatus: (row.player_source_status as Category["playerSourceStatus"]) || existing?.playerSourceStatus,
      playerSourceReason: row.player_source_reason || existing?.playerSourceReason,
      playerSourceCheckedAt: row.player_source_checked_at || existing?.playerSourceCheckedAt,
      contentReviewStatus: (row.content_review_status as Category["contentReviewStatus"]) || existing?.contentReviewStatus,
      contentReviewReason: row.content_review_reason || existing?.contentReviewReason,
      contentReviewVersion: row.content_review_version || existing?.contentReviewVersion,
      immediateComprehensionScore: row.immediate_comprehension_score ?? existing?.immediateComprehensionScore,
      gameplayInterestScore: row.gameplay_interest_score ?? existing?.gameplayInterestScore,
      uniquenessScore: row.uniqueness_score ?? existing?.uniquenessScore,
      linkQualityScore: row.link_quality_score ?? existing?.linkQualityScore,
      exactQueryUrl: row.exact_query_url || existing?.exactQueryUrl,
      downloadUrl: row.download_url || existing?.downloadUrl,
      apiUrl: row.api_url || existing?.apiUrl,
      datasetRelease: row.dataset_release || existing?.datasetRelease,
      referenceLabel: metadataString(metadata, "referenceLabel") || metadataString(metadata, "reference_label") || existing?.referenceLabel,
      showObservationYear: metadataBoolean(metadata, "showObservationYear") ?? metadataBoolean(metadata, "show_observation_year") ?? existing?.showObservationYear ?? true,
      retrievedAt: row.retrieved_at || existing?.retrievedAt,
      licenseName: row.license_name || existing?.licenseName,
      licenseUrl: row.license_url || existing?.licenseUrl,
      sourceQuery: row.source_query ?? existing?.sourceQuery,
      derivationMethod: row.derivation_method || existing?.derivationMethod,
      derivationVersion: row.derivation_version || existing?.derivationVersion,
      inputDatasets: row.input_datasets ?? existing?.inputDatasets,
      verifiabilityScore: row.verifiability_score ?? existing?.verifiabilityScore,
      verifiabilityStatus: row.verifiability_status || existing?.verifiabilityStatus,
      understandabilityScore: row.understandability_score ?? existing?.understandabilityScore,
      funScore: row.fun_score ?? existing?.funScore,
      objectiveStatus: (row.objective_status as Category["objectiveStatus"]) ?? existing?.objectiveStatus,
      playerQualityStatus: (row.player_quality_status as Category["playerQualityStatus"]) ?? existing?.playerQualityStatus,
      playerQualityReason: row.player_quality_reason || existing?.playerQualityReason,
      roundType: existing?.roundType || metadataString(metadata, "roundType") || (source === "comtrade" ? "product-trade" : row.family),
      similarityGroup: existing?.similarityGroup || row.concept_group || metadataString(metadata, "similarityGroup") || `${source}:${row.source_indicator_code}`,
      semanticFamily: row.semantic_family || existing?.semanticFamily || metadataString(metadata, "semanticFamily"),
      semanticTopic: row.semantic_topic || existing?.semanticTopic || metadataString(metadata, "semanticTopic") || row.concept_group || undefined,
      strategyFamily: metadataString(metadata, "strategyFamily") || row.effective_semantic_group || row.semantic_family || existing?.strategyFamily,
      broadDomain: metadataString(metadata, "broadDomain") || existing?.broadDomain,
      knowledgeCluster: metadataString(metadata, "knowledgeCluster") || row.concept_group || existing?.knowledgeCluster,
      measureType: structuredMeasureType(row),
      normalizationType: structuredNormalization(row),
      measurementType,
      historicalValueFormat: historicalValueFormat(row),
      // Legacy field is never used for v16 eligibility.
      catalogTier: playable ? "daily" : "quarantined",
      productSpecificTrade: existing?.productSpecificTrade ?? source === "comtrade",
      rankingCompletenessStatus: (row.ranking_completeness_status as Category["rankingCompletenessStatus"]) || "unreviewed",
      rankingCompletenessReason: row.ranking_completeness_reason || undefined,
      topValueDistinctCount: row.top_value_distinct_count == null ? undefined : Number(row.top_value_distinct_count),
      topValueFeasible: row.top_value_feasible === true,
      playabilityWarnings: [
        ...(row.player_source_status === "general" ? ["General official source page only."] : []),
        ...(row.ranking_completeness_status === "top_end_complete" ? ["Ranking is top-end complete rather than fully comprehensive."] : []),
      ],
    };

    catalog.set(category.id, category);
  }

  return [...catalog.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildPlayableCategoryCatalog(rows: PlayableCategoryRow[], options: BuildOptions = {}) {
  return buildCategoryCatalog(rows, { ...options, playableOnly: true });
}

export function buildCategoryRegistry(rows: PlayableCategoryRow[]) {
  return buildCategoryCatalog(rows, { playableOnly: false });
}

let browserCatalogPromise: Promise<Category[]> | undefined;

export function fetchPlayableCategoryCatalog(options: { refresh?: boolean } = {}) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("The verified category catalog must be loaded by the server."));
  }
  if (!browserCatalogPromise || options.refresh) {
    browserCatalogPromise = fetch("/api/playable-categories", {
      cache: options.refresh ? "no-store" : "default",
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as { categories?: Category[]; error?: string };
        if (!response.ok || !payload.categories?.length) {
          throw new Error(payload.error || "The approved category catalog could not be loaded.");
        }
        return payload.categories;
      })
      .catch((error) => {
        browserCatalogPromise = undefined;
        throw error;
      });
  }
  return browserCatalogPromise;
}
