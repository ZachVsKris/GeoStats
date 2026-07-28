import type { Category } from "./categories";
import type { CategoryDataset } from "./worldBank";
import { displayedDistribution } from "./valueFormatting";

export type CategoryQuality = {
  score:number;
  eligible:boolean;
  coverage:number;
  coverageScore:number;
  freshnessScore:number;
  variationScore:number;
  reliabilityScore:number;
  trustScore:number;
  latestYear:number|null;
  mostCommonShare:number;
  distinctDisplayValues:number;
};

function clamp(value:number,min=0,max=1){return Math.max(min,Math.min(max,value));}

const QUALITY_CACHE = new WeakMap<CategoryDataset, Map<number, CategoryQuality>>();

export function scoreCategoryQuality(dataset: CategoryDataset, nowYear=new Date().getUTCFullYear()): CategoryQuality {
  const cached = QUALITY_CACHE.get(dataset)?.get(nowYear);
  if (cached) return cached;

  const values=dataset.observations.map(row=>row.value).filter(Number.isFinite);
  const years=dataset.observations.map(row=>Number(row.year)).filter(Number.isFinite);
  const coverage=values.length;
  const floor=Math.max(20,dataset.category.coverageFloor??100);
  const coverageScore=Math.round(40*clamp(coverage/floor));
  const latestYear=years.length?Math.max(...years):null;
  const age=latestYear===null?99:Math.max(0,nowYear-latestYear);
  const freshnessScore=age<=1?22:age===2?19:age===3?15:age===4?9:age===5?4:0;
  const sorted=[...values].sort((a,b)=>a-b);
  const displayDistribution=displayedDistribution(values,dataset.category);
  const mostCommonShare=displayDistribution.mostCommonShare;
  const distinctDisplayValues=displayDistribution.distinctCount;
  const distinctRatio=values.length?distinctDisplayValues/values.length:0;
  const q10=sorted[Math.floor(sorted.length*.1)]??0; const q90=sorted[Math.floor(sorted.length*.9)]??0;
  const median=Math.abs(sorted[Math.floor(sorted.length*.5)]??0);
  const spread=Math.abs(q90-q10);
  const spreadSignal=spread===0?0:clamp(spread/(median+spread));
  const concentrationPenalty=clamp((mostCommonShare-.12)/.5);
  const variationScore=Math.round(18*clamp(.55*distinctRatio+.45*spreadSignal-.35*concentrationPenalty));
  const grade=dataset.category.certificationGrade??"A";
  const reliabilityScore=grade==="A"?8:grade==="B"?6:3;
  const credibility=dataset.category.credibilityScore??80;
  const trustScore=Math.round(12*clamp((credibility-60)/40));
  const score=Math.min(100,coverageScore+freshnessScore+variationScore+reliabilityScore+trustScore);
  const concentratedPhysicalSeries = dataset.category.source === "eia" && mostCommonShare > .45;
  // A category can only support a tie-free Daily when it has enough values at
  // the same precision shown to players. This is deliberately modest; the
  // round composer performs the stricter board-specific tie check.
  const minimumDisplayValues=Math.max(12,Math.min(24,Math.ceil(floor*.12)));
  const displayVarietyReady=distinctDisplayValues>=minimumDisplayValues&&mostCommonShare<=.40;
  const eligible=score>=80&&coverage>=floor&&credibility>=75&&dataset.category.trustStatus!=="quarantined"&&!concentratedPhysicalSeries&&displayVarietyReady;
  const result = {score,eligible,coverage,coverageScore,freshnessScore,variationScore,reliabilityScore,trustScore,latestYear,mostCommonShare,distinctDisplayValues};
  const byYear = QUALITY_CACHE.get(dataset) ?? new Map<number, CategoryQuality>();
  byYear.set(nowYear, result);
  QUALITY_CACHE.set(dataset, byYear);
  return result;
}

export function runtimeQualityScore(category: Category, coverage:number, latestYear:number|null, variation=0.8){
 const floor=Math.max(20,category.coverageFloor??100); const coverageScore=40*clamp(coverage/floor); const age=latestYear===null?99:Math.max(0,new Date().getUTCFullYear()-latestYear);
 const freshness=age<=1?22:age===2?19:age===3?15:age===4?9:age===5?4:0; const reliability=(category.certificationGrade??"A")==="A"?8:6;
 const trust=12*clamp(((category.credibilityScore??80)-60)/40);
 return Math.round(Math.min(100,coverageScore+freshness+18*clamp(variation)+reliability+trust));
}
