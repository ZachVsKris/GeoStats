#!/usr/bin/env node
const fs = require('node:fs');
const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL and a Supabase service-role key are required.');
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function chunks(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

async function fetchAll(queryFactory, pageSize = 1000) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const result = await queryFactory(from, from + pageSize - 1);
    if (result.error) throw new Error(result.error.message);
    const page = result.data || [];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function snapshot() {
  const categories = await fetchAll((from, to) => supabase
    .from('category_runtime_review_v16_2')
    .select('id,common_year,ranking_direction,source_indicator_code,quality_score')
    .eq('computed_playable_v16_2', true)
    .order('id')
    .range(from, to));
  if (!categories.length) throw new Error('Production strict-pass catalog is empty.');

  const observations = [];
  for (const batch of chunks(categories, 24)) {
    const ids = batch.map((row) => row.id);
    const years = [...new Set(batch.map((row) => row.common_year).filter(Number.isInteger))];
    for (const year of years) {
      const yearIds = batch.filter((row) => row.common_year === year).map((row) => row.id);
      if (!yearIds.length) continue;
      const rows = await fetchAll((from, to) => supabase
        .from('stat_observations')
        .select('category_id,country_iso3,data_year,value')
        .in('category_id', yearIds)
        .eq('data_year', year)
        .order('category_id')
        .order('country_iso3')
        .range(from, to));
      observations.push(...rows.map((row) => [
        String(row.category_id),
        String(row.country_iso3),
        Number(row.data_year),
        Number(row.value),
      ]));
    }
  }
  observations.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]) || a[2] - b[2]);
  const categoryShape = categories.map((row) => [
    String(row.id),
    Number(row.common_year),
    String(row.ranking_direction || ''),
    String(row.source_indicator_code || ''),
    Number(row.quality_score || 0),
  ]);
  const payload = JSON.stringify({ categories: categoryShape, observations });
  const sha256 = crypto.createHash('sha256').update(payload).digest('hex');
  return { sha256, categoryCount: categories.length, observationCount: observations.length };
}

async function main() {
  const writeArg = process.argv.find((arg) => arg.startsWith('--write='));
  const compareArg = process.argv.find((arg) => arg.startsWith('--compare='));
  if (!writeArg && !compareArg) throw new Error('Use --write=<path> or --compare=<path>.');
  const current = await snapshot();
  if (writeArg) {
    const target = writeArg.slice('--write='.length);
    fs.writeFileSync(target, JSON.stringify(current, null, 2) + '\n');
    console.log('Catalog fingerprint captured:', JSON.stringify(current));
    return;
  }
  const target = compareArg.slice('--compare='.length);
  const prior = JSON.parse(fs.readFileSync(target, 'utf8'));
  console.log('Catalog fingerprint before:', JSON.stringify(prior));
  console.log('Catalog fingerprint after:', JSON.stringify(current));
  if (prior.sha256 !== current.sha256 || prior.categoryCount !== current.categoryCount || prior.observationCount !== current.observationCount) {
    throw new Error('Production catalog mutated during the reachability audit; discard this audit and rerun against a stable snapshot.');
  }
  console.log('Production catalog remained byte-stable across the reachability audit.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exit(1);
});
