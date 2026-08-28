from historical_successors import GROUPS, predecessor_key, resolve_successors
assert predecessor_key('USSR') == 'USSR'
assert predecessor_key('Sudan', event_year=2010) == 'SUDAN_PRE_2011'
assert predecessor_key('Sudan', event_year=2015) is None
assert resolve_successors('USSR') == ()
assert resolve_successors('USSR', mode='primary_successor') == ('RUS',)
assert set(resolve_successors('Czechoslovakia', mode='all_successors')) == {'CZE','SVK'}
try:
    resolve_successors('Czechoslovakia', mode='primary_successor')
except ValueError:
    pass
else:
    raise AssertionError('Ambiguous predecessor must fail closed for primary-successor mode')
assert 'YUGOSLAVIA' in GROUPS and 'SUDAN_PRE_2011' in GROUPS
print('Historical-successor framework fixtures passed.')
