import type { ReactNode } from "react";

export default function MatchOptimalChoices({ description, rows }: {
  description: ReactNode;
  rows: { id: string; icon: ReactNode; category: ReactNode; measurement: string; best: ReactNode; details: ReactNode }[];
}) {
  return <div id="best-solution" className="perfect"><div className="resultsHeading"><div><h3>Optimal Choices</h3></div><small>{description}</small></div><div className="perfectGrid">{rows.map(row => <div className="perfectRow" title={row.measurement} key={row.id}><span>{row.icon}</span><div><strong>{row.category}</strong><small className="statTip" tabIndex={0}>{row.best}<span className="tooltip">{row.details}</span></small></div><b>100 pts</b></div>)}</div></div>;
}
