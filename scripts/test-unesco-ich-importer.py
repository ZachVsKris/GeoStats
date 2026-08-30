import importlib.util,json,tempfile,sys
from pathlib import Path
p=Path(__file__).with_name('import-unesco-ich.py');spec=importlib.util.spec_from_file_location('unescoich',p);m=importlib.util.module_from_spec(spec);sys.modules[spec.name]=m;spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'ich.json';f.write_text(json.dumps({'results':[{'id':'a','countries':['FR','DE']},{'id':'b','countries':[{'code_iso':'FR'}]}]}))
 imp=m.Importer(None,str(f),True); assert imp.counts['FRA']==2 and imp.counts['DEU']==1;assert imp.discover()[0].metadata['v16_2_6_content_reviewed']
 result=imp.run();assert result['retired_candidates_filtered']==1 and result['candidates_selected']==0 and result['categories_processed']==0
print('UNESCO ICH importer fixtures passed.')
