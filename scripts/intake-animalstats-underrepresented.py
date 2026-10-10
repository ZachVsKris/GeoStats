#!/usr/bin/env python3
"""Reproduce the newly acquired bulk archives. Never execute upstream scripts."""
import pathlib,urllib.request,json,hashlib,py7zr
S=pathlib.Path(__file__).resolve().parents[1]/'data/animalstats/source/underrepresented-20261010';S.mkdir(parents=True,exist_ok=True)
files=[('amphibio.zip','https://ndownloader.figshare.com/files/8828578'),('arthropod-raw.7z','https://zenodo.org/api/records/13379714/files/Raw%20datasets.7z/content')];manifest=[]
for name,url in files:
 p=S/name
 if not p.exists():p.write_bytes(urllib.request.urlopen(url,timeout=60).read())
 manifest.append({'file':name,'url':url,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'approvedGameValues':0})
with py7zr.SevenZipFile(S/'arthropod-raw.7z') as archive:
 if not (S/'arthropod-raw').exists():archive.extractall(S/'arthropod-raw')
(S/'download-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print('Archived two bulk sources; no gameplay approvals.')
