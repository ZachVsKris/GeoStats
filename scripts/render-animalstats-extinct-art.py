#!/usr/bin/env python3
"""Equal-frame anatomical cartoons. Illustration dimensions never encode ranking values."""
import json,pathlib
ROOT=pathlib.Path(__file__).resolve().parents[1];records=json.loads((ROOT/'data/animalstats/research/extinct-intake-audit.json').read_text())['records'];OUT=ROOT/'public/animalstats/extinct';OUT.mkdir(parents=True,exist_ok=True)
INK='#473a32';colors=['#63bfa9','#d98f69','#92b969','#9c9ad7','#e6b452','#71b6d7']
def make(r,i):
 g=r['genus'];c=colors[i%len(colors)];sub=r['subclade'];shapes='';eye=(146,58);quad=False
 if r['clade']=='Sauropodomorpha':
  quad=True;eye=(155,37);shapes=f'<path d="M49 96 Q62 78 98 82 Q123 85 126 93 Q134 83 135 58 L140 30 Q152 21 164 29 Q174 36 162 45 L152 45 L150 83 Q149 115 122 118 L64 120 Q43 113 49 96Z"/><path d="M58 96 Q25 104 14 72 Q35 90 60 82Z"/>'
 elif g in ['Triceratops','Chasmosaurus','Centrosaurus','Protoceratops']:
  quad=True;eye=(149,85);shapes='<path d="M35 92 Q43 65 94 68 Q128 66 144 94 L135 123 L59 125 Q34 124 35 92Z"/><path d="M132 112 Q110 110 113 81 L116 60 L132 63 L139 56 L151 67 L159 82 L152 101Z"/><path d="M135 78 Q165 71 174 94 L161 111 L133 108Z"/><path d="M166 90 L177 75 L175 97 M143 79 L143 53 L155 80 M155 80 L162 57 L164 87" fill="#fff0cf"/>' if g!='Protoceratops' else '<path d="M35 92 Q43 65 94 68 Q128 66 144 94 L135 123 L59 125 Q34 124 35 92Z"/><ellipse cx="128" cy="79" rx="19" ry="27"/><path d="M133 81 Q161 74 174 96 L165 110 L133 107Z"/>'
 elif g in ['Stegosaurus','Kentrosaurus']:
  quad=True;eye=(155,103);shapes='<path d="M41 98 Q54 70 91 78 Q116 76 138 93 L165 98 L170 111 L146 117 L64 123 Q38 116 41 98Z"/><path d="M49 91 Q30 90 9 106 Q27 100 50 109Z"/>'
  for x,y in [(50,84),(67,75),(85,72),(104,76),(121,83)]:shapes+=f'<path d="M{x-8} {y+7} L{x-5} {y-14} L{x+5} {y-19} L{x+11} {y+7}Z" fill="#e68c72"/>'
  shapes+='<path d="M24 101 L15 86 M19 102 L7 91" stroke-width="5"/>'
 elif g in ['Ankylosaurus','Euoplocephalus','Nodosaurus']:
  quad=True;eye=(151,96);shapes='<path d="M37 95 Q41 65 90 69 Q130 68 146 89 L169 92 L173 106 L147 117 L55 120 Q35 115 37 95Z"/><path d="M43 95 Q26 90 14 101" fill="none" stroke-width="9"/>'
  if g!='Nodosaurus':shapes+='<ellipse cx="15" cy="100" rx="12" ry="9"/>'
  for x,y in [(52,87),(73,80),(94,80),(115,85),(63,105),(86,99),(107,105)]:shapes+=f'<path d="M{x-6} {y+3} L{x} {y-9} L{x+6} {y+3}Z" fill="#dddaa0"/>'
 else:
  duck='Hadrosaur' in sub or g in ['Iguanodon','Ouranosaurus'];small=g in ['Velociraptor','Deinonychus','Microraptor','Sinosauropteryx','Compsognathus'];eye=(151,54)
  shapes='<path d="M47 102 Q66 81 92 80 Q117 87 119 65 L123 43 Q136 31 159 35 L175 46 L176 63 L146 68 L135 103 Q113 127 81 116Z"/><path d="M76 94 Q46 107 10 84 Q29 114 73 115Z"/>'
  if small:shapes='<path d="M48 102 Q73 75 104 87 L125 61 Q120 45 141 38 L175 44 L174 56 L146 62 L133 102 Q115 126 80 116Z"/><path d="M75 95 Q41 101 7 76 Q25 108 71 115Z"/>'
  shapes+='<path d="M100 101 Q113 113 103 136 L91 146 L79 145 L91 132 L86 113Z"/><path d="M87 113 L70 138 L76 147 L56 147 L55 140 L70 107Z"/><path d="M130 78 L138 91 L149 95" fill="none" stroke-width="7"/>'
  if duck:shapes+='<path d="M155 39 Q172 36 180 55 L177 64 L161 63Z"/>'
  if g=='Parasaurolophus':shapes+='<path d="M146 38 Q140 14 110 15 Q123 22 126 40Z"/>'
  if g in ['Corythosaurus','Saurolophus']:shapes+='<path d="M132 39 Q143 13 156 35Z"/>'
  if g=='Carnotaurus':shapes+='<path d="M144 35 L149 22 L154 36" fill="#fff0cf"/>'
  if g in ['Dilophosaurus','Ceratosaurus']:shapes+='<path d="M146 34 L152 21 L164 38" fill="#e9916e"/>'
  if g=='Pachycephalosaurus':shapes+='<path d="M126 43 Q139 13 161 37Z" fill="#dddaa0"/>'
  if small:shapes+='<path d="M74 100 L72 80 L83 90 L87 71 L93 89" fill="#f3dbb4"/><path d="M131 81 L109 92 L122 104 L141 95Z" fill="#f3dbb4"/>'
 if quad:
  shapes='<path d="M66 105 L67 143 L54 147 L48 144 L48 109 M118 105 L127 143 L113 147 L105 143 L103 108"/>'+shapes+'<path d="M80 110 L80 144 L68 148 L61 143 L64 111 M138 110 L145 143 L131 148 L124 144 L122 110"/>'
 x,y=eye
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 165" role="img"><title>{g}: cartoon reconstruction</title><ellipse cx="96" cy="153" rx="73" ry="5" fill="#473a32" opacity=".10"/><g fill="{c}" stroke="{INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">{shapes}<ellipse cx="{x}" cy="{y}" rx="7" ry="8" fill="#fffaf0"/><ellipse cx="{x+2}" cy="{y+1}" rx="3.3" ry="5" fill="{INK}" stroke="none"/><circle cx="{x+3}" cy="{y-2}" r="1.5" fill="white" stroke="none"/><path d="M{x+4} {y+15} Q{x+13} {y+19} {x+19} {y+12}" fill="none" stroke-width="1.7"/></g></svg>'
for i,r in enumerate(records):(OUT/(r['genus'].lower()+'.svg')).write_text(make(r,i))
print('Generated',len(records),'equal-frame cartoon reconstructions')
