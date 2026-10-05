import type { ReactNode } from "react";

/** Shared by Countries and Animals: one markup contract and the GeoStats CSS. */
export default function MatchResultRow({ icon, category, choice, placement, points, best, choiceDetails, open, onToggle }: {
  icon: ReactNode; category: ReactNode; choice: ReactNode; placement: string;
  points: number; best: ReactNode; choiceDetails?: ReactNode; open: boolean; onToggle: () => void;
}) {
  return <div className="result">
    <div className="resultMain"><span aria-hidden="true">{icon}</span><div><strong>{category}</strong><small className="statTip" tabIndex={choiceDetails ? 0 : undefined}><b>Your Choice</b> {choice}{choiceDetails && <span className="tooltip">{choiceDetails}</span>}</small></div></div>
    <div className="placementSummary"><b>{placement}</b><strong>{points} pts</strong></div>
    <div className="mobileBestMatch"><strong>Optimal Choice</strong><span>{best}</span></div>
    <button className="leaderboardButton" onClick={onToggle} aria-expanded={open}>{open ? "Hide rankings" : "View rankings"}</button>
  </div>;
}
