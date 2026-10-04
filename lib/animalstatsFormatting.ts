/** Display conversions only; source observations and CSV values keep their exact units. */
export function formatAnimalValue(value: number, unit: string) {
  if (unit === "IUCN category") return ["", "Least Concern", "Near Threatened", "Vulnerable", "Endangered", "Critically Endangered", "Extinct in the Wild", "Extinct"][value] ?? "Unknown category";
  let number = value, shownUnit = unit;
  if (unit === "g" && value >= 1000) { number = value / 1000; shownUnit = "kg"; }
  else if (unit === "g" && value < 0.1) { number = value * 1000; shownUnit = "mg"; }
  const shown = new Intl.NumberFormat("en-US", number < 0.01 ? { maximumSignificantDigits: 3 } : { maximumFractionDigits: number < 10 ? 2 : 1 }).format(number);
  return `${shown} ${shownUnit}`;
}
