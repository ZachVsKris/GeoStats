import GeoSecondComingGame from "../../../components/GeoSecondComingGame";
import { loadPublicDailyPayload } from "../../../lib/publicDaily";
import { newYorkDate } from "../../../lib/time";

export const dynamic = "force-dynamic";

export const metadata = { title: "Adventurer Daily" };

export default async function AdventurerDailyPage() {
  const date = newYorkDate();
  const initialDailyPayload = await loadPublicDailyPayload(date);
  return <GeoSecondComingGame initialDifficulty="normal" initialDailyDate={date} initialDailyPayload={initialDailyPayload ?? undefined} />;
}
