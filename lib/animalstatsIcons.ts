import type { Trait } from "./animalstats";

/** Editorial icons identify the measurement, never the winning animal. */
export function animalTraitIcon(trait: Trait): string {
  const text = `${trait.metricKey ?? ""} ${trait.gameplayFamily ?? ""} ${trait.id}`;
  if (/lifespan|longevity/.test(text)) return "⏳";
  if (/cognition|cylinder/.test(text)) return "🧩";
  if (/ear-length|adult_ear/.test(text)) return "👂";
  if (/mass|weight/.test(text)) return "⚖️";
  if (/offspring|litter/.test(text)) return "🍼";
  if (/clutch|incubation/.test(text)) return "🥚";
  if (/height|length|size|span/.test(text)) return "📏";
  if (/speed|locomotion|travel/.test(text)) return "💨";
  if (/range|geograph|habitat/.test(text)) return "🌍";
  if (/diet|food|prey/.test(text)) return "🍽️";
  if (/gestation|reproduc|clutch|litter|egg|maturity/.test(text)) return "🍼";
  if (/sleep/.test(text)) return "💤";
  if (/hibernation/.test(text)) return "💤";
  if (/conservation|threat/.test(text)) return "🛡️";
  if (/dive|depth/.test(text)) return "🌊";
  if (/bite|strength/.test(text)) return "💪";
  if (/history|age|describ/.test(text)) return "📜";
  if (/brain|intelligen/.test(text)) return "🧠";
  if (/heart|metabolic/.test(text)) return "❤️";
  if (/sense|hear|sight/.test(text)) return "👁️";
  return "🐾";
}
