import type { ReactNode } from "react";

/** One score layout for every matching domain. */
export default function MatchScoreSummary({ total, maximum, optimal, categories, rules, pointRules, notice, actions, afterActions }: {
  total: number; maximum: number; optimal: number; categories: number;
  rules: ReactNode; pointRules: ReactNode; notice?: ReactNode; actions: ReactNode; afterActions?: ReactNode;
}) {
  return <div className="score"><span>Final score</span>{notice}<div className="scoreValue"><strong>{total}</strong><b>/ {maximum}</b></div><div className="scoreBreakdown" aria-label="Optimal Choices"><span>Optimal Choices: <strong>{optimal} of {categories}</strong></span></div><details className="scoringDetails"><summary>Scoring rules</summary><p>{rules}</p><p>{pointRules}</p></details><div className="scoreActions">{actions}</div>{afterActions}</div>;
}
