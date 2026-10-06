#!/usr/bin/env python3
"""Admit measured placental mid-lactation compilation values, never model output."""
import csv
import hashlib
import json
import math
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
P=ROOT/'data/animalstats'
path=P/'source/expansion-milk-data.csv'
assert hashlib.sha256(path.read_bytes()).hexdigest()=='16358f4f0263393d1c6725e7455425a0d9018b4a6349b2f1d73ac116b6c7601e'
data=json.loads((P/'pilot.json').read_text())
animals={a['scientificName']:a for a in data['animals'] if a.get('entityType') != 'breed'}
sid='blomquist-2019-measured-milk'
source=dict(id=sid,name='Blomquist: corrected measured milk composition',sourceClass='curated-trait-database',
            url='https://doi.org/10.7717/peerj.8085',versionYear='Blomquist 2019',
            retrievedAt='2026-10-03',license='CC BY 4.0; Blomquist 2019, PeerJ 7:e8085')
data['sources']=[s for s in data['sources'] if s['id']!=sid]+[source]
specs=[('Fat','milk_fat_concentration','Fattiest milk','milk-fat','intuitive'),
       ('Sugar','milk_sugar_concentration','Most sugar in milk','milk-sugar','intuitive'),
       ('Protein','milk_protein_concentration','Most protein in milk','milk-protein','specialist')]
traits={}
for column,tid,label,key,kind in specs:
    basis=(f'Measured {column.lower()} concentration in g per 100 g of whole milk, from Blomquist 2019 '
           'Supplemental Information 1 data/milkData.csv, correcting the Skibiel et al. 2013 mid-lactation compilation. '
           'Placental mammals only; exact species matches, at least three source animals and reported lactation stage. '
           'Marsupial pouch-emergence milk is not combined with placental mid-lactation milk. '
           'Missing cells, phylogenetic imputations, transformed concentrations and inferred milk energy are excluded. '
           'Study composition varies by assay, population and lactation stage; these are published compilation means, not universal constants.')
    traits[column]=dict(id=tid,displayName=label,unit='g/100 g milk',definition=basis,measurementBasis=basis,
                        canonicalSourceId=sid,eligibilityGroups=[],direction='higher_wins',
                        separationMethod='positive_ratio_5_percent',gameplayFamily='milk-composition',
                        metricKey=key,categoryKind=kind,
                        playerHint='Measured milk composition during the middle of nursing. Published study averages.')
ids={t['id'] for t in traits.values()}
data['traits']=[t for t in data['traits'] if t['id'].removesuffix('__low') not in ids]+list(traits.values())
data['values']=[v for v in data['values'] if v['traitId'].removesuffix('__low') not in ids]
audit=[]
for i,row in enumerate(csv.DictReader(path.open()),2):
    species=row['Species']
    if species not in animals or row['Order'] not in {'Artiodactyla','Carnivora','Cetacea','Perrissodactyla','Primates','Proboscidea','Rodentia'}:continue
    if not re.fullmatch(r'\d+\+?',row['N']) or int(row['N'].rstrip('+'))<3 or row['Lactation.stage'] in {'NA',''}:continue
    # The original study name is authoritative. Phylogenetic tip synonyms
    # cannot move data to another species or merge a domestic/wild form.
    for column,trait in traits.items():
        if row[column]=='NA':continue
        n=float(row[column]);assert math.isfinite(n) and 0<=n<=100
        data['values'].append(dict(animalId=animals[species]['id'],traitId=trait['id'],valueNumeric=n,
             unit=trait['unit'],sex='female',lifeStage='lactating adult',measurementBasis=trait['measurementBasis'],
             sourceId=sid,observationType='compiled',confidence='approved',uncertaintyStatus='not-reported',
             notes=f"Blomquist 2019 supplement data/milkData.csv row {i}; original Species={species}; N={row['N']}; "
                   f"lactation stage as reported={row['Lactation.stage']}. {column} column in g/100 g whole milk. "
                   "Skibiel et al. 2013 doi:10.1111/1365-2656.12095 selected mid-lactation data; Blomquist corrected inconsistent entries. "
                   "No model-imputed sugar or energy conversion. Uncertainty not reported in the compilation; no zero-width interval assigned."))
        audit.append(dict(species=species,traitId=trait['id'],value=n,column=column,row=i,
                          sampleSizeRaw=row['N'],lactationStageRaw=row['Lactation.stage'],
                          decision='approved-placental-mid-lactation-compilation'))
(P/'pilot.json').write_text(json.dumps(data,indent=2,ensure_ascii=False)+'\n')
(P/'research/milk-gameplay-audit.json').write_text(json.dumps(dict(
    sourceSha256=hashlib.sha256(path.read_bytes()).hexdigest(),reviewedAt='2026-10-03',records=audit,
    protocolEvidence=['https://doi.org/10.1111/1365-2656.12095','https://doi.org/10.7717/peerj.8085'],
    rejectedGroups=['Marsupials: pouch-emergence stage not equivalent','Monotremes: mature-stage comparability not established'],
    approvalScope='Published measured compilation, exact names only; at most one milk-composition category on a board; separation checked independently'),indent=2)+'\n')
print(json.dumps({'observations':len(audit),'species':len({r['species'] for r in audit}),'new_metric_families':3}))
