import type { CanonicalDataset } from "./dataEngine";
import { SOURCE_REGISTRY } from "./sourceRegistry";

function queryObject(value: CanonicalDataset["sourceQuery"]) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function text(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    const values = value
      .map((item) => typeof item === "string" || typeof item === "number" ? String(item).trim() : "")
      .filter(Boolean);
    return values.length ? values.join("+") : null;
  }
  return null;
}

function first(query: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = text(query[key]);
    if (value) return value;
  }
  return null;
}

function titleMeasure(name: string) {
  const match = name.match(/^(Highest|Lowest|Largest|Most|Fastest)\s+(.+)$/i);
  return match?.[2] ?? name;
}

export type SourceSpecification = {
  sourceName: string;
  indicatorCode: string;
  chips: string[];
};

/** Player-readable, reproducible description of the exact source series. */
export function sourceSpecification(dataset: CanonicalDataset): SourceSpecification {
  const category = dataset.category;
  const query = queryObject(dataset.sourceQuery ?? category.sourceQuery);
  const sourceName = category.source === "worldbank"
    ? "World Bank"
    : SOURCE_REGISTRY[category.source]?.name ?? category.source;
  const indicatorCode = category.warehouseSourceIndicatorCode || category.indicator;
  const chips: string[] = [sourceName];

  if (category.source === "faostat") {
    const item = first(query, ["item", "itemName"]);
    const element = first(query, ["element", "elementName"]);
    const itemCode = first(query, ["itemCode"]);
    const elementCode = first(query, ["elementCode"]);
    chips.push(item || titleMeasure(category.name));
    chips.push(element || (/yield/i.test(category.name) ? "Yield" : /production/i.test(category.name) ? "Production" : "QCL measure"));
    if (itemCode) chips.push(`Item ${itemCode}`);
    if (elementCode) chips.push(`Element ${elementCode}`);
  } else if (category.source === "comtrade") {
    const commodity = first(query, ["commodity", "commodityName", "cmdCode", "hsCode"]);
    const flow = first(query, ["flow", "flowCode"]);
    const partner = first(query, ["partner", "partnerCode"]);
    if (commodity) chips.push(`HS ${commodity}`);
    chips.push(flow === "X" || flow === "2" ? "Exports" : flow === "M" || flow === "1" ? "Imports" : flow ? `Flow ${flow}` : "Exports");
    chips.push(partner && partner !== "0" ? `Partner ${partner}` : "World partner");
  } else if (category.source === "naturalearth") {
    const layer = first(query, ["layer"]);
    const scale = first(query, ["scale"]);
    if (layer) chips.push(layer);
    if (scale) chips.push(scale);
    chips.push(category.referenceLabel || dataset.datasetRelease || "Natural Earth pinned release");
  } else if (category.source === "pewreligion") {
    chips.push(first(query, ["religiousGroup", "measure"]) || titleMeasure(category.name));
    chips.push(first(query, ["estimateType"]) || "Population estimate");
  } else if (category.source === "smithsoniangvp") {
    chips.push(first(query, ["volcanoWindow"]) || "Holocene volcanoes");
    const criterion = first(query, ["criterion", "measure"]);
    if (criterion) chips.push(criterion);
  } else if (category.source === "usgs") {
    const magnitude = first(query, ["minimumMagnitude"]);
    const start = first(query, ["startTime"]);
    const end = first(query, ["endTime"]);
    if (magnitude) chips.push(`Magnitude ${magnitude}+`);
    if (start && end) chips.push(`${start}–${end}`);
  } else if (category.source === "worldcover") {
    chips.push(first(query, ["landCoverClass", "measure"]) || titleMeasure(category.name));
    chips.push(first(query, ["release"]) || "WorldCover 2021");
  } else if (category.source === "hydrosheds") {
    chips.push(first(query, ["product", "layer"]) || "HydroSHEDS");
    const threshold = first(query, ["inclusionThreshold"]);
    if (threshold) chips.push(threshold);
  } else if (category.source === "elevation") {
    chips.push(first(query, ["grid", "release"]) || "Global elevation grid");
    const method = first(query, ["measure", "derivation"]);
    if (method) chips.push(method);
  } else {
    chips.push(indicatorCode);
  }

  const unit = first(query, ["unit"]) || category.unit;
  const year = category.showObservationYear === false
    ? null
    : first(query, ["year"]) || dataset.year;
  if (unit) chips.push(unit);
  if (year) chips.push(year);

  return {
    sourceName,
    indicatorCode,
    chips: [...new Set(chips.filter(Boolean))],
  };
}
