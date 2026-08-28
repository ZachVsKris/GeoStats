import csv,io,tempfile,zipfile
from pathlib import Path
from openpyxl import Workbook
from data_pipeline.official_tabular import read_official_rows, source_file_sha256
with tempfile.TemporaryDirectory() as d:
    root=Path(d)
    # Neutral extension containing CSV data.
    csvp=root/'a.bulk'; csvp.write_text('country,year,value\nFrance,2024,1\n',encoding='utf-8')
    assert read_official_rows(str(csvp))[0]['country']=='France'; assert len(source_file_sha256(str(csvp)))==64
    # Neutral extension containing XLSX bytes.
    wb=Workbook(); ws=wb.active; ws.append(['Country','Year','Value']); ws.append(['Germany',2024,2]); xp=root/'x.xlsx'; wb.save(xp)
    neutral=root/'x.bulk'; neutral.write_bytes(xp.read_bytes())
    rows=read_official_rows(str(neutral)); assert rows and rows[0]['Country']=='Germany'
    # Generic ZIP with CSV member remains supported.
    zp=root/'z.bulk'
    with zipfile.ZipFile(zp,'w') as z: z.writestr('data.csv','country,year,value\nChile,2024,3\n')
    assert read_official_rows(str(zp))[0]['country']=='Chile'
print('Official bulk tabular reader fixtures passed.')
