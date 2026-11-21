import type { Category } from "./categories";

export type CategoryMeasurementType = NonNullable<Category["measurementType"]>;

export function categoryMeasurementType(category: Category): CategoryMeasurementType {
  if (category.measurementType) return category.measurementType;
  if (category.normalizationType === "percentage" || category.measureType === "share") return "share";
  if (category.normalizationType === "per-person") return "per_capita";
  if (category.measureType === "rate") return "rate";
  if (category.measureType === "historical") return "historical_date";
  if (category.measureType === "index") return "value";
  if (["total", "count", "physical"].includes(category.measureType ?? "")) return "total";
  return "value";
}

export function categoryMeasurementClass(category: Category): string {
  return `measure-${categoryMeasurementType(category).replaceAll("_", "-")}`;
}

export function categoryMeasurementLabel(category: Category): string {
  switch (categoryMeasurementType(category)) {
    case "share": return "Percentage / share";
    case "per_capita": return "Per-person / normalized rate";
    case "historical_date": return "Historical date";
    case "rate": return "Rate / density";
    case "value": return "Measured value / score";
    case "total": return "Total / absolute";
    default: return "Measured value";
  }
}

export function categoryMeasurementBadgeLabel(category: Category): string {
  switch (categoryMeasurementType(category)) {
    case "share": return "PERCENTAGE";
    case "per_capita": return "PER CAPITA";
    case "historical_date": return "DATE";
    case "rate": return "RATE";
    case "value": return "VALUE";
    case "total": return "TOTAL AMOUNT";
    default: return "VALUE";
  }
}

/** Compact, explicit units for category prompts; never infer units from a topic. */
export function categoryPromptUnit(category: Category): string {
  const unit = (category.unit || "").trim();
  const normalized = unit.toLowerCase();
  if (categoryMeasurementType(category) === "historical_date") return category.historicalValueFormat === "date" ? "date" : "year";
  if (/^(usd|usd\/person)$/.test(normalized) || /current us\$|current usd|u\.s\. dollars|us dollars/.test(normalized)) {
    return /person|capita/.test(normalized) ? "$/person" : "$";
  }
  const shortUnits: Record<string, string> = { "square kilometers": "km²", "square kilometres": "km²", "metric tons": "tonnes", "metric tonnes": "tonnes", "kilograms": "kg", "kilometers": "km", "kilometres": "km", "meters": "m", "metres": "m", "degrees celsius": "°C", "an": "animals" };
  if (["", "reported value", "value", "rate", "index"].includes(normalized)) return "";
  return shortUnits[normalized] ?? unit;
}
