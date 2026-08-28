#!/usr/bin/env node
/**
 * v16.2.7 compatibility runner for the production reachability audit.
 *
 * The gameplay catalog deliberately preserves some legacy/stable category IDs
 * (notably FAOSTAT) even when the current warehouse row has a newer descriptive
 * ID. stat_observations is keyed by the warehouse row ID. The original audit
 * loaded the stable gameplay ID and then queried observations with it, causing
 * false "no approved common-year observations" failures.
 *
 * This runner patches only that identity-translation section in a temporary
 * copy of the existing audit, then executes the complete original audit. All
 * solver, Top-20, Random, Daily, diversity, and release assertions remain intact.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const originalPath = path.join(__dirname, 'audit-v16-2-7-reachability.cjs');
const patchedPath = path.join(__dirname, '.audit-v16-2-7-reachability.warehouse-id-patched.cjs');
let source = fs.readFileSync(originalPath, 'utf8');

const catalogNeedle = `  const categories = buildPlayableCategoryCatalog(rows);\n  if (!categories.length) throw new Error('Production strict-pass catalog is empty.');\n\n  const byYear = new Map();`;

const catalogReplacement = `  const categories = buildPlayableCategoryCatalog(rows);\n  if (!categories.length) throw new Error('Production strict-pass catalog is empty.');\n\n  // Stable gameplay IDs can differ from the current warehouse row IDs. Build\n  // an explicit two-way identity map from the same strict-pass rows used to\n  // construct the playable catalog so observations are queried by warehouse ID\n  // while solver/category exposure continues to use stable gameplay IDs.\n  const playableRuntimeIds = new Set(categories.map((category) => category.id));\n  const warehouseIdByRuntimeId = new Map();\n  const runtimeIdByWarehouseId = new Map();\n  for (const row of rows) {\n    const built = buildPlayableCategoryCatalog([row]);\n    if (built.length !== 1) continue;\n    const runtimeId = built[0].id;\n    if (!playableRuntimeIds.has(runtimeId)) continue;\n    const existingWarehouseId = warehouseIdByRuntimeId.get(runtimeId);\n    if (existingWarehouseId && existingWarehouseId !== row.id) {\n      throw new Error(\`Ambiguous warehouse identity for stable category \${runtimeId}: \${existingWarehouseId} vs \${row.id}\`);\n    }\n    warehouseIdByRuntimeId.set(runtimeId, row.id);\n    runtimeIdByWarehouseId.set(row.id, runtimeId);\n  }\n  const unresolvedRuntimeIds = categories\n    .map((category) => category.id)\n    .filter((id) => !warehouseIdByRuntimeId.has(id));\n  if (unresolvedRuntimeIds.length) {\n    throw new Error(\`\${unresolvedRuntimeIds.length} playable categories lack a warehouse identity; sample: \${unresolvedRuntimeIds.slice(0, 20).join(', ')}\`);\n  }\n\n  const byYear = new Map();`;

if (!source.includes(catalogNeedle)) {
  throw new Error('Reachability audit catalog identity patch point was not found; refusing to run a partially patched audit.');
}
source = source.replace(catalogNeedle, catalogReplacement);

const observationNeedle = `    for (const categoryChunk of chunks(yearCategories, 24)) {\n      const ids = categoryChunk.map((category) => category.id);\n      const observationRows = await fetchAll((from, to) => supabase\n        .from('stat_observations')\n        .select('category_id,country_iso3,country_name,data_year,value')\n        .in('category_id', ids)\n        .eq('data_year', year)\n        .order('category_id')\n        .order('country_iso3')\n        .range(from, to));\n      for (const row of observationRows) {\n        const list = observationsByCategory.get(row.category_id);\n        if (!list) continue;\n        list.push({`;

const observationReplacement = `    for (const categoryChunk of chunks(yearCategories, 24)) {\n      const warehouseIds = categoryChunk.map((category) => warehouseIdByRuntimeId.get(category.id));\n      const observationRows = await fetchAll((from, to) => supabase\n        .from('stat_observations')\n        .select('category_id,country_iso3,country_name,data_year,value')\n        .in('category_id', warehouseIds)\n        .eq('data_year', year)\n        .order('category_id')\n        .order('country_iso3')\n        .range(from, to));\n      for (const row of observationRows) {\n        const runtimeId = runtimeIdByWarehouseId.get(row.category_id) || row.category_id;\n        const list = observationsByCategory.get(runtimeId);\n        if (!list) continue;\n        list.push({`;

if (!source.includes(observationNeedle)) {
  throw new Error('Reachability audit observation identity patch point was not found; refusing to run a partially patched audit.');
}
source = source.replace(observationNeedle, observationReplacement);

fs.writeFileSync(patchedPath, source);
try {
  const result = spawnSync(process.execPath, [patchedPath, ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status == null ? 1 : result.status;
} finally {
  try { fs.unlinkSync(patchedPath); } catch {}
}
