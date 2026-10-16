import fs from 'node:fs';
const holds=[
 {dataset:'fish-records',animalId:'pterois_volitans',traits:['fish_record_length','fish_record_length__low'],reason:'Exact-species identity hold: the cited Whitfield 2007 publication reports the Pterois volitans/miles complex. The 45 cm POPCHAR specimen has not been independently resolved to P. volitans.'},
 {dataset:'fish-records',animalId:'pterois_volitans',traits:['fish_record_wild_age','fish_record_wild_age__low'],reason:'Wild-versus-captive hold: Hinton 1962 age context has not been verified as wild. CONABIO describes the ten-year Hinton lionfish at the Monaco Oceanographic Institute as captive; do not publish this as a wild lifespan.'},
 {dataset:'existing-coverage',animalId:'pterois_volitans',traits:['wild_recorded_lifespan','wild_recorded_lifespan__low'],reason:'Wild-versus-captive hold: this AnAge ten-year value traces to reference 1 (FishBase). The underlying Hinton longevity is described as captive by CONABIO; the wild origin field requires independent verification.'},
 {dataset:'fish-records',animalId:'thunnus_thynnus',traits:['fish_record_wild_age','fish_record_wild_age__low'],reason:'Numeric-source-context hold: POPCHAR AgeMax is 18 years while its own original notes describe age 15 corrected to 17. Preserve both without choosing a replacement value until Lee, Prince and Crow 1983 is checked.'},
];
const records=[];
for(const name of new Set(holds.map(hold=>hold.dataset))){
 const target=`data/animalstats/${name}.json`,data=JSON.parse(fs.readFileSync(target));
 for(const hold of holds.filter(hold=>hold.dataset===name))for(const traitId of hold.traits){
  const rows=data.values.filter(value=>value.animalId===hold.animalId&&value.traitId===traitId);
  if(rows.length!==1)throw Error(`Expected one held cell: ${hold.animalId} ${traitId}`);
  const value=rows[0];
  if(process.argv.includes('--write')){value.confidence='review';if(!value.notes.includes(hold.reason))value.notes+=' '+hold.reason;}
  if(value.confidence==='approved')throw Error(`Unresolved source-context cell reapproved: ${hold.animalId} ${traitId}`);
  records.push({...value,dataset:name,holdReason:hold.reason});
 }
 if(process.argv.includes('--write'))fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');
}
if(process.argv.includes('--write'))fs.writeFileSync('data/animalstats/research/fish-source-context-holds-20261016.json',JSON.stringify({reviewDate:'2026-10-16',status:'withheld pending original-source context verification; raw values retained',references:['https://www.conabio.gob.mx/institucion/proyectos/resultados/MQ001_Anexo_Ficha_Pterois_volitans.pdf','https://www.fws.gov/sites/default/files/documents/Ecological-Risk-Screening-Summary-Red-Lion-Fish.pdf','https://fishbase.net.br/references/FBRefSummary.php?id=85278&speccode=5195&syncode=25511'],records},null,2)+'\n');
console.log(`Fish source-context guard: ${records.length} directional records held.`);
