import "server-only";

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "./supabase/server";
import {
  inspectStoredTrio,
  loadLatestCompleteFallback,
  packStoredRows,
  readDailyRows,
} from "./dailyBoardService";
import { dailyTrioPreferenceWarnings, type DailyTrioLike } from "./dailyTrioRules";
import { DATASET_VERSION } from "./version";
import type { DailyApiPayload } from "./dailyPublicPayload";

const loadCachedCompleteDaily = unstable_cache(
  async (date: string): Promise<DailyApiPayload> => {
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase is not configured.");
    const stored = await readDailyRows(admin, date);
    if (stored.error) throw stored.error;
    const inspected = inspectStoredTrio(stored.rows);
    if (!inspected.complete) throw new Error("Daily trio is not complete.");
    return {
      found: true,
      generated: false,
      legacyModes: Object.keys(inspected.outdated),
      warning: Object.keys(inspected.outdated).length
        ? "This valid Daily board is preserved under the rules and category set with which it was generated."
        : undefined,
      preferenceWarnings: dailyTrioPreferenceWarnings(inspected.rounds as DailyTrioLike),
      ...packStoredRows(stored.rows),
    };
  },
  ["geostats-public-daily-trio", DATASET_VERSION],
  { revalidate: 24 * 60 * 60, tags: ["geostats-daily-trio"] },
);

export async function loadPublicDailyPayload(date: string): Promise<DailyApiPayload | null> {
  try {
    return await loadCachedCompleteDaily(date);
  } catch {
    // Never cache an unpublished or malformed board as today's result. A short-lived
    // practice fallback remains a direct database read and is explicitly no-store.
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const fallback = await loadLatestCompleteFallback(admin, date);
  if (!fallback) return null;
  return {
    found: true,
    generated: false,
    fallback: true,
    fallback_date: fallback.date,
    warning: "Today’s Daily is unavailable, so this is an unranked practice board from an earlier date.",
    ...fallback.boards,
  };
}
