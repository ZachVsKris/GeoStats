import { revalidateTag } from "next/cache";
import { createHash } from "crypto";
import {
  decodeRound,
  deserializeRound,
  encodeRound,
  serializeRound,
  type Round,
  type RoundSnapshot,
} from "./challengeCodec";
import { DAILY_DIFFICULTIES, type DailyDifficulty } from "./gameRules";
import { validateDailyTrio, dailyTrioPreferenceWarnings, type DailyTrioLike } from "./dailyTrioRules";
import { acquireDailyGenerationLock, releaseDailyGenerationLock } from "./dailyGenerationLock";
import { generateDailyTrio } from "./puzzleEngine";
import { fetchCountries, type CountryInfo } from "./worldBank";
import { loadServerCategoryRegistry } from "./serverPlayableCatalog";
import { CATEGORY_SET_VERSION, DATASET_VERSION, RULES_VERSION } from "./version";
import type { Category } from "./categories";

export type StoredDailyRow = {
  challenge_date: string;
  difficulty: DailyDifficulty;
  seed: string;
  encoded_board: string;
  board_payload?: RoundSnapshot | null;
  rules_version?: string | null;
  category_set_version?: string | null;
  dataset_version?: string | null;
};

export type PackedDailyBoard = {
  seed: string;
  encoded_board: string;
  board_payload: RoundSnapshot;
};

export type PackedDailyTrio = Partial<Record<DailyDifficulty, PackedDailyBoard>>;

type Dependencies = { countries: CountryInfo[]; categoryRegistry: Category[] };

type GenerateOptions = {
  source: string;
  attempts?: number;
  budgetMs?: number;
  candidateTarget?: number;
  jointSearch?: boolean;
  jointFirst?: boolean;
};

export function isValidChallengeDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function readDailyRows(admin: any, date: string) {
  const { data, error } = await admin
    .from("daily_challenges")
    .select("challenge_date,difficulty,seed,encoded_board,board_payload,rules_version,category_set_version,dataset_version")
    .eq("challenge_date", date)
    .in("difficulty", [...DAILY_DIFFICULTIES]);
  return { rows: (data ?? []) as StoredDailyRow[], error };
}

async function scoreCountsByDifficulty(admin: any, date: string) {
  const { data, error } = await admin
    .from("daily_scores")
    .select("difficulty")
    .eq("challenge_date", date);
  if (error) throw error;
  const counts: Record<DailyDifficulty, number> = { easy: 0, normal: 0, expert: 0 };
  for (const row of data ?? []) {
    const difficulty = row.difficulty as DailyDifficulty;
    if (DAILY_DIFFICULTIES.includes(difficulty)) counts[difficulty] += 1;
  }
  return counts;
}

function decodeWithPayload(row: StoredDailyRow) {
  if (!row.board_payload) throw new Error(`${row.difficulty} is missing its self-contained board payload.`);
  return deserializeRound(row.board_payload);
}

function decodeStored(row: StoredDailyRow, dependencies?: Dependencies) {
  if (row.board_payload) return deserializeRound(row.board_payload);
  if (!dependencies) throw new Error(`${row.difficulty} uses a legacy encoded board and needs the category registry.`);
  return decodeRound(row.encoded_board, dependencies.countries, dependencies.categoryRegistry);
}

export function inspectStoredTrio(rows: StoredDailyRow[], dependencies?: Dependencies) {
  const rounds: Partial<Record<DailyDifficulty, Round>> = {};
  const errors: Partial<Record<DailyDifficulty, string[]>> = {};
  const outdated: Partial<Record<DailyDifficulty, string[]>> = {};
  const byDifficulty = new Map(rows.map((row) => [row.difficulty, row]));

  for (const difficulty of DAILY_DIFFICULTIES) {
    const row = byDifficulty.get(difficulty);
    if (!row) {
      errors[difficulty] = ["Board is missing."];
      continue;
    }
    try {
      rounds[difficulty] = decodeStored(row, dependencies);
      const warnings: string[] = [];
      if (row.rules_version && row.rules_version !== RULES_VERSION) warnings.push(`Rules ${row.rules_version} predate ${RULES_VERSION}.`);
      if (row.category_set_version && row.category_set_version !== CATEGORY_SET_VERSION) warnings.push("Category set predates the current catalog.");
      if (warnings.length) outdated[difficulty] = warnings;
    } catch (error) {
      errors[difficulty] = [error instanceof Error ? error.message : "Board is invalid."];
    }
  }

  const complete = Boolean(rounds.easy && rounds.normal && rounds.expert && !Object.keys(errors).length);
  const trioErrors = complete ? validateDailyTrio(rounds as DailyTrioLike, { allowLegacyDimensions: true }) : [];
  return { rounds, errors, outdated, trioErrors, complete: complete && trioErrors.length === 0 };
}

export function packStoredRows(rows: StoredDailyRow[]): PackedDailyTrio {
  const result: PackedDailyTrio = {};
  for (const row of rows) {
    try {
      const round = decodeWithPayload(row);
      result[row.difficulty] = {
        seed: row.seed,
        encoded_board: row.encoded_board,
        board_payload: row.board_payload ?? serializeRound(round),
      };
    } catch {
      // Public reads omit malformed modes instead of exposing a partial invalid payload.
    }
  }
  return result;
}

export function recentCountryExposureFromRows(rows: StoredDailyRow[], maxDays = 7) {
  const dates = [...new Set(rows.map((row) => row.challenge_date))].sort().reverse().slice(0, maxDays);
  const dateWeights = new Map(dates.map((value, index) => [value, Math.max(1, maxDays - index)]));
  const exposure: Record<string, number> = {};
  for (const row of rows) {
    const weight = dateWeights.get(row.challenge_date);
    if (!weight || !row.board_payload) continue;
    try {
      const round = deserializeRound(row.board_payload);
      for (const country of round.bank) exposure[country.id] = (exposure[country.id] ?? 0) + weight;
    } catch {
      // Historical repetition is a preference only. Ignore malformed legacy rows.
    }
  }
  return exposure;
}

async function loadRecentCountryExposure(admin: any, beforeDate: string) {
  const { data, error } = await admin
    .from("daily_challenges")
    .select("challenge_date,difficulty,seed,encoded_board,board_payload,rules_version,category_set_version,dataset_version")
    .lt("challenge_date", beforeDate)
    .not("board_payload", "is", null)
    .order("challenge_date", { ascending: false })
    .limit(63);
  if (error) return {};
  return recentCountryExposureFromRows((data ?? []) as StoredDailyRow[]);
}

export async function loadLatestCompleteFallback(admin: any, beforeDate: string) {
  const { data, error } = await admin
    .from("daily_challenges")
    .select("challenge_date,difficulty,seed,encoded_board,board_payload,rules_version,category_set_version,dataset_version")
    .lt("challenge_date", beforeDate)
    .not("board_payload", "is", null)
    .order("challenge_date", { ascending: false })
    .limit(60);
  if (error) return null;
  const rows = (data ?? []) as StoredDailyRow[];
  for (const date of [...new Set(rows.map((row) => row.challenge_date))]) {
    const sameDate = rows.filter((row) => row.challenge_date === date);
    const inspected = inspectStoredTrio(sameDate);
    if (inspected.complete) return { date, rows: sameDate, boards: packStoredRows(sameDate) };
  }
  return null;
}

async function loadLegacyDependencies(): Promise<Dependencies> {
  const [countries, categoryRegistry] = await Promise.all([fetchCountries(), loadServerCategoryRegistry()]);
  return { countries, categoryRegistry };
}

function roundRow(date: string, difficulty: DailyDifficulty, round: Round) {
  const encoded = encodeRound(round);
  return {
    challenge_date: date,
    difficulty,
    seed: `DAILY-${difficulty.toUpperCase()}-${date}`,
    encoded_board: encoded,
    board_payload: serializeRound(round),
    board_hash: createHash("sha256").update(encoded).digest("hex"),
    dataset_version: DATASET_VERSION,
    rules_version: RULES_VERSION,
    category_set_version: CATEGORY_SET_VERSION,
  };
}

async function publishAtomically(admin: any, date: string, rows: ReturnType<typeof roundRow>[]) {
  const { error } = await admin.rpc("publish_daily_trio_v16", {
    p_challenge_date: date,
    p_rows: rows,
  });
  if (error) {
    const message = error.message ?? "Unknown Supabase error";
    if (/could not find the function|publish_daily_trio_v16.*does not exist|schema cache.*publish_daily_trio_v16/i.test(message)) {
      throw new Error("The Daily publication RPC is unavailable. Install RUN_THIS_IN_SUPABASE_FOR_V16_2_3.sql and reload the Supabase schema cache.");
    }
    if (/permission denied|42501/i.test(message)) {
      throw new Error(`Daily publication permission failed: ${message}`);
    }
    if (/digest\(|function digest|pgcrypto/i.test(message)) {
      throw new Error(`Daily publication dependency failed: pgcrypto/digest is not visible to the publication RPC. ${message}`);
    }
    if (/Atomic publication would leave only/i.test(message)) {
      throw new Error(`Daily publication rejected an incomplete trio: ${message}`);
    }
    throw new Error(`Daily trio publication failed: ${message}`);
  }
}

async function recordGeneration(admin: any, row: Record<string, unknown>) {
  try {
    await admin.from("daily_generation_runs").insert(row);
  } catch {
    // Diagnostics are useful but never determine board availability.
  }
}

export async function generateAndPublishDailyTrio(admin: any, date: string, options: GenerateOptions) {
  if (!isValidChallengeDate(date)) throw new Error("Invalid Daily date.");
  const lockToken = await acquireDailyGenerationLock(admin, date);
  if (!lockToken) return { ok: false as const, generating: true as const, date };

  try {
    const [stored, scoreCounts, countries, recentCountryExposure] = await Promise.all([
      readDailyRows(admin, date),
      scoreCountsByDifficulty(admin, date),
      fetchCountries(),
      loadRecentCountryExposure(admin, date),
    ]);
    if (stored.error) throw stored.error;

    let dependencies: Dependencies | undefined;
    if (stored.rows.some((row) => !row.board_payload)) dependencies = await loadLegacyDependencies();
    const current = inspectStoredTrio(stored.rows, dependencies);
    if (current.complete) {
      return {
        ok: true as const,
        generated: false as const,
        date,
        rows: stored.rows,
        boards: packStoredRows(stored.rows),
        preferenceWarnings: dailyTrioPreferenceWarnings(current.rounds as DailyTrioLike),
      };
    }

    const fixed: Partial<Record<DailyDifficulty, Round>> = {};
    for (const difficulty of DAILY_DIFFICULTIES) {
      if (scoreCounts[difficulty] === 0) continue;
      const row = stored.rows.find((candidate) => candidate.difficulty === difficulty);
      if (!row) throw new Error(`${difficulty} has saved scores but no stored board.`);
      try {
        fixed[difficulty] = decodeStored(row, dependencies);
      } catch (error) {
        throw new Error(`${difficulty} has saved scores but its board cannot be decoded: ${error instanceof Error ? error.message : "invalid board"}`);
      }
    }

    let generated: Awaited<ReturnType<typeof generateDailyTrio>> | null = null;
    let lastError: unknown = null;
    const attemptCount = Math.min(3, Math.max(1, options.attempts ?? 1));
    const runNonce = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    for (let attempt = 0; attempt < attemptCount && !generated; attempt += 1) {
      try {
        generated = await generateDailyTrio(
          countries,
          date,
          fixed,
          `${options.source}:${runNonce}:attempt-${attempt + 1}`,
          {
            budgetMs: options.budgetMs,
            candidateTarget: options.candidateTarget,
            jointSearch: options.jointSearch,
            jointFirst: options.jointFirst,
            recentCountryExposure,
          },
        );
      } catch (error) {
        lastError = error;
      }
    }
    if (!generated) throw lastError ?? new Error("The Daily trio could not be generated.");

    const validationErrors = validateDailyTrio(generated.trio);
    if (validationErrors.length) throw new Error(`Generated trio failed validation: ${validationErrors.join(" | ")}`);

    // Only modes with no saved score may be replaced. With no scores this publishes
    // all three modes together and discards any unscored partial trio that blocked generation.
    const replacementRows = DAILY_DIFFICULTIES
      .filter((difficulty) => scoreCounts[difficulty] === 0)
      .map((difficulty) => roundRow(date, difficulty, generated!.trio[difficulty]));
    await publishAtomically(admin, date, replacementRows);
    revalidateTag("geostats-daily-trio", "max");

    const final = await readDailyRows(admin, date);
    if (final.error) throw final.error;
    const inspected = inspectStoredTrio(final.rows, dependencies);
    if (!inspected.complete) {
      throw new Error(`Published Daily trio failed verification: ${JSON.stringify({ modes: inspected.errors, trio: inspected.trioErrors })}`);
    }

    await recordGeneration(admin, {
      challenge_date: date,
      status: stored.rows.length ? "repaired" : "completed",
      source: options.source,
      diagnostics: {
        ...generated.diagnostics,
        preservedScoredModes: DAILY_DIFFICULTIES.filter((difficulty) => scoreCounts[difficulty] > 0),
        replacedModes: DAILY_DIFFICULTIES.filter((difficulty) => scoreCounts[difficulty] === 0),
      },
      scores: generated.scores,
    });

    return {
      ok: true as const,
      generated: true as const,
      date,
      rows: final.rows,
      boards: packStoredRows(final.rows),
      diagnostics: generated.diagnostics,
      scores: generated.scores,
      preferenceWarnings: dailyTrioPreferenceWarnings(inspected.rounds as DailyTrioLike),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily generation failed.";
    const diagnostics = typeof error === "object" && error && "diagnostics" in error
      ? (error as { diagnostics?: unknown }).diagnostics ?? null
      : null;
    await recordGeneration(admin, {
      challenge_date: date,
      status: "failed",
      source: options.source,
      diagnostics,
      error_message: message,
    });
    throw error;
  } finally {
    await releaseDailyGenerationLock(admin, date, lockToken);
  }
}
