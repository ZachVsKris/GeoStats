from pathlib import Path
import hashlib
import sys

root = Path(__file__).resolve().parents[1]
required = [
    'README_FIRST.md', 'START_HERE_V14_4.md', 'RELEASE_NOTES_V14_4.md', 'BUILD_VALIDATION_V14_4.md', 'FILE_MANIFEST_SHA256_V14_4.txt',
    'RUN_THIS_IN_SUPABASE_FOR_V14_4.sql', 'VERIFY_V14_4.sql', 'ROLLBACK_V14_4.sql',
    'proxy.ts', 'lib/categoryPlayability.ts', 'lib/dailyTrioRules.ts',
    'lib/seedCapacity.ts', 'app/api/admin/daily/capacity/route.ts',
    'supabase/migrations/025_v14_4_playability_rebuild.sql',
    'GITHUB_ACTIONS/README.md', '.github/workflows', 'scripts/sync-visible-workflows.py', 'archive/README.md', '.gitignore', 'GITIGNORE_VISIBLE.txt'
]
missing = [item for item in required if not (root / item).exists()]
if missing:
    print('Missing v14.4 files:', *missing, sep='\n- ')
    sys.exit(1)

forbidden = ['middleware.ts', '.next', 'node_modules', '.tmp-v144-types.d.ts', 'tsconfig.v144-check.json', 'tsconfig.tsbuildinfo', 'gitignore']
present = [item for item in forbidden if (root / item).exists()]
if present:
    print('Forbidden release artifacts:', present)
    sys.exit(1)

sql = (root / 'RUN_THIS_IN_SUPABASE_FOR_V14_4.sql').read_text()
for fragment in ['category_playability_v144', "('pending','exact','general'", 'reconcile_category_playability_v144']:
    if fragment not in sql:
        print('Missing SQL invariant:', fragment)
        sys.exit(1)

for path in [
    root / 'scripts/audit-player-source-links.py',
    root / 'scripts/audit-source-integrity.py',
    root / 'scripts/data_pipeline/base.py',
]:
    if 'reconcile_category_playability_v144' not in path.read_text():
        print('Missing automatic playability reconciliation:', path.relative_to(root))
        sys.exit(1)

if (root / '.gitignore').read_bytes() != (root / 'GITIGNORE_VISIBLE.txt').read_bytes():
    print('GITIGNORE_VISIBLE.txt is out of sync with .gitignore')
    sys.exit(1)

real_workflows = root / '.github' / 'workflows'
visible_workflows = root / 'GITHUB_ACTIONS' / 'workflows'
real_names = sorted(path.name for path in real_workflows.iterdir() if path.is_file())
visible_names = sorted(path.name for path in visible_workflows.iterdir() if path.is_file())
if real_names != visible_names:
    print('Visible GitHub Actions copy is out of sync:', real_names, visible_names)
    sys.exit(1)
for name in real_names:
    if (real_workflows / name).read_bytes() != (visible_workflows / name).read_bytes():
        print('Visible workflow differs from .github copy:', name)
        sys.exit(1)

legacy_root_files = [
    path.name for path in root.iterdir()
    if path.is_file() and (
        path.name.startswith('RUN_THIS_IN_SUPABASE_FOR_V13')
        or path.name.startswith('RUN_THIS_IN_SUPABASE_FOR_V14_3')
        or path.name.startswith('VERIFY_V13')
        or path.name.startswith('VERIFY_V14_3')
    )
]
if legacy_root_files:
    print('Superseded operational files must be archived:', legacy_root_files)
    sys.exit(1)

manifest_path = root / 'FILE_MANIFEST_SHA256_V14_4.txt'
manifest_entries = {}
for line in manifest_path.read_text().splitlines():
    if not line.strip():
        continue
    digest, relative = line.split('  ', 1)
    manifest_entries[relative] = digest
actual_files = sorted(
    path.relative_to(root).as_posix()
    for path in root.rglob('*')
    if path.is_file() and path != manifest_path
)
if sorted(manifest_entries) != actual_files:
    missing_from_manifest = sorted(set(actual_files) - set(manifest_entries))
    stale_manifest_entries = sorted(set(manifest_entries) - set(actual_files))
    print('Release manifest file list mismatch:', {'missing': missing_from_manifest, 'stale': stale_manifest_entries})
    sys.exit(1)
for relative, expected_digest in manifest_entries.items():
    digest = hashlib.sha256((root / relative).read_bytes()).hexdigest()
    if digest != expected_digest:
        print('Release manifest hash mismatch:', relative)
        sys.exit(1)

print('v14.4 repository structure verified')
