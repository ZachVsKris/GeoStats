"""Reproduce the bulk database intake. Downloads data; never executes source code.

Requires libarchive-c and the system libarchive for the Marsupial RAR archive.
The audit script requires pyarrow. Run each script from any working directory.
"""
import concurrent.futures
import hashlib
import json
import urllib.request
import zipfile
from pathlib import Path

import libarchive

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/animalstats/source/bulk-intake-20261010'
OUT.mkdir(parents=True, exist_ok=True)
JOBS = [('biotic.csv', 'https://api.mba.ac.uk/biotic'),
        ('marsupial-metadata.json', 'https://api.figshare.com/v2/articles/29626664'),
        ('marsupial-Data_S1.rar', 'https://ndownloader.figshare.com/files/61672948'),
        ('spider-traits.json', 'https://spidertraits.sci.muni.cz/backend/traits?offset=0&limit=10000'),
        ('mammal-synthesis-metadata.json', 'https://datadryad.org/api/v2/datasets/doi%3A10.5061%2Fdryad.05qfttfdq'),
        ('mammal-synthesis-version.json', 'https://datadryad.org/api/v2/versions/435342'),
        ('mammal-synthesis-files.json', 'https://datadryad.org/api/v2/versions/435342/files')]
JOBS += [
    ('combine-metadata.json', 'https://api.figshare.com/v2/articles/13028255'),
    ('combine/trait_data_reported.csv', 'https://ndownloader.figshare.com/files/27703263'),
    ('combine/trait_data_sources.csv', 'https://ndownloader.figshare.com/files/27703260'),
    ('combine/trait_databases.csv', 'https://ndownloader.figshare.com/files/24886955'),
    ('combine/taxonomy_crosswalk.csv', 'https://ndownloader.figshare.com/files/24886949'),
    ('tetrapod-metadata.json', 'https://zenodo.org/api/records/18926700'),
    ('tetrapod/TetrapodTraits_v2.0.1.csv', 'https://zenodo.org/api/records/18926700/files/TetrapodTraits_v2.0.1.csv/content'),
    ('toff-10253219-metadata.json', 'https://api.figshare.com/v2/articles/10253219'),
    ('toff-10253291-metadata.json', 'https://api.figshare.com/v2/articles/10253291'),
    ('toff/Thesaurus_TOFF_20240531.xlsx', 'https://ndownloader.figshare.com/files/46759141'),
    ('toff/TOFF_Data_Release_7-1.zip', 'https://ndownloader.figshare.com/files/24062585'),
]
for directory, db, names in [
        ('fishbase', 'fb', 'diet ecology eggs fooditems larvae maturity morphdat morphmet popgrowth reproduc spawning speed swimming species refrens'),
        ('sealifebase', 'slb', 'diet ecology eggs fooditems larvae maturity morphdat popgrowth reproduc spawning species refrens')]:
    for name in names.split():
        JOBS.append((f'{directory}/{name}.parquet', f'https://s3.us-west-2.amazonaws.com/us-west-2.opendata.source.coop/cboettig/fishbase/{db}/v26.06/parquet/{name}.parquet'))

audit = ROOT / 'data/animalstats/research/bulk-database-audit-20261010.json'
expected = {}
if audit.exists():
    for source in json.loads(audit.read_text())['sources']:
        for table in source.get('tables', []) + source.get('supportTables', []):
            expected[table['raw']['file']] = table['raw']['sha256']
        if source.get('raw'):
            expected[source['raw']['file']] = source['raw']['sha256']
build_report = ROOT / 'data/animalstats/research/bulk-research-build.json'
if build_report.exists():
    for table in json.loads(build_report.read_text())['sources']:
        expected[table['input']['path']] = table['input']['sha256']


def fetch(job):
    name, url = job
    dest = OUT / name
    try:
        if dest.exists():
            data = dest.read_bytes()
        else:
            data = urllib.request.urlopen(url, timeout=45).read()
        digest = hashlib.sha256(data).hexdigest()
        wanted = expected.get(str(dest.relative_to(ROOT)))
        if wanted and digest != wanted:
            raise ValueError('source differs from audited snapshot; review version before replacing')
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        return {'file': name, 'url': url, 'bytes': len(data), 'sha256': digest, 'status': 'acquired'}
    except Exception as exc:
        return {'file': name, 'url': url, 'status': 'failed', 'error': str(exc)}


with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = list(pool.map(fetch, JOBS))
(OUT / 'download-manifest.json').write_text(json.dumps(results, indent=2) + '\n')
failures = [r for r in results if r['status'] != 'acquired']
if failures:
    raise SystemExit(json.dumps(failures, indent=2))

metadata = json.loads((OUT / 'marsupial-metadata.json').read_text())
archive_path = OUT / 'marsupial-Data_S1.rar'
expected_md5 = metadata['files'][0]['computed_md5']
if hashlib.md5(archive_path.read_bytes()).hexdigest() != expected_md5:
    raise SystemExit('Marsupial archive checksum mismatch')
extract_root = OUT / 'marsupial'
with libarchive.file_reader(str(archive_path)) as archive:
    for entry in archive:
        dest = extract_root / entry.pathname
        if not dest.resolve().is_relative_to(extract_root.resolve()):
            raise SystemExit('Archive member escaped destination')
        if entry.isdir:
            dest.mkdir(parents=True, exist_ok=True)
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(b''.join(entry.get_blocks()))

for metadata_name, directory in [('combine-metadata.json', 'combine'), ('tetrapod-metadata.json', 'tetrapod'),
                                  ('toff-10253219-metadata.json', 'toff'), ('toff-10253291-metadata.json', 'toff')]:
    metadata = json.loads((OUT / metadata_name).read_text())
    for entry in metadata['files']:
        path = OUT / directory / entry.get('name', entry.get('key'))
        if not path.exists():
            continue
        md5 = entry.get('computed_md5', entry.get('checksum', '').replace('md5:', ''))
        if md5 and hashlib.md5(path.read_bytes()).hexdigest() != md5:
            raise SystemExit(f'Publisher checksum mismatch: {path}')
with zipfile.ZipFile(OUT / 'toff/TOFF_Data_Release_7-1.zip') as archive:
    extract_root = OUT / 'toff'
    for name in archive.namelist():
        dest = extract_root / name
        if not dest.resolve().is_relative_to(extract_root.resolve()):
            raise SystemExit('TOFF archive member escaped destination')
        if not name.endswith('/'):
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(archive.read(name))
print(f'Acquired {len(results)} bulk data/metadata files; run audit-animalstats-bulk-intake.py next.')
