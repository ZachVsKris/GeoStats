"use client";
import ReportProblem from './ReportProblem';
import type { DailyDifficulty } from '../lib/gameRules';
export default function GameTools({categories,difficulty,challengeDate}:{categories:{id:string;name:string}[];difficulty:DailyDifficulty;challengeDate?:string}) {
 return <ReportProblem categories={categories} difficulty={difficulty} challengeDate={challengeDate}/>;
}
