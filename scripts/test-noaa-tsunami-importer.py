import importlib.util,tempfile,sys
from pathlib import Path
p=Path(__file__).with_name('import-noaa-tsunami.py');spec=importlib.util.spec_from_file_location('noaa',p);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'t.tsv';f.write_text('COUNTRY\tEVENT VALIDITY\nJapan\t4\nJapan\t2\nFrance\t0\nChile\t1\n');imp=m.Importer(None,str(f),True);assert imp.counts['JPN']==2 and imp.counts['CHL']==1 and 'FRA' not in imp.counts
print('NOAA tsunami importer fixtures passed.')
