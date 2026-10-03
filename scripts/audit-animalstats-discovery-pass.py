"""Verify acquired source formats and preserve field and eligibility distinctions."""
import collections,csv,hashlib,io,json,pathlib,zipfile,openpyxl
ROOT=pathlib.Path(__file__).resolve().parents[1];P=ROOT/'data/animalstats/source';R=ROOT/'data/animalstats/research'
tables=[];warnings=[]
for p in sorted(P.glob('discovery-*')):
 b=p.read_bytes();entry={'file':p.name,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b),'game_approved':False}
 if p.suffix=='.csv':
  text=b.decode('utf-8-sig');rows=list(csv.DictReader(io.StringIO(text)));entry.update(rows=len(rows),fields=list(rows[0]) if rows else [])
 elif p.suffix=='.xlsx' or p.name=='discovery-fish-reproduction.tsv':
  w=openpyxl.load_workbook(io.BytesIO(b),read_only=True,data_only=True);entry['sheets']=[]
  for s in w:
   rows=[r for r in s.values if any(x is not None for x in r)];entry['sheets'].append({'name':s.title,'nonempty_rows':len(rows),'first_row':list(rows[0]) if rows else []})
  if p.name=='discovery-fish-reproduction.tsv':
   rr=list(w['Traits value'].values);h=rr[0];tax=[x for x in rr[1:] if x[0]];entry['species_rank_rows']=sum(x[1]=='S' for x in tax);entry['non_species_rank_rows']=sum(x[1]!='S' for x in tax);entry['gate']='Genus rows and remarks indicating inferred values excluded; fecundity extrema and means separate. Offspring-size provenance required. Actual payload is XLSX despite .tsv filename.'
 elif p.name=='discovery-arthropods.zip':
  z=zipfile.ZipFile(p);tax=list(csv.DictReader(io.StringIO(z.read('taxon.txt').decode()),delimiter='\t'));facts=list(csv.DictReader(io.StringIO(z.read('measurementorfacts.txt').decode()),delimiter='\t'))
  entry.update(taxon_rows=len(tax),measurement_rows=len(facts),order_counts=dict(collections.Counter(x['order'] for x in tax)),field_counts=dict(collections.Counter(x['measurementType'] for x in facts)),license='CC-BY-NC-4.0',gate='Expert knowledge and literature compilation: original method/provenance audit required. Thermal niche is not physiological tolerance. Relative dispersal score is not travel distance. License needs checking before commercial use. No new gameplay import.')
 elif p.name=='discovery-milk-supplement.zip':
  entry.update(valid_zip=zipfile.is_zipfile(p),status='acquired' if zipfile.is_zipfile(p) else 'failed_payload_validation');warnings.append('Milk supplement request returned HTML, not ZIP; milk numeric dataset is not acquired.')
 elif p.suffix=='.xls':
  entry.update(status='acquired_binary_not_yet_parsed',gate='Field energy spreadsheet downloaded; no field observations approved without parsing and unit/source audit.')
 elif p.suffix=='.pdf':entry['status']='acquired_pdf_requires_table_extraction'
 else:continue
 tables.append(entry)
# Verify exact raw measurement filter; do not trust a filename saying filtered.
physiology={}
for key,field in [('fh','fh'),('fr','fr')]:
 p=P/f'discovery-heart-{key}data-filter.csv';rows=list(csv.DictReader(p.open()));valid=[]
 for r in rows:
  try:value=float(r.get(field,''))
  except (ValueError,TypeError):continue
  if r.get('adult')=='y' and r.get('resting')=='y' and r.get('sedated')=='n':valid.append(r)
 physiology[key]={'all_nonblank_rows':sum(bool(r.get('name')) for r in rows),'strict_adult_resting_unsedated_rows':len(valid),'distinct_source_binomials':len({(r.get('genus'),r.get('species')) for r in valid}),'caution':'Original study references, awake status, environment and uncertainty still require audit; do not aggregate duplicates automatically.'}
result={'tables':tables,'physiology_filters':physiology,'warnings':warnings+['Downloaded oxygen-paper accession actually resolves to a lizard movement paper; excluded from fish oxygen evidence.','Spider Zenodo current files contain analysis/phylogeny, not main S1 table; do not claim venom observations acquired.'],'new_playable_approvals':0}
(R/'discovery-source-audit.json').write_text(json.dumps(result,indent=2,default=str)+'\n')
print(json.dumps({'audited_files':len(tables),'physiology_filters':physiology,'warnings':result['warnings']},indent=2))
