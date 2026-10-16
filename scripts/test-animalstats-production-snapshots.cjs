const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const required=['pilot','photos','existing-coverage','tetrapod-spatial','marine','aquatic-eggs','fish-records','underrepresented','insect-ladybirds','extinct','candidates','group-boards','group-boards-2'];
 for(const route of ['animals/page','animals/review/page','api/animals/boards/route','api/animals/data/route','api/animals/results/route']){
  const trace=JSON.parse(fs.readFileSync(path.join(process.cwd(),'.next/server/app',route+'.js.nft.json'),'utf8'));
  for(const name of required)assert(trace.files.some(file=>file.endsWith('/data/animalstats/'+name+'.json')),`${route}: missing source snapshot ${name}`);
 }
 const previous=process.env.ANIMALSTATS_PREVIEW_ENABLED;process.env.ANIMALSTATS_PREVIEW_ENABLED='true';
 try{
  const compiled=require(path.join(process.cwd(),'.next/server/app/api/animals/boards/route.js'));
  const response=await compiled.routeModule.userland.GET();assert.equal(response.status,200);assert.equal(response.headers.get('x-animalstats-validation'),'build-audit','compiled production must match the exact audited source numbers');
  const payload=await response.json(),seal=JSON.parse(fs.readFileSync('data/animalstats/research/release-validation-seal.json','utf8'));
  assert.equal(payload.rows.length,seal.boardCount);assert.equal(payload.version,1);
  const catalogRoute=require(path.join(process.cwd(),'.next/server/app/api/animals/data/route.js'));
  const catalogResponse=await catalogRoute.routeModule.userland.GET(new Request('https://example.test/api/animals/data?scope=catalog'));
  assert.equal(catalogResponse.status,200);const catalogText=await catalogResponse.text(),catalog=JSON.parse(catalogText);
  assert.equal(catalog.origin,'release-snapshot');assert.equal(catalog.detailLevel,'ranking-snapshot');assert.equal(catalog.data.valueEncoding,1);
  const photoMap=new Map(catalog.data.photos.map(photo=>[photo.animalId,photo]));
  const animalMap=new Map(catalog.data.animals.map(animal=>[animal.id,animal]));
  const missingPhotos=payload.animals.filter(id=>{const photo=photoMap.get(id);return !photo?.approved||!photo.assetUrl.startsWith('/animalstats/')||(animalMap.get(id)?.extinctionStatus!=='extinct'&&photo.assetUrl.endsWith('.svg'));});
  assert.deepEqual(missingPhotos,[],'Every animal in production rounds needs an approved client-visible image');
  for(const id of payload.animals)assert(fs.existsSync(path.join(process.cwd(),'public',photoMap.get(id).assetUrl)),`Missing published photo asset: ${id}`);
  assert(catalog.data.values.length>10000);assert(catalog.data.values.every(row=>Array.isArray(row)&&row.length===11));
  console.log(JSON.stringify({productionSnapshotSeal:'exact-match',packagedSourceFiles:required.length,verifiedRoutePackages:5,productionBoards:payload.rows.length,roundAnimalPhotosChecked:payload.animals.length,catalogValues:catalog.data.values.length,catalogResponseBytes:Buffer.byteLength(catalogText),fullObservationDetailsDeferred:true}));
 }finally{if(previous===undefined)delete process.env.ANIMALSTATS_PREVIEW_ENABLED;else process.env.ANIMALSTATS_PREVIEW_ENABLED=previous;}
})().catch(error=>{console.error(error);process.exitCode=1;});
