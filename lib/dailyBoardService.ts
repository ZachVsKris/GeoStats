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
  const trioErrors = complete ? validateDailyTrio(rounds as DailyTrioLike) : [];
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
    const migrationMissing = /publish_daily_trio_v16|schema cache|does not exist/i.test(error.message ?? "");
    throw new Error(migrationMissing
      ? "The v16 Daily publication function is not installed. Run RUN_THIS_IN_SUPABASE_FOR_V16_1.sql."
      : `Daily trio publication failed: ${error.message}`);
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
    const [stored, scoreCounts, countries] = await Promise.all([
      readDailyRows(admin, date),
      scoreCountsByDifficulty(admin, date),
      fetchCountries(),
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
    const attemptCount = Math.min(3, Math.max(1, options.attempts ?? 2));
    for (let attempt = 0; attempt < attemptCount && !generated; attempt += 1) {
      try {
        generated = await generateDailyTrio(
          countries,
          date,
          fixed,
          attempt === 0 ? "" : `${options.source}-attempt-${attempt + 1}`,
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
