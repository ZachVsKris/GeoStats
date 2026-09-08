"use client";
import { useState } from 'react';
import ReportProblem from './ReportProblem';
import { ROUND_CONFIGS, type DailyDifficulty } from '../lib/gameRules';
import { trackAnalytics } from '../lib/analytics';
export default function GameTools({categories,difficulty,challengeDate,path,privateBoard=false}:{categories:{id:string;name:string}[];difficulty:DailyDifficulty;challengeDate?:string;path:string;privateBoard?:boolean}) {
 const [status,setStatus]=useState('');
 async function challenge(){
  const url=new URL(path,window.location.origin).toString();
  const text=`🌍 Join me for GeoStats ${ROUND_CONFIGS[difficulty].label} Daily${challengeDate?` · ${challengeDate}`:''}. Match countries to surprising facts. Can you beat my score?`;
  try {
   if(navigator.share)await navigator.share({title:'GeoStats',text,url});
   else {await navigator.clipboard.writeText(`${text}\n${url}`);setStatus('Challenge link copied ✓');}
   trackAnalytics('share_clicked',{difficulty,challengeDate,metadata:{action:'challenge_friend'}});
  }catch(error){if(error instanceof Error&&error.name==='AbortError')return;setStatus('Sharing is unavailable. Copy the page address to challenge a friend.');}
 }
 return <><ReportProblem categories={categories} difficulty={difficulty} challengeDate={challengeDate}/>{!privateBoard&&<button type="button" onClick={challenge}>Challenge a friend</button>}{status&&<span className="gameToolsStatus" role="status">{status}</span>}</>;
}
