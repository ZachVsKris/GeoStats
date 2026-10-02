#!/usr/bin/env python3
"""Editorial candidate register. Separate questions, evidence leads and approval."""
import collections
import csv
import hashlib
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'data/animalstats/research'
SOURCES = {
 'catalogs': ('Existing comparative trait catalogs', 'data/animalstats/research/trait-screen-summary.json', 'Mixed worldwide animal groups; per-field coverage required', 'downloaded'),
 'locomotion': ('Cloyed & Dell locomotion database', 'https://doi.org/10.1002/ecy.3114', '884 organisms; exclude non-animals; locomotion modes kept separate', 'source_located_download_blocked'),
 'travel': ('Dyer et al. travel speeds', 'https://doi.org/10.5281/zenodo.7554842', 'Eight animal groups; different sampling protocols and some unidentified taxa', 'downloaded'),
 'jump': ('Comparative jumping performance', 'https://academic.oup.com/icb/article/59/6/1609/5545545', 'Comparative jump paper mixes calculated heights and reported measurements; primary endpoints need verification', 'source_located'),
 'jump-direct': ('Direct gerbil jumping experiment', 'https://doi.org/10.5061/dryad.hdr7sqvqd', 'Gerbils only; not enough for broad mixed-animal boards', 'source_located'),
 'diving': ('Universal constraints on diving', 'https://doi.org/10.5061/dryad.tqjq2bvv9', 'Insects, amphibians, reptiles, birds and mammals; literature with study context', 'downloaded'),
 'bird-diving': ('Diving parameters of 53 bird species', 'https://doi.org/10.5061/dryad.z612jm6rq', 'Birds only; global literature, measured logger and stopwatch protocols', 'source_located'),
 'movement': ('Movebank public data repository', 'https://www.movebank.mpg.de/cms/movebank-content/data-repository', 'Multiple groups and continents; public studies only; unequal deployment durations', 'source_located'),
 'bite': ('Insect bite force database', 'https://doi.org/10.1038/s41597-023-02731-w', '654 insect species, 13 orders, four continents; independent specimen gates', 'downloaded'),
 'bite-vertebrate': ('Empirical voluntary bite performance methods', 'https://doi.org/10.1242/jeb.106385', 'Vertebrate literature; gape, biting point and substrate matter', 'source_located'),
 'pull': ('Instrumented passalus beetle pulling experiment', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4011365/', 'One beetle species; method lead, not a cross-species table', 'limited_study'),
 'hearing': ('Animal Audiograms', 'https://www.animalaudiograms.org/apidoc', 'Multiple animal groups; air/water, age, method, threshold and frequency required', 'source_located_api_unavailable'),
 'vision': ('Comparative visual acuity review', 'https://doi.org/10.1016/j.tree.2018.03.001', 'Hundreds of animals; anatomical estimates and behavioral tests mixed', 'source_located'),
 'smell': ('Mammalian odor detection and discrimination', 'https://doi.org/10.5061/dryad.73n5tb33v', '20 mammal species; individual odors and identical discrimination tasks', 'downloaded'),
 'sound': ('Calibrated song amplitude measurements', 'https://doi.org/10.5061/dryad.cnp5hqchb', '17 European songbird species; context and corrected distance recorded', 'source_located'),
 'sound-review': ('Cross-taxon sound pressure review', 'https://doi.org/10.3389/fevo.2021.657254', 'Air and underwater measurements; different reference pressures', 'source_located'),
 'diet': ('CarniDIET', 'https://doi.org/10.5061/dryad.2v6wwpzmr', '103 terrestrial carnivorous mammals; study/site/time and diet methods retained', 'downloaded'),
 'food-types': ('Observed mammalian food types', 'https://doi.org/10.5061/dryad.83bk3j9vk', '1437 terrestrial mammals; four explicit food classes, not prey-species counts', 'downloaded'),
 'hostplants': ('LepTraits', 'https://github.com/RiesLabGU/LepTraits/tree/f73317d28b38f80923ad8e02cc06d35f5c16ed1f', 'Butterflies and moths; hostplant discovery and study effort bias', 'downloaded'),
 'food-intake': ('Measured captive moose intake', 'https://doi.org/10.5061/dryad.857dd', 'One mammal species; daily food measurements; no cross-species database yet', 'limited_study'),
 'fasting': ('Food/water restriction physiology', 'https://doi.org/10.1086/504614', 'Sand gazelles only; imposed restriction is not maximum endurance', 'limited_study'),
 'thermal': ('GlobTherm', 'https://doi.org/10.1038/sdata.2018.22', 'Multiple groups; remove non-animals; critical vs lethal endpoints separate', 'downloaded'),
 'social': ('PanTHERIA and COMBINE reported traits', 'data/animalstats/research/gap-source-manifest.json', 'Mammals worldwide; reported fields may still contain underlying estimates', 'downloaded'),
 'nests': ('Nest traits for the world’s birds', 'https://doi.org/10.1111/geb.13783', 'Birds globally; numerical building time and dimensions alongside nominal types', 'source_located_download_blocked'),
 'burrows': ('Direct vole burrow measurements', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10744952/', 'One vole species; local surveyed burrows, not mammal-wide records', 'limited_study'),
 'population': ('Living Planet Database', 'https://www.livingplanetindex.org/data_portal', 'Monitored vertebrate populations; local counts, densities and abundance proxies mixed', 'source_located'),
 'iucn': ('IUCN Red List assessments', 'https://www.iucnredlist.org/', 'Global assessed animals; date, population intervals and DD/NE must be retained', 'source_located'),
 'horns': ('Comparative bovid horn measurements', 'https://doi.org/10.5061/dryad.fxpnvx16w', '115 bovids, 80 female horned; sex-specific published maxima', 'source_located'),
 'antlers': ('Comparative cervid antler size', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3982432/', '31 male cervid species lengths; 20 antler weights; seasonal development', 'source_located'),
 'anatomy': ('Mammalian Species accounts', 'https://academic.oup.com/mspecies/article/50/959/34/5075367', 'Species accounts; illustrative gaur account includes ears and horns; broader audit needed', 'limited_study'),
 'sleep': ('Phylogeny of Sleep database', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2576738/', 'Mammals; recording duration, EEG vs behavior, captivity and feeding documented', 'source_located'),
 'torpor': ('Daily torpor and hibernation', 'https://doi.org/10.1111/brv.12137', '214 bird/mammal species; numerical table downloaded; duration, temperature and metabolism endpoints', 'downloaded'),
 'torpor-phenotypes': ('Hibernation phenotype matrix', 'https://figshare.com/articles/dataset/Hibernation_phenotypes_supportingdata/23310731', 'Birds/mammals; MaxTorporLength is a category, not hours', 'downloaded_context_only'),
 'development': ('Comparative complex life cycles', 'https://doi.org/10.5061/dryad.vx0k6djrp', 'Multiple larval-stage animals including crustaceans and insects', 'source_located'),
 'growth': ('Comparative animal growth', 'https://doi.org/10.5061/dryad.7187d', 'Comparative growth data; fitted growth coefficients are not raw growth rates', 'source_located'),
 'care': ('Mammalian paternal care', 'https://doi.org/10.5061/dryad.5d4fh', 'Care type/presence is categorical; does not support longest-care duration', 'source_located_context_only'),
 'healing': ('Comparative wound healing', 'https://doi.org/10.5061/dryad.6hdr7srbs', 'Primates and rodents; different injuries, uncertain ordering among nonhuman species', 'source_located'),
 'regrowth': ('Lizard tail regrowth', 'https://doi.org/10.5061/dryad.f7m0cfxv9', 'Five wall lizard species; narrow specialist comparison only', 'source_located'),
 'regeneration': ('Comparative regeneration literature', 'https://doi.org/10.1146/annurev.cellbio.24.110707.175336', 'Qualitative capabilities; no common whole-animal regeneration score', 'source_located_context_only'),
 'seasonal': ('Direct seasonal mammal body composition', 'https://doi.org/10.1007/s00360-022-01466-1', 'Alpine marmots; one species; body mass variation is not fat percentage', 'limited_study'),
 'cognition': ('MacLean shared self-control tasks', 'https://figshare.com/articles/dataset/MacLean_et_al_PNAS_2014_Self_Control_Data/5579335', 'Birds/mammals; shared A-not-B and cylinder tests; no general IQ ranking', 'downloaded'),
 'fossils': ('Paleobiology Database API', 'https://doi.org/10.1017/PAB.2015.39', 'Global fossil taxa; species/genus/clade ranks and geological intervals separate', 'source_located'),
 'description': ('Catalogue of Life', 'https://www.catalogueoflife.org/howto/access', 'Global taxa; authorship year can refer to a later combination; verify original description', 'source_located'),
 'domestication': ('Ancient DNA and domestication evidence', 'https://doi.org/10.1146/annurev-animal-022516-022747', 'Domestic lineages; archaeological bounds and competing origins retained', 'source_located'),
 'translocation': ('IUCN conservation translocation case studies', 'https://www.iucn-ctsg.org/resources/ctsg-books/', 'Selected global case studies; national reintroduction is not global species rediscovery', 'source_located'),
}

# Each line is a distinct endpoint, not two categories for min/max or per-clade copies.
# bucket|id|high label|low label|interest|source keys|measurement/evidence gate
SPEC = '''
Size|mass|Heaviest|Lightest|intuitive|catalogs|Adult mass; sex, mean vs maximum and wild/captive consistent
Size|length|Longest|Shortest|intuitive|catalogs|Same anatomical endpoints; no snout-vent to total length substitution
Size|height|Tallest|Shortest in height|intuitive|catalogs|True overall standing height; no shoulder height relabeling
Size|wingspan|Widest wingspan|Narrowest wingspan|intuitive|catalogs,hostplants|Fully extended tip-to-tip span; wing length is not wingspan
Size|tail-length|Longest tail|Shortest tail|intuitive|catalogs|Same sex and adult life stage; unknown is not zero
Size|newborn-mass|Heaviest newborn|Lightest newborn|intuitive|catalogs|Mass at birth; hatchling mass separate if endpoint differs
Size|egg-mass|Heaviest egg|Lightest egg|intuitive|catalogs|Fresh egg mass, not clutch mass
Size|egg-length|Longest egg|Shortest egg|specialist|catalogs|Egg long-axis length; avoid duplicating egg size as many near-identical prizes
Movement|maximum-speed|Fastest|Slowest|intuitive|locomotion|Measured maximum speed; running, swimming, level flight and diving context explicit
Movement|travel-speed|Fastest traveler|Slowest traveler|intuitive|travel|Sustained measured travel speed; mean and median kept distinct
Movement|acceleration|Fastest acceleration|Slowest acceleration|intuitive|locomotion|Observed acceleration with compatible time scale, not speed proxy
Movement|jump-height|Highest jump|Lowest jump|intuitive|jump,jump-direct|Measured vertical displacement; ballistic prediction alone held
Movement|jump-distance|Longest jump|Shortest jump|intuitive|jump-direct|Measured horizontal distance; context and voluntary maximum recorded
Movement|relative-jump|Longest jump for body size|Shortest jump for body size|specialist|jump-direct|Measured displacement divided by measured same-individual body length
Movement|migration-distance|Longest migration|Shortest migration|intuitive|movement|One defined seasonal journey, track coverage complete; residents not assigned zero
Movement|nonstop-journey|Longest nonstop journey|Shortest nonstop journey|intuitive|movement|Continuous tracked journey; define allowable stops and sampling interval
Movement|daily-distance|Most distance in a day|Least distance in a day|intuitive|movement|Complete 24-hour tracks at comparable resolution; not displacement between two fixes
Movement|lifetime-distance|Most lifetime travel|Least lifetime travel|intuitive||Need complete lifetime tracking; daily distance multiplied by lifespan rejected
Movement|flight-altitude|Highest flight|Lowest flight|intuitive|movement|Measured flight altitude; above sea level and ground kept separate
Movement|turn-radius|Tightest turn|Widest turn|specialist|locomotion|Powered minimum turn radius; same speed context; prevent agility relabeling
Movement|turn-speed|Fastest turn|Slowest turn|specialist|locomotion|Measured angular speed; not a general agility score
Diving|dive-depth|Deepest dive|Shallowest dive|intuitive|bird-diving,movement|Observed maximum dive depth; habitat depth is a different trait
Diving|dive-duration|Longest dive|Shortest dive|intuitive|diving|Reported observed maximum; do not call oxygen limitation or generic breath-hold
Diving|breath-hold|Longest breath hold|Shortest breath hold|intuitive||Respiration measured directly; diving duration and cutaneous respiration not equivalent
Strength|bite-force|Strongest bite|Weakest bite|intuitive|bite,bite-vertebrate|Measured force in newtons; voluntary bite point, gape and substrate compatible
Strength|relative-bite|Strongest bite for body weight|Weakest bite for body weight|specialist|bite|Force/body weight from same measured specimens; no allometric residuals
Strength|pull-force|Strongest pull|Weakest pull|intuitive|pull|Instrumented pulling test; clinging, pushing and lifting are separate
Strength|relative-pull|Strongest pull for body weight|Weakest pull for body weight|specialist|pull|Direct measured pulling force divided by same specimen weight
Strength|carrying-load|Heaviest load carried|Lightest load carried|intuitive||Compatible carried-load task; anecdotal carrying claims not approved
Strength|lifting-load|Heaviest lift|Lightest lift|intuitive||Direct lifted load; reject muscle mass as strength proxy
Senses|visual-acuity|Sharpest vision|Least sharp vision|intuitive|vision|Shared acuity protocol and cycles/degree; estimated retinal acuity separate
Senses|highest-audible-frequency|Hears highest pitch|Lowest upper hearing limit|specialist|hearing|Same SPL criterion and medium; highest tested frequency not assumed true limit
Senses|lowest-audible-frequency|Hears lowest pitch|Highest lower hearing limit|specialist|hearing|Measured boundary at same SPL; no extrapolation beyond audiogram
Senses|hearing-threshold|Hears quietest sound|Needs loudest sound to hear|specialist|hearing|Threshold at shared frequency, same air/water reference and test method
Senses|odor-detection|Detects faintest smell|Needs strongest smell|specialist|smell|Same odor compound and units; no universal best-smell claim
Senses|odor-discrimination|Best at telling smells apart|Worst at telling smells apart|specialist|smell|Identical odor-pair task, protocol and success endpoint
Sound|call-loudness|Loudest call|Quietest call|intuitive|sound,sound-review|Calibrated source level at stated distance; air/water and weighting separated
Sound|call-pitch|Highest-pitched call|Lowest-pitched call|intuitive|sound-review|Same fundamental/peak-frequency endpoint; harmonics not mixed
Feeding|food-class-breadth|Most varied food types|Fewest food types|intuitive|food-types,catalogs|Fixed documented food-class scheme; not number of prey species
Feeding|prey-species-breadth|Most prey species|Fewest prey species|intuitive|diet|Matched study effort and taxonomic resolution; unknown prey not separate species
Feeding|hostplant-breadth|Most food plants|Fewest food plants|intuitive|hostplants|Observed unique hostplant species; study coverage and larval life stage explicit
Feeding|daily-food-mass|Eats most per day|Eats least per day|intuitive|food-intake|Direct daily mass consumed; wet/dry, age, activity and captivity standardized
Feeding|relative-food-intake|Eats most for body weight|Eats least for body weight|specialist|food-intake|Daily measured intake divided by same-specimen mass; no metabolic-model conversion
Feeding|fasting-duration|Longest without food|Shortest without food|intuitive|fasting|Observed natural fasting duration; restriction study length is not maximum survival
Feeding|feeding-time|Most time eating|Least time eating|intuitive||Shared complete-day behavioral sampling; no categorical diet score conversion
Survival|water-independence|Longest without drinking|Shortest without drinking|intuitive|fasting|Measured interval and diet water explicit; restriction not maximum capacity
Survival|heat-tolerance|Tolerates highest temperature|Lowest upper temperature limit|intuitive|thermal|Same critical/lethal endpoint and acclimation/ramp protocol
Survival|cold-tolerance|Tolerates lowest temperature|Highest lower temperature limit|intuitive|thermal|Same endpoint; body temperature minima not environmental tolerance
Social life|social-group-size|Largest social group|Smallest social group|intuitive|social|Stable observed group size; aggregation, family and feeding flock kept distinct
Social life|colony-size|Largest colony|Smallest colony|intuitive||Measured natural colony population; workers vs all members explicit; mature stage
Social life|solitary-time|Most time alone|Least time alone|intuitive||Numerical observation time; solitary/social binary not continuous solitude ranking
Construction|nest-width|Widest nest|Narrowest nest|intuitive|nests|Same external axis and individual nest vs communal colony structure
Construction|nest-mass|Heaviest nest|Lightest nest|intuitive||Actual nest mass; no volume-density conversion
Construction|building-time|Longest to build a nest|Quickest to build a nest|intuitive|nests|Completed construction days; shared vs individual labor recorded
Construction|nest-height|Highest nest above ground|Lowest nest above ground|intuitive|nests|Observed placement height; not physical nest height
Construction|burrow-length|Longest burrow|Shortest burrow|intuitive|burrows|Measured complete tunnel system; occupied shared system vs individual explicit
Construction|burrow-depth|Deepest burrow|Shallowest burrow|intuitive|burrows|Maximum depth from surface with surveyed extent known
Construction|mound-height|Tallest mound|Shortest mound|intuitive||Measured built structure; species attribution and colony age required
Construction|dam-length|Longest dam|Shortest dam|intuitive||Mapped dam length; limited species diversity, likely hold
Population|global-abundance|Most animals worldwide|Fewest animals worldwide|intuitive|iucn|Comparable dated global counts; preserve intervals, wild/domestic and life stage
Population|local-density|Most crowded population|Least crowded population|specialist|social,population|Observed local individuals per area; not global abundance or modeled density
Population|population-change|Biggest population increase|Biggest population decline|intuitive|population|Same fixed period, same local count endpoint and complete series; no mixed proxies
Conservation|threat-category|Most endangered|Least endangered|intuitive|iucn|Ordered threat categories with ties; DD/NE not least threatened
Conservation|range-loss|Most range lost|Least range lost|intuitive|iucn|Comparable historical/current maps and baseline dates; occurrence gaps not absence
Anatomy|tooth-count|Most teeth|Fewest teeth|intuitive||Adult functional tooth count; replacement teeth and sexes separated
Anatomy|leg-count|Most legs|Fewest legs|intuitive||Adult anatomical definition; normal development, many ties; fins not legs
Anatomy|ear-length|Longest ears|Shortest ears|intuitive|anatomy|Same anatomical axis, sex and adult age; internal ear not comparable
Anatomy|horn-length|Longest horns|Shortest horns|intuitive|horns|Sex-specific same curve measurement; hornless zero only documented explicitly
Anatomy|antler-length|Longest antlers|Shortest antlers|intuitive|antlers|Mature antlers same sex/season and measurement; horns not antlers
Anatomy|eye-diameter|Largest eyes|Smallest eyes|intuitive||Measured whole-eye diameter; cornea length and compound eye span separate
Anatomy|fur-length|Longest fur|Shortest fur|intuitive||Same hair type and body location; seasonal coat recorded
Anatomy|body-fat|Most body fat|Least body fat|intuitive|seasonal|Direct comparable body-composition measurement; mass variation not fat proxy
Anatomy|brain-mass|Heaviest brain|Lightest brain|specialist|catalogs|Measured wet brain mass; never an intelligence ranking
Anatomy|beak-length|Longest beak|Shortest beak|specialist|catalogs|Shared culmen measurement; full bill length and culmen not automatically equivalent
Routines|sleep-duration|Sleeps most|Sleeps least|intuitive|sleep|Measured sleep over comparable full-day recordings; captivity and detection method explicit
Routines|sleep-bout|Longest sleep stretch|Shortest sleep stretch|intuitive|sleep|Same wake-interruption definition; longest vs average bout separated
Routines|torpor-duration|Longest torpor spell|Shortest torpor spell|specialist|torpor|Actual bout hours/days; phenotype labels excluded; torpor is not sleep
Routines|hibernation-season|Longest hibernation season|Shortest hibernation season|intuitive||Observed seasonal start/end, including arousals; not single torpor bout length
Routines|daytime-activity|Most active in daytime|Least active in daytime|intuitive||Measured fraction of comparable full-day activity; nocturnal/diurnal codes insufficient
Development|lifespan|Longest lived|Shortest lived|intuitive|catalogs|Observed records separated from typical life expectancy; wild/captive consistency
Development|maturity-age|Latest adulthood|Earliest adulthood|intuitive|catalogs|Sexual maturity measured; not full adult body size
Development|growth-rate|Fastest growth|Slowest growth|intuitive|growth|Direct comparable mass/time stage; fitted coefficients not raw growth
Development|relative-growth|Most growth from birth|Least growth from birth|intuitive|catalogs|Measured birth/adult mass ratio with compatible sex/context; ratio not daily growth
Development|larval-duration|Longest larval stage|Shortest larval stage|specialist|development|Observed duration under same temperature; stage identity and natural/captive explicit
Development|metamorphosis-duration|Longest transformation|Quickest transformation|intuitive|development|Defined transition start/end; total childhood is separate
Parenting|pregnancy-duration|Longest pregnancy|Shortest pregnancy|intuitive|catalogs|Same conception-to-birth endpoint; delayed implantation kept explicit
Parenting|incubation-duration|Slowest eggs to hatch|Quickest eggs to hatch|intuitive|catalogs|Same incubation onset definition and environmental temperature
Parenting|offspring-count|Most babies at once|Fewest babies at once|intuitive|catalogs|Clutch/litter per event; annual fecundity not brood size
Parenting|milk-duration|Longest nursing|Shortest nursing|intuitive|catalogs|Age at complete weaning; nursing frequency not duration
Parenting|care-duration|Longest parental care|Shortest parental care|intuitive|care|Actual duration to independence; paternal-care presence does not measure time
Parenting|reproduction-frequency|Most litters per year|Fewest litters per year|intuitive|catalogs|Observed annual frequency; theoretical capacity not normal production
Healing|wound-closure|Fastest wound healing|Slowest wound healing|specialist|healing|Same injury/site/size and treatment; uncertainty must permit a defensible order
Healing|tail-regrowth|Fastest tail regrowth|Slowest tail regrowth|specialist|regrowth|Measured elongation at compatible injury, temperature and age; narrow lizard coverage
Healing|regeneration-time|Quickest limb regrowth|Slowest limb regrowth|intuitive|regeneration|Same appendage and completion endpoint; capability binary not a speed
Seasons|seasonal-weight-change|Biggest seasonal weight change|Smallest seasonal weight change|intuitive|seasonal|Repeated direct same-individual mass; one species source insufficient
Seasons|breeding-season|Longest breeding season|Shortest breeding season|intuitive||Defined local population season, same hemisphere protocol; global span not local duration
Geography|range-area|Largest range|Smallest range|intuitive|catalogs,iucn|Same mapped native range definition; EOO and occupied area separate
Geography|country-count|Most native countries|Fewest native countries|intuitive|iucn|Explicit native country list; vagrants, introduced and disputed territory policy
Geography|continent-count|Most native continents|Fewest native continents|intuitive|iucn|Fixed continent convention and native presence; ties expected
Geography|maximum-elevation|Lives highest up|Lowest upper elevation|specialist|catalogs,iucn|Observed habitat upper limit; aircraft/flight records excluded
Geography|habitat-depth|Lives deepest|Shallowest lower habitat limit|specialist|catalogs|Recorded habitat range; no dive-performance relabeling
Geography|home-range|Largest home territory|Smallest home territory|intuitive|social|Observed home-range area with shared estimator/context; not species geographic range
Cognition|cylinder-task|Best at the cylinder puzzle|Worst at the cylinder puzzle|specialist|cognition|Same trials and apparatus; percent correct only; no IQ or smartest claim
Cognition|a-not-b-task|Best at the hidden-food test|Worst at the hidden-food test|specialist|cognition|Same A-not-B protocol; uncertainty and chance performance retained
Cognition|learning-trials|Learns a shared task quickest|Learns a shared task slowest|specialist|cognition|Same criterion/warmup protocol; censoring of failures retained
Cognition|memory-retention|Longest memory in a shared test|Shortest memory in a shared test|specialist||Same task/delay/success criterion; anecdotes not comparable
History|fossil-first-occurrence|Oldest known fossils|Youngest known fossils|intuitive|fossils|Same taxonomic rank; interval bounds retained; oldest known fossil not true origin
History|description-year|Named by science longest ago|Named by science most recently|intuitive|description|Verify original formal description, accepted species and synonym history
History|domestication-date|Domesticated longest ago|Domesticated most recently|intuitive|domestication|Archaeological evidence ranges; domestic lineage scope and independent events explicit
History|extinction-date|Extinct longest ago|Extinct most recently|intuitive|iucn|Verified extinction year/range; last sighting not declared extinction date
History|rediscovery-gap|Longest gap before rediscovery|Shortest gap before rediscovery|intuitive|translocation|Confirmed last/rediscovery records of same species; local recovery not rediscovery
History|reintroduction-date|Reintroduced longest ago|Reintroduced most recently|intuitive|translocation|Specify region and verified released population; introduction not reintroduction
'''

def main():
    rows = []
    for line in SPEC.strip().splitlines():
        bucket, key, high, low, interest, refs, gate = line.split('|')
        keys = refs.split(',') if refs else []
        evidence = [SOURCES[k] for k in keys]
        # Source-located means a lead, not proof of enough comparable observations.
        status = 'evidence_lead' if keys else 'no_comparable_source_yet'
        if any(e[3] == 'downloaded' for e in evidence):
            status = 'downloaded_source_requires_endpoint_audit'
        if keys and all(e[3] in {'limited_study', 'source_located_context_only', 'downloaded_context_only'} for e in evidence):
            status = 'limited_or_context_only_source'
        rows.append(dict(id=key, bucket=bucket, high_label=high, low_label=low,
                         interest=interest, status=status, source_ids=';'.join(keys),
                         source_urls=';'.join(e[1] for e in evidence),
                         coverage='; '.join(e[2] for e in evidence),
                         evidence_gate=gate, manual_decision='pending', game_approved=False))
    assert len({r['id'] for r in rows}) == len(rows)
    assert all(r['high_label'] and r['low_label'] and not r['game_approved'] for r in rows)
    OUT.mkdir(parents=True, exist_ok=True)
    with (OUT / 'expanded-category-register.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]), lineterminator='\n')
        writer.writeheader(); writer.writerows(rows)
    summary = dict(date='2026-10-02', concepts=len(rows), opposite_labels=2*len(rows),
                   buckets=dict(collections.Counter(r['bucket'] for r in rows)),
                   evidence_status=dict(collections.Counter(r['status'] for r in rows)),
                   interest=dict(collections.Counter(r['interest'] for r in rows)),
                   newly_approved_game_labels=0,
                   count_caution='Combined editorial register, including existing concepts and unsourced proposals. Not an additive count of new playable categories. No clade copies or max/min variants counted as new concepts.',
                   sources={key:dict(title=v[0], url=v[1], coverage=v[2], acquisition=v[3]) for key,v in SOURCES.items()})
    (OUT / 'expanded-category-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
    print(json.dumps({k:v for k,v in summary.items() if k != 'sources'}, indent=2))

if __name__ == '__main__':
    main()
