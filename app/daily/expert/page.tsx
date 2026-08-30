import GeoSecondComingGame from "../../../components/GeoSecondComingGame";
import { loadPublicDailyPayload } from "../../../lib/publicDaily";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { newYorkDate } from "../../../lib/time";

export const dynamic = "force-dynamic";

export const metadata = { title: "Expert Daily | GeoStats" };

export default async function ExpertDailyPage() {
  const date = newYorkDate();
  const [initialDailyPayload, auth] = await Promise.all([
    loadPublicDailyPayload(date),
    createSupabaseServerClient(),
  ]);
  const userResult = auth ? await auth.auth.getUser() : null;
  return <GeoSecondComingGame
    initialDifficulty="expert"
    initialDailyDate={date}
    initialDailyPayload={initialDailyPayload ?? undefined}
    canPlayExpert={Boolean(userResult?.data.user)}
  />;
}
