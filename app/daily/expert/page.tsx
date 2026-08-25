import GeoSecondComingGame from "../../../components/GeoSecondComingGame";
import { loadPublicDailyPayload } from "../../../lib/publicDaily";
import { newYorkDate } from "../../../lib/time";

export const dynamic = "force-dynamic";

export const metadata = { title: "Expert Daily | GeoStats" };

export default async function ExpertDailyPage() {
  const date = newYorkDate();
  const initialDailyPayload = await loadPublicDailyPayload(date);
  return <GeoSecondComingGame initialDifficulty="expert" initialDailyDate={date} initialDailyPayload={initialDailyPayload ?? undefined} />;
}
