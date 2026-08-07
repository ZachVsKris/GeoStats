import { randomUUID } from "crypto";

export async function acquireDailyGenerationLock(
  supabase: any,
  date: string,
  ttlMs = 420_000,
) {
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const insert = () => supabase.from("daily_generation_locks_v15_7").insert({
    challenge_date: date,
    lock_token: token,
    expires_at: expiresAt,
  });

  let result = await insert();
  if (!result.error) return token;
  if (result.error.code !== "23505") throw result.error;

  const existing = await supabase
    .from("daily_generation_locks_v15_7")
    .select("expires_at")
    .eq("challenge_date", date)
    .maybeSingle();
  if (existing.error) throw existing.error;

  if (existing.data?.expires_at && new Date(existing.data.expires_at).getTime() < Date.now()) {
    await supabase.from("daily_generation_locks_v15_7").delete().eq("challenge_date", date);
    result = await insert();
    if (!result.error) return token;
    if (result.error.code !== "23505") throw result.error;
  }
  return null;
}

export async function releaseDailyGenerationLock(
  supabase: any,
  date: string,
  token: string,
) {
  await supabase
    .from("daily_generation_locks_v15_7")
    .delete()
    .eq("challenge_date", date)
    .eq("lock_token", token);
}
