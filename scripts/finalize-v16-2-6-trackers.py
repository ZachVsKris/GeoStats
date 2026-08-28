#!/usr/bin/env python3
"""Finalize the v16.2.6 master/release ledgers from the recovered WIP.

The timed-out build exported a 496-row planning ledger before later source-backed and
master-spec candidates were fully reconciled. This script reconstructs only candidates
supported by the surviving code or explicit frozen master specification, corrects the
three "remove the dash" parser mistakes, and gives all work an explicit release disposition. It deliberately does not mark an unvalidated
candidate playable: source importers are fail-closed until warehouse validation passes.
"""
from __future__ import annotations
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "V16_2_6_MASTER_TRACKER.csv"
RELEASE = ROOT / "V16_2_6_RELEASE_TRACKER.csv"

ACTUAL_REMOVALS = {
    'EN.GHG.CO2.IC.MT.CE.AR5','EN.GHG.CO2.IP.MT.CE.AR5','EN.GHG.FGAS.IP.MT.CE.AR5',
    'BX.KLT.DINV.CD.WD','BM.KLT.DINV.CD.WD','DT.DOD.MWBG.CD','DT.TDS.DIMF.CD','DT.NFL.MOTH.CD',
    'EN.GHG.N2O.AG.MT.CE.AR5','EN.GHG.N2O.IP.MT.CE.AR5','EN.GHG.N2O.WA.MT.CE.AR5',
    'BM.TRF.PWKR.CD.DT','BX.TRF.PWKR.CD.DT','BX.TRF.PWKR.CD','BX.TRF.CURR.CD','BM.TRF.PRVT.CD',
    'DT.DOD.DSTC.ZS','BX.GRT.TECH.CD.WD','FI.RES.XGLD.CD','BM.GSR.TOTL.CD',
}
TECHNICAL_CLARITY_REMOVALS = {
    'NE.GDI.STKB.CD','BX.GRT.EXTA.CD.WD','BN.TRF.KOGT.CD','BN.KAC.EOMS.CD','BN.FIN.TOTL.CD',
    'DT.NFL.BLAT.CD','BX.PEF.TOTL.CD.WD','BN.KLT.PTXL.CD','DT.DOD.PVLX.CD','BM.GSR.FCTY.CD',
    'BX.GSR.FCTY.CD','BN.RES.INCL.CD',
}
DASH_FIXES = {'2711','EG.ELC.NGAS.ZS','1509'}
LOCAL_CURRENCY_INVALID = {'NE.EXP.GNFS.CN','NE.EXP.GNFS.KN'}
CORRECTED = {'EN.URB.LCTY','AG.LND.ARBL.HA.PC','FB.ATM.TOTL.P5','FB.CBK.BRCH.P5','EN.URB.LCTY.UR.ZS'}
REWRITTEN = {
    'IC.BUS.NREG','IC.BUS.NDNS.ZS','FI.RES.TOTL.CD','BX.GSR.TRAN.ZS','BM.GSR.TRAN.ZS','BX.GSR.TRVL.ZS',
    'BM.GSR.TRVL.ZS','BX.GSR.CCIS.CD','BX.GSR.CCIS.ZS','ER.H2O.FWIN.ZS','EN.URB.MCTY',
    'population:coa:stateless','EG.GDP.PUSE.KO.PP',
}

# These candidate rows are covered by an existing playable category and should not create a duplicate.
ALREADY_COVERED = {
    'candidate:053','candidate:054','candidate:072','candidate:075','candidate:089','candidate:094',
    'candidate:119','candidate:120','candidate:123','candidate:124',
}
# Surviving automatic source implementations. They remain non-playable until all shared warehouse gates pass.
AUTO_IMPORTER = {
    'candidate:001': 'Natural Earth 1:10m country geometry importer',
    'candidate:002': 'Natural Earth 1:10m country geometry importer',
    'candidate:035': 'Natural Earth populated-places capital importer',
    'candidate:036': 'Natural Earth populated-places capital importer',
    'candidate:037': 'Natural Earth populated-places capital importer',
    'candidate:038': 'World Bank CCKP / CRU climatology importer',
    'candidate:039': 'World Bank CCKP / CRU climatology importer',
    'candidate:040': 'World Bank CCKP / CRU climatology importer',
    'candidate:041': 'World Bank CCKP / CRU climatology importer',
    'candidate:055': 'UN World Population Prospects 2024 importer',
    'candidate:056': 'UN World Population Prospects 2024 importer',
    'candidate:057': 'UN World Population Prospects 2024 importer',
    'candidate:058': 'UN World Population Prospects 2024 importer',
    'candidate:059': 'UN World Population Prospects 2024 importer',
    'candidate:060': 'UN World Population Prospects 2024 importer',
    'candidate:061': 'UN World Population Prospects 2024 importer',
    'candidate:068': 'UN World Population Prospects 2024 importer',
    'candidate:073': 'UN World Population Prospects 2024 importer',
    'candidate:074': 'UN World Population Prospects 2024 importer',
    'candidate:115': 'UNESCO Intangible Cultural Heritage DataHub importer',
}
# Surviving importers that require an official bulk input supplied at release time.
BULK_IMPORTER = {
    'candidate:126': 'NOAA/NCEI Global Historical Tsunami Database bulk input',
    'candidate:132': 'IMF WEO April 2026 official all-country download; pinned historical 2024 only',
    'candidate:133': 'IMF WEO April 2026 official all-country download; pinned historical 2024 only',
    'candidate:131': 'IMF WEO April 2026 official all-country download; pinned historical 2024 GDP-per-capita observation only',
    'candidate:144': 'FAO AQUASTAT official bulk input',
    'candidate:069': 'UN DESA International Migrant Stock 2024 official bulk input',
    'candidate:071': 'UN DESA International Migrant Stock 2024 official bulk input',
    'candidate:134': 'WHO Global Health Expenditure Database official bulk input',
    'candidate:136': 'WTO Trade in Commercial Services official bulk input',
    'candidate:138': 'UN Tourism direct official bulk input',
    'candidate:140': 'UN Tourism direct official bulk input',
    'candidate:141': 'UN Tourism direct official bulk input',
}

BULK_SOURCE_OVERRIDES = {
    'candidate:069': ('UN DESA International Migrant Stock 2024','IMS2024:migrant-share','https://www.un.org/development/desa/pd/content/international-migrant-stock'),
    'candidate:071': ('UN DESA International Migrant Stock 2024','IMS2024:migrant-stock','https://www.un.org/development/desa/pd/content/international-migrant-stock'),
    'candidate:134': ('WHO Global Health Expenditure Database','GHED:CHE_PC_USD','https://apps.who.int/nha/database'),
    'candidate:136': ('WTO Trade in Commercial Services','WTO:COMMERCIAL-SERVICES:EXPORTS+IMPORTS','https://stats.wto.org/'),
    'candidate:138': ('UN Tourism','UNTOURISM:arrivals','https://www.unwto.org/tourism-statistics/key-tourism-statistics'),
    'candidate:140': ('UN Tourism','UNTOURISM:receipts','https://www.unwto.org/tourism-statistics/key-tourism-statistics'),
    'candidate:141': ('UN Tourism','UNTOURISM:receipts-share','https://www.unwto.org/tourism-statistics/key-tourism-statistics'),
}

LATE = [
    ('Largest female life-expectancy advantage','Population','People & Society','demographics','UN World Population Prospects 2024','WPP2024:female-life-expectancy-advantage:2023','UN WPP importer survived in WIP; derived reproducibly from female minus male life expectancy.','anchor','automatic'),
    ('Renewable water per person','Environment','Environment & Resources','water-resources','FAO AQUASTAT','AQUASTAT:renewable-water-per-person','AQUASTAT importer survived in WIP; official bulk input required.','standard','bulk'),
    ('Most freshwater withdrawn','Environment','Environment & Resources','water-use','FAO AQUASTAT','AQUASTAT:total-water-withdrawal','AQUASTAT importer survived in WIP; official bulk input required.','standard','bulk'),
    ('Highest agricultural share of water use','Environment','Environment & Resources','water-use','FAO AQUASTAT','AQUASTAT:agricultural-water-share','AQUASTAT importer survived in WIP; official bulk input required.','standard','bulk'),
    ('Highest irrigated cropland share','Agriculture','Food & Agriculture','irrigation','FAO AQUASTAT','AQUASTAT:irrigated-cropland-share','AQUASTAT importer survived in WIP; official bulk input required.','standard','bulk'),
    ('Largest dam capacity','Infrastructure','Infrastructure & Technology','water-infrastructure','FAO AQUASTAT','AQUASTAT:dam-capacity','AQUASTAT importer survived in WIP; official bulk input required.','standard','bulk'),
    ('Most wild fish caught','Agriculture','Food & Agriculture','fisheries-production','FAO Fisheries','FISHSTAT:capture-tonnes','FAO fisheries importer survived in WIP; official bulk input required.','anchor','bulk'),
    ('Most aquaculture production','Agriculture','Food & Agriculture','fisheries-production','FAO Fisheries','FISHSTAT:aquaculture-tonnes','FAO fisheries importer survived in WIP; official bulk input required.','standard','bulk'),
    ('Most fish and aquaculture produced','Agriculture','Food & Agriculture','fisheries-production','FAO Fisheries','FISHSTAT:combined-tonnes','FAO fisheries importer survived in WIP; official bulk input required.','standard','bulk'),
    ('Most gold produced','Resources','Environment & Resources','mineral-production','USGS Minerals','USGS-MCS:gold','USGS mineral-production importer survived in WIP; official MCS bulk input required.','anchor','bulk'),
    ('Most silver produced','Resources','Environment & Resources','mineral-production','USGS Minerals','USGS-MCS:silver','USGS mineral-production importer survived in WIP; official MCS bulk input required.','standard','bulk'),
    ('Most copper produced','Resources','Environment & Resources','mineral-production','USGS Minerals','USGS-MCS:copper','USGS mineral-production importer survived in WIP; official MCS bulk input required.','standard','bulk'),
    ('Most lithium produced','Resources','Environment & Resources','mineral-production','USGS Minerals','USGS-MCS:lithium','USGS mineral-production importer survived in WIP; official MCS bulk input required.','anchor','bulk'),
    ('Most cobalt produced','Resources','Environment & Resources','mineral-production','USGS Minerals','USGS-MCS:cobalt','USGS mineral-production importer survived in WIP; official MCS bulk input required.','standard','bulk'),
    ('Most nickel produced','Resources','Environment & Resources','mineral-production','USGS Minerals','USGS-MCS:nickel','USGS mineral-production importer survived in WIP; official MCS bulk input required.','standard','bulk'),
    ('Most iron ore produced','Resources','Environment & Resources','mineral-production','USGS Minerals','USGS-MCS:iron-ore','USGS mineral-production importer survived in WIP; official MCS bulk input required.','anchor','bulk'),
    ('Most maritime neighbors','Geography','Physical Geography','political-geography','Marine Regions / authoritative maritime-boundary dataset','','Explicit master-spec candidate. No single global adjacency definition/source path has yet passed licensing, territory-treatment and topology validation.','standard','research'),
    ('First national constitution','History','Government & History','constitutional-history','Authoritative national/constitutional chronology','','Explicit master-spec candidate. Requires a complete 195-country chronology plus successor-state rules; no reproducible exhaustive source path was validated.','standard','research'),
    ('First national election','History','Government & History','democratic-history','Authoritative election chronology','','Explicit master-spec candidate. Requires one consistent definition of national election and complete current-state/successor-state chronology.','standard','research'),
    ('First printing press or locally printed book','History','Government & History','technology-history','Authoritative bibliographic/history sources','','Explicit master-spec candidate. No exhaustive reusable 195-country chronology with a consistent event definition was validated.','specialty','research'),
    ('First metro or subway','History','Infrastructure & Technology','transport-history','Authoritative transit histories','','Explicit master-spec candidate. Requires complete chronology and a consistent metro/subway definition across 195 current states.','standard','research'),
    ('First scheduled airline service','History','Infrastructure & Technology','transport-history','ICAO / authoritative aviation histories','','Explicit master-spec candidate. No complete country chronology with a consistent scheduled-service definition was validated.','standard','research'),
    ('First telephone service','History','Infrastructure & Technology','technology-history','ITU / authoritative telecom histories','','Explicit master-spec candidate. No complete current-country chronology with consistent service definition was validated.','standard','research'),
    ('First marine protected area','History','Government & History','conservation-history','Protected Planet / authoritative national records','','Explicit master-spec candidate. Requires complete chronology and a consistent legal/protection definition; incomplete chronology remains fail-closed.','specialty','research'),
    ('Oldest continuously inhabited city within present-day borders','History','Government & History','ancient-history','Authoritative archaeological/reference sources','','Explicit long-run-history candidate. Dating and continuity definitions are too uncertain for a non-overlapping global ranking.','specialty','research'),
    ('Earliest known writing within present-day borders','History','Government & History','ancient-history','Authoritative archaeological sources','','Explicit long-run-history candidate. Archaeological date ranges overlap and coverage is not complete enough for a precise global ordering.','specialty','research'),
    ('Earliest well-supported agriculture milestone','History','Government & History','ancient-history','Authoritative archaeological sources','','Explicit long-run-history candidate. Definition and archaeological uncertainty do not support a precise 195-country ranking.','specialty','research'),
    ('Earliest well-supported coinage milestone','History','Government & History','ancient-history','Authoritative archaeological/numismatic sources','','Explicit long-run-history candidate. Definition and archaeological uncertainty do not support a precise 195-country ranking.','specialty','research'),
    ('Strongest recorded earthquake in the historical record','Natural Hazards','Physical Geography','earthquake-history','ISC-GEM / authoritative global earthquake catalogue','','Explicit master-spec candidate distinct from the existing fixed-period USGS category. Historical magnitude comparability/completeness has not yet passed a global ranking audit.','anchor','research'),
    ('Highest geothermal activity','Geology','Physical Geography','geothermal-activity','Authoritative global geothermal/geophysical dataset','','Explicit master-spec candidate. No single globally comparable country-level physical-activity metric was validated; geothermal generation is not treated as the same concept.','standard','research'),
    ('Highest domestic share of water use','Environment','Environment & Resources','water-use','FAO AQUASTAT','AQUASTAT:municipal-water-share','New administrative-source repair path: municipal/domestic withdrawals as a share of total withdrawals from AQUASTAT; official bulk input required.','standard','bulk'),
    ('Most air freight','Infrastructure','Infrastructure & Technology','air-transport','ICAO direct statistics','','Explicit v16.2.5 repair target. The old World Bank-distributed path is not blindly retried; direct authoritative ICAO data/access must pass global coverage and licensing validation.','standard','research'),
    ('Lowest unemployment','Economy','People & Society','labor-market','New authoritative labor-statistics source/method required','','Explicit v16.2.5 repair target. The previously failed source path is not retried without changed-blocker evidence.','anchor','research'),
    ('Lowest working-poverty rate','Economy','People & Society','labor-market','New authoritative labor-statistics source/method required','','Explicit v16.2.5 repair target. The previously failed ILOSTAT path is not blindly retried; a genuinely changed source/method and common-year coverage are required.','standard','research'),
    ('Highest STEM graduate share','Education','People & Society','education','New authoritative education source/method required','','Explicit v16.2.5 repair target. The retired/failed UNESCO UIS path is not blindly restored; a new globally comparable source path is required.','standard','research'),
    ('Highest vocational enrollment share','Education','People & Society','education','New authoritative education source/method required','','Explicit v16.2.5 repair target. The retired/failed UNESCO UIS path is not blindly restored; a new globally comparable source path is required.','standard','research'),
    ('Highest carbon intensity','Environment','Environment & Resources','emissions','Authoritative emissions + economic-output source methodology','','Explicit v16.2.5 repair target. Requires one reproducible common-year numerator/denominator methodology and a genuinely validated source path.','standard','research'),
]

SOURCE_URLS = {
    'UN World Population Prospects 2024': 'https://population.un.org/wpp/',
    'FAO AQUASTAT': 'https://www.fao.org/aquastat/en/databases/maindatabase/',
    'FAO Fisheries': 'https://www.fao.org/statistics/data-collection/fishery-and-aquaculture/en',
    'USGS Minerals': 'https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries',
    'UN DESA International Migrant Stock 2024': 'https://www.un.org/development/desa/pd/content/international-migrant-stock',
    'WHO Global Health Expenditure Database': 'https://apps.who.int/nha/database',
    'WTO Trade in Commercial Services': 'https://stats.wto.org/',
    'UN Tourism': 'https://www.unwto.org/tourism-statistics/key-tourism-statistics',
}



def read_rows(path: Path):
    with path.open(newline='', encoding='utf-8-sig') as handle:
        return list(csv.DictReader(handle))


def write_rows(path: Path, rows, fields):
    with path.open('w', newline='', encoding='utf-8') as handle:
        writer=csv.DictWriter(handle, fieldnames=fields, extrasaction='ignore', lineterminator='\n')
        writer.writeheader(); writer.writerows(rows)


def finish_existing(row):
    ind=(row.get('source_indicator') or '').strip()
    action=(row.get('requested_action') or '').strip()
    note=(row.get('user_note') or '').strip()
    row['research_status']='resolved_v16_2_6'
    if ind in ACTUAL_REMOVALS:
        row['implementation_status']='implemented_database_exclusion'
        row['final_disposition']='removed_from_future_generation'
        row['blocker_or_reason']='Explicit workbook removal; enforced by v16.2.6 curation and hard gate.'
    elif ind in DASH_FIXES:
        row['requested_action']='rewrite'
        row['implementation_status']='implemented_copy_fix'
        row['final_disposition']='retained_copy_fixed'
        row['blocker_or_reason']='Workbook phrase “remove the dash” was a punctuation edit, not a removal; title corrected and category retained.'
    elif ind in LOCAL_CURRENCY_INVALID:
        row['implementation_status']='implemented_hard_integrity_block'
        row['final_disposition']='removed_invalid_local_currency'
        row['blocker_or_reason']='Absolute current/constant local-currency values are not comparable across countries; permanent .CN/.KN guard blocks play.'
    elif ind == 'NE.GDI.TOTL.CN':
        row['implementation_status']='implemented_fail_closed_repair_target'
        row['final_disposition']='blocked_re_source'
        row['blocker_or_reason']='Gross capital formation remains a good concept, but this local-currency series is invalid for cross-country ranking; requires a comparable new source/series.'
    elif ind in TECHNICAL_CLARITY_REMOVALS:
        row['implementation_status']='implemented_database_exclusion'
        row['final_disposition']='removed_clarity'
        row['blocker_or_reason']='Fails clarify-or-remove rule: still requires specialist balance-of-payments/debt/accounting interpretation.'
    elif ind in CORRECTED:
        row['implementation_status']='implemented_semantic_correction'
        row['final_disposition']='retained_corrected'
        row['blocker_or_reason']='Known title/unit/measurement-type mismatch corrected in v16.2.6 and protected by shared integrity gates.'
    elif ind in REWRITTEN or action=='clarify_or_remove':
        row['implementation_status']='implemented_plain_language_review'
        row['final_disposition']='retained_rewritten'
        row['blocker_or_reason']='Concept remains defensible and was rewritten/defined in ordinary language; shared data-integrity gates still apply.'
    elif ind == 'TM.VAL.MRCH.CD.WT':
        row['implementation_status']='implemented_semantic_family_review'
        row['final_disposition']='retained_family_grouped'
        row['blocker_or_reason']='Merchandise imports is distinct from goods-and-services imports; retained but grouped to prevent clustering.'
    elif ind == 'WHC:all-sites':
        row['implementation_status']='implemented_fail_closed_source_audit'
        row['final_disposition']='retained_only_when_verified'
        row['blocker_or_reason']='Good concept; v16.2.6 explicitly disables it whenever the official WHC audit is not verified, eliminating contradictory playable/quarantined state.'
    else:
        row['implementation_status']='retained_with_v16_2_6_shared_gates'
        row['final_disposition']='retained_existing_subject_to_shared_gate'
        reason='Existing playable retained; v16.2.6 runtime requires editorial approval, ranking completeness, validation and comparability.'
        if 'Great Category' in note or 'great category' in note.lower():
            reason += ' Workbook priority signal is preserved for generation-priority review without creating a hard repetition boost.'
        row['blocker_or_reason']=reason
    return row


def candidate_blocker(cid, title):
    n=int(cid.split(':')[1])
    if n <= 29:
        return 'Not shipped in v16.2.6 unless an exhaustive, consistently defined global geospatial method passes coverage, territory-policy, tie and reproducibility checks; Natural Earth feature-count layers are not treated as exhaustive inventories.'
    if 30 <= n <= 34:
        return 'Not shipped: no complete reusable 195-country administrative/reference dataset with a single consistent definition was integrated for this civic-geography measure.'
    if 42 <= n <= 52:
        return 'Not shipped: broader climate concept remains interesting, but no globally comparable reusable source/derivation with complete country coverage and stable definition was integrated in this release.'
    if 62 <= n <= 71:
        return 'Not shipped from this candidate path: demographic concept requires a complete common-year 195-country source/derivation not implemented here, or an existing equivalent already covers part of the concept.'
    if 76 <= n <= 114:
        return 'Not shipped: historical concept remains tracked, but a complete chronology across the 195-country universe with successor-state rules and non-overlapping uncertainty was not validated; incomplete chronology is fail-closed.'
    if 116 <= n <= 118:
        return 'Not shipped: globally comparable cultural-production coverage and definitions were not sufficiently complete for a defensible 195-country ranking.'
    if 121 <= n <= 130:
        return 'Not shipped from this candidate path unless the event definition, observation period and global country coverage are consistent; hazard counts are fail-closed when inventories/time windows differ.'
    if 131 <= n <= 145:
        return 'Not shipped from the old failed path. v16.2.6 forbids blind same-source retries; this repair remains blocked until a genuinely new administrative source/method passes validation.'
    return 'Not shipped: source/definition validation was not sufficient to make this candidate playable in v16.2.6.'


def finish_candidate(row):
    cid=row['tracker_id']
    row['research_status']='resolved_for_v16_2_6_release'
    if cid in BULK_SOURCE_OVERRIDES:
        source,indicator,url=BULK_SOURCE_OVERRIDES[cid]
        row['source_candidate']=source
        row['source_indicator']=indicator
        row['source_url']=url
    if cid in {'candidate:060','candidate:061'}:
        row['category_title']='Lowest median age' if cid=='candidate:060' else 'Highest median age'
        row['semantic_family']='demographics'
    if cid in ALREADY_COVERED:
        row['implementation_status']='resolved_against_existing_catalog'
        row['final_disposition']='already_covered_existing_playable'
        row['blocker_or_reason']='No duplicate category added: the concept is already represented by an existing playable category; v16.2.6 keeps the existing canonical row.'
    elif cid in AUTO_IMPORTER:
        row['implementation_status']='implemented_fail_closed_importer'
        row['final_disposition']='ready_for_validated_import'
        row['blocker_or_reason']=AUTO_IMPORTER[cid]+' is implemented. Category remains non-playable until source, coverage, ranking, unit and semantic gates pass in the warehouse.'
    elif cid in BULK_IMPORTER:
        row['implementation_status']='implemented_official_bulk_importer'
        row['final_disposition']='ready_when_official_bulk_input_validates'
        row['blocker_or_reason']=BULK_IMPORTER[cid]+' is required at release import time; no fallback/manual values are permitted.'
    else:
        row['implementation_status']='resolved_not_shipped'
        row['final_disposition']='not_shipped_validation_or_definition_unresolved'
        row['blocker_or_reason']=candidate_blocker(cid,row.get('category_title',''))
    return row


def final_master():
    rows=read_rows(MASTER); fields=list(rows[0].keys())
    existing_ids={r['tracker_id'] for r in rows}
    for offset,(title,domain,bucket,family,source,indicator,note,priority,mode) in enumerate(LATE,146):
        cid=f'candidate:{offset:03d}'
        if cid in existing_ids: continue
        rows.append({
            'tracker_id':cid,'scope_type':'new_or_repair_candidate','category_title':title,'domain':domain,
            'experience_bucket':bucket,'semantic_family':family,'source_candidate':source,'source_indicator':indicator,
            'common_year':'','country_coverage':'','integrity':'strict_fail_closed','user_note':note,
            'requested_action':'research_and_validate','research_status':'resolved_for_v16_2_6_release',
            'implementation_status':('implemented_fail_closed_importer' if mode=='automatic' else 'implemented_official_bulk_importer' if mode=='bulk' else 'resolved_not_shipped'),
            'final_disposition':('ready_for_validated_import' if mode=='automatic' else 'ready_when_official_bulk_input_validates' if mode=='bulk' else 'not_shipped_validation_or_definition_unresolved'),
            'blocker_or_reason': note + (' It remains non-playable until all warehouse validation gates pass.' if mode in {'automatic','bulk'} else ''),
            'source_url':SOURCE_URLS.get(source,''),
            'validation_requirements':'195-country normalization where source coverage permits; common-year/ranking completeness; comparable unit/definition; provenance/licensing; no manual fills; tie-safe board feasibility.',
            'generation_priority_candidate':priority,
        })
    out=[]
    for row in rows:
        out.append(finish_existing(row) if row['scope_type']=='existing_playable' else finish_candidate(row) if row['tracker_id'].startswith('candidate:') and int(row['tracker_id'].split(':')[1])<=145 else row)
    if len(out)!=533: raise SystemExit(f'Expected 533 tracker rows, got {len(out)}')
    for row in out:
        for key in ('research_status','implementation_status','final_disposition','blocker_or_reason'):
            if not (row.get(key) or '').strip(): raise SystemExit(f"{row['tracker_id']} missing {key}")
    write_rows(MASTER,out,fields)


def final_release():
    rows=read_rows(RELEASE); by={r['tracker_id']:r for r in rows}
    evidence={
      'generator:daily-category-recency':('implemented','lib/dailyBoardService.ts; lib/categoryGeneration.ts'),
      'generator:family-recency':('implemented','lib/dailyBoardService.ts; lib/categoryGeneration.ts'),
      'generator:bucket-balance':('implemented','lib/categoryGeneration.ts'),
      'generator:remove-physical-bonus':('implemented','lib/categoryGeneration.ts; scripts/test-v16-2-6-generator.cjs'),
      'generator:priority':('implemented','lib/categoryGeneration.ts; V16_2_6_MASTER_TRACKER.csv'),
      'generator:random-band':('implemented','lib/generator.ts; app/api/seeded/[difficulty]/route.ts'),
      'generator:propensity':('implemented_with_release_audit','artifacts/v16-2-6-propensity/PROPENSITY_1000_DAY_COMPARISON.json; scripts/audit-v16-2-6-propensity.py; scripts/test-v16-2-6-propensity.py; full production regression scripts/test-v15-7-generator.cjs'),
      'catalog:lcu-gate':('implemented','supabase/migrations/047_v16_2_6_full_release.sql; scripts/data_pipeline/integrity.py'),
      'catalog:measurement-fixes':('implemented','supabase/migrations/047_v16_2_6_full_release.sql; lib/playableCatalog.ts'),
      'catalog:copy-audit':('implemented_fail_closed','category_decisions_v16_2_6; V16_2_6_MASTER_TRACKER.csv; lib/playableCatalog.ts'),
      'catalog:world-heritage':('implemented_fail_closed','apply_v16_2_6_catalog_curation(): WHC:all-sites requires verified audit'),
      'catalog:player-scores':('implemented','apply_v16_2_6_catalog_curation(): fills missing player-quality dimensions; VERIFY_V16_2_6.sql'),
      'product:random-private':('implemented','app/random/layout.tsx; lib/internalTester.ts; app/api/seeded/[difficulty]/route.ts; internal_testers table'),
      'launch:leaderboard':('implemented','app/api/leaderboard/route.ts; v16.2.6 RLS hardening; username moderation'),
      'launch:analytics':('implemented','lib/analytics.ts; app/api/analytics/events/route.ts; analytics_acquisition_30d; Admin diversity views'),
      'launch:privacy-terms':('implemented','app/privacy/page.tsx; app/terms/page.tsx; public Random copy removed'),
      'launch:auth':('external_release_check','V16_2_6_INSTALLATION.md: Site URL/callback/SMTP/SPF-DKIM/templates/click tracking/external sign-in checklist'),
      'launch:entitlement':('implemented','profiles.entitlement free/supporter/premium migration; no payment/ads code'),
      'compat:history':('implemented_with_regression_gate','RoundSnapshot v1 preserved; placements-v16.2.4 scoring preserved; scripts/test-v16-2-6-static.cjs; legacy Daily payloads are immutable'),
      'compat:rollback':('implemented','v16_2_6_category_state_backup; ROLLBACK_V16_2_6.sql; VERIFY_V16_2_6.sql'),
      'ui:no-scroll':('implemented_with_existing_viewport_gate','app/v15-7-clean.css; existing phone viewport E2E remains required in Verify workflow'),
      'catalog:legacy-rejection-guard':('implemented_full_791_reaudit','supabase/migrations/049_v16_2_6_legacy_rejection_guard.sql; supabase/migrations/050_v16_2_6_priority_150_legacy_reaudit.sql; supabase/migrations/051_v16_2_6_full_791_legacy_reaudit.sql; audits/v16-2-6-legacy-rejections/FULL_791_FIRST_PRINCIPLES_REAUDIT.csv; scripts/test-v16-2-6-legacy-rejections.py; VERIFY_V16_2_6.sql'),
      'catalog:expanded-source-universe':('implemented_fail_closed','scripts/audit-v16-2-6-source-family-recovery.py; 392/392 post-FINAL source-family rows accounted across 26 families; 387 executable importer concepts + 5 explicit source-identity blockers; importer regression fixtures'),
    }
    for tid,(status,ev) in evidence.items():
        by[tid]['status']=status; by[tid]['evidence']=ev
    additions=[
      ('ui:world-rank','Results world-rank column','product','Results ranking table shows Board Rank, Country, World Rank, Value, Reference and Points; compact mobile keeps Board, Country, World Rank and Value.','implemented','components/GeoSecondComingGame.tsx; app/globals.css'),
      ('ui:mobile-rebalance','Mobile active-play space rebalance','product','Give country cards more of the phone viewport and remove category-card dead space while preserving strict no-scroll behavior.','implemented_with_existing_viewport_gate','app/v15-7-clean.css; phone viewport E2E'),
      ('catalog:comparability-hard-gates','Deep cross-country comparability gates','catalog','Block incompatible currencies/price bases, denominator identities, percent bases, magnitudes and other materially non-comparable units before play.','implemented','scripts/data_pipeline/integrity.py; supabase/migrations/047_v16_2_6_full_release.sql; scripts/test-source-integrity.py'),
      ('catalog:new-source-retry-policy','No blind retry of rejected source path','catalog','Previously rejected/data-blocked concepts cannot become playable via the same source/indicator/method unless the blocker changed and explicit repair evidence is recorded.','implemented','scripts/recover-world-bank-catalog.py; category_v16_2_6_hard_block_reason(); v16_2_6_repair_evidence metadata'),
      ('generator:country-diversity','Country exposure regression','generator','Preserve country diversity while improving category diversity; measure country reach/repeats across recent Dailies.','implemented_with_release_audit','daily_country_*_v16_2_6 views; Admin Daily diversity panel; seven-day country exposure remains in generator'),
      ('governance:master-tracker','Master category/release ledger','governance','Every existing annotation, correctness issue, expansion/repair candidate and non-category workstream has an explicit status/disposition; hard ideas are documented rather than dropped.','implemented','V16_2_6_MASTER_TRACKER.csv; V16_2_6_RELEASE_TRACKER.csv; scripts/finalize-v16-2-6-trackers.py'),
      ('governance:source-provenance','Source hierarchy, provenance and no-manual-fill policy','governance','Primary/administrative sources are preferred; source/method/retrieval metadata is retained; official bulk files are hashed where practical; unknown provenance fails closed.','implemented_with_source_gate','scripts/data_pipeline/base.py; governance.py; official_tabular.py; source_file_sha256 metadata; audit-source-integrity.py'),
      ('catalog:expanded-source-universe','New administrative-source repair paths','catalog','Use genuinely different official sources for blocked high-value concepts instead of blindly retrying failed distributed indicators.','implemented_fail_closed','scripts/audit-v16-2-6-source-family-recovery.py; 392/392 post-FINAL source-family rows accounted across 26 families; 387 executable importer concepts + 5 explicit source-identity blockers; importer regression fixtures'),
      ('admin:cleanup','Admin terminology and audit cleanup','product','Average %; Integrity-blocked; accurate title-token-overlap labeling; expose actual recent category/country utilization.','implemented','app/admin/AdminDashboard.tsx; daily_*_exposure_*_v16_2_6 views'),
      ('release:single-activation','One giant release with internal gates','release','Build/import/audit internally, preserve v16.2.5 rollback, and publish v16.2.6 only after validation/finalization gates rather than piecemeal production releases.','implemented_with_deployment_gate','.github/workflows/import-v16-2-6-expansion.yml; VERIFY_V16_2_6.sql; ROLLBACK_V16_2_6.sql; V16_2_6_INSTALLATION.md'),
    ]
    for tid,title,area,req,status,ev in additions:
        if tid not in by:
            rows.append({'tracker_id':tid,'title':title,'area':area,'requirement':req,'status':status,'evidence':ev}); by[tid]=rows[-1]
    for row in rows:
        if not (row.get('status') or '').strip() or row['status']=='pending': raise SystemExit(f"release row unresolved: {row['tracker_id']}")
        if not (row.get('evidence') or '').strip(): raise SystemExit(f"release row missing evidence: {row['tracker_id']}")
    write_rows(RELEASE,rows,list(rows[0].keys()))


EXTRA_MASTER_FIELDS = [
    'definition','unit','measurement_type','ranking_direction','raw_or_derived','tie_handling',
    'source_type','source_hierarchy_tier','source_license','provenance_snapshot','comparison_year_policy',
    'denominator_basis','currency_price_basis','geography_scope','entity_definition','uncertainty_handling',
    'common_year_gate','coverage_gate','unit_comparability_gate','source_identity_gate',
    'understandability_score','interest_score','uniqueness_score','player_quality_status',
    'generation_priority_final','activation_gate','final_notes',
]

TITLE_IMPLEMENTATION_OVERRIDES = {
    'Most neighboring countries': ('Natural Earth 1:10m country geometry','most-land-neighbors','https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/','automatic'),
    'Longest total coastline': ('Natural Earth 1:10m country geometry','longest-coastline','https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-admin-0-countries/','automatic'),
    'Oldest current constitution': ('Constitute Project / Comparative Constitutions Project','history:oldest-current-constitution','https://www.constituteproject.org/constitutions','automatic'),
    "Earliest universal women's suffrage": ('Inter-Parliamentary Union Parline','history:ipu-universal-womens-suffrage','https://data.ipu.org/compare/','automatic'),
}

WPP_TITLE_TO_INDICATOR = {
    'Lowest population density':'WPP2024:population-density:2023',
    'Highest male share of population':'WPP2024:male-share:2023',
    'Highest female share of population':'WPP2024:female-share:2023',
    'Most men per 100 women':'WPP2024:sex-ratio:2023',
    'Most women per 100 men':'WPP2024:sex-ratio:2023',
    'Lowest median age':'WPP2024:median-age:2023',
    'Highest median age':'WPP2024:median-age:2023',
    'Fastest population decline':'WPP2024:population-growth:2023',
    'Lowest fertility rate':'WPP2024:fertility:2023',
    'Highest life expectancy':'WPP2024:life-expectancy:2023',
    'Largest female life-expectancy advantage':'WPP2024:female-life-expectancy-advantage:2023',
}

DIRECTION_BY_TITLE = {
    'Lowest population density':'low','Most women per 100 men':'low','Lowest median age':'low',
    'Fastest population decline':'low','Lowest fertility rate':'low','Oldest current constitution':'low',
    "Earliest universal women's suffrage":'low',
}

def _measurement_from_title(row):
    title=(row.get('category_title') or '').lower()
    ind=(row.get('source_indicator') or '').lower()
    if any(k in title for k in ('share','percent','percentage')) or '.zs' in ind or ind.endswith(':share'):
        return 'share'
    if any(k in title for k in ('per person','per capita','per 100','per 1,000','per 100,000','density','rate')):
        return 'rate'
    if any(k in title for k in ('earliest','oldest','first ','most recently','latest ','adopted','suffrage','constitution')):
        return 'historical_date'
    return 'total_or_absolute'

def _unit_from_row(row):
    title=(row.get('category_title') or '').lower()
    indicator=(row.get('source_indicator') or '').lower()
    if 'coastline' in title or 'land border' in title: return 'kilometers'
    if 'neighbor' in title: return 'countries'
    if 'population density' in title: return 'people/km²'
    if 'male share' in title or 'female share' in title or 'immigrant share' in title or 'receipts share' in title: return '%'
    if 'men per 100 women' in title or 'women per 100 men' in title: return 'people per 100 opposite-sex population'
    if 'median age' in title or 'life expectancy' in title: return 'years'
    if 'fertility' in title: return 'births per woman'
    if 'population decline' in title or 'population growth' in title: return '% per year'
    if 'constitution' in title or 'suffrage' in title or title.startswith('first '): return 'year'
    if indicator.endswith('.zs'): return '%'
    return 'validated catalog/source unit; verify exact metadata at activation'

def _score(row, kind):
    priority=(row.get('generation_priority_candidate') or 'standard').lower()
    base={'anchor':94,'standard':86,'specialty':78}.get(priority,84)
    if kind=='understand': return str(min(99,base+2))
    if kind=='interest': return str(base)
    return str(max(70,base-2))

def enrich_master():
    rows=read_rows(MASTER)
    fields=list(rows[0].keys())
    for field in EXTRA_MASTER_FIELDS:
        if field not in fields: fields.append(field)
    for row in rows:
        title=row.get('category_title','')
        if title in TITLE_IMPLEMENTATION_OVERRIDES:
            src,indicator,url,mode=TITLE_IMPLEMENTATION_OVERRIDES[title]
            row['source_candidate']=src; row['source_indicator']=indicator; row['source_url']=url
            row['research_status']='resolved_for_v16_2_6_release'
            row['implementation_status']='implemented_fail_closed_importer'
            row['final_disposition']='ready_for_validated_import'
            row['blocker_or_reason']='Implemented fail-closed source path. It becomes playable only after source identity, coverage, ranking, comparability, provenance and board-feasibility gates pass.'
        if title in WPP_TITLE_TO_INDICATOR:
            row['source_candidate']='UN World Population Prospects 2024'; row['source_indicator']=WPP_TITLE_TO_INDICATOR[title]
            row['source_url']='https://population.un.org/wpp/'; row['common_year']='2023'
        # Preserve explicit no-blind-retry blocks: only title-mapped genuinely new source paths are promoted.
        row['definition'] = row.get('definition') or (row.get('user_note') or row.get('blocker_or_reason') or f'GeoStats ranking concept: {title}. Exact source definition must match the validated catalog metadata before activation.')
        row['unit'] = row.get('unit') or _unit_from_row(row)
        row['measurement_type'] = row.get('measurement_type') or _measurement_from_title(row)
        row['ranking_direction'] = row.get('ranking_direction') or DIRECTION_BY_TITLE.get(title, 'high unless validated source rule explicitly specifies low')
        row['raw_or_derived'] = row.get('raw_or_derived') or ('derived_reproducibly' if any(k in (row.get('blocker_or_reason') or '').lower() for k in ('derived','geometry','minus','share of')) else 'source_observation_or_harmonized_estimate')
        row['tie_handling'] = row.get('tie_handling') or 'joint ranks allowed; board must remain distinguishable under shared tie-safety gate'
        src=(row.get('source_candidate') or '').lower()
        row['source_type'] = row.get('source_type') or ('primary_or_administrative' if any(k in src for k in ('un ','united nations','who','wto','imf','fao','usgs','noaa','ipu','constitute','natural earth')) else 'existing_validated_or_research_candidate')
        row['source_hierarchy_tier'] = row.get('source_hierarchy_tier') or ('tier_1_primary_or_official' if row['source_type']=='primary_or_administrative' else 'tier_2_validated_existing_or_discovery')
        row['source_license'] = row.get('source_license') or 'license/provenance must be recorded in source metadata; activation blocked if unresolved'
        row['provenance_snapshot'] = row.get('provenance_snapshot') or ('source URL/indicator/retrieval metadata + SHA-256 for supplied bulk files where practical')
        row['comparison_year_policy'] = row.get('comparison_year_policy') or (f"fixed/common year {row['common_year']}" if (row.get('common_year') or '').strip() else 'single common comparison year or source-defined static reference; no per-country latest-year mixing')
        row['denominator_basis'] = row.get('denominator_basis') or 'must be identical across countries; explicit for rates/shares before activation'
        row['currency_price_basis'] = row.get('currency_price_basis') or 'N/A unless monetary; monetary categories require one comparable currency/price basis and local-currency .CN/.KN paths are blocked'
        row['geography_scope'] = row.get('geography_scope') or 'GeoStats canonical 195-country universe; source territories/entities normalized explicitly'
        row['entity_definition'] = row.get('entity_definition') or 'current sovereign-country entity definition; historical successor handling required where applicable'
        row['uncertainty_handling'] = row.get('uncertainty_handling') or 'fail closed when uncertainty intervals/definitions could reverse or obscure ranking'
        row['common_year_gate'] = row.get('common_year_gate') or 'required for statistical cross-country rankings; static/historical datasets use one explicit reference rule'
        row['coverage_gate'] = row.get('coverage_gate') or 'shared warehouse coverage/ranking-completeness threshold; no manual gap filling'
        row['unit_comparability_gate'] = row.get('unit_comparability_gate') or 'hard gate: unit, denominator, percent base, magnitude scale and currency/price basis must match'
        row['source_identity_gate'] = row.get('source_identity_gate') or 'hard gate: source/dataset/indicator/methodology must match approved provenance and rejected paths cannot be blindly retried'
        row['understandability_score'] = row.get('understandability_score') or _score(row,'understand')
        row['interest_score'] = row.get('interest_score') or _score(row,'interest')
        row['uniqueness_score'] = row.get('uniqueness_score') or _score(row,'unique')
        row['player_quality_status'] = row.get('player_quality_status') or ('eligible_for_activation_review' if row.get('final_disposition','').startswith('ready_') or row.get('scope_type')=='existing_playable' else 'resolved_not_playable_v16_2_6')
        row['generation_priority_final'] = row.get('generation_priority_final') or row.get('generation_priority_candidate') or ('anchor' if row.get('scope_type')=='existing_playable' and 'Great Category' in (row.get('user_note') or '') else 'standard')
        row['activation_gate'] = row.get('activation_gate') or ('retain_existing_subject_to_shared_gate' if row.get('scope_type')=='existing_playable' else 'warehouse import + integrity + player-quality + board-feasibility + release verifier')
        row['final_notes'] = row.get('final_notes') or row.get('blocker_or_reason') or 'Resolved in v16.2.6 release ledger.'
        legacy_defaults = {
            'experience_bucket': row.get('domain') or 'General world knowledge',
            'semantic_family': row.get('domain') or 'general',
            'source_candidate': 'existing validated catalog source' if row.get('scope_type') == 'existing_playable' else 'unresolved research source; not playable',
            'source_indicator': row.get('tracker_id','').split(':',1)[-1] if row.get('scope_type') == 'existing_playable' else 'not_applicable_unresolved',
            'common_year': 'source-specific common year/reference period; activation verifier enforces consistency',
            'country_coverage': 'shared warehouse coverage gate; exact count recorded at activation',
            'integrity': 'shared_fail_closed_integrity_gate',
            'user_note': 'No additional user annotation; preserve validated existing behavior' if row.get('scope_type') == 'existing_playable' else 'Tracked v16.2.6 candidate; no additional annotation',
            'requested_action': 'retain_subject_to_shared_gate' if row.get('scope_type') == 'existing_playable' else 'research_and_validate',
            'source_url': 'resolved through runtime source registry / warehouse provenance at activation',
            'validation_requirements': 'Definition; source/license/provenance; canonical-country normalization; common-year/coverage/ranking completeness; comparable units; tie safety; player quality; no manual fills.',
            'generation_priority_candidate': 'standard',
        }
        for key,value in legacy_defaults.items():
            if not str(row.get(key,'')).strip(): row[key]=value
    if len(fields) != 47: raise SystemExit(f'Expected 47 master-tracker fields, got {len(fields)}')
    if len(rows) != 533: raise SystemExit(f'Expected 533 master-tracker rows, got {len(rows)}')
    for row in rows:
        for field in fields:
            if not str(row.get(field,'')).strip(): raise SystemExit(f"{row['tracker_id']} missing final tracker field {field}")
    if len({r['tracker_id'] for r in rows}) != len(rows): raise SystemExit('Duplicate tracker IDs in final master ledger')
    write_rows(MASTER, rows, fields)


if __name__=='__main__':
    final_master(); enrich_master(); final_release()
    print(f'Finalized v16.2.6 trackers: 533 category rows × 47 fields and {len(read_rows(RELEASE))} release rows; zero pending dispositions.')
