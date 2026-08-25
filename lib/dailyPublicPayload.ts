import type { DailyDifficulty } from "./gameRules";
import type { RoundSnapshot } from "./challengeCodec";

export type PackedApiBoard = {
  seed?: string;
  encoded_board?: string;
  board_payload?: RoundSnapshot;
};

export type DailyApiPayload = Partial<Record<DailyDifficulty, PackedApiBoard>> & {
  _cachedAt?: number;
  found?: boolean;
  generated?: boolean;
  error?: string;
  generating?: boolean;
  retryAfter?: number;
  fallback?: boolean;
  fallback_date?: string;
  warning?: string;
  preferenceWarnings?: string[];
  legacyModes?: string[];
};
