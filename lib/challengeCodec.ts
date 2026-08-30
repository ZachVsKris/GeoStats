import { CATEGORIES, type Category } from "./categories";
import { sourceUrl, validateRound, type CanonicalDataset } from "./dataEngine";
import { categoryMethodologyUrl } from "./sourceRegistry";
import type { CountryInfo } from "./worldBank";

export type RoundCategory = CanonicalDataset;
export type Round = { bank: CountryInfo[]; categories: RoundCategory[] };

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index++) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function checksum(bytes: Uint8Array, end = bytes.length) {
  let hash = 2166136261;
  for (let index = 0; index < end; index++) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function encodeRound(round: Round) {
  const categoryIds = round.categories.map((dataset) => dataset.category.id);
  const categoryCount = categoryIds.length;
  const countryCount = round.bank.length;
  if (!categoryCount || categoryCount > 255 || !countryCount || countryCount > 255) {
    throw new Error("This board has an unsupported number of categories or countries.");
  }
  const categoryByteLength = categoryIds.reduce((sum, id) => sum + 1 + id.length, 0);
  const observationByteLength = categoryCount * countryCount * (8 + 1 + 1);
  const bytes = new Uint8Array(3 + categoryByteLength + countryCount * 3 + observationByteLength + 4);
  const view = new DataView(bytes.buffer);
  let offset = 0;
  view.setUint8(offset++, 3);
  view.setUint8(offset++, categoryCount);
  view.setUint8(offset++, countryCount);

  for (const categoryId of categoryIds) {
    if (!/^[\x20-\x7E]+$/.test(categoryId) || categoryId.length > 255) {
      throw new Error("A category ID could not be encoded into the challenge link.");
    }
    view.setUint8(offset++, categoryId.length);
    for (const character of categoryId) view.setUint8(offset++, character.charCodeAt(0));
  }

  for (const country of round.bank) {
    if (!/^[A-Z0-9]{3}$/.test(country.id)) throw new Error(`${country.name} has an invalid country code.`);
    for (const character of country.id) view.setUint8(offset++, character.charCodeAt(0));
  }

  for (const dataset of round.categories) {
    for (const country of round.bank) {
      const observation = dataset.byCountry.get(country.id);
      if (!observation) throw new Error(`Missing ${country.name} data for ${dataset.category.name}.`);
      const year = Number(observation.year);
      if (!Number.isFinite(observation.value) || !Number.isInteger(year) || year < 2000 || year > 2255) {
        throw new Error(`${dataset.category.name} contains data that cannot be encoded.`);
      }
      if (!Number.isInteger(observation.globalRank) || observation.globalRank < 1 || observation.globalRank > 255) {
        throw new Error(`${dataset.category.name} contains a global rank that cannot be encoded.`);
      }
      view.setFloat64(offset, observation.value, false);
      offset += 8;
      view.setUint8(offset++, year - 2000);
      view.setUint8(offset++, observation.globalRank);
    }
  }

  view.setUint32(offset, checksum(bytes, offset), false);
  return bytesToBase64Url(bytes);
}

export function decodeRound(value: string, countryList: CountryInfo[], categoryCatalog: Category[] = CATEGORIES): Round {
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(value);
  } catch {
    throw new Error("This challenge link is incomplete or damaged.");
  }

  if (bytes.length < 20) throw new Error("This challenge link does not contain a complete board.");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const expectedChecksum = view.getUint32(bytes.length - 4, false);
  if (checksum(bytes, bytes.length - 4) !== expectedChecksum) {
    throw new Error("This challenge link was truncated or changed while being copied.");
  }

  let offset = 0;
  const formatVersion = view.getUint8(offset++);
  let categoryCount: number;
  let countryCount: number;
  if (formatVersion === 2) {
    categoryCount = 8;
    countryCount = 10;
  } else if (formatVersion === 3) {
    categoryCount = view.getUint8(offset++);
    countryCount = view.getUint8(offset++);
    if (!categoryCount || categoryCount > 20 || !countryCount || countryCount > 30) {
      throw new Error("This challenge link contains unsupported board dimensions.");
    }
  } else {
    throw new Error("This challenge link uses an unsupported board format.");
  }

  const categoryIds: string[] = [];
  for (let categoryIndex = 0; categoryIndex < categoryCount; categoryIndex++) {
    const length = view.getUint8(offset++);
    if (!length || offset + length > bytes.length - 4) throw new Error("This challenge contains an incomplete category list.");
    let categoryId = "";
    for (let index = 0; index < length; index++) categoryId += String.fromCharCode(view.getUint8(offset++));
    categoryIds.push(categoryId);
  }
  if (new Set(categoryIds).size !== categoryCount) throw new Error("This challenge repeats a category.");

  const countryIds: string[] = [];
  for (let countryIndex = 0; countryIndex < countryCount; countryIndex++) {
    if (offset + 3 > bytes.length - 4) throw new Error("This challenge contains an incomplete country list.");
    let countryId = "";
    for (let index = 0; index < 3; index++) countryId += String.fromCharCode(view.getUint8(offset++));
    countryIds.push(countryId);
  }
  if (new Set(countryIds).size !== countryCount) throw new Error("This challenge repeats a country.");
  if (offset + categoryCount * countryCount * 10 !== bytes.length - 4) {
    throw new Error("This challenge contains an unexpected amount of board data.");
  }

  const categoryById = new Map(categoryCatalog.map((category) => [category.id, category]));
  const countryById = new Map(countryList.map((country) => [country.id, country]));
  const bank = countryIds.map((id) => countryById.get(id));
  if (bank.some((country) => !country)) throw new Error("This challenge includes a country that is no longer available.");
  const exactBank = bank.filter((country): country is CountryInfo => Boolean(country));

  const categories = categoryIds.map((categoryId): RoundCategory => {
    const category = categoryById.get(categoryId);
    if (!category) throw new Error("This challenge includes a category that is no longer available.");
    const ranked = exactBank.map((country) => {
      const value = view.getFloat64(offset, false);
      offset += 8;
      const year = 2000 + view.getUint8(offset++);
      const globalRank = view.getUint8(offset++);
      if (!Number.isFinite(value) || globalRank < 1) throw new Error("This challenge contains invalid ranking data.");
      return {
        countryId: country.id,
        countryName: country.name,
        value,
        year: String(year),
        globalRank,
      };
    }).sort((a, b) => category.direction === "high" ? b.value - a.value : a.value - b.value);

    return {
      category,
      observations: ranked.map(({ globalRank: _globalRank, ...observation }) => observation),
      year: ranked.map((row) => row.year).sort().reverse()[0] ?? "",
      ranked,
      byCountry: new Map(ranked.map((row) => [row.countryId, row])),
      sourceUrl: category.sourceUrl ?? sourceUrl(category.indicator, category.source),
      methodologyUrl: category.methodologyUrl ?? categoryMethodologyUrl(category.source, category.indicator),
      evidenceLabel: category.evidenceLabel,
      credibilityScore: category.credibilityScore,
      trustStatus: category.trustStatus,
      trustReason: category.trustReason,
    };
  });

  const errors = validateRound(categories, exactBank);
  if (errors.length) throw new Error(`This challenge link is inconsistent: ${errors[0]}`);
  return { bank: exactBank, categories };
}

/**
 * Immutable JSON snapshot stored with official Daily and server-generated
 * Random boards. It lets a saved board survive later catalog renames,
 * quarantines, and duplicate decisions.
 */
export type RoundSnapshot = {
  version: 1;
  bank: CountryInfo[];
  categories: Array<{
    category: Category;
    year: string;
    ranked: Array<{
      countryId: string;
      countryName: string;
      value: number;
      year: string;
      globalRank: number;
    }>;
    sourceUrl?: string;
    methodologyUrl?: string;
    sourcePageUrl?: string;
    playerSourceUrl?: string;
    playerSourceStatus?: string;
    playerSourceReason?: string;
    playerSourceCheckedAt?: string;
    evidenceLabel?: string;
    credibilityScore?: number;
    trustStatus?: string;
    trustReason?: string;
  }>;
};

/**
 * Refresh only player-facing metadata on an immutable saved board. Countries,
 * values, years, ranks, category IDs, ranking direction, and source identity
 * stay frozen so historical scoring and same-day restoration remain exact.
 */
export function hydrateRoundSnapshotPlayerCopy(snapshot: RoundSnapshot, categoryCatalog: Category[]): RoundSnapshot {
  const currentById = new Map(categoryCatalog.map((category) => [category.id, category]));
  return {
    ...snapshot,
    bank: snapshot.bank.map((country) => ({ ...country })),
    categories: snapshot.categories.map((item) => {
      const current = currentById.get(item.category.id);
      if (!current) return { ...item, category: { ...item.category }, ranked: item.ranked.map((row) => ({ ...row })) };
      return {
        ...item,
        category: {
          ...item.category,
          name: current.name,
          shortName: current.shortName,
          description: current.description,
          boardDescription: current.boardDescription,
          plainLanguageDescription: current.plainLanguageDescription,
          technicalDefinition: current.technicalDefinition,
          unitExplanation: current.unitExplanation,
          icon: current.icon,
          unit: current.unit,
          decimals: current.decimals,
          measurementType: current.measurementType,
          measureType: current.measureType,
          normalizationType: current.normalizationType,
          sourceUrl: current.sourceUrl,
          methodologyUrl: current.methodologyUrl,
          sourcePageUrl: current.sourcePageUrl,
          playerSourceUrl: current.playerSourceUrl,
          playerSourceStatus: current.playerSourceStatus,
          playerSourceReason: current.playerSourceReason,
          playerSourceCheckedAt: current.playerSourceCheckedAt,
        },
        ranked: item.ranked.map((row) => ({ ...row })),
        sourceUrl: current.sourceUrl ?? item.sourceUrl,
        methodologyUrl: current.methodologyUrl ?? item.methodologyUrl,
        sourcePageUrl: current.sourcePageUrl ?? item.sourcePageUrl,
        playerSourceUrl: current.playerSourceUrl ?? item.playerSourceUrl,
        playerSourceStatus: current.playerSourceStatus ?? item.playerSourceStatus,
        playerSourceReason: current.playerSourceReason ?? item.playerSourceReason,
        playerSourceCheckedAt: current.playerSourceCheckedAt ?? item.playerSourceCheckedAt,
        evidenceLabel: current.evidenceLabel ?? item.evidenceLabel,
        credibilityScore: current.credibilityScore ?? item.credibilityScore,
        trustStatus: current.trustStatus ?? item.trustStatus,
        trustReason: current.trustReason ?? item.trustReason,
      };
    }),
  };
}

export function serializeRound(round: Round): RoundSnapshot {
  return {
    version: 1,
    bank: round.bank.map((country) => ({ ...country })),
    categories: round.categories.map((dataset) => ({
      category: JSON.parse(JSON.stringify(dataset.category)) as Category,
      year: dataset.year,
      ranked: dataset.ranked
        .filter((row) => round.bank.some((country) => country.id === row.countryId))
        .map((row) => ({ ...row })),
      sourceUrl: dataset.sourceUrl,
      methodologyUrl: dataset.methodologyUrl,
      sourcePageUrl: dataset.sourcePageUrl,
      playerSourceUrl: dataset.playerSourceUrl,
      playerSourceStatus: dataset.playerSourceStatus,
      playerSourceReason: dataset.playerSourceReason,
      playerSourceCheckedAt: dataset.playerSourceCheckedAt,
      evidenceLabel: dataset.evidenceLabel,
      credibilityScore: dataset.credibilityScore,
      trustStatus: dataset.trustStatus,
      trustReason: dataset.trustReason,
    })),
  };
}

export function deserializeRound(snapshot: RoundSnapshot): Round {
  if (!snapshot || snapshot.version !== 1 || !Array.isArray(snapshot.bank) || !Array.isArray(snapshot.categories)) {
    throw new Error("This saved board snapshot is invalid.");
  }
  const bank = snapshot.bank.map((country) => ({ ...country }));
  const bankIds = new Set(bank.map((country) => country.id));
  if (!bank.length || bankIds.size !== bank.length) {
    throw new Error("This saved board snapshot repeats or omits countries.");
  }

  const categories: RoundCategory[] = snapshot.categories.map((item) => {
    if (!item.category?.id || !Array.isArray(item.ranked)) {
      throw new Error("This saved board snapshot contains an invalid category.");
    }
    const ranked = item.ranked
      .filter((row) => bankIds.has(row.countryId))
      .map((row) => ({ ...row }))
      .sort((left, right) => item.category.direction === "high"
        ? right.value - left.value
        : left.value - right.value);
    if (ranked.length !== bank.length) {
      throw new Error(`${item.category.name} is missing a country in the saved board snapshot.`);
    }
    return {
      category: { ...item.category },
      observations: ranked.map(({ globalRank: _rank, ...observation }) => observation),
      year: item.year,
      ranked,
      byCountry: new Map(ranked.map((row) => [row.countryId, row])),
      sourceUrl: item.sourceUrl ?? item.category.sourceUrl ?? sourceUrl(item.category.indicator, item.category.source),
      methodologyUrl: item.methodologyUrl ?? item.category.methodologyUrl ?? categoryMethodologyUrl(item.category.source, item.category.indicator),
      sourcePageUrl: item.sourcePageUrl ?? item.category.sourcePageUrl,
      playerSourceUrl: item.playerSourceUrl ?? item.category.playerSourceUrl,
      playerSourceStatus: item.playerSourceStatus ?? item.category.playerSourceStatus,
      playerSourceReason: item.playerSourceReason ?? item.category.playerSourceReason,
      playerSourceCheckedAt: item.playerSourceCheckedAt ?? item.category.playerSourceCheckedAt,
      evidenceLabel: item.evidenceLabel ?? item.category.evidenceLabel,
      credibilityScore: item.credibilityScore ?? item.category.credibilityScore,
      trustStatus: item.trustStatus ?? item.category.trustStatus,
      trustReason: item.trustReason ?? item.category.trustReason,
    };
  });

  const errors = validateRound(categories, bank);
  if (errors.length) throw new Error(`This saved board snapshot is inconsistent: ${errors[0]}`);
  return { bank, categories };
}
