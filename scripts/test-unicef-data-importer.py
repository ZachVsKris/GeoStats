#!/usr/bin/env python3
import importlib.util,sys,tempfile
from pathlib import Path
p=Path(__file__).with_name('import-unicef-data.py');s=importlib.util.spec_from_file_location('unicef',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
assert len(m.SPECS)==16
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'u.csv';f.write_text('Country Code,Year,Indicator,Sex,Residence,Value\nUSA,2022,Children under 5 who are stunted (%),Total,National,3\nCAN,2022,Children under 5 who are stunted (%),Both sexes,Total,2\nUSA,2022,Children under 5 who are stunted (%),Female,National,4\n',encoding='utf-8')
 imp=m.Importer(None,str(f),True);c=next(x for x in imp.discover() if x.rule.key=='stunting-u5');obs=imp.fetch_observations(c);assert len(obs)==2
 bad=Path(d)/'bad.csv';bad.write_text('Country Code,Year,Indicator,Sex,Residence,Value\nUSA,2022,Children under 5 who are stunted (%),Total,National,120\n',encoding='utf-8')
 try:m.Importer(None,str(bad),True)._parse();raise AssertionError
 except RuntimeError:pass
print('UNICEF importer tests passed.')
