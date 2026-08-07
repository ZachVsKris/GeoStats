import type { Category } from "./categories";

export type EditorialDecision = "keep" | "rewrite" | "retire" | "quarantine";
export type EditorialAssessment = { decision: EditorialDecision; playerTitle: string; reason: string };

const TITLE_REWRITES: Array<[RegExp, string]> = [
  [/^Highest stocks traded,? total value$/i, "Most stock trading"],
  [/^Highest safely managed drinking[- ]water access$/i, "Best access to safe drinking water"],
  [/^Highest STEM graduate share$/i, "Most graduates in STEM"],
  [/^Highest protected[- ]land share$/i, "Most land protected"],
  [/^Largest population in urban agglomerations of more than 1 million$/i, "Most people in large cities"],
  [/^Largest combined surface water$/i, "Most inland water"],
  [/^Highest surface water share$/i, "Most land covered by water"],
  [/^Largest forest area$/i, "Most forest"],
  [/^Highest forest coverage$/i, "Most forested"],
  [/^Largest glaciated area$/i, "Most glacier-covered land"],
  [/^Highest mapped river density$/i, "Highest river density"],
];

const HARD_RETIRE = [
  /total reserves.*minus gold/i,
  /reserves excluding gold/i,
  /net errors and omissions/i,
  /deflator/i,
  /claims on central government/i,
  /gross national expenditure/i,
  /urban agglomerations of more than 1 million/i,
];

const NEEDS_PLAIN_LANGUAGE_REVIEW = [
  /constant 20\d\d us\$/i,
  /current lcu/i,
  /index 20\d\d\s*=\s*100/i,
  /employment-to-population/i,
  /labor income share/i,
  /output per worker/i,
  /urban agglomeration/i,
  /relevant population/i,
  /merchandise trade as a share/i,
  /\betc\./i,
  /\bn\.e\.c\./i,
];

function faostatElement(category: Category) {
  const raw = `${category.warehouseSourceIndicatorCode ?? ""} ${category.indicator ?? ""}`;
  return raw.match(/QCL:'?[^:]+:(\d+)/i)?.[1] ?? null;
}

export function assessCategoryEditorially(category: Category): EditorialAssessment {
  const title = category.name?.trim() || category.shortName?.trim() || category.id;
  const searchable = `${title} ${category.description ?? ""} ${category.indicator ?? ""}`;
  const indicator = String(category.warehouseSourceIndicatorCode ?? category.indicator ?? "");
  if (/^FX\.OWN\.TOTL\.YG\.ZS$/i.test(indicator)) {
    return { decision: "retire", playerTitle: title, reason: "The young-adult combined-provider Findex variant is too qualified for a game card; retain the clear all-adults measure." };
  }
  if (/^FX\.OWN\.TOTL\.(FE|MA|OL|40|60|PL|SO)\.ZS$/i.test(indicator)) {
    return { decision: "quarantine", playerTitle: title, reason: "This Findex subgroup requires a shorter and genuinely distinct player concept before approval." };
  }

  if (category.source === "faostat") {
    const element = faostatElement(category);
    const unit = String(category.unit ?? "").trim().toLowerCase();
    const copy = `${title} ${category.description ?? ""} ${category.technicalDefinition ?? ""}`.toLowerCase();
    const productivity = /yield|kg\/ha|tonnes?\/ha|per hectare|harvested area|area harvested|carcass|slaughter|per animal|output per animal|producing animals|milk animals|laying hens?/.test(copy);
    if (productivity || ["5312", "5320", "5412", "5417"].includes(element ?? "")) {
      return {
        decision: "retire",
        playerTitle: title,
        reason: `FAOSTAT element ${element ?? "unknown"} is a yield, area, slaughter, carcass, or productivity measure rather than an intuitive national total.`,
      };
    }
    if (element === "5111") {
      const looksLikePopulation = /population|stocks?/.test(copy);
      const animalUnit = /^(?:an|animals?|heads?|number)$/.test(unit) || /animals?|heads?/.test(unit);
      if (!looksLikePopulation || !animalUnit) {
        return { decision: "quarantine", playerTitle: title, reason: "FAOSTAT livestock stocks require population wording and an animal-count unit." };
      }
    } else if (element && !["5510", "5513"].includes(element)) {
      return {
        decision: "retire",
        playerTitle: title,
        reason: `FAOSTAT element ${element} is not an approved production or livestock-population total.`,
      };
    }
  }

  if (HARD_RETIRE.some((pattern) => pattern.test(searchable))) {
    return {
      decision: "retire",
      playerTitle: title,
      reason: "The concept cannot be made intuitive without concealing a material technical qualification or rewarding statistical-definition knowledge.",
    };
  }

  for (const [pattern, replacement] of TITLE_REWRITES) {
    if (pattern.test(title)) {
      return {
        decision: "rewrite",
        playerTitle: replacement,
        reason: "The underlying concept is useful, but the source wording is not immediate or natural for players.",
      };
    }
  }

  if (
    NEEDS_PLAIN_LANGUAGE_REVIEW.some((pattern) => pattern.test(searchable))
    || title.length > 58
    || title.split(/\s+/).length > 8
  ) {
    return {
      decision: "quarantine",
      playerTitle: title,
      reason: "The measure may be valid, but its current wording is not clear enough for any gameplay mode.",
    };
  }

  return {
    decision: "keep",
    playerTitle: title,
    reason: "Concept and wording pass the immediate-understanding screen.",
  };
}
