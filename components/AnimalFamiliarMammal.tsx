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
  if (animal.id === 'gulo_gulo') return <g data-anatomy="wolverine-stocky-mustelid-pale-flank-stripe-bushy-tail">
    <path className="cartoonWag" style={{transformOrigin:'48px 105px'}} fill="#5d4434" d="M49 100 Q34 103 24 89 Q13 83 12 95 L16 102 12 105 Q17 119 33 119 L51 112 Z"/>
    <g fill="#49392f">{[56,75,114,133].map((x,i)=><g key={x} className={i%2?'cartoonStep':'cartoonStepBack'} style={{transformOrigin:`${x}px 108px`}}><path d={`M${x-7} 103 L${x-7} 130 Q${x-15} 135 ${x-10} 143 H${x+10} Q${x+14} 136 ${x+5} 132 L${x+7} 103 Z`}/>{[0,1,2,3,4].map(j=><path key={j} stroke="#e0ceb2" strokeWidth="1" d={`M${x-7+j*3} 139 l-1 4`}/>)}</g>)}</g>
    <path fill="#674c38" d="M37 100 Q32 75 65 72 Q94 63 122 79 Q141 81 147 100 L140 117 Q111 133 60 120 Q40 119 37 100 Z"/>
    <path fill="#bda06c" stroke="none" d="M42 104 Q67 119 100 105 Q114 92 127 85 L135 94 Q117 100 105 116 Q70 135 43 115 Z"/>
    <path fill="none" stroke="#8b6b45" strokeWidth="1" d="M44 107 Q71 123 102 110 M45 111 Q69 127 91 118"/>
    <g className="cartoonHead" style={{transformOrigin:'143px 88px'}}>
      <ellipse fill="#5c4434" cx="128" cy="66" rx="9" ry="10"/><ellipse fill="#5c4434" cx="156" cy="64" rx="9" ry="10"/>
      <ellipse fill="#bd9e73" stroke="none" cx="128" cy="66" rx="4" ry="5"/><ellipse fill="#bd9e73" stroke="none" cx="156" cy="64" rx="4" ry="5"/>
      <path fill="#674c38" d="M122 77 Q127 61 146 66 Q166 67 170 88 L179 99 Q179 114 158 114 Q131 115 121 97 Z"/>
      <path fill="#bfa475" stroke="none" d="M126 79 Q143 65 161 79 L164 84 Q144 76 126 88 Z M124 95 L141 103 147 112 Q133 111 126 103 Z"/>
      <Eye x={145} y={86}/><path fill="#86684b" d="M153 96 Q168 91 177 99 Q178 111 164 112 Q150 112 153 96 Z"/>
      <ellipse fill="#302c28" cx="174" cy="100" rx="7" ry="5"/><path fill="none" strokeWidth="1.3" d="M174 106 q-4 5-10 2"/>
    </g>
  </g>;
  if (animal.id === 'ovibos_moschatus') return <g data-anatomy="muskox-long-shaggy-skirt-bull-horn-boss">
    <path fill="#5f4c39" d="M39 103 Q24 101 25 114 L31 124 42 113 Z"/>
    <g fill="#66503c">{[54,72,112,130].map((x,i)=><g key={x} className={i%2?'cartoonStep':'cartoonStepBack'} style={{transformOrigin:`${x}px 112px`}}><path d={`M${x-6} 107 L${x-6} 135 L${x-9} 143 H${x+7} L${x+5} 110 Z`}/><path fill="#38372e" d={`M${x-9} 138 H${x+7} V146 H${x-10} Z`}/><path fill="none" stroke="#b3a17c" strokeWidth="1" d={`M${x} 141 v5`}/></g>)}</g>
    <path fill="#5b4837" d="M30 103 Q26 72 53 65 Q80 56 111 67 Q137 66 147 89 L146 122 138 135 133 129 125 140 119 134 108 141 101 134 91 142 83 135 73 140 65 132 55 137 48 128 40 132 37 119 31 122 Z"/>
    <path fill="#a48b61" stroke="none" d="M39 82 Q53 58 94 66 L115 74 Q94 70 76 80 Q51 84 38 96 Z"/>
    <path fill="none" stroke="#8a6f4d" strokeWidth="1.5" d="M42 91 l4 31 M55 86 l4 40 M68 86 l2 43 M82 84 l2 47 M96 81 l-1 46 M109 83 l-3 47 M121 90 l-4 39"/>
    <g className="cartoonHead" style={{transformOrigin:'146px 96px'}}>
      <ellipse fill="#806947" cx="125" cy="87" rx="10" ry="6"/><ellipse fill="#806947" cx="169" cy="88" rx="10" ry="6"/>
      <path fill="#514132" d="M131 79 Q145 68 162 81 L170 104 Q171 128 149 133 Q129 127 124 107 Z"/>
      <path fill="#8f7c5d" stroke="none" d="M137 86 Q145 77 154 87 L157 107 H140 Z"/>
      <path fill="#d1c29a" d="M144 72 Q129 65 120 78 L116 95 Q109 103 102 92 L103 68 Q92 80 97 96 Q104 115 120 105 Q131 99 133 85 L145 82 Z M147 72 Q163 65 173 80 L177 96 Q184 104 188 93 L187 69 Q198 85 192 101 Q184 115 172 104 Q161 98 159 84 L147 82 Z"/>
      <path fill="#b7a17c" strokeWidth="1.7" d="M133 69 Q139 65 146 72 Q151 65 159 70 L164 81 Q154 85 147 81 Q140 85 130 80 Z"/>
      <Eye x={136} y={98}/><Eye x={158} y={98}/>
      <path fill="#9d8a6a" d="M132 111 Q148 101 164 112 L163 122 Q148 133 134 122 Z"/>
      <ellipse fill="#39352e" cx="148" cy="117" rx="10" ry="6"/><path fill="none" strokeWidth="1.2" d="M140 124 q8 5 16 0"/>
    </g>
  </g>;
  if (animal.id === 'ovis_canadensis') return <g data-anatomy="bighorn-ram-curled-horns-short-coat-white-rump">
    <path fill="#756148" d="M43 94 Q31 91 28 98 L34 108 47 104 Z"/>
    <g fill="#927650">{[52,69,111,129].map((x,i)=><g key={x} className={i%2?'cartoonStep':'cartoonStepBack'} style={{transformOrigin:`${x}px 106px`}}><path d={`M${x-5} 99 L${x-5} 124 L${x-8} 140 H${x+5} L${x+7} 120 L${x+5} 99 Z`}/><path fill="#4b4639" d={`M${x-8} 138 H${x+5} V146 H${x-10} Z`}/></g>)}</g>
    <path fill="#a98c65" d="M37 94 Q37 73 68 73 L102 76 Q118 66 131 56 L147 65 143 101 Q125 119 67 117 Q36 116 37 94 Z"/>
    <path fill="#f2e8ce" stroke="none" d="M39 86 Q49 77 59 79 L63 107 Q54 120 44 112 Z M65 105 Q101 114 131 96 L140 101 Q114 122 67 117 Z"/>
    <g className="cartoonHead" style={{transformOrigin:'147px 68px'}}>
      <path fill="#b19b73" d="M150 47 Q169 33 179 53 Q187 74 164 84 L157 74 Q172 70 169 56 Q167 48 158 55 Z"/>
      <path fill="#a98c65" d="M132 51 L119 47 Q114 56 131 65 Z M153 55 Q170 47 175 55 L157 67 Z"/>
      <path fill="#ad8d65" d="M133 52 Q151 43 160 60 L169 79 Q174 88 163 94 L141 83 Q125 71 133 52 Z"/>
      <path fill="#efe0bf" stroke="none" d="M150 74 L165 78 169 86 163 91 143 81 Z"/>
      <Eye x={151} y={67}/><path fill="#51483b" d="M164 78 Q176 80 170 86 L164 85 Z"/><path fill="none" strokeWidth="1.3" d="M155 85 q4 5 9 2"/>
      <path fill="#c9ae7e" d="M139 51 Q130 32 115 37 Q98 40 100 61 Q99 82 118 86 Q138 91 144 75 Q149 61 135 55 Q123 50 119 60 Q115 70 126 74 Q131 75 134 69 Q134 80 123 80 Q109 78 109 62 Q109 48 120 47 Q128 46 134 57 Z"/>
      <path fill="none" stroke="#a58b60" strokeWidth="1" d="M108 46 l8 4 M103 55 l7 3 M103 65 l7-1 M108 76 l7-4 M120 83 l2-7 M132 80 l-3-7 M140 68 l-7-2"/>
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
