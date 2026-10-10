"""Reproduce the bulk database intake. Downloads data; never executes source code.

Requires libarchive-c and the system libarchive for the Marsupial RAR archive.
The audit script requires pyarrow. Run each script from any working directory.
"""
import concurrent.futures
import hashlib
import json
import urllib.request
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
print(f'Acquired {len(results)} bulk data/metadata files; run audit-animalstats-bulk-intake.py next.')
