from types import SimpleNamespace
from data_pipeline.base import WarehouseImporter
from data_pipeline.models import CandidateDefinition, IndicatorRule, SourceObservation

RULE = IndicatorRule(
    key='subset-fixture', title='Subset fixture', description='fixture', family='Geography',
    icon='🗺️', unit='count', value_type='total', ranking_direction='high', include=(), min_coverage=12,
)

def candidate(**metadata):
    return CandidateDefinition(RULE, 'fixture', 'fixture', 'https://example.invalid', metadata)

def rows(ids):
    return [SourceObservation(i, i, 2024, float(n), 'https://example.invalid', evidence_status='official') for n,i in enumerate(ids,1)]

ids=[f'X{i:02d}' for i in range(16)]
q=SimpleNamespace(common_year=2024)
WarehouseImporter.validate_eligible_universe(candidate(
    eligible_universe_type='defined_subset', eligible_universe_rule='fixture logical subset',
    eligible_country_count=16, eligible_country_iso3=ids,
), rows(ids), q)

try:
    WarehouseImporter.validate_eligible_universe(candidate(
        eligible_universe_type='defined_subset', eligible_universe_rule='fixture logical subset',
        eligible_country_count=16, eligible_country_iso3=ids,
    ), rows(ids[:-1]), q)
except RuntimeError as exc:
    assert 'incomplete' in str(exc).lower()
else:
    raise AssertionError('Incomplete subset should fail closed')

ids12=[f'Y{i:02d}' for i in range(12)]
try:
    WarehouseImporter.validate_eligible_universe(candidate(
        eligible_universe_type='defined_subset', eligible_universe_rule='small subset',
        eligible_country_count=12, eligible_country_iso3=ids12,
    ), rows(ids12), q)
except RuntimeError as exc:
    assert 'exception' in str(exc).lower()
else:
    raise AssertionError('12–15 subset requires explicit exception approval')

WarehouseImporter.validate_eligible_universe(candidate(
    eligible_universe_type='defined_subset', eligible_universe_rule='small subset',
    eligible_country_count=12, eligible_country_iso3=ids12, eligible_universe_exception_approved=True,
), rows(ids12), q)
print('Eligible-universe validation fixtures passed.')
