"""Pin exact GBIF names and publisher-supplied IUCN categories.

Unknown, ambiguous, higher-rank and synonym matches never become game values.
Historical name dates are authorship dates, not dates of evolution or discovery.
IUCN codes are ordered categories, never population estimates or probabilities.
"""
import concurrent.futures, datetime, hashlib, json, re, urllib.parse, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];P=ROOT/'data/animalstats';S=P/'source'
d=json.loads((P/'pilot.json').read_text());cache=S/'new-20261004-gbif-species.json'
def fetch(a):
    url='https://api.gbif.org/v2/species/match?'+urllib.parse.urlencode(dict(scientificName=a['scientificName'],kingdom='Animalia'))
    try:
        with urllib.request.urlopen(url,timeout=40) as response:r=json.load(response)
        return a['id'],dict(url=url,retrievedAt='2026-10-04',response=r)
    except Exception as e:return a['id'],dict(url=url,error=str(e))
records=json.loads(cache.read_text()) if cache.exists() else {}
missing=[a for a in d['animals'] if a['id'] not in records]
if missing:
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:records.update(dict(ex.map(fetch,missing)))
    cache.write_text(json.dumps(records,indent=2,ensure_ascii=False)+'\n')
records=json.loads(cache.read_text());metadata=json.loads((S/'new-20261004-iucn-checklist-metadata.json').read_text())
assert metadata['title']=='The IUCN Red List of Threatened Species'
assert metadata['license']=='http://creativecommons.org/licenses/by/4.0/legalcode'
codes={'LC':1,'NT':2,'VU':3,'EN':4,'CR':5,'EW':6,'EX':7}
sid='gbif-authorship-20261004';iucn='iucn-gbif-20260728'
sources=[dict(id=sid,name='GBIF pinned zoological name authorship',sourceClass='institutional-database',url='https://www.gbif.org/dataset/d7dddbf4-2cf0-4f39-9b2a-bb099caae36c',versionYear='Exact-name API snapshot 2026-10-04; GBIF Backbone Taxonomy',retrievedAt='2026-10-04',license='GBIF Backbone Taxonomy CC BY 4.0'),dict(id=iucn,name='IUCN Red List checklist published through GBIF',sourceClass='institutional-database',url='https://doi.org/'+metadata['doi'],versionYear='Publisher checklist '+metadata['pubDate'][:10]+'; exact-name snapshot 2026-10-04',retrievedAt='2026-10-04',license='Publisher checklist metadata: CC BY 4.0')]
d['sources']=[s for s in d['sources'] if s['id'] not in {sid,iucn}]+sources
history_basis='Elapsed calendar years from the original zoological name authorship date in the pinned GBIF name usage to reference year 2026. Exact accepted species matches with a single unambiguous four-digit authorship year only. This is the date of the scientific description attached to the species name, not evolutionary age, first human awareness, or the date a genus combination changed. Subtraction of the published year is a date conversion, not a biological estimate.'
conservation_basis='Global IUCN Red List category from the publisher checklist registered in GBIF, published 2026-07-28 and retrieved 2026-10-04. Exact accepted species matches only. Categories are ordered LC < NT < VU < EN < CR < EW < EX; DD, NE and conflicting statuses are excluded. Numeric storage codes encode this order, not extinction probability, population size or distance between risks. Species in the same category tie and cannot share a ranked board. Assessment dates differ; this is the pinned checklist status, not a live reassessment.'
traits=[dict(id='scientific_description_age',displayName='Oldest scientific description',unit='years since description (2026)',definition=history_basis,measurementBasis=history_basis,canonicalSourceId=sid,eligibilityGroups=[],direction='higher_wins',separationMethod='positive_ratio_5_percent',gameplayFamily='history',playerHint='When science formally named the species—not when it evolved.'),dict(id='iucn_extinction_risk',displayName='Most threatened',unit='IUCN category',definition=conservation_basis,measurementBasis=conservation_basis,canonicalSourceId=iucn,eligibilityGroups=[],direction='higher_wins',separationMethod='distinct_ordinal',gameplayFamily='conservation',playerHint='IUCN extinction-risk category. Equal categories tie; this is not a population count.')]
tids={t['id'] for t in traits};d['traits']=[t for t in d['traits'] if t['id'].removesuffix('__low') not in tids]+traits;d['values']=[v for v in d['values'] if v['traitId'].removesuffix('__low') not in tids]
audit=dict(reviewedAt='2026-10-04',sourceSha256=hashlib.sha256(cache.read_bytes()).hexdigest(),publisherMetadata=metadata,records=[],excluded=[])
def value(a,t,n,notes):
    d['values'].append(dict(animalId=a['id'],traitId=t['id'],valueNumeric=n,unit=t['unit'],sex='species-level',lifeStage='species-level',measurementBasis=t['measurementBasis'],sourceId=t['canonicalSourceId'],observationType='compiled',confidence='approved',uncertaintyStatus='not-reported',notes=notes))
for a in d['animals']:
    r=records.get(a['id'],{}).get('response',{});u=r.get('usage',{});diag=r.get('diagnostics',{})
    if u.get('canonicalName')!=a['scientificName'] or u.get('rank')!='SPECIES' or u.get('status')!='ACCEPTED' or r.get('synonym') or diag.get('matchType')!='EXACT' or diag.get('confidence',0)<95 or not any(c.get('rank')=='KINGDOM' and c.get('name')=='Animalia' for c in r.get('classification',[])):
        audit['excluded'].append(dict(animalId=a['id'],reason='Not an unambiguous exact accepted animal species match'));continue
    years=re.findall(r'(?<!\d)(1[7-9]\d{2}|20\d{2})(?!\d)',u.get('authorship',''))
    out=dict(animalId=a['id'],gbifKey=u['key'],authorship=u.get('authorship'),descriptionYear=None,iucnCode=None)
    if len(years)==1 and 1758<=int(years[0])<2026:
        year=int(years[0]);out['descriptionYear']=year
        value(a,traits[0],2026-year,f"Exact GBIF species {u['key']}; authorship: {u['authorship']}; source naming year {year}. Reference year 2026; no invented day/month. Species page https://www.gbif.org/species/{u['key']}.")
    statuses=[s for s in r.get('additionalStatus',[]) if s.get('datasetKey')==metadata['key'] and s.get('statusCode') in codes]
    if len(statuses)==1:
        status=statuses[0];out['iucnCode']=status['statusCode']
        value(a,traits[1],codes[status['statusCode']],f"Publisher IUCN dataset {metadata['key']}; GBIF species {u['key']}; IUCN taxon ID {status.get('sourceId')}; category {status['statusCode']} ({status['status']}); checklist published {metadata['pubDate'][:10]}. No Data Deficient/Not Evaluated records, no population estimates. IUCN species page https://www.iucnredlist.org/species/{status.get('sourceId')}.")
    audit['records'].append(out)
(P/'pilot.json').write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n');(P/'research/history-conservation-audit.json').write_text(json.dumps(audit,indent=2,ensure_ascii=False)+'\n')
print({t['id']:sum(v['traitId']==t['id'] for v in d['values']) for t in traits},flush=True)
