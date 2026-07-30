import GeoSecondComingGame from "../../components/GeoSecondComingGame";

export const metadata = {
  title: "Adventurer Seeded Challenge | GeoStats",
  description: "Replayable GeoStats challenge generated from a shared seed."
};

export default function RandomChallengePage() {
  return <GeoSecondComingGame initialDifficulty="normal" mode="random" />;
}
