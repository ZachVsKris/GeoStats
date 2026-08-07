import type { Category } from "./categories";

export type CategoryMeasurementType = NonNullable<Category["measurementType"]>;

export function categoryMeasurementType(category: Category): CategoryMeasurementType {
  if (category.measurementType) return category.measurementType;
  if (category.normalizationType === "percentage" || category.measureType === "share") return "share";
  if (category.normalizationType === "per-person" || category.measureType === "rate") return "per_capita";
  if (category.measureType === "historical") return "historical_date";
  if (["total", "count", "physical"].includes(category.measureType ?? "")) return "total";
  return "other";
}

export function categoryMeasurementClass(category: Category): string {
  return `measure-${categoryMeasurementType(category).replaceAll("_", "-")}`;
}

export function categoryMeasurementLabel(category: Category): string {
  switch (categoryMeasurementType(category)) {
    case "share": return "Percentage / share";
    case "per_capita": return "Per-person / normalized rate";
    case "historical_date": return "Historical date";
    case "total": return "Total / absolute";
    default: return "Other measure";
  }
}
