import type { Animal } from "../lib/animalstats";

// Identity artwork, never a visualization of measured game values. Restrict
// these designs to reviewed body plans; shelled nautiluses and argonauts need
// their own illustrations rather than receiving an octopus fallback.
export const illustratedCephalopods = new Set([
  "Octopus vulgaris", "Enteroctopus dofleini", "Architeuthis dux",
  "Dosidicus gigas", "Loligo vulgaris", "Doryteuthis opalescens",
  "Doryteuthis pealeii", "Sepia officinalis", "Sepia apama",
]);

export default function AnimalCephalopod({ animal }: { animal: Animal }) {
  const octopus = ["Octopus vulgaris", "Enteroctopus dofleini"].includes(animal.scientificName);
  const cuttlefish = animal.scientificName.startsWith("Sepia ");
  const color = octopus ? animal.scientificName === "Enteroctopus dofleini" ? "#c76c49" : "#b98a63" : cuttlefish ? "#bd9978" : animal.scientificName === "Dosidicus gigas" ? "#cb746c" : "#d5a2a0";
  return <g data-anatomy={octopus ? "eight-connected-arms" : "eight-arms-two-feeding-tentacles"}>
    <g className="cartoonArm" style={{transformOrigin:"100px 91px"}}>
      {!octopus && [-1,1].map(side => <g key={side} data-appendage="feeding-tentacle">
        <path d={`M${100+side*9} 86 Q${100+side*39} 118 ${100+side*55} 142`} fill="none" stroke={color} strokeWidth="8" />
        <ellipse cx={100+side*55} cy="142" rx="7" ry="12" transform={`rotate(${-side*28} ${100+side*55} 142)`} fill={color}/>
      </g>)}
      {Array.from({length:8}, (_,index) => {
        const side = index < 4 ? -1 : 1, lane = index % 4;
        const start = 100 + side*(5+lane*5), end = 100 + side*(17+lane*17);
        return <g key={index} data-appendage="arm">
          <path d={`M${start} ${octopus?90:85} Q${start+side*16} ${112+lane*3} ${end} ${125-lane*5} Q${end+side*9} ${119-lane*5} ${end+side*5} ${111-lane*4}`} fill="none" stroke={color} strokeWidth={octopus?12:7} />
          {octopus && [0,1,2].map(sucker => <circle key={sucker} cx={start+side*(7+sucker*5)} cy={101+sucker*5+lane} r="2" fill="#f1d6bd" stroke="none"/>)}
        </g>;
      })}
    </g>
    {octopus ? <path fill={color} d="M68 81 C55 54 64 25 91 21 C124 14 143 44 134 71 L127 100 Q100 116 73 99 Z"/> : cuttlefish ? <>
      <path fill="#e5c3a0" d="M67 85 Q43 68 55 47 Q65 18 100 17 Q136 20 145 48 Q157 72 133 85 L123 91 76 91 Z"/>
      <ellipse cx="100" cy="56" rx="35" ry="40" fill={color}/>
      {[0,1,2,3,4].map(i=><path key={i} d={`M75 ${30+i*11} Q100 ${39+i*11} 125 ${30+i*11}`} stroke="#826849" strokeWidth="2" fill="none"/>)}
    </> : <>
      <path fill={color} d="M99 13 L60 69 Q77 81 99 66 Q122 82 141 67 Z"/>
      <path fill={color} d="M100 12 Q121 39 119 75 L117 99 Q100 109 82 98 L80 75 Q78 38 100 12 Z"/>
      <path d="M98 26 Q89 53 91 69" stroke="#efd0c9" strokeWidth="3" fill="none"/>
    </>}
    <g className="cartoonBlink" style={{transformOrigin:"100px 80px"}}>
      {[82,118].map(x=><g key={x}><ellipse cx={x} cy="81" rx="9" ry="11" fill="#f9edce"/>{cuttlefish ? <path d={`M${x-5} 79 l3 5 2-3 2 3 3-5`} fill="none" stroke="#392f2b" strokeWidth="2.5"/> : <ellipse cx={x} cy="82" rx="4" ry="7" fill="#392f2b" stroke="none"/>}</g>)}
    </g>
  </g>;
}
