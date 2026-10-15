import type { Animal } from "../lib/animalstats";

const INK = "#513b32";
function Eye({x, y}: {x: number; y: number}) {
  return <g className="cartoonBlink" style={{transformOrigin: `${x}px ${y}px`}}><ellipse cx={x} cy={y} rx="4.8" ry="6" fill="#fffaf0"/><ellipse cx={x+1} cy={y+.5} rx="2.8" ry="4" fill={INK} stroke="none"/><circle cx={x+2} cy={y-2} r="1.3" fill="white" stroke="none"/></g>;
}

/** Species-specific silhouettes; illustration proportions are never game data. */
export default function AnimalFamiliarMammal({animal}: {animal: Animal}) {
  if (animal.id === "antilocapra_americana") return <g data-anatomy="pronghorn-forked-horns-white-rump-black-cheek">
    <path fill="#f8ead2" d="M45 94 Q25 88 31 78 Q42 80 51 91 Z"/>
    <g fill="#b77d47">{[55,73,112,128].map((x,i)=><g key={x} className={i%2 ? "cartoonStep" : "cartoonStepBack"} style={{transformOrigin:`${x}px 105px`}}><path d={`M${x-5} 102 L${x-4} 126 L${x-7} 141 H${x+3} L${x+6} 119 L${x+5} 100 Z`}/><path fill="#4e4236" d={`M${x-7} 138 H${x+4} V145 H${x-9} Z`}/></g>)}</g>
    <path fill="#c28a50" d="M39 98 Q36 78 66 77 Q91 77 112 82 L128 58 L142 66 L139 101 Q121 119 72 117 Q43 118 39 98 Z"/>
    <path fill="#fff1d8" stroke="none" d="M41 92 Q43 80 56 80 L62 106 Q52 116 45 108 Z M59 106 Q93 115 122 99 L137 79 L135 102 Q115 122 65 116 Z"/>
    <g className="cartoonHead" style={{transformOrigin:"136px 66px"}}>
      <path fill="#c28a50" d="M133 52 Q109 40 113 51 L132 64 Z M146 50 Q166 33 170 43 Q164 54 149 59 Z"/>
      <path fill="#efdab6" stroke="none" d="M119 49 L134 57 L130 58 Z M151 50 L165 42 L160 51 Z"/>
      <path fill="#393a33" d="M133 49 Q122 33 129 14 Q133 8 135 13 L133 31 L143 25 L138 39 L140 50 Z M147 48 Q142 33 152 13 Q156 8 156 14 L151 32 L161 26 L155 40 L154 52 Z"/>
      <path fill="#c28a50" d="M132 49 Q148 41 158 55 L169 77 Q170 86 158 87 L139 75 Q125 66 132 49 Z"/>
      <path fill="#fff0d7" stroke="none" d="M145 64 L162 72 L168 81 L158 85 L140 74 Z"/>
      <path fill="#3d3931" stroke="none" d="M135 66 L144 69 L147 78 L136 73 Z M155 51 L161 59 L157 64 L151 56 Z"/>
      <Eye x={146} y={59}/><path fill={INK} d="M163 74 Q174 77 167 83 L161 81 Z"/>
      <path fill="none" strokeWidth="1.2" d="M153 78 q3 5 8 3"/>
    </g>
  </g>;
  if (animal.id === "caracal_caracal") return <g data-anatomy="caracal-black-ear-tufts-plain-russet-coat">
    <path className="cartoonWag" style={{transformOrigin:"48px 105px"}} fill="#b96e40" d="M48 99 Q26 99 25 80 Q24 73 19 77 Q15 104 43 112 Z"/>
    <g fill="#af693e">{[55,72,112,129].map((x,i)=><g key={x} className={i%2 ? "cartoonStep" : "cartoonStepBack"} style={{transformOrigin:`${x}px 105px`}}><path d={`M${x-6} 100 L${x-6} 133 Q${x-13} 137 ${x-11} 143 H${x+7} Q${x+11} 138 ${x+3} 134 L${x+6} 100 Z`}/></g>)}</g>
    <path fill="#c5804d" d="M40 99 Q40 76 70 78 L107 82 Q124 71 139 88 L137 112 Q111 125 64 117 Q40 116 40 99 Z"/>
    <path fill="#f8e5c5" stroke="none" d="M63 109 Q96 119 126 105 L136 112 Q112 127 66 117 Z"/>
    <g className="cartoonHead" style={{transformOrigin:"141px 76px"}}>
      <path fill="#413a34" d="M124 64 Q110 36 118 30 L137 58 Z M145 56 Q151 28 160 32 L160 66 Z"/>
      <path fill="#c5804d" d="M123 58 L119 37 L132 59 Z M148 57 L157 38 L156 63 Z"/>
      <path fill="none" stroke="#33342f" strokeWidth="3" d="M118 33 L113 15 M120 32 L119 17 M157 33 L161 13 M159 35 L167 20"/>
      <path fill="#c5804d" d="M121 63 Q142 48 161 64 L167 84 Q164 104 143 104 Q122 99 119 82 Z"/>
      <path fill="#fff0d5" stroke="none" d="M127 84 Q139 78 147 87 Q158 77 163 86 L160 97 Q143 110 127 94 Z"/>
      <Eye x={133} y={75}/><Eye x={155} y={74}/>
      <path fill="none" stroke="#483a31" strokeWidth="2" d="M127 79 l-3 7 M159 79 l5 6"/>
      <path fill="#704c43" d="M140 86 L152 86 L147 93 Z"/><path fill="none" strokeWidth="1.2" d="M147 93 v4 m0-1 q-6 4-10 0 m10 0 q5 4 9-1 M131 91 l-15-2 M133 95 l-16 3 M158 90 l15-3 M158 94 l15 2"/>
    </g>
  </g>;
  if (animal.id !== "setonix_brachyurus") return null;
  return <g data-anatomy="quokka-stocky-body-rounded-ears-short-bare-tail">
    <path className="cartoonWag" style={{transformOrigin:"76px 128px"}} fill="#a0866e" d="M77 124 Q51 136 35 143 Q22 149 17 144 Q36 143 61 120 Z"/>
    <path fill="#8f7e61" d="M65 111 Q63 80 87 75 Q117 69 130 103 Q140 132 111 141 Q76 150 65 124 Z"/>
    <path fill="#cabc96" stroke="none" d="M105 89 Q130 95 129 120 Q124 134 108 137 Q99 117 105 89 Z"/>
    <g className="cartoonFeet" fill="#8f7e61"><path d="M83 119 Q62 122 70 136 L91 145 L113 145 Q118 139 108 137 L96 133 Z"/><path d="M111 121 Q102 134 111 141 L139 144 Q150 141 143 136 L128 132 L129 121 Z"/><path fill="none" strokeWidth="1" d="M99 140 l2 4 M105 139 l2 5 M132 137 l3 5 M138 137 l3 4"/></g>
    <path fill="#9b896b" d="M119 96 Q129 99 132 111 L141 110 Q147 114 139 118 L126 118 Q118 112 115 103 Z"/>
    <path fill="#9b896b" d="M101 101 Q110 108 116 114 L123 112 Q131 114 124 120 L114 122 Q102 117 96 108 Z"/>
    <g className="cartoonHead" style={{transformOrigin:"112px 79px"}}>
      <ellipse fill="#8f7e61" cx="96" cy="54" rx="11" ry="15"/><ellipse fill="#8f7e61" cx="127" cy="52" rx="10" ry="14"/>
      <ellipse fill="#c7ac88" stroke="none" cx="96" cy="54" rx="6" ry="9"/><ellipse fill="#c7ac88" stroke="none" cx="127" cy="52" rx="5.5" ry="8"/>
      <path fill="#a59170" d="M87 67 Q91 50 113 54 Q137 54 140 74 Q144 94 119 101 Q95 102 86 83 Z"/>
      <path fill="#d6c5a0" stroke="none" d="M102 80 Q117 72 133 80 Q141 88 127 96 Q111 102 101 91 Z"/>
      <Eye x={103} y={73}/><Eye x={128} y={72}/><ellipse fill="#3e3c33" cx="119" cy="84" rx="7" ry="5"/>
      <path fill="none" strokeWidth="1.5" d="M119 89 v4 m0-1 q-8 5-12-1 m12 1 q8 4 13-2"/>
      <path fill="none" stroke="#7c7058" strokeWidth="1" d="M97 88 l-9-2 M98 92 l-10 2 M134 87 l8-2 M133 92 l9 2"/>
    </g>
  </g>;
}
