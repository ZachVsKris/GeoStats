import "server-only";

import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "./supabase/server";
import {
  inspectStoredTrio,
  loadLatestCompleteFallback,
  packStoredRows,
  readDailyRows,
  type PackedDailyTrio,
} from "./dailyBoardService";
import { dailyTrioPreferenceWarnings, type DailyTrioLike } from "./dailyTrioRules";
import { DATASET_VERSION, PLAYER_COPY_VERSION } from "./version";
import type { DailyApiPayload } from "./dailyPublicPayload";
import { DAILY_DIFFICULTIES } from "./gameRules";
import { hydrateRoundSnapshotPlayerCopy } from "./challengeCodec";
import { loadServerPlayableCategoryCatalog } from "./serverPlayableCatalog";

async function hydrateCurrentPlayerCopy(boards: PackedDailyTrio) {
  try {
    const categoryCatalog = await loadServerPlayableCategoryCatalog();
    const hydrated: PackedDailyTrio = {};
    for (const difficulty of DAILY_DIFFICULTIES) {
      const board = boards[difficulty];
      if (!board) continue;
      hydrated[difficulty] = {
        ...board,
        board_payload: hydrateRoundSnapshotPlayerCopy(board.board_payload, categoryCatalog),
      };
    }
    return hydrated;
  } catch {
    // A self-contained Daily remains playable during a temporary catalog read
    // failure; the next cache fill will retry current-copy hydration.
    return boards;
  }
}

const loadCachedCompleteDaily = unstable_cache(
  async (date: string): Promise<DailyApiPayload> => {
    const admin = createSupabaseAdminClient();
    if (!admin) throw new Error("Supabase is not configured.");
    const stored = await readDailyRows(admin, date);
    if (stored.error) throw stored.error;
    const inspected = inspectStoredTrio(stored.rows);
    if (!inspected.complete) throw new Error("Daily trio is not complete.");
    const boards = await hydrateCurrentPlayerCopy(packStoredRows(stored.rows));
    return {
      found: true,
      generated: false,
      legacyModes: Object.keys(inspected.outdated),
      warning: Object.keys(inspected.outdated).length
        ? "This Daily keeps its original countries, values, rules, and scoring; category wording reflects the current reviewed catalog."
        : undefined,
      preferenceWarnings: dailyTrioPreferenceWarnings(inspected.rounds as DailyTrioLike),
      ...boards,
    };
  },
  ["geostats-public-daily-trio-player-copy", DATASET_VERSION, PLAYER_COPY_VERSION],
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
  const boards = await hydrateCurrentPlayerCopy(fallback.boards);
  return {
    found: true,
    generated: false,
    fallback: true,
    fallback_date: fallback.date,
    warning: "Today’s Daily is unavailable, so this is an unranked practice board from an earlier date.",
    ...boards,
  };
}
