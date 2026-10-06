#!/usr/bin/env python3
"""Import reviewed, exact breed observations; never inherit species data into breeds."""
import csv,gzip,hashlib,json,re,xml.etree.ElementTree as E
from pathlib import Path
P=Path(__file__).resolve().parents[1]/'data/animalstats'; S=P/'source/pets'
DOGS={'Labrador Retriever':'Labrador Retriever','English Cocker Spaniel':'English Cocker Spaniel','Staffordshire Bull Terrier':'Staffordshire Bull Terrier','Chihuahua':'Chihuahua','Shih-tzu':'Shih Tzu','French Bulldog':'French Bulldog','Border Collie':'Border Collie','Yorkshire Terrier':'Yorkshire Terrier','English Springer Spaniel':'English Springer Spaniel','German Shepherd Dog':'German Shepherd','Pug':'Pug','West Highland White Terrier':'West Highland White Terrier','Cavalier King Charles Spaniel':'Cavalier King Charles Spaniel','Golden Retriever':'Golden Retriever','Bichon Frise':'Bichon Frise','Miniature Dachshund':'Miniature Dachshund','Border Terrier':'Border Terrier','Miniature Schnauzer':'Miniature Schnauzer','Beagle':'Beagle','Boxer':'Boxer','Pomeranian':'Pomeranian','Rottweiler':'Rottweiler','Whippet':'Whippet','Greyhound':'Greyhound','Toy Poodle':'Toy Poodle','Maltese':'Maltese'}
CATS=['Maine Coon','Ragdoll','British Shorthair','Persian','Birman','Abyssinian','Siberian','Norwegian Forest','Russian Blue','Exotic Shorthair','Somali','Bengal','Siamese','Burmese','Sphynx']
def aid(kind,name):return kind+'_'+re.sub('[^a-z0-9]+','_',name.lower()).strip('_')
def write(name,data): (P/name).write_text(json.dumps(data,separators=(',',':'),ensure_ascii=False)+'\n')
def main():
 d=json.loads((P/'pilot.json').read_text()); rows=list(csv.DictReader((S/'reviewed-observations.csv').open())); metrics=json.loads((S/'metrics.json').read_text()); sources=json.loads((S/'sources.json').read_text())
 ids={m['id']+s for m in metrics for s in ['', '__low']}; names=[('dog',v) for v in DOGS.values()]+[('cat',n) for n in CATS]
 animalids={aid(k,n) for k,n in names}; d['animals']=[a for a in d['animals'] if a['id'] not in animalids]
 for kind,name in names:d['animals'].append({'id':aid(kind,name),'commonName':name,'scientificName':'Canis lupus familiaris' if kind=='dog' else 'Felis catus','entityType':'breed','breedName':name,'parentTaxon':'Canis lupus familiaris' if kind=='dog' else 'Felis catus','taxonomicGroup':kind+'-breed','familiarityTier':'core' if name in ['Labrador Retriever','Golden Retriever','German Shepherd','Beagle','Boxer','Chihuahua','French Bulldog','Pug','Maine Coon','Persian','Ragdoll','British Shorthair'] else 'familiar','active':True})
 d['traits']=[t for t in d['traits'] if t['id'] not in ids]; d['values']=[v for v in d['values'] if v['traitId'] not in ids]
 sourceids={s['id'] for s in sources};d['sources']=[s for s in d['sources'] if s['id'] not in sourceids]+sources
 for m in metrics:
  for low in [False,True]:
   t={k:v for k,v in m.items() if k not in ['labels','sex','lifeStage']};t.update(id=m['id']+('__low' if low else ''),displayName=m['labels'][int(low)],direction='lower_wins' if low else 'higher_wins',counterTraitId=m['id']+('' if low else '__low'),prototypeCategory=True,separationMethod='positive_ratio_5_percent',categoryKind='intuitive',eligibilityGroups=[]);d['traits'].append(t)
  for r in [r for r in rows if r['metric']==m['id']]:
   assert r['animalId'] in animalids and float(r['value'])>0
   v={'animalId':r['animalId'],'valueNumeric':float(r['value']),'unit':m['unit'],'sex':m['sex'],'lifeStage':m['lifeStage'],'measurementBasis':m['measurementBasis'],'sourceId':m['canonicalSourceId'],'observationType':'observed','confidence':'approved','notes':r['notes'],'recordOrigin':r['sourceLocator'],'sourceQuality':'exact primary-source breed observation','sampleSizeCategory':r['n'] or 'not reported for this endpoint','uncertaintyStatus':'reported' if r['min'] else 'not-reported','uncertaintyKind':'source-range' if r['min'] else 'not-reported'}
   if r['min']:v.update(valueMin=float(r['min']),valueMax=float(r['max']))
   for suffix in ['', '__low']:d['values'].append(dict(v,traitId=m['id']+suffix))
 write('pilot.json',d);print(json.dumps({'newBreeds':len(names),'dogBreeds':len(DOGS),'catBreeds':len(CATS),'newDirections':len(ids),'observations':len(rows)*2}))
if __name__=='__main__':main()
