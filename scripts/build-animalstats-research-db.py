#!/usr/bin/env python3
"""Build a queryable research snapshot and conservative live-catalog seed.

Raw records are retained verbatim and never promoted by this importer.
"""
import csv, gzip, hashlib, json, sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
R = ROOT / 'data/animalstats/research'
OUT = Path('/tmp/animalstats-research-seed')
OUT.mkdir(exist_ok=True)
dbpath = R / 'AnimalStats_Research.sqlite'
db = sqlite3.connect(dbpath)
db.executescript('''
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS concepts(id TEXT PRIMARY KEY,bucket TEXT NOT NULL,interest TEXT NOT NULL,recommendation TEXT NOT NULL,evidence_gate TEXT NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS prizes(id TEXT PRIMARY KEY,concept_id TEXT NOT NULL REFERENCES concepts(id),label TEXT NOT NULL,endpoint TEXT NOT NULL,counter_id TEXT);
CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,url TEXT NOT NULL,record_count INTEGER NOT NULL,sha256 TEXT NOT NULL,payload TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS research_records(catalog TEXT NOT NULL REFERENCES sources(id),record_key TEXT NOT NULL,review_status TEXT NOT NULL DEFAULT 'pending',payload TEXT NOT NULL,PRIMARY KEY(catalog,record_key));
CREATE TABLE IF NOT EXISTS checks(concept_id TEXT NOT NULL REFERENCES concepts(id),check_key TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',PRIMARY KEY(concept_id,check_key));
CREATE INDEX IF NOT EXISTS research_status_idx ON research_records(review_status,catalog);
''')
concepts=list(csv.DictReader((R/'category-editorial-review.csv').open()))
assert len({r['id'] for r in concepts})==len(concepts)
prizes=[]; checks=[]
keys=['source_provenance','measured_not_imputed','units_definition','protocol_comparability','uncertainty_ties','animal_coverage','broad_interest','rights']
for r in concepts:
    db.execute('INSERT OR REPLACE INTO concepts VALUES(?,?,?,?,?,?)',(r['id'],r['bucket'],r['interest'],r['recommendation'],r['evidence_gate'],json.dumps(r)))
    for endpoint in ('high','low'):
        label=r[endpoint+'_label']
        if not label: continue
        other='low' if endpoint=='high' else 'high'
        p=dict(id=r['id']+'-'+endpoint,concept_id=r['id'],label=label,endpoint=endpoint,counter_id=r['id']+'-'+other if r[other+'_label'] else None)
        prizes.append(p)
        db.execute('INSERT OR REPLACE INTO prizes VALUES(:id,:concept_id,:label,:endpoint,:counter_id)',p)
    for key in keys:
        checks.append(dict(concept_id=r['id'],check_key=key,status='pending'))
        db.execute('INSERT OR IGNORE INTO checks VALUES(?,?,?)',(r['id'],key,'pending'))
metadata={}
for name in ('manifest.json','broad-catalog-manifest.json','gap-source-manifest.json'):
    m=json.loads((R/name).read_text());metadata.update(m.get('catalogs',m))
sources=[]; total=0
for path in sorted(R.glob('*.jsonl.gz')):
    catalog=path.name.removesuffix('.jsonl.gz'); meta=metadata.get(catalog,{})
    sha=hashlib.sha256(path.read_bytes()).hexdigest()
    rows=[json.loads(line) for line in gzip.open(path,'rt')]
    source=dict(id=catalog,url=meta.get('url',''),record_count=len(rows),sha256=sha,payload={**meta,'file':path.name,'acquisition_status':'acquired','game_approved':False})
    sources.append(source)
    db.execute('INSERT OR REPLACE INTO sources VALUES(?,?,?,?,?)',(catalog,source['url'],len(rows),sha,json.dumps(source['payload'])))
    db.executemany('INSERT OR IGNORE INTO research_records VALUES(?,?,?,?)',((catalog,str(i),'pending',json.dumps(row)) for i,row in enumerate(rows)))
    total+=len(rows)
    # Expand mammal evidence in the live warehouse. Other catalogs are fully
    # queryable in the snapshot; their live import remains explicit, not implied.
    if catalog in ('pantheria','combine-reported'):
        for start in range(0,len(rows),200):
            batch=[dict(catalog=catalog,record_key=str(i),version=str(meta.get('version','pinned snapshot')),review_status='pending',payload=rows[i]) for i in range(start,min(start+200,len(rows)))]
            body=json.dumps(batch,separators=(',',':'))
            assert '$research$' not in body
            (OUT/f'raw-{catalog}-{start:05}.sql').write_text('INSERT INTO public.animal_research_records(catalog,record_key,version,review_status,payload) SELECT catalog,record_key,version,review_status,payload FROM jsonb_to_recordset($research$'+body+'$research$::jsonb) AS x(catalog text,record_key text,version text,review_status text,payload jsonb) ON CONFLICT(catalog,record_key) DO NOTHING;')
db.commit()
assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
assert not db.execute('PRAGMA foreign_key_check').fetchall()
db.close()
def emit(name,table,rows,decl,cols):
    body=json.dumps(rows,separators=(',',':'));assert '$research$' not in body
    (OUT/(name+'.sql')).write_text(f'INSERT INTO public.{table}({cols}) SELECT {cols} FROM jsonb_to_recordset($research${body}$research$::jsonb) AS x({decl}) ON CONFLICT DO NOTHING;')
emit('01-concepts','animal_research_concepts',[dict(id=r['id'],bucket=r['bucket'],interest=r['interest'],recommendation=r['recommendation'],evidence_gate=r['evidence_gate'],payload=r) for r in concepts],'id text,bucket text,interest text,recommendation text,evidence_gate text,payload jsonb','id,bucket,interest,recommendation,evidence_gate,payload')
emit('02-prizes','animal_research_prizes',prizes,'id text,concept_id text,label text,endpoint text,counter_id text','id,concept_id,label,endpoint,counter_id')
emit('03-sources','animal_research_sources',sources,'id text,url text,record_count bigint,sha256 text,payload jsonb','id,url,record_count,sha256,payload')
emit('04-checks','animal_research_checks',checks,'concept_id text,check_key text,status text','concept_id,check_key,status')
summary=dict(concepts=len(concepts),proposed_prizes=len(prizes),source_catalogs=len(sources),research_records=total,quality_checks=len(checks),new_playable_approvals=0,live_mammal_rows_to_add=11679,raw_records_are_not_species_counts=True)
(R/'research-database-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
