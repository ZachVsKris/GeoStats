import GeoSecondComingGame from "../../components/GeoSecondComingGame";
import { loadPublicDailyPayload } from "../../lib/publicDaily";
import { newYorkDate } from "../../lib/time";

export const dynamic = "force-dynamic";

export const metadata = { title: "Scout Daily" };

export default async function DailyPage() {
  const date = newYorkDate();
  const initialDailyPayload = await loadPublicDailyPayload(date);
  return <GeoSecondComingGame initialDifficulty="easy" initialDailyDate={date} initialDailyPayload={initialDailyPayload ?? undefined} />;
}
