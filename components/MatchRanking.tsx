import type { ReactNode } from "react";

type Row = { id: string; boardRank: number; name: ReactNode; catalogRank: number | undefined; value: ReactNode; reference: ReactNode; points: number; selected: boolean };

/** Countries and animals share one expanded ranking layout. */
export default function MatchRanking({ title, count, plural, entityLabel, rankLabel, source, onSource, rows }: {
  title: ReactNode; count: number; plural: string; entityLabel: string; rankLabel: string;
  source: string; onSource: () => void; rows: Row[];
}) {
  return <div className="leaderboard">
    <div className="leaderboardHeader"><div className="leaderboardTitle"><h4>{title}</h4><span>Among these {count} {plural}</span></div><div className="leaderboardSource"><span className="sourceBadge">{source}</span><button className="sourceDetailsButton" onClick={event => { event.stopPropagation(); onSource(); }}>Data &amp; Source</button></div></div>
    <div className="leaderboardColumns" aria-hidden="true"><b>Board</b><b>{entityLabel}</b><b>{rankLabel}</b><b>Value</b><b>Reference</b><b>Points</b></div>
    {rows.map(row => <div key={row.id} className={row.selected ? "current" : ""}><b className="boardRank">#{row.boardRank}</b><span className="leaderboardCountry">{row.name}</span><span className="worldRank">{row.catalogRank === undefined ? "—" : `#${row.catalogRank}`}</span><span className="leaderboardValue"><span className="mobileColumnLabel">Value</span>{row.value}</span><small className="leaderboardReference"><span className="mobileColumnLabel">Reference</span>{row.reference}</small><strong className="leaderboardPoints">{row.points} pts</strong></div>)}
  </div>;
}
