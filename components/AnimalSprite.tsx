"use client";
import { memo, useId } from "react";
import type { Animal } from "../lib/animalstats";
import { cartoonProfile } from "../lib/animalstatsCartoons";

// Illustrated shapes share a fixed drawing frame; their scale carries no stat clues.
export const AnimalSprite = memo(function AnimalSprite({animal, className = ""}: {animal: Animal; className?: string}) {
 const uid=useId().replaceAll(':',''),p=cartoonProfile(animal.id),f=p.feature ?? '',bird=p.kind==='bird'||p.kind==='penguin',marine=p.kind==='marine',snake=p.kind==='snake',turtle=p.kind==='turtle',ape=p.kind==='primate';
 const fox=f==='fox',cat=['lion','tiger','cheetah','leopard','jaguar','snowleopard'].includes(f),bear=f.includes('bear')||f==='panda',reptile=p.kind==='reptile',bill=['platypus','mallard','eider','goose'].includes(f),elephant=f==='elephant',giraffe=f==='giraffe',hoof=['giraffe','zebra','donkey','horse','moose','camel','buffalo','bison','hippo','rhino'].includes(f);
 const ink='#513b32', body=fox?'#e39150':p.color, pale=p.belly,earColor=f==='panda'?'#484743':body,headColor=f==='mallard'?'#4b9571':f==='baldeagle'||f==='opossum'? '#f7eee0':body;
 const bodyY=bird?85:ape?81:marine?96:100,headY=giraffe?42:bird?54:ape?48:78,headX=bird?110:ape?99:reptile?124:130, legLength=giraffe?42:bird?22:ape?36:Math.min(30,Math.max(12,p.leg*28)),bodyRx=bird?29:ape?25:marine?61:snake?51:47;
 const spots=Array.from({length:15},(_,i)=>({x:63+(i%5)*13,y:87+Math.floor(i/5)*11}));
 return <svg viewBox="0 0 200 160" className={`animalSprite fairCartoon ${className}`} role="img" aria-label={animal.commonName} data-animal-id={animal.id} data-art-version="fair-cartoon-v1" data-normalized-size="142">
  <defs><clipPath id={`coat${uid}`}><ellipse cx="87" cy={bodyY} rx={bodyRx} ry={bird?34:ape?39:marine?23:26}/></clipPath></defs>
  <ellipse className="cartoonGround" cx="100" cy="146" rx="62" ry="6" fill="#60482c" opacity=".12"/>
  <g stroke={ink} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
  {!snake&&!marine&&<g fill={body} className="cartoonFeet">{(bird?[78,101]:ape?[76,99]:[57,72,105,118]).map((x,i)=>{
   // Start every limb inside the torso. Rotate around its own shoulder/hip,
   // so animation cannot pull a leg away from the body silhouette.
   const rootY=bodyY+4,footY=bodyY+16+legLength;
   return <path key={x} className={i%2?'cartoonStepBack':'cartoonStep'} style={{transformOrigin:`${x}px ${rootY}px`}} d={`M${x-6} ${rootY} Q${x-9} ${rootY+16} ${x-5} ${footY} q-6 6 -2 7 h13 q5-3 0-7 L${x+6} ${rootY} Z`} fill={bird?'#dcb25f':fox?'#5d453b':hoof?'#574d44':body}/>;
  })}</g>}
  {!bird&&!ape&&!marine&&!snake&&p.tail>0.3&&<g className="cartoonWag" style={{transformOrigin:'48px 101px'}}>{fox?<path fill={body} d="M50 100 C24 112 12 79 18 62 Q27 80 47 84 L60 95 Z"/>:bill?<path fill={body} d="M54 98 Q24 74 15 93 Q11 110 52 118 Z"/>:<path fill="none" stroke={f==='opossum'?'#d99898':body} strokeWidth={f==='treeshrew'?15:6} d="M48 99 Q20 107 16 73"/>}{fox&&<path fill="#fff2db" d="M18 62 Q18 80 28 89 L37 81 Q25 75 18 62"/>}</g>}
  {snake?<path fill={body} d="M144 113 C148 132 48 143 35 117 C18 86 111 87 113 106 C115 125 57 127 55 113 C53 100 93 97 113 88 L145 96"/>:<ellipse fill={body} cx="87" cy={bodyY} rx={bodyRx} ry={bird?34:ape?39:marine?23:26}/>}
  {(p.kind==='penguin'||marine)&&<ellipse fill={pale} stroke="none" cx={marine?97:98} cy={bodyY+9} rx={marine?42:19} ry={marine?13:27}/>}
  {f==='macaque'&&<path className="cartoonWag" fill="none" stroke={body} strokeWidth="6" d="M66 101 Q35 111 40 80"/>}
  {p.pattern&&<g clipPath={`url(#coat${uid})`} fill="#624b38" strokeWidth="1">{p.pattern==='stripes'?Array.from({length:7},(_,i)=><path key={i} d={`M${52+i*12} 72 q18 25 4 55 l7-8 q12-28 0-47 Z`}/>):spots.map((s,i)=>p.pattern==='patches'?<path key={i} d={`M${s.x} ${s.y} l8-3 3 7 -7 5 -5-3 Z`}/>:<ellipse key={i} cx={s.x} cy={s.y} rx={p.pattern==='rosettes'?4:2.7} ry="3" fill={p.pattern==='rosettes'?body:'#604936'}/>)}</g>}
  {f==='bison'&&<><path fill={body} d="M54 90 Q59 53 89 69 L116 88"/><path fill="#e4d9bb" d="M130 60 Q124 43 119 48 Q117 56 127 63 M145 61 Q153 46 158 52 Q156 62 147 66"/></>}
  {reptile&&<><path fill={body} d="M55 93 Q24 87 13 109 Q32 104 55 114 Z"/><path fill="#5e7252" d="M52 77 l7-12 8 11 9-12 9 12 9-11 8 12 8-8 8 11"/></>}
  {f==='panda'&&<path d="M113 77 Q126 99 119 122 L104 122 Q110 98 98 79 Z" fill="#484743"/>}
  {turtle&&<><ellipse cx="81" cy="92" rx="45" ry="32" fill="#608d64"/><path d="M40 91 l26-23 33 2 25 23 -19 25 -39 1 Z M66 68 l4 25 -4 26 M99 70 l-7 25 13 23 M40 91 l30 2 22 2 32-2" fill="none" stroke="#d7d19d"/></>}
  {(bird||marine)&&<g className="cartoonWing" style={{transformOrigin:'87px 92px'}}>{marine?<><path fill={body} d="M84 104 Q65 138 51 120 L61 101"/><path fill={body} d="M34 94 Q10 75 5 85 L18 98 4 112 Q19 122 35 105"/>{f!=='bluewhale'&&<path fill={body} d="M81 78 L85 62 Q104 78 102 78"/>}</>:<path fill={p.kind==='penguin'?'#374c55':pale} d="M94 75 Q54 80 61 104 Q72 124 103 96 Q86 111 72 103 Q96 105 94 75"/>}</g>}
  {giraffe&&<path fill={body} d="M108 93 L111 45 Q121 35 132 46 L131 95"/>}
  {f==='lion'&&<path fill="#b36c35" d="M110 48 l9 5 9-8 8 8 11-1 5 10 11 3 -2 12 7 9 -8 8 -2 12 -12 1 -8 7 -10-5 -12 1 -5-10 -10-5 2-12 -5-10 8-7 Z"/>}
  <g className="cartoonHead" style={{transformOrigin:`${headX-14}px ${headY+14}px`}}>
   {p.ear>0&&!marine&&!bird&&!snake&&<>{fox||cat||f==='kangaroo'||f==='donkey'||f==='zebra'?<><path fill={headColor} d={`M${headX-23} ${headY-10} Q${headX-29} ${headY-49} ${headX-10} ${headY-22} Z`}/><path fill={headColor} d={`M${headX+3} ${headY-19} Q${headX+22} ${headY-46} ${headX+19} ${headY-5} Z`}/><path stroke="none" fill="#e4ad9d" d={`M${headX-23} ${headY-18} l-1-13 10 15 Z`}/></>:<><ellipse fill={earColor} cx={headX-21} cy={headY-21} rx={f==='koala'?16:10} ry={f==='koala'?17:11}/><ellipse fill="#d9b9a3" cx={headX-21} cy={headY-21} rx="5" ry="6"/><ellipse fill={earColor} cx={headX+12} cy={headY-22} rx="9" ry="10"/></>}</>}
   <ellipse fill={headColor} cx={headX} cy={headY} rx={snake?26:bird?23:27} ry={bird?25:24}/>
   {ape&&<path fill={f==='gorilla'?'#77756a':'#cbb096'} d={`M${headX-15} ${headY-6} q1-17 13-8 q14-7 20 9 l1 21 q-10 13 -25 3 Z`}/>}
   {elephant&&<><path fill={body} d={`M${headX-18} ${headY-19} C${headX-57} ${headY-34} ${headX-53} ${headY+33} ${headX-20} ${headY+24} Q${headX-9} ${headY} ${headX-18} ${headY-19}`}/><path fill={body} d={`M${headX+17} ${headY+9} q15 25 5 42 q-10 8 -14-2 q14-5 3-26 Z`}/><path fill="#fff3d6" d={`M${headX+9} ${headY+19} q15 15 23-2 q-5 7 -17-9`}/></>}
   {giraffe&&<g fill="#996943"><path d="M117 26 l-2-9 m12 10 1-12"/><circle cx="115" cy="15" r="4"/><circle cx="129" cy="14" r="4"/></g>}
   {f==='rhino'&&<path fill="#e5d8bf" d={`M${headX+21} ${headY+6} l15-27 -3 33 Z`}/>}
   {bird?<>{bill?<path fill="#e5bb65" d={`M${headX+14} ${headY+5} q41-4 31 9 q-16 7 -36 0 Z`}/>:<path fill="#dfb46c" d={`M${headX+19} ${headY+3} l${f==='pelican'?40:p.snout>0.6?31:16} 7 -20 8 Z`}/>}</>:!elephant&&<path fill={bill?'#91aaa6':fox||cat||bear||f==='opossum'?pale:headColor} d={`M${headX+6} ${headY+6} Q${headX+18} ${headY} ${headX+37+(bill?10:0)} ${headY+12} Q${headX+43} ${headY+26} ${headX+14} ${headY+24} Q${headX+2} ${headY+20} ${headX+6} ${headY+6} Z`}/>}
   {reptile&&<path fill={body} d={`M${headX+5} ${headY+7} Q${headX+22} ${headY+3} ${headX+54} ${headY+12} Q${headX+62} ${headY+22} ${headX+14} ${headY+27} Z`}/>}
   {f==='panda'&&<ellipse fill="#484743" cx={headX+4} cy={headY-2} rx="12" ry="14" transform={`rotate(-16 ${headX+4} ${headY-2})`}/>}
   <g className="cartoonBlink" style={{transformOrigin:`${headX+6}px ${headY}px`}}><ellipse fill="#fffaf0" cx={headX+6} cy={headY-2} rx="8.5" ry="10"/><ellipse fill="#4c3830" stroke="none" cx={headX+8} cy={headY-1} rx="4.7" ry="6.5"/><circle fill="white" stroke="none" cx={headX+10} cy={headY-4} r="2.2"/></g>
   <path fill="none" strokeWidth="1.7" d={`M${headX} ${headY-17} q7-4 12 0 M${headX+18} ${headY+21} q6 5 12 0`}/>
   {!bird&&!elephant&&<ellipse fill={f==='opossum'?'#d69691':ink} stroke="none" cx={headX+35+(bill?4:0)} cy={headY+12} rx={bill?2:4} ry="3"/>}
   <ellipse fill="#e6a594" opacity=".5" stroke="none" cx={headX+2} cy={headY+13} rx="6" ry="3"/>
   {cat&&<path strokeWidth="1.2" fill="none" d={`M${headX+15} ${headY+13} l-17-3 m18 8 -18 2`}/>}
   {f==='beaver'&&<path fill="#fff6d8" d={`M${headX+24} ${headY+20} l0 9 6 0 0-9 m-3 0 v8`}/>}
   {f==='owl'&&<><ellipse fill={pale} cx={headX-5} cy={headY} rx="17" ry="21"/><g className="cartoonBlink" style={{transformOrigin:`${headX-5}px ${headY}px`}}><circle fill="#f5dc89" cx={headX-12} cy={headY} r="7"/><circle fill="#f5dc89" cx={headX+3} cy={headY} r="7"/><circle fill={ink} cx={headX-11} cy={headY} r="3"/><circle fill={ink} cx={headX+4} cy={headY} r="3"/></g><path fill="#c89452" d={`M${headX-7} ${headY+8} l8 0 -4 7 Z`}/></>}
   {f==='cardinal'&&<path fill={body} d={`M${headX-15} ${headY-17} l15-22 8 21`}/>}
   {f==='rooster'&&<path fill="#cc574b" d={`M${headX-13} ${headY-20} q-8-13 3-12 q4-14 9-2 q14-9 13 9`}/>}
  </g>
  {ape&&<path className="cartoonArm" fill={body} d="M75 70 Q58 83 62 115 Q71 125 77 115 L88 82 Z"/>}
  </g>
 </svg>;
});
