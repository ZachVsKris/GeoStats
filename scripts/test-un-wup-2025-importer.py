import csv
import importlib.util
import sys
import tempfile
from pathlib import Path

p = Path(__file__).with_name('import-un-wup-2025.py')
spec = importlib.util.spec_from_file_location('unwup2025', p)
m = importlib.util.module_from_spec(spec); sys.modules[spec.name] = m; spec.loader.exec_module(m)

with tempfile.TemporaryDirectory() as d:
    f = Path(d) / 'wup-normalized.csv'
    fields = ['ISO3','Country','Year','Category','PopulationThousands','PopulationSharePct','PopulationGrowthPct','ShareGrowthPct']
    with f.open('w', newline='', encoding='utf-8') as h:
        w = csv.DictWriter(h, fieldnames=fields); w.writeheader()
        for iso, country, base in [('FRA','France',10),('DEU','Germany',20),('USA','United States',30)]:
            for category, offset in [('Cities',1),('Towns and Semi-dense Areas',2),('Rural Areas',3)]:
                w.writerow({
                    'ISO3':iso,'Country':country,'Year':2025,'Category':category,
                    'PopulationThousands':1000*base+offset,
                    'PopulationSharePct':20+base+offset,
                    'PopulationGrowthPct':0.5+offset/10,
                    'ShareGrowthPct':-0.3+offset/10,
                })
        # Aggregate must never enter GeoStats current-country observations.
        w.writerow({'ISO3':'WLD','Country':'World','Year':2025,'Category':'Cities','PopulationThousands':999999,'PopulationSharePct':99,'PopulationGrowthPct':9,'ShareGrowthPct':9})
    imp = m.Importer(None, str(f), True)
    candidates = {c.rule.key:c for c in imp.discover()}
    assert len(candidates) == 11
    assert candidates['city-share-growth'].rule.unit == '% per year'
    assert candidates['rural-share-decline'].rule.ranking_direction == 'low'
    assert len(imp.fetch_observations(candidates['city-population'])) == 3
    assert imp.fetch_observations(candidates['city-population'])[0].data_year == 2025
    assert all(o.country_iso3 != 'WLD' for o in imp.fetch_observations(candidates['city-share']))
    assert all(c.metadata.get('manual_review_required') for c in candidates.values())

with tempfile.TemporaryDirectory() as d:
    f = Path(d) / 'bad.csv'
    fields = ['ISO3','Country','Year','Category','PopulationThousands','PopulationSharePct','PopulationGrowthPct','ShareGrowthPct']
    with f.open('w', newline='', encoding='utf-8') as h:
        w=csv.DictWriter(h,fieldnames=fields); w.writeheader()
        row={'ISO3':'FRA','Country':'France','Year':2025,'Category':'Cities','PopulationThousands':1,'PopulationSharePct':101,'PopulationGrowthPct':1,'ShareGrowthPct':1}
        w.writerow(row)
    imp=m.Importer(None,str(f),True); c={x.rule.key:x for x in imp.discover()}['city-share']
    try:
        imp.fetch_observations(c)
        raise AssertionError('Expected out-of-range share to fail closed')
    except RuntimeError as exc:
        assert 'outside 0-100' in str(exc)


# Full dry-run on a 175-country synthetic snapshot exercises the shared quality path.
with tempfile.TemporaryDirectory() as d:
    f = Path(d) / 'wup-full.csv'
    fields = ['ISO3','Country','Year','Category','PopulationThousands','PopulationSharePct','PopulationGrowthPct','ShareGrowthPct']
    with f.open('w', newline='', encoding='utf-8') as h:
        w=csv.DictWriter(h,fieldnames=fields); w.writeheader()
        for i,(iso,country) in enumerate(list(m.CANONICAL_COUNTRY_NAMES.items())[:175],1):
            for category,offset in [('Cities',1),('Towns and Semi-dense Areas',2),('Rural Areas',3)]:
                w.writerow({'ISO3':iso,'Country':country,'Year':2025,'Category':category,
                    'PopulationThousands':1000+i*10+offset,'PopulationSharePct':20+(i%50)+offset/10,
                    'PopulationGrowthPct':-1+(i%20)/10+offset/100,'ShareGrowthPct':-0.5+(i%10)/20+offset/100})
    imp=m.Importer(None,str(f),True)
    result=imp.run()
    assert result['categories_processed']==11 and not result['failures'], result

print('UN WUP 2025 country importer fixtures passed.')
