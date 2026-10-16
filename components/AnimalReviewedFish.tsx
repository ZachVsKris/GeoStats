import type {Animal} from '../lib/animalstats';

export const reviewedFishIds = new Set(['carcharhinus_leucas','thunnus_thynnus','hippoglossus_hippoglossus','pterois_volitans']);
function Eye({x,y,size=4}:{x:number;y:number;size?:number}) {
  return <g className="cartoonBlink" style={{transformOrigin:`${x}px ${y}px`}}><circle cx={x} cy={y} r={size} fill="#fff5da"/><circle cx={x+.5} cy={y} r={size*.62} fill="#353c37" stroke="none"/><circle cx={x+1} cy={y-1} r={size*.22} fill="white" stroke="none"/></g>;
}
/** Identification features are referenced in the review manifest, not measured game values. */
export default function AnimalReviewedFish({animal,clipId}:{animal:Animal;clipId:string}) {
  if(animal.id==='carcharhinus_leucas') {
    const body='M37 104 Q63 80 117 79 Q149 76 175 92 Q191 98 185 108 Q176 122 142 125 Q79 135 37 108 Z';
    return <g data-anatomy="bull-shark-stout-blunt-snout-five-gills">
      <g className="cartoonWag" style={{transformOrigin:'43px 106px'}}><path fill="#8c9694" d="M45 100 Q28 84 24 49 L14 74 Q14 91 29 107 L17 133 Q34 124 45 111 Z"/></g>
      <path fill="#87928f" d="M93 85 Q100 54 111 51 Q114 67 128 83 Z M54 94 L63 77 Q68 85 77 90 Z M61 119 L68 136 84 124 Z"/>
      <path fill="#9ca8a1" d={body}/><defs><clipPath id={clipId}><path d={body}/></clipPath></defs>
      <path clipPath={`url(#${clipId})`} fill="#f1edda" stroke="none" d="M41 109 Q109 126 187 105 L192 139 H34 Z"/>
      <path className="cartoonWing" style={{transformOrigin:'130px 111px'}} fill="#909d96" d="M132 106 Q114 116 98 141 Q118 143 146 115 Z"/>
      {[0,1,2,3,4].map(i=><path key={i} fill="none" strokeWidth="1.3" d={`M${149-i*4} ${99+i*.5} q-3 7 0 13`}/>)}
      <Eye x={171} y={96} size={3.8}/><path fill="none" strokeWidth="1.4" d="M169 113 Q178 116 184 108 M180 101 l2 1"/>
    </g>;
  }
  if(animal.id==='thunnus_thynnus') {
    const body='M37 104 Q67 73 113 76 Q153 77 181 102 Q183 108 171 114 Q112 143 37 109 Z';
    return <g data-anatomy="atlantic-bluefin-short-pectoral-yellow-finlets-crescent-tail">
      <g className="cartoonWag" style={{transformOrigin:'40px 106px'}}><path fill="#526f7b" d="M42 102 Q26 84 19 62 L20 91 L30 106 L19 121 L17 147 Q27 127 42 111 Z"/></g>
      <path fill="#576e7d" d="M102 79 Q115 54 134 60 L144 84 Z"/>
      <path fill="#9e795e" d="M75 88 Q76 66 89 61 Q88 77 98 81 Z"/>
      <path fill="#a99763" d="M77 122 Q78 137 91 141 L96 123 Z"/>
      <path fill="#658397" d={body}/><defs><clipPath id={clipId}><path d={body}/></clipPath></defs>
      <g clipPath={`url(#${clipId})`} stroke="none"><path fill="#dce2d9" d="M38 107 Q106 116 181 102 L185 151 H35 Z"/><path fill="#3b617f" d="M38 104 Q101 65 178 99 L185 64 H33 Z"/><path fill="none" stroke="#91a9ae" strokeWidth="1" d="M58 105 Q112 97 161 104"/></g>
      {[43,50,57,64,71].map((x,i)=><g key={x} fill="#e8c55e" strokeWidth="1"><path d={`M${x} ${99-i*2} l4-7 4 3 Z`}/><path d={`M${x} ${114+i*1.8} l4 7 4-3 Z`}/></g>)}
      <path className="cartoonWing" style={{transformOrigin:'141px 109px'}} fill="#627d8a" d="M144 103 Q124 105 111 119 Q133 121 150 110 Z"/>
      <path fill="none" strokeWidth="1.4" d="M149 89 Q137 105 149 119"/><Eye x={164} y={99}/><path fill="none" strokeWidth="1.4" d="M174 109 l8-5"/>
    </g>;
  }
  if(animal.id==='hippoglossus_hippoglossus') {
    const body='M37 104 Q63 79 101 65 Q129 56 157 84 L181 101 Q187 107 173 119 Q147 149 107 137 Q67 130 37 109 Z';
    return <g data-anatomy="atlantic-halibut-right-eyed-diamond-flatfish">
      <g className="cartoonWag" style={{transformOrigin:'43px 106px'}}><path fill="#867e60" d="M45 100 L17 85 Q22 107 16 129 L45 112 Z"/></g>
      <path fill="#aca17b" d="M42 100 Q86 51 117 53 Q144 53 166 88 L156 93 Q129 68 109 70 Q75 79 47 107 Z M42 111 Q81 137 110 145 Q146 155 170 125 L162 120 Q137 143 110 134 L48 106 Z"/>
      <path fill="#94896c" d={body}/><defs><clipPath id={clipId}><path d={body}/></clipPath></defs>
      <g clipPath={`url(#${clipId})`} fill="#b4aa86" stroke="none">{[[61,101],[81,87],[106,79],[128,82],[86,114],[116,121],[139,124],[143,104],[58,111]].map(([x,y])=><ellipse key={`${x}-${y}`} cx={x} cy={y} rx="8" ry="4"/>)}<path fill="none" stroke="#d3c49c" strokeWidth="1.3" d="M43 107 Q92 110 119 98 Q138 87 151 101"/></g>
      <path className="cartoonWing" style={{transformOrigin:'144px 109px'}} fill="#a69a74" d="M144 105 Q122 103 116 115 Q135 124 151 112 Z"/>
      <Eye x={157} y={90} size={4}/><Eye x={166} y={103} size={4}/><path fill="none" strokeWidth="1.4" d="M174 112 l9-8 M151 116 q-7-14 0-28"/>
    </g>;
  }
  if(animal.id!=='pterois_volitans')return null;
  const body='M49 105 Q76 76 119 79 Q144 78 158 93 L175 103 Q175 116 151 121 Q101 137 49 111 Z';
  return <g data-anatomy="red-lionfish-striped-body-thirteen-dorsal-spines-fan-fins">
    <g className="cartoonWag" style={{transformOrigin:'53px 109px'}}><path fill="#e5c6a1" d="M56 100 Q26 82 21 91 Q17 111 24 130 Q40 132 57 115 Z"/><path fill="none" stroke="#ad684c" d="M27 95l24 10 M24 107l29 2 M28 123l24-10"/></g>
    <g stroke="#92523e" strokeWidth="2">{Array.from({length:13},(_,i)=>{const x=57+i*6;const tipY=42-Math.sin(i/12*Math.PI)*19;return <path key={i} fill="#e2ba91" d={`M${x} 94 L${x-7} ${tipY} L${x+4} 89 Z`}/>;})}</g>
    <path fill="#ba7857" d={body}/><defs><clipPath id={clipId}><path d={body}/></clipPath></defs>
    <g clipPath={`url(#${clipId})`} stroke="#f5e1be" strokeWidth="5">{[61,79,97,115,139,156].map(x=><path key={x} fill="none" d={`M${x} 72 q-13 20 2 67`}/>)}</g>
    <g className="cartoonWing" style={{transformOrigin:'139px 107px'}}><path fill="#e4bb91" fillOpacity=".95" d="M139 102 Q119 102 76 126 Q64 143 74 146 Q111 154 150 116 Z"/>{[75,86,98,111,124].map((x,i)=><path key={x} fill="none" stroke="#a45b42" strokeWidth="2" d={`M141 109 L${x} ${142-i*2}`}/>)}<path fill="none" stroke="#fff0d3" strokeWidth="3" d="M91 118 Q84 137 91 148 M110 111 Q102 128 109 145 M126 106 Q119 125 127 136"/></g>
    <path fill="#b56d4f" d="M146 93 Q140 76 146 69 L153 87 Z M157 92 Q164 76 167 80 L166 98 Z"/>
    <Eye x={154} y={99} size={5}/><path fill="none" strokeWidth="1.4" d="M163 114 l10-7 M150 119 l-4 10 M158 117 l1 9"/>
  </g>;
}
