"""Equal-framed recognizable cartoon reconstructions; no sizes encode measurements."""
import json,pathlib
R=pathlib.Path(__file__).resolve().parents[1];out=R/'public/animalstats/extinct';d=json.load(open(R/'data/animalstats/extinct.json'))
for genus in sorted({a['scientificName'].split()[0]for a in d['animals']if a['taxonomicGroup']=='extinct-mammal'}):
 color='#b38a63';head=(145,72);ears='<ellipse cx="137" cy="56" rx="10" ry="13"/>';tail='<path d="M48 88 Q27 95 30 111" fill="none"/>';body='<path d="M52 93 L55 139 Q64 145 70 139 L74 107 M108 103 L112 140 Q121 145 127 137 L129 102"/><path d="M47 99 Q39 66 81 65 Q117 59 139 79 L147 108 Q113 125 66 118 Q48 116 47 99Z"/><path d="M74 108 L72 140 Q80 148 87 138 L91 111 M131 105 L137 136 Q147 142 151 133 L148 100"/><ellipse cx="145" cy="78" rx="25" ry="24"/><ellipse cx="163" cy="87" rx="17" ry="13"/>'
 extra=''
 if genus in ['Mammuthus','Mammut']:
  color='#aa7957';head=(144,66);ears='<ellipse cx="128" cy="78" rx="13" ry="20" fill="#c79b79"/>';body=body.replace('Q39 66 81 65 Q117 59 139 79','Q39 65 76 48 Q109 45 137 73').replace('<ellipse cx="163" cy="87" rx="17" ry="13"/>','<path d="M160 69 Q182 88 172 113 Q164 130 153 117 L157 109 Q169 115 168 99 L154 86Z"/>');extra='<path d="M153 90 Q161 119 190 104 Q175 111 160 88Z" fill="#fff1cb"/><path d="M137 94 Q143 122 166 115 Q149 115 144 89Z" fill="#fff1cb"/><path d="M57 88 l-5 8 m19 -28 l-3 9 m27 -17 l-2 8 m14 2 l-2 9 m-35 30 l-2 8" stroke="#835c45" stroke-width="2"/>'
 if genus=='Mammut':body=body.replace('Q39 65 76 48 Q109 45 137 73','Q39 63 80 62 Q112 61 137 73')
 if genus=='Coelodonta':
  color='#a88c71';ears='<path d="M135 59 L133 44 Q146 40 146 62Z"/>';extra='<path d="M171 81 Q181 73 179 42 Q164 58 160 79Z" fill="#f3d9ae"/><path d="M153 70 L155 55 L146 69Z" fill="#ead0a7"/><path d="M50 90 l-2 8 m18 -21 l-2 8 m17 -7 l-2 8 m17 -5 l-2 9" stroke="#88705b"/>'
 elif genus=='Megaloceros':
  color='#bb865b';ears='<path d="M136 62 Q109 50 119 40 Q137 43 142 64Z"/>';extra='<path d="M143 62 L135 34 L106 21 L87 27 L80 19 L103 10 L124 21 L122 7 L136 23 L145 46 M148 59 L157 34 L179 22 L188 8 L168 16 L174 4 L159 18 L151 32" fill="none" stroke="#dbc19b" stroke-width="8"/><path d="M93 23 L87 9 M110 19 L107 4 M133 28 L148 19 M175 20 L186 26" stroke="#dbc19b" stroke-width="5"/>'
 elif genus in ['Smilodon','Homotherium','Thylacoleo']:
  color='#d5ac71';ears='<circle cx="135" cy="57" r="10"/><circle cx="155" cy="55" r="9"/>';extra='<path d="M157 91 L163 121 Q170 106 168 91Z M144 92 L149 114 Q157 102 155 91Z" fill="#fff4d9"/><path d="M152 81 L159 84 L154 89Z" fill="#765344"/><path d="M143 91 l-13 -2 m13 6 l-13 3" fill="none" stroke-width="1.5"/>'
  if genus=='Homotherium':extra=extra.replace('L163 121','L163 105').replace('L149 114','L149 103')
  if genus=='Thylacoleo':extra=extra.replace('L163 121','L163 99').replace('L149 114','L149 100')+'<path d="M65 74 l5 16 m14 -21 l4 16 m15 -15 l3 15" stroke="#866641" stroke-width="5"/>'
 elif genus in ['Megatherium','Eremotherium','Paramylodon','Mylodon']:
  color='#b79c76';head=(134,52);ears='<ellipse cx="119" cy="43" rx="8" ry="10"/>';tail='<path d="M93 128 Q46 149 24 134" fill="none" stroke-width="14"/>';body='<path d="M81 109 L70 140 Q76 151 94 143 L101 114 M111 110 L121 140 Q133 148 141 141 L137 101"/><path d="M76 123 Q61 105 85 73 L111 48 Q140 43 141 66 L149 110 Q139 140 104 139 Q84 136 76 123Z"/><ellipse cx="134" cy="55" rx="22" ry="19"/><ellipse cx="151" cy="64" rx="18" ry="11"/><path d="M115 77 Q131 84 143 108 L137 120 L125 115 L107 89 M91 85 L65 107 L72 119 L81 113 L105 93"/>';extra='<path d="M137 116 l-1 10 m-5 -12 l-2 10 m-3 -12 l-3 9 M68 114 l-3 9 m9 -7 l-2 8" stroke="#fff0cf" stroke-width="4"/>'
 elif genus in ['Glyptodon','Doedicurus']:
  color='#af9672';head=(154,105);ears='<ellipse cx="141" cy="94" rx="6" ry="8"/>';tail='<path d="M48 111 L14 114" stroke-width="12"/>';body='<path d="M59 113 L55 141 L71 143 L78 113 M120 113 L121 141 L137 141 L142 112"/><path d="M37 114 Q34 49 94 47 Q148 47 153 113 Q102 135 37 114Z"/><ellipse cx="155" cy="110" rx="23" ry="13"/>'
  for x,y in [(61,83),(84,65),(108,70),(127,87),(81,98),(104,103)]:extra+=f'<path d="M{x-8} {y} l8 -7 l8 7 l-3 10 h-10Z" fill="#cfb88f"/>'
  if genus=='Doedicurus':extra+='<ellipse cx="14" cy="115" rx="12" ry="9" fill="#b69c79"/>'
 elif genus=='Castoroides':
  color='#976f53';ears='<circle cx="136" cy="59" r="8"/>';tail='<path d="M49 105 Q19 92 6 108 Q8 134 48 123Z" fill="#705b49"/>';extra='<path d="M162 96 L163 109 L154 110 L153 98Z" fill="#f8df99"/><path d="M17 108 l22 14 m-24 -5 l21 -8" fill="none" stroke="#8e7660" stroke-width="1"/>'
 elif genus=='Arctodus':
  color='#a08469';ears='<circle cx="130" cy="54" r="10"/><circle cx="151" cy="53" r="9"/>';body=body.replace('L55 139','L54 147').replace('L112 140','L111 146');extra='<path d="M166 82 Q174 86 167 91 Q161 90 160 85Z" fill="#614b3e"/>'
 elif genus=='Diprotodon':
  color='#aaa08a';ears='<ellipse cx="135" cy="55" rx="10" ry="15"/>';extra='<ellipse cx="164" cy="82" rx="10" ry="12" fill="#6a6156"/>'
 x,y=head
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 165"><title>{genus} · cartoon reconstruction</title><ellipse cx="103" cy="155" rx="75" ry="5" fill="#635240" opacity=".12"/><g fill="{color}" stroke="#4c4036" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">{tail}{body}{ears}{extra}<ellipse cx="{x}" cy="{y}" rx="6" ry="7" fill="#fff9ec"/><ellipse cx="{x+2}" cy="{y+1}" rx="3" ry="4.5" fill="#4c4036" stroke="none"/><circle cx="{x+3}" cy="{y-2}" r="1.4" fill="white" stroke="none"/></g></svg>'
 (out/(genus.lower()+'.svg')).write_text(svg)
print('Rendered extinct mammal reconstructions')
