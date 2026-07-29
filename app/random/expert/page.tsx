import GeoSecondComingGame from "../../../components/GeoSecondComingGame";

export const metadata = {
  title: "Expert Seeded Challenge | GeoStats",
  description: "Replayable GeoStats challenge generated from a shared seed."
};

export default function RandomChallengePage() {
  return <GeoSecondComingGame initialDifficulty="expert" mode="random" />;
}
