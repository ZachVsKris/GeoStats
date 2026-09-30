"use client";
import { useState } from "react";

export function CATLogo({ compact = false }: { compact?: boolean }) {
 return <svg className={`catLogo ${compact ? "compact" : ""}`} viewBox="0 0 300 110" role="img" aria-label="CAT: Countries, Animals and Things">
  <g><path d="M77 20a37 37 0 1 0 0 65" fill="none" stroke="#245b86" strokeWidth="22" strokeLinecap="round"/><circle cx="49" cy="55" r="25" fill="#65b5d5"/><path d="m28 44 12-8 7 5 1 8 9 2-3 9-11 2-6-8-9-2m26 13 9-5 9 4-5 11-8 1-3 8-6-7" fill="#72b17a"/></g>
  <g fill="#edae35"><path d="M100 94 121 17q2-6 7-1l13 17h19l13-17q4-5 7 1l21 77q2 7-5 7h-20l-7-23h-33l-7 23h-23q-8 0-6-7Z"/><path d="M145 70h13l-6-14Z" fill="#fff7df"/></g>
  <g fill="#153d37"><ellipse cx="136" cy="49" rx="3.5" ry="4"/><ellipse cx="169" cy="49" rx="3.5" ry="4"/><path d="m147 57 5 5 5-5Z"/><path d="m125 58 12 3m-12 8 12-3m31-5 12-3m-12 8 12 3" fill="none" stroke="#153d37" strokeWidth="3" strokeLinecap="round"/></g>
  <g fill="#36906a"><rect x="215" y="36" width="80" height="20" rx="10"/><path d="M245 29h17v54h-17Z"/><path d="M233 79h41v13q0 11-20 17-21-6-21-17Z"/><path d="M236 7h36v6q0 17-18 17t-18-17Z" fill="none" stroke="#36906a" strokeWidth="7"/></g>
 </svg>;
}

export function CATMascot({ pleased = false }: { pleased?: boolean }) {
 const [paused, setPaused] = useState(false);
 return <div className={`catCurator ${paused ? "paused" : ""} ${pleased ? "pleased" : ""}`}>
  <svg viewBox="0 0 120 110" aria-hidden="true">
   <path className="catTail" d="M86 84q33 0 23-35" fill="none" stroke="#db962d" strokeWidth="11" strokeLinecap="round"/>
   <path d="M23 93 37 18q1-4 4-1l16 16h15l14-16q3-3 4 1l15 75q1 6-5 6H81l-7-18H55l-7 18H28q-6 0-5-6Z" fill="#edb23f" stroke="#70491e" strokeWidth="2"/>
   <path d="m59 78 6-16 6 16Z" fill="#fff8e7"/>
   <g className="catEyes" fill="#163b36"><ellipse cx="50" cy="49" rx="3.5" ry="4"/><ellipse cx="80" cy="49" rx="3.5" ry="4"/></g>
   <g fill="none" stroke="#163b36" strokeWidth="2.8" strokeLinecap="round"><path d="m39 59 13 3m-13 7 13-3m27-4 13-3m-13 7 13 3"/>{pleased && <path d="M59 67q6 5 12 0"/>}</g><path d="m60 58 5 5 5-5Z" fill="#163b36"/>
  </svg><button type="button" className="catMotionToggle" onClick={() => setPaused(!paused)} aria-label={paused ? "Animate cat mascot" : "Pause cat mascot animation"} title={paused ? "Animate cat mascot" : "Pause cat mascot animation"}>{paused ? "▶" : "Ⅱ"}</button>
  <span className="catCuratorLabel">resident curator</span>
 </div>;
}
