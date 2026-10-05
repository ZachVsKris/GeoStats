"use client";

import { memo, useId } from "react";
import type { Animal } from "../lib/animalstats";
import { cartoonProfile } from "../lib/animalstatsCartoons";

type Profile = ReturnType<typeof cartoonProfile>;
const INK = "#513b32";
const CREAM = "#fff3db";
const CAT_FEATURES = ["lion", "tiger", "cheetah", "leopard", "jaguar", "snowleopard", "cougar"];
const HOOF_FEATURES = ["giraffe", "zebra", "donkey", "horse", "camel", "goat", "deer", "reindeer"];

function Eye({ x, y, size = 8 }: { x: number; y: number; size?: number }) {
  return <g className="cartoonBlink" style={{ transformOrigin: `${x}px ${y}px` }}>
    <ellipse cx={x} cy={y} rx={size * .8} ry={size} fill="#fffaf0" strokeWidth="1.6" />
    <ellipse cx={x + size * .18} cy={y + .5} rx={size * .46} ry={size * .66} fill={INK} stroke="none" />
    <circle cx={x + size * .36} cy={y - size * .3} r={size * .21} fill="white" stroke="none" />
  </g>;
}

// Paths are character silhouettes, not measured game dimensions. Every species
// occupies the same presentation frame, with its recognizable anatomy intact.
function mammalDesign(p: Profile) {
  const f = p.feature ?? "", cat = CAT_FEATURES.includes(f), bear = f.includes("bear") || f === "panda";
  let bodyPath = "M44 104 C40 76 61 70 88 75 Q112 72 126 90 L126 111 Q104 130 67 126 Q42 126 44 104 Z";
  let hx = 128, hy = 78, rx = 24, ry = 22, root = 105, legXs = [57, 72, 104, 119], foot = 139;
  if (cat || ["fox", "wolf", "lemur", "raccoon", "badger", "rat"].includes(f)) {
    bodyPath = "M43 99 Q43 77 66 78 L104 82 Q124 77 136 92 L130 110 Q99 120 63 118 Q42 116 43 99 Z";
    hx = 133; hy = 75; rx = 23; ry = 21; root = 101; foot = 142;
  }
  if (f === "treeshrew" || f === "opossum") {
    bodyPath = "M50 109 Q47 85 75 85 Q103 84 127 98 L133 115 Q111 130 73 129 Q48 129 50 109 Z";
    hx = 137; hy = 94; rx = 18; ry = 17; root = 114; foot = 143; legXs = [65, 78, 111, 124];
  }
  if (f === "platypus") {
    bodyPath = "M44 111 C38 84 78 82 109 95 Q125 94 135 109 Q126 131 83 132 Q45 132 44 111 Z";
    hx = 131; hy = 104; rx = 21; ry = 17; root = 118; foot = 142; legXs = [63, 76, 113, 126];
  }
  if (bear) {
    bodyPath = f === "polarbear" ? "M32 104 Q32 76 65 75 Q88 75 108 84 L136 91 L132 120 Q103 132 60 126 Q32 127 32 104 Z" : "M39 101 Q35 68 70 68 Q98 60 120 78 L130 112 Q113 132 63 127 Q40 128 39 101 Z";
    hx = f === "polarbear" ? 140 : 130; hy = 83; rx = 27; ry = 25; root = 109; foot = 144; legXs = [55, 73, 108, 126];
  }
  if (["capybara", "guineapig", "beaver", "hedgehog", "wombat", "hamster", "boar"].includes(f)) {
    bodyPath = "M41 108 Q37 80 70 76 Q102 73 122 93 L132 116 Q107 138 60 128 Z";
    hx = 132; hy = 96; rx = 26; ry = 23; root = 118; foot = 143; legXs = [55, 73, 109, 124];
  }
  if (f === "jaguar") { bodyPath = "M38 99 Q34 76 66 73 L110 77 Q132 78 138 96 L128 115 Q91 129 53 119 Q38 116 38 99 Z"; rx = 26; ry = 24; root = 108; foot = 141; }
  if (f === "brownbear") { bodyPath = "M36 101 Q34 75 57 75 Q71 53 91 70 L124 82 131 115 Q105 132 58 126 Q36 125 36 101 Z"; }
  if (f === "slothbear") { bodyPath = "M37 100 Q33 69 67 66 Q97 61 121 79 L129 110 124 121 117 119 110 130 98 128 90 133 80 127 65 131 56 126 46 127 40 117 Z"; }
  if (f === "polarbear") { rx = 22; ry = 21; hy = 86; }
  if (f === "capybara") { hx = 135; rx = 27; ry = 24; }
  if (f === "koala") { bodyPath = "M58 102 Q50 65 83 66 Q115 68 119 105 Q124 136 87 138 Q53 137 58 102 Z"; hx = 109; hy = 66; rx = 29; ry = 28; root = 121; legXs = [68, 95]; }
  if (f === "bison") { bodyPath = "M35 102 Q32 77 63 78 Q74 40 101 57 Q129 66 135 90 L128 120 Q89 133 54 125 Q35 123 35 102 Z"; hx = 138; hy = 89; rx = 27; ry = 28; root = 107; }
  if (f === "hippo") { bodyPath = "M29 102 Q27 68 70 70 Q114 67 137 93 L133 119 Q97 135 57 130 Q30 127 29 102 Z"; hx = 139; hy = 93; rx = 30; ry = 27; root = 115; }
  if (f === "rhino") { bodyPath = "M27 99 Q27 70 62 68 Q94 63 122 80 L138 107 Q112 133 57 128 Q29 126 27 99 Z"; hx = 141; hy = 91; rx = 25; ry = 24; root = 110; }
  if (f === "elephant") { bodyPath = "M30 93 Q27 57 74 57 Q113 54 129 78 L130 117 Q99 133 59 124 Q32 124 30 93 Z"; hx = 133; hy = 72; rx = 28; ry = 29; root = 102; foot = 145; legXs = [48, 65, 102, 120]; }
  if (HOOF_FEATURES.includes(f)) {
    bodyPath = "M39 92 Q37 72 68 72 L101 76 Q117 66 126 82 L125 107 Q96 119 61 110 Q39 110 39 92 Z";
    hx = 141; hy = f === "giraffe" ? 31 : 55; rx = 20; ry = 18; root = 96; foot = 145; legXs = [53, 68, 104, 117];
  }
  if (f === "camel") { bodyPath = "M36 99 Q36 84 57 80 Q61 48 78 45 Q97 44 102 79 L127 87 124 110 Q90 121 54 114 Q35 114 36 99 Z"; hx = 145; hy = 51; rx = 17; ry = 17; root = 101; legXs = [49, 65, 105, 118]; }
  if (f === "rabbit") { bodyPath = "M42 109 Q32 81 67 80 Q90 72 120 99 L132 118 Q102 140 58 128 Q41 124 42 109 Z"; hx = 132; hy = 92; rx = 23; ry = 23; root = 117; legXs = [51, 67, 112, 123]; foot = 142; }
  if (f === "mouse" || f === "rat") { bodyPath = "M48 112 Q40 86 72 83 Q106 83 127 104 L128 118 Q99 137 65 128 Q47 126 48 112 Z"; hx = 134; hy = 98; rx = 20; ry = 18; root = 120; legXs = [61, 76, 108, 122]; foot = 141; }
  return { bodyPath, hx, hy, rx, ry, root, legXs, foot, cat, bear };
}

function GuineaPig({ clipId }: { clipId: string }) {
  const silhouette = "M29 120 C20 104 26 80 44 70 C63 59 88 61 108 66 C125 60 143 65 151 75 C163 79 173 93 174 105 C180 110 177 120 165 125 C147 137 124 138 103 137 C77 140 43 137 29 120 Z";
  return <g className="cartoonBody">
    <g className="cartoonFeet" fill="#cb9273"><path d="M47 127 Q43 139 49 143 L64 143 Q66 139 57 135" /><path d="M121 130 Q119 140 125 143 L140 143 Q145 140 132 135" /><path d="M60 139v4 M55 139v4 M133 139v4 M128 139v4" /></g>
    <defs><clipPath id={clipId}><path d={silhouette} /></clipPath></defs>
    <path d={silhouette} fill="#fff3db" />
    <g clipPath={`url(#${clipId})`} stroke="none"><path d="M20 68 Q44 48 79 64 Q71 84 79 103 Q73 116 83 143 L19 148 Z" fill="#975433" /><path d="M104 57 Q122 57 148 67 L183 76 V136 L134 144 Q111 128 115 112 Q109 93 104 57" fill="#b77342" /><path d="M40 84q8-9 19-9 M39 91q5-6 12-7 M90 122q8 5 16 2" stroke="#ddb896" strokeWidth="1.2" /><path d="M145 127q12-2 20-8" stroke="#8c4e30" strokeWidth="1.2" /></g>
    <path d={silhouette} fill="none" />
    <path d="M127 69 C115 59 110 68 114 78 Q117 85 126 83 L132 76" fill="#ad704e" /><path d="M117 70 Q116 77 124 79" fill="none" stroke="#da9d8b" strokeWidth="3" />
    <g className="cartoonBlink" style={{ transformOrigin: "149px 94px" }}><ellipse cx="149" cy="94" rx="5.3" ry="6" fill="#29221f" strokeWidth="1.2" /><circle cx="150" cy="92" r="1.7" fill="#fff" stroke="none" /></g>
    <path d="M164 109 Q170 105 173 110 L168 114 Z" fill="#ce9284" strokeWidth="1.2" /><path d="M168 114v5m0 0-5 2m5-2 5 1" fill="none" strokeWidth="1.4" />
    <path d="M160 115l-13-3m13 7-14 2m26-5 9-3m-8 7 8 2" fill="none" strokeWidth="1" />
  </g>;
}

function Mammal({ p, clipId }: { p: Profile; clipId: string }) {
  const f = p.feature ?? "", d = mammalDesign(p), { hx: x, hy: y, rx, ry } = d;
  const fox = f === "fox", canine = fox || f === "wolf", pointed = canine || ["opossum", "treeshrew", "hedgehog", "mouse", "rat", "lemur", "raccoon", "badger"].includes(f);
  const hoof = HOOF_FEATURES.includes(f), flat = ["capybara", "hippo", "rhino", "boar"].includes(f), color = fox ? "#e39150" : p.color;
  const head = ["opossum", "lemur"].includes(f) ? "#f4efda" : color;
  const muzzle = p.belly;
  const earSize = f === "camel" ? 6 : f === "moonbear" ? 13 : f === "treeshrew" ? 6 : f === "opossum" ? 12 : f === "mouse" ? 16 : f === "rat" ? 10 : f === "capybara" || f === "hippo" ? 7 : d.bear ? 9 : 10;
  return <>
    <defs><clipPath id={clipId}><path d={d.bodyPath} /></clipPath></defs>
    {p.tail > .3 && <g className="cartoonWag" style={{ transformOrigin: "47px 103px" }}>
      {f === "lemur" ? <><path fill="none" stroke="#f6f1e1" strokeWidth="13" d="M47 104 Q15 111 17 77 Q18 50 37 27" /><path fill="none" stroke="#4f514d" strokeWidth="13" strokeDasharray="8 9" strokeLinecap="butt" d="M47 104 Q15 111 17 77 Q18 50 37 27" /></> : canine ? <><path fill={color} d={fox ? "M53 97 C27 111 11 108 9 80 Q12 65 18 55 Q21 80 47 81 L62 94 Z" : "M52 96 Q27 93 17 111 L12 129 Q31 127 56 110 Z"} />{fox && <path fill={CREAM} d="M18 55 Q10 67 9 80 Q12 89 23 92 L28 84 Q21 76 18 55 Z" />}</> :
      f === "raccoon" ? <><path fill="none" stroke={color} strokeWidth="16" d="M52 104 Q21 106 17 76"/><path fill="none" stroke="#55594e" strokeWidth="16" strokeDasharray="8 9" strokeLinecap="butt" d="M52 104 Q21 106 17 76"/></> : f === "treeshrew" ? <path fill={color} d="M57 105 Q29 117 15 98 Q5 85 11 65 L16 71 18 61 23 70 27 67 Q20 91 58 91 Z" /> :
      (f === "opossum" || f === "mouse" || f === "rat") ? <><path fill="none" stroke={INK} strokeWidth="6" d="M54 113 C20 124 6 101 15 69 Q22 49 35 55 Q45 65 30 72" /><path fill="none" stroke="#d69c97" strokeWidth="3.5" d="M54 113 C20 124 6 101 15 69 Q22 49 35 55 Q45 65 30 72" /></> :
      f === "platypus" || f === "beaver" ? <><path fill={f === "beaver" ? "#70513d" : color} d="M54 106 Q26 85 12 100 Q2 116 15 125 Q33 133 57 123 Z" />{f === "beaver" && <path fill="none" strokeWidth="1" d="M14 105 l24 20 M12 115 l23 15 M22 97 l22 22 M14 122 l25-23 M24 127 l21-19" />}</> :
      <><path fill="none" stroke={color} strokeWidth={d.cat ? 5 : 3.5} d={d.cat ? "M44 96 Q18 88 16 57 Q17 43 29 49" : "M43 94 Q23 98 26 120"} />{f === "lion" && <ellipse fill="#9c6035" cx="29" cy="49" rx="6" ry="9" />}{hoof && <path fill={INK} d="M26 116 q-9 11 1 18 q6-12-1-18" />}</>}
    </g>}
    <g className="cartoonFeet">{d.legXs.map((lx, i) => <g key={lx} className={i % 2 ? "cartoonStepBack" : "cartoonStep"} style={{ transformOrigin: `${lx}px ${d.root}px` }}>
      <path fill={f === "panda" ? "#42413f" : color} d={`M${lx - (d.bear ? 9 : 6)} ${d.root} Q${lx - 8} ${d.foot - 15} ${lx - 6} ${d.foot - 5} q-7 4 -3 7 h17 q4-3 0-7 L${lx + 7} ${d.root} Z`} />
      {((hoof && f !== "camel") || f === "bison") && <path fill="#57483d" d={`M${lx-7} ${d.foot-3} h16 v5 h-16 Z`} />}
      {fox && <path fill="#5c463b" d={`M${lx-7} ${d.foot-14} l1 10 -5 3 0 4 18 0 0-6 -2-11 Z`} />}
      {f === "platypus" && <path fill="#a78361" d={`M${lx-6} 134 l-9 7 5 3 4-2 4 3 4-3 5 1 -6-10 Z`} />}
      {!hoof && f !== "platypus" && <path strokeWidth="1" fill="none" d={`M${lx-3} ${d.foot} v2 m5-2 v2`} />}
    </g>)}</g>
    <path fill={color} d={d.bodyPath} />
    {p.pattern && <g clipPath={`url(#${clipId})`} stroke="#604532" strokeWidth="1.5" fill="#604532">
      {p.pattern === "stripes" ? Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${43+i*12} 65 q12 23 1 52 l6-7 q11-23 0-42 Z`} fill={f === "zebra" ? "#393c39" : "#5a3e2c"} />) :
      Array.from({ length: 15 }, (_, i) => { const sx = 53 + i % 5 * 14, sy = 83 + Math.floor(i / 5) * 13; return p.pattern === "patches" ? <path key={i} d={`M${sx} ${sy} l8-3 4 7 -6 6 -7-4 Z`} /> : <ellipse key={i} cx={sx} cy={sy} rx={p.pattern === "rosettes" ? 4.5 : 2.2} ry={p.pattern === "rosettes" ? 3.5 : 2.2} fill={p.pattern === "rosettes" ? color : "#554031"} />; })}
    </g>}
    {f === "jaguar" && <g clipPath={`url(#${clipId})`} fill="#554031" stroke="none">{[0,1,2,3,4,5].map(i=><circle key={i} cx={67+i%3*28} cy={91+Math.floor(i/3)*13} r="1.7"/>)}</g>}
    {fox && <path fill={CREAM} stroke="none" d="M108 89 Q130 91 126 110 L112 116 108 108 101 109 105 100 99 97 Z" />}
    {f === "treeshrew" && <><path fill={p.belly} stroke="none" d="M76 118 Q99 121 126 111 L126 121 Q105 133 77 126 Z" /><path stroke="#e9ce9a" strokeWidth="5" d="M111 99 l-9 17" /></>}
    {f === "opossum" && <path fill="#b6b8aa" stroke="none" d="M52 94 l8-7 4 5 7-9 5 5 8-5 5 7 9-4 8 8 11 1 -4 5 Q80 90 52 100 Z" />}
    {f === "guineapig" && <path fill={CREAM} stroke="none" d="M83 78 Q68 100 88 131 L113 129 Q97 105 112 85 Z" />}
    {f === "hedgehog" && <g fill="#705338">{Array.from({length: 19}, (_,i) => { const a = Math.PI * (1.05 + i / 19 * .9), sx = 81 + Math.cos(a) * 40, sy = 107 + Math.sin(a) * 25; return <path key={i} d={`M${sx-5} ${sy+8} l3-19 8 14 Z`} />; })}</g>}
    {f === "bison" && <><path fill="#573d2d" d="M107 64 Q136 66 146 91 L137 125 127 122 119 132 112 123 104 125 103 112 96 106 Z" /></>}
    {hoof ? <path fill={color} d={f === "giraffe" ? "M106 89 L123 29 Q132 22 142 32 L130 96 Z" : f === "camel" ? "M105 94 Q115 82 119 50 Q122 37 140 43 L142 64 Q129 78 126 108 Z" : "M103 83 L119 50 Q130 41 140 55 L125 102 Z"} /> : null}
    {f === "giraffe" && <g fill="#96623e" stroke="none"><path d="M116 66 l9-4 4 11 -10 6 Z M125 45 l9-2 2 10 -10 3 Z M110 84 l11-5 4 9 -13 6 Z" /></g>}
    {f === "zebra" && <path fill="#3b3c37" d="M111 74 l-2-14 5-15 7 4 -4 13 4 11 Z" />}
    {f === "horse" && <path fill="#6c4534" d="M107 82 Q106 56 123 41 L132 42 Q119 56 121 73 L117 91 Z" />}
    {f === "boar" && <path fill={color} d="M47 87 l-3-17 9 10 2-15 8 12 5-15 7 13 8-8 8 12"/>}
    {f === "hamster" && <path fill={CREAM} stroke="none" d="M59 92 Q50 125 82 131 L124 120 Q101 117 107 91 Z"/>}
    {f === "reindeer" && <path fill={CREAM} stroke="none" d="M109 84 Q120 69 126 58 L135 72 Q134 103 115 107 Z"/>}
    {f === "rabbit" && <ellipse fill={CREAM} cx="43" cy="109" rx="12" ry="11" />}
    {f === "donkey" && <path fill="#655d50" d="M110 75 l-1-16 7-15 7 5 -4 13 3 10 Z" />}
    {f === "lion" && <path fill="#a56735" d="M111 46 l12 5 9-8 12 9 10-1 5 12 10 7 -3 11 5 11 -10 8 -2 13 -12 1 -10 9 -11-6 -12 2 -5-11 -11-5 1-12 -6-10 8-9 Z" />}
    {d.bear && f !== "panda" && <path fill="none" strokeWidth="1.5" d="M50 83 l5-5 m7 0 6-5 M52 101 l5-4" />}
    {f === "panda" && <path fill="#42413f" d="M102 69 Q120 85 123 119 L103 128 Q111 99 92 71 Z" />}
    {["sunbear", "moonbear", "slothbear"].includes(f) && <path fill={f === "sunbear" ? "#e4ad62" : CREAM} stroke="none" d={f === "sunbear" ? "M99 106 Q110 117 127 108 L124 118 Q109 129 99 115 Z" : "M98 106 L110 117 127 106 123 116 110 127 98 116 Z"} />}
    <g className="cartoonHead" style={{ transformOrigin: `${x-14}px ${y+14}px` }}>
      {p.ear > 0 && f !== "platypus" && <>
        {canine ? <><path fill={color} d={`M${x-21} ${y-10} l-2-28 21 22 Z`} /><path fill={color} d={`M${x+1} ${y-19} l16-17 0 30 Z`} /><path fill="#ddb39c" stroke="none" d={`M${x-19} ${y-17} l0-15 10 14 Z`} /></> :
        ["donkey", "zebra", "horse", "rabbit"].includes(f) ? <><path fill={color} d={`M${x-14} ${y-10} q-16-${["donkey","rabbit"].includes(f) ? 40 : 27} -5-${["donkey","rabbit"].includes(f) ? 41 : 29} q12 5 14 31 Z`} /><path fill={color} d={`M${x+1} ${y-11} q2-${["donkey","rabbit"].includes(f) ? 41 : 26} 12-${["donkey","rabbit"].includes(f) ? 37 : 24} q9 10-3 34 Z`} /><path stroke="#dbb9a2" strokeWidth="3" d={`M${x-11} ${y-20} l-5-${["donkey","rabbit"].includes(f) ? 24 : 13}`} /></> :
        ["giraffe","rhino","goat","deer","reindeer"].includes(f) ? <><path fill={head} d={`M${x-15} ${y-12} q-25-18-24-6 q8 15 22 17 Z`}/><path fill={head} d={`M${x+7} ${y-13} q17-19 23-9 q-4 15-19 18 Z`}/></> : f === "elephant" ? null : <><ellipse fill={f === "panda" || f === "opossum" ? "#423e37" : head} cx={x-17} cy={y-ry+1} rx={f === "koala" ? 19 : earSize} ry={f === "koala" ? 20 : earSize} /><ellipse fill={f === "opossum" ? "#4b4239" : "#d5b39b"} stroke="none" cx={x-17} cy={y-ry+1} rx={f === "koala" ? 12 : earSize*.5} ry={f === "koala" ? 13 : earSize*.55} /><ellipse fill={f === "panda" || f === "opossum" ? "#423e37" : head} cx={x+10} cy={y-ry} rx={f === "koala" ? 16 : earSize*.85} ry={f === "koala" ? 17 : earSize} /></>}
      </>}
      {pointed ? <path fill={head} d={`M${x-rx} ${y+8} Q${x-rx-2} ${y-ry} ${x+1} ${y-ry} Q${x+17} ${y-ry+3} ${x+22} ${y-2} L${x+43} ${y+11} Q${x+47} ${y+19} ${x+24} ${y+22} Q${x-10} ${y+29} ${x-rx} ${y+8} Z`} /> :
      flat ? <path fill={head} d={`M${x-rx} ${y-5} Q${x-rx} ${y-ry} ${x+5} ${y-ry} Q${x+26} ${y-ry+4} ${x+30} ${y-6} L${x+37} ${y+5} Q${x+44} ${y+25} ${x+18} ${y+27} L${x-6} ${y+22} Q${x-rx} ${y+15} ${x-rx} ${y-5} Z`} /> :
      <ellipse fill={head} cx={x} cy={y} rx={rx} ry={ry} />}
      {["opossum","lemur"].includes(f) && <><path fill="#626457" stroke="none" d={`M${x-9} ${y-17} q10-8 19 2 l-4 9 -10-1 Z`} /><ellipse fill="#5d5b50" stroke="none" cx={x+3} cy={y-1} rx="11" ry="12" /></>}
      {f === "raccoon" && <path fill="#4e554d" stroke="none" d={`M${x-19} ${y-4} Q${x+3} ${y-18} ${x+25} ${y-4} L${x+25} ${y+5} Q${x+1} ${y+14} ${x-17} ${y+6} Z`}/>}
      {f === "badger" && <><path fill="#eee9d7" stroke="none" d={`M${x-19} ${y-12} Q${x+1} ${y-27} ${x+24} ${y-4} L${x+36} ${y+11} ${x+23} ${y+20} Q${x+1} ${y+13} ${x-19} ${y-12} Z`}/><path fill="#42483f" stroke="none" d={`M${x-12} ${y-15} Q${x+4} ${y-9} ${x+30} ${y+10} L${x+22} ${y+14} Q${x+6} ${y+5} ${x-12} ${y-6} Z`}/></>}
      {f === "panda" && <ellipse fill="#42413f" cx={x+3} cy={y-1} rx="12" ry="15" transform={`rotate(-18 ${x+3} ${y-1})`} />}
      {f === "spectacledbear" && <><path fill="none" stroke="#e8d4ae" strokeWidth="5" d={`M${x-7} ${y-8} q10-13 19 0 q7 16-5 16 q-10 0-12-10`} /><path fill="#e8d4ae" stroke="none" d={`M${x+10} ${y+8} l15 0 9 13 -16 5 Z`} /></>}
      {f === "elephant" ? <><path fill={color} d={`M${x-8} ${y-19} C${x-47} ${y-34} ${x-48} ${y+28} ${x-18} ${y+34} Q${x+4} ${y+11} ${x-8} ${y-19} Z`} /><path fill={color} d={`M${x+19} ${y+3} q16 26 7 52 q-9 12-18 1 q-3-8 3-13 q-2 12 6 6 q7-11-8-27 Z`} /><path fill={CREAM} d={`M${x+9} ${y+17} q19 22 27-1 q-8 12-20-10 Z`} /></> :
      f === "platypus" ? <><path fill="#9caeaa" d={`M${x+5} ${y+1} Q${x+29} ${y-3} ${x+54} ${y+7} Q${x+61} ${y+19} ${x+41} ${y+23} Q${x+18} ${y+26} ${x+6} ${y+12} Z`} /><path fill="none" strokeWidth="1.3" d={`M${x+21} ${y+17} q17 6 29-2`} /><circle fill={INK} stroke="none" cx={x+43} cy={y+8} r="1.6" /></> :
      f === "koala" ? <ellipse fill="#414b48" cx={x+15} cy={y+6} rx="10" ry="14" /> :
      !pointed && !flat ? <path fill={hoof ? "#e1d4bc" : d.bear || d.cat ? muzzle : head} d={`M${x+4} ${y+6} Q${x+13} ${y+1} ${x+29} ${y+8} Q${x+39} ${y+19} ${x+18} ${y+24} Q${x+1} ${y+22} ${x+4} ${y+6} Z`} /> :
      canine ? <path fill={p.belly} stroke="none" d={`M${x-6} ${y+8} L${x+19} ${y+5} ${x+43} ${y+12} Q${x+38} ${y+23} ${x+15} ${y+22} L${x-6} ${y+8} Z`} /> : null}
      {f === "boar" && <><ellipse fill="#b7997d" cx={x+30} cy={y+11} rx="12" ry="9"/><circle fill={INK} stroke="none" cx={x+26} cy={y+10} r="2"/><circle fill={INK} stroke="none" cx={x+33} cy={y+10} r="2"/><path fill={CREAM} d={`M${x+18} ${y+22} q-13-4-8-17 q-1 9 11 10 Z`}/></>}
      {f === "bison" && <g data-anatomy="visible-horns"><path fill="#e1d3af" d={`M${x-16} ${y-18} Q${x-31} ${y-24} ${x-26} ${y-39} Q${x-22} ${y-28} ${x-9} ${y-25} Z M${x+13} ${y-20} Q${x+29} ${y-26} ${x+22} ${y-40} Q${x+37} ${y-28} ${x+20} ${y-12} Z`}/><path fill="#4b3428" stroke="none" d={`M${x-20} ${y-15} l6-11 5 9 7-10 6 9 8-5 7 13 -7-2 -4 7 -6-6 -9 4 -5-8 Z`}/><path fill="#573d2d" d={`M${x+11} ${y+21} l-4 17 11-8 5-12 Z`}/></g>}
      {f === "hippo" && <g data-anatomy="broad-muzzle"><path fill="#ad9a9c" d={`M${x+10} ${y+2} Q${x+29} ${y-2} ${x+43} ${y+6} L${x+43} ${y+20} Q${x+24} ${y+33} ${x+6} ${y+20} Z`}/><ellipse fill={INK} stroke="none" cx={x+25} cy={y+7} rx="2.5" ry="2"/><ellipse fill={INK} stroke="none" cx={x+37} cy={y+8} rx="2.5" ry="2"/><path fill="none" strokeWidth="1.5" d={`M${x+10} ${y+20} q17 7 30-2`}/></g>}
      {f === "rhino" && <><path fill="#e9ddc4" d={`M${x+24} ${y+6} Q${x+24} ${y-9} ${x+37} ${y-23} L${x+35} ${y+11} Z`} /><path fill="#e9ddc4" d={`M${x+15} ${y+4} l4-15 6 17 Z`} /></>}
      {f === "goat" && <><path fill="#937d62" d={`M${x-9} ${y-15} Q${x-14} ${y-37} ${x-27} ${y-32} Q${x-20} ${y-27} ${x-17} ${y-12} Z`}/><path fill="#937d62" d={`M${x+4} ${y-17} Q${x+1} ${y-37} ${x-10} ${y-35} Q${x-4} ${y-28} ${x-3} ${y-15} Z`}/><path fill={p.belly} d={`M${x+17} ${y+20} l-3 14 10-9 7-4 Z`}/></>}
      {["deer","reindeer"].includes(f) && <g fill="none" stroke="#7c5b3e" strokeWidth="4"><path d={`M${x-8} ${y-15} l-10-20 -5-11 m9 27 -15-7 m11 1 -1-15 M${x+4} ${y-17} l5-17 9-12 m-12 20 13-3 m-12-4 -5-12`}/>{f === "reindeer" && <path d={`M${x-22} ${y-34} l-11-6 m5 9 -8-1 M${x+12} ${y-36} l9-4`}/>}</g>}
      {f === "giraffe" && <><path strokeWidth="4" d="M133 16 l-2-8 m11 9 3-9" /><circle fill="#94623e" cx="131" cy="7" r="3" /><circle fill="#94623e" cx="145" cy="7" r="3" /></>}
      {f === "zebra" && <path fill="#393c39" stroke="none" d={`M${x-15} ${y-14} l8 3 -1 10 -8-1 Z M${x+1} ${y-18} l6 3 -2 7 -6-1 Z`} />}
      <Eye x={x + (flat ? 5 : 3)} y={y - 3} size={f === "platypus" ? 6 : pointed ? 7 : 8} />
      {f !== "platypus" && f !== "elephant" && f !== "koala" && f !== "hippo" && <ellipse fill={f === "opossum" ? "#dc989e" : INK} stroke="none" cx={x + (pointed ? 42 : flat ? 33 : 29)} cy={y + (pointed ? 12 : 10)} rx={pointed ? 3 : 4} ry="3" />}
      <path fill="none" strokeWidth="1.5" d={`M${x-3} ${y-16} q7-4 12 0 M${x+18} ${y+19} q6 5 12 0`} />
      <ellipse fill="#e6a594" opacity=".5" stroke="none" cx={x-2} cy={y+10} rx="5" ry="3" />
      {(d.cat || ["opossum","mouse","rabbit"].includes(f)) && <path fill="none" strokeWidth="1.1" d={`M${x+21} ${y+12} l-18-3 m19 8 -19 2`} />}
      {f === "cheetah" && <path fill="none" stroke="#4c392d" strokeWidth="3" d={`M${x+10} ${y+2} q-2 10 6 17`} />}
      {f === "tiger" && <g fill="#5a3e2c" stroke="none"><path d={`M${x-16} ${y-15} l10 3 -1 5 -12-2 Z M${x+2} ${y-21} l5 2 -1 7 -4 1 Z M${x-20} ${y+1} l11 3 -2 4 -10-1 Z`} /></g>}
      {f === "beaver" && <path fill={CREAM} d={`M${x+22} ${y+20} v9 h7 v-9 m-3 0 v8`} />}
    </g>
  </>;
}

function Pinniped({ p }: { p: Profile }) {
  const lion = p.feature === "sealion";
  return <>
    <g className="cartoonWag" style={{transformOrigin:"52px 125px"}}><path fill={p.color} d="M66 117 Q33 109 14 128 L31 131 14 141 Q38 149 66 130 Z"/></g>
    <path fill={p.color} d={lion ? "M46 127 Q59 102 98 94 Q116 80 117 57 L143 64 Q157 102 134 126 Q107 145 46 138 Z" : "M37 128 Q45 91 100 94 Q120 88 149 103 Q178 112 167 131 Q143 150 37 138 Z"}/>
    <path fill={p.belly} stroke="none" d="M56 132 Q99 118 141 123 L153 134 Q108 146 56 139 Z"/>
    {!lion && <g fill="#797f76" stroke="none">{Array.from({length:12},(_,i)=><ellipse key={i} cx={59+i%6*14} cy={105+Math.floor(i/6)*13} rx="3" ry="2"/>)}</g>}
    <path className="cartoonWing" style={{transformOrigin:"116px 122px"}} fill={p.color} d={lion ? "M110 116 Q135 124 145 145 L164 148 Q170 140 154 133 L132 108 Z" : "M101 115 Q112 134 95 146 Q105 154 122 140 L127 118 Z"}/>
    <g className="cartoonHead" style={{transformOrigin:lion?"135px 67px":"147px 106px"}}>
      {lion && <ellipse fill={p.color} cx="120" cy="55" rx="5" ry="7"/>}
      <ellipse fill={p.color} cx={lion?140:153} cy={lion?61:106} rx={lion?24:25} ry="21"/>
      <ellipse fill={p.belly} cx={lion?154:168} cy={lion?73:118} rx="14" ry="9"/>
      <Eye x={lion?147:157} y={lion?55:100} size={7}/>
      <ellipse fill={INK} stroke="none" cx={lion?164:178} cy={lion?69:115} rx="4" ry="3"/>
      <path fill="none" strokeWidth="1.1" d={lion?"M153 77 l-19-3 m20 7 -18 3 m23-4 12 3":"M166 119 l-18-4 m18 9 -18 3 m20-3 16 3"}/>
    </g>
  </>;
}

function Bat({ p }: { p: Profile }) {
  const fox = p.feature === "flyingfox";
  return <>
    <g className="cartoonWing" style={{transformOrigin:"88px 80px"}}><path fill={p.color} d="M91 78 Q67 42 15 32 L30 79 Q47 64 57 103 Q72 87 90 130 L97 87 Z"/><path fill="none" stroke="#cfb38b" strokeWidth="1.3" d="M89 82 L20 39 M89 84 L36 75 M91 87 L59 99"/></g>
    <g className="cartoonWing" style={{transformOrigin:"111px 80px"}}><path fill={p.color} d="M109 78 Q133 42 185 32 L170 79 Q153 64 143 103 Q128 87 110 130 L103 87 Z"/><path fill="none" stroke="#cfb38b" strokeWidth="1.3" d="M111 82 L180 39 M111 84 L164 75 M109 87 L141 99"/></g>
    <ellipse fill={p.color} cx="100" cy="102" rx="19" ry="31"/>
    <ellipse fill={p.belly} stroke="none" cx="100" cy="102" rx="11" ry="24"/>
    <g className="cartoonFeet" fill={p.color}><path d="M87 121 l-4 20 8-3 4-14 M105 124 l4 16 8 2 -5-21"/></g>
    <g className="cartoonHead" style={{transformOrigin:"100px 76px"}}>
      <path fill={p.color} d={fox?"M83 66 L74 39 94 54 M107 55 l20-17 -9 32":"M83 64 Q65 28 80 24 Q92 31 94 58 M107 57 Q113 25 126 25 Q137 39 118 67"}/>
      <ellipse fill={fox?p.belly:p.color} cx="100" cy="70" rx="24" ry="22"/>
      <Eye x={91} y={65} size={6}/><Eye x={110} y={65} size={6}/>
      <path fill={fox?"#7b573e":p.belly} d="M93 76 Q100 71 109 76 L112 84 Q101 94 89 84 Z"/>
      <ellipse fill={INK} stroke="none" cx="101" cy="78" rx="4" ry="3"/>
      <path fill="none" strokeWidth="1.4" d="M94 85 q7 5 14 0"/>
    </g>
  </>;
}

function SmallSpecialist({ p }: { p: Profile }) {
  const echidna = p.feature === "echidna", anteater = p.feature === "anteater";
  const color = p.color;
  return <>
    {anteater ? <g className="cartoonWag" style={{transformOrigin:"58px 108px"}}><path fill={color} d="M69 92 Q25 70 10 115 L13 140 29 135 43 141 57 131 75 120 Z"/><path fill="none" stroke="#8c795f" strokeWidth="1.2" d="M21 130 l24-37 M34 132 l21-31"/></g> : !echidna && <path className="cartoonWag" fill={color} d="M55 116 Q34 132 10 136 Q28 149 65 129 Z"/>}
    <g className="cartoonFeet" fill={color}><path d="M58 110 L52 139 h19 l1-25 M106 109 l3 30 h19 l-6-25"/><path fill="none" strokeWidth="1.1" d="M55 137 l0 5 m5-5 0 5 m5-5 0 5 M114 137v5 m5-5v5"/></g>
    <path fill={color} d={anteater ? "M45 109 Q51 76 90 75 Q117 74 136 94 L126 119 Q88 138 45 120 Z" : "M37 115 Q35 74 83 71 Q124 68 133 112 Q94 144 37 128 Z"}/>
    {echidna ? <g fill="#e3d1a5">{Array.from({length:18},(_,i)=>{const a=Math.PI*(1.06+i/18*.83),x=84+Math.cos(a)*40,y=114+Math.sin(a)*28;return <path key={i} d={`M${x-5} ${y+9} l2-23 10 19 Z`}/>;})}</g> : anteater ? <><path fill="#453f37" d="M62 95 L84 85 116 92 106 123 98 127 95 101 74 109 Z"/><path fill="none" stroke={CREAM} strokeWidth="3" d="M62 94 L84 83 117 90 107 124"/></> : <><path fill="#c6b69e" d="M38 108 Q40 78 77 73 Q108 70 126 96 L117 123 70 130 39 124 Z"/><g fill="none" stroke="#817461" strokeWidth="2">{Array.from({length:9},(_,i)=><path key={i} d={`M${58+i*5} ${79-Math.sin(i/8*Math.PI)*6} q-9 19 0 ${42+Math.sin(i/8*Math.PI)*3}`}/>)}</g></>}
    <g className="cartoonHead" style={{transformOrigin:"127px 110px"}}>
      {!echidna && <path fill={color} d={anteater?"M126 96 q-4-16 6-13 l5 15 Z":"M125 96 q-13-32-2-34 q14 8 11 31 Z"}/>}
      <path fill={color} d={anteater?"M111 102 Q119 83 141 92 L188 122 Q194 130 182 130 L135 116 113 118 Z":echidna?"M111 108 Q120 90 143 101 L184 129 Q188 136 178 136 L139 120 115 125 Z":"M113 104 Q123 88 142 101 L171 123 Q172 132 156 133 L122 124 Z"}/>
      <Eye x={anteater?133:135} y={anteater?101:108} size={6}/>
      <circle fill={INK} stroke="none" cx={anteater?188:echidna?183:168} cy={anteater?126:echidna?132:127} r="2.5"/>
      <path fill="none" strokeWidth="1.2" d={anteater?"M158 118 l25 9":echidna?"M154 122 l22 11":"M150 124q10 8 17 3"}/>
    </g>
  </>;
}

function UprightMammal({ p }: { p: Profile }) {
  const otter = p.feature === "seaotter";
  return <>
    <path fill={p.color} d={otter?"M77 114 Q50 135 26 137 Q39 151 89 131 Z":"M86 112 Q54 136 29 144 Q53 149 99 127 Z"}/>
    <g className="cartoonFeet" fill={p.color}><path d="M75 118 l-5 24 24 1 4-20 M107 122 l3 20 24-1 -12-25"/></g>
    <path fill={p.color} d="M70 95 Q69 63 100 63 Q130 66 130 100 L119 130 Q95 144 74 127 Z"/>
    <ellipse fill={p.belly} stroke="none" cx="101" cy="106" rx="19" ry="27"/>
    <path className="cartoonArm" style={{transformOrigin:"76px 86px"}} fill={p.color} d="M73 79 Q58 97 80 109 L102 112 105 103 84 96 91 83 Z"/>
    <path fill={p.color} d="M120 80 Q138 96 116 110 L99 112 96 103 114 95 107 83 Z"/>
    <g className="cartoonHead" style={{transformOrigin:"102px 65px"}}>
      <ellipse fill={p.color} cx="78" cy="43" rx="7" ry="8"/><ellipse fill={p.color} cx="122" cy="43" rx="7" ry="8"/>
      <ellipse fill={otter?"#c5ae86":p.color} cx="101" cy="53" rx="28" ry="25"/>
      {!otter && <><ellipse fill="#635543" stroke="none" cx="89" cy="49" rx="10" ry="9"/><ellipse fill="#635543" stroke="none" cx="114" cy="49" rx="10" ry="9"/></>}
      <Eye x={89} y={49} size={6}/><Eye x={113} y={49} size={6}/>
      <ellipse fill={p.belly} cx="101" cy="64" rx="14" ry="9"/><ellipse fill={INK} stroke="none" cx="101" cy="59" rx="4" ry="3"/>
      <path fill="none" strokeWidth="1.2" d="M94 66 q7 5 14 0 M89 62 l-14-2 m15 6 -15 3 m38-7 14-3 m-14 8 15 2"/>
    </g>
  </>;
}

function Kangaroo({ p }: { p: Profile }) {
  return <>
    <path fill={p.color} d="M87 102 Q52 142 13 143 Q43 125 70 87 Z" />
    <path fill={p.color} d="M75 78 Q102 64 123 85 L120 118 Q113 139 82 130 Q66 111 75 78 Z" />
    <path fill={p.belly} stroke="none" d="M113 88 Q123 112 109 127 Q93 118 98 91 Z" />
    <g className="cartoonFeet"><path fill={p.color} d="M82 104 Q58 109 66 129 L83 135 112 136 Q127 146 107 147 L77 146 Q57 134 62 119 Z" /><path fill={p.color} d="M103 110 Q90 119 103 133 L132 136 Q145 145 131 147 L96 143 84 125 Z" /></g>
    <path fill={p.color} d="M101 88 L114 48 Q128 42 138 57 L122 99 Z" />
    <g className="cartoonHead" style={{ transformOrigin: "121px 66px" }}><path fill={p.color} d="M117 47 Q99 9 111 8 Q122 16 125 43 M130 43 Q130 9 141 12 Q149 26 139 51" /><path stroke="#d8a58d" strokeWidth="3" d="M115 17 l7 22 m17-18 -4 21" /><path fill={p.color} d="M111 57 Q108 36 132 37 Q149 39 154 52 L176 62 Q181 76 152 75 Q121 80 111 57 Z" /><Eye x={137} y={51} size={7} /><ellipse cx="175" cy="63" rx="3" ry="2.5" fill={INK} stroke="none" /><path fill="none" strokeWidth="1.5" d="M152 69 q10 6 16 0" /></g>
    <path className="cartoonArm" style={{transformOrigin:"119px 82px"}} fill={p.color} d="M119 80 Q136 93 130 107 Q124 115 118 106 L112 91 Z" />
  </>;
}

function Primate({ p }: { p: Profile }) {
  const f = p.feature, gorilla = f === "gorilla", orang = f === "orangutan", monkey = f === "macaque", color = p.color;
  const bodyPath = gorilla ? "M56 76 Q57 44 91 47 Q125 43 135 77 L124 127 Q91 142 64 121 Z" : orang ? "M66 81 Q67 55 95 58 Q120 58 126 84 L119 126 Q93 140 71 124 Z" : "M73 83 Q68 58 92 57 Q115 56 120 84 L113 123 Q91 138 76 122 Z";
  return <>
    {monkey && <path className="cartoonWag" fill="none" stroke={color} strokeWidth="7" d="M80 110 Q35 135 34 91 Q31 71 46 72" />}
    <g className="cartoonFeet" fill={color}><path d="M78 115 L73 136 Q62 144 79 146 L91 145 96 119 Z" /><path d="M107 116 L113 138 Q130 143 116 147 L102 144 96 120 Z" /></g>
    <path fill={color} d={bodyPath} />
    {gorilla && <path fill="#87938d" stroke="none" d="M68 71 Q82 58 101 64 L93 119 77 116 Z" />}
    <path className="cartoonArm" style={{ transformOrigin: "74px 76px" }} fill={color} d={gorilla ? "M69 64 Q43 75 46 119 L39 136 Q48 148 61 137 L64 110 84 82 Z" : orang ? "M74 69 Q43 81 46 126 L39 137 Q46 150 57 139 L63 109 84 84 Z" : "M78 69 Q53 83 58 115 L53 132 Q61 144 72 133 L73 112 87 84 Z"} />
    <path fill={color} d="M109 71 Q138 87 134 113 L140 132 Q131 145 122 132 L120 113 103 85 Z" />
    <g className="cartoonHead" style={{ transformOrigin: "95px 62px" }}>
      <ellipse fill={color} cx="73" cy="48" rx="9" ry="11" /><ellipse fill={color} cx="120" cy="47" rx="8" ry="10" />
      <path fill={color} d={gorilla ? "M69 53 Q64 24 87 19 L100 16 Q131 24 126 53 Q121 77 95 76 Q75 74 69 53 Z" : orang ? "M64 47 Q65 23 92 23 Q123 18 128 44 Q133 73 97 78 Q63 77 64 47 Z" : "M73 52 Q67 26 94 23 Q119 23 122 48 Q124 74 97 75 Q77 73 73 52 Z"} />
      <path fill={gorilla ? "#656e68" : monkey ? "#d6a89c" : orang ? "#9a7157" : "#be9d83"} d="M77 45 Q75 32 91 39 Q103 31 115 43 L115 59 Q112 75 97 71 Q78 71 77 57 Z" />
      <Eye x={87} y={46} size={6} /><Eye x={106} y={46} size={6} />
      <ellipse fill={gorilla ? "#3b433e" : p.belly} cx="98" cy="60" rx="12" ry="8" />
      <path fill="none" strokeWidth="2" d="M94 55 l-1 3 m8-3 1 3 M89 64 q9 6 17 0" />
      {gorilla && <path fill="none" strokeWidth="3" d="M79 36 q18-7 35 0" />}
      {orang && <path fill="none" strokeWidth="1.5" d="M66 51 l-3 8 5-2 M124 50 l5 7-5 1" />}
    </g>
  </>;
}

function Swift({ p }: { p: Profile }) {
  return <>
    <path fill={p.color} d="M65 101 L30 113 48 93 32 80 73 86 Z" />
    <path className="cartoonWing" style={{transformOrigin:"104px 94px"}} fill={p.color} d="M93 90 Q79 46 41 26 Q88 30 123 86 Z" />
    <path fill={p.color} d="M53 95 Q72 74 115 84 Q153 82 163 99 Q154 117 112 115 Q75 119 53 95 Z" />
    <path fill={p.belly} stroke="none" d="M131 103 Q150 110 161 100 Q154 117 135 113 Z" />
    <path className="cartoonWing" style={{transformOrigin:"99px 99px"}} fill={p.color} d="M111 94 Q119 124 166 146 Q113 146 80 104 Z" />
    <g className="cartoonHead" style={{transformOrigin:"147px 101px"}}><Eye x={149} y={94} size={6}/><path fill="#746047" d="M161 96 l14 4 -13 6 Z"/><path fill="none" strokeWidth="1.2" d="M145 83 q6-3 11 0"/></g>
  </>;
}

function Bird({ p }: { p: Profile }) {
  const f = p.feature ?? "", ostrich = f === "ostrich", emu = f === "emu", heron = f === "heron", tall = ostrich || emu || heron;
  const penguin = p.kind === "penguin", duck = ["mallard", "eider", "goose"].includes(f), goose = f === "goose", owl = f === "owl", parrot = f === "macaw";
  const raptor = ["eagle", "baldeagle", "falcon"].includes(f), sea = ["gull", "blackheadedgull", "tern", "albatross", "oystercatcher", "pelican", "cormorant"].includes(f);
  if (f === "swift") return <Swift p={p} />;
  const color = p.color, neckColor = ostrich ? "#d9aa97" : emu ? "#73888b" : heron ? "#e9ece1" : color;
  const bx = tall ? 85 : penguin ? 99 : duck ? 81 : 90, by = tall ? 86 : penguin ? 93 : duck ? 109 : sea ? 98 : 99;
  const brx = tall ? heron ? 28 : 39 : penguin ? 27 : duck ? 43 : owl ? 30 : f === "albatross" || f === "pelican" ? 43 : raptor ? 34 : 32, bry = tall ? 25 : penguin ? 43 : duck ? 24 : owl ? 38 : raptor ? 35 : 31;
  const hx = tall ? 134 : penguin ? 106 : goose ? 129 : duck ? 127 : owl ? 102 : parrot ? 117 : 120;
  const hy = tall ? 24 : penguin ? 49 : goose ? 61 : duck ? 96 : owl ? 61 : parrot ? 56 : 68;
  const hr = tall ? 13 : penguin ? 23 : duck ? 22 : owl ? 30 : parrot ? 25 : 22;
  const legTop = by + 12, legColor = tall ? ostrich ? "#d4a28e" : "#8e8b72" : penguin || duck ? "#dca550" : f === "oystercatcher" ? "#d67a69" : "#b39168";
  return <>
    <g className="cartoonFeet">{[bx-11,bx+11].map((lx,i) => <g key={lx} className={i ? "cartoonStepBack" : "cartoonStep"} style={{ transformOrigin: `${lx}px ${legTop}px` }}>
      {tall ? <><path fill={legColor} d={`M${lx-3} ${legTop} L${lx+1} 121 ${lx-3} 140 Q${lx-5} 146 ${lx+2} 145 L${lx+5} 124 ${lx+4} ${legTop} Z`} /><path fill="none" stroke={legColor} strokeWidth="4" d={`M${lx} 144 l12 1 m-12-1 5-5 ${ostrich ? '' : `m-5 5 -7 1`}`} /><path strokeWidth="1" d={`M${lx+11} 145 l3-1`} /></> :
      duck || penguin ? <path fill={legColor} d={`M${lx-4} ${legTop} l0 ${penguin ? 28 : 10} -9 9 5 3 5-2 4 3 6-3 5 0 -8-10 -1-${penguin ? 28 : 10} Z`} /> : <><path fill="none" stroke={legColor} strokeWidth="4" d={`M${lx} ${legTop} l-2 26 0 7 m0 0 -8 2 m8-2 10 1 m-10-1 4-4`} /></>}
    </g>)}</g>
    {!penguin && <path fill={tall ? ostrich ? CREAM : color : f === "rooster" ? "#43716b" : f === "baldeagle" ? CREAM : color} d={tall ? "M51 80 Q33 79 37 95 L58 101 Z" : f === "rooster" ? "M66 99 Q29 104 28 61 Q41 67 49 88 Q31 56 45 47 Q57 68 62 89 Z" : f === "swallow" || f === "tern" ? "M66 100 L28 130 42 106 23 101 62 88 Z" : parrot ? "M75 100 L58 148 83 124 94 111 Z" : "M65 97 L39 80 45 107 71 115 Z"} />}
    <ellipse fill={color} cx={bx} cy={by} rx={brx} ry={bry} />
    {tall && <path fill={neckColor} data-anatomy="long-neck" d={heron ? "M106 83 Q138 78 125 57 Q109 35 125 20 L140 25 Q126 38 139 58 Q153 84 113 104 Z" : "M109 83 Q124 57 125 25 L139 23 Q143 64 122 101 Z"} />}
    {(goose || f === "cormorant" || f === "pelican") && <path fill={color} d={goose ? "M100 112 Q126 103 116 62 L135 60 Q148 116 110 129 Z" : "M108 98 Q130 86 117 60 L134 62 Q146 94 117 117 Z"} />}
    {(penguin || duck || ["gull", "tern", "blackheadedgull", "heron", "oystercatcher", "falcon", "albatross", "swallow", "lapwing", "pigeon"].includes(f)) && <ellipse fill={p.belly} stroke="none" cx={bx+7} cy={by+7} rx={penguin ? 18 : brx*.75} ry={penguin ? 34 : bry*.67} />}
    <g className="cartoonWing" style={{ transformOrigin: `${bx+4}px ${by-13}px` }}>
      <path fill={ostrich ? CREAM : penguin ? color : f === "mallard" ? "#918879" : f === "eider" ? CREAM : f === "albatross" ? "#5b5d58" : color} d={penguin ? `M${bx-12} ${by-22} Q${bx-42} ${by+17} ${bx-27} ${by+30} Q${bx-13} ${by+6} ${bx-9} ${by-16} Z` : `M${bx+9} ${by-18} Q${bx-28} ${by-23} ${bx-27} ${by+4} Q${bx-27} ${by+23} ${bx+17} ${by+4} Q${bx-6} ${by+16} ${bx-13} ${by+5} Q${bx+7} ${by+6} ${bx+9} ${by-18} Z`} />
      {parrot && <><path stroke="none" fill="#e6c75c" d="M73 83 Q101 81 105 99 L69 111 Z" /><path stroke="none" fill="#477e9d" d="M69 100 Q88 108 109 96 L75 119 65 113 Z" /></>}
      {f === "mallard" && <path stroke="none" fill="#48799a" d="M60 109 l25-6 0 9 -22 5 Z" />}
      {emu && <path fill="none" stroke="#a7977c" strokeWidth="2" d="M62 78 l-2 13 m9-18 -1 14 m10-14 -2 16 m11-14 -3 18 M57 94 l2 11 m8-7 1 11 m9-7 1 9" />}
      {f === "lark" || f === "starling" || owl || raptor ? <g stroke={f === "starling" ? "#cabd8e" : p.belly} strokeWidth="1.5"><path d={`M${bx-14} ${by-13} l2 6 m7-9 2 6 m6-7 2 5 m-19 9 3 6 m7-7 2 5`} /></g> : null}
    </g>
    {f === "pigeon" && <path fill="none" stroke={CREAM} strokeWidth="5" d="M109 82 q9 8 16 5" />}
    {f === "starling" && <g fill="#e0d0a3" stroke="none">{Array.from({length:16},(_,i)=><ellipse key={i} cx={70+i%4*10} cy={89+Math.floor(i/4)*10} rx="1.3" ry="2" />)}</g>}
    {f === "africanpenguin" && <path fill="none" stroke={color} strokeWidth="5" d="M85 82 Q111 69 116 99" />}
    {f === "kingpenguin" && <path fill="#efb754" stroke="none" d="M99 68 Q115 74 115 92 L104 82 Z" />}
    <g className="cartoonHead" style={{ transformOrigin: `${hx-8}px ${hy+12}px` }}>
      <ellipse fill={f === "baldeagle" || ["gull", "albatross", "tern"].includes(f) ? CREAM : f === "mallard" ? "#4c8d68" : f === "blackheadedgull" ? "#625044" : tall ? neckColor : color} cx={hx} cy={hy} rx={hr} ry={tall ? 12 : owl ? 27 : 22} />
      {f === "mallard" && <path fill="none" stroke={CREAM} strokeWidth="4" d="M114 112 q12 10 25 1" />}
      {f === "eider" && <><path fill={CREAM} stroke="none" d="M108 93 Q108 69 132 76 L144 88 123 94 Z" /><path fill="#839881" stroke="none" d="M109 92 l9-3 5 11 -7 6 Z"/><path fill="#353b39" stroke="none" d="M109 86 Q120 67 138 80 L141 88 123 88 Z"/></>}
      {f === "baldeagle" && <path fill={CREAM} stroke="none" d="M102 69 l-2 22 8-4 6 7 4-8 7 3 6-7 8 2 -4-15 Z" />}
      {f === "rook" && <><path fill={color} d="M104 56 l9-17 13 12 Z" /><path fill="#cbc8b6" stroke="none" d="M133 65 l9 4 0 14 -9-3 Z" /></>}
      {f === "lark" && <path fill={color} d="M104 50 l5-13 12 13 Z" />}
      {f === "tern" && <path fill="#3e4546" stroke="none" d="M100 64 Q110 42 128 50 L135 64 Z" />}
      {f === "falcon" && <path fill="#3a515b" stroke="none" d="M128 67 l5 19 -8-1 -4-16 Z" />}
      {f === "cardinal" && <><path fill={color} d="M103 51 L113 27 128 51 Z" /><path fill="#493b35" stroke="none" d="M121 61 Q137 61 140 73 L129 84 121 72 Z" /></>}
      {f === "lapwing" && <path fill="none" stroke={color} strokeWidth="3" d="M111 50 Q104 30 92 26" />}
      {f === "rooster" && <><path fill="#ce5948" d="M105 51 q-6-17 3-15 q6-12 10 0 q11-6 12 12 Z" /><path fill="#ce5948" d="M138 75 q8 9-2 16 q-10-1-5-12 Z" /></>}
      {f === "swallow" && <path fill="#b37b55" stroke="none" d="M125 73 l15 2 -5 11 -12-5 Z" />}
      {penguin && <>
        {f === "gentoo" ? <path fill={CREAM} stroke="none" d="M90 36 Q112 23 120 41 L110 44 Q103 33 91 42 Z" /> : f === "kingpenguin" ? <path fill="#edb256" stroke="none" d="M91 57 q9 13 20 7 l-7 11 -12-4 Z" /> : <path fill={CREAM} stroke="none" d="M88 33 Q105 24 120 38 L116 42 Q101 32 91 42 L88 59 96 65 91 71 Q79 57 88 33 Z" />}
      </>}
      {parrot && <path fill={CREAM} d="M119 41 Q139 38 142 60 L130 72 113 63 Z" />}
      {owl ? <><path fill={color} d="M79 44 l-1-19 17 15 M117 40 l18-17 -3 25" /><ellipse fill={p.belly} cx="91" cy="61" rx="16" ry="20" /><ellipse fill={p.belly} cx="113" cy="61" rx="16" ry="20" /><Eye x={91} y={60} size={8} /><Eye x={114} y={60} size={8} /><path fill="#c79c57" d="M98 70 l9 0 -4 9 Z" /></> : <>
        <Eye x={hx+4} y={hy-2} size={tall ? 5.5 : parrot ? 7 : 7.5} />
        {duck ? <path fill="#d9ad66" d={`M${hx+14} ${hy+4} Q${hx+34} ${hy+2} ${hx+45} ${hy+10} Q${hx+47} ${hy+18} ${hx+17} ${hy+17} Z`} /> :
        parrot || raptor ? <path fill={parrot ? "#e6cfa8" : "#dcb864"} d={`M${hx+15} ${hy+2} Q${hx+37} ${hy-2} ${hx+35} ${hy+12} L${hx+23} ${hy+23} ${hx+22} ${hy+12} ${hx+15} ${hy+11} Z`} /> :
        f === "pelican" ? <><path fill="#d2b97b" d={`M${hx+15} ${hy+4} l47 4 -44 8 Z`} /><path fill="#d3bd93" d={`M${hx+16} ${hy+12} q35 34 45-4 L${hx+16} ${hy+12} Z`} /></> :
        <path fill={f === "oystercatcher" || f === "tern" || penguin ? "#dba064" : tall ? "#b99c7b" : ["crow", "rook", "cormorant"].includes(f) ? "#53504a" : "#d8b066"} d={`M${hx+hr-4} ${hy+3} l${heron ? 39 : sea ? 28 : tall ? 15 : 18} 5 -${heron ? 39 : sea ? 27 : tall ? 15 : 17} 7 Z`} />}
        <path fill="none" strokeWidth="1.2" d={`M${hx-2} ${hy-13} q6-3 11 0`} />
        <ellipse fill="#e6a594" opacity=".45" stroke="none" cx={hx-1} cy={hy+8} rx={tall ? 3 : 5} ry="2.5" />
      </>}
    </g>
    {tall && <path fill="none" strokeWidth="1.2" d={ostrich ? "M129 39 l7 1 M126 51 l7 2" : "M129 42 l6 2"} />}
  </>;
}

function Marine({ p }: { p: Profile }) {
  const f = p.feature, dolphin = f === "dolphin", orca = f === "orca", humpback = f === "humpback";
  return <>
    <g className="cartoonWag" style={{ transformOrigin: "44px 98px" }}><path fill={p.color} d="M52 91 Q27 77 10 79 Q14 92 28 99 Q14 105 9 118 Q32 122 52 104 Z" /></g>
    <path fill={p.color} d={dolphin ? "M40 99 Q51 73 102 72 Q132 70 155 90 L185 97 Q188 105 162 108 Q127 132 75 121 Q48 116 40 99 Z" : "M39 99 Q57 69 116 70 Q155 67 177 93 Q188 119 156 128 Q85 137 39 99 Z"} />
    <path fill={p.belly} stroke="none" d="M57 106 Q106 130 168 106 Q165 128 136 128 Q85 132 57 106 Z" />
    <path fill={p.color} d={orca ? "M85 76 Q94 29 105 30 L117 75 Z" : dolphin ? "M85 77 Q101 49 108 60 L117 78 Z" : "M69 82 Q78 62 85 78 Z"} />
    <path className="cartoonWing" style={{ transformOrigin: "103px 106px" }} fill={humpback ? p.belly : p.color} d={humpback ? "M110 99 Q98 117 62 146 Q60 157 76 147 Q113 132 126 111 Z" : "M107 101 Q82 123 79 140 Q90 145 126 112 Z"} />
    {orca && <ellipse fill={CREAM} stroke="none" cx="135" cy="84" rx="13" ry="7" transform="rotate(-15 135 84)" />}
    <g className="cartoonHead" style={{ transformOrigin: "150px 101px" }}><Eye x={154} y={98} size={6.5} /><path fill="none" strokeWidth="1.5" d={dolphin ? "M166 104 q12 1 18-3" : "M158 113 q11 4 18-4"} /><path fill="none" strokeWidth="1.4" d="M150 86 q6-3 10 0" /></g>
    {f === "bluewhale" || humpback ? <path fill="none" strokeWidth="1" stroke="#8caeb0" d="M127 117 q13 5 27 3 M125 121 q12 6 23 3 M119 125 q12 6 19 3" /> : null}
  </>;
}

function Shark({ p, clipId }: { p: Profile; clipId: string }) {
  const hammer = p.feature === "hammerhead", whale = p.feature === "whaleshark", basking = p.feature === "baskingshark", leopard = p.feature === "leopardshark";
  const body = whale ? "M35 103 Q70 73 145 75 Q178 75 188 94 L188 113 Q172 133 117 125 Q62 124 35 103 Z" : basking ? "M36 104 Q69 80 135 79 Q164 76 181 95 L190 102 182 121 Q130 136 36 104 Z" : "M35 105 Q61 78 128 81 Q158 78 187 104 Q176 120 129 123 Q74 126 35 105 Z";
  return <>
    <g className="cartoonWag" style={{transformOrigin:"40px 105px"}}><path fill={p.color} d="M47 102 Q27 91 18 54 L12 89 25 108 14 132 31 121 47 111 Z"/></g>
    <path fill={p.color} d={hammer ? "M77 90 Q80 51 98 49 L111 87 Z" : "M78 86 Q86 54 99 54 L116 86 Z"}/>
    <path fill={p.color} d={body}/><clipPath id={clipId}><path d={body}/></clipPath>
    <path fill={p.belly} stroke="none" d="M51 108 Q120 127 181 106 L181 117 Q131 137 51 108 Z"/>
    <g clipPath={`url(#${clipId})`} stroke="none">{whale ? <>{Array.from({length:24},(_,i)=><circle key={i} cx={58+(i%8)*15} cy={86+Math.floor(i/8)*10} r="2.3" fill="#eae9cf"/>)}<path fill="none" stroke="#dadfc3" strokeWidth="1.3" d="M55 93h116 M62 103h113"/></> : leopard ? <>{Array.from({length:8},(_,i)=><path key={i} fill="#766b59" d={`M${57+i*15} 82 q-6 12 0 17 q9 0 9-14 Z`}/>)}{Array.from({length:7},(_,i)=><ellipse key={i} cx={65+i*15} cy="105" rx="3.4" ry="2.5" fill="#766b59"/>)}</> : null}</g>
    <path className="cartoonWing" style={{transformOrigin:"113px 109px"}} fill={p.color} d="M104 104 Q87 120 75 143 Q96 143 129 115 Z"/>
    {[0,1,2,3,4].map(i=><path key={i} fill="none" strokeWidth="1.4" d={`M${128-i*5} ${basking?87:94} q-4 ${basking?14:7} 0 ${basking?29:16}`}/>)}
    {hammer ? <g className="cartoonHead" style={{transformOrigin:"159px 103px"}}><path fill={p.color} d="M145 92 L167 81 Q190 73 194 85 L193 94 175 104 184 120 Q184 132 173 133 L151 121 145 106 Z"/><Eye x={183} y={85} size={5}/><Eye x={175} y={123} size={5}/><path fill="none" strokeWidth="1.3" d="M167 103q10 5 19-1"/></g> : <g className="cartoonHead" style={{transformOrigin:"165px 102px"}}><Eye x={whale?171:162} y={whale?94:98} size={6}/><path fill="none" strokeWidth="1.5" d={whale?"M176 115q7 1 12-3":basking?"M169 108q13 14 19-6":"M167 112q10 3 19-5"}/></g>}
  </>;
}

function Reptile({ p }: { p: Profile }) {
  const turtle = p.kind === "turtle", snake = p.kind === "snake", croc = p.feature === "crocodile";
  if (p.feature === "loggerhead") return <>
    <g className="cartoonWing" style={{transformOrigin:"117px 105px"}}><path fill={p.color} d="M117 98 Q153 111 150 139 Q137 143 109 115 Z"/></g>
    <path fill={p.color} d="M45 94 Q15 105 21 128 Q37 132 62 107 Z M66 118 l-12 25 q12 1 28-18 M107 85 l9-16 q16 0 28 12 l-16 16"/>
    <path fill="#aa7d50" d="M33 104 Q36 60 85 59 Q126 58 132 95 Q129 126 85 130 Q52 129 33 104 Z"/>
    <path fill="none" stroke="#e2c699" strokeWidth="2" d="M51 83 l26-14 25 6 15 25 -18 18 -28-2 -20-16 Z M77 69 l1 24 -7 23 M102 75 l-4 25 1 18 M51 83 l27 10 20 7 19 0"/>
    <path fill={p.color} d="M115 98 Q133 76 158 81 Q183 85 183 104 Q183 121 159 122 L126 115 Z"/>
    <g className="cartoonHead" style={{transformOrigin:"154px 103px"}}><Eye x={161} y={96} size={7}/><path fill="none" strokeWidth="1.5" d="M164 110q10 5 18-2"/><path fill="#e6d0a8" stroke="none" d="M171 102l12 1-1 5-7 2Z"/></g>
  </>;
  return snake ? <>
    <path fill={p.color} d="M142 110 C156 147 45 153 25 123 C4 90 114 86 119 111 C124 133 48 136 48 117 C48 105 90 106 119 90 L153 93" />
    <path fill="none" stroke="#745f45" strokeWidth="8" d="M35 117 l8 13 m20-25 8 6 m27 21 4-12 m23 8 5-13 M71 144 l3-9" />
    <g className="cartoonHead" style={{ transformOrigin: "135px 91px" }}><path fill={p.color} d="M117 92 Q107 70 137 66 Q164 66 179 82 Q187 99 161 105 Q130 111 117 92 Z" /><Eye x={151} y={82} size={7} /><path fill="none" strokeWidth="1.5" d="M160 97 q10 3 18-3" /><path fill="none" stroke="#d58b87" strokeWidth="2" d="M180 94 l10 2 4-3 m-4 3 4 3" /></g>
  </> : turtle ? <>
    <path fill={p.color} d="M47 112 l-13 23 22 4 14-20 M106 114 l-2 22 23 1 0-24" />
    <path fill={p.color} d="M117 109 L145 91 162 106 132 121 Z" />
    <path fill="#63825b" d="M31 110 Q28 64 82 62 Q127 59 132 108 Q95 139 31 110 Z" />
    <path fill="none" stroke="#d6cd9b" strokeWidth="2" d="M40 95 l24-25 36 0 25 27 -19 22 -43 1 Z M64 70 l5 26 -6 24 M100 70 l-8 28 14 21 M40 95 l29 1 23 2 33-1" />
    <g className="cartoonHead" style={{ transformOrigin: "142px 104px" }}><ellipse fill={p.color} cx="155" cy="98" rx="25" ry="20" /><path fill="#ca6b59" stroke="none" d="M139 91 l-9 1 0 11 9-3 Z" /><Eye x={156} y={92} size={7} /><path fill="none" strokeWidth="1.5" d="M159 109 q10 5 18-3" /></g>
  </> : <>
    <path fill={p.color} d="M59 104 Q24 82 7 116 Q28 109 57 121 Z" />
    <g className="cartoonFeet"><path fill={p.color} d="M61 109 l-14 13 4 17 19 1 -5-11 12-12 M120 107 l13 12 1 16 21 1 -8-8 -11-21" /></g>
    <path fill={p.color} d="M38 106 Q47 87 91 88 Q120 84 137 101 L131 118 Q92 134 38 120 Z" />
    <path fill="#6c7c56" d="M42 97 l7-12 9 9 8-10 10 9 9-10 8 10 9-9 9 10 9-7 9 11" />
    <g className="cartoonHead" style={{ transformOrigin: "128px 109px" }}><path fill={p.color} d={croc ? "M119 110 Q116 86 139 88 L188 108 Q195 122 175 125 L131 126 Z" : "M118 109 Q116 83 142 88 L180 99 Q198 118 182 126 L131 126 Z"} /><Eye x={140} y={98} size={6.5} /><path fill="none" strokeWidth="1.5" d="M142 115 Q167 122 187 114" /><path fill={CREAM} strokeWidth="1" d="M151 117 l3 6 3-5 m9 0 3 6 3-6" /><circle fill={INK} stroke="none" cx="184" cy="108" r="2" /></g>
  </>;
}

export const AnimalSprite = memo(function AnimalSprite({ animal, className = "" }: { animal: Animal; className?: string }) {
  const clipId = `coat${useId().replaceAll(":", "")}`, p = cartoonProfile(animal.id);
  return <svg viewBox="0 0 200 160" className={`animalSprite fairCartoon ${className}`} role="img" aria-label={animal.commonName} data-animal-id={animal.id} data-art-version="fair-cartoon-v2" data-normalized-size="142" data-anatomy={p.feature}>
    <ellipse className="cartoonGround" cx="100" cy="149" rx="65" ry="5" fill="#60482c" opacity=".12" />
    <g stroke={INK} strokeWidth="2.3" strokeLinejoin="round" strokeLinecap="round">
      {p.feature === "guineapig" ? <GuineaPig clipId={clipId} /> : ["seal","sealion"].includes(p.feature ?? "") ? <Pinniped p={p}/> : ["littlebat","flyingfox"].includes(p.feature ?? "") ? <Bat p={p}/> : ["echidna","anteater","armadillo"].includes(p.feature ?? "") ? <SmallSpecialist p={p}/> : ["meerkat","seaotter"].includes(p.feature ?? "") ? <UprightMammal p={p}/> : p.kind === "bird" || p.kind === "penguin" ? <Bird p={p} /> : p.kind === "marine" ? <Marine p={p} /> : p.kind === "shark" ? <Shark p={p} clipId={clipId}/> : p.kind === "primate" ? <Primate p={p} /> : ["reptile", "snake", "turtle"].includes(p.kind) ? <Reptile p={p} /> : p.feature === "kangaroo" ? <Kangaroo p={p} /> : <Mammal p={p} clipId={clipId} />}
    </g>
  </svg>;
});
