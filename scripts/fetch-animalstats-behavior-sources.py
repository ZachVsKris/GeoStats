#!/usr/bin/env python3
"""Download research-only comparative tables; never approve game observations."""
import concurrent.futures
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request
import argparse

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/animalstats/source'
OUT = ROOT / 'data/animalstats/research/behavior-downloads.json'
DRYAD = {
    'sound': '10.5061/dryad.cnp5hqchb',
    'horns': '10.5061/dryad.fxpnvx16w',
    'healing': '10.5061/dryad.6hdr7srbs',
    'mammal-food-types': '10.5061/dryad.83bk3j9vk',
    'development': '10.5061/dryad.vx0k6djrp',
    'growth': '10.5061/dryad.7187d',
    'bird-diving': '10.5061/dryad.z612jm6rq',
    'tail-regrowth': '10.5061/dryad.f7m0cfxv9',
    'mammal-migration': '10.5061/dryad.78v5j',
}
STATIC = {
 'cognition-MacLean_et_al_PNAS_2014_Self_Control_AnotB.csv': ('https://ndownloader.figshare.com/files/9700537', '10.6084/m9.figshare.5579335'),
 'cognition-MacLean_et_al_PNAS_2014_Self_Control_Cylinder.csv': ('https://ndownloader.figshare.com/files/9700540', '10.6084/m9.figshare.5579335'),
 'torpor-Hibernation_phenotypes_supportingdata.xlsx': ('https://ndownloader.figshare.com/files/41099102', 'figshare:23310731'),
 'diving-comparative.csv': ('https://zenodo.org/records/4995679/files/Diving_dataset.csv?download=1', '10.5061/dryad.tqjq2bvv9'),
 'olfaction-comparative.xlsx': ('https://zenodo.org/records/10458272/files/Table_S1-to-S12.xlsx?download=1', '10.5061/dryad.73n5tb33v'),
 'mammal-food-types-Supplemental_data_1_diet_dataset.csv': ('https://zenodo.org/records/7577690/files/Supplemental_data_1_diet_dataset.csv?download=1', '10.5061/dryad.83bk3j9vk'),
 'torpor-review.html': ('https://pmc.ncbi.nlm.nih.gov/articles/PMC4351926/', '10.1111/brv.12137'),
}

def fetch(url):
    with urllib.request.urlopen(url, timeout=35) as response:
        return response.read()

def save(name, url, doi):
    data = fetch(url)
    (SOURCE / name).write_bytes(data)
    return dict(path='data/animalstats/source/' + name, url=url, doi=doi,
                bytes=len(data), sha256=hashlib.sha256(data).hexdigest(),
                status='downloaded_research_only')

def dryad(item):
    key, doi = item
    entries = []
    try:
        dataset = json.loads(fetch('https://datadryad.org/api/v2/datasets/' + urllib.parse.quote('doi:' + doi, safe='')))
        version = dataset['_links']['stash:version']['href']
        files = json.loads(fetch('https://datadryad.org' + version + '/files'))
        for file in files['_embedded']['stash:files']:
            filename = file['path']
            if pathlib.Path(filename).suffix.lower() not in {'.csv', '.xlsx', '.xls', '.txt', '.md'}:
                continue
            if file.get('size', 0) > 12_000_000:
                continue
            # Public website download route; API download route requires API auth.
            file_id = file['_links']['self']['href'].rsplit('/', 1)[-1]
            url = 'https://datadryad.org/downloads/file_stream/' + file_id
            safe_name = key + '-' + pathlib.Path(filename).name
            try:
                entries.append(save(safe_name, url, doi))
            except Exception as error:
                entries.append(dict(source=key, url=url, doi=doi, status='download_failed', error=str(error)))
    except Exception as error:
        entries.append(dict(source=key, doi=doi, status='download_failed', error=str(error)))
    return entries

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--cached-only', action='store_true', help='Record existing static snapshots without retrying publisher downloads')
    args = parser.parse_args()
    SOURCE.mkdir(parents=True, exist_ok=True)
    results = []
    for name, (url, doi) in STATIC.items():
        try:
            path = SOURCE / name
            if path.exists():
                data = path.read_bytes()
                results.append(dict(path='data/animalstats/source/' + name, url=url, doi=doi,
                    bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), status='downloaded_research_only'))
            else:
                results.append(save(name, url, doi))
        except Exception as error:
            results.append(dict(source=name, url=url, doi=doi, status='download_failed', error=str(error)))
    if not args.cached_only:
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            for group in executor.map(dryad, DRYAD.items()):
                results.extend(group)
                print([(r.get('path', r.get('source')), r['status']) for r in group], flush=True)
    elif OUT.exists():
        results.extend(r for r in json.loads(OUT.read_text())['downloads'] if r.get('doi') in DRYAD.values() and r.get('status') == 'download_failed')
    try:
        manifest = json.loads((SOURCE / 'travel-api.json').read_text())
        for file in ([] if args.cached_only else manifest['files']):
            if pathlib.Path(file['key']).suffix.lower() in {'.csv', '.txt', '.pdf'}:
                results.append(save('travel-' + file['key'], file['links']['self'], manifest['doi']))
    except Exception as error:
        results.append(dict(source='travel', status='download_failed', error=str(error)))
    OUT.write_text(json.dumps(dict(retrieved='2026-10-02', purpose='research_only', downloads=results), indent=2) + '\n')

if __name__ == '__main__':
    main()
