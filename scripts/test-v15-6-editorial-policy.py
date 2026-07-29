from pathlib import Path
text=Path('lib/categoryEditorialPolicy.ts').read_text()
for marker in ['Most stock trading','Best access to safe drinking water','Most graduates in STEM','Most land protected','5510','total reserves','largest continuous land area']:
    assert marker in text, marker
sql=Path('RUN_THIS_IN_SUPABASE_FOR_V15_6.sql').read_text()
for marker in ['category_catalog_editorial_v15_6','production-only agriculture','asylum-applications:coo:applied','daily_challenge_archive_v15_6']:
    assert marker in sql, marker
print('v15.6 editorial-policy checks passed.')
