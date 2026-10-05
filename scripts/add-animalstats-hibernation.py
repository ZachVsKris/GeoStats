#!/usr/bin/env python3
"""Import only directly tabulated maximum bouts, never estimated mean durations."""
import hashlib
import json
from pathlib import Path

P = Path(__file__).resolve().parents[1] / 'data/animalstats'
d = json.loads((P / 'pilot.json').read_text())
source_id = 'ruf-geiser-2015-hibernation'
source = dict(id=source_id, name='Ruf & Geiser: published hibernation records',
    sourceClass='curated-trait-database', url='https://doi.org/10.1111/brv.12137',
    versionYear='2015; Table 1', retrievedAt='2026-10-05', license='CC BY; open-access article')
basis = ('Maximum recorded duration of one hibernation torpor bout, in hours, exactly as tabulated '
    'in Ruf & Geiser 2015 Table 1 (TBDmax). HIB records only. A bout ends at a warm-up: this is '
    'not the whole winter, ordinary sleep, a typical duration, or the maximum physically possible. '
    'The authors select published maxima from the season with most pronounced torpor or the most '
    'extensive study. Wild/captive setting, temperature, age and sex are not standardized. '
    'No estimated TBDmean, daily-torpor records, allometric predictions or invented uncertainty bounds.')
records = [
    ('mesocricetus_auratus', 264, 5, 'Lyman (1948); Pohl (1961)'),
    ('myotis_lucifugus', 1152, 7, 'Hock (1951); Jonasson & Willis (2012)'),
    ('erinaceus_europaeus', 288, 8, 'Kristoffersson & Soivio (1964); Thäti (1978)'),
    ('tachyglossus_aculeatus', 648, 4, 'Augee & Ealey (1968); Grigg et al. (1989); Nicol & Andersen (2002)'),
]
ids = {'maximum_hibernation_bout', 'maximum_hibernation_bout__low'}
d['sources'] = [s for s in d['sources'] if s['id'] != source_id] + [source]
d['traits'] = [t for t in d['traits'] if t['id'] not in ids]
d['values'] = [v for v in d['values'] if v['traitId'] not in ids]
for tid, label, direction, counter in [
    ('maximum_hibernation_bout', 'Longest hibernation stretch', 'higher_wins', 'maximum_hibernation_bout__low'),
    ('maximum_hibernation_bout__low', 'Shortest hibernation stretch', 'lower_wins', 'maximum_hibernation_bout')]:
    d['traits'].append(dict(id=tid, displayName=label, unit='hours', definition=basis,
        measurementBasis=basis, canonicalSourceId=source_id, eligibilityGroups=[], direction=direction,
        separationMethod='positive_ratio_5_percent', gameplayFamily='hibernation', metricKey='hibernation-bout',
        prototypeCategory=True, categoryKind='intuitive', counterTraitId=counter,
        playerHint='Longest recorded stretch between warm-ups—not the entire winter.'))
    for aid, number, page, references in records:
        d['values'].append(dict(animalId=aid, traitId=tid, valueNumeric=number, unit='hours',
            sex='source cohorts not standardized', lifeStage='source cohorts not standardized',
            measurementBasis=basis, sourceId=source_id, observationType='compiled', confidence='approved',
            uncertaintyStatus='not-reported', notes=f'Table 1, PDF page {page + 1}, HIB, TBDmax={number} h. References: {references}. '
                'Methods and table checked against the author-hosted open-access paper; exact tabulated maximum, not estimated mean. '
                'Source https://www.une.edu.au/__data/assets/pdf_file/0005/107852/RufGeiser_DailyTorpor-and-Hibernation_BiolRev2015.pdf'))
# Calendar dates have a meaningful ordering, not a biological ratio threshold.
for trait in d['traits']:
    if trait['id'] in {'scientific_description_age', 'scientific_description_age__low'}:
        trait['separationMethod'] = 'distinct_ordinal'
(P / 'pilot.json').write_text(json.dumps(d, indent=2, ensure_ascii=False) + '\n')
(P / 'research/hibernation-record-audit.json').write_text(json.dumps(dict(
    reviewedAt='2026-10-05', source=source, measurementBasis=basis,
    records=[dict(animalId=aid, valueHours=n, pdfPage=page+1, primaryReferences=refs) for aid,n,page,refs in records],
    excluded=['Estimated mean bout durations', 'Daily torpor', 'Ambiguous continuous-temperature bouts',
        'Bear and badger durations: table intentionally supplies none', 'Species without exact table matches'],
    approvalScope='Exact published record comparison, with differing study conditions disclosed. Not a standardized species-mean experiment.'
), indent=2, ensure_ascii=False) + '\n')
print('Added two paired labels and eight exactly tabulated observations.')
