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
    case "share": return "SHARE";
    case "per_capita": return "PER CAPITA";
    case "historical_date": return "DATE";
    case "rate": return "RATE";
    case "value": return "VALUE";
    case "total": return "TOTAL";
    default: return "VALUE";
  }
}
