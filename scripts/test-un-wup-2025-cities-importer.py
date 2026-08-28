import csv, importlib.util, sys, tempfile
from pathlib import Path
p=Path(__file__).with_name('import-un-wup-2025-cities.py')
spec=importlib.util.spec_from_file_location('unwupcities2025',p); m=importlib.util.module_from_spec(spec); sys.modules[spec.name]=m; spec.loader.exec_module(m)

with tempfile.TemporaryDirectory() as d:
    f=Path(d)/'cities.csv'
    fields=['ISO3','Country','CityID','City','Year','PopulationThousands','PopulationGrowthPct','LandAreaKm2','LandGrowthPct','BuiltAreaKm2','BuiltGrowthPct']
    with f.open('w',newline='',encoding='utf-8') as h:
        w=csv.DictWriter(h,fieldnames=fields); w.writeheader()
        # 20 canonical countries makes the defined-subset gate exercise the normal >=16 path.
        countries=list(m.CANONICAL_COUNTRY_NAMES.items())[:20]
        for ci,(iso,country) in enumerate(countries,1):
            for j in (1,2):
                pop=600 + ci*50 + j*100
                w.writerow({'ISO3':iso,'Country':country,'CityID':f'{iso}-{j}','City':f'City {j}','Year':2025,
                    'PopulationThousands':pop,'PopulationGrowthPct':1+j/10,'LandAreaKm2':100+j*10,
                    'LandGrowthPct':0.5+j/10,'BuiltAreaKm2':50+j*5,'BuiltGrowthPct':0.8+j/10})
        w.writerow({'ISO3':'WLD','Country':'World','CityID':'W-1','City':'World City','Year':2025,'PopulationThousands':99999,
                    'PopulationGrowthPct':9,'LandAreaKm2':999,'LandGrowthPct':9,'BuiltAreaKm2':900,'BuiltGrowthPct':9})
    imp=m.Importer(None,str(f),True)
    cs={c.rule.key:c for c in imp.discover()}
    assert len(cs)==13
    assert all(c.metadata['eligible_country_count']==20 for c in cs.values())
    assert all(c.metadata['eligible_universe_type']=='defined_subset' for c in cs.values())
    obs=imp.fetch_observations(cs['city-count']); assert len(obs)==20 and all(o.value==2 for o in obs)
    assert all(o.country_iso3!='WLD' for o in obs)
    largest=imp.fetch_observations(cs['largest-city']); assert all(o.value>0 for o in largest)
    concentration=imp.fetch_observations(cs['largest-city-concentration']); assert all(0<=o.value<=100 for o in concentration)
    density=imp.fetch_observations(cs['city-density']); assert all(o.value>0 for o in density)
    built=imp.fetch_observations(cs['built-share']); assert all(0<=o.value<=100 for o in built)
    result=imp.run()
    assert result['categories_processed']==13 and not result['failures'], result

# Missing a component for one qualifying city must remove that country from the eligible set for dependent metrics.
with tempfile.TemporaryDirectory() as d:
    f=Path(d)/'cities.csv'; fields=['ISO3','Country','CityID','City','Year','PopulationThousands','PopulationGrowthPct','LandAreaKm2','LandGrowthPct','BuiltAreaKm2','BuiltGrowthPct']
    with f.open('w',newline='',encoding='utf-8') as h:
        w=csv.DictWriter(h,fieldnames=fields); w.writeheader()
        countries=list(m.CANONICAL_COUNTRY_NAMES.items())[:20]
        for ci,(iso,country) in enumerate(countries):
            for j in (1,2):
                row={'ISO3':iso,'Country':country,'CityID':f'{iso}-{j}','City':f'City {j}','Year':2025,'PopulationThousands':100+j,
                     'PopulationGrowthPct':1,'LandAreaKm2':10,'LandGrowthPct':1,'BuiltAreaKm2':5,'BuiltGrowthPct':1}
                if ci==0 and j==2: row['BuiltAreaKm2']=''
                w.writerow(row)
    imp=m.Importer(None,str(f),True); cs={c.rule.key:c for c in imp.discover()}
    assert cs['city-count'].metadata['eligible_country_count']==20
    assert cs['total-built-area'].metadata['eligible_country_count']==19

print('UN WUP 2025 cities importer fixtures passed.')
