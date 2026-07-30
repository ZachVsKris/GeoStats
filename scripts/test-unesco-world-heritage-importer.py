import importlib.util
import tempfile
from pathlib import Path

path = Path(__file__).with_name("import-unesco-world-heritage.py")
spec = importlib.util.spec_from_file_location("heritage_importer", path)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

xml = """<root>
<row><states>France</states><category>Cultural</category><danger>0</danger></row>
<row><states>France; Germany</states><category>Natural</category><danger>yes</danger></row>
<row><states>Germany</states><category>Mixed</category><danger>0</danger></row>
</root>"""
with tempfile.TemporaryDirectory() as directory:
    input_path = Path(directory) / "heritage.xml"
    input_path.write_text(xml)
    counts = module.parse_xml(input_path)
    assert counts["FRA"]["all-sites"] == 2
    assert counts["DEU"]["natural-sites"] == 1
    assert counts["FRA"]["danger-sites"] == 1
    importer = module.Importer(None, str(input_path), True)
    assert len(importer.discover()) == 5
    assert len(importer.fetch_observations(importer.discover()[0])) == 2
print("UNESCO World Heritage importer fixtures passed.")
