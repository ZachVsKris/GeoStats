import fs from 'node:fs';
import assert from 'node:assert/strict';
const target='data/animalstats/existing-coverage.json',data=JSON.parse(fs.readFileSync(target));
const marker='Pregnancy-context hold: the 35-day AnAge value describes active post-implantation gestation, not the full conception-to-birth period including delayed implantation. Do not rank it as total time pregnant.';
const rows=data.values.filter(value=>value.animalId==='gulo_gulo'&&['gestation','gestation__low'].includes(value.traitId));
assert.equal(rows.length,2,'Both Wolverine pregnancy directions must be retained for review');
for(const value of rows){
 assert.equal(value.valueNumeric,35,'Preserve the frozen AnAge value; do not replace with an invented midpoint');
 if(process.argv.includes('--write')){value.confidence='review';if(!value.notes.includes(marker))value.notes+=' '+marker;}
 assert.notEqual(value.confidence,'approved','Unresolved active-versus-total gestation cannot enter pregnancy rankings');
}
if(process.argv.includes('--write')){
 fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');
 fs.writeFileSync('data/animalstats/research/mammal-pregnancy-context-hold-20261016.json',JSON.stringify({reviewDate:'2026-10-16',status:'withheld; source values retained',scope:'Wolverine only; broader delayed-implantation source audit unfinished',reason:marker,sources:['https://research.fs.usda.gov/feis/species-reviews/gugu','https://www.adfg.alaska.gov/index.cfm?adfg=wolverine.main','https://animaldiversity.org/accounts/Gulo_gulo/'],records:rows.map(row=>({...row,dataset:'existing-coverage'}))},null,2)+'\n');
}
console.log('Wolverine pregnancy context: two directional records held; raw 35 days retained.');
