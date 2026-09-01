import GeoSecondComingGame from "../../../components/GeoSecondComingGame";

export const metadata = {
  title: "Expert Random Challenge",
  description: "Replayable GeoStats challenge generated from a shared seed."
};

export default function RandomChallengePage() {
  return <GeoSecondComingGame initialDifficulty="expert" mode="random" />;
}
