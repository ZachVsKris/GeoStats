#!/usr/bin/env python3
"""Acquire complete paleontology tables without executing source analysis scripts."""
import urllib.request,json,pathlib,hashlib,csv,io
P=pathlib.Path(__file__).resolve().parents[1]/'data/animalstats/source/extinct-20261010';P.mkdir(parents=True,exist_ok=True)
benson=P/'benson-original.xls'
if not benson.exists():benson.write_bytes(urllib.request.urlopen('https://journals.plos.org/plosbiology/article/file?id=10.1371/journal.pbio.1001853.s011&type=supplementary',timeout=60).read())
u='https://paleobiodb.org/data1.2/taxa/list.json?base_name=Dinosauria&rank=species&show=attr,app&limit=all'
p=P/'pbdb-dinosaur-species.json'
if not p.exists():p.write_bytes(urllib.request.urlopen(u,timeout=90).read())
j=json.loads(p.read_bytes());print('PBDB',len(j['records']),j['records'][:2])
(P/'download-manifest.json').write_text(json.dumps({'pbdb':{'url':u,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'records':len(j['records']),'retrievedAt':'2026-10-10'},'rules':['Exact species joins only','Exclude juveniles and multi-individual bonebeds','No allometric mass calculations','Fossil occurrence counts are database sampling, never population']},indent=2))
