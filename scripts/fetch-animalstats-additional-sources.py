"""Acquire public source files; --cached-only verifies snapshots without network."""
import argparse,hashlib,json,pathlib,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1];P=ROOT/'data/animalstats/source'
S={
'nest-Dataset-S1.csv':'https://raw.githubusercontent.com/catherinesheard/global-nest-data/main/Dataset-S1.csv',
'nest-Dataset-S2.csv':'https://raw.githubusercontent.com/catherinesheard/global-nest-data/main/Dataset-S2.csv',
'nest-Dataset-S1-metadata.csv':'https://raw.githubusercontent.com/catherinesheard/global-nest-data/main/Dataset-S1-metadata.csv',
'nest-Dataset-S2-metadata.csv':'https://raw.githubusercontent.com/catherinesheard/global-nest-data/main/Dataset-S2-metadata.csv',
'pollinators-bee_trait_20240922.csv':'https://zenodo.org/records/8300431/files/bee_trait_20240922.csv?download=1',
'pollinators-ListOfTraits.csv':'https://zenodo.org/records/8300431/files/ListOfTraits.csv?download=1',
'pollinators-syrphid_traits_20240326.txt':'https://zenodo.org/records/8300431/files/syrphid_traits_20240326.txt?download=1',
'mammalbase-diets.tsv':'https://raw.githubusercontent.com/mammalbase/database/main/MammalBaseDietDatabase.tsv',
'frugint.zip':'https://zenodo.org/records/18016801/files/FRUGINT.zip?download=1',
'eyes-vertebrates.csv':'https://raw.githubusercontent.com/knthomas/anuran-eye-size/166d780d2cee43ae4a7495b1878ba9e5378bdf0d/Data/other%20verts/vertebrate_eyesize.csv'}
a=argparse.ArgumentParser();a.add_argument('--cached-only',action='store_true');args=a.parse_args();result=[]
for name,url in S.items():
 try:
  if not args.cached_only:P.joinpath(name).write_bytes(urllib.request.urlopen(url,timeout=35).read())
  b=P.joinpath(name).read_bytes();result.append({'file':name,'url':url,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'status':'acquired','version_warning':'Mutable source URL; compare hash on reacquisition.' if '/main/' in url else None})
 except Exception as e:result.append({'file':name,'url':url,'status':'failed','error':str(e)})
(ROOT/'data/animalstats/research/additional-source-downloads.json').write_text(json.dumps(result,indent=2)+'\n')
print(len(result),'source snapshots checked')
