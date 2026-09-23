import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "../../../../lib/supabase/server";
import { readAllPages } from "../../../../lib/pagedRead";
import { personalRatings, type RatingScore } from "../../../../lib/personalRating";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Accounts are unavailable." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to see your results." }, { status: 401 });
  const { data, error } = await readAllPages((from, to) => supabase.from("daily_scores")
    .select("challenge_date,difficulty,score,average_placement,firsts,completed_at,rules_version")
    .eq("user_id", user.id).order("challenge_date", { ascending: false })
    .order("id", { ascending: false }).range(from, to));
  if (error) return NextResponse.json({ error: "Results could not be loaded." }, { status: 500 });
  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Ratings are unavailable." }, { status: 503 });
  const cohort = await readAllPages((from, to) => admin.from("daily_scores")
    .select("user_id,challenge_date,difficulty,score,rules_version")
    .order("id", { ascending: true }).range(from, to));
  if (cohort.error) return NextResponse.json({ error: "Ratings could not be loaded." }, { status: 500 });
  const ratings = personalRatings((cohort.data ?? []) as RatingScore[], user.id);
  return NextResponse.json({ results: data ?? [], ratings }, { headers: { "Cache-Control": "private, no-store" } });
}
